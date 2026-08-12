import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as bcrypt from 'bcrypt';
import * as schema from './schema.pg';

async function seed() {
  const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5234/edutrack';
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql, { schema });

  console.log('🌱 Seeding database...');

  try {
    // 1. Create a School
    const [insertedSchool] = await db.insert(schema.school).values({
      name: "Lycée Félix Éboué de N'Djamena",
      short_name: 'LFE',
      address: 'Avenue Charles de Gaulle, N\'Djamena, Chad',
      phone: '+235 66 00 00 00',
      motto: 'Travail, Discipline, Réussite',
    }).returning();
    
    console.log(`✅ Created School: ${insertedSchool.name} (${insertedSchool.id})`);

    // 2. Create an Academic Year
    const [insertedYear] = await db.insert(schema.academic_year).values({
      school_id: insertedSchool.id,
      label: '2024-2025',
      start_date: new Date('2024-09-15'),
      end_date: new Date('2025-06-30'),
      is_current: true,
    }).returning();
    
    console.log(`✅ Created Academic Year: ${insertedYear.label}`);

    // 3. Create a School Master User
    const passwordHash = await bcrypt.hash('admin123', 12);
    const [insertedUser] = await db.insert(schema.user).values({
      school_id: insertedSchool.id,
      username: 'admin',
      password_hash: passwordHash,
      role: 'school_master',
      is_active: true,
    }).returning();

    console.log(`✅ Created User: ${insertedUser.username} (Role: ${insertedUser.role})`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await sql.end();
  }
}

seed();
