// ── Global State ──────────────────────────────────────────────────────────────
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let vendorToken = localStorage.getItem('vendorToken');
let vendorId = localStorage.getItem('vendorId');
let currentCategory = 'all';
let allMyProducts = [];
let allMyOrders = [];

document.addEventListener('DOMContentLoaded', () => {
  loadProducts('all');
  loadVendors();
  updateCartUI();
  if (vendorToken) loadVendorDashboard();
});

// ── AUTH ──────────────────────────────────────────────────────────────────────
async function vendorRegister(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById('regName').value,
    email: document.getElementById('regEmail').value,
    password: document.getElementById('regPassword').value,
    storeName: document.getElementById('storeName').value,
    storeDesc: document.getElementById('storeDesc').value,
    category: document.getElementById('storeCategory').value
  };
  const res = await fetch('/api/vendor/register', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
  const result = await res.json();
  if (result.success) {
    localStorage.setItem('vendorToken', result.token);
    localStorage.setItem('vendorId', result.vendorId);
    vendorToken = result.token; vendorId = result.vendorId;
    showToast('Welcome to VelocityMark!', 'success');
    closeModal('loginModal');
    setTimeout(() => location.reload(), 1000);
  } else { showToast(result.error, 'error'); }
}

async function vendorLogin(e) {
  e.preventDefault();
  const data = { email: document.getElementById('loginEmail').value, password: document.getElementById('loginPassword').value };
  const res = await fetch('/api/vendor/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
  const result = await res.json();
  if (result.success) {
    localStorage.setItem('vendorToken', result.token);
    localStorage.setItem('vendorId', result.vendor.id);
    vendorToken = result.token; vendorId = result.vendor.id;
    showToast('Welcome back, ' + result.vendor.storeName, 'success');
    closeModal('loginModal');
    setTimeout(() => location.reload(), 1000);
  } else { showToast(result.error, 'error'); }
}

function vendorLogout() { localStorage.removeItem('vendorToken'); localStorage.removeItem('vendorId'); location.reload(); }
function switchToRegister() { document.getElementById('loginForm').style.display='none'; document.getElementById('registerForm').style.display='block'; }
function switchToLogin() { document.getElementById('loginForm').style.display='block'; document.getElementById('registerForm').style.display='none'; }

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
async function loadVendorDashboard() {
  try {
    const res = await fetch('/api/vendor/dashboard', { headers:{'Authorization':`Bearer ${vendorToken}`} });
    const data = await res.json();
    document.getElementById('productCount').textContent = data.stats.productCount;
    document.getElementById('orderCount').textContent = data.stats.orderCount;
    document.getElementById('totalRevenue').textContent = '$' + (data.stats.totalRevenue||0).toFixed(2);
    if (data.vendor) {
      document.getElementById('profileStoreName').value = data.vendor.storeName||'';
      document.getElementById('profileStoreDesc').value = data.vendor.storeDesc||'';
      document.getElementById('profileCategory').value = data.vendor.category||'';
      document.getElementById('profileImage').value = data.vendor.image||'🏪';
      document.getElementById('profileContactEmail').value = data.vendor.contactEmail||'';
      document.getElementById('profileContactPhone').value = data.vendor.contactPhone||'';
      document.getElementById('profileLocation').value = data.vendor.location||'';
      document.getElementById('profileWebsite').value = data.vendor.website||'';
    }
    const navMenu = document.getElementById('navMenu');
    navMenu.innerHTML += `
      <li><button class="btn btn-primary btn-small" onclick="showModal('dashboardModal');loadAnalytics();">📊 Dashboard</button></li>
      <li><button class="btn btn-secondary btn-small" onclick="vendorLogout()">Logout</button></li>`;
  } catch(err) { console.error(err); }
}

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
async function loadAnalytics() {
  try {
    const res = await fetch('/api/vendor/analytics', { headers:{'Authorization':`Bearer ${vendorToken}`} });
    const data = await res.json();
    const ob = data.orderBreakdown||{};
    document.getElementById('orderBreakdown').innerHTML = `
      <div class="ob-chip pending"><span>${ob.pending||0}</span><small>Pending</small></div>
      <div class="ob-chip shipped"><span>${ob.shipped||0}</span><small>Shipped</small></div>
      <div class="ob-chip delivered"><span>${ob.delivered||0}</span><small>Delivered</small></div>
      <div class="ob-chip"><span>${ob.total||0}</span><small>Total</small></div>`;
    const days = data.salesByDay||[];
    const maxRev = Math.max(...days.map(d=>d.revenue),1);
    document.getElementById('salesChart').innerHTML = days.map(d => {
      const pct = Math.max((d.revenue/maxRev)*100,3);
      return `<div class="bar-col"><div class="bar-val">$${d.revenue.toFixed(0)}</div><div class="bar" style="height:${pct}%"></div><div class="bar-label">${d.date.slice(5)}</div></div>`;
    }).join('');
    const tp = data.topProducts||[];
    document.getElementById('topProductsList').innerHTML = tp.length
      ? tp.map((p,i)=>`<div class="top-prod-row"><span>${['🥇','🥈','🥉','4️⃣','5️⃣'][i]||''} ${p.name}</span><span><span class="top-prod-badge">${p.sold} sold</span> $${p.revenue.toFixed(2)}</span></div>`).join('')
      : '<p style="color:#999;font-size:0.85rem;">No sales data yet.</p>';
    const ls = data.lowStock||[];
    document.getElementById('lowStockAlert').innerHTML = ls.length
      ? `<div class="low-stock-alert"><h4>⚠️ Low Stock (${ls.length})</h4>${ls.map(p=>`<div class="low-stock-item"><span>${p.name}</span><span class="stock-badge">${p.stock} left</span></div>`).join('')}</div>` : '';
  } catch(err) { console.error(err); }
}

// ── MY PRODUCTS ───────────────────────────────────────────────────────────────
async function loadMyProducts() {
  const res = await fetch('/api/vendor/products', { headers:{'Authorization':`Bearer ${vendorToken}`} });
  allMyProducts = await res.json();
  renderMyProducts(allMyProducts);
}

function renderMyProducts(products) {
  const el = document.getElementById('myProductsList');
  if (!products.length) { el.innerHTML='<p style="color:#999;text-align:center;padding:2rem;">No products yet.</p>'; return; }
  el.innerHTML = products.map(p=>`
    <div class="product-list-item">
      <div><div class="prod-name">${p.image||'📦'} ${p.name}</div><div style="font-size:.75rem;color:#999">${p.category}</div></div>
      <div class="prod-price">$${p.price}</div>
      <div class="prod-stock">Stock: ${p.stock}</div>
      ${p.featured?'<span class="featured-badge">⭐ Featured</span>':'<span></span>'}
      <button class="btn btn-small" onclick="openEditProduct('${p._id}','${p.name.replace(/'/g,"\\'")}','${(p.description||'').replace(/'/g,"\\'")}',${p.price},${p.stock},'${p.category}')">✏️</button>
      <div style="display:flex;gap:4px;">
        <button class="btn btn-small" style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0" onclick="duplicateProduct('${p._id}')">⧉</button>
        <button class="btn btn-small" style="background:#fff7ed;color:#c2410c;border:1px solid #fed7aa" onclick="toggleFeatured('${p._id}',this)">${p.featured?'★':'☆'}</button>
        <button class="btn btn-small" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca" onclick="deleteProduct('${p._id}')">🗑</button>
      </div>
    </div>`).join('');
}

function filterMyProducts() {
  const s = document.getElementById('myProductSearch').value.toLowerCase();
  const c = document.getElementById('myProductCatFilter').value;
  renderMyProducts(allMyProducts.filter(p=>(!s||p.name.toLowerCase().includes(s))&&(!c||p.category===c)));
}

function openEditProduct(id,name,desc,price,stock,category) {
  document.getElementById('editProdId').value=id;
  document.getElementById('editProdName').value=name;
  document.getElementById('editProdDesc').value=desc;
  document.getElementById('editProdPrice').value=price;
  document.getElementById('editProdStock').value=stock;
  document.getElementById('editProdCategory').value=category;
  document.getElementById('editProductPanel').style.display='block';
  document.getElementById('editProductPanel').scrollIntoView({behavior:'smooth'});
}

async function saveProductEdit() {
  const id = document.getElementById('editProdId').value;
  const data = { name:document.getElementById('editProdName').value, description:document.getElementById('editProdDesc').value, price:parseFloat(document.getElementById('editProdPrice').value), stock:parseInt(document.getElementById('editProdStock').value), category:document.getElementById('editProdCategory').value };
  const res = await fetch(`/api/products/${id}`,{method:'PUT',headers:{'Content-Type':'application/json','Authorization':`Bearer ${vendorToken}`},body:JSON.stringify(data)});
  const result = await res.json();
  if (result.success) { showToast('Product updated!','success'); document.getElementById('editProductPanel').style.display='none'; loadMyProducts(); loadProducts('all'); }
  else showToast(result.error,'error');
}

async function deleteProduct(productId) {
  if (!confirm('Delete this product?')) return;
  const res = await fetch(`/api/products/${productId}`,{method:'DELETE',headers:{'Authorization':`Bearer ${vendorToken}`}});
  const result = await res.json();
  if (result.success) { showToast('Product deleted','success'); loadMyProducts(); loadProducts('all'); }
}

async function duplicateProduct(productId) {
  const res = await fetch(`/api/products/${productId}/duplicate`,{method:'POST',headers:{'Authorization':`Bearer ${vendorToken}`}});
  const result = await res.json();
  if (result.success) { showToast('Product duplicated!','success'); loadMyProducts(); }
  else showToast(result.error,'error');
}

async function toggleFeatured(productId,btn) {
  const res = await fetch(`/api/products/${productId}/feature`,{method:'PUT',headers:{'Authorization':`Bearer ${vendorToken}`}});
  const result = await res.json();
  if (result.success) { btn.textContent=result.featured?'★':'☆'; showToast(result.featured?'Product featured!':'Unfeatured','success'); loadMyProducts(); }
}

// ── UPLOAD PRODUCT ─────────────────────────────────────────────────────────────
async function uploadProduct(e) {
  e.preventDefault();
  const product = {
    name:document.getElementById('prodName').value, description:document.getElementById('prodDesc').value,
    price:parseFloat(document.getElementById('prodPrice').value), originalPrice:document.getElementById('prodOriginal').value?parseFloat(document.getElementById('prodOriginal').value):null,
    category:document.getElementById('prodCategory').value, stock:parseInt(document.getElementById('prodStock').value)||999,
    tags:document.getElementById('prodTags').value.split(',').map(t=>t.trim()).filter(Boolean),
    image:document.getElementById('prodImage').value||'📦'
  };
  const res = await fetch('/api/products/upload',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${vendorToken}`},body:JSON.stringify(product)});
  const result = await res.json();
  if (result.success) { showToast('Product uploaded!','success'); document.getElementById('uploadForm').reset(); document.getElementById('prodImage').value='📦'; switchTab('products'); loadMyProducts(); loadProducts('all'); }
  else showToast(result.error,'error');
}

// ── ORDERS ────────────────────────────────────────────────────────────────────
async function loadMyOrders() {
  const res = await fetch('/api/vendor/orders',{headers:{'Authorization':`Bearer ${vendorToken}`}});
  allMyOrders = await res.json();
  renderOrders(allMyOrders);
}

function filterOrders() {
  const s = document.getElementById('orderStatusFilter').value;
  renderOrders(s?allMyOrders.filter(o=>o.status===s):allMyOrders);
}

function renderOrders(orders) {
  const el = document.getElementById('myOrdersList');
  if (!orders.length) { el.innerHTML='<p style="color:#999;text-align:center;padding:2rem;">No orders found.</p>'; return; }
  el.innerHTML = orders.map(o=>`
    <div class="order-item">
      <div class="order-item-header"><span class="order-id">#${o.orderId||o._id?.slice(-8)}</span><span class="order-earnings">$${(o.vendorEarnings||0).toFixed(2)}</span></div>
      <div style="font-size:.8rem;color:#555;margin-bottom:.4rem;">📧 ${o.email||'N/A'} | 📦 ${(o.items||[]).length} item(s) | ${new Date(o.createdAt).toLocaleDateString()}</div>
      ${o.shippingAddress?`<div style="font-size:.78rem;color:#888;margin-bottom:.4rem;">🏠 ${o.shippingAddress}</div>`:''}
      <select class="order-status-select" onchange="updateOrderStatus('${o._id}',this.value)">
        <option value="pending" ${o.status==='pending'?'selected':''}>⏳ Pending</option>
        <option value="shipped" ${o.status==='shipped'?'selected':''}>🚚 Shipped</option>
        <option value="delivered" ${o.status==='delivered'?'selected':''}>✅ Delivered</option>
      </select>
    </div>`).join('');
}

async function updateOrderStatus(orderId,status) {
  await fetch(`/api/vendor/orders/${orderId}/status`,{method:'PUT',headers:{'Content-Type':'application/json','Authorization':`Bearer ${vendorToken}`},body:JSON.stringify({status})});
  showToast('Order updated to '+status,'success'); loadMyOrders();
}

// ── REVIEWS ───────────────────────────────────────────────────────────────────
async function loadMyReviews() {
  const res = await fetch('/api/vendor/reviews',{headers:{'Authorization':`Bearer ${vendorToken}`}});
  const reviews = await res.json();
  const el = document.getElementById('myReviewsList');
  if (!reviews.length) { el.innerHTML='<p style="color:#999;text-align:center;padding:2rem;">No reviews yet.</p>'; return; }
  el.innerHTML = reviews.map(r=>`
    <div class="review-card">
      <div class="review-header"><span class="review-name">${r.customerName}</span><span class="review-stars">${'⭐'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span></div>
      <div class="review-comment">"${r.comment||'No comment.'}"</div>
      <div class="review-product">🕐 ${new Date(r.createdAt).toLocaleDateString()}</div>
      ${r.reply?`<div class="vendor-reply">🏪 Your reply: ${r.reply}</div>`:`
      <div class="review-reply-box"><input type="text" placeholder="Reply..." id="reply_${r._id}"><button class="btn btn-small btn-primary" onclick="replyToReview('${r._id}')">Send</button></div>`}
    </div>`).join('');
}

async function replyToReview(reviewId) {
  const reply = document.getElementById(`reply_${reviewId}`).value;
  if (!reply.trim()) return;
  const res = await fetch(`/api/vendor/reviews/${reviewId}/reply`,{method:'PUT',headers:{'Content-Type':'application/json','Authorization':`Bearer ${vendorToken}`},body:JSON.stringify({reply})});
  const result = await res.json();
  if (result.success) { showToast('Reply sent!','success'); loadMyReviews(); }
}

// ── PAYOUTS ───────────────────────────────────────────────────────────────────
async function loadPayouts() {
  const res = await fetch('/api/vendor/payouts',{headers:{'Authorization':`Bearer ${vendorToken}`}});
  const data = await res.json();
  document.getElementById('payoutStats').innerHTML=`
    <div class="stat-card"><h3>$${(data.totalEarnings||0).toFixed(2)}</h3><p>Total Earned</p></div>
    <div class="stat-card"><h3 style="color:#f59e0b">$${(data.pendingEarnings||0).toFixed(2)}</h3><p>Pending</p></div>`;
  const h = data.recentPayouts||[];
  document.getElementById('payoutHistory').innerHTML = h.length
    ? h.map(p=>`<div class="payout-row"><span>Order #${p.orderId||'N/A'}</span><span class="payout-amount">$${(p.amount||0).toFixed(2)}</span><span class="payout-date">${new Date(p.date).toLocaleDateString()}</span></div>`).join('')
    : '<p style="color:#999;font-size:.85rem;">No completed payouts yet.</p>';
}

// ── STORE PROFILE ─────────────────────────────────────────────────────────────
async function saveStoreProfile(e) {
  e.preventDefault();
  const data = { storeName:document.getElementById('profileStoreName').value, storeDesc:document.getElementById('profileStoreDesc').value, category:document.getElementById('profileCategory').value, image:document.getElementById('profileImage').value, contactEmail:document.getElementById('profileContactEmail').value, contactPhone:document.getElementById('profileContactPhone').value, location:document.getElementById('profileLocation').value, website:document.getElementById('profileWebsite').value };
  const res = await fetch('/api/vendor/profile',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':`Bearer ${vendorToken}`},body:JSON.stringify(data)});
  const result = await res.json();
  if (result.success) showToast('Store profile saved!','success'); else showToast(result.error,'error');
}

// ── BUYER VIEW ────────────────────────────────────────────────────────────────
async function loadProducts(category) {
  currentCategory = category;
  const url = category==='all'?'/api/products':`/api/products?category=${category}`;
  const res = await fetch(url);
  const products = await res.json();
  document.getElementById('productsGrid').innerHTML = products.length
    ? products.map(p=>`<div class="product-card"><div class="product-image">${p.image||'📦'}</div><div class="product-info"><div class="product-vendor">${p.vendorName}</div><div class="product-name">${p.name}</div><div class="product-price">$${p.price}${p.originalPrice?` <span class="product-original">$${p.originalPrice}</span>`:''}</div><div class="product-rating">⭐ ${p.rating} (${p.reviews})</div><button class="add-to-cart-btn" onclick="addToCart('${p._id}','${p.name.replace(/'/g,"\\'")}',${p.price},'${(p.vendorName||'').replace(/'/g,"\\'")}')">Add to Cart</button></div></div>`).join('')
    : '<p style="color:#999;text-align:center;padding:3rem;grid-column:1/-1;">No products yet.</p>';
}

async function loadVendors() {
  const res = await fetch('/api/vendors');
  const vendors = await res.json();
  document.getElementById('vendorsGrid').innerHTML = vendors.slice(0,6).map(v=>`<div class="vendor-card"><div class="vendor-image">${v.image||'🏪'}</div><h3>${v.storeName}</h3><p>${v.storeDesc||''}</p><div class="vendor-rating">⭐ ${v.rating}</div><button class="btn btn-small" onclick="filterByVendor('${v._id}')">View Store</button></div>`).join('');
}

function filterCategory(cat) {
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  event.target.classList.add('active');
  loadProducts(cat);
}

function filterByVendor(vid) {
  fetch(`/api/products?vendor=${vid}`).then(r=>r.json()).then(products=>{
    document.getElementById('productsGrid').innerHTML = products.map(p=>`<div class="product-card"><div class="product-image">${p.image||'📦'}</div><div class="product-info"><div class="product-vendor">${p.vendorName}</div><div class="product-name">${p.name}</div><div class="product-price">$${p.price}</div><div class="product-rating">⭐ ${p.rating} (${p.reviews})</div><button class="add-to-cart-btn" onclick="addToCart('${p._id}','${p.name.replace(/'/g,"\\'")}',${p.price},'${(p.vendorName||'').replace(/'/g,"\\'")}')">Add to Cart</button></div></div>`).join('');
    document.querySelector('#shop').scrollIntoView({behavior:'smooth'});
  });
}

function searchProducts() {
  const s = document.getElementById('searchInput').value;
  if (s.length>2) {
    fetch(`/api/products?search=${encodeURIComponent(s)}`).then(r=>r.json()).then(products=>{
      document.getElementById('productsGrid').innerHTML = products.map(p=>`<div class="product-card"><div class="product-image">${p.image||'📦'}</div><div class="product-info"><div class="product-vendor">${p.vendorName}</div><div class="product-name">${p.name}</div><div class="product-price">$${p.price}</div><button class="add-to-cart-btn" onclick="addToCart('${p._id}','${p.name.replace(/'/g,"\\'")}',${p.price},'${(p.vendorName||'').replace(/'/g,"\\'")}')">Add</button></div></div>`).join('');
    });
  } else if (s.length===0) loadProducts(currentCategory);
}

// ── CART ──────────────────────────────────────────────────────────────────────
function addToCart(productId,name,price,vendor) {
  const e = cart.find(i=>i.productId===productId);
  if (e) e.quantity+=1; else cart.push({productId,name,price,vendorName:vendor,quantity:1});
  localStorage.setItem('cart',JSON.stringify(cart)); updateCartUI(); showToast(`${name} added to cart`,'success');
}

function updateCartUI() {
  document.getElementById('cartCount').textContent = cart.reduce((s,i)=>s+i.quantity,0);
  const el = document.getElementById('cartItems');
  el.innerHTML = cart.length ? cart.map((item,i)=>`<div class="cart-item"><div><div class="cart-item-name">${item.name}</div><div class="cart-item-vendor">${item.vendorName}</div><div class="cart-item-price">$${(item.price*item.quantity).toFixed(2)}</div></div><div class="cart-item-qty"><button onclick="updateQty(${i},${item.quantity-1})">−</button><span>${item.quantity}</span><button onclick="updateQty(${i},${item.quantity+1})">+</button></div><button class="remove-btn" onclick="removeCart(${i})">✕</button></div>`).join('') : '<p class="empty-cart">Your cart is empty</p>';
  document.getElementById('cartTotal').textContent = '$'+cart.reduce((s,i)=>s+(i.price*i.quantity),0).toFixed(2);
}

function updateQty(i,qty) { if(qty<1) return removeCart(i); cart[i].quantity=qty; localStorage.setItem('cart',JSON.stringify(cart)); updateCartUI(); }
function removeCart(i) { cart.splice(i,1); localStorage.setItem('cart',JSON.stringify(cart)); updateCartUI(); }
function toggleCart() { document.getElementById('cartSidebar').classList.toggle('open'); }
function goToCheckout() { if(!cart.length){showToast('Cart is empty','error');return;} toggleCart(); showModal('checkoutModal'); }

async function processCheckout(e) {
  e.preventDefault();
  const res = await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:cart,email:document.getElementById('customerEmail').value,name:document.getElementById('customerName').value,shippingAddress:document.getElementById('shippingAddress').value})});
  const data = await res.json();
  if (data.url) window.location.href=data.url;
}

