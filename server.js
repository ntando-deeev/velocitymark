import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Uploads directory setup ──────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = crypto.randomBytes(12).toString('hex') + ext;
    cb(null, name);
  }
});
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only JPEG, PNG, WEBP and GIF images are allowed'), false);
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 } // 8 MB
});

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URL;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || 'sk_test_demo';
const JWT_SECRET = process.env.JWT_SECRET || 'velocitymark-secret-2024';

const stripe = new Stripe(STRIPE_SECRET);

// ─── MongoDB Models ───────────────────────────────────────────────────────────

// Vendor/Seller Account
const vendorSchema = new mongoose.Schema({
  name:           { type: String, required: true },
  email:          { type: String, required: true, unique: true, lowercase: true },
  password:       { type: String, required: true },
  storeName:      { type: String, required: true },
  storeDesc:      { type: String },
  image:          { type: String },
  category:       { type: String },
  whatsapp:       { type: String },
  rating:         { type: Number, default: 5 },
  reviews:        { type: Number, default: 0 },
  verified:       { type: Boolean, default: false },
  stripeConnectId: { type: String },
  totalSales:     { type: Number, default: 0 },
  totalEarnings:  { type: Number, default: 0 },
  plan:           { type: String, default: 'free', enum: ['free','premium'] },
  contactEmail:   { type: String },
  contactPhone:   { type: String },
  location:       { type: String },
  website:        { type: String },
  notifications:  [{ message: String, type: String, read: { type: Boolean, default: false }, createdAt: { type: Date, default: Date.now } }],
  createdAt:      { type: Date, default: Date.now }
});

// Product
const productSchema = new mongoose.Schema({
  vendorId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  vendorName:     { type: String },
  name:           { type: String, required: true },
  description:    { type: String },
  price:          { type: Number, required: true },
  originalPrice:  { type: Number },
  category:       { type: String },
  image:          { type: String },
  images:         [{ type: String }],   // Gallery images (up to 6)
  stock:          { type: Number, default: 999 },
  rating:         { type: Number, default: 4.5 },
  reviews:        { type: Number, default: 0 },
  featured:       { type: Boolean, default: false },
  tags:           [String],
  sku:            { type: String },
  openingStock:   { type: Number, default: 0 },
  lowStockThreshold: { type: Number, default: 5 },
  variants:       [{ name: String, options: [{ label: String, price: Number, stock: Number }] }],
  sponsored:      { type: Boolean, default: false },
  sponsoredUntil: { type: Date },
  sponsoredBudget:{ type: Number, default: 0 },
  // Payment plans — seller-defined flexible payment options
  paymentPlans: [{
    id:           { type: String },           // e.g. "full", "lay2", "dep30", "custom"
    label:        { type: String },           // Display name, e.g. "Pay in Full"
    type:         { type: String,
                    enum: ['full','installments','deposit'] },
    installments: { type: Number, default: 1 },
    depositPct:   { type: Number, default: 0 },   // % required upfront (for deposit plans)
    interval:     { type: String,
                    enum: ['immediate','weekly','biweekly','monthly'],
                    default: 'immediate' },
    note:         { type: String }            // Optional seller note, e.g. "WhatsApp to confirm"
  }],
  createdAt:      { type: Date, default: Date.now }
});

// Order
const orderSchema = new mongoose.Schema({
  orderId:        { type: String, unique: true },
  vendorId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  customerId:     { type: String },
  items:          [{
    productId:    mongoose.Schema.Types.ObjectId,
    name:         String,
    price:        Number,
    quantity:     Number,
    vendorId:     mongoose.Schema.Types.ObjectId
  }],
  subtotal:       { type: Number },
  platformFee:    { type: Number }, // 10% commission
  vendorEarnings: { type: Number },
  status:         { type: String, default: 'pending' },
  email:          String,
  shippingAddress: String,
  stripePaymentId: String,
  createdAt:      { type: Date, default: Date.now }
});

const Vendor    = mongoose.model('Vendor', vendorSchema);
const Product   = mongoose.model('Product', productSchema);
const Order     = mongoose.model('Order', orderSchema);

