import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../',import.meta.url));
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('vite'))('esbuild');
const dir = await mkdtemp(path.join(root,'.experience-tests-'));
try {
  await build({ entryPoints:[path.join(root,'tests/experiences.test.ts'),path.join(root,'tests/api.test.ts')], bundle:true, platform:'node', format:'esm', outdir:dir, outExtension:{ '.js':'.mjs' }, packages:'external', alias:{ 'google-spreadsheet':path.join(root,'tests/fakeSheets.ts'), 'google-auth-library':path.join(root,'tests/fakeSheets.ts') } });
  const result = spawnSync(process.execPath,['--test',path.join(dir,'experiences.test.mjs'),path.join(dir,'api.test.mjs')],{ stdio:'inherit' });
  process.exitCode = result.status ?? 1;
} finally { await rm(dir,{ recursive:true,force:true }); }
