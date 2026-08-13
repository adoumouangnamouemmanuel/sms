module.exports = {
  assets: [
    'node_modules/better-sqlite3/prebuilds/win32-x64.node',
    '../../packages/db/migrations/sqlite/**/*',
  ],
  publicPackages: ['better-sqlite3'],
};
