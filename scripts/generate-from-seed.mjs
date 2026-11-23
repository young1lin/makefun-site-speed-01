#!/usr/bin/env node
/** Run kit generator draw.ts for a 64-hex instance seed; prints cases JSON path to stdout summary. */
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const kit =
  process.env.MAKEFUN_KIT ?? join(dirname(fileURLToPath(import.meta.url)), '../kit');
const seed = process.argv[2];
if (!/^[0-9a-f]{64}$/.test(seed ?? '')) {
  console.error('usage: generate-from-seed.mjs <64-hex-seed>');
  process.exit(1);
}

const work = join('/tmp', `makefun-gen-${seed.slice(0, 8)}`);
rmSync(work, { recursive: true, force: true });
mkdirSync(join(work, 'in'), { recursive: true });
mkdirSync(join(work, 'out'), { recursive: true });
writeFileSync(join(work, 'in', 'seed.json'), JSON.stringify({ schema: 'agent-fun/instance-seed/v1', seed }));

const draw = spawnSync(
  'node',
  ['--experimental-strip-types', join(kit, 'program/generator/draw.ts')],
  {
    env: { ...process.env, MAKEFUN_INPUT_DIR: join(work, 'in'), MAKEFUN_OUTPUT_DIR: join(work, 'out') },
    encoding: 'utf8',
  },
);
if (draw.status !== 0) {
  console.error(draw.stderr);
  process.exit(1);
}
const cases = JSON.parse(readFileSync(join(work, 'out', 'input', 'cases.json'), 'utf8'));
console.log(JSON.stringify({ seed, caseCount: cases.length, work }));