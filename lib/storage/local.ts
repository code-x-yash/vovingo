import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
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

export class LocalStorageDriver implements StorageDriver {
  readonly name = "local" as const;
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  /** Resolves a key inside the root, refusing anything that escapes it. */
  private resolve(key: string): string {
    const safe = sanitizeKey(key);
    const full = path.resolve(this.root, ...safe.split("/"));
    if (full !== this.root && !full.startsWith(this.root + path.sep)) {
      throw new StorageError("bad_key", `Storage key escapes the storage root: ${key}`);
    }
    return full;
  }

  async put(key: string, body: StorageBody, options?: PutOptions): Promise<StoredObject> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    const bytes = toBytes(body);
    await writeFile(file, bytes);
    return {
      key: sanitizeKey(key),
      size: byteLength(body),
      contentType: options?.contentType ?? contentTypeFor(key),
    };
  }

  async get(key: string): Promise<StoredContent | null> {
    const file = this.resolve(key);
    try {
      const [buf, info] = await Promise.all([readFile(file), stat(file)]);
      return {
        body: new Uint8Array(buf),
        contentType: contentTypeFor(key),
        size: info.size,
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async head(key: string): Promise<{ size: number } | null> {
    try {
      const info = await stat(this.resolve(key));
      return { size: info.size };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}
