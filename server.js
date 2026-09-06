const express = require('express');
const session = require('express-session');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASS = process.env.ADMIN_PASS || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const OWNER_EMAIL = process.env.OWNER_EMAIL || '';

if (!ADMIN_EMAIL || !ADMIN_PASS || !SESSION_SECRET || !OWNER_EMAIL) {
  throw new Error('Missing required environment variables: ADMIN_EMAIL, ADMIN_PASS, SESSION_SECRET, OWNER_EMAIL');
}

const DATA_DIR = __dirname;
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
}));

app.use(express.static(DATA_DIR));

async function readJSON(file, fallback) {
  try {
    const txt = await fs.readFile(file, 'utf8');
    return JSON.parse(txt);
  } catch (e) {
    return fallback;
  }
}

async function writeJSON(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

function normalizeProduct(p) {
  return {
    id: p.id || Date.now().toString() + Math.random().toString(36).slice(2, 6),
    name: p.name || '',
    price: Number(p.price) || 0,
    desc: p.desc || '',
    img: p.img || '',
    availableSizes: Array.isArray(p.availableSizes) ? p.availableSizes : [],
    availableColors: Array.isArray(p.availableColors) ? p.availableColors.map(color => ({
      colorName: color.colorName || 'Variant',
      imageUrl: color.imageUrl || '',
      outOfStockSizes: Array.isArray(color.outOfStockSizes) ? color.outOfStockSizes : []
    })) : []
  };
}

// Auth routes
app.get('/api/auth', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.isAdmin) });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const emailOk = String(email || '').trim().toLowerCase() === ADMIN_EMAIL;
  const passOk = password === ADMIN_PASS;
  if (emailOk && passOk) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  return res.status(403).json({ error: 'Invalid email or password' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Products API
app.get('/api/products', async (req, res) => {
  const list = await readJSON(PRODUCTS_FILE, []);
  res.json(list);
});

app.put('/api/products', requireAuth, async (req, res) => {
  const body = req.body;
  const list = Array.isArray(body) ? body.map(normalizeProduct) : [];
  await writeJSON(PRODUCTS_FILE, list);
  res.json(list);
});

app.post('/api/products', requireAuth, async (req, res) => {
  const list = await readJSON(PRODUCTS_FILE, []);
  const entry = normalizeProduct(req.body || {});
  list.push(entry);
  await writeJSON(PRODUCTS_FILE, list);
  res.json(entry);
});

app.put('/api/products/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const list = await readJSON(PRODUCTS_FILE, []);
  const idx = list.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  list[idx] = normalizeProduct({ ...list[idx], ...req.body, id });
  await writeJSON(PRODUCTS_FILE, list);
  res.json(list[idx]);
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  let list = await readJSON(PRODUCTS_FILE, []);
  list = list.filter(p => p.id !== id);
  await writeJSON(PRODUCTS_FILE, list);
  res.json({ ok: true });
});

app.delete('/api/products', requireAuth, async (req, res) => {
  await writeJSON(PRODUCTS_FILE, []);
  res.json({ ok: true });
});

app.post('/api/order-request', async (req, res) => {
  const { phone, email, landmark, address, paymentMethod, items } = req.body || {};
  if (!/^(?:98|97)\d{8}$/.test(String(phone || '')) || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'A valid phone number and at least one item are required' });
  }
  const lines = items.map(item => `${item.name} | Size: ${item.size || 'Not selected'} | Color: ${item.color || 'Default'} | ${item.price || 0}`).join('\n');
  const subject = `New shoe order request from ${phone}`;
  const text = `${subject}\n\nPhone: ${phone}\nCustomer email: ${email || 'Not provided'}\nLandmark: ${landmark || 'Not provided'}\nAddress: ${address || 'Not provided'}\nPayment: ${paymentMethod || 'Not selected'}\n\nItems:\n${lines}`;
  const settings = await readJSON(DATA_FILE, {});
  const recipient = process.env.OWNER_EMAIL || settings.settings?.shop_email || OWNER_EMAIL;
  try {
    if (process.env.SMTP_HOST) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
      });
      await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: recipient, replyTo: email || undefined, subject, text });
    } else {
      console.log(`Order request for ${recipient}:\n${text}`);
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error('Order email failed:', error.message);
    return res.status(502).json({ error: 'Could not send the order request' });
  }
});

// Hero and settings
app.get('/api/hero', async (req, res) => {
  const d = await readJSON(DATA_FILE, {});
  res.json(d.hero || {});
});

app.post('/api/hero', requireAuth, async (req, res) => {
  const d = await readJSON(DATA_FILE, {});
  d.hero = req.body || {};
  await writeJSON(DATA_FILE, d);
  res.json(d.hero);
});

app.get('/api/settings', async (req, res) => {
  const d = await readJSON(DATA_FILE, {});
  res.json(d.settings || {});
});

app.post('/api/settings', requireAuth, async (req, res) => {
  const d = await readJSON(DATA_FILE, {});
  d.settings = Object.assign(d.settings || {}, req.body || {});
  await writeJSON(DATA_FILE, d);
  res.json(d.settings);
});

app.get('/api/site-content', async (req, res) => {
  const d = await readJSON(DATA_FILE, {});
  res.json(d.siteContent || {});
});

app.post('/api/site-content', requireAuth, async (req, res) => {
  const d = await readJSON(DATA_FILE, {});
  d.siteContent = Object.assign(d.siteContent || {}, req.body || {});
  await writeJSON(DATA_FILE, d);
  res.json(d.siteContent);
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
