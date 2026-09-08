require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASS = process.env.ADMIN_PASS || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const OWNER_EMAIL = process.env.OWNER_EMAIL || '';
const FRONTEND_ORIGIN = String(process.env.FRONTEND_ORIGIN || '').trim().replace(/\/$/, '');

if (!ADMIN_EMAIL || !ADMIN_PASS || !SESSION_SECRET || !OWNER_EMAIL) {
  throw new Error('Missing required environment variables: ADMIN_EMAIL, ADMIN_PASS, SESSION_SECRET, OWNER_EMAIL');
}

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const MONGODB_URI = String(process.env.MONGODB_URI || '').trim();
const MONGODB_DB = String(process.env.MONGODB_DB || 'collection_shoe_center').trim();
let storageCollection = null;

async function ensureDataDir() {
  if (!MONGODB_URI) await fs.mkdir(DATA_DIR, { recursive: true });
}

ensureDataDir();

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (FRONTEND_ORIGIN && origin === FRONTEND_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', secure: process.env.NODE_ENV === 'production' }
}));

app.use(express.static(path.join(__dirname, 'public')));

async function readJSON(file, fallback) {
  if (storageCollection) {
    const stored = await storageCollection.findOne({ key: file === PRODUCTS_FILE ? 'products' : 'data' });
    return stored ? stored.value : fallback;
  }
  try {
    const txt = await fs.readFile(file, 'utf8');
    return JSON.parse(txt);
  } catch (e) {
    return fallback;
  }
}

async function writeJSON(file, data) {
  if (storageCollection) {
    await storageCollection.replaceOne(
      { key: file === PRODUCTS_FILE ? 'products' : 'data' },
      { key: file === PRODUCTS_FILE ? 'products' : 'data', value: data, updatedAt: new Date() },
      { upsert: true }
    );
    return;
  }
  const tempFile = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tempFile, file);
}

async function connectMongo() {
  if (!MONGODB_URI) return;
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const collection = client.db(MONGODB_DB).collection('app_storage');
  await collection.createIndex({ key: 1 }, { unique: true });

  // Seed only missing documents so an existing MongoDB database is never overwritten.
  const localProducts = await readJSON(PRODUCTS_FILE, null);
  const localData = await readJSON(DATA_FILE, null);
  storageCollection = collection;
  if (!(await storageCollection.findOne({ key: 'products' })) && Array.isArray(localProducts)) {
    await writeJSON(PRODUCTS_FILE, localProducts);
  }
  if (!(await storageCollection.findOne({ key: 'data' })) && localData && typeof localData === 'object') {
    await writeJSON(DATA_FILE, localData);
  }
  console.log(`MongoDB storage enabled: ${MONGODB_DB}`);
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
    showOnHome: p.showOnHome !== false,
    showInCatalog: p.showInCatalog !== false,
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
  const order = {
    id: `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    status: 'new',
    phone: String(phone),
    email: String(email || ''),
    landmark: String(landmark || ''),
    address: String(address || ''),
    paymentMethod: String(paymentMethod || ''),
    items: items.map(item => ({
      id: item.id || '',
      name: String(item.name || ''),
      size: String(item.size || ''),
      color: String(item.color || ''),
      price: Number(item.priceValue ?? item.price) || 0
    })),
    total: items.reduce((sum, item) => sum + (Number(item.priceValue ?? item.price) || 0), 0)
  };
  settings.orders = Array.isArray(settings.orders) ? settings.orders : [];
  settings.orders.unshift(order);
  try {
    await writeJSON(DATA_FILE, settings);
  } catch (error) {
    console.error('Could not save order:', error.message);
    return res.status(500).json({ error: 'Could not save the order request' });
  }

  if (!process.env.EMAILJS_SERVICE_ID || !process.env.EMAILJS_TEMPLATE_ID || !process.env.EMAILJS_PUBLIC_KEY || !recipient) {
    console.error('Order email is not configured. Set EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, and OWNER_EMAIL.');
    return res.status(202).json({ ok: true, orderId: order.id, emailSent: false });
  }

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: process.env.EMAILJS_SERVICE_ID,
        template_id: process.env.EMAILJS_TEMPLATE_ID,
        user_id: process.env.EMAILJS_PUBLIC_KEY,
        template_params: {
          to_email: recipient,
          subject,
          message: text,
          phone,
          customer_email: email || 'Not provided',
          landmark: landmark || 'Not provided',
          address: address || 'Not provided',
          payment_method: paymentMethod || 'Not selected',
          items: lines
        }
      })
    });
    if (!response.ok) throw new Error(`EmailJS returned ${response.status}: ${await response.text()}`);
  } catch (error) {
    console.error('Order email failed:', error.message);
    return res.status(202).json({ ok: true, orderId: order.id, emailSent: false });
  }

  return res.json({ ok: true, orderId: order.id, emailSent: true });
});

app.get('/api/orders', requireAuth, async (req, res) => {
  const settings = await readJSON(DATA_FILE, {});
  res.json(Array.isArray(settings.orders) ? settings.orders : []);
});

app.put('/api/orders/:id', requireAuth, async (req, res) => {
  const settings = await readJSON(DATA_FILE, {});
  const orders = Array.isArray(settings.orders) ? settings.orders : [];
  const order = orders.find(item => item.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (typeof req.body?.status === 'string') order.status = req.body.status;
  await writeJSON(DATA_FILE, settings);
  res.json(order);
});

function normalizeReview(review) {
  const rating = Math.max(1, Math.min(5, Number(review.rating) || 0));
  return {
    id: review.id || `review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: review.createdAt || new Date().toISOString(),
    status: review.status === 'approved' ? 'approved' : 'pending',
    name: String(review.name || '').trim().slice(0, 80),
    text: String(review.text || '').trim().slice(0, 1000),
    rating,
    photo: typeof review.photo === 'string' && review.photo.startsWith('data:image/') ? review.photo : ''
  };
}

