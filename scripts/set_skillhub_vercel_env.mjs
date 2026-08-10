#!/usr/bin/env node
/**
 * Set SKILLHUB_ISSUE_API_KEY on Vercel (production + preview + development).
 *
 * Usage:
 *   set VERCEL_TOKEN=xxx
 *   node scripts/set_skillhub_vercel_env.mjs
 *
 * Token: https://vercel.com/account/tokens
 * Reads key from .env.skillhub.local (SKILLHUB_ISSUE_API_KEY=...)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const TEAM_SLUG = process.env.VERCEL_TEAM_SLUG || 'chasezs-projects';
const PROJECT_NAME = process.env.VERCEL_PROJECT_NAME || 'hotapi';
const ENV_NAME = 'SKILLHUB_ISSUE_API_KEY';
const TARGETS = ['production', 'preview', 'development'];

function loadKey() {
  const fromEnv = String(process.env.SKILLHUB_ISSUE_API_KEY || '').trim();
  if (fromEnv) return fromEnv;
  const file = resolve(root, '.env.skillhub.local');
  if (!existsSync(file)) {
    throw new Error('Missing .env.skillhub.local and SKILLHUB_ISSUE_API_KEY');
  }
  const text = readFileSync(file, 'utf8');
  const line = text.split(/\r?\n/).find((l) => l.startsWith(`${ENV_NAME}=`));
  if (!line) throw new Error(`${ENV_NAME} not found in .env.skillhub.local`);
  return line.slice(ENV_NAME.length + 1).trim();
}

async function api(token, path, options = {}) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data.error?.message || data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function main() {
  const token = String(process.env.VERCEL_TOKEN || '').trim();
  if (!token) {
    console.error('Set VERCEL_TOKEN first: https://vercel.com/account/tokens');
    process.exitCode = 2;
    return;
  }
  const value = loadKey();

  const team = await api(token, `/v2/teams?slug=${encodeURIComponent(TEAM_SLUG)}`);
  // /v2/teams?slug= returns list or single depending on API version
  let teamId = team.id;
  if (!teamId && Array.isArray(team.teams)) {
    teamId = team.teams.find((t) => t.slug === TEAM_SLUG)?.id;
  }
  if (!teamId) {
    // fallback: list teams
    const listed = await api(token, '/v2/teams');
    teamId = (listed.teams || []).find((t) => t.slug === TEAM_SLUG)?.id;
  }
  if (!teamId) throw new Error(`Team not found: ${TEAM_SLUG}`);

  const projects = await api(
    token,
    `/v9/projects/${encodeURIComponent(PROJECT_NAME)}?teamId=${encodeURIComponent(teamId)}`
  );
  const projectId = projects.id;
  if (!projectId) throw new Error(`Project not found: ${PROJECT_NAME}`);

  // Remove existing envs with same key so we can recreate for all targets
  const existing = await api(
    token,
    `/v9/projects/${projectId}/env?teamId=${encodeURIComponent(teamId)}`
  );
  const toDelete = (existing.envs || []).filter((e) => e.key === ENV_NAME);
  for (const env of toDelete) {
    await api(
      token,
      `/v9/projects/${projectId}/env/${env.id}?teamId=${encodeURIComponent(teamId)}`,
      { method: 'DELETE' }
    );
    console.log(`removed old env id=${env.id}`);
  }

  await api(
    token,
    `/v10/projects/${projectId}/env?teamId=${encodeURIComponent(teamId)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        key: ENV_NAME,
        value,
        type: 'encrypted',
        target: TARGETS
      })
    }
  );
  console.log(JSON.stringify({
    ok: true,
    key: ENV_NAME,
    project: PROJECT_NAME,
    team: TEAM_SLUG,
    targets: TARGETS,
    note: 'Redeploy required for production to pick up the new env'
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  if (err.data) console.error(JSON.stringify(err.data, null, 2));
  process.exitCode = 1;
});
