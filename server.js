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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  rating:         { type: Number, default: 5 },
  reviews:        { type: Number, default: 0 },
  verified:       { type: Boolean, default: false },
  stripeConnectId: { type: String },
  totalSales:     { type: Number, default: 0 },
  totalEarnings:  { type: Number, default: 0 },
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
  stock:          { type: Number, default: 999 },
  rating:         { type: Number, default: 4.5 },
  reviews:        { type: Number, default: 0 },
  featured:       { type: Boolean, default: false },
  tags:           [String],
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
  const { name, description, price, originalPrice, category, stock, tags, image } = req.body;

  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Name, price, and category required' });
  }

  try {
    const vendor = await Vendor.findById(req.vendorId);
    
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
      image: image || '📦'
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

// ─── SPA Fallback ─────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 VelocityMark Marketplace running on port ${PORT}`);
  console.log(`📦 Multi-vendor platform - Created by Mr Ntando Ofc`);
});