// ── MODALS & TABS ─────────────────────────────────────────────────────────────
function showModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(t=>t.style.display='none');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(tab).style.display='block';
  event.target.classList.add('active');
}
function scrollTo(selector) { document.querySelector(selector)?.scrollIntoView({behavior:'smooth'}); }

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(message, type='success') {
  let c = document.getElementById('toastContainer');
  if (!c) { c=document.createElement('div'); c.id='toastContainer'; c.style.cssText='position:fixed;top:1.25rem;right:1.25rem;z-index:9999;display:flex;flex-direction:column;gap:.5rem;'; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.style.cssText=`background:${type==='success'?'#10b981':'#ef4444'};color:white;padding:.75rem 1.25rem;border-radius:10px;font-size:.875rem;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,.15);max-width:320px;`;
  t.textContent=message; c.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300);},3000);
}

// ── STOCK MANAGEMENT ──────────────────────────────────────────────────────────
let currentStockProductId = null;

async function loadStockOverview() {
  const res = await fetch('/api/vendor/stock', { headers: { 'Authorization': `Bearer ${vendorToken}` } });
  const products = await res.json();
  const el = document.getElementById('stockOverviewList');
  if (!products.length) { el.innerHTML = '<p style="color:#999;text-align:center;padding:2rem;">No products yet. Add products first.</p>'; return; }
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr auto auto auto auto;gap:.5rem;align-items:center;font-size:.75rem;font-weight:700;color:#888;padding:0 .5rem .5rem;border-bottom:1px solid #eee;">
      <span>PRODUCT</span><span>SKU</span><span>STOCK</span><span>STATUS</span><span>ACTION</span>
    </div>` +
    products.map(p => `
    <div style="display:grid;grid-template-columns:1fr auto auto auto auto;gap:.5rem;align-items:center;padding:.65rem .5rem;border-bottom:1px solid #f5f5f5;font-size:.875rem;">
      <div><div style="font-weight:600;">${p.image || '📦'} ${p.name}</div><div style="font-size:.75rem;color:#999;">${p.category}</div></div>
      <div style="font-size:.78rem;color:#888;">${p.sku || '—'}</div>
      <div style="font-weight:700;">${p.stock}</div>
      <div>${p.status === 'out' ? '<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:10px;font-size:.75rem;">Out of Stock</span>' : p.status === 'low' ? '<span style="background:#fff7ed;color:#c2410c;padding:2px 8px;border-radius:10px;font-size:.75rem;">Low Stock</span>' : '<span style="background:#f0fdf4;color:#16a34a;padding:2px 8px;border-radius:10px;font-size:.75rem;">In Stock</span>'}</div>
      <button class="btn btn-small" onclick="openStockAdjust('${p._id}','${p.name.replace(/'/g,"\\'")}',${p.stock},${p.lowStockThreshold},'${p.sku||''}')">⚙️ Adjust</button>
    </div>`).join('');
}

function openStockAdjust(productId, name, stock, threshold, sku) {
  currentStockProductId = productId;
  document.getElementById('adjustProductId').value = productId;
  document.getElementById('adjustProductName').textContent = `📦 ${name} — Current stock: ${stock}`;
  document.getElementById('adjustThreshold').value = threshold;
  document.getElementById('adjustSku').value = sku;
  document.getElementById('adjustQty').value = '';
  document.getElementById('adjustNote').value = '';
  document.getElementById('stockAdjustPanel').style.display = 'block';
  document.getElementById('stockHistoryPanel').style.display = 'none';
  document.getElementById('stockAdjustPanel').scrollIntoView({ behavior: 'smooth' });
}

async function submitStockAdjust() {
  const productId = document.getElementById('adjustProductId').value;
  const type = document.getElementById('adjustType').value;
  const qty = parseInt(document.getElementById('adjustQty').value);
  const note = document.getElementById('adjustNote').value;
  const lowStockThreshold = parseInt(document.getElementById('adjustThreshold').value) || 5;
  const sku = document.getElementById('adjustSku').value;
  if (isNaN(qty)) { showToast('Enter a valid quantity', 'error'); return; }

  const endpoint = type === 'opening' ? '/api/vendor/stock/opening' : '/api/vendor/stock/adjust';
  const body = type === 'opening' ? { productId, qty, note, lowStockThreshold, sku } : { productId, type, qty, note };

  const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` }, body: JSON.stringify(body) });
  const result = await res.json();
  if (result.success) {
    showToast(`Stock updated! New stock: ${result.stock}`, 'success');
    document.getElementById('stockAdjustPanel').style.display = 'none';
    loadStockOverview();
  } else showToast(result.error, 'error');
}

