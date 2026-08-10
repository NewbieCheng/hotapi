import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SKILLHUB_PACKAGES,
  buildIssueRow,
  listSkillhubPackages,
  resolveSkillhubPackage
} from '../api/_activation_issue.js';
import {
  _resetSkillhubIssueMemoryForTests,
  consumeIssueToken,
  mintIssueToken
} from '../api/_skillhub_issue_token.js';
import skillhubIssueHandler from '../api/skillhub_issue.js';

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    end() {
      return this;
    }
  };
}

test('listSkillhubPackages covers four fixed packages', () => {
  const list = listSkillhubPackages();
  assert.equal(list.length, 4);
  assert.deepEqual(
    list.map((p) => p.packageId).sort(),
    ['cjzs-30d', 'flowx-30d', 'zhiliao-30d', 'zhixiao-30d']
  );
  for (const item of list) {
    assert.equal(item.duration_days, 30);
    assert.ok(SKILLHUB_PACKAGES[item.packageId]);
  }
});

test('resolveSkillhubPackage rejects unknown id', () => {
  const bad = resolveSkillhubPackage('nope');
  assert.equal(bad.ok, false);
  const good = resolveSkillhubPackage('flowx-30d');
  assert.equal(good.ok, true);
  assert.equal(good.package.plugin, 'flowx');
});

test('buildIssueRow prefixes and phone rules', () => {
  const flowx = buildIssueRow({ package: SKILLHUB_PACKAGES['flowx-30d'] });
  assert.match(flowx.key, /^XHS-/);
  assert.equal(flowx.duration_days, 30);
  assert.ok(flowx.permissions?.ai === true);

  const cjzs = buildIssueRow({ package: SKILLHUB_PACKAGES['cjzs-30d'] });
  assert.match(cjzs.key, /^CJZS-/);
  assert.ok(Array.isArray(cjzs.permissions.ac));
  assert.equal(cjzs.permissions.level, 'plus');

  const zhiliaoPhone = buildIssueRow({
    package: SKILLHUB_PACKAGES['zhiliao-30d'],
    phone: '13800138000'
  });
  assert.equal(zhiliaoPhone.key, 'ZHILIAO-13800138000');
  assert.equal(zhiliaoPhone.permissions, null);

  const zhixiao = buildIssueRow({ package: SKILLHUB_PACKAGES['zhixiao-30d'] });
  assert.match(zhixiao.key, /^ZHIXIAO-/);

  assert.throws(
    () => buildIssueRow({ package: SKILLHUB_PACKAGES['flowx-30d'], phone: '13800138000' }),
    /不支持手机号/
  );
  assert.throws(
    () => buildIssueRow({ package: SKILLHUB_PACKAGES['zhiliao-30d'], phone: '123' }),
    /手机号/
  );
});

test('mintIssueToken + consumeIssueToken is single-use', async () => {
  _resetSkillhubIssueMemoryForTests();
  const prev = process.env.SKILLHUB_ISSUE_API_KEY;
  process.env.SKILLHUB_ISSUE_API_KEY = 'unit-test-signing-secret';
  try {
    const minted = await mintIssueToken({ packageId: 'zhiliao-30d', orderRef: 'ORD-1' });
    assert.match(minted.token, /^SHIT1\./);
    assert.equal(minted.packageId, 'zhiliao-30d');

    const first = await consumeIssueToken(minted.token);
    assert.equal(first.ok, true);
    assert.equal(first.packageId, 'zhiliao-30d');
    assert.equal(first.orderRef, 'ORD-1');

    const second = await consumeIssueToken(minted.token);
    assert.equal(second.ok, false);
    assert.equal(second.code, 'TOKEN_USED');
  } finally {
    if (prev === undefined) delete process.env.SKILLHUB_ISSUE_API_KEY;
    else process.env.SKILLHUB_ISSUE_API_KEY = prev;
    _resetSkillhubIssueMemoryForTests();
  }
});

test('GET packages does not require API key', async () => {
  const res = mockResponse();
  await skillhubIssueHandler(
    { method: 'GET', query: { action: 'packages' }, headers: {} },
    res
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.packages.length, 4);
  assert.equal(res.body.limits.perKeyPerHour, 60);
  assert.ok(res.body.limits.dailyIssueLimit >= 1);
  assert.equal(res.body.auth.issue.includes('x-issue-token'), true);
});

