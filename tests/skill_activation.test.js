import assert from 'node:assert/strict';
import {
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  verify,
  createHash
} from 'node:crypto';
import test from 'node:test';
import { decodeDeviceRequest, issueDeviceLicense, parseProductRegistry } from '../api/_skill_license_core.js';
import skillActivationHandler from '../api/skill_activation.js';

const X25519_PUBLIC_SPKI_PREFIX = Buffer.from('302a300506032b656e032100', 'hex');
const signingSeed = Buffer.alloc(32, 7);
const rootKey = Buffer.alloc(32, 9);

function sha256(value) {
  return createHash('sha256').update(value).digest();
}

function makeDeviceRequest(label = '测试电脑') {
  const pair = generateKeyPairSync('x25519');
  const publicKeyRaw = Buffer.from(pair.publicKey.export({ format: 'der', type: 'spki' })).subarray(-32);
  const body = {
    schemaVersion: 1,
    deviceId: `DEV-${sha256(publicKeyRaw).toString('hex').slice(0, 20).toUpperCase()}`,
    label,
    devicePublicKeyB64: publicKeyRaw.toString('base64'),
    createdAt: 1784851200
  };
  return {
    privateKey: pair.privateKey,
    requestCode: `HGD1-${Buffer.from(JSON.stringify(body), 'utf8').toString('base64url')}`
  };
}

function decodeLicense(code) {
  return JSON.parse(Buffer.from(code.slice(5), 'base64url').toString('utf8'));
}

function signingPublicKey() {
  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from('302e020100300506032b657004220420', 'hex'),
      signingSeed
    ]),
    format: 'der',
    type: 'pkcs8'
  });
  return createPublicKey(privateKey);
}

function decryptRootKey(license, devicePrivateKey) {
  const ephemeralRaw = Buffer.from(license.signed.ephemeralPublicKeyB64, 'base64');
  const ephemeralPublic = createPublicKey({
    key: Buffer.concat([X25519_PUBLIC_SPKI_PREFIX, ephemeralRaw]),
    format: 'der',
    type: 'spki'
  });
  const sharedSecret = diffieHellman({ privateKey: devicePrivateKey, publicKey: ephemeralPublic });
  const salt = sha256(Buffer.from(license.signed.deviceId, 'utf8'));
  const info = Buffer.from(
    `skill-license-key|${license.signed.customerId}|${license.signed.productId}|${license.signed.major}`,
    'utf8'
  );
  const key = Buffer.from(hkdfSync('sha256', sharedSecret, salt, info, 32));
  const encrypted = Buffer.from(license.signed.encryptedRootKeyB64, 'base64');
  const ciphertext = encrypted.subarray(0, -16);
  const tag = encrypted.subarray(-16);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(license.signed.rootNonceB64, 'base64')
  );
  decipher.setAAD(Buffer.from(
    `skilllic|${license.signed.deviceId}|${license.signed.customerId}|${license.signed.productId}|${license.signed.major}`,
    'utf8'
  ));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

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

test('HGD1 请求码能被识别并校验设备编号', () => {
  const device = makeDeviceRequest();
  const decoded = decodeDeviceRequest(device.requestCode);
  assert.match(decoded.deviceId, /^DEV-[A-F0-9]{20}$/);
  assert.equal(decoded.label, '测试电脑');
});

test('每台设备获得可验签、可解密且只对本机有效的 HGL1 激活码', () => {
  const firstDevice = makeDeviceRequest('电脑 A');
  const secondDevice = makeDeviceRequest('电脑 B');
  const issued = issueDeviceLicense({
    customerId: 'customer-001',
    requestCode: firstDevice.requestCode,
    productId: 'hangge-peng-you-quan',
    major: 1,
    rootKeyB64: rootKey.toString('base64'),
    signingKeyB64: signingSeed.toString('base64'),
    issuedAt: 1784851200
  });

  assert.match(issued.licenseCode, /^HGL1-/);
  const license = decodeLicense(issued.licenseCode);
  assert.equal(
    verify(
      null,
      Buffer.from(JSON.stringify(license.signed), 'utf8'),
      signingPublicKey(),
      Buffer.from(license.signatureB64, 'base64')
    ),
    true
  );
  assert.deepEqual(decryptRootKey(license, firstDevice.privateKey), rootKey);
  assert.throws(() => decryptRootKey(license, secondDevice.privateKey));
});

test('产品注册表只接受 32 字节根密钥', () => {
  const products = parseProductRegistry(JSON.stringify([{
    productId: 'hangge-peng-you-quan',
    displayName: '航哥朋友圈',
    major: 1,
    rootKeyB64: rootKey.toString('base64')
  }]));
  assert.equal(products[0].major, 1);
  assert.throws(() => parseProductRegistry(JSON.stringify([{
    productId: 'broken-product',
    major: 1,
    rootKeyB64: Buffer.alloc(8).toString('base64')
  }])));
});

test('后台 API 隐藏产品根密钥并支持批量签发', async () => {
  const oldAdminPassword = process.env.ADMIN_PASSWORD;
  const oldSigningKey = process.env.SKILL_VENDOR_SIGNING_KEY_B64;
  const oldProducts = process.env.SKILL_LICENSE_PRODUCTS_JSON;
  process.env.ADMIN_PASSWORD = 'test-admin-password';
  process.env.SKILL_VENDOR_SIGNING_KEY_B64 = signingSeed.toString('base64');
  process.env.SKILL_LICENSE_PRODUCTS_JSON = JSON.stringify([{
    productId: 'hangge-peng-you-quan',
    displayName: '航哥朋友圈',
    major: 1,
    rootKeyB64: rootKey.toString('base64')
  }]);

  try {
    const productsResponse = mockResponse();
    await skillActivationHandler({
      method: 'GET',
      query: { action: 'products' },
      headers: { 'x-admin-auth': 'test-admin-password' }
    }, productsResponse);
    assert.equal(productsResponse.statusCode, 200);
    assert.deepEqual(productsResponse.body.products, [{
      productId: 'hangge-peng-you-quan',
      displayName: '航哥朋友圈',
      major: 1
    }]);
    assert.equal(JSON.stringify(productsResponse.body).includes(rootKey.toString('base64')), false);

    const device = makeDeviceRequest('API 测试设备');
    const issueResponse = mockResponse();
    await skillActivationHandler({
      method: 'POST',
      query: { action: 'batch_issue' },
      headers: { 'x-admin-auth': 'test-admin-password' },
      body: {
        productId: 'hangge-peng-you-quan',
        major: 1,
        requests: [{ customerId: 'customer-api-001', requestCode: device.requestCode }]
      }
    }, issueResponse);
    assert.equal(issueResponse.statusCode, 200);
    assert.equal(issueResponse.body.successCount, 1);
    assert.match(issueResponse.body.results[0].licenseCode, /^HGL1-/);
  } finally {
    if (oldAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = oldAdminPassword;
    if (oldSigningKey === undefined) delete process.env.SKILL_VENDOR_SIGNING_KEY_B64;
    else process.env.SKILL_VENDOR_SIGNING_KEY_B64 = oldSigningKey;
    if (oldProducts === undefined) delete process.env.SKILL_LICENSE_PRODUCTS_JSON;
    else process.env.SKILL_LICENSE_PRODUCTS_JSON = oldProducts;
  }
});