async function loadStockHistory() {
  if (!currentStockProductId) return;
  const res = await fetch(`/api/vendor/stock/${currentStockProductId}/history`, { headers: { 'Authorization': `Bearer ${vendorToken}` } });
  const logs = await res.json();
  const panel = document.getElementById('stockHistoryPanel');
  const list = document.getElementById('stockHistoryList');
  panel.style.display = 'block';
  list.innerHTML = logs.length
    ? logs.map(l => `<div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid #f5f5f5;font-size:.82rem;">
        <span>${l.type === 'opening' ? '📌' : l.type === 'add' ? '➕' : l.type === 'remove' ? '➖' : l.type === 'sale' ? '🛒' : '🔧'} <strong>${l.type.charAt(0).toUpperCase() + l.type.slice(1)}</strong> ${l.qty} units</span>
        <span style="color:#888;">${l.stockBefore} → ${l.stockAfter}</span>
        <span style="color:#aaa;">${new Date(l.createdAt).toLocaleDateString()}</span>
      </div>`).join('')
    : '<p style="color:#999;font-size:.85rem;">No history yet.</p>';
}

// CSV Bulk Import
function handleCSVImport(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const values = line.split(',');
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (values[i] || '').trim().replace(/^"|"$/g, ''); });
      return obj;
    }).filter(r => r.name);
    if (!rows.length) { showToast('No valid rows found in CSV', 'error'); return; }
    const res = await fetch('/api/vendor/products/bulk-import', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` },
      body: JSON.stringify({ rows })
    });
    const result = await res.json();
    if (result.success) { showToast(`✅ Imported ${result.imported} products!`, 'success'); loadMyProducts(); loadStockOverview(); loadProducts('all'); }
    else showToast(result.error, 'error');
    input.value = '';
  };
  reader.readAsText(file);
}

// ── DISCOUNT CODES ────────────────────────────────────────────────────────────
async function loadCoupons() {
  const res = await fetch('/api/vendor/coupons', { headers: { 'Authorization': `Bearer ${vendorToken}` } });
  const coupons = await res.json();
  const el = document.getElementById('couponList');
  if (!coupons.length) { el.innerHTML = '<p style="color:#999;text-align:center;padding:1.5rem;">No discount codes yet.</p>'; return; }
  el.innerHTML = coupons.map(c => `
    <div style="display:flex;justify-content:space-between;align-items:center;background:#f9fafb;border:1px solid #eee;border-radius:8px;padding:.75rem;margin-bottom:.5rem;flex-wrap:wrap;gap:.5rem;">
      <div>
        <div style="font-weight:700;font-family:monospace;font-size:1rem;color:#1e40af;">${c.code}</div>
        <div style="font-size:.78rem;color:#888;">${c.type === 'percent' ? c.value + '% off' : '$' + c.value + ' off'} ${c.minOrder ? '· Min $' + c.minOrder : ''} ${c.maxUses ? '· Max ' + c.maxUses + ' uses' : '· Unlimited'} ${c.expiresAt ? '· Expires ' + new Date(c.expiresAt).toLocaleDateString() : ''}</div>
        <div style="font-size:.75rem;color:#aaa;">Used ${c.usedCount} time${c.usedCount !== 1 ? 's' : ''}</div>
      </div>
      <div style="display:flex;gap:.4rem;align-items:center;">
        <span style="background:${c.active ? '#f0fdf4' : '#f9fafb'};color:${c.active ? '#16a34a' : '#aaa'};border:1px solid ${c.active ? '#bbf7d0' : '#e5e7eb'};padding:2px 10px;border-radius:10px;font-size:.75rem;">${c.active ? 'Active' : 'Paused'}</span>
        <button class="btn btn-small" onclick="toggleCoupon('${c._id}', this)">${c.active ? 'Pause' : 'Activate'}</button>
        <button class="btn btn-small" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;" onclick="deleteCoupon('${c._id}')">🗑</button>
      </div>
    </div>`).join('');
}

async function createCoupon() {
  const data = {
    code: document.getElementById('couponCode').value,
    type: document.getElementById('couponType').value,
    value: parseFloat(document.getElementById('couponValue').value),
    minOrder: parseFloat(document.getElementById('couponMinOrder').value) || 0,
    maxUses: parseInt(document.getElementById('couponMaxUses').value) || 0,
    expiresAt: document.getElementById('couponExpiry').value || null
  };
  if (!data.code || !data.value) { showToast('Code and value required', 'error'); return; }
  const res = await fetch('/api/vendor/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` }, body: JSON.stringify(data) });
  const result = await res.json();
  if (result.success) { showToast('Coupon created!', 'success'); document.getElementById('couponCode').value = ''; loadCoupons(); }
  else showToast(result.error, 'error');
}

