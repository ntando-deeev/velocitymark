// ═══════════════════════════════════════════════════════════════════════════
//  CUSTOMER ACCOUNT SYSTEM — VelocityMark
//  Login · Register · Orders · Addresses · Wishlist · Profile
// ═══════════════════════════════════════════════════════════════════════════

// ── STATE ─────────────────────────────────────────────────────────────────────
let customerToken = localStorage.getItem('customerToken');
let customerData  = null;

try { customerData = JSON.parse(localStorage.getItem('customerData')); } catch(e) {}

document.addEventListener('DOMContentLoaded', () => {
  checkCustomerAuthState();
  injectCheckoutCustomerBanner();
});

// ── AUTH STATE ─────────────────────────────────────────────────────────────────
function checkCustomerAuthState() {
  const nav = document.getElementById('customerNavItem');
  if (!nav) return;

  if (customerToken && customerData) {
    const avatar = customerData.avatar && customerData.avatar.startsWith('http')
      ? `<img src="${customerData.avatar}" alt="${customerData.name}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid var(--accent)">`
      : `<span style="width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700">${(customerData.name||'?')[0].toUpperCase()}</span>`;
    nav.innerHTML = `
      <div class="customer-nav-wrap">
        <button class="btn-icon customer-avatar-btn" onclick="openCustomerDash()" title="My Account">${avatar}</button>
        <button class="btn btn-ghost btn-sm" onclick="customerLogout()" style="font-size:.78rem;padding:.25rem .6rem">Logout</button>
      </div>`;
  } else {
    nav.innerHTML = `<button class="btn btn-outline btn-sm" onclick="showModal('customerAuthModal')">Sign In</button>`;
  }
}

// ── LOGIN ──────────────────────────────────────────────────────────────────────
async function customerLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('cLoginBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in...'; }
  try {
    const res = await fetch('/api/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: document.getElementById('cLoginEmail').value, password: document.getElementById('cLoginPassword').value })
    });
    const d = await res.json();
    if (d.success) {
      customerToken = d.token;
      customerData  = d.customer;
      localStorage.setItem('customerToken', customerToken);
      localStorage.setItem('customerData', JSON.stringify(customerData));
      showToast(`Welcome back, ${d.customer.name} 👋`, 'success');
      closeModal('customerAuthModal');
      checkCustomerAuthState();
      injectCheckoutCustomerBanner();
    } else {
      showToast(d.error || 'Login failed', 'error');
    }
  } catch(err) { showToast('Login error. Try again.', 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; } }
}

// ── REGISTER ───────────────────────────────────────────────────────────────────
async function customerRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('cRegBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating account...'; }
  try {
    const res = await fetch('/api/customer/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('cRegName').value,
        email: document.getElementById('cRegEmail').value,
        password: document.getElementById('cRegPassword').value
      })
    });
    const d = await res.json();
    if (d.success) {
      customerToken = d.token;
      customerData  = d.customer;
      localStorage.setItem('customerToken', customerToken);
      localStorage.setItem('customerData', JSON.stringify(customerData));
      showToast(`Account created! Welcome, ${d.customer.name} 🎉`, 'success');
      closeModal('customerAuthModal');
      checkCustomerAuthState();
      injectCheckoutCustomerBanner();
    } else {
      showToast(d.error || 'Registration failed', 'error');
    }
  } catch(err) { showToast('Registration error. Try again.', 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; } }
}

// ── LOGOUT ─────────────────────────────────────────────────────────────────────
function customerLogout() {
  customerToken = null;
  customerData  = null;
  localStorage.removeItem('customerToken');
  localStorage.removeItem('customerData');
  showToast('Signed out', 'info');
  checkCustomerAuthState();
  injectCheckoutCustomerBanner();
}

// ── MODAL SWITCHES ─────────────────────────────────────────────────────────────
function switchCustomerToRegister() {
  document.getElementById('customerLoginForm').style.display = 'none';
  document.getElementById('customerRegisterForm').style.display = 'block';
}
function switchCustomerToLogin() {
  document.getElementById('customerRegisterForm').style.display = 'none';
  document.getElementById('customerLoginForm').style.display = 'block';
}