test('POST issue without config returns 503', async () => {
  const prev = process.env.SKILLHUB_ISSUE_API_KEY;
  delete process.env.SKILLHUB_ISSUE_API_KEY;
  try {
    const res = mockResponse();
    await skillhubIssueHandler(
      {
        method: 'POST',
        query: { action: 'issue' },
        headers: {},
        body: {}
      },
      res
    );
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'ISSUE_SERVICE_NOT_CONFIGURED');
  } finally {
    if (prev === undefined) delete process.env.SKILLHUB_ISSUE_API_KEY;
    else process.env.SKILLHUB_ISSUE_API_KEY = prev;
  }
});

test('POST issue without token returns 401', async () => {
  const prev = process.env.SKILLHUB_ISSUE_API_KEY;
  process.env.SKILLHUB_ISSUE_API_KEY = 'correct-test-key';
  try {
    const res = mockResponse();
    await skillhubIssueHandler(
      {
        method: 'POST',
        query: { action: 'issue' },
        headers: {},
        body: { packageId: 'flowx-30d' }
      },
      res
    );
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, 'ISSUE_TOKEN_REQUIRED');
  } finally {
    if (prev === undefined) delete process.env.SKILLHUB_ISSUE_API_KEY;
    else process.env.SKILLHUB_ISSUE_API_KEY = prev;
  }
});

test('POST issue rejects long-lived API key header', async () => {
  const prev = process.env.SKILLHUB_ISSUE_API_KEY;
  process.env.SKILLHUB_ISSUE_API_KEY = 'correct-test-key';
  try {
    const res = mockResponse();
    await skillhubIssueHandler(
      {
        method: 'POST',
        query: { action: 'issue' },
        headers: {
          'x-skill-api-key': 'correct-test-key',
          'x-issue-token': 'SHIT1.fake.sig'
        },
        body: {}
      },
      res
    );
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, 'USE_ISSUE_TOKEN');
  } finally {
    if (prev === undefined) delete process.env.SKILLHUB_ISSUE_API_KEY;
    else process.env.SKILLHUB_ISSUE_API_KEY = prev;
  }
});

test('POST mint_token with wrong key returns 403', async () => {
  const prev = process.env.SKILLHUB_ISSUE_API_KEY;
  process.env.SKILLHUB_ISSUE_API_KEY = 'correct-test-key';
  try {
    const res = mockResponse();
    await skillhubIssueHandler(
      {
        method: 'POST',
        query: { action: 'mint_token' },
        headers: { 'x-skill-api-key': 'wrong' },
        body: { packageId: 'flowx-30d' }
      },
      res
    );
    assert.equal(res.statusCode, 403);
  } finally {
    if (prev === undefined) delete process.env.SKILLHUB_ISSUE_API_KEY;
    else process.env.SKILLHUB_ISSUE_API_KEY = prev;
  }
});

test('POST mint_token with unknown package returns 400', async () => {
  _resetSkillhubIssueMemoryForTests();
  const prev = process.env.SKILLHUB_ISSUE_API_KEY;
  process.env.SKILLHUB_ISSUE_API_KEY = 'correct-test-key';
  try {
    const res = mockResponse();
    await skillhubIssueHandler(
      {
        method: 'POST',
        query: { action: 'mint_token' },
        headers: { 'x-skill-api-key': 'correct-test-key' },
        body: { packageId: 'unknown-99d' }
      },
      res
    );
    assert.equal(res.statusCode, 400);
    assert.match(String(res.body.error || ''), /未知套餐/);
  } finally {
    if (prev === undefined) delete process.env.SKILLHUB_ISSUE_API_KEY;
    else process.env.SKILLHUB_ISSUE_API_KEY = prev;
    _resetSkillhubIssueMemoryForTests();
  }
});

test('POST mint_token success returns SHIT1 token', async () => {
  _resetSkillhubIssueMemoryForTests();
  const prev = process.env.SKILLHUB_ISSUE_API_KEY;
  process.env.SKILLHUB_ISSUE_API_KEY = 'correct-test-key';
  try {
    const res = mockResponse();
    await skillhubIssueHandler(
      {
        method: 'POST',
        query: { action: 'mint_token' },
        headers: { 'x-skill-api-key': 'correct-test-key' },
        body: { packageId: 'cjzs-30d', orderRef: 'T-1' }
      },
      res
    );
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.packageId, 'cjzs-30d');
    assert.match(res.body.token, /^SHIT1\./);
  } finally {
    if (prev === undefined) delete process.env.SKILLHUB_ISSUE_API_KEY;
    else process.env.SKILLHUB_ISSUE_API_KEY = prev;
    _resetSkillhubIssueMemoryForTests();
  }
});