async function toggleCoupon(id, btn) {
  const res = await fetch(`/api/vendor/coupons/${id}/toggle`, { method: 'PUT', headers: { 'Authorization': `Bearer ${vendorToken}` } });
  const result = await res.json();
  if (result.success) { showToast(result.active ? 'Coupon activated' : 'Coupon paused', 'success'); loadCoupons(); }
}

async function deleteCoupon(id) {
  if (!confirm('Delete this coupon?')) return;
  const res = await fetch(`/api/vendor/coupons/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${vendorToken}` } });
  const result = await res.json();
  if (result.success) { showToast('Coupon deleted', 'success'); loadCoupons(); }
}

// Coupon at checkout
let appliedDiscount = 0;
async function applyCoupon() {
  const code = document.getElementById('couponInput').value.trim();
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const res = await fetch('/api/coupons/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, subtotal: total }) });
  const result = await res.json();
  const el = document.getElementById('couponResult');
  if (result.success) {
    appliedDiscount = result.coupon.discount;
    el.innerHTML = `<span style="color:#16a34a;font-weight:600;">✅ ${result.coupon.code} applied! You save $${appliedDiscount.toFixed(2)}</span>`;
    document.getElementById('checkoutTotal').textContent = '$' + Math.max(0, total - appliedDiscount).toFixed(2);
  } else {
    el.innerHTML = `<span style="color:#dc2626;">❌ ${result.error}</span>`;
  }
}

function goToCheckout() {
  if (!cart.length) { showToast('Cart is empty', 'error'); return; }
  toggleCart();
  appliedDiscount = 0;
  document.getElementById('couponResult').innerHTML = '';
  document.getElementById('couponInput').value = '';
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  document.getElementById('checkoutTotal').textContent = '$' + total.toFixed(2);
  showModal('checkoutModal');
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
async function loadNotifications() {
  const res = await fetch('/api/vendor/notifications', { headers: { 'Authorization': `Bearer ${vendorToken}` } });
  const notifications = await res.json();
  const el = document.getElementById('notificationsList');
  if (!notifications.length) { el.innerHTML = '<p style="color:#999;text-align:center;padding:2rem;">No alerts yet.</p>'; return; }
  el.innerHTML = notifications.map(n => `
    <div style="display:flex;gap:.75rem;align-items:flex-start;padding:.75rem;border-bottom:1px solid #f5f5f5;${n.read ? 'opacity:.6' : 'background:#fffbeb;border-radius:8px;margin-bottom:.3rem;'}">
      <span style="font-size:1.2rem;">${n.type === 'low_stock' ? '⚠️' : n.type === 'order' ? '🧾' : n.type === 'review' ? '⭐' : '🔔'}</span>
      <div style="flex:1"><div style="font-size:.875rem;">${n.message}</div><div style="font-size:.75rem;color:#aaa;">${new Date(n.createdAt).toLocaleString()}</div></div>
      ${n.read ? '' : '<span style="background:#f59e0b;color:white;font-size:.65rem;padding:2px 6px;border-radius:10px;white-space:nowrap;">New</span>'}
    </div>`).join('');
}

async function markAllRead() {
  await fetch('/api/vendor/notifications/read', { method: 'PUT', headers: { 'Authorization': `Bearer ${vendorToken}` } });
  showToast('All notifications marked as read', 'success');
  loadNotifications();
}

// ── PREMIUM: ADVANCED REPORTS ─────────────────────────────────────────────────
let reportData = null;
async function loadAdvancedReports() {
  const gateEl = document.getElementById('premiumGateReports');
  const contentEl = document.getElementById('reportsContent');
  const period = document.getElementById('reportPeriod')?.value || 30;
  const res = await fetch(`/api/vendor/reports/advanced?period=${period}`, { headers: { 'Authorization': `Bearer ${vendorToken}` } });
  const data = await res.json();
  if (data.error === 'premium_required') {
    gateEl.innerHTML = renderPremiumGate('Advanced Reports', 'Get monthly/weekly revenue breakdowns, profit margins, category analysis, and CSV exports.');
    contentEl.style.display = 'none'; return;
  }
  gateEl.innerHTML = '';
  contentEl.style.display = 'block';
  reportData = data;
  document.getElementById('reportStats').innerHTML = `
    <div class="stat-card"><h3>$${data.totalRevenue.toFixed(2)}</h3><p>Revenue (${data.period}d)</p></div>
    <div class="stat-card"><h3>${data.totalOrders}</h3><p>Orders</p></div>
    <div class="stat-card"><h3>$${data.avgOrderValue.toFixed(2)}</h3><p>Avg Order Value</p></div>
    <div class="stat-card"><h3 style="color:#ef4444">$${data.platformFeesPaid.toFixed(2)}</h3><p>Platform Fees</p></div>`;
  const days = data.revenueByDay || [];
  const maxRev = Math.max(...days.map(d => d.revenue), 1);
  document.getElementById('reportChart').innerHTML = days.map(d => {
    const pct = Math.max((d.revenue / maxRev) * 100, 2);
    return `<div class="bar-col"><div class="bar-val">$${d.revenue.toFixed(0)}</div><div class="bar" style="height:${pct}%"></div><div class="bar-label">${d.date.slice(5)}</div></div>`;
  }).join('');
  const cats = data.revenueByCategory || [];
  document.getElementById('reportByCategory').innerHTML = cats.length
    ? cats.sort((a, b) => b.revenue - a.revenue).map(c => `
        <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid #f5f5f5;font-size:.875rem;">
          <span style="text-transform:capitalize;">${c.category}</span>
          <span style="font-weight:700;color:var(--primary);">$${c.revenue.toFixed(2)}</span>
        </div>`).join('')
    : '<p style="color:#999;font-size:.85rem;">No category data yet.</p>';
}

function exportReportCSV() {
  if (!reportData) return;
  const rows = [['Date', 'Revenue'], ...reportData.revenueByDay.map(d => [d.date, d.revenue.toFixed(2)])];
  const csv = rows.map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `velocitymark-report-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// ── PREMIUM: PROMOTED LISTINGS ────────────────────────────────────────────────
async function loadPromote() {
  const gateEl = document.getElementById('premiumGatePromote');
  const contentEl = document.getElementById('promoteContent');
  // Check plan by trying to load analytics (it includes vendor data)
  const res = await fetch('/api/vendor/reports/advanced?period=7', { headers: { 'Authorization': `Bearer ${vendorToken}` } });
  const data = await res.json();
  if (data.error === 'premium_required') {
    gateEl.innerHTML = renderPremiumGate('Promoted Listings', 'Boost your products to the top of the marketplace with a Sponsored badge — up to 5x more clicks.');
    contentEl.style.display = 'none'; return;
  }
  gateEl.innerHTML = '';
  contentEl.style.display = 'block';
  // Load products for select
  const pRes = await fetch('/api/vendor/products', { headers: { 'Authorization': `Bearer ${vendorToken}` } });
  const products = await pRes.json();
  document.getElementById('promoteProductSelect').innerHTML = products.map(p => `<option value="${p._id}">${p.image || '📦'} ${p.name} — $${p.price}</option>`).join('');
  // Load sponsored products
  const sRes = await fetch('/api/products/sponsored');
  const sponsored = await sRes.json();
  const mySponsored = sponsored.filter(p => p.vendorId?.toString() === vendorId);
  document.getElementById('sponsoredList').innerHTML = mySponsored.length
    ? mySponsored.map(p => `<div style="display:flex;justify-content:space-between;align-items:center;background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:.75rem;margin-bottom:.5rem;"><span>${p.image} ${p.name}</span><span style="font-size:.8rem;color:#92400e;">Sponsored until ${new Date(p.sponsoredUntil).toLocaleDateString()}</span></div>`).join('')
    : '<p style="color:#999;font-size:.85rem;">No active promotions.</p>';
}

async function submitPromotion() {
  const productId = document.getElementById('promoteProductSelect').value;
  const days = document.getElementById('promoteDays').value;
  const budget = document.getElementById('promoteBudget').value;
  const res = await fetch('/api/vendor/promote', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` }, body: JSON.stringify({ productId, days: parseInt(days), budget: parseFloat(budget) || 0 }) });
  const result = await res.json();
  if (result.success) { showToast(`Product promoted until ${new Date(result.sponsoredUntil).toLocaleDateString()}!`, 'success'); loadPromote(); loadSponsoredProducts(); }
  else showToast(result.error, 'error');
}

