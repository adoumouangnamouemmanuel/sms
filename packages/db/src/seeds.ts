import type { EduTrackDatabase } from './client';
import { schemaMetadata, school, user, type UserRole } from './schema.sqlite';

const seedPasswordHash = '$2b$12$C6UzMDM.H6dfI/f/IKcEeOq8GmUiZ6ztp7Z8VsYzHf5fQK1x6ZVdW';

export const foundationSeedVersion = 'phase-1.3-foundation-2026-08-12';

export const foundationSeed = {
  schools: [
    {
      id: '00000000-0000-4000-8000-000000000101',
      code: 'NDS-DEMO',
      name: 'Ecole Demo N Djamena',
      shortName: 'Demo NDJ',
      city: 'N Djamena',
      country: 'TD',
      phone: '+23500000001',
      locale: 'fr',
      timezone: 'Africa/Ndjamena',
      currency: 'XAF',
    },
    {
      id: '00000000-0000-4000-8000-000000000102',
      code: 'MND-DEMO',
      name: 'Ecole Demo Moundou',
      shortName: 'Demo MND',
      city: 'Moundou',
      country: 'TD',
      phone: '+23500000002',
      locale: 'fr',
      timezone: 'Africa/Ndjamena',
      currency: 'XAF',
    },
  ],
  users: [
    {
      id: '00000000-0000-4000-8000-000000000201',
      schoolId: '00000000-0000-4000-8000-000000000101',
      username: 'directeur',
      passwordHash: seedPasswordHash,
      role: 'SCHOOL_MASTER' satisfies UserRole,
    },
    {
      id: '00000000-0000-4000-8000-000000000202',
      schoolId: '00000000-0000-4000-8000-000000000102',
      username: 'directeur',
      passwordHash: seedPasswordHash,
      role: 'SCHOOL_MASTER' satisfies UserRole,
    },
  ],
} as const;

export function seedFoundation(db: EduTrackDatabase) {
  for (const schoolSeed of foundationSeed.schools) {
    db.insert(school).values(schoolSeed).onConflictDoNothing().run();
  }

  for (const userSeed of foundationSeed.users) {
    db.insert(user).values(userSeed).onConflictDoNothing().run();
  }

  db.insert(schemaMetadata)
    .values({
      key: 'seed.foundation.version',
      value: foundationSeedVersion,
      description: 'Deterministic Phase 1.3 foundation seed version.',
    })
    .onConflictDoNothing()
    .run();
}
