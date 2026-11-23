#!/usr/bin/env node
/**
 * Wide differential suite: practice kit cases, extra protocol-valid generator seeds, hand fixtures.
 * Oracle: baseline vendor build(). Compares every output path byte-for-byte + state isolation (2 runs).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { handCases } from './fixtures/hand-cases.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const kit = process.env.MAKEFUN_KIT ?? join(root, 'kit');
const baselineVendor = process.env.MAKEFUN_BASELINE_VENDOR
  ?? join(kit, 'baselines/makefun-site/vendor/makefun-site/index.js');

const { build: vendor } = await import(baselineVendor);
const { build: candidate } = await import('../site/build.js');

function compareOutputs(v, o, caseId) {
  const vk = Object.keys(v).sort();
  const ok = Object.keys(o).sort();
  if (vk.join('\0') !== ok.join('\0')) {
    const miss = vk.filter((k) => !ok.includes(k));
    const extra = ok.filter((k) => !vk.includes(k));
    return { ok: false, caseId, why: 'key_set', miss, extra };
  }
  for (const k of vk) {
    if (v[k] !== o[k]) return { ok: false, caseId, why: 'byte_diff', path: k, vLen: v[k]?.length, oLen: o[k]?.length };
  }
  return { ok: true, caseId, paths: vk.length };
}

function runSeedDraw(seed) {
  const work = join('/tmp', `mf-suite-${seed.slice(0, 8)}`);
  const script =
    process.env.MAKEFUN_REPO_ROOT != null
      ? join(process.env.MAKEFUN_REPO_ROOT, 'scripts/generate-from-seed.mjs')
      : join(root, 'scripts/generate-from-seed.mjs');
  const r = spawnSync('node', [script, seed], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`generator failed seed ${seed}: ${r.stderr}`);
  const meta = JSON.parse(r.stdout.trim());
  const cases = JSON.parse(readFileSync(join(meta.work, 'out/input/cases.json'), 'utf8'));
  return cases.map((c) => ({ id: `${seed.slice(0, 8)}-${c.id}`, group: 'generated', input: c.input }));
}

const practice = JSON.parse(readFileSync(join(kit, 'practice/input/cases.json'), 'utf8')).map((c) => ({
  id: c.id,
  group: 'practice',
  input: c.input,
}));

// Protocol-valid seeds (NOT official competition instances except practice seed).
const practiceSigSeed = (() => {
  const sig = 'a574d01f94ac348b54d17c7cfb7e86199a9fb96373d1880e1a62988583e635f2ff6dc4a0c042546b9c5f5293ba0677aa';
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(0);
  return createHash('sha256').update('agent-fun/instance/practice/v1').update(buf).update(Buffer.from(sig, 'hex')).digest('hex');
})();

const extraSeeds = [
  practiceSigSeed,
  ...Array.from({ length: 6 }, (_, i) =>
    createHash('sha256').update(`makefun/differential-extra/v1\n${i}`).digest('hex'),
  ),
];

const generated = [];
for (const seed of extraSeeds) {
  try {
    generated.push(...runSeedDraw(seed));
  } catch (e) {
    console.error('GENERATOR_ERROR', seed, e.message);
    process.exit(2);
  }
}

const all = [
  ...practice,
  ...handCases.map((h) => ({ id: h.id, group: 'hand', note: h.note, input: h.input })),
  ...generated,
];

const results = { passed: 0, failed: [], groups: {}, total: all.length, isolationFails: [] };

for (const c of all) {
  const v1 = vendor(c.input);
  const o1 = candidate(c.input);
  const o2 = candidate(c.input);
  const cmp = compareOutputs(v1, o1, c.id);
  const iso = JSON.stringify(o1) === JSON.stringify(o2);
  const g = c.group;
  results.groups[g] = results.groups[g] ?? { pass: 0, fail: 0 };
  if (cmp.ok && iso) {
    results.passed++;
    results.groups[g].pass++;
  } else {
    results.failed.push({ ...cmp, isolation: iso, group: g, note: c.note });
    results.groups[g].fail++;
    if (!iso) results.isolationFails.push(c.id);
  }
}

const outDir = join(root, 'artifacts');
if (process.env.MAKEFUN_SKIP_SUITE_ARTIFACTS !== '1') {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'suite-results.json'), JSON.stringify(results, null, 2));
}

console.log(`SUITE ${results.passed}/${results.total} passed`);
for (const [g, s] of Object.entries(results.groups)) console.log(`  ${g}: ${s.pass}/${s.pass + s.fail}`);
if (results.failed.length) {
  console.error('FAILURES', JSON.stringify(results.failed, null, 2));
  process.exit(1);
}
process.exit(0);