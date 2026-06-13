import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), "../app");

export default function (app, ctx) {
  const JS = fs.readFileSync(path.join(APP, "app.js"), "utf-8");
  const BASE = fs.readFileSync(path.join(APP, "base.css"), "utf-8");
  const THEME = fs.readFileSync(path.join(APP, "theme.css"), "utf-8");

  const rpcUrl = (ctx.config && ctx.config.get && ctx.config.get("rpcUrl")) || "http://localhost:6800/jsonrpc";
  const rpcSecret = (ctx.config && ctx.config.get && ctx.config.get("rpcSecret")) || "";

  // RPC 代理：页面 fetch 走同源路由，绕过 CORS
  app.post("/rpc", async (c) => {
    const body = await c.req.text();
    let reqBody = JSON.parse(body);
    if (rpcSecret && reqBody.params) {
      reqBody.params.unshift("token:" + rpcSecret);
    }
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(reqBody)
      });
      const json = await res.json();
      return c.json(json);
    } catch (e) {
      return c.json({ jsonrpc: "2.0", id: null, error: { code: -1, message: e.message } }, 502);
    }
  });

  app.get("/page", (c) => {
    const hc = c.req.query("hana-css") || "";
    const th = c.req.query("hana-theme") || "inherit";
    const hcLink = hc ? `<link rel="stylesheet" href="${esc(hc)}">` : "";
    // 把页面 URL 的完整 query 传给前端，代理请求时带上认证参数
    const qs = c.req.url.indexOf("?") >= 0 ? c.req.url.slice(c.req.url.indexOf("?")) : "";

    return c.html(`<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Aria2 下载管理</title>
${hcLink}
<style>${BASE}${THEME}</style>
</head>
<body data-hana-theme="${esc(th)}" data-surface="page">
<div id="app"></div>
<script>window.__AR2_URL__="./rpc${esc(qs)}";window.__AR2_SECRET__=""</script>
<script>(function(){window.parent.postMessage({source:"hana-plugin",type:"ready"},"*")})();</script>
<script>${JS}</script>
</body>
</html>`);
  });
}

function esc(v) {
  return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
