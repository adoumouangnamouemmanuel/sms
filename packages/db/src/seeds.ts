import { eq } from 'drizzle-orm';
import type { EduTrackDatabase } from './client.js';
import { schemaMetadata, school, user, type UserRole } from './schema.sqlite.js';

/**
 * Demo credentials for the synthetic foundation schools (NDS-DEMO and MND-DEMO).
 *
 * - School code: `NDS-DEMO` (or `MND-DEMO`)
 * - Username: `directeur`
 * - Password: (set via EDUTRACK_SEED_PASSWORD_HASH)
 *
 * Synthetic demo data only - never use in a real school.
 */
const seedPasswordHash = resolveSeedPasswordHash(process.env.EDUTRACK_SEED_PASSWORD_HASH);

/**
 * Resolves the demo password hash for the foundation schools. When a value is
 * set it must be a real bcrypt hash with a cost factor of at least 12 (the
 * app's BCRYPT_COST); anything else fails seeding loudly instead of silently
 * persisting a broken login. An unset or empty value keeps the accounts
 * locked with an unusable placeholder until an administrator configures a
 * real password.
 */
export function resolveSeedPasswordHash(configured: string | undefined): string {
  if (!configured) {
    return '!UNUSABLE_PASSWORD_HASH!';
  }

  // Full bcrypt shape: $2a|2b|2y$ + 2-digit cost + 53-char salt/hash body.
  const match = /^\$2[aby]\$(\d{2})\$[./A-Za-z0-9]{53}$/.exec(configured);
  const cost = match ? Number(match[1]) : NaN;

  if (!match || Number.isNaN(cost) || cost < 12) {
    throw new Error(
      'EDUTRACK_SEED_PASSWORD_HASH doit être un hash bcrypt valide avec un facteur de coût >= 12.'
    );
  }

  return configured;
}

export const foundationSeedVersion = 'phase-1.4-foundation-2026-08-15';

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
          description: 'Deterministic Phase 1.4 foundation seed version.',
        },
      })
      .run();
  });
}
