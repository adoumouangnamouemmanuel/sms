import type { EduTrackDatabase } from '../client.js';
import { withTransaction } from '../client.js';

export function assertWithTransactionCallbackTypes(db: EduTrackDatabase) {
  withTransaction(db, () => 'committed');

  // @ts-expect-error better-sqlite3 transactions are synchronous and must not accept async callbacks.
  void withTransaction(db, () => Promise.resolve('committed-later'));
}
