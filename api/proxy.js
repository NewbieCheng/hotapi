import { extractData, shouldIntercept } from './extractor.js';
import { generateCacheKey, getCache, setCache } from './cache_system.js';

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
    return res.status(400).json({ message: "Invalid JSON body" });
  }

  let targetUrl;
  try {
    targetUrl = buildTargetUrl(payload.path);
  } catch {
    return res.status(400).json({ message: "Invalid path" });
  }

  const method = (payload.method || req.method || "POST").toUpperCase();
  const forwardHeaders = toObjectHeaders(payload.headers);
  const body = payload.body;

  if (!forwardHeaders["Content-Type"] && method !== "GET" && method !== "HEAD") {
    forwardHeaders["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: method === "GET" || method === "HEAD" ? undefined : typeof body === "string" ? body : JSON.stringify(body ?? {})
    });
  } catch {
    return res.status(502).json({ message: "Upstream request failed" });
  }

  const raw = await response.text();

  // Intercept and extract data based on strategies
  if (shouldIntercept(targetUrl)) {
      try {
          // Try to get from cache first (using original request body/url)
          const cacheKey = generateCacheKey(targetUrl, payload);
          const cachedData = getCache(cacheKey);
          if (cachedData) {
              return res.status(200).json({ ...cachedData, hit_cache: true });
          }

          const json = JSON.parse(raw);
          const extracted = extractData(targetUrl, json);
          
          // Set cache if data is valid
          setCache(cacheKey, extracted);
          
          return res.status(response.status).json({ ...extracted, hit_cache: false });
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
