// Holden admin API. One handler for every /api/* route.
// Runs as a Netlify Function in production and inside dev-server.mjs locally.
import crypto from "node:crypto";
import { store } from "./store.mjs";

const ROLES = ["owner", "manager", "technician"];
const STATUSES = ["new", "contacted", "scheduled", "done"];
const SERVICES = ["Heating & Cooling", "Plumbing", "Drain & Sewer", "Electrical"];
// What each role may do
const CAN = {
  owner: ["content", "bookings", "bookings:edit", "bookings:delete", "stats", "users"],
  manager: ["content", "bookings", "bookings:edit", "bookings:delete", "stats"],
  technician: ["bookings", "bookings:edit", "stats"],
};
const SESSION_HOURS = 12;

const J = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const err = (msg, s = 400) => J({ error: msg }, s);
const id = () => crypto.randomBytes(9).toString("base64url");
const clean = (v, max = 500) => String(v ?? "").trim().slice(0, max);
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const hashPw = (pw, salt = crypto.randomBytes(16).toString("hex")) =>
  ({ salt, hash: crypto.pbkdf2Sync(pw, salt, 120000, 32, "sha256").toString("hex") });
const checkPw = (pw, u) =>
  crypto.timingSafeEqual(Buffer.from(hashPw(pw, u.salt).hash, "hex"), Buffer.from(u.hash, "hex"));

async function secret(s) {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  let v = await s.get("secret");
  if (!v) { v = crypto.randomBytes(32).toString("hex"); await s.set("secret", v); }
  return v;
}
const sign = (data, key) => crypto.createHmac("sha256", key).update(data).digest("base64url");
async function makeToken(s, u) {
  const body = Buffer.from(JSON.stringify({ uid: u.id, v: u.tokenVersion || 0, exp: Date.now() + SESSION_HOURS * 3600e3 })).toString("base64url");
  return body + "." + sign(body, await secret(s));
}
async function currentUser(s, req) {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  const [body, sig] = t.split(".");
  if (!body || !sig) return null;
  const good = sign(body, await secret(s));
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  let p; try { p = JSON.parse(Buffer.from(body, "base64url").toString()); } catch { return null; }
  if (p.exp < Date.now()) return null;
  const u = await s.get("user:" + p.uid);
  if (!u || u.disabled || (u.tokenVersion || 0) !== p.v) return null;
  return u;
}
const pub = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, disabled: !!u.disabled, createdAt: u.createdAt, lastLogin: u.lastLogin || null });

