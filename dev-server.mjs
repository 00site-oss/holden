// Local development server: serves the static site and the /api/* function.
// Production runs on Netlify; this only exists so the app works in Docker/locally.
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

process.env.LOCAL_DATA_DIR ||= path.resolve(".data");
const { default: api } = await import("./server/api.mjs");
const PORT = Number(process.env.PORT || 3000);
const ROOT = path.resolve(".");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webp": "image/webp", ".avif": "image/avif" };
const BLOCK = /^\/(\.|server\/|netlify\/|node_modules\/|dev-server|package)/;

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const r = await api(new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) }));
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
    }
    let p = decodeURIComponent(url.pathname);
    if (BLOCK.test(p)) { res.writeHead(404); res.end("Not found"); return; }
    if (p.endsWith("/")) p += "index.html";
    let file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    try { if ((await fs.stat(file)).isDirectory()) { res.writeHead(301, { Location: p + "/" }); res.end(); return; } } catch {}
    const data = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch (e) {
    if (e.code === "ENOENT") { res.writeHead(404); res.end("Not found"); return; }
    console.error(e); res.writeHead(500); res.end("Server error");
  }
}).listen(PORT, () => console.log(`Holden dev server on http://localhost:${PORT}`));
