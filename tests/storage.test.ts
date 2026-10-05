import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LocalStorageDriver,
  S3StorageDriver,
  contentTypeFor,
  extensionOf,
  getStorage,
  resetStorage,
  sanitizeKey,
  speakingAudioKey,
  storageDriverName,
  StorageError,
} from "../lib/storage";
import {
  buildCanonicalRequest,
  createAuthorizationHeader,
  sha256Hex,
} from "../lib/storage/s3";

describe("sanitizeKey", () => {
  it("normalises slashes and trims", () => {
    expect(sanitizeKey("/users/1/take.webm/")).toBe("users/1/take.webm");
    expect(sanitizeKey("users\\1\\take.webm")).toBe("users/1/take.webm");
  });

  it("rejects traversal, dot segments and empty keys", () => {
    expect(() => sanitizeKey("../secrets")).toThrow(StorageError);
    expect(() => sanitizeKey("users/../../etc/passwd")).toThrow(StorageError);
    expect(() => sanitizeKey("users/./x")).toThrow(StorageError);
    expect(() => sanitizeKey("")).toThrow(StorageError);
    expect(() => sanitizeKey("   ")).toThrow(StorageError);
  });

  it("rejects unsupported characters", () => {
    expect(() => sanitizeKey("users/1/take!.webm")).toThrow(/unsupported/);
    expect(() => sanitizeKey("users/1/take webm")).toThrow(StorageError);
  });
});

describe("contentTypeFor / extensionOf", () => {
  it("maps known extensions", () => {
    expect(contentTypeFor("users/1/s2.webm")).toBe("audio/webm");
    expect(contentTypeFor("a/b/FILE.WAV")).toBe("audio/wav");
    expect(extensionOf("a/b/c.m4a")).toBe("m4a");
    expect(extensionOf("a/b/c")).toBe("");
  });

  it("falls back to application/octet-stream", () => {
    expect(contentTypeFor("a/b/c.xyz")).toBe("application/octet-stream");
  });
});

describe("speakingAudioKey", () => {
  it("builds a namespaced key", () => {
    expect(speakingAudioKey(7, 42, "webm")).toBe("users/7/speaking/s42.webm");
  });

  it("rejects bad extensions", () => {
    expect(() => speakingAudioKey(7, 42, "../x")).toThrow(StorageError);
    expect(() => speakingAudioKey(7, 42, "tar.gz")).toThrow(StorageError);
  });
});

describe("LocalStorageDriver", () => {
  let dir: string;
  let storage: LocalStorageDriver;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "vovingo-storage-"));
    storage = new LocalStorageDriver(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips put/get/head/delete", async () => {
    const payload = new TextEncoder().encode("hello take");
    const put = await storage.put("users/1/speaking/s9.wav", payload, {
      contentType: "audio/wav",
    });
    expect(put).toEqual({
      key: "users/1/speaking/s9.wav",
      size: 10,
      contentType: "audio/wav",
    });

    const got = await storage.get("users/1/speaking/s9.wav");
    expect(got).not.toBeNull();
    expect(new TextDecoder().decode(got!.body)).toBe("hello take");
    expect(got!.contentType).toBe("audio/wav");
    expect(got!.size).toBe(10);

    expect(await storage.head("users/1/speaking/s9.wav")).toEqual({ size: 10 });

    await storage.delete("users/1/speaking/s9.wav");
    expect(await storage.get("users/1/speaking/s9.wav")).toBeNull();
    expect(await storage.head("users/1/speaking/s9.wav")).toBeNull();
    await expect(storage.delete("users/1/speaking/s9.wav")).resolves.toBeUndefined();
  });

  it("creates nested directories and derives content type from the key", async () => {
    await storage.put("users/2/deep/note.txt", "plain");
    const got = await storage.get("users/2/deep/note.txt");
    expect(got!.contentType).toContain("text/plain");
    const files = await readdir(path.join(dir, "users", "2", "deep"));
    expect(files).toContain("note.txt");
  });

  it("refuses to write outside the root", async () => {
    await expect(storage.put("../escape.txt", "x")).rejects.toThrow(StorageError);
    expect(await readdir(path.dirname(dir))).not.toContain("escape.txt");
  });
});

describe("storage factory", () => {
  afterEach(() => {
    resetStorage();
    delete process.env.STORAGE_DRIVER;
    delete process.env.LOCAL_STORAGE_DIR;
  });

  it("storageDriverName reads the env switch", () => {
    expect(storageDriverName({})).toBe("local");
    expect(storageDriverName({ STORAGE_DRIVER: "r2" })).toBe("r2");
    expect(storageDriverName({ STORAGE_DRIVER: "r2-s3" })).toBe("r2-s3");
    expect(storageDriverName({ STORAGE_DRIVER: "bogus" })).toBe("local");
  });

  it("getStorage defaults to the local driver", async () => {
    resetStorage();
    process.env.STORAGE_DRIVER = "local";
    const storage = await getStorage();
    expect(storage).toBeInstanceOf(LocalStorageDriver);
  });
});

