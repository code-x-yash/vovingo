import {
  byteLength,
  contentTypeFor,
  sanitizeKey,
  toBytes,
  StorageError,
  type PutOptions,
  type StorageBody,
  type StorageDriver,
  type StoredContent,
  type StoredObject,
} from "./types";

// ---------------------------------------------------------------------------
// SigV4 helpers (WebCrypto only — runs in Workers, Node and the test runner)
// ---------------------------------------------------------------------------

export function amzDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`
  );
}

export function dateStamp(value: string): string {
  return value.slice(0, 8);
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacSha256(key: Uint8Array | string, data: string): Promise<Uint8Array> {
  const keyBytes = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function credentialScope(date: string, region: string, service: string): string {
  return `${date}/${region}/${service}/aws4_request`;
}

export function buildCanonicalRequest(input: {
  method: string;
  path: string;
  headers: Record<string, string>;
  payloadHash: string;
}): string {
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.headers)) normalized[k.toLowerCase()] = String(v).trim();
  const names = Object.keys(normalized).sort();
  const canonicalHeaders = names.map((k) => `${k}:${normalized[k]}\n`).join("");
  const signedHeaders = names.join(";");
  return [
    input.method.toUpperCase(),
    input.path,
    "", // no query strings are ever signed by this driver
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n");
}

export function buildStringToSign(
  date: string,
  scope: string,
  canonicalRequest: string,
  hashFn: (s: string) => Promise<string>
): Promise<string> {
  return hashFn(canonicalRequest).then(
    (hash) => ["AWS4-HMAC-SHA256", date, scope, hash].join("\n")
  );
}

export async function createAuthorizationHeader(input: {
  method: string;
  url: string;
  headers: Record<string, string>;
  payload: string | Uint8Array;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service?: string;
  now?: Date;
}): Promise<Record<string, string>> {
  const service = input.service ?? "s3";
  const now = input.now ?? new Date();
  const date = amzDate(now);
  const stamp = dateStamp(date);
  const scope = credentialScope(stamp, input.region, service);

  const url = new URL(input.url);
  const payloadHash = await sha256Hex(input.payload);

  const headers: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(input.headers).map(([k, v]) => [k.toLowerCase(), String(v)])
    ),
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": date,
  };

  const canonical = buildCanonicalRequest({
    method: input.method,
    path: url.pathname,
    headers,
    payloadHash,
  });
  const stringToSign = await buildStringToSign(date, scope, canonical, sha256Hex);
  const signingKey = await deriveSigningKey(input.secretAccessKey, stamp, input.region, service);
  const signature = hex(await hmacSha256(signingKey, stringToSign));

  const signedHeaders = Object.keys(headers)
    .sort()
    .join(";");

  return {
    ...headers,
    authorization:
      `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

export async function deriveSigningKey(
  secret: string,
  date: string,
  region: string,
  service: string
): Promise<Uint8Array> {
  const kDate = await hmacSha256(`AWS4${secret}`, date);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export interface S3Config {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export function s3ConfigFromEnv(env: Record<string, string | undefined> = process.env): S3Config {
  const endpoint =
    env.R2_S3_ENDPOINT ??
    (env.CLOUDFLARE_ACCOUNT_ID
      ? `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : undefined);
  const accessKeyId = env.R2_S3_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_S3_SECRET_ACCESS_KEY;
  const bucket = env.R2_BUCKET_NAME;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new StorageError(
      "missing_config",
      "STORAGE_DRIVER=r2-s3 needs R2_S3_ACCESS_KEY_ID, R2_S3_SECRET_ACCESS_KEY and R2_BUCKET_NAME " +
        "(plus R2_S3_ENDPOINT or CLOUDFLARE_ACCOUNT_ID). Copy .env.example to .env.local."
    );
  }
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket,
    accessKeyId,
    secretAccessKey,
    region: env.R2_S3_REGION ?? "auto",
  };
}

export class S3StorageDriver implements StorageDriver {
  readonly name = "r2-s3" as const;
  private readonly config: S3Config;
  private readonly now: () => Date;

  constructor(config: S3Config, now: () => Date = () => new Date()) {
    this.config = config;
    this.now = now;
  }

  private url(key: string): string {
    const safe = sanitizeKey(key);
    const encoded = safe
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    return `${this.config.endpoint}/${encodeURIComponent(this.config.bucket)}/${encoded}`;
  }

  private async request(
    method: string,
    key: string,
    payload: string | Uint8Array,
    extraHeaders: Record<string, string> = {}
  ): Promise<Response> {
    const url = this.url(key);
    const headers = await createAuthorizationHeader({
      method,
      url,
      headers: extraHeaders,
      payload,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      region: this.config.region,
      now: this.now(),
    });
    const body = method === "GET" || method === "HEAD" ? undefined : payload;
    return fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: body as BodyInit } : {}),
    });
  }

  async put(key: string, body: StorageBody, options?: PutOptions): Promise<StoredObject> {
    const safe = sanitizeKey(key);
    const bytes = typeof body === "string" ? new TextEncoder().encode(body) : toBytes(body);
    const contentType = options?.contentType ?? contentTypeFor(safe);
    const res = await this.request("PUT", safe, bytes, { "content-type": contentType });
    if (!res.ok) {
      throw new StorageError("write_failed", `S3 PUT for ${safe} failed with ${res.status}.`);
    }
    return { key: safe, size: byteLength(body), contentType };
  }

  async get(key: string): Promise<StoredContent | null> {
    const res = await this.request("GET", key, "");
    if (res.status === 404) return null;
    if (!res.ok) throw new StorageError("read_failed", `S3 GET for ${key} failed with ${res.status}.`);
    const buffer = await res.arrayBuffer();
    return {
      body: new Uint8Array(buffer),
      contentType: res.headers.get("content-type") ?? contentTypeFor(key),
      size: buffer.byteLength,
    };
  }

  async head(key: string): Promise<{ size: number } | null> {
    const res = await this.request("HEAD", key, "");
    if (res.status === 404) return null;
    if (!res.ok) throw new StorageError("read_failed", `S3 HEAD for ${key} failed with ${res.status}.`);
    return { size: Number(res.headers.get("content-length") ?? 0) };
  }

  async delete(key: string): Promise<void> {
    const res = await this.request("DELETE", key, "");
    if (!res.ok && res.status !== 404) {
      throw new StorageError("delete_failed", `S3 DELETE for ${key} failed with ${res.status}.`);
    }
  }
}