// Premium gate UI
function renderPremiumGate(feature, description) {
  return `<div style="text-align:center;padding:2rem;background:linear-gradient(135deg,#1e1b4b,#3730a3);border-radius:16px;color:white;">
    <div style="font-size:3rem;margin-bottom:.75rem;">👑</div>
    <h3 style="margin-bottom:.5rem;">${feature} — Premium Feature</h3>
    <p style="opacity:.8;font-size:.9rem;margin-bottom:1.5rem;">${description}</p>
    <button class="btn" style="background:#fbbf24;color:#1e1b4b;font-weight:700;padding:.75rem 2rem;border-radius:10px;font-size:1rem;" onclick="upgradeToPremium()">⚡ Upgrade to Premium</button>
    <p style="font-size:.75rem;opacity:.6;margin-top:.75rem;">Demo: Click upgrade to unlock instantly</p>
  </div>`;
}

async function upgradeToPremium() {
  const res = await fetch('/api/vendor/upgrade', { method: 'POST', headers: { 'Authorization': `Bearer ${vendorToken}` } });
  const result = await res.json();
  if (result.success) { showToast('👑 ' + result.message, 'success'); setTimeout(() => { loadAdvancedReports(); loadPromote(); }, 500); }
  else showToast(result.error, 'error');
}

