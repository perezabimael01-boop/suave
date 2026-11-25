// Cloudflare Worker + D1 database for the "Fraude Contacten" page.
// The list of fraud users lives in a Cloudflare D1 database, so it is the same
// on every computer. Nothing is stored on the (public) website itself.
//
// One-time setup in the Cloudflare dashboard:
// 1. Storage & Databases → D1 → Create database, name: suave-fraude
// 2. Workers & Pages → Create → Worker, name: suave-fraude → paste this code → Deploy
// 3. Worker → Settings → Bindings → Add → D1 database: variable name DB, database suave-fraude
// 4. Worker → Settings → Variables and Secrets:
//      FRAUDE_KEY       (Secret) a long password you make up; you type it once on the page
//      ALLOWED_ORIGINS  (Text)   https://perezabimael01-boop.github.io
// The table is created automatically on the first request.
//
// Also stores the latest "Collection Agency Check" list (collection-agency.html) in
// the same database: table agency_check holds exactly ONE row. Every new upload
// deletes the old list first, so only the latest list (with its date) is kept.

const SCHEMA = `CREATE TABLE IF NOT EXISTS fraud (
  email      TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  phone      TEXT NOT NULL DEFAULT '',
  monthly    REAL NOT NULL DEFAULT 0,
  added_at   TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_sent  TEXT NOT NULL DEFAULT ''
)`;

