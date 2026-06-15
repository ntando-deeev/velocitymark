// ═══════════════════════════════════════════════════════════════════════════
//  VELOCITYMARK — EXTENDED FEATURES
//  ⚡ Velocity Badge · Loyalty Points · Referral · Recently Viewed
//  Price Drop Alerts · Product Q&A · Photo Reviews · Bundle Deals
//  WhatsApp · Dispute Center · Report Listing · Flash Sale Timers
//  Multi-Currency · Buyer Protection · Mr Ntando Ofc Dev Badge
// ═══════════════════════════════════════════════════════════════════════════

// ── STATE ─────────────────────────────────────────────────────────────────────
let recentlyViewed = [];
let loyaltyPoints = 0;
let reviewRatingVal = 5;
let selectedBundleItems = [];
let activeFlashTimers = {};

try { recentlyViewed = JSON.parse(localStorage.getItem('vm_recently_viewed')) || []; } catch(e) { recentlyViewed = []; }
try { loyaltyPoints = parseInt(localStorage.getItem('vm_loyalty_points')) || 0; } catch(e) { loyaltyPoints = 0; }

// ── CURRENCIES ────────────────────────────────────────────────────────────────
const CURRENCIES = {
  USD: { symbol: '$', rate: 1 },
  NGN: { symbol: '₦', rate: 1580 },
  KES: { symbol: 'KSh', rate: 129 },
  ZAR: { symbol: 'R', rate: 18.5 },
  GHS: { symbol: '₵', rate: 15.8 },
  EUR: { symbol: '€', rate: 0.92 },
  GBP: { symbol: '£', rate: 0.79 },
};
let activeCurrency = localStorage.getItem('vm_currency') || 'USD';

function formatCurrency(usdPrice) {
  const c = CURRENCIES[activeCurrency] || CURRENCIES.USD;
  const converted = (usdPrice * c.rate).toFixed(activeCurrency === 'USD' ? 2 : 0);
  return `${c.symbol}${Number(converted).toLocaleString()}`;
}

function injectCurrencySelector() {
  if (document.getElementById('currencySelector')) return;
  const sel = document.createElement('div');
  sel.id = 'currencySelector';
  sel.className = 'currency-selector';
  sel.innerHTML = `<select onchange="changeCurrency(this.value)" title="Currency">
    ${Object.keys(CURRENCIES).map(k => `<option value="${k}"${k===activeCurrency?' selected':''}>${k}</option>`).join('')}
  </select>`;
  const navMenu = document.getElementById('navMenu');
  if (navMenu) {
    const li = document.createElement('li');
    li.appendChild(sel);
    navMenu.insertBefore(li, navMenu.lastElementChild);
  }
}

function changeCurrency(code) {
  activeCurrency = code;
  localStorage.setItem('vm_currency', code);
  // Re-render products with new currency
  if (typeof renderProducts === 'function' && window.allProducts) renderProducts(window.allProducts);
  showToast(`Currency set to ${code}`, 'success');
}

// ── RECENTLY VIEWED ───────────────────────────────────────────────────────────
function trackRecentlyViewed(product) {
  if (!product || !product._id) return;
  recentlyViewed = recentlyViewed.filter(p => p._id !== product._id);
  recentlyViewed.unshift(product);
  if (recentlyViewed.length > 20) recentlyViewed = recentlyViewed.slice(0, 20);
  localStorage.setItem('vm_recently_viewed', JSON.stringify(recentlyViewed));
}

function openRecentlyViewed() {
  const panel = document.getElementById('recentlyViewedPanel');
  const overlay = document.getElementById('sidebarOverlay');
  if (!panel) return;
  const list = document.getElementById('recentlyViewedList');
  if (!recentlyViewed.length) {
    list.innerHTML = '<p style="color:var(--text-muted);padding:1rem;text-align:center">No recently viewed products yet.</p>';
  } else {
    list.innerHTML = recentlyViewed.map(p => `
      <div class="sidebar-product-item" onclick="openProduct('${p._id}');closeRecentlyViewed()">
        <div class="spi-img">${p.image && p.image.startsWith('http') ? `<img src="${p.image}" alt="${p.name}">` : '📦'}</div>
        <div class="spi-info">
          <div class="spi-name">${p.name}</div>
          <div class="spi-price" style="color:var(--accent)">$${Number(p.price).toFixed(2)}</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();addToCart(${JSON.stringify(p).replace(/"/g,'&quot;')});closeRecentlyViewed()">Add</button>
      </div>`).join('');
  }
  panel.classList.add('open');
  overlay.classList.add('open');
}