// ─── Connect to MongoDB ───────────────────────────────────────────────────────

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI, { dbName: 'velocitymark' })
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('⚠️  MongoDB error:', err.message));
}

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// General API: 200 req / 15 min per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
// Auth endpoints: 10 attempts / 15 min per IP (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' }
});
// Contact / subscribe: 5 submissions / hour per IP
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please wait before trying again.' }
});
app.use('/api', generalLimiter);
app.use('/api/vendor/login',    authLimiter);
app.use('/api/vendor/register', authLimiter);
app.use('/api/contact',    contactLimiter);
app.use('/api/subscribe',  contactLimiter);

// Auth Middleware
const verifyVendor = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.vendorId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    status: 'VelocityMark Marketplace is running',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ─── IMAGE UPLOAD ─────────────────────────────────────────────────────────────
// Available to ALL sellers (free + premium) — no gate.
// POST /api/upload/image  (multipart, field: "image")
// Returns: { url: "/uploads/filename.jpg" }
app.post('/api/upload/image', verifyVendor, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file provided' });
  const domain = process.env.DOMAIN || '';
  res.json({ success: true, url: `${domain}/uploads/${req.file.filename}` });
});

// POST /api/upload/images  (multipart, field: "images", up to 6 files)
app.post('/api/upload/images', verifyVendor, upload.array('images', 6), (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'No images provided' });
  const domain = process.env.DOMAIN || '';
  const urls = req.files.map(f => `${domain}/uploads/${f.filename}`);
  res.json({ success: true, urls });
});

// ─── VENDOR AUTHENTICATION ────────────────────────────────────────────────────

