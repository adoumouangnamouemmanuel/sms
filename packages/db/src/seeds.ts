import { eq } from 'drizzle-orm';
import type { EduTrackDatabase } from './client.js';
import { schemaMetadata, school, user, type UserRole } from './schema.sqlite.js';

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
  db.transaction((transaction) => {
    const currentSeedVersion = transaction
      .select({ value: schemaMetadata.value })
      .from(schemaMetadata)
      .where(eq(schemaMetadata.key, 'seed.foundation.version'))
      .get();

    if (currentSeedVersion?.value === foundationSeedVersion) {
      return;
    }

    for (const schoolSeed of foundationSeed.schools) {
      transaction
        .insert(school)
        .values(schoolSeed)
        .onConflictDoUpdate({
          target: school.id,
          set: {
            code: schoolSeed.code,
            name: schoolSeed.name,
            shortName: schoolSeed.shortName,
            city: schoolSeed.city,
            country: schoolSeed.country,
            phone: schoolSeed.phone,
            locale: schoolSeed.locale,
            timezone: schoolSeed.timezone,
            currency: schoolSeed.currency,
          },
        })
        .run();
    }

    for (const userSeed of foundationSeed.users) {
      transaction
        .insert(user)
        .values(userSeed)
        .onConflictDoUpdate({
          target: user.id,
          set: {
            schoolId: userSeed.schoolId,
            username: userSeed.username,
            passwordHash: userSeed.passwordHash,
            role: userSeed.role,
            isActive: true,
          },
        })
        .run();
    }

    transaction
      .insert(schemaMetadata)
      .values({
        key: 'seed.foundation.version',
        value: foundationSeedVersion,
        description: 'Deterministic Phase 1.3 foundation seed version.',
      })
      .onConflictDoUpdate({
        target: schemaMetadata.key,
        set: {
          value: foundationSeedVersion,
          description: 'Deterministic Phase 1.3 foundation seed version.',
        },
      })
      .run();
  });
}