// Load sponsored products on homepage
async function loadSponsoredProducts() {
  try {
    const res = await fetch('/api/products/sponsored');
    const products = await res.json();
    const section = document.getElementById('sponsored');
    if (!products.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    document.getElementById('sponsoredGrid').innerHTML = products.map(p => `
      <div class="product-card" style="border:2px solid #fde68a;">
        <div style="background:#fde68a;color:#92400e;font-size:.7rem;font-weight:700;padding:3px 10px;text-align:center;border-radius:4px 4px 0 0;">🚀 SPONSORED</div>
        <div class="product-image">${p.image || '📦'}</div>
        <div class="product-info">
          <div class="product-vendor">${p.vendorName}</div>
          <div class="product-name">${p.name}</div>
          <div class="product-price">$${p.price}</div>
          <div class="product-rating">⭐ ${p.rating} (${p.reviews})</div>
          <button class="add-to-cart-btn" onclick="addToCart('${p._id}','${p.name.replace(/'/g,"\\'")}',${p.price},'${(p.vendorName||'').replace(/'/g,"\\'")}')">Add to Cart</button>
        </div>
      </div>`).join('');
  } catch(err) { console.error(err); }
}

// Call on init
document.addEventListener('DOMContentLoaded', () => { loadSponsoredProducts(); });
