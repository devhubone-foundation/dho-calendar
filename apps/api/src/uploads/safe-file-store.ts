import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Filesystem storage for server-generated image files under one directory.
 * Every stored filename is always server-generated — a UUID plus the fixed
 * extension this store was configured for — so any untrusted filename that
 * doesn't match that exact shape, or would resolve outside the directory, is
 * rejected before touching the filesystem. Shared by
 * ProfilePictureStorageService and EventCoverStorageService, which differ
 * only in their root directory and stored extension.
 */
export class SafeFileStore {
  private readonly filenamePattern: RegExp;
  private readonly dir: string;

  constructor(dir: string, extension: string) {
    this.dir = dir;
    this.filenamePattern = new RegExp(
      `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.${extension}$`,
    );
  }

  /** Writes a new file and returns its server-generated filename (no directory prefix). */
  async save(buffer: Buffer, extension: string): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const filename = `${randomUUID()}.${extension}`;
    await writeFile(path.join(this.dir, filename), buffer, { mode: 0o644 });
    return filename;
  }

  /** Deletes a previously stored file, identified by filename (directory
   * prefixes are stripped, not trusted). Silently no-ops if already missing. */
  async removeIfExists(filename: string | null | undefined): Promise<void> {
    if (!filename) {
      return;
    }
    const resolved = this.resolveFilename(path.basename(filename));
    if (!resolved) {
      return;
    }
    await rm(resolved, { force: true });
  }

  /** Resolves an untrusted filename to an absolute path within this store's
   * directory, or null if it doesn't match the strict pattern or would
   * escape the directory. */
  resolveFilename(filename: string): string | null {
    if (!this.filenamePattern.test(filename)) {
      return null;
    }
    const resolved = path.resolve(this.dir, filename);
    if (path.dirname(resolved) !== this.dir) {
      return null;
    }
    return resolved;
  }
}