function closeRecentlyViewed() {
  document.getElementById('recentlyViewedPanel')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}

// ── LOYALTY POINTS ────────────────────────────────────────────────────────────
function addLoyaltyPoints(pts, reason) {
  loyaltyPoints += pts;
  localStorage.setItem('vm_loyalty_points', loyaltyPoints);
  showToast(`+${pts} loyalty points earned! (${reason})`, 'success');
  updateLoyaltyUI();
  saveLoyaltyHistory(pts, reason);
}

function saveLoyaltyHistory(pts, reason) {
  let history = [];
  try { history = JSON.parse(localStorage.getItem('vm_loyalty_history')) || []; } catch(e) {}
  history.unshift({ pts, reason, date: new Date().toLocaleDateString() });
  if (history.length > 50) history = history.slice(0, 50);
  localStorage.setItem('vm_loyalty_history', JSON.stringify(history));
}

function updateLoyaltyUI() {
  const v = document.getElementById('loyaltyPointsVal');
  const d = document.getElementById('loyaltyDollarVal');
  if (v) v.textContent = loyaltyPoints.toLocaleString();
  if (d) d.textContent = (loyaltyPoints / 100).toFixed(2);
}

function openLoyaltyPanel() {
  const panel = document.getElementById('loyaltyPanel');
  const overlay = document.getElementById('sidebarOverlay');
  if (!panel) return;
  updateLoyaltyUI();
  // Render history
  let history = [];
  try { history = JSON.parse(localStorage.getItem('vm_loyalty_history')) || []; } catch(e) {}
  const histEl = document.getElementById('loyaltyHistory');
  if (histEl) {
    histEl.innerHTML = history.length ? `<h4 style="margin-bottom:.75rem">History</h4>` + history.slice(0,10).map(h =>
      `<div class="loyalty-hist-item"><span style="color:var(--accent)">+${h.pts} pts</span><span>${h.reason}</span><small style="color:var(--text-muted)">${h.date}</small></div>`
    ).join('') : '';
  }
  panel.classList.add('open');
  overlay.classList.add('open');
}

function closeLoyaltyPanel() {
  document.getElementById('loyaltyPanel')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}

function redeemLoyaltyPoints() {
  if (loyaltyPoints < 500) {
    showToast('You need at least 500 points to redeem.', 'error');
    return;
  }
  const redeem = Math.floor(loyaltyPoints / 100) * 100;
  const credit = (redeem / 100).toFixed(2);
  loyaltyPoints -= redeem;
  localStorage.setItem('vm_loyalty_points', loyaltyPoints);
  localStorage.setItem('vm_loyalty_credit', credit);
  showToast(`$${credit} store credit applied to your next checkout!`, 'success');
  updateLoyaltyUI();
  closeLoyaltyPanel();
}

// ── REFERRAL PROGRAM ──────────────────────────────────────────────────────────
function initReferral() {
  let refCode = localStorage.getItem('vm_ref_code');
  if (!refCode) {
    refCode = 'VM' + Math.random().toString(36).substr(2, 8).toUpperCase();
    localStorage.setItem('vm_ref_code', refCode);
  }
  const input = document.getElementById('referralLinkInput');
  if (input) input.value = `https://vmarket.kozow.com/?ref=${refCode}`;
  // Check if arrived via referral
  const params = new URLSearchParams(window.location.search);
  const incomingRef = params.get('ref');
  if (incomingRef && incomingRef !== refCode) {
    localStorage.setItem('vm_referred_by', incomingRef);
    showToast("You've been referred! Complete your first purchase for $5 bonus credit.", 'info');
  }
  // Stats
  const refCount = parseInt(localStorage.getItem('vm_ref_count') || '0');
  const refEarned = parseFloat(localStorage.getItem('vm_ref_earned') || '0');
  const rc = document.getElementById('refCount');
  const re = document.getElementById('refEarned');
  if (rc) rc.textContent = refCount;
  if (re) re.textContent = `$${refEarned.toFixed(2)}`;
}