async function allUsers(s) {
  const keys = await s.list("user:");
  return (await Promise.all(keys.map((k) => s.get(k)))).filter(Boolean);
}
async function allBookings(s) {
  const keys = await s.list("booking:");
  return (await Promise.all(keys.map((k) => s.get(k)))).filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
const owners = (users) => users.filter((u) => u.role === "owner" && !u.disabled);

function weekStart(d) { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x; }

export default async function handler(req) {
  const s = await store();
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
  const parts = route.split("/");
  const m = req.method;
  let body = {};
  if (m === "POST" || m === "PUT" || m === "PATCH") { try { body = await req.json(); } catch {} }

  // ---------- Public ----------
  if (route === "site" && m === "GET") return J((await s.get("site")) || {});

  if (route === "bookings" && m === "POST") {
    if (body.website) return J({ ok: true }); // honeypot for bots
    const name = clean(body.name, 100), phone = clean(body.phone, 40);
    if (!name || phone.replace(/\D/g, "").length < 7) return err("Please enter your name and a valid phone number.");
    const b = {
      id: id(), name, phone, email: clean(body.email, 120),
      service: SERVICES.includes(body.service) ? body.service : "Other",
      date: /^\d{4}-\d{2}-\d{2}$/.test(body.date || "") ? body.date : "",
      message: clean(body.message, 2000), status: "new", notes: "", assignedTo: "",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), history: [],
    };
    await s.set("booking:" + b.id, b);
    return J({ ok: true });
  }

  if (route === "auth/status" && m === "GET") return J({ needsSetup: owners(await allUsers(s)).length === 0 });

  if (route === "auth/setup" && m === "POST") {
    if (owners(await allUsers(s)).length) return err("Setup is already complete.", 403);
    const email = clean(body.email, 120).toLowerCase(), name = clean(body.name, 80) || "Owner";
    if (!emailOk(email)) return err("Enter a valid email.");
    if (!body.password || body.password.length < 8) return err("Password must be at least 8 characters.");
    const u = { id: id(), email, name, role: "owner", ...hashPw(body.password), createdAt: new Date().toISOString(), lastLogin: new Date().toISOString() };
    await s.set("user:" + u.id, u);
    return J({ token: await makeToken(s, u), user: pub(u) });
  }

  if (route === "auth/login" && m === "POST") {
    const email = clean(body.email, 120).toLowerCase();
    const u = (await allUsers(s)).find((x) => x.email === email);
    if (!u || u.disabled || !checkPw(String(body.password || ""), u)) return err("Wrong email or password.", 401);
    u.lastLogin = new Date().toISOString();
    await s.set("user:" + u.id, u);
    return J({ token: await makeToken(s, u), user: pub(u) });
  }

  // ---------- Signed in ----------
  const me = await currentUser(s, req);
  if (!me) return err("Please sign in.", 401);
  const can = (p) => CAN[me.role]?.includes(p);
  const deny = () => err("Your role doesn't allow this.", 403);

  if (route === "me" && m === "GET") return J({ user: pub(me), permissions: CAN[me.role] });
  if (route === "me/password" && m === "POST") {
    if (!checkPw(String(body.current || ""), me)) return err("Current password is wrong.");
    if (!body.password || body.password.length < 8) return err("New password must be at least 8 characters.");
    Object.assign(me, hashPw(body.password), { tokenVersion: (me.tokenVersion || 0) + 1 });
    await s.set("user:" + me.id, me);
    return J({ token: await makeToken(s, me) });
  }

  // Site content
  if (route === "site" && m === "PUT") {
    if (!can("content")) return deny();
    if (!body || typeof body !== "object" || Array.isArray(body)) return err("Invalid content.");
    const json = JSON.stringify(body);
    if (json.length > 200000) return err("Content is too large.");
    const prev = await s.get("site");
    if (prev) await s.set("site-backup:" + String(Date.now()).padStart(14, "0"), { by: me.email, data: prev });
    const backups = (await s.list("site-backup:")).sort();
    for (const k of backups.slice(0, Math.max(0, backups.length - 20))) await s.del(k);
    await s.set("site", { ...body, _updatedAt: new Date().toISOString(), _updatedBy: me.name });
    return J({ ok: true });
  }

  // Bookings
  if (parts[0] === "bookings") {
    if (!can("bookings")) return deny();
    if (parts.length === 1 && m === "GET") return J({ bookings: await allBookings(s), statuses: STATUSES, services: SERVICES });
    const b = parts[1] && (await s.get("booking:" + parts[1]));
    if (!b) return err("Booking not found.", 404);
    if (m === "PATCH") {
      if (!can("bookings:edit")) return deny();
      if (body.status !== undefined) {
        if (!STATUSES.includes(body.status)) return err("Unknown status.");
        if (body.status !== b.status) b.history.push({ at: new Date().toISOString(), by: me.name, from: b.status, to: body.status });
        b.status = body.status;
      }
      if (body.notes !== undefined) b.notes = clean(body.notes, 4000);
      if (body.assignedTo !== undefined) b.assignedTo = clean(body.assignedTo, 40);
      if (body.date !== undefined && (body.date === "" || /^\d{4}-\d{2}-\d{2}$/.test(body.date))) b.date = body.date;
      b.updatedAt = new Date().toISOString();
      await s.set("booking:" + b.id, b);
      return J({ booking: b });
    }
    if (m === "DELETE") {
      if (!can("bookings:delete")) return deny();
      await s.del("booking:" + b.id);
      return J({ ok: true });
    }
  }

  // Dashboard stats
  if (route === "stats" && m === "GET") {
    if (!can("stats")) return deny();
    const list = await allBookings(s);
    const now = weekStart(new Date());
    const weeks = [];
    for (let i = 7; i >= 0; i--) { const d = new Date(now); d.setUTCDate(d.getUTCDate() - i * 7); weeks.push({ week: d.toISOString().slice(0, 10), count: 0 }); }
    const byService = Object.fromEntries([...SERVICES, "Other"].map((k) => [k, 0]));
    const byStatus = Object.fromEntries(STATUSES.map((k) => [k, 0]));
    for (const b of list) {
      const w = weekStart(b.createdAt).toISOString().slice(0, 10);
      const slot = weeks.find((x) => x.week === w); if (slot) slot.count++;
      byService[b.service] = (byService[b.service] || 0) + 1;
      byStatus[b.status] = (byStatus[b.status] || 0) + 1;
    }
    return J({ total: list.length, thisWeek: weeks.at(-1).count, lastWeek: weeks.at(-2).count, weeks, byService, byStatus, recent: list.slice(0, 5) });
  }

  // Users (owner only)
  if (parts[0] === "users") {
    if (parts.length === 1 && m === "GET") {
      // everyone can see the team list (used to assign bookings); details only for owners
      const users = (await allUsers(s)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return J({ users: can("users") ? users.map(pub) : users.filter((u) => !u.disabled).map((u) => ({ id: u.id, name: u.name, role: u.role })), roles: ROLES });
    }
    if (!can("users")) return deny();
    if (parts.length === 1 && m === "POST") {
      const email = clean(body.email, 120).toLowerCase(), name = clean(body.name, 80);
      if (!name || !emailOk(email)) return err("Enter a name and valid email.");
      if (!ROLES.includes(body.role)) return err("Pick a role.");
      if (!body.password || body.password.length < 8) return err("Password must be at least 8 characters.");
      if ((await allUsers(s)).some((u) => u.email === email)) return err("That email already has an account.");
      const u = { id: id(), email, name, role: body.role, ...hashPw(body.password), createdAt: new Date().toISOString() };
      await s.set("user:" + u.id, u);
      return J({ user: pub(u) });
    }
    const u = parts[1] && (await s.get("user:" + parts[1]));
    if (!u) return err("User not found.", 404);
    const users = await allUsers(s);
    const lastOwner = u.role === "owner" && owners(users).length === 1 && !u.disabled;
    if (m === "PATCH") {
      if (body.name !== undefined) u.name = clean(body.name, 80) || u.name;
      if (body.role !== undefined) {
        if (!ROLES.includes(body.role)) return err("Unknown role.");
        if (lastOwner && body.role !== "owner") return err("There must be at least one active owner.");
        u.role = body.role;
      }
      if (body.disabled !== undefined) {
        if (lastOwner && body.disabled) return err("There must be at least one active owner.");
        u.disabled = !!body.disabled; u.tokenVersion = (u.tokenVersion || 0) + 1;
      }
      if (body.password) {
        if (body.password.length < 8) return err("Password must be at least 8 characters.");
        Object.assign(u, hashPw(body.password), { tokenVersion: (u.tokenVersion || 0) + 1 });
      }
      await s.set("user:" + u.id, u);
      return J({ user: pub(u) });
    }
    if (m === "DELETE") {
      if (u.id === me.id) return err("You can't delete your own account.");
      if (lastOwner) return err("There must be at least one active owner.");
      await s.del("user:" + u.id);
      return J({ ok: true });
    }
  }

  return err("Not found.", 404);
}
