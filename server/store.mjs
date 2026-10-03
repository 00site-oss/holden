// Key/value storage. Uses Netlify Blobs in production and a local folder
// (LOCAL_DATA_DIR) during local development, so the same code runs in both.
import { promises as fs } from "node:fs";
import path from "node:path";

let impl;

async function fileStore(dir) {
  await fs.mkdir(dir, { recursive: true });
  const f = (k) => path.join(dir, encodeURIComponent(k) + ".json");
  return {
    async get(k) { try { return JSON.parse(await fs.readFile(f(k), "utf8")); } catch { return null; } },
    async set(k, v) { await fs.mkdir(dir, { recursive: true }); await fs.writeFile(f(k), JSON.stringify(v)); },
    async del(k) { await fs.rm(f(k), { force: true }); },
    async list(prefix) {
      const names = await fs.readdir(dir).catch(() => []);
      return names.filter((n) => n.endsWith(".json")).map((n) => decodeURIComponent(n.slice(0, -5))).filter((k) => k.startsWith(prefix));
    },
  };
}

async function blobStore() {
  const { getStore } = await import("@netlify/blobs");
  const s = getStore({ name: "holden-site", consistency: "strong" });
  return {
    get: (k) => s.get(k, { type: "json" }),
    set: (k, v) => s.setJSON(k, v),
    del: (k) => s.delete(k),
    async list(prefix) { const { blobs } = await s.list({ prefix }); return blobs.map((b) => b.key); },
  };
}

export async function store() {
  if (!impl) impl = process.env.LOCAL_DATA_DIR ? fileStore(process.env.LOCAL_DATA_DIR) : blobStore();
  return impl;
}
