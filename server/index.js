// server/index.js
import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Pfade
const PORT = process.env.PORT || 8787;
const DATA_DIR = path.join(__dirname, '../data');
const LAYOUT_PATH = path.join(DATA_DIR, 'cmr-layout.json');
const USERS_PATH = path.join(DATA_DIR, 'users.json');
const PUBLIC_DEFAULT_LAYOUT = path.join(__dirname, '../public/cmr-layout.json');

const app = express();
app.use(express.json({ limit: '10mb' }));

// ---- Sessions (Dev: MemoryStore reicht)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // in Produktion hinter https auf true stellen
      maxAge: 1000 * 60 * 60 * 8, // 8h
    },
  })
);

// ===== Helpers
async function getDefaultLayout() {
  if (await fs.pathExists(PUBLIC_DEFAULT_LAYOUT)) {
    try {
      const json = await fs.readJSON(PUBLIC_DEFAULT_LAYOUT);
      return json;
    } catch {}
  }
  return {
    pageWidth: 595.28,
    pageHeight: 841.89,
    backgroundPdfBase64: "",
    calibration: { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotationDeg: 0 },
    fields: {}
  };
}

async function ensureDefaultUsers() {
  await fs.ensureDir(DATA_DIR);
  if (!(await fs.pathExists(USERS_PATH))) {
    const pass = 'test1234';
    const hash = await bcrypt.hash(pass, 10);
    const users = [
      { id: 'u1', username: 'buero',    displayName: 'Büro',  role: 'office',    passwordHash: hash },
      { id: 'u2', username: 'lager',    displayName: 'Lager', role: 'warehouse', passwordHash: hash },
    ];
    await fs.writeJSON(USERS_PATH, users, { spaces: 2 });
    console.log('➜ Default-Logins angelegt: buero / lager (Passwort: test1234)');
  }
}
async function readUsers() {
  await ensureDefaultUsers();
  return fs.readJSON(USERS_PATH);
}
function publicUser(u) {
  return { id: u.id, username: u.username, displayName: u.displayName || u.username, role: u.role };
}
function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  return res.status(401).json({ error: 'Nicht eingeloggt' });
}
function requireRole(role) {
  return (req, res, next) => {
    const u = req.session?.user;
    if (!u) return res.status(401).json({ error: 'Nicht eingeloggt' });
    if (u.role === role) return next();
    return res.status(403).json({ error: 'Keine Berechtigung' });
  };
}

// ===== Auth-Routen
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Fehlende Zugangsdaten' });
    const users = await readUsers();
    const user = users.find((u) => u.username === username);
    if (!user) return res.status(401).json({ error: 'Ungültig' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Ungültig' });

    req.session.user = publicUser(user);
    return res.json({ user: req.session.user });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ user: null });
  res.json({ user: req.session.user });
});

// ===== CMR-Layout-API (wie gehabt)
app.get('/api/layout/cmr', async (req, res) => {
  try {
    await fs.ensureDir(DATA_DIR);
    if (!(await fs.pathExists(LAYOUT_PATH))) {
      const def = await getDefaultLayout();
      await fs.writeJSON(LAYOUT_PATH, def, { spaces: 2 });
      return res.json(def);
    }
    const layout = await fs.readJSON(LAYOUT_PATH);
    return res.json(layout);
  } catch (err) {
    console.error('GET /api/layout/cmr error:', err);
    res.status(500).json({ error: 'Layout konnte nicht geladen werden.' });
  }
});

app.put('/api/layout/cmr', requireAuth, requireRole('office'), async (req, res) => {
  try {
    await fs.ensureDir(DATA_DIR);
    const layout = req.body || {};
    await fs.writeJSON(LAYOUT_PATH, layout, { spaces: 2 });
    return res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/layout/cmr error:', err);
    res.status(500).json({ error: 'Layout konnte nicht gespeichert werden.' });
  }
});

// (Optional) Produktion: Static ausliefern
// app.use(express.static(path.join(__dirname, '../dist')));
// app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../dist/index.html')));

app.listen(PORT, async () => {
  await ensureDefaultUsers();
  console.log(`➜ API läuft auf http://localhost:${PORT}`);
});
