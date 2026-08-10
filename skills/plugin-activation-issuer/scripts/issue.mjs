#!/usr/bin/env node
/**
 * SkillHub activation issuer client.
 *
 * Buyer path (no long-lived API key):
 *   node scripts/issue.mjs --token <issue_token> [--phone 11digits]
 *
 * Server/operator path (SKILLHUB_ISSUE_API_KEY stays on your machine only):
 *   node scripts/issue.mjs --mint --package zhiliao-30d
 *   node scripts/issue.mjs --mint-and-issue --package flowx-30d
 */

const DEFAULT_BASE = 'https://abc.no996ai.cn';

function printHelp() {
  console.log(`Usage:
  # Buyer: redeem a one-time voucher (never needs SKILLHUB_ISSUE_API_KEY)
  node scripts/issue.mjs --token <issue_token> [--phone 11digits]

  # Operator / relay (API key must NOT be given to buyers)
  node scripts/issue.mjs --mint --package <packageId> [--order-ref ...]
  node scripts/issue.mjs --mint-and-issue --package <packageId> [--phone ...] [--order-ref ...]
  node scripts/issue.mjs --packages

Env:
  SKILLHUB_ISSUE_API_KEY   required for --mint / --mint-and-issue only
  HOTAPI_BASE_URL          default ${DEFAULT_BASE}

Packages: flowx-30d | cjzs-30d | zhiliao-30d | zhixiao-30d

Security:
  Do not put SKILLHUB_ISSUE_API_KEY in the SkillHub buyer runtime.
  Buyers only receive a short-lived issue_token from your paid relay.
`);
}

function parseArgs(argv) {
  const out = {
    packageId: '',
    phone: '',
    token: '',
    orderRef: '',
    listPackages: false,
    mint: false,
    mintAndIssue: false,
    help: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--packages') out.listPackages = true;
    else if (arg === '--mint') out.mint = true;
    else if (arg === '--mint-and-issue') out.mintAndIssue = true;
    else if (arg === '--package' || arg === '-p') {
      out.packageId = String(argv[++i] || '').trim();
    } else if (arg === '--phone') {
      out.phone = String(argv[++i] || '').trim();
    } else if (arg === '--token' || arg === '-t') {
      out.token = String(argv[++i] || '').trim();
    } else if (arg === '--order-ref') {
      out.orderRef = String(argv[++i] || '').trim();
    }
  }
  return out;
}

function baseUrl() {
  return String(process.env.HOTAPI_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
}

function requireApiKey() {
  const apiKey = String(process.env.SKILLHUB_ISSUE_API_KEY || '').trim();
  if (!apiKey) {
    console.error('Missing SKILLHUB_ISSUE_API_KEY (server/operator only). Do not give this to buyers.');
    process.exitCode = 2;
    return null;
  }
  return apiKey;
}

async function parseJsonResponse(res) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const err = new Error(`响应非 JSON (HTTP ${res.status}): ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return { status: res.status, ok: res.ok, data };
}

async function listPackages() {
  const res = await fetch(`${baseUrl()}/api/skillhub_issue?action=packages`);
  const { ok, status, data } = await parseJsonResponse(res);
  if (!ok) throw new Error(data.error || `HTTP ${status}`);
  console.log(JSON.stringify(data, null, 2));
}

async function mintToken(packageId, orderRef) {
  const apiKey = requireApiKey();
  if (!apiKey) return null;
  if (!packageId) {
    console.error('Missing --package <packageId>');
    process.exitCode = 2;
    return null;
  }

  const body = { packageId };
  if (orderRef) body.orderRef = orderRef;

  const res = await fetch(`${baseUrl()}/api/skillhub_issue?action=mint_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-skill-api-key': apiKey
    },
    body: JSON.stringify(body)
  });
  const parsed = await parseJsonResponse(res);
  if (!parsed.ok) {
    console.error(JSON.stringify({ ok: false, status: parsed.status, ...parsed.data }, null, 2));
    process.exitCode = 1;
    return null;
  }
  return parsed.data;
}

async function issueWithToken(token, phone) {
  if (!token) {
    console.error('Missing --token <issue_token>');
    process.exitCode = 2;
    return;
  }

  const body = {};
  if (phone) body.phone = phone;

  const res = await fetch(`${baseUrl()}/api/skillhub_issue?action=issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-issue-token': token
    },
    body: JSON.stringify(body)
  });
  const parsed = await parseJsonResponse(res);
  if (!parsed.ok) {
    console.error(JSON.stringify({ ok: false, status: parsed.status, ...parsed.data }, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(parsed.data, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const hasAction = args.listPackages || args.mint || args.mintAndIssue || args.token;
  if (args.help || !hasAction) {
    printHelp();
    process.exitCode = args.help ? 0 : 2;
    return;
  }
  if (args.listPackages) {
    await listPackages();
    return;
  }
  if (args.mintAndIssue) {
    const minted = await mintToken(args.packageId, args.orderRef);
    if (!minted?.token) return;
    await issueWithToken(minted.token, args.phone);
    return;
  }
  if (args.mint) {
    const minted = await mintToken(args.packageId, args.orderRef);
    if (!minted) return;
    console.log(JSON.stringify(minted, null, 2));
    return;
  }
  await issueWithToken(args.token, args.phone);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
