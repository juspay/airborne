// Copyright 2026 Juspay Technologies. Apache-2.0.
// Use the checksum-aware cache and Web Locks fixtures shared with the reviewed guard tests.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const result = spawnSync(process.execPath, [require.resolve('jest/bin/jest'), '--runInBand',
  '--watchman=false', '--runTestsByPath', 'src/__tests__/web-security.test.ts',
  'src/__tests__/web-boot-guard.test.ts'], { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
process.exit(result.status ?? 1);
