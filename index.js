/* import serveHotApi from "dailyhot-api";

serveHotApi();
*/
export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ message: "Method Not Allowed" }));
  }

  if (pathname !== "/") {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ message: "Only /api/proxy is available" }));
  }

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>资源搜索接口中转站</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #0b1020;
      color: #f5f7ff;
    }
    main {
      width: min(760px, calc(100vw - 32px));
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 16px;
      padding: 28px;
      box-sizing: border-box;
    }
    h1 { margin: 0 0 12px; font-size: 30px; }
    p { margin: 8px 0; line-height: 1.7; opacity: .95; }
    code {
      display: block;
      margin-top: 14px;
      padding: 12px;
      border-radius: 10px;
      background: rgba(0,0,0,.34);
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <main>
    <h1>资源搜索接口中转站</h1>
    <p>当前站点仅保留 API 中转功能。</p>
    <p>可用接口：POST /api/proxy</p>
    <code>{"path":"/api/douyin/search_general_v3","method":"POST","headers":{"Authorization":"Bearer YOUR_TOKEN","Content-Type":"application/json"},"body":{"keyword":"伊朗","cursor":0}}</code>
    <p>by-今天不加班-Chase | 微信：z503424</p>
  </main>
</body>
</html>`;

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.end(html);
}

