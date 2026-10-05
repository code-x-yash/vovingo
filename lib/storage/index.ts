import { LocalStorageDriver } from "./local";
import { R2StorageDriver, getR2Bucket } from "./r2";
import { S3StorageDriver, s3ConfigFromEnv } from "./s3";
import type { StorageDriver, StorageDriverName } from "./types";
import { StorageError } from "./types";

export * from "./types";
export { LocalStorageDriver } from "./local";
export { R2StorageDriver } from "./r2";
export { S3StorageDriver, s3ConfigFromEnv } from "./s3";

export function storageDriverName(env: Record<string, string | undefined> = process.env): StorageDriverName {
  const raw = (env.STORAGE_DRIVER ?? "local").toLowerCase();
  return raw === "r2" || raw === "r2-s3" ? raw : "local";
}

let storagePromise: Promise<StorageDriver> | null = null;

async function createStorage(): Promise<StorageDriver> {
  const driver = storageDriverName();
  if (driver === "r2") return new R2StorageDriver(await getR2Bucket());
  if (driver === "r2-s3") return new S3StorageDriver(s3ConfigFromEnv());
  return new LocalStorageDriver(process.env.LOCAL_STORAGE_DIR ?? ".data/uploads");
}

export async function getStorage(): Promise<StorageDriver> {
  if (!storagePromise) storagePromise = createStorage();
  return storagePromise;
}

/** Reset the cached instance (tests / scripts that switch drivers). */
export function resetStorage(): void {
  storagePromise = null;
}

const EXT = /^[a-z0-9]{1,8}$/;

/** Object key for a speaking take's recorded audio. */
export function speakingAudioKey(userId: number, sessionId: number, ext: string): string {
  if (!EXT.test(ext)) throw new StorageError("bad_ext", `Unsupported audio extension: ${ext}`);
  return `users/${userId}/speaking/s${sessionId}.${ext}`;
}
