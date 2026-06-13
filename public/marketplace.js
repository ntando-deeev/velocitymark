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
