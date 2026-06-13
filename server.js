import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URL;

// ─── MongoDB Models ───────────────────────────────────────────────────────────
const leadSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, trim: true, lowercase: true },
  company:   { type: String, trim: true },
  service:   { type: String },
  budget:    { type: String },
  message:   { type: String, required: true },
  ip:        { type: String },
  createdAt: { type: Date, default: Date.now }
});

const subscriberSchema = new mongoose.Schema({
  email:     { type: String, required: true, unique: true, trim: true, lowercase: true },
  createdAt: { type: Date, default: Date.now }
});

const Lead       = mongoose.model('Lead', leadSchema);
const Subscriber = mongoose.model('Subscriber', subscriberSchema);

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI, { dbName: 'velocitymark' })
    .then(() => console.log('✅ MongoDB connected (velocitymark db)'))
    .catch(err => console.error('⚠️  MongoDB error:', err.message));
} else {
  console.warn('⚠️  No MONGODB_URI — running without database');
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'VelocityMark is running',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// ─── Contact / Lead Capture ───────────────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  const { name, email, company, message, budget, service } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const lead = await Lead.create({
      name, email, company, service, budget, message,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });
    console.log(`New lead: ${name} <${email}>`);
    res.json({ success: true, message: "Thank you! We'll be in touch within 24 hours.", leadId: lead._id });
  } catch (err) {
    console.error('Lead error:', err.message);
    res.status(500).json({ error: 'Could not save lead. Please try again.' });
  }
});

// ─── Newsletter ───────────────────────────────────────────────────────────────
app.post('/api/subscribe', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  try {
    await Subscriber.create({ email });
    res.json({ success: true, message: 'Subscribed! Welcome to VelocityMark.' });
  } catch (err) {
    if (err.code === 11000) return res.json({ success: true, message: "You're already subscribed!" });
    res.status(500).json({ error: 'Subscription failed. Please try again.' });
  }
});

// ─── Admin routes ─────────────────────────────────────────────────────────────
app.get('/api/admin/leads', async (req, res) => {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  const leads = await Lead.find().sort({ createdAt: -1 }).limit(100);
  res.json({ count: leads.length, leads });
});

app.get('/api/admin/subscribers', async (req, res) => {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  const subs = await Subscriber.find().sort({ createdAt: -1 }).limit(200);
  res.json({ count: subs.length, subscribers: subs });
});

// ─── Services ─────────────────────────────────────────────────────────────────
app.get('/api/services', (req, res) => {
  res.json([
    { id: 1, name: 'Digital Strategy Consulting', description: 'Custom marketing strategies for global reach', price: '$2,500+', features: ['Market analysis', 'Competitor research', 'Growth roadmap', '90-day action plan'] },
    { id: 2, name: 'Social Media Management', description: 'Multi-platform content creation & engagement', price: '$1,500+', features: ['Content calendar', 'Daily posting', 'Community management', 'Analytics reporting'] },
    { id: 3, name: 'SEO & Content Marketing', description: 'Organic growth through premium content', price: '$1,800+', features: ['Keyword research', 'On-page SEO', 'Content creation', 'Link building'] },
    { id: 4, name: 'PPC Advertising', description: 'Paid campaigns across Google, Facebook, LinkedIn', price: '$3,000+', features: ['Campaign setup', 'A/B testing', 'Lead optimization', 'ROI tracking'] },
    { id: 5, name: 'Email Marketing', description: 'Automated email campaigns & nurture sequences', price: '$1,200+', features: ['Template design', 'List segmentation', 'Automation workflows', 'Performance analytics'] },
    { id: 6, name: 'Brand Development', description: 'Complete brand identity & positioning', price: '$4,000+', features: ['Logo design', 'Brand guide', 'Messaging framework', 'Visual identity'] }
  ]);
});

// ─── Case Studies ─────────────────────────────────────────────────────────────
app.get('/api/case-studies', (req, res) => {
  res.json([
    { id: 1, title: 'E-Commerce Growth: 340% Revenue Increase', client: 'TechStore Inc', industry: 'Retail', result: '$2.1M additional revenue in 6 months', services: ['PPC Advertising', 'SEO', 'Conversion Optimization'] },
    { id: 2, title: 'B2B Lead Generation: 2,500+ Qualified Leads', client: 'CloudSoft Solutions', industry: 'SaaS', result: '450% ROI on marketing spend', services: ['LinkedIn Advertising', 'Content Marketing', 'Email Campaigns'] },
    { id: 3, title: 'Brand Relaunch: Market Leadership in 90 Days', client: 'Heritage Brands Ltd', industry: 'Consumer Goods', result: 'Brand awareness +210%, sales +125%', services: ['Brand Strategy', 'Social Media', 'PR & Partnerships'] }
  ]);
});

// ─── Team ─────────────────────────────────────────────────────────────────────
app.get('/api/team', (req, res) => {
  res.json([
    { id: 1, name: 'Mr Ntando Ofc', role: 'Founder & Chief Strategy Officer', expertise: '15+ years in digital marketing & global expansion', image: '👨‍💼' },
    { id: 2, name: 'Strategy Team', role: 'Marketing Consultants', expertise: 'Market analysis, competitive positioning, growth planning', image: '👥' },
    { id: 3, name: 'Execution Team', role: 'Digital Marketers & Specialists', expertise: 'PPC, SEO, social media, content, analytics', image: '⚙️' },
    { id: 4, name: 'Creative Team', role: 'Designers & Content Creators', expertise: 'Brand design, copywriting, video production', image: '🎨' }
  ]);
});

// ─── SPA Fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 VelocityMark running on port ${PORT}`);
  console.log(`👤 Created by Mr Ntando Ofc`);
});
