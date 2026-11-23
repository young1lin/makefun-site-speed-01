#!/usr/bin/env node
/** Minimal check: practice cases vs kit oracle (requires MAKEFUN_KIT). */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const kit = process.env.MAKEFUN_KIT ?? join(root, '..', 'site-generator-speed-01-run-20261122-kit');
const vendorPath = join(kit, 'baselines/makefun-site/vendor/makefun-site/index.js');
const { build: oracle } = await import(vendorPath);
const { run: candidate } = await import(join(root, 'solve.js'));

const cases = JSON.parse(readFileSync(join(kit, 'practice/input/cases.json'), 'utf8'));
const ref = JSON.parse(readFileSync(join(kit, 'practice/reference/expected.json'), 'utf8'));

function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') {
    const k = Object.keys(v).sort();
    return `{${k.map((x) => `${JSON.stringify(x)}:${canon(v[x])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

let ok = 0;
for (const c of cases) {
  const exp = ref.cases.find((x) => x.id === c.id).output;
  const got = candidate(c.input);
  const pass = canon(got) === canon(exp);
  console.log(c.id, pass ? 'PASS' : 'FAIL');
  if (pass) ok++;
}
process.exit(ok === cases.length ? 0 : 1);