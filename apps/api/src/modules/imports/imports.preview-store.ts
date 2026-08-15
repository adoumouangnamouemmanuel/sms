import { randomUUID } from 'node:crypto';
import type { ImportKind } from '@edutrack/shared';
import type { ParsedImportRow } from './imports.parser.js';

export const IMPORT_PREVIEW_TTL_MS = 30 * 60 * 1000;
/** Preview payloads sent to the UI are capped; the full set stays server-side. */
export const IMPORT_PREVIEW_ROW_LIMIT = 100;

export interface StoredImportPreview {
  importId: string;
  kind: ImportKind;
  schoolId: string;
  filename: string;
  rows: ParsedImportRow[];
  createdAt: number;
}

/**
 * Holds parsed previews in memory only — the roadmap requires that preview
 * never persists anything. Entries expire after IMPORT_PREVIEW_TTL_MS; the
 * confirm step re-reads from here and writes to the DB only when the user
 * confirms.
 */
class ImportPreviewStore {
  private readonly previews = new Map<string, StoredImportPreview>();

  create(preview: Omit<StoredImportPreview, 'importId' | 'createdAt'>) {
    const stored: StoredImportPreview = {
      ...preview,
      importId: randomUUID(),
      createdAt: Date.now(),
    };

    this.previews.set(stored.importId, stored);
    this.expireOld();
    return stored;
  }

  get(importId: string) {
    const preview = this.previews.get(importId);

    if (!preview) {
      return undefined;
    }

    if (Date.now() - preview.createdAt > IMPORT_PREVIEW_TTL_MS) {
      this.previews.delete(importId);
      return undefined;
    }

    return preview;
  }

  private expireOld() {
    const cutoff = Date.now() - IMPORT_PREVIEW_TTL_MS;

    for (const [importId, preview] of this.previews) {
      if (preview.createdAt < cutoff) {
        this.previews.delete(importId);
      }
    }
  }
}

export const importPreviewStore = new ImportPreviewStore();
