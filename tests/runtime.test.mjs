import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));

test('production API starts as unbundled ESM and returns JSON without contacting Sheets', async () => {
  const dir = await mkdtemp(path.join(root, '.runtime-check-'));
  try {
    await writeFile(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
    // Vercel emits separate .js files; bundling these imports would hide resolution failures.
    for (const file of ['api/places.ts', 'server/experiences.ts', 'src/lib/experiences.ts', 'src/lib/experienceSeeds.ts']) {
      const output = path.join(dir, file.replace(/\.ts$/, '.js'));
      await mkdir(path.dirname(output), { recursive: true });
      const source = await readFile(path.join(root, file), 'utf8');
      const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
      await writeFile(output, result.outputText);
    }
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import handler from './api/places.js';
      let status, data;
      await handler({ method: 'GET', headers: {} }, {
        status(code) { status = code; return this; },
        json(value) { data = value; return this; }
      });
      assert.equal(status, 500);
      assert.match(data.error, /PASSWORD not set/);
      assert.doesNotThrow(() => JSON.parse(JSON.stringify(data)));
    `], { cwd: dir, encoding: 'utf8', env: { ...process.env, PASSWORD: '' }, timeout: 15000 });
    assert.equal(run.status, 0, run.stderr || run.error?.message);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
