import { getStore } from "@netlify/blobs";

const J = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const sha = async (s) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");

function envPw() {
  let v;
  try { v = Netlify.env.get("ADMIN_PASSWORD"); } catch {}
  return v || process.env.ADMIN_PASSWORD || "";
}

export default async (req) => {
  const store = getStore("holden-site");
  const q = new URL(req.url).searchParams;
  const env = envPw();
  const stored = await store.get("auth");

  // Public: the saved page
  if (req.method === "GET" && ![...q].length) return J((await store.get("content", { type: "json" })) || {});

  // Public: does the admin need first-time setup?
  if (req.method === "GET" && q.get("status")) return J({ needsSetup: !env && !stored, usingEnv: !!env });

  let body = {};
  if (req.method === "POST") { try { body = await req.json(); } catch {} }

  // First-time password creation (only when no password exists anywhere)
  if (body.action === "setup") {
    if (env || stored) return J({ error: "A password is already set." }, 403);
    if (!body.password || body.password.length < 8) return J({ error: "Use at least 8 characters." }, 400);
    await store.set("auth", await sha(body.password));
    return J({ ok: true });
  }

  // Everything below needs the password
  const given = req.headers.get("x-admin-password") || "";
  const ok = env ? given === env : !!stored && stored === (await sha(given));
  if (!ok) return J({ error: env || stored ? "Wrong password." : "No password set yet. Open /admin to create one." }, 401);

  if (req.method === "GET" && q.get("check")) return J({ ok: true });

  if (req.method === "GET" && q.get("list")) {
    const { blobs } = await store.list({ prefix: "backup:" });
    return J({ backups: blobs.map((b) => b.key).sort().reverse() });
  }
  if (req.method === "GET" && q.get("backup")) {
    const k = q.get("backup");
    if (!k.startsWith("backup:")) return J({ error: "Bad key." }, 400);
    let h = ""; try { h = JSON.parse(await store.get(k)).html; } catch {}
    return J({ html: h });
  }

  if (req.method === "POST") {
    if (typeof body.html !== "string") return J({ error: "Invalid data." }, 400);
    const prev = await store.get("content");
    if (prev) {
      await store.set("backup:" + String(Date.now()).padStart(14, "0"), prev);
      const { blobs } = await store.list({ prefix: "backup:" });
      const keys = blobs.map((b) => b.key).sort();
      for (const k of keys.slice(0, Math.max(0, keys.length - 15))) await store.delete(k);
    }
    await store.setJSON("content", { html: body.html });
    return J({ ok: true });
  }

  if (req.method === "DELETE") {
    const prev = await store.get("content");
    if (prev) await store.set("backup:" + String(Date.now()).padStart(14, "0"), prev);
    await store.delete("content");
    return J({ ok: true });
  }

  return J({ error: "Method not allowed." }, 405);
};

export const config = { path: "/api/content" };