describe("R2StorageDriver", () => {
  it("round-trips through a bucket binding and rejects bad keys", async () => {
    const { R2StorageDriver } = await import("../lib/storage/r2");
    const store = new Map<string, { bytes: Uint8Array; contentType?: string }>();
    const bucket: import("../lib/types/cloudflare-env").R2BucketLike = {
      async put(key, value, options) {
        const bytes =
          typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value as ArrayBuffer);
        store.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
        return { key };
      },
      async get(key) {
        const entry = store.get(key);
        if (!entry) return null;
        return { body: new Response(entry.bytes as unknown as BodyInit).body!, size: entry.bytes.byteLength };
      },
      async head(key) {
        const entry = store.get(key);
        return entry ? { size: entry.bytes.byteLength } : null;
      },
      async delete(key) {
        store.delete(key);
      },
      async list() {
        return { objects: [] };
      },
    };

    const driver = new R2StorageDriver(bucket);
    await driver.put("users/5/speaking/s1.webm", new TextEncoder().encode("audio-bytes"));
    const got = await driver.get("users/5/speaking/s1.webm");
    expect(got).not.toBeNull();
    expect(new TextDecoder().decode(got!.body)).toBe("audio-bytes");
    expect(got!.contentType).toBe("audio/webm");
    expect(await driver.head("users/5/speaking/s1.webm")).toEqual({ size: 11 });

    expect(await driver.get("users/5/missing.webm")).toBeNull();
    expect(await driver.head("users/5/missing.webm")).toBeNull();

    await expect(driver.put("../escape.webm", "x")).rejects.toThrow(StorageError);
    expect(store.has("../escape.webm")).toBe(false);

    await driver.delete("users/5/speaking/s1.webm");
    expect(await driver.get("users/5/speaking/s1.webm")).toBeNull();
  });
});

describe("S3 SigV4", () => {
  const payloadHash = "44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072";

  it("builds the canonical request in SigV4 order", async () => {
    const canonical = buildCanonicalRequest({
      method: "put",
      path: "/vovingo-media/users/1/speaking/s2.webm",
      headers: {
        "x-amz-date": "20130524T000000Z",
        host: "examplebucket.s3.amazonaws.com",
        "Content-Type": "audio/webm",
        "x-amz-content-sha256": payloadHash,
      },
      payloadHash,
    });
    expect(canonical).toBe(
      [
        "PUT",
        "/vovingo-media/users/1/speaking/s2.webm",
        "",
        `content-type:audio/webm\nhost:examplebucket.s3.amazonaws.com\n` +
          `x-amz-content-sha256:${payloadHash}\nx-amz-date:20130524T000000Z\n`,
        "content-type;host;x-amz-content-sha256;x-amz-date",
        payloadHash,
      ].join("\n")
    );
  });

  it("signs deterministically for a fixed clock", async () => {
    const now = new Date("2026-10-05T12:34:56Z");
    const build = () =>
      createAuthorizationHeader({
        method: "GET",
        url: "https://acct.r2.cloudflarestorage.com/vovingo-media/users/3/speaking/s11.webm",
        headers: {},
        payload: "",
        accessKeyId: "TESTKEY",
        secretAccessKey: "testsecret",
        region: "auto",
        now,
      });

    const a = await build();
    const b = await build();
    expect(a.authorization).toBe(b.authorization);
    expect(a["x-amz-date"]).toBe("20261005T123456Z");
    expect(a["x-amz-content-sha256"]).toBe(await sha256Hex(""));
    expect(a.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=TESTKEY\/20261005\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/
    );
  });

  it("never signs a PUT without the payload hash", async () => {
    const headers = await createAuthorizationHeader({
      method: "PUT",
      url: "https://acct.r2.cloudflarestorage.com/vovingo-media/clip.webm",
      headers: { "content-type": "audio/webm" },
      payload: new TextEncoder().encode("abc"),
      accessKeyId: "TESTKEY",
      secretAccessKey: "testsecret",
      region: "auto",
      now: new Date("2026-01-02T03:04:05Z"),
    });
    expect(headers["x-amz-content-sha256"]).toBe(await sha256Hex("abc"));
    expect(headers.authorization).toContain("content-type;host;x-amz-content-sha256;x-amz-date");
  });

  it("the driver is constructed from env config", async () => {
    const { S3StorageDriver: S3 } = await import("../lib/storage/s3");
    const driver = new S3(
      {
        endpoint: "https://acct.r2.cloudflarestorage.com",
        bucket: "vovingo-media",
        accessKeyId: "k",
        secretAccessKey: "s",
        region: "auto",
      },
      () => new Date("2026-10-05T00:00:00Z")
    );
    expect(driver.name).toBe("r2-s3");
    expect(S3StorageDriver).toBe(S3);
  });
});
