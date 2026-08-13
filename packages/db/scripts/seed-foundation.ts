import 'dotenv/config';
import { resolve } from 'node:path';
import { openEduTrackDatabase, seedFoundation } from '../src/index';

const sqlitePath = resolve(process.env.EDUTRACK_SQLITE_PATH ?? './.data/edutrack.sqlite');
const connection = openEduTrackDatabase(sqlitePath);

try {
  seedFoundation(connection.db);
  process.stdout.write(`Seeded foundation data in ${sqlitePath}\n`);
} finally {
  connection.close();
}
