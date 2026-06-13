import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Stripe from 'stripe';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URL;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || 'sk_test_demo';

const stripe = new Stripe(STRIPE_SECRET);

// ─── MongoDB Models ───────────────────────────────────────────────────────────

const productSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String },
  price:       { type: Number, required: true },
  originalPrice: { type: Number },
  category:    { type: String },
  image:       { type: String },
  stock:       { type: Number, default: 999 },
  rating:      { type: Number, default: 4.5 },
  reviews:     { type: Number, default: 0 },
  featured:    { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
  orderId:     { type: String, unique: true },
  customerId:  { type: String },
  items:       [{
    productId: String,
    name:      String,
    price:     Number,
    quantity:  Number
  }],
  total:       { type: Number },
  status:      { type: String, default: 'pending' }, // pending, paid, shipped, delivered
  email:       String,
  shippingAddress: String,
  stripePaymentId: String,
  createdAt:   { type: Date, default: Date.now }
});

const subscriberSchema = new mongoose.Schema({
  email:     { type: String, required: true, unique: true, trim: true, lowercase: true },
  createdAt: { type: Date, default: Date.now }
});

const Product    = mongoose.model('Product', productSchema);
const Order      = mongoose.model('Order', orderSchema);
const Subscriber = mongoose.model('Subscriber', subscriberSchema);

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

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    status: 'VelocityMark E-Commerce is running',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────

app.get('/api/products', async (req, res) => {
  try {
    const category = req.query.category;
    const filter = category ? { category } : {};
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/featured-products', async (req, res) => {
  try {
    const products = await Product.find({ featured: true }).limit(8);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CHECKOUT & PAYMENT ───────────────────────────────────────────────────────

app.post('/api/checkout', async (req, res) => {
  const { items, email, name, shippingAddress } = req.body;
  
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  try {
    // Calculate total
    let total = 0;
    items.forEach(item => {
      total += item.price * item.quantity;
    });

    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: { name: item.name },
        unit_amount: Math.round(item.price * 100)
      },
      quantity: item.quantity
    }));

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.DOMAIN || 'https://velocitymark.onrender.com'}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.DOMAIN || 'https://velocitymark.onrender.com'}/checkout`,
      customer_email: email,
      metadata: {
        orderId: `ORD-${Date.now()}`,
        customerName: name,
        shippingAddress: shippingAddress
      }
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders', async (req, res) => {
  const { sessionId, items, email, name, shippingAddress } = req.body;

  try {
    // Verify payment with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Create order
    const order = await Order.create({
      orderId: `ORD-${Date.now()}`,
      customerId: session.customer,
      items,
      total: session.amount_total / 100,
      status: 'paid',
      email,
      shippingAddress,
      stripePaymentId: session.payment_intent
    });

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/order/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── NEWSLETTER ───────────────────────────────────────────────────────────────

app.post('/api/subscribe', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  try {
    await Subscriber.create({ email });
    res.json({ success: true, message: 'Subscribed!' });
  } catch (err) {
    if (err.code === 11000) return res.json({ success: true, message: 'Already subscribed' });
    res.status(500).json({ error: err.message });
  }
});

// ─── SPA Fallback ─────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 VelocityMark E-Commerce running on port ${PORT}`);
  console.log(`👤 Created by Mr Ntando Ofc`);
});
