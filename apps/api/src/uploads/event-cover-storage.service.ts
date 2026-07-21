import path from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import type { ApiEnv } from "@dho/config";

import { APP_ENV } from "../config/config.tokens";
import { SafeFileStore } from "./safe-file-store";

/** Server-generated filenames only ever look like this: a UUID plus the one
 * extension normalization ever produces. Anything else is rejected before
 * touching the filesystem. */
export const EVENT_COVER_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

@Injectable()
export class EventCoverStorageService {
  private readonly store: SafeFileStore;

  constructor(@Inject(APP_ENV) env: ApiEnv) {
    this.store = new SafeFileStore(path.resolve(env.UPLOAD_ROOT, "events"), "webp");
  }

  /** Writes a new file under the events directory and returns the relative
   * path to store in the database (e.g. "events/<uuid>.webp"). Never trusts
   * a client-supplied name; the filename is always server-generated. */
  async save(buffer: Buffer, extension: string): Promise<string> {
    const filename = await this.store.save(buffer, extension);
    return `events/${filename}`;
  }

  /** Deletes a previously stored file, identified by the relative path saved
   * in the database. Silently no-ops for an already-missing file. */
  async removeIfExists(relativePath: string | null | undefined): Promise<void> {
    await this.store.removeIfExists(relativePath);
  }

  /** Resolves an untrusted filename (e.g. a URL path segment) to an absolute
   * path within the events directory, or null if it doesn't match the strict
   * server-generated-filename pattern or would escape the directory. */
  resolveFilename(filename: string): string | null {
    return this.store.resolveFilename(filename);
  }
}
