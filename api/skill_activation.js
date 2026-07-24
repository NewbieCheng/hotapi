import { decodeDeviceRequest, issueDeviceLicense, parseProductRegistry } from './_skill_license_core.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Requested-With,Accept,Origin,X-Admin-Auth',
  'Access-Control-Allow-Credentials': 'true',
  'Cache-Control': 'no-store'
};
const MAX_BATCH_COUNT = 100;

function setCors(res) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
}

function checkAuth(req) {
  const configured = process.env.ADMIN_PASSWORD;
  return Boolean(configured) && req.headers['x-admin-auth'] === configured;
}

function readBody(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return req.body || {};
}

function publicProduct(product) {
  return {
    productId: product.productId,
    displayName: product.displayName,
    major: product.major
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!checkAuth(req)) return res.status(403).json({ error: 'Forbidden: 鉴权失败' });

  let products;
  try {
    products = parseProductRegistry(process.env.SKILL_LICENSE_PRODUCTS_JSON);
  } catch (error) {
    return res.status(503).json({
      error: 'Skill 发码服务尚未配置',
      code: 'LICENSE_SERVICE_NOT_CONFIGURED',
      details: error instanceof Error ? error.message : '配置错误'
    });
  }

  const action = req.query?.action;
  if (req.method === 'GET' && action === 'products') {
    return res.status(200).json({ products: products.map(publicProduct), maxBatchCount: MAX_BATCH_COUNT });
  }

  if (req.method !== 'POST' || action !== 'batch_issue') {
    return res.status(404).json({ error: '不支持的操作' });
  }

  let body;
  try {
    body = readBody(req);
  } catch {
    return res.status(400).json({ error: '请求 JSON 格式错误' });
  }

  const product = products.find((item) => (
    item.productId === String(body.productId || '').trim()
    && item.major === Number(body.major)
  ));
  if (!product) {
    return res.status(400).json({ error: '产品或授权大版本不存在' });
  }
  if (!Array.isArray(body.requests) || body.requests.length === 0) {
    return res.status(400).json({ error: '请至少提交 1 条设备请求码' });
  }
  if (body.requests.length > MAX_BATCH_COUNT) {
    return res.status(400).json({ error: `一次最多处理 ${MAX_BATCH_COUNT} 条` });
  }

  const signingKeyB64 = process.env.SKILL_VENDOR_SIGNING_KEY_B64;
  if (!signingKeyB64) {
    return res.status(503).json({
      error: 'Skill 签名密钥尚未配置',
      code: 'LICENSE_SERVICE_NOT_CONFIGURED'
    });
  }

  const seenDevices = new Set();
  const results = body.requests.map((item, index) => {
    const customerId = String(item?.customerId || '').trim();
    const requestCode = String(item?.requestCode || '').trim();
    try {
      const decoded = decodeDeviceRequest(requestCode);
      if (seenDevices.has(decoded.deviceId)) {
        throw new Error('本批次中设备请求码重复');
      }
      seenDevices.add(decoded.deviceId);
      return {
        index,
        ok: true,
        ...issueDeviceLicense({
          customerId,
          requestCode,
          productId: product.productId,
          major: product.major,
          rootKeyB64: product.rootKeyB64,
          signingKeyB64
        })
      };
    } catch (error) {
      return {
        index,
        ok: false,
        customerId,
        error: error instanceof Error ? error.message : '生成失败'
      };
    }
  });

  const successCount = results.filter((item) => item.ok).length;
  return res.status(200).json({
    product: publicProduct(product),
    total: results.length,
    successCount,
    failureCount: results.length - successCount,
    results
  });
}