app.post('/api/vendor/register', async (req, res) => {
  const { name, email, password, storeName, storeDesc, category } = req.body;
  
  if (!name || !email || !password || !storeName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const existing = await Vendor.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const vendor = await Vendor.create({
      name,
      email,
      password: hashedPassword,
      storeName,
      storeDesc,
      category,
      image: '🏪'
    });

    const token = jwt.sign({ id: vendor._id, email }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      success: true,
      message: 'Vendor registered! Welcome to VelocityMark marketplace.',
      token,
      vendorId: vendor._id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vendor/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const vendor = await Vendor.findOne({ email });
    if (!vendor) return res.status(400).json({ error: 'Vendor not found' });

    const validPassword = await bcrypt.compare(password, vendor.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: vendor._id, email }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      success: true,
      token,
      vendor: { id: vendor._id, storeName: vendor.storeName, email: vendor.email }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── VENDOR DASHBOARD ─────────────────────────────────────────────────────────

app.get('/api/vendor/dashboard', verifyVendor, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendorId);
    const productCount = await Product.countDocuments({ vendorId: req.vendorId });
    const orderCount = await Order.countDocuments({ vendorId: req.vendorId });
    const totalRevenue = vendor.totalEarnings;

    res.json({
      vendor,
      stats: { productCount, orderCount, totalRevenue }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PRODUCTS (VENDOR) ────────────────────────────────────────────────────────

app.post('/api/products/upload', verifyVendor, async (req, res) => {
  const { name, description, price, originalPrice, category, stock, tags, image, images } = req.body;

  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Name, price, and category required' });
  }

  try {
    const vendor = await Vendor.findById(req.vendorId);

    // Build gallery: primary image first, then extras (max 6 total)
    const allImages = [image, ...(Array.isArray(images) ? images : [])]
      .filter(img => img && typeof img === 'string' && img.trim())
      .slice(0, 6);

    const product = await Product.create({
      vendorId: req.vendorId,
      vendorName: vendor.storeName,
      name,
      description,
      price,
      originalPrice,
      category,
      stock: stock || 999,
      tags: tags || [],
      image: allImages[0] || '📦',
      images: allImages
    });

    res.json({
      success: true,
      message: 'Product uploaded successfully!',
      product
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vendor/products', verifyVendor, async (req, res) => {
  try {
    const products = await Product.find({ vendorId: req.vendorId });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', verifyVendor, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product.vendorId.toString() !== req.vendorId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Handle gallery images on update
    if (req.body.image || req.body.images) {
      const allImages = [req.body.image, ...(Array.isArray(req.body.images) ? req.body.images : [])]
        .filter(img => img && typeof img === 'string' && img.trim())
        .slice(0, 6);
      if (allImages.length) {
        req.body.image  = allImages[0];
        req.body.images = allImages;
      }
    }

    Object.assign(product, req.body);
    await product.save();

    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', verifyVendor, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product.vendorId.toString() !== req.vendorId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PAYMENT PLANS ───────────────────────────────────────────────────────────

// GET plans for a product (public)
app.get('/api/products/:id/payment-plans', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).select('paymentPlans price name');
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ paymentPlans: product.paymentPlans || [], price: product.price });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT — seller sets payment plans for their product
app.put('/api/products/:id/payment-plans', verifyVendor, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.vendorId.toString() !== req.vendorId)
      return res.status(403).json({ error: 'Unauthorized' });

    const { paymentPlans } = req.body;
    if (!Array.isArray(paymentPlans))
      return res.status(400).json({ error: 'paymentPlans must be an array' });

    // Validate each plan
    const cleaned = paymentPlans.map((plan, i) => ({
      id:           plan.id || `plan_${i}`,
      label:        (plan.label || '').trim().slice(0, 80),
      type:         ['full','installments','deposit'].includes(plan.type) ? plan.type : 'full',
      installments: Math.max(1, Math.min(24, parseInt(plan.installments) || 1)),
      depositPct:   Math.max(0, Math.min(100, parseFloat(plan.depositPct) || 0)),
      interval:     ['immediate','weekly','biweekly','monthly'].includes(plan.interval) ? plan.interval : 'immediate',
      note:         (plan.note || '').trim().slice(0, 200)
    }));

    product.paymentPlans = cleaned;
    await product.save();
    res.json({ success: true, paymentPlans: product.paymentPlans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PRODUCTS (BUYERS) ────────────────────────────────────────────────────────

app.get('/api/products', async (req, res) => {
  try {
    const { category, search, vendor } = req.query;
    let filter = {};
    
    if (category) filter.category = category;
    if (vendor) filter.vendorId = vendor;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('vendorId');
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── VENDORS (BUYERS) ─────────────────────────────────────────────────────────

app.get('/api/vendors', async (req, res) => {
  try {
    const vendors = await Vendor.find({ verified: true }).select('-password');
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vendors/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id).select('-password');
    const products = await Product.find({ vendorId: req.params.id }).limit(12);
    res.json({ vendor, products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CHECKOUT ─────────────────────────────────────────────────────────────────

app.post('/api/checkout', async (req, res) => {
  const { items, email, name, shippingAddress } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  try {
    let total = 0;
    items.forEach(item => {
      total += item.price * item.quantity;
    });

    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: { name: `${item.name} (${item.vendorName})` },
        unit_amount: Math.round(item.price * 100)
      },
      quantity: item.quantity
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.DOMAIN || 'https://velocitymark.onrender.com'}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.DOMAIN || 'https://velocitymark.onrender.com'}/checkout`,
      customer_email: email,
      metadata: { name, shippingAddress }
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── VENDOR ORDERS ────────────────────────────────────────────────────────────

app.get('/api/vendor/orders', verifyVendor, async (req, res) => {
  try {
    const orders = await Order.find({ vendorId: req.vendorId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/vendor/orders/:id/status', verifyVendor, async (req, res) => {
  const { status } = req.body;

  try {
    const order = await Order.findById(req.params.id);
    if (order.vendorId.toString() !== req.vendorId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    order.status = status;
    await order.save();
    
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── VENDOR PROFILE UPDATE ───────────────────────────────────────────────────

app.put('/api/vendor/profile', verifyVendor, async (req, res) => {
  const { storeName, storeDesc, category, image, contactEmail, contactPhone, whatsapp, location, website } = req.body;
  try {
    const vendor = await Vendor.findByIdAndUpdate(
      req.vendorId,
      { storeName, storeDesc, category, image, contactEmail, contactPhone, whatsapp, location, website },
      { new: true }
    );
    res.json({ success: true, vendor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── VENDOR ANALYTICS ────────────────────────────────────────────────────────

app.get('/api/vendor/analytics', verifyVendor, async (req, res) => {
  try {
    const vendorId = req.vendorId;

    // Sales by day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentOrders = await Order.find({
      vendorId,
      createdAt: { $gte: sevenDaysAgo }
    }).sort({ createdAt: 1 });

    const salesByDay = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      salesByDay[key] = { date: key, orders: 0, revenue: 0 };
    }
    recentOrders.forEach(o => {
      const key = o.createdAt.toISOString().slice(0, 10);
      if (salesByDay[key]) {
        salesByDay[key].orders += 1;
        salesByDay[key].revenue += o.vendorEarnings || 0;
      }
    });

    // Top products by order frequency
    const allOrders = await Order.find({ vendorId });
    const productFreq = {};
    allOrders.forEach(o => {
      (o.items || []).forEach(item => {
        const key = item.name || item.productId?.toString();
        if (!productFreq[key]) productFreq[key] = { name: item.name, sold: 0, revenue: 0 };
        productFreq[key].sold += item.quantity || 1;
        productFreq[key].revenue += (item.price || 0) * (item.quantity || 1);
      });
    });
    const topProducts = Object.values(productFreq).sort((a, b) => b.sold - a.sold).slice(0, 5);

    // Low stock products (stock <= 5)
    const lowStock = await Product.find({ vendorId, stock: { $lte: 5 } }).select('name stock price');

    // Revenue breakdown
    const vendor = await Vendor.findById(vendorId);
    const totalOrders = await Order.countDocuments({ vendorId });
    const pendingOrders = await Order.countDocuments({ vendorId, status: 'pending' });
    const shippedOrders = await Order.countDocuments({ vendorId, status: 'shipped' });
    const deliveredOrders = await Order.countDocuments({ vendorId, status: 'delivered' });

    res.json({
      salesByDay: Object.values(salesByDay),
      topProducts,
      lowStock,
      orderBreakdown: { total: totalOrders, pending: pendingOrders, shipped: shippedOrders, delivered: deliveredOrders },
      totalEarnings: vendor.totalEarnings,
      totalSales: vendor.totalSales
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PRODUCT REVIEWS ─────────────────────────────────────────────────────────

const reviewSchema = new mongoose.Schema({
  productId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  vendorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  customerName: { type: String, required: true },
  customerEmail: { type: String },
  rating:     { type: Number, required: true, min: 1, max: 5 },
  comment:    { type: String },
  verified:   { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now }
});
const Review = mongoose.model('Review', reviewSchema);

// Submit a review
app.post('/api/products/:id/reviews', async (req, res) => {
  const { customerName, customerEmail, rating, comment } = req.body;
  if (!customerName || !rating) return res.status(400).json({ error: 'Name and rating required' });

  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const review = await Review.create({
      productId: req.params.id,
      vendorId: product.vendorId,
      customerName,
      customerEmail,
      rating,
      comment
    });

    // Update product avg rating
    const allReviews = await Review.find({ productId: req.params.id });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    await Product.findByIdAndUpdate(req.params.id, { rating: Math.round(avgRating * 10) / 10, reviews: allReviews.length });

    res.json({ success: true, review });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get reviews for a product
app.get('/api/products/:id/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({ productId: req.params.id }).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vendor views all reviews for their products
app.get('/api/vendor/reviews', verifyVendor, async (req, res) => {
  try {
    const reviews = await Review.find({ vendorId: req.vendorId }).sort({ createdAt: -1 }).limit(50);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vendor replies to a review (stored as a field)
app.put('/api/vendor/reviews/:id/reply', verifyVendor, async (req, res) => {
  const { reply } = req.body;
  try {
    const review = await Review.findById(req.params.id);
    if (!review || review.vendorId.toString() !== req.vendorId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    review.set('reply', reply);
    await review.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── VENDOR PAYOUT SUMMARY ───────────────────────────────────────────────────

app.get('/api/vendor/payouts', verifyVendor, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendorId);
    const deliveredOrders = await Order.find({ vendorId: req.vendorId, status: 'delivered' }).sort({ createdAt: -1 }).limit(20);
    const pendingEarnings = await Order.aggregate([
      { $match: { vendorId: new mongoose.Types.ObjectId(req.vendorId), status: { $in: ['pending', 'shipped'] } } },
      { $group: { _id: null, total: { $sum: '$vendorEarnings' } } }
    ]);
    res.json({
      totalEarnings: vendor.totalEarnings,
      pendingEarnings: pendingEarnings[0]?.total || 0,
      recentPayouts: deliveredOrders.map(o => ({
        orderId: o.orderId,
        amount: o.vendorEarnings,
        date: o.createdAt,
        status: 'paid'
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUBLIC VENDOR STORE PAGE ────────────────────────────────────────────────

app.get('/api/vendors/:id/store', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id).select('-password');
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    const products = await Product.find({ vendorId: req.params.id });
    const reviews = await Review.find({ vendorId: req.params.id }).sort({ createdAt: -1 }).limit(10);
    res.json({ vendor, products, reviews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── BULK PRODUCT ACTIONS ────────────────────────────────────────────────────

// Duplicate a product
app.post('/api/products/:id/duplicate', verifyVendor, async (req, res) => {
  try {
    const original = await Product.findById(req.params.id);
    if (!original || original.vendorId.toString() !== req.vendorId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const copy = original.toObject();
    delete copy._id;
    copy.name = copy.name + ' (Copy)';
    copy.featured = false;
    copy.createdAt = new Date();
    const newProduct = await Product.create(copy);
    res.json({ success: true, product: newProduct });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle featured
app.put('/api/products/:id/feature', verifyVendor, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.vendorId.toString() !== req.vendorId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    product.featured = !product.featured;
    await product.save();
    res.json({ success: true, featured: product.featured });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STOCK MANAGEMENT ────────────────────────────────────────────────────────

const stockLogSchema = new mongoose.Schema({
  productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  vendorId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  type:        { type: String, enum: ['opening','add','remove','adjustment','sale','return'], required: true },
  qty:         { type: Number, required: true },
  stockBefore: { type: Number },
  stockAfter:  { type: Number },
  note:        { type: String },
  createdAt:   { type: Date, default: Date.now }
});
const StockLog = mongoose.model('StockLog', stockLogSchema);

// Set opening stock for a product
app.post('/api/vendor/stock/opening', verifyVendor, async (req, res) => {
  const { productId, qty, note, lowStockThreshold, sku } = req.body;
  if (!productId || qty === undefined) return res.status(400).json({ error: 'productId and qty required' });
  try {
    const product = await Product.findById(productId);
    if (!product || product.vendorId.toString() !== req.vendorId) return res.status(403).json({ error: 'Unauthorized' });
    const stockBefore = product.stock;
    product.stock = qty;
    product.openingStock = qty;
    if (lowStockThreshold !== undefined) product.lowStockThreshold = lowStockThreshold;
    if (sku) product.sku = sku;
    await product.save();
    await StockLog.create({ productId, vendorId: req.vendorId, type: 'opening', qty, stockBefore, stockAfter: qty, note: note || 'Opening stock set' });
    res.json({ success: true, stock: product.stock });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Stock adjustment (add or remove)
app.post('/api/vendor/stock/adjust', verifyVendor, async (req, res) => {
  const { productId, type, qty, note } = req.body;
  if (!productId || !type || qty === undefined) return res.status(400).json({ error: 'productId, type, qty required' });
  try {
    const product = await Product.findById(productId);
    if (!product || product.vendorId.toString() !== req.vendorId) return res.status(403).json({ error: 'Unauthorized' });
    const stockBefore = product.stock;
    if (type === 'add') product.stock += parseInt(qty);
    else if (type === 'remove') product.stock = Math.max(0, product.stock - parseInt(qty));
    else if (type === 'adjustment') product.stock = parseInt(qty);
    await product.save();
    await StockLog.create({ productId, vendorId: req.vendorId, type, qty, stockBefore, stockAfter: product.stock, note });
    // Push low stock notification if needed
    if (product.stock <= product.lowStockThreshold) {
      await Vendor.findByIdAndUpdate(req.vendorId, { $push: { notifications: { message: `⚠️ Low stock: "${product.name}" has only ${product.stock} left`, type: 'low_stock' } } });
    }
    res.json({ success: true, stock: product.stock });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get stock history for a product
app.get('/api/vendor/stock/:productId/history', verifyVendor, async (req, res) => {
  try {
    const logs = await StockLog.find({ productId: req.params.productId, vendorId: req.vendorId }).sort({ createdAt: -1 }).limit(50);
    res.json(logs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get full stock overview for vendor
app.get('/api/vendor/stock', verifyVendor, async (req, res) => {
  try {
    const products = await Product.find({ vendorId: req.vendorId }).select('name stock openingStock lowStockThreshold sku image category');
    res.json(products.map(p => ({ ...p.toObject(), status: p.stock === 0 ? 'out' : p.stock <= p.lowStockThreshold ? 'low' : 'ok' })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DISCOUNT CODES ──────────────────────────────────────────────────────────

const couponSchema = new mongoose.Schema({
  vendorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  code:       { type: String, required: true, uppercase: true },
  type:       { type: String, enum: ['percent','fixed'], required: true },
  value:      { type: Number, required: true },
  minOrder:   { type: Number, default: 0 },
  maxUses:    { type: Number, default: 0 },
  usedCount:  { type: Number, default: 0 },
  expiresAt:  { type: Date },
  active:     { type: Boolean, default: true },
  createdAt:  { type: Date, default: Date.now }
});
const Coupon = mongoose.model('Coupon', couponSchema);

app.post('/api/vendor/coupons', verifyVendor, async (req, res) => {
  const { code, type, value, minOrder, maxUses, expiresAt } = req.body;
  if (!code || !type || !value) return res.status(400).json({ error: 'code, type, value required' });
  try {
    const existing = await Coupon.findOne({ vendorId: req.vendorId, code: code.toUpperCase() });
    if (existing) return res.status(400).json({ error: 'Coupon code already exists' });
    const coupon = await Coupon.create({ vendorId: req.vendorId, code: code.toUpperCase(), type, value, minOrder, maxUses, expiresAt });
    res.json({ success: true, coupon });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/vendor/coupons', verifyVendor, async (req, res) => {
  try {
    const coupons = await Coupon.find({ vendorId: req.vendorId }).sort({ createdAt: -1 });
    res.json(coupons);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/vendor/coupons/:id', verifyVendor, async (req, res) => {
  try {
    await Coupon.findOneAndDelete({ _id: req.params.id, vendorId: req.vendorId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/vendor/coupons/:id/toggle', verifyVendor, async (req, res) => {
  try {
    const coupon = await Coupon.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!coupon) return res.status(404).json({ error: 'Not found' });
    coupon.active = !coupon.active;
    await coupon.save();
    res.json({ success: true, active: coupon.active });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Public: validate coupon at checkout
app.post('/api/coupons/validate', async (req, res) => {
  const { code, subtotal } = req.body;
  try {
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), active: true });
    if (!coupon) return res.status(404).json({ error: 'Invalid or expired coupon' });
    if (coupon.expiresAt && new Date() > coupon.expiresAt) return res.status(400).json({ error: 'Coupon has expired' });
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) return res.status(400).json({ error: 'Coupon usage limit reached' });
    if (subtotal < coupon.minOrder) return res.status(400).json({ error: `Minimum order ${coupon.minOrder} required` });
    const discount = coupon.type === 'percent' ? (subtotal * coupon.value / 100) : coupon.value;
    res.json({ success: true, coupon: { code: coupon.code, type: coupon.type, value: coupon.value, discount: Math.min(discount, subtotal) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PRODUCT VARIANTS ────────────────────────────────────────────────────────

app.put('/api/products/:id/variants', verifyVendor, async (req, res) => {
  const { variants } = req.body;
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.vendorId.toString() !== req.vendorId) return res.status(403).json({ error: 'Unauthorized' });
    product.variants = variants;
    await product.save();
    res.json({ success: true, variants: product.variants });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

app.get('/api/vendor/notifications', verifyVendor, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendorId);
    const notifications = (vendor.notifications || []).slice(-30).reverse();
    res.json(notifications);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/vendor/notifications/read', verifyVendor, async (req, res) => {
  try {
    await Vendor.findByIdAndUpdate(req.vendorId, { $set: { 'notifications.$[].read': true } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── CSV BULK IMPORT ─────────────────────────────────────────────────────────

app.post('/api/vendor/products/bulk-import', verifyVendor, async (req, res) => {
  const { rows } = req.body; // array of product objects parsed from CSV on frontend
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'No rows provided' });
  try {
    const vendor = await Vendor.findById(req.vendorId);
    const products = rows.map(r => ({
      vendorId: req.vendorId,
      vendorName: vendor.storeName,
      name: r.name, description: r.description || '',
      price: parseFloat(r.price) || 0, originalPrice: r.originalPrice ? parseFloat(r.originalPrice) : undefined,
      category: r.category || 'other', stock: parseInt(r.stock) || 0,
      sku: r.sku || '', image: r.image || '📦',
      tags: r.tags ? r.tags.split('|').map(t => t.trim()) : []
    })).filter(p => p.name && p.price > 0);
    const inserted = await Product.insertMany(products);
    res.json({ success: true, imported: inserted.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PREMIUM: ADVANCED SALES REPORTS ─────────────────────────────────────────

app.get('/api/vendor/reports/advanced', verifyVendor, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendorId);
    if (vendor.plan !== 'premium') return res.status(403).json({ error: 'premium_required', message: 'Upgrade to Premium to access advanced reports' });

    const { period = '30' } = req.query;
    const days = parseInt(period);
    const from = new Date(); from.setDate(from.getDate() - days);

    const orders = await Order.find({ vendorId: req.vendorId, createdAt: { $gte: from } }).sort({ createdAt: 1 });

    // Revenue by day
    const revenueByDay = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      revenueByDay[d.toISOString().slice(0, 10)] = 0;
    }
    orders.forEach(o => {
      const key = o.createdAt.toISOString().slice(0, 10);
      if (revenueByDay[key] !== undefined) revenueByDay[key] += o.vendorEarnings || 0;
    });

    // Revenue by category (via product lookup)
    const productIds = [...new Set(orders.flatMap(o => (o.items || []).map(i => i.productId?.toString())))].filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } }).select('_id category name price');
    const prodMap = {};
    products.forEach(p => { prodMap[p._id.toString()] = p; });

    const revenueByCategory = {};
    orders.forEach(o => {
      (o.items || []).forEach(item => {
        const p = prodMap[item.productId?.toString()];
        if (p) {
          revenueByCategory[p.category] = (revenueByCategory[p.category] || 0) + (item.price * item.quantity);
        }
      });
    });

    const totalRevenue = orders.reduce((s, o) => s + (o.vendorEarnings || 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders ? (totalRevenue / totalOrders) : 0;
    const platformFeesPaid = orders.reduce((s, o) => s + (o.platformFee || 0), 0);

    res.json({
      period: days,
      totalRevenue, totalOrders, avgOrderValue, platformFeesPaid,
      revenueByDay: Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue })),
      revenueByCategory: Object.entries(revenueByCategory).map(([cat, rev]) => ({ category: cat, revenue: rev }))
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PREMIUM: PROMOTED LISTINGS ───────────────────────────────────────────────

app.post('/api/vendor/promote', verifyVendor, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendorId);
    if (vendor.plan !== 'premium') return res.status(403).json({ error: 'premium_required', message: 'Upgrade to Premium to promote listings' });
    const { productId, days, budget } = req.body;
    if (!productId || !days) return res.status(400).json({ error: 'productId and days required' });
    const product = await Product.findById(productId);
    if (!product || product.vendorId.toString() !== req.vendorId) return res.status(403).json({ error: 'Unauthorized' });
    const until = new Date();
    until.setDate(until.getDate() + parseInt(days));
    product.sponsored = true;
    product.sponsoredUntil = until;
    product.sponsoredBudget = budget || 0;
    await product.save();
    res.json({ success: true, sponsoredUntil: until });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Public: get promoted/sponsored products
app.get('/api/products/sponsored', async (req, res) => {
  try {
    const now = new Date();
    const products = await Product.find({ sponsored: true, sponsoredUntil: { $gte: now } }).limit(8);
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Upgrade to premium (demo - in real life Stripe would gate this)
app.post('/api/vendor/upgrade', verifyVendor, async (req, res) => {
  try {
    await Vendor.findByIdAndUpdate(req.vendorId, { plan: 'premium' });
    res.json({ success: true, message: 'Upgraded to Premium! All premium features are now unlocked.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SPA Fallback ─────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────

// ─── ORDER TRACKING (PUBLIC) ─────────────────────────────────────────────────
app.get('/api/orders/track', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Provide order ID or email' });
  try {
    const isEmail = q.includes('@');
    let orders;
    if (isEmail) {
      orders = await Order.find({ email: q.toLowerCase() }).sort({ createdAt: -1 }).limit(5);
    } else {
      orders = await Order.find({ orderId: q }).limit(1);
    }
    if (!orders || !orders.length) return res.status(404).json({ error: 'No order found. Check your order ID or email.' });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SPONSORED PRODUCTS (PUBLIC) ────────────────────────────────────────────
app.get('/api/products/sponsored', async (req, res) => {
  try {
    const now = new Date();
    const sponsored = await Product.find({ sponsored: true, sponsoredUntil: { $gte: now } }).limit(4);
    res.json(sponsored);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 VelocityMark Marketplace running on port ${PORT}`);
  console.log(`📦 Multi-vendor platform - Created by Mr Ntando Ofc`);
});
