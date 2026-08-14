module.exports = {
  assets: [
    'node_modules/better-sqlite3/prebuilds/win32-x64.node',
    'node_modules/bcrypt/package.json',
    'node_modules/bcrypt/prebuilds/win32-x64/bcrypt.node',
    '../../packages/db/migrations/sqlite/**/*',
  ],
  publicPackages: ['bcrypt', 'better-sqlite3'],
};