app.get('/api/reviews', async (req, res) => {
  const data = await readJSON(DATA_FILE, {});
  const reviews = Array.isArray(data.reviews) ? data.reviews : [];
  res.json(reviews.filter(review => review.status === 'approved'));
});

app.post('/api/reviews', async (req, res) => {
  const review = normalizeReview(req.body || {});
  if (!review.name || !review.text || review.rating < 1 || review.rating > 5) {
    return res.status(400).json({ error: 'Name, review text, and a rating from 1 to 5 are required' });
  }
  if (review.photo.length > 3 * 1024 * 1024) {
    return res.status(413).json({ error: 'Review photo must be smaller than 3 MB' });
  }
  const data = await readJSON(DATA_FILE, {});
  data.reviews = Array.isArray(data.reviews) ? data.reviews : [];
  data.reviews.unshift(review);
  await writeJSON(DATA_FILE, data);
  res.status(201).json({ ok: true, reviewId: review.id });
});

app.get('/api/reviews/manage', requireAuth, async (req, res) => {
  const data = await readJSON(DATA_FILE, {});
  res.json(Array.isArray(data.reviews) ? data.reviews : []);
});

app.put('/api/reviews/:id', requireAuth, async (req, res) => {
  const data = await readJSON(DATA_FILE, {});
  const reviews = Array.isArray(data.reviews) ? data.reviews : [];
  const review = reviews.find(item => item.id === req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found' });
  if (req.body?.status === 'approved' || req.body?.status === 'pending') review.status = req.body.status;
  await writeJSON(DATA_FILE, data);
  res.json(review);
});

app.delete('/api/reviews/:id', requireAuth, async (req, res) => {
  const data = await readJSON(DATA_FILE, {});
  data.reviews = (Array.isArray(data.reviews) ? data.reviews : []).filter(review => review.id !== req.params.id);
  await writeJSON(DATA_FILE, data);
  res.json({ ok: true });
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

async function startServer() {
  await ensureDataDir();
  await connectMongo();
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`Persistent data directory: ${DATA_DIR}`);
  });
}

startServer().catch(error => {
  console.error('Could not start server:', error);
  process.exitCode = 1;
});