// ── ACCOUNT DASHBOARD ──────────────────────────────────────────────────────────
async function openCustomerDash() {
  if (!customerToken) { showModal('customerAuthModal'); return; }
  showModal('customerDashModal');
  // Load all data
  await loadCustomerOrders();
  await loadCustomerAddresses();
  await loadCustomerWishlist();
  await loadCustomerProfile();
}

function switchCustomerTab(name, btn) {
  document.querySelectorAll('#customerDashModal .dash-panel').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
  document.querySelectorAll('#customerDashModal .dash-tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById('ctab-' + name);
  if (panel) { panel.style.display = 'block'; panel.classList.add('active'); }
  if (btn) btn.classList.add('active');
}

// ── ORDERS ─────────────────────────────────────────────────────────────────────
async function loadCustomerOrders() {
  const el = document.getElementById('cOrdersList');
  const countEl = document.getElementById('cOrderCount');
  if (!el) return;
  el.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem">Loading...</p>';
  try {
    const res = await fetch('/api/customer/orders', { headers: { Authorization: `Bearer ${customerToken}` } });
    const orders = await res.json();
    if (countEl) countEl.textContent = orders.length;
    if (!orders.length) {
      el.innerHTML = '<div class="empty-state"><div style="font-size:3rem">📦</div><p>No orders yet. Start shopping!</p><button class="btn btn-primary btn-sm" onclick="closeModal(\'customerDashModal\')">Browse Products</button></div>';
      return;
    }
    el.innerHTML = orders.map(o => {
      const steps = ['pending','processing','shipped','delivered'];
      const statusIdx = steps.indexOf(o.status?.toLowerCase());
      const statusColors = { pending: '#f59e0b', processing: '#6366f1', shipped: '#3b82f6', delivered: '#22c55e' };
      const color = statusColors[o.status?.toLowerCase()] || '#9ca3af';
      return `<div class="customer-order-card">
        <div class="customer-order-header">
          <div>
            <span class="customer-order-id">${o.orderId || o._id}</span>
            <span class="customer-order-date">${new Date(o.createdAt).toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric' })}</span>
          </div>
          <div style="display:flex;align-items:center;gap:.75rem">
            <span class="order-status-pill" style="background:${color}22;color:${color};border:1px solid ${color}44">${o.status || 'pending'}</span>
            <span style="font-weight:700;color:var(--accent)">$${(o.subtotal||0).toFixed(2)}</span>
          </div>
        </div>
        <div class="customer-order-items">
          ${(o.items||[]).map(i => `<span class="order-item-tag">${i.name} ×${i.quantity}</span>`).join('')}
        </div>
        ${o.shippingAddress ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:.4rem">📍 ${o.shippingAddress}</div>` : ''}
        <div class="customer-order-track">
          ${steps.map((s, i) => `<div class="ctrack-step ${i < statusIdx ? 'done' : i === statusIdx ? 'active' : ''}">
            <div class="ctrack-dot"></div><span>${s.charAt(0).toUpperCase()+s.slice(1)}</span>
          </div>`).join('<div class="ctrack-line"></div>')}
        </div>
      </div>`;
    }).join('');
  } catch(e) { el.innerHTML = '<p style="color:var(--accent2)">Could not load orders.</p>'; }
}

// ── ADDRESSES ──────────────────────────────────────────────────────────────────
async function loadCustomerAddresses() {
  const el = document.getElementById('cAddressList');
  const countEl = document.getElementById('cAddressCount');
  if (!el) return;
  try {
    const res = await fetch('/api/customer/addresses', { headers: { Authorization: `Bearer ${customerToken}` } });
    const addrs = await res.json();
    if (countEl) countEl.textContent = addrs.length;
    if (!addrs.length) {
      el.innerHTML = '<div class="empty-state"><div style="font-size:3rem">📍</div><p>No saved addresses yet.</p></div>';
      return;
    }
    el.innerHTML = addrs.map((a, i) => `
      <div class="address-card ${a.isDefault ? 'default' : ''}">
        <div class="address-card-header">
          <span class="address-label">${a.label || 'Home'}${a.isDefault ? ' <span class="default-badge">Default</span>' : ''}</span>
          <button class="btn btn-danger btn-sm" onclick="deleteAddress(${i})">Remove</button>
        </div>
        <div class="address-text">${a.line1}${a.line2 ? ', ' + a.line2 : ''}<br>${a.city}${a.country ? ', ' + a.country : ''}</div>
      </div>`).join('');
  } catch(e) {}
}

function toggleAddAddressForm() {
  const f = document.getElementById('addAddressForm');
  if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

async function saveAddress() {
  const line1 = document.getElementById('addrLine1')?.value.trim();
  const city  = document.getElementById('addrCity')?.value.trim();
  if (!line1 || !city) { showToast('Address and city required', 'error'); return; }
  try {
    const res = await fetch('/api/customer/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        label: document.getElementById('addrLabel')?.value || 'Home',
        line1, line2: document.getElementById('addrLine2')?.value,
        city, country: document.getElementById('addrCountry')?.value,
        isDefault: document.getElementById('addrDefault')?.checked
      })
    });
    const d = await res.json();
    if (d.success) {
      showToast('Address saved!', 'success');
      document.getElementById('addAddressForm').style.display = 'none';
      // Update customerData cache
      if (customerData) { customerData.addresses = d.addresses; localStorage.setItem('customerData', JSON.stringify(customerData)); }
      await loadCustomerAddresses();
      injectCheckoutCustomerBanner();
    } else { showToast(d.error || 'Failed', 'error'); }
  } catch(e) { showToast('Error saving address', 'error'); }
}

async function deleteAddress(idx) {
  if (!confirm('Remove this address?')) return;
  try {
    const res = await fetch(`/api/customer/addresses/${idx}`, { method: 'DELETE', headers: { Authorization: `Bearer ${customerToken}` } });
    const d = await res.json();
    if (d.success) {
      showToast('Address removed', 'info');
      await loadCustomerAddresses();
    }
  } catch(e) {}
}

// ── WISHLIST ───────────────────────────────────────────────────────────────────
async function loadCustomerWishlist() {
  const el = document.getElementById('cWishlistGrid');
  const countEl = document.getElementById('cWishCount');
  if (!el) return;
  el.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem;grid-column:1/-1">Loading...</p>';
  try {
    const res = await fetch('/api/customer/wishlist', { headers: { Authorization: `Bearer ${customerToken}` } });
    const items = await res.json();
    if (countEl) countEl.textContent = items.length;
    if (!items.length) {
      el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div style="font-size:3rem">♡</div><p>Nothing saved yet. Heart a product to save it here.</p></div>';
      return;
    }
    // Reuse productCard from marketplace.js if available
    el.innerHTML = items.map(p => typeof productCard === 'function' ? productCard(p) : `<div class="product-card"><div class="product-name">${p.name}</div><div class="product-price">$${p.price}</div></div>`).join('');
  } catch(e) { el.innerHTML = '<p style="color:var(--accent2)">Could not load wishlist.</p>'; }
}

// ── PROFILE ────────────────────────────────────────────────────────────────────
async function loadCustomerProfile() {
  if (!customerToken) return;
  try {
    const res = await fetch('/api/customer/profile', { headers: { Authorization: `Bearer ${customerToken}` } });
    const c = await res.json();
    if (c._id) {
      const nameEl = document.getElementById('cProfileName');
      const phoneEl = document.getElementById('cProfilePhone');
      const avatarEl = document.getElementById('cProfileAvatar');
      const prevEl = document.getElementById('cProfileAvatarPreview');
      if (nameEl) nameEl.value = c.name || '';
      if (phoneEl) phoneEl.value = c.phone || '';
      if (avatarEl) avatarEl.value = c.avatar || '';
      if (prevEl && c.avatar && c.avatar.startsWith('http')) {
        prevEl.innerHTML = `<img src="${c.avatar}" alt="avatar" class="img-thumb-preview" style="border-radius:50%">`;
      }
      // Sync locally
      customerData = { ...customerData, ...c };
      localStorage.setItem('customerData', JSON.stringify(customerData));
      checkCustomerAuthState();
    }
  } catch(e) {}
}

async function saveCustomerProfile(e) {
  e.preventDefault();
  try {
    const res = await fetch('/api/customer/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        name: document.getElementById('cProfileName')?.value,
        phone: document.getElementById('cProfilePhone')?.value,
        avatar: document.getElementById('cProfileAvatar')?.value
      })
    });
    const d = await res.json();
    if (d.success) {
      customerData = { ...customerData, ...d.customer };
      localStorage.setItem('customerData', JSON.stringify(customerData));
      checkCustomerAuthState();
      showToast('Profile saved!', 'success');
    } else { showToast(d.error || 'Failed', 'error'); }
  } catch(e) { showToast('Error saving profile', 'error'); }
}

async function handleCustomerAvatarUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  if (file.size > 8 * 1024 * 1024) { showToast('Image must be under 8 MB', 'error'); return; }
  showToast('Uploading photo...', 'info');
  try {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch('/api/upload/image', { method: 'POST', headers: { Authorization: `Bearer ${customerToken}` }, body: fd });
    const d = await res.json();
    if (d.success) {
      document.getElementById('cProfileAvatar').value = d.url;
      const prev = document.getElementById('cProfileAvatarPreview');
      if (prev) prev.innerHTML = `<img src="${d.url}" alt="avatar" class="img-thumb-preview" style="border-radius:50%">`;
      showToast('Photo uploaded ✓', 'success');
    } else { showToast(d.error || 'Upload failed', 'error'); }
  } catch(e) { showToast('Upload failed', 'error'); }
}

async function changeCustomerPassword(e) {
  e.preventDefault();
  const curr = document.getElementById('cCurrPass')?.value;
  const next  = document.getElementById('cNewPass')?.value;
  if (!curr || !next) { showToast('Both fields required', 'error'); return; }
  try {
    const res = await fetch('/api/customer/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ currentPassword: curr, newPassword: next })
    });
    const d = await res.json();
    if (d.success) {
      showToast('Password updated ✓', 'success');
      document.getElementById('cCurrPass').value = '';
      document.getElementById('cNewPass').value = '';
    } else { showToast(d.error || 'Failed', 'error'); }
  } catch(e) { showToast('Error', 'error'); }
}

// ── CHECKOUT INTEGRATION ───────────────────────────────────────────────────────
// Pre-fills checkout form and attaches customer token when placing order

function injectCheckoutCustomerBanner() {
  const banner = document.getElementById('checkoutCustomerBanner');
  if (!banner) return;

  if (customerToken && customerData) {
    // Pre-fill checkout form fields
    const nameEl  = document.getElementById('customerName');
    const emailEl = document.getElementById('customerEmail');
    const addrEl  = document.getElementById('shippingAddress');
    if (nameEl && !nameEl.value)  nameEl.value  = customerData.name  || '';
    if (emailEl && !emailEl.value) emailEl.value = customerData.email || '';
    // Auto-fill default address
    const defaultAddr = (customerData.addresses || []).find(a => a.isDefault) || (customerData.addresses || [])[0];
    if (addrEl && defaultAddr && !addrEl.value) {
      addrEl.value = [defaultAddr.line1, defaultAddr.line2, defaultAddr.city, defaultAddr.country].filter(Boolean).join(', ');
    }
    banner.style.display = 'flex';
    banner.innerHTML = `
      <div class="checkout-logged-in">
        <span>✓ Signed in as <strong>${customerData.name}</strong></span>
        <span style="color:var(--text-muted);font-size:.82rem">(${customerData.email})</span>
      </div>`;
  } else {
    banner.style.display = 'block';
    banner.innerHTML = `<div class="checkout-guest-prompt">
      <span>👤 <a href="#" onclick="event.preventDefault();closeModal('checkoutModal');showModal('customerAuthModal')">Sign in</a> for faster checkout &amp; order tracking</span>
    </div>`;
  }
}

// Patch processCheckout in marketplace.js to attach customerToken
// We override the body-building part by hooking into fetch via a proxy
const _origProcessCheckout = typeof processCheckout === 'function' ? processCheckout : null;

// Override goToCheckout so it injects the banner every time
const _origGoToCheckout = typeof goToCheckout === 'function' ? goToCheckout : null;
if (_origGoToCheckout) {
  window.goToCheckout = function() {
    _origGoToCheckout();
    injectCheckoutCustomerBanner();
  };
}

// Intercept /api/checkout to inject customerToken
const _origFetch = window.fetch;
window.fetch = async function(url, opts = {}) {
  if (typeof url === 'string' && url.includes('/api/checkout') && opts.method === 'POST' && customerToken) {
    try {
      const body = JSON.parse(opts.body || '{}');
      body.customerToken = customerToken;
      opts = { ...opts, body: JSON.stringify(body) };
    } catch(_) {}
  }
  return _origFetch.call(this, url, opts);
};
