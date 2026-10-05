import type { D1Client } from "../db/d1-http";

export type R2ObjectInfo = {
  key: string;
  size: number;
  uploaded: Date;
  etag: string;
};

export type R2PutOptions = {
  httpMetadata?: { contentType?: string; cacheControl?: string };
};

export type R2BucketLike = {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | ReadableStream,
    options?: R2PutOptions
  ): Promise<{ key: string } | null>;
  get(key: string): Promise<{ body: ReadableStream; size: number } | null>;
  head(key: string): Promise<{ size: number } | null>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number }): Promise<{ objects: R2ObjectInfo[] }>;
};

declare global {
  interface CloudflareEnv {
    DB?: D1Client;
    MEDIA?: R2BucketLike;
  }
}

export {};