function copyReferralLink() {
  const input = document.getElementById('referralLinkInput');
  if (!input) return;
  navigator.clipboard.writeText(input.value).then(() => showToast('Referral link copied!', 'success'));
}

function shareReferralWhatsApp() {
  const input = document.getElementById('referralLinkInput');
  const link = input ? input.value : 'https://vmarket.kozow.com';
  const msg = encodeURIComponent(`🛍️ Join me on VelocityMark — the marketplace that moves at your speed! Use my link and we both earn $5 store credit: ${link}`);
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

function shareReferralNative() {
  const input = document.getElementById('referralLinkInput');
  const link = input ? input.value : 'https://vmarket.kozow.com';
  if (navigator.share) {
    navigator.share({ title: 'VelocityMark', text: 'Join VelocityMark — earn $5 when you sign up!', url: link });
  } else {
    navigator.clipboard.writeText(link).then(() => showToast('Link copied!', 'success'));
  }
}

// ── PRICE DROP ALERTS ─────────────────────────────────────────────────────────
function openPriceAlert(productId, productName, currentPrice) {
  document.getElementById('priceAlertProductId').value = productId;
  document.getElementById('priceAlertProductName').textContent = productName || 'this product';
  const threshEl = document.getElementById('priceAlertThreshold');
  if (threshEl) threshEl.placeholder = `e.g. ${(currentPrice * 0.8).toFixed(2)}`;
  showModal('priceAlertModal');
}

async function savePriceAlert(e) {
  e.preventDefault();
  const email = document.getElementById('priceAlertEmail').value;
  const productId = document.getElementById('priceAlertProductId').value;
  const threshold = document.getElementById('priceAlertThreshold').value;
  // Save locally (in production this would POST to /api/price-alerts)
  let alerts = [];
  try { alerts = JSON.parse(localStorage.getItem('vm_price_alerts')) || []; } catch(ex) {}
  alerts.push({ productId, email, threshold: threshold || null, createdAt: new Date().toISOString() });
  localStorage.setItem('vm_price_alerts', JSON.stringify(alerts));
  try {
    await fetch('/api/price-alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, email, threshold })
    });
  } catch(ex) {}
  showToast('Price alert set! We\'ll email you when the price drops.', 'success');
  closeModal('priceAlertModal');
}

// ── PRODUCT Q&A ───────────────────────────────────────────────────────────────
async function openQA(productId) {
  document.getElementById('qaProductId').value = productId;
  // Load existing Q&A
  const list = document.getElementById('qaList');
  list.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem">Loading questions...</p>';
  showModal('qaModal');
  try {
    const res = await fetch(`/api/products/${productId}/qa`);
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.qa || []);
    if (!items.length) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;text-align:center">No questions yet. Be the first to ask!</p>';
    } else {
      list.innerHTML = items.map(q => `
        <div class="qa-item">
          <div class="qa-question"><strong>Q:</strong> ${q.question} <small style="color:var(--text-muted)">— ${q.askedBy || 'Anonymous'}</small></div>
          ${q.answer ? `<div class="qa-answer"><strong style="color:var(--accent)">A:</strong> ${q.answer}</div>` : '<div class="qa-answer qa-pending">Answer pending from seller</div>'}
        </div>`).join('');
    }
  } catch(ex) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;text-align:center">Could not load questions.</p>';
  }
}

