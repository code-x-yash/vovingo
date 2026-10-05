export type StorageBody = Uint8Array | ArrayBuffer | string;

export interface PutOptions {
  contentType?: string;
  cacheControl?: string;
}

export interface StoredObject {
  key: string;
  size: number;
  contentType: string;
}

export interface StoredContent {
  body: Uint8Array;
  contentType: string;
  size: number;
}

export interface StorageDriver {
  put(key: string, body: StorageBody, options?: PutOptions): Promise<StoredObject>;
  get(key: string): Promise<StoredContent | null>;
  head(key: string): Promise<{ size: number } | null>;
  delete(key: string): Promise<void>;
}

export type StorageDriverName = "local" | "r2" | "r2-s3";

export class StorageError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}

const KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Validates and normalises an object key. Rejects traversal, absolute paths,
 * empty segments and anything outside a conservative charset — every driver
 * shares this so a bad key can never escape its root in local mode.
 */
export function sanitizeKey(key: string): string {
  const trimmed = (key ?? "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!trimmed) throw new StorageError("bad_key", "Storage key must not be empty.");

  const segments = trimmed.split("/");
  for (const segment of segments) {
    if (!segment || segment === "." || segment === "..") {
      throw new StorageError("bad_key", `Invalid storage key: ${key}`);
    }
    if (!KEY_SEGMENT.test(segment)) {
      throw new StorageError(
        "bad_key",
        `Storage key segment "${segment}" contains unsupported characters.`
      );
    }
  }
  if (trimmed.length > 512) {
    throw new StorageError("bad_key", "Storage key is too long.");
  }
  return segments.join("/");
}

const EXT_CONTENT_TYPES: Record<string, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  mp3: "audio/mpeg",
  mp4: "audio/mp4",
  m4a: "audio/mp4",
  wav: "audio/wav",
  txt: "text/plain; charset=utf-8",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export function extensionOf(key: string): string {
  const last = key.slice(key.lastIndexOf("/") + 1);
  const dot = last.lastIndexOf(".");
  return dot > 0 ? last.slice(dot + 1).toLowerCase() : "";
}

export function contentTypeFor(key: string, fallback = "application/octet-stream"): string {
  return EXT_CONTENT_TYPES[extensionOf(key)] ?? fallback;
}

export function toBytes(body: StorageBody): Uint8Array | string {
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return body;
  return new Uint8Array(body);
}

export function byteLength(body: StorageBody): number {
  if (typeof body === "string") return new TextEncoder().encode(body).length;
  if (body instanceof Uint8Array) return body.byteLength;
  return body.byteLength;
}
