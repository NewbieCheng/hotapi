import { extractData, shouldIntercept } from './extractor.js';
import { generateCacheKey, getCache, setCache } from './cache.js';

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Requested-With,Accept,Origin",
  "Access-Control-Allow-Credentials": "true"
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "content-encoding"
]);

function setCors(res) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

function toObjectHeaders(headers) {
  if (!headers || typeof headers !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(headers).filter(([, value]) => value !== undefined && value !== null)
  );
}

function buildTargetUrl(pathValue) {
  const normalizedPath = typeof pathValue === "string" ? pathValue.trim() : "";
  if (normalizedPath.startsWith("//")) {
    throw new Error("Invalid path");
  }
  const path = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
  return new URL(path || "/", "https://api.getoneapi.com").toString();
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  let payload;
  try {
    payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    payload = {};
  }

  // 1. 获取目标路径：优先从 URL 提取（支持 /api/proxy/api/xhs/... 模式），否则从 body.path 提取
  let targetPath = "";
  const urlPath = req.url.split('?')[0]; // 去掉查询参数
  if (urlPath.startsWith("/api/proxy/")) {
    targetPath = urlPath.replace("/api/proxy/", "");
  } else {
    targetPath = payload.path || "";
  }

  if (!targetPath) {
    return res.status(400).json({ message: "Missing target path. Use /api/proxy/{path} or provide {path} in body." });
  }

  let targetUrl;
  try {
    targetUrl = buildTargetUrl(targetPath);
  } catch {
    return res.status(400).json({ message: "Invalid target path" });
  }

  // 2. 确定请求方法、请求头和请求体
  // 如果是 URL 路径模式且没有包装字段，则直接透传请求
  const isWrapperPattern = !!payload.path && !!payload.body;
  
  const method = (isWrapperPattern ? payload.method : req.method || "POST").toUpperCase();
  const forwardHeaders = toObjectHeaders(isWrapperPattern ? payload.headers : req.headers);
  const body = isWrapperPattern ? payload.body : payload;

  // 移除可能冲突的 Host
  delete forwardHeaders["host"];
  delete forwardHeaders["connection"];

  if (!forwardHeaders["Content-Type"] && method !== "GET" && method !== "HEAD") {
    forwardHeaders["Content-Type"] = "application/json";
  }

  // --- 缓存逻辑开始 ---
  const cacheKey = generateCacheKey(targetUrl, body);
  const cachedData = getCache(cacheKey);
  if (cachedData) {
    return res.status(200).json({ 
        ...cachedData, 
        _cached: true
    });
  }
  // --- 缓存逻辑结束 ---

  let response;
  try {
    response = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: method === "GET" || method === "HEAD" ? undefined : typeof body === "string" ? body : JSON.stringify(body ?? {})
    });
  } catch (e) {
    return res.status(502).json({ message: "Upstream request failed", error: e.message });
  }

  const raw = await response.text();

  // Intercept and extract data based on strategies
  if (shouldIntercept(targetUrl)) {
      try {
          const json = JSON.parse(raw);
          const extracted = extractData(targetUrl, json);
          
          // --- 存入缓存 ---
          if (response.status === 200) {
              setCache(cacheKey, extracted);
          }
          
          return res.status(response.status).json(extracted);
      } catch (e) {
          console.error("Extraction failed", e);
      }
  }

  response.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  return res.status(response.status).send(raw);
}