async function submitQuestion(e) {
  e.preventDefault();
  const productId = document.getElementById('qaProductId').value;
  const question = document.getElementById('qaQuestion').value;
  const name = document.getElementById('qaName').value;
  const email = document.getElementById('qaEmail').value;
  try {
    await fetch(`/api/products/${productId}/qa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, askedBy: name, email })
    });
  } catch(ex) {}
  showToast('Question submitted! The seller will be notified.', 'success');
  closeModal('qaModal');
  e.target.reset();
}

// ── PHOTO REVIEWS ─────────────────────────────────────────────────────────────
function setRating(n) {
  reviewRatingVal = n;
  document.getElementById('reviewRating').value = n;
  const stars = document.querySelectorAll('.star-btn');
  stars.forEach((s, i) => s.classList.toggle('active', i < n));
}

function previewReviewPhoto(input) {
  const preview = document.getElementById('reviewPhotoPreview');
  if (!input.files || !input.files[0]) { preview.innerHTML = ''; return; }
  const reader = new FileReader();
  reader.onload = e => { preview.innerHTML = `<img src="${e.target.result}" style="max-width:120px;border-radius:8px;margin-top:.5rem">`; };
  reader.readAsDataURL(input.files[0]);
}

function openReview(productId, productName) {
  document.getElementById('reviewProductId').value = productId;
  setRating(5);
  showModal('reviewModal');
}

async function submitReview(e) {
  e.preventDefault();
  const productId = document.getElementById('reviewProductId').value;
  const rating = parseInt(document.getElementById('reviewRating').value);
  const text = document.getElementById('reviewText').value;
  const name = document.getElementById('reviewName').value;
  const photoInput = document.getElementById('reviewPhotoInput');
  let photoUrl = null;
  // Upload photo if provided
  if (photoInput.files && photoInput.files[0] && vendorToken) {
    try {
      const fd = new FormData();
      fd.append('image', photoInput.files[0]);
      const res = await fetch('/api/upload/image', { method: 'POST', headers: { Authorization: `Bearer ${vendorToken}` }, body: fd });
      const d = await res.json();
      if (d.success) photoUrl = d.url;
    } catch(ex) {}
  }
  try {
    await fetch(`/api/products/${productId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, text, reviewerName: name, photo: photoUrl })
    });
  } catch(ex) {}
  // Award loyalty points
  addLoyaltyPoints(50, 'Review submitted');
  showToast('Review submitted! +50 loyalty points earned.', 'success');
  closeModal('reviewModal');
  e.target.reset();
  document.getElementById('reviewPhotoPreview').innerHTML = '';
}

// ── BUNDLE DEALS ──────────────────────────────────────────────────────────────
function openBundleDeal(vendorId, vendorName) {
  if (!window.allProducts) { showToast('Loading products...', 'info'); return; }
  const vendorProducts = allProducts.filter(p => p.vendorId === vendorId || p.vendorName === vendorName);
  if (vendorProducts.length < 2) { showToast('This seller needs 2+ products for bundle deals.', 'info'); return; }
  selectedBundleItems = [];
  const list = document.getElementById('bundleProductList');
  list.innerHTML = vendorProducts.map(p => `
    <div class="bundle-item" id="bundle-${p._id}">
      <input type="checkbox" onchange="toggleBundleItem('${p._id}',${p.price},'${p.name.replace(/'/g,'\\\'')}')" id="bchk-${p._id}">
      <label for="bchk-${p._id}" style="display:flex;align-items:center;gap:.75rem;cursor:pointer">
        <div style="width:40px;height:40px;border-radius:8px;background:var(--bg-card);display:flex;align-items:center;justify-content:center;font-size:1.2rem;overflow:hidden;flex-shrink:0">
          ${p.image && p.image.startsWith('http') ? `<img src="${p.image}" style="width:100%;height:100%;object-fit:cover">` : '📦'}
        </div>
        <div>
          <div style="font-size:.9rem;font-weight:500">${p.name}</div>
          <div style="color:var(--accent);font-size:.85rem">$${Number(p.price).toFixed(2)}</div>
        </div>
      </label>
    </div>`).join('');
  updateBundleSummary();
  showModal('bundleModal');
}

function toggleBundleItem(id, price, name) {
  const idx = selectedBundleItems.findIndex(i => i.id === id);
  if (idx > -1) selectedBundleItems.splice(idx, 1);
  else selectedBundleItems.push({ id, price, name });
  updateBundleSummary();
}

function updateBundleSummary() {
  const el = document.getElementById('bundleSummary');
  if (!el) return;
  const count = selectedBundleItems.length;
  const subtotal = selectedBundleItems.reduce((s, i) => s + i.price, 0);
  const discount = count >= 2 ? subtotal * 0.10 : 0;
  const total = subtotal - discount;
  el.innerHTML = count < 2
    ? `<p style="color:var(--text-muted);font-size:.85rem">Select at least 2 items to unlock the bundle discount.</p>`
    : `<div class="bundle-total">
        <span>${count} items selected</span>
        ${discount > 0 ? `<span style="color:#22c55e">-10% discount: -$${discount.toFixed(2)}</span>` : ''}
        <strong>Total: $${total.toFixed(2)}</strong>
       </div>`;
}

