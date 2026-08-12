import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const school = sqliteTable('school', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  short_name: text('short_name'),
  logo_url: text('logo_url'),
  address: text('address'),
  phone: text('phone'),
  motto: text('motto'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const academic_year = sqliteTable('academic_year', {
  id: text('id').primaryKey(),
  school_id: text('school_id').references(() => school.id).notNull(),
  label: text('label').notNull(),
  start_date: text('start_date'),
  end_date: text('end_date'),
  is_current: integer('is_current', { mode: 'boolean' }).default(false),
});

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  school_id: text('school_id').references(() => school.id).notNull(),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: text('role').notNull(), // school_master, teacher, student
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});
