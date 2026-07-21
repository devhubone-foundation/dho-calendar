import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ApiEnv } from "@dho/config";

import { ProfilePictureStorageService } from "./profile-picture-storage.service";

describe("ProfilePictureStorageService", () => {
  let uploadRoot: string;
  let service: ProfilePictureStorageService;

  beforeEach(async () => {
    uploadRoot = await mkdtemp(path.join(tmpdir(), "dho-uploads-"));
    service = new ProfilePictureStorageService({ UPLOAD_ROOT: uploadRoot } as ApiEnv);
  });

  afterEach(async () => {
    await rm(uploadRoot, { recursive: true, force: true });
  });

  it("saves a buffer under profiles/ with a server-generated filename", async () => {
    const relativePath = await service.save(Buffer.from("fake-image-bytes"), "webp");
    expect(relativePath).toMatch(/^profiles\/[0-9a-f-]{36}\.webp$/);

    const stored = await readFile(path.join(uploadRoot, relativePath));
    expect(stored.toString()).toBe("fake-image-bytes");
  });

  it("removes a previously saved file", async () => {
    const relativePath = await service.save(Buffer.from("data"), "webp");
    await service.removeIfExists(relativePath);
    await expect(readFile(path.join(uploadRoot, relativePath))).rejects.toThrow();
  });

  it("does nothing when removing a null/undefined path", async () => {
    await expect(service.removeIfExists(null)).resolves.toBeUndefined();
    await expect(service.removeIfExists(undefined)).resolves.toBeUndefined();
  });

  describe("resolveFilename (path-traversal protection)", () => {
    it("accepts a well-formed server-generated filename", async () => {
      const relativePath = await service.save(Buffer.from("data"), "webp");
      const filename = relativePath.replace("profiles/", "");
      const resolved = service.resolveFilename(filename);
      expect(resolved).toBe(path.join(uploadRoot, "profiles", filename));
    });

    it("rejects directory traversal attempts", () => {
      expect(service.resolveFilename("../../etc/passwd")).toBeNull();
      expect(service.resolveFilename("..%2F..%2Fetc%2Fpasswd")).toBeNull();
      expect(service.resolveFilename("../secrets.webp")).toBeNull();
    });

    it("rejects filenames with unexpected extensions or shapes", () => {
      expect(service.resolveFilename("not-a-uuid.webp")).toBeNull();
      expect(service.resolveFilename("11111111-1111-1111-1111-111111111111.png")).toBeNull();
      expect(service.resolveFilename("11111111-1111-1111-1111-111111111111.webp/../x")).toBeNull();
    });

    it("rejects absolute paths disguised as a filename", () => {
      expect(service.resolveFilename("/etc/passwd")).toBeNull();
    });
  });
});