function addBundleToCart() {
  if (selectedBundleItems.length < 2) { showToast('Select at least 2 items for a bundle deal.', 'error'); return; }
  const discount = 0.10;
  selectedBundleItems.forEach(item => {
    const product = allProducts.find(p => p._id === item.id);
    if (product) {
      const discountedProduct = { ...product, price: +(product.price * (1 - discount)).toFixed(2), bundleDeal: true };
      if (typeof addToCart === 'function') addToCart(discountedProduct);
    }
  });
  showToast(`Bundle added! 10% discount applied on ${selectedBundleItems.length} items.`, 'success');
  closeModal('bundleModal');
}

// ── WHATSAPP INTEGRATION ──────────────────────────────────────────────────────
function openWhatsAppChat(whatsapp, sellerName, productName) {
  if (!whatsapp) { showToast('This seller has not linked a WhatsApp number.', 'info'); return; }
  const number = whatsapp.replace(/\D/g, '');
  const msg = encodeURIComponent(`Hi ${sellerName}, I'm interested in "${productName}" listed on VelocityMark. Can you tell me more?`);
  document.getElementById('whatsappSellerName').textContent = `Contact ${sellerName} directly via WhatsApp.`;
  document.getElementById('whatsappLink').href = `https://wa.me/${number}?text=${msg}`;
  showModal('whatsappModal');
}

