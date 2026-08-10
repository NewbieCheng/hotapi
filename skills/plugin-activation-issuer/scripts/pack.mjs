#!/usr/bin/env node
/**
 * Pack plugin-activation-issuer for SkillHub upload (folder zip, no secrets).
 */
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, '..');
const outDir = path.resolve(skillRoot, '..', 'dist');
const outZip = path.join(outDir, 'plugin-activation-issuer.zip');

const SKIP_NAMES = new Set(['.env', '.DS_Store', 'Thumbs.db']);

async function collectFiles(dir, base = dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_NAMES.has(entry.name) || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      await collectFiles(full, base, acc);
    } else {
      acc.push({
        full,
        name: path.relative(base, full).split(path.sep).join('/')
      });
    }
  }
  return acc;
}

async function packWithArchiver() {
  let archiver;
  try {
    archiver = require('archiver');
  } catch {
    return false;
  }
  await mkdir(outDir, { recursive: true });
  const files = await collectFiles(skillRoot);
  await new Promise((resolve, reject) => {
    const output = createWriteStream(outZip);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    for (const file of files) {
      archive.file(file.full, { name: `plugin-activation-issuer/${file.name}` });
    }
    archive.finalize();
  });
  return true;
}

async function packWithPowerShell() {
  await mkdir(outDir, { recursive: true });
  const { spawnSync } = await import('node:child_process');
  const staging = path.join(outDir, '_staging_plugin-activation-issuer');
  const { rmSync, cpSync, existsSync } = await import('node:fs');
  if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  if (existsSync(outZip)) rmSync(outZip, { force: true });
  cpSync(skillRoot, path.join(staging, 'plugin-activation-issuer'), {
    recursive: true,
    filter: (src) => {
      const base = path.basename(src);
      if (SKIP_NAMES.has(base) || base === 'node_modules' || base === 'dist') return false;
      if (base.startsWith('.') && base !== '.' && path.dirname(src) !== skillRoot) {
        // allow files under skill; skip only skip-names above
      }
      if (base.startsWith('.') && SKIP_NAMES.has(base)) return false;
      return !base.startsWith('.env');
    }
  });
  const ps = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${path.join(staging, 'plugin-activation-issuer')}' -DestinationPath '${outZip}' -Force`
    ],
    { encoding: 'utf8' }
  );
  rmSync(staging, { recursive: true, force: true });
  if (ps.status !== 0) {
    throw new Error(ps.stderr || ps.stdout || 'Compress-Archive failed');
  }
  return true;
}

async function main() {
  const files = await collectFiles(skillRoot);
  const skillMd = files.find((f) => f.name === 'SKILL.md');
  if (!skillMd) throw new Error('SKILL.md missing');
  const st = await stat(skillMd.full);
  if (st.size < 32) throw new Error('SKILL.md too small');

  let ok = await packWithArchiver();
  if (!ok) ok = await packWithPowerShell();
  if (!ok) throw new Error('No zip backend available');

  console.log(JSON.stringify({ ok: true, zip: outZip, files: files.length }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
