import {
  createCipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  sign
} from 'node:crypto';

const DEVICE_REQUEST_PREFIX = 'HGD1-';
const LICENSE_PREFIX = 'HGL1-';
const ED25519_SEED_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const X25519_PUBLIC_SPKI_PREFIX = Buffer.from('302a300506032b656e032100', 'hex');

function sha256(value) {
  return createHash('sha256').update(value).digest();
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('请求码不是合法的 Base64URL');
  }
  return Buffer.from(value, 'base64url');
}

function require32ByteBase64(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} 未配置`);
  }
  const decoded = Buffer.from(value.trim(), 'base64');
  if (decoded.length !== 32) {
    throw new Error(`${fieldName} 必须是 32 字节 Base64`);
  }
  return decoded;
}

function rawX25519PublicKeyToKeyObject(rawPublicKey) {
  return createPublicKey({
    key: Buffer.concat([X25519_PUBLIC_SPKI_PREFIX, rawPublicKey]),
    format: 'der',
    type: 'spki'
  });
}

function rawEd25519SeedToPrivateKey(seed) {
  return createPrivateKey({
    key: Buffer.concat([ED25519_SEED_PKCS8_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8'
  });
}

function exportRawPublicKey(keyObject) {
  const spki = keyObject.export({ format: 'der', type: 'spki' });
  return Buffer.from(spki).subarray(-32);
}

function deviceIdFromRawPublicKey(rawPublicKey) {
  return `DEV-${sha256(rawPublicKey).toString('hex').slice(0, 20).toUpperCase()}`;
}

function normalizeCustomerId(customerId) {
  const normalized = String(customerId || '').trim();
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(normalized)) {
    throw new Error('客户编号只能包含字母、数字、点、下划线和横线，长度 1–64');
  }
  return normalized;
}

export function decodeDeviceRequest(requestCode) {
  const normalized = String(requestCode || '').trim();
  if (!normalized.startsWith(DEVICE_REQUEST_PREFIX)) {
    throw new Error('不是 HGD1 设备请求码');
  }
  if (normalized.length > 8192) {
    throw new Error('设备请求码过长');
  }

  let request;
  try {
    request = JSON.parse(base64UrlDecode(normalized.slice(DEVICE_REQUEST_PREFIX.length)).toString('utf8'));
  } catch (error) {
    throw new Error(`设备请求码无法解析：${error instanceof Error ? error.message : '格式错误'}`);
  }

  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new Error('设备请求码内容无效');
  }
  if (request.schemaVersion !== 1) {
    throw new Error('设备请求码版本不受支持');
  }

  const rawPublicKey = Buffer.from(String(request.devicePublicKeyB64 || ''), 'base64');
  if (rawPublicKey.length !== 32) {
    throw new Error('设备公钥长度无效');
  }
  const expectedDeviceId = deviceIdFromRawPublicKey(rawPublicKey);
  if (request.deviceId !== expectedDeviceId) {
    throw new Error('设备编号和设备公钥不匹配');
  }

  return {
    schemaVersion: 1,
    deviceId: expectedDeviceId,
    label: typeof request.label === 'string' ? request.label.slice(0, 120) : '',
    devicePublicKeyB64: rawPublicKey.toString('base64'),
    createdAt: typeof request.createdAt === 'string' ? request.createdAt : null,
    rawPublicKey
  };
}

export function issueDeviceLicense({
  customerId,
  requestCode,
  productId,
  major,
  rootKeyB64,
  signingKeyB64,
  issuedAt = Math.floor(Date.now() / 1000)
}) {
  const normalizedCustomerId = normalizeCustomerId(customerId);
  const normalizedProductId = String(productId || '').trim();
  const normalizedMajor = Number(major);
  if (!/^[a-z0-9][a-z0-9._-]{1,95}$/.test(normalizedProductId)) {
    throw new Error('产品 ID 格式无效');
  }
  if (!Number.isInteger(normalizedMajor) || normalizedMajor < 1) {
    throw new Error('授权大版本必须是正整数');
  }
  const normalizedIssuedAt = Number(issuedAt);
  if (!Number.isSafeInteger(normalizedIssuedAt) || normalizedIssuedAt < 1) {
    throw new Error('签发时间必须是 Unix 秒时间戳');
  }

  const deviceRequest = decodeDeviceRequest(requestCode);
  const rootKey = require32ByteBase64(rootKeyB64, '产品根密钥');
  const signingSeed = require32ByteBase64(signingKeyB64, '签名私钥');
  const signingPrivateKey = rawEd25519SeedToPrivateKey(signingSeed);
  const signingPublicKeyRaw = exportRawPublicKey(createPublicKey(signingPrivateKey));

  const { publicKey: ephemeralPublicKey, privateKey: ephemeralPrivateKey } = generateKeyPairSync('x25519');
  const devicePublicKey = rawX25519PublicKeyToKeyObject(deviceRequest.rawPublicKey);
  const sharedSecret = diffieHellman({
    privateKey: ephemeralPrivateKey,
    publicKey: devicePublicKey
  });

  const salt = sha256(Buffer.from(deviceRequest.deviceId, 'utf8'));
  const info = Buffer.from(
    `skill-license-key|${normalizedCustomerId}|${normalizedProductId}|${normalizedMajor}`,
    'utf8'
  );
  const wrappingKey = Buffer.from(hkdfSync('sha256', sharedSecret, salt, info, 32));
  const nonce = randomBytes(12);
  const aad = Buffer.from(
    `skilllic|${deviceRequest.deviceId}|${normalizedCustomerId}|${normalizedProductId}|${normalizedMajor}`,
    'utf8'
  );
  const cipher = createCipheriv('aes-256-gcm', wrappingKey, nonce);
  cipher.setAAD(aad);
  const encryptedRootKey = Buffer.concat([cipher.update(rootKey), cipher.final(), cipher.getAuthTag()]);

  const licenseIdSource = [
    deviceRequest.deviceId,
    normalizedCustomerId,
    normalizedProductId,
    normalizedMajor,
    normalizedIssuedAt
  ].join('|');

  const licenseBody = {
    schemaVersion: 1,
    licenseId: `LIC-${sha256(Buffer.from(licenseIdSource, 'utf8')).toString('hex').slice(0, 24).toUpperCase()}`,
    customerId: normalizedCustomerId,
    productId: normalizedProductId,
    major: normalizedMajor,
    deviceId: deviceRequest.deviceId,
    entitlement: 'perpetual-major',
    keyId: `KEY-${sha256(signingPublicKeyRaw).toString('hex').slice(0, 16).toUpperCase()}`,
    issuedAt: normalizedIssuedAt,
    ephemeralPublicKeyB64: exportRawPublicKey(ephemeralPublicKey).toString('base64'),
    rootNonceB64: nonce.toString('base64'),
    encryptedRootKeyB64: encryptedRootKey.toString('base64')
  };
  const signature = sign(null, Buffer.from(JSON.stringify(licenseBody), 'utf8'), signingPrivateKey);
  const signedLicense = {
    signed: licenseBody,
    signatureB64: signature.toString('base64')
  };

  return {
    licenseCode: `${LICENSE_PREFIX}${base64UrlEncode(Buffer.from(JSON.stringify(signedLicense), 'utf8'))}`,
    licenseId: licenseBody.licenseId,
    deviceId: licenseBody.deviceId,
    customerId: licenseBody.customerId,
    productId: licenseBody.productId,
    major: licenseBody.major,
    keyId: licenseBody.keyId,
    issuedAt: licenseBody.issuedAt
  };
}

export function parseProductRegistry(rawValue) {
  let products;
  try {
    products = JSON.parse(String(rawValue || ''));
  } catch {
    throw new Error('SKILL_LICENSE_PRODUCTS_JSON 不是合法 JSON');
  }
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('Skill 产品注册表为空');
  }

  return products.map((item) => {
    const productId = String(item?.productId || '').trim();
    const displayName = String(item?.displayName || productId).trim();
    const major = Number(item?.major);
    if (!/^[a-z0-9][a-z0-9._-]{1,95}$/.test(productId)) {
      throw new Error(`产品 ID 无效：${productId || '(空)'}`);
    }
    if (!Number.isInteger(major) || major < 1) {
      throw new Error(`产品 ${productId} 的 major 无效`);
    }
    require32ByteBase64(item?.rootKeyB64, `产品 ${productId} 根密钥`);
    return {
      productId,
      displayName: displayName.slice(0, 80),
      major,
      rootKeyB64: item.rootKeyB64
    };
  });
}