// ── DISPUTE CENTER ────────────────────────────────────────────────────────────
async function submitDispute(e) {
  e.preventDefault();
  const payload = {
    orderId: document.getElementById('disputeOrderId').value,
    type: document.getElementById('disputeType').value,
    description: document.getElementById('disputeDesc').value,
    email: document.getElementById('disputeEmail').value,
  };
  try {
    await fetch('/api/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch(ex) {}
  showToast('Dispute submitted. Our team will contact you within 24 hours.', 'success');
  closeModal('disputeModal');
  e.target.reset();
}

// ── REPORT LISTING ────────────────────────────────────────────────────────────
function openReportModal(productId) {
  document.getElementById('reportProductId').value = productId;
  showModal('reportModal');
}

async function submitReport(e) {
  e.preventDefault();
  const payload = {
    productId: document.getElementById('reportProductId').value,
    reason: document.getElementById('reportReason').value,
    details: document.getElementById('reportDetails').value,
    email: document.getElementById('reportEmail').value,
  };
  try {
    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch(ex) {}
  showToast('Report submitted. Thank you for keeping VelocityMark safe.', 'success');
  closeModal('reportModal');
  e.target.reset();
}

// ── FLASH SALE TIMER ──────────────────────────────────────────────────────────
function startFlashTimer(elementId, endTimeISO) {
  if (activeFlashTimers[elementId]) clearInterval(activeFlashTimers[elementId]);
  function tick() {
    const el = document.getElementById(elementId);
    if (!el) { clearInterval(activeFlashTimers[elementId]); return; }
    const diff = new Date(endTimeISO) - new Date();
    if (diff <= 0) { el.textContent = 'Sale Ended'; clearInterval(activeFlashTimers[elementId]); return; }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  tick();
  activeFlashTimers[elementId] = setInterval(tick, 1000);
}

function flashSaleTimerHTML(productId, endTime) {
  if (!endTime) return '';
  const timerId = `flash-${productId}`;
  setTimeout(() => startFlashTimer(timerId, endTime), 0);
  return `<div class="flash-sale-tag">⚡ Flash Sale <span id="${timerId}" class="flash-countdown">--:--:--</span></div>`;
}

// ── BUYER PROTECTION BADGE ────────────────────────────────────────────────────
function injectBuyerProtectionBadge() {
  const cartFooter = document.getElementById('cartFooter');
  if (!cartFooter || document.getElementById('buyerProtectionBadge')) return;
  const badge = document.createElement('div');
  badge.id = 'buyerProtectionBadge';
  badge.className = 'buyer-protection-badge';
  badge.innerHTML = `
    <div class="bpb-inner">
      <span class="bpb-icon">🛡️</span>
      <div class="bpb-text">
        <strong>Buyer Protection Guarantee</strong>
        <span>Full refund if item not received or not as described</span>
      </div>
    </div>`;
  cartFooter.parentNode.insertBefore(badge, cartFooter);
}

// ── VELOCITY BADGE AUTO-APPLY ─────────────────────────────────────────────────
// Called on vendor registration — badge is always awarded free
function awardVelocityBadge(vendorId) {
  const badges = JSON.parse(localStorage.getItem('vm_vendor_badges') || '{}');
  badges[vendorId] = { verified: true, awardedAt: new Date().toISOString(), type: 'velocity' };
  localStorage.setItem('vm_vendor_badges', JSON.stringify(badges));
  try {
    fetch('/api/vendors/' + vendorId + '/badge', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('vendorToken')}` },
      body: JSON.stringify({ verified: true, badgeType: 'velocity' })
    });
  } catch(ex) {}
}

function isVendorVerified(vendorId) {
  try {
    const badges = JSON.parse(localStorage.getItem('vm_vendor_badges') || '{}');
    return badges[vendorId]?.verified === true;
  } catch(e) { return false; }
}

// ── SIDEBAR CLOSE ALL ─────────────────────────────────────────────────────────
function closeAllSidebars() {
  document.getElementById('recentlyViewedPanel')?.classList.remove('open');
  document.getElementById('loyaltyPanel')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}

// ── RESPONSE RATE BADGE ───────────────────────────────────────────────────────
function responseRateBadgeHTML(rate) {
  if (!rate) return '';
  const pct = Math.round(rate * 100);
  const cls = pct >= 90 ? 'resp-excellent' : pct >= 70 ? 'resp-good' : 'resp-low';
  return `<span class="resp-rate-badge ${cls}" title="Seller response rate">💬 ${pct}% response rate</span>`;
}

// ── LOYALTY ON PURCHASE ───────────────────────────────────────────────────────
// Hook into checkout success to award loyalty points
function onPurchaseComplete(totalAmount, isFirstPurchase) {
  const pts = Math.round(totalAmount * 10);
  addLoyaltyPoints(pts, `Purchase of $${totalAmount.toFixed(2)}`);
  if (isFirstPurchase) addLoyaltyPoints(100, 'First purchase bonus');
  // Check referred_by
  const referredBy = localStorage.getItem('vm_referred_by');
  if (referredBy) {
    localStorage.removeItem('vm_referred_by');
    showToast('Referral bonus applied! $5 credit added.', 'success');
    addLoyaltyPoints(200, 'Referral reward');
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  injectCurrencySelector();
  initReferral();
  updateLoyaltyUI();
  injectBuyerProtectionBadge();

  // Add "Recently Viewed" button to nav
  const navMenu = document.getElementById('navMenu');
  if (navMenu && !document.getElementById('recentlyViewedNavBtn')) {
    const li = document.createElement('li');
    li.id = 'recentlyViewedNavBtn';
    li.innerHTML = `<button class="btn-icon" onclick="openRecentlyViewed()" title="Recently Viewed">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    </button>`;
    // Insert before last 2 items
    const items = navMenu.querySelectorAll('li');
    if (items.length >= 2) navMenu.insertBefore(li, items[items.length - 2]);
    else navMenu.appendChild(li);
  }

  // Loyalty points button in nav
  if (navMenu && !document.getElementById('loyaltyNavBtn')) {
    const li = document.createElement('li');
    li.id = 'loyaltyNavBtn';
    li.innerHTML = `<button class="btn-icon" onclick="openLoyaltyPanel()" title="Loyalty Points" style="position:relative">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      <span class="badge" id="loyaltyNavBadge" style="background:var(--accent);font-size:.55rem">${loyaltyPoints > 0 ? loyaltyPoints : ''}</span>
    </button>`;
    const items = navMenu.querySelectorAll('li');
    if (items.length >= 2) navMenu.insertBefore(li, items[items.length - 2]);
    else navMenu.appendChild(li);
  }
});
