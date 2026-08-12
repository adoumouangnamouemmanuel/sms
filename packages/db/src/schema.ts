import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const school = pgTable('school', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  short_name: varchar('short_name', { length: 50 }),
  logo_url: text('logo_url'),
  address: text('address'),
  phone: varchar('phone', { length: 50 }),
  motto: text('motto'),
  created_at: timestamp('created_at').defaultNow(),
});

export const academic_year = pgTable('academic_year', {
  id: uuid('id').primaryKey().defaultRandom(),
  school_id: uuid('school_id').references(() => school.id).notNull(),
  label: varchar('label', { length: 50 }).notNull(),
  start_date: timestamp('start_date'),
  end_date: timestamp('end_date'),
  is_current: boolean('is_current').default(false),
});

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  school_id: uuid('school_id').references(() => school.id).notNull(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: varchar('role', { length: 50 }).notNull(), // school_master, teacher, student
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
});