function cors(origin, env){
  const allowed = (env.ALLOWED_ORIGINS || "https://perezabimael01-boop.github.io").split(",").map(s => s.trim()).filter(Boolean);
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Fraude-Key",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
const json = (body, status, h) => new Response(JSON.stringify(body), { status, headers: { ...h, "Content-Type": "application/json", "Cache-Control": "no-store" } });

// Constant-time compare so the key can't be guessed by timing.
function sameKey(a, b){
  a = String(a || ""); b = String(b || "");
  if (!a || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function maskName(n){
  const parts = String(n || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return parts[0] + (parts.length > 1 ? " " + parts[parts.length - 1].charAt(0).toUpperCase() + "." : "");
}
function maskEmail(e){
  const [u, d] = String(e || "").split("@");
  if (!d) return "";
  return u.slice(0, 2) + "•••@" + d;
}
function maskPhone(p){
  const d = String(p || "").replace(/\D/g, "");
  return d ? "•••• " + d.slice(-3) : "";
}
function clean(r){
  return {
    email: String(r.email || "").trim().toLowerCase().slice(0, 200),
    name: String(r.name || "").trim().slice(0, 120),
    phone: String(r.phone || "").trim().slice(0, 30),
    monthly: Math.max(0, Math.round((Number(r.monthly) || 0) * 100) / 100)
  };
}

const AGENCY_SCHEMA = `CREATE TABLE IF NOT EXISTS agency_check (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  read_at    TEXT NOT NULL,
  saved_at   TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT '',
  users      INTEGER NOT NULL DEFAULT 0,
  data       TEXT NOT NULL
)`;

let schemaReady = false;
async function ensureSchema(env){
  if (schemaReady) return;
  await env.DB.prepare(SCHEMA).run();
  await env.DB.prepare(AGENCY_SCHEMA).run();
  schemaReady = true;
}

// Keep only the fields the Agency Check page needs, with sane types and lengths.
function cleanAgencyUser(u){
  const n = v => { const x = Number(v); return isFinite(x) ? Math.round(x * 100) / 100 : 0; };
  return {
    id: String(u.id == null ? "" : u.id).slice(0, 30), name: String(u.name || "").slice(0, 120), cty: String(u.cty || "").slice(0, 4),
    dpd: n(u.dpd), pd: n(u.pd), op: n(u.op), rem: n(u.rem), paid: n(u.paid), tot: n(u.tot), last: String(u.last || "").slice(0, 10), lastAmt: u.lastAmt == null || u.lastAmt === "" ? null : n(u.lastAmt),
    a30: n(u.a30), a90: n(u.a90), notes: n(u.notes), stripe: u.stripe ? 1 : 0, blocked: u.blocked ? 1 : 0
  };
}
async function agencyGet(env){
  const r = await env.DB.prepare("SELECT read_at, saved_at, source, users, data FROM agency_check WHERE id = 1").first();
  if (!r) return { empty: true };
  let users = []; try { users = JSON.parse(r.data); } catch(e){}
  return { meta: { at: r.read_at, savedAt: r.saved_at, source: r.source, n: r.users }, users };
}

async function list(env){
  const { results } = await env.DB.prepare("SELECT email, name, phone, monthly, added_at, updated_at, last_sent FROM fraud ORDER BY name COLLATE NOCASE, email").all();
  return results || [];
}

function upsertStmt(env, r, now){
  // Empty fields in the request never wipe out what is already stored.
  return env.DB.prepare(`INSERT INTO fraud (email, name, phone, monthly, added_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)
    ON CONFLICT(email) DO UPDATE SET
      name    = CASE WHEN excluded.name  <> '' THEN excluded.name  ELSE fraud.name  END,
      phone   = CASE WHEN excluded.phone <> '' THEN excluded.phone ELSE fraud.phone END,
      monthly = CASE WHEN ?6 THEN excluded.monthly ELSE fraud.monthly END,
      updated_at = excluded.updated_at`).bind(r.email, r.name, r.phone, r.monthly, now, r._setMonthly ? 1 : 0);
}

export default {
  async fetch(request, env){
    const origin = request.headers.get("Origin") || "";
    const h = cors(origin, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/"){
      return json({ status: "Fraude worker is running.", database: !!env.DB, key: !!env.FRAUDE_KEY, allowedOrigins: env.ALLOWED_ORIGINS || "(default)" }, 200, { "Access-Control-Allow-Origin": "*" });
    }
    if (h["Access-Control-Allow-Origin"] === "null") return json({ error: "Website not allowed: " + (origin || "(unknown)") }, 403, h);
    if (!env.DB || !env.FRAUDE_KEY) return json({ error: "Worker niet ingesteld: D1-binding DB en secret FRAUDE_KEY zijn nodig." }, 500, h);

    // The masked public view was removed: every page now needs the login (login-gate.js).
    if (!sameKey(request.headers.get("X-Fraude-Key"), env.FRAUDE_KEY)) return json({ error: "Verkeerd wachtwoord." }, 401, h);

    try {
      await ensureSchema(env);
      const now = new Date().toISOString();

      if (request.method === "GET" && url.pathname === "/auth"){
        return json({ ok: true }, 200, h);   // used by login-gate.js to check the password
      }
      if (request.method === "GET" && url.pathname === "/contacts"){
        return json({ rows: await list(env) }, 200, h);
      }
      if (request.method === "GET" && url.pathname === "/agency"){
        return json(await agencyGet(env), 200, h);
      }
      if (request.method !== "POST") return json({ error: "Not found" }, 404, h);
      const maxLen = url.pathname === "/agency/save" ? 3000000 : 500000;
      if (Number(request.headers.get("Content-Length") || 0) > maxLen) return json({ error: "Te groot" }, 413, h);
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") return json({ error: "Bad request" }, 400, h);

      if (url.pathname === "/contacts/save"){
        // Add or update one contact. Edit mode sends replace:true to allow clearing fields.
        const r = clean(body);
        if (!EMAIL.test(r.email)) return json({ error: "Ongeldig e-mailadres" }, 400, h);
        if (body.replace){
          await env.DB.prepare(`INSERT INTO fraud (email, name, phone, monthly, added_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)
            ON CONFLICT(email) DO UPDATE SET name = excluded.name, phone = excluded.phone, monthly = excluded.monthly, updated_at = excluded.updated_at`)
            .bind(r.email, r.name, r.phone, r.monthly, now).run();
        } else {
          r._setMonthly = body.monthly !== undefined && body.monthly !== "" && body.monthly !== null;
          await upsertStmt(env, r, now).run();
        }
        return json({ ok: true, rows: await list(env) }, 200, h);
      }
      if (url.pathname === "/agency/save"){
        // Replace the saved Agency Check list: the old one is deleted, the new one stored.
        const users = (Array.isArray(body.users) ? body.users : []).slice(0, 5000).map(cleanAgencyUser);
        if (!users.length) return json({ error: "Lege lijst" }, 400, h);
        const m = body.meta || {};
        const readAt = (d => isNaN(d) ? now : d.toISOString())(new Date(m.at || now));
        await env.DB.batch([
          env.DB.prepare("DELETE FROM agency_check"),
          env.DB.prepare("INSERT INTO agency_check (id, read_at, saved_at, source, users, data) VALUES (1, ?1, ?2, ?3, ?4, ?5)")
            .bind(readAt, now, String(m.source || "").slice(0, 200), users.length, JSON.stringify(users))
        ]);
        return json({ ok: true, ...(await agencyGet(env)) }, 200, h);
      }
      if (url.pathname === "/agency/delete"){
        await env.DB.prepare("DELETE FROM agency_check").run();
        return json({ ok: true, empty: true }, 200, h);
      }
      if (url.pathname === "/contacts/delete"){
        const email = String(body.email || "").trim().toLowerCase();
        await env.DB.prepare("DELETE FROM fraud WHERE email = ?1").bind(email).run();
        return json({ ok: true, rows: await list(env) }, 200, h);
      }
      if (url.pathname === "/contacts/mark-sent"){
        const emails = (Array.isArray(body.emails) ? body.emails : []).map(e => String(e).trim().toLowerCase()).slice(0, 500);
        if (emails.length) await env.DB.batch(emails.map(e => env.DB.prepare("UPDATE fraud SET last_sent = ?1 WHERE email = ?2").bind(now, e)));
        return json({ ok: true, rows: await list(env) }, 200, h);
      }
      if (url.pathname === "/contacts/import"){
        const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, 2000).map(x => {
          const r = clean({ ...x, monthly: x.monthly != null ? x.monthly : x.amount });
          r._setMonthly = r.monthly > 0;
          return r;
        }).filter(r => EMAIL.test(r.email));
        for (let i = 0; i < rows.length; i += 50) await env.DB.batch(rows.slice(i, i + 50).map(r => upsertStmt(env, r, now)));
        return json({ ok: true, imported: rows.length, rows: await list(env) }, 200, h);
      }
      return json({ error: "Not found" }, 404, h);
    } catch (err){
      console.error(err);
      return json({ error: "Databasefout: " + String(err && err.message || err) }, 500, h);
    }
  }
};
