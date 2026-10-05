import type { R2BucketLike } from "@/lib/types/cloudflare-env";
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

export class R2StorageDriver implements StorageDriver {
  readonly name = "r2" as const;
  private readonly bucket: R2BucketLike;

  constructor(bucket: R2BucketLike) {
    this.bucket = bucket;
  }

  async put(key: string, body: StorageBody, options?: PutOptions): Promise<StoredObject> {
    const safe = sanitizeKey(key);
    const contentType = options?.contentType ?? contentTypeFor(key);
    const result = await this.bucket.put(safe, toBytes(body) as ArrayBufferView, {
      httpMetadata: {
        contentType,
        ...(options?.cacheControl ? { cacheControl: options.cacheControl } : {}),
      },
    });
    if (!result) throw new StorageError("write_failed", `R2 rejected the write for ${safe}.`);
    return { key: safe, size: byteLength(body), contentType };
  }

  async get(key: string): Promise<StoredContent | null> {
    const safe = sanitizeKey(key);
    const object = await this.bucket.get(safe);
    if (!object) return null;
    const buffer = await new Response(object.body).arrayBuffer();
    return {
      body: new Uint8Array(buffer),
      contentType: contentTypeFor(safe),
      size: object.size,
    };
  }

  async head(key: string): Promise<{ size: number } | null> {
    const info = await this.bucket.head(sanitizeKey(key));
    return info ? { size: info.size } : null;
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(sanitizeKey(key));
  }
}

/**
 * Resolves the R2 `MEDIA` binding from the Cloudflare runtime context.
 * Only available in production (`D1`/worker runtime); dev uses the local driver.
 */
export async function getR2Bucket(): Promise<R2BucketLike> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const context = await getCloudflareContext({ async: true });
  const bucket = context.env.MEDIA;
  if (!bucket) {
    throw new Error(
      "STORAGE_DRIVER=r2 but no MEDIA binding found in the Cloudflare context. " +
        "Check wrangler.jsonc r2_buckets configuration."
    );
  }
  return bucket as unknown as R2BucketLike;
}
