import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import type { ApiEnv } from "@dho/config";

import { APP_ENV } from "../config/config.tokens";

/** Server-generated filenames only ever look like this: a UUID plus the one
 * extension normalization ever produces. Anything else is rejected before
 * touching the filesystem. */
export const PROFILE_PICTURE_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

@Injectable()
export class ProfilePictureStorageService {
  private readonly profilesDir: string;

  constructor(@Inject(APP_ENV) env: ApiEnv) {
    this.profilesDir = path.resolve(env.UPLOAD_ROOT, "profiles");
  }

  /** Writes a new file under the profiles directory and returns the relative
   * path to store in the database (e.g. "profiles/<uuid>.webp"). Never
   * trusts a client-supplied name; the filename is always server-generated. */
  async save(buffer: Buffer, extension: string): Promise<string> {
    await mkdir(this.profilesDir, { recursive: true });
    const filename = `${randomUUID()}.${extension}`;
    await writeFile(path.join(this.profilesDir, filename), buffer, { mode: 0o644 });
    return `profiles/${filename}`;
  }

  /** Deletes a previously stored file, identified by the relative path saved
   * in the database. Silently no-ops for an already-missing file. */
  async removeIfExists(relativePath: string | null | undefined): Promise<void> {
    if (!relativePath) {
      return;
    }
    const resolved = this.resolveStoredPath(relativePath);
    if (!resolved) {
      return;
    }
    await rm(resolved, { force: true });
  }

  /** Resolves a relative DB path (e.g. "profiles/<uuid>.webp") to an absolute
   * path, refusing anything that would resolve outside the profiles
   * directory. */
  resolveStoredPath(relativePath: string): string | null {
    const filename = path.basename(relativePath);
    return this.resolveFilename(filename);
  }

  /** Resolves an untrusted filename (e.g. a URL path segment) to an absolute
   * path within the profiles directory, or null if it doesn't match the
   * strict server-generated-filename pattern or would escape the directory. */
  resolveFilename(filename: string): string | null {
    if (!PROFILE_PICTURE_FILENAME_PATTERN.test(filename)) {
      return null;
    }
    const resolved = path.resolve(this.profilesDir, filename);
    if (path.dirname(resolved) !== this.profilesDir) {
      return null;
    }
    return resolved;
  }
}
