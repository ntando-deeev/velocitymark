// Global State
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let vendorToken = localStorage.getItem('vendorToken');
let vendorId = localStorage.getItem('vendorId');
let currentCategory = 'all';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadProducts('all');
  loadVendors();
  updateCartUI();
  if (vendorToken) loadVendorDashboard();
});

// ─── VENDOR AUTHENTICATION ────────────────────────────────────────────

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

  try {
    const res = await fetch('/api/vendor/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    
    if (result.success) {
      localStorage.setItem('vendorToken', result.token);
      localStorage.setItem('vendorId', result.vendorId);
      alert('✅ ' + result.message);
      closeModal('loginModal');
      location.reload();
    } else {
      alert('❌ ' + result.error);
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function vendorLogin(e) {
  e.preventDefault();
  
  const data = {
    email: document.getElementById('loginEmail').value,
    password: document.getElementById('loginPassword').value
  };

  try {
    const res = await fetch('/api/vendor/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    
    if (result.success) {
      localStorage.setItem('vendorToken', result.token);
      localStorage.setItem('vendorId', result.vendor.id);
      alert('✅ Welcome ' + result.vendor.storeName);
      closeModal('loginModal');
      location.reload();
    } else {
      alert('❌ ' + result.error);
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function switchToRegister() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
}

function switchToLogin() {
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
}

// ─── VENDOR DASHBOARD ─────────────────────────────────────────────────

async function loadVendorDashboard() {
  try {
    const res = await fetch('/api/vendor/dashboard', {
      headers: { 'Authorization': `Bearer ${vendorToken}` }
    });
    const data = await res.json();
    
    document.getElementById('productCount').textContent = data.stats.productCount;
    document.getElementById('orderCount').textContent = data.stats.orderCount;
    document.getElementById('totalRevenue').textContent = '$' + data.stats.totalRevenue.toFixed(2);
    
    // Update nav to show dashboard button
    const navMenu = document.getElementById('navMenu');
    navMenu.innerHTML += `
      <li>
        <button class="btn btn-primary btn-small" onclick="showModal('dashboardModal'); loadMyProducts(); loadMyOrders();">
          📊 Dashboard
        </button>
      </li>
      <li>
        <button class="btn btn-secondary btn-small" onclick="vendorLogout()">Logout</button>
      </li>
    `;
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

async function loadMyProducts() {
  try {
    const res = await fetch('/api/vendor/products', {
      headers: { 'Authorization': `Bearer ${vendorToken}` }
    });
    const products = await res.json();
    
    document.getElementById('myProductsList').innerHTML = products.map(p => `
      <div class="product-list-item">
        <div>${p.name}</div>
        <div>$${p.price}</div>
        <div>Stock: ${p.stock}</div>
        <button class="btn btn-small" onclick="deleteProduct('${p._id}')">Delete</button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading products:', err);
  }
}

async function loadMyOrders() {
  try {
    const res = await fetch('/api/vendor/orders', {
      headers: { 'Authorization': `Bearer ${vendorToken}` }
    });
    const orders = await res.json();
    
    document.getElementById('myOrdersList').innerHTML = orders.map(o => `
      <div class="order-item">
        <div>#${o.orderId}</div>
        <div>${o.email}</div>
        <div>$${o.vendorEarnings}</div>
        <select onchange="updateOrderStatus('${o._id}', this.value)">
          <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>Shipped</option>
          <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered</option>
        </select>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading orders:', err);
  }
}

async function uploadProduct(e) {
  e.preventDefault();
  
  const product = {
    name: document.getElementById('prodName').value,
    description: document.getElementById('prodDesc').value,
    price: parseFloat(document.getElementById('prodPrice').value),
    originalPrice: document.getElementById('prodOriginal').value ? parseFloat(document.getElementById('prodOriginal').value) : null,
    category: document.getElementById('prodCategory').value,
    stock: parseInt(document.getElementById('prodStock').value),
    tags: document.getElementById('prodTags').value.split(',').map(t => t.trim()),
    image: '📦'
  };

  try {
    const res = await fetch('/api/products/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendorToken}`
      },
      body: JSON.stringify(product)
    });
    const result = await res.json();
    
    if (result.success) {
      alert('✅ Product uploaded!');
      e.target.reset();
      loadMyProducts();
      loadProducts('all');
    } else {
      alert('❌ ' + result.error);
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function deleteProduct(productId) {
  if (!confirm('Delete this product?')) return;
  
  try {
    const res = await fetch(`/api/products/${productId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${vendorToken}` }
    });
    const result = await res.json();
    
    if (result.success) {
      alert('Product deleted');
      loadMyProducts();
      loadProducts('all');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    await fetch(`/api/vendor/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendorToken}`
      },
      body: JSON.stringify({ status })
    });
    alert('Order status updated!');
    loadMyOrders();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function vendorLogout() {
  localStorage.removeItem('vendorToken');
  localStorage.removeItem('vendorId');
  location.reload();
}

// ─── PRODUCTS (BUYER VIEW) ────────────────────────────────────────────

async function loadProducts(category) {
  currentCategory = category;
  
  try {
    const url = category === 'all' 
      ? '/api/products' 
      : `/api/products?category=${category}`;
    
    const res = await fetch(url);
    const products = await res.json();
    
    document.getElementById('productsGrid').innerHTML = products.map(p => `
      <div class="product-card">
        <div class="product-image">${p.image || '📦'}</div>
        <div class="product-info">
          <div class="product-vendor">${p.vendorName}</div>
          <div class="product-name">${p.name}</div>
          <div class="product-price">$${p.price}</div>
          ${p.originalPrice ? `<div class="product-original">$${p.originalPrice}</div>` : ''}
          <div class="product-rating">⭐ ${p.rating} (${p.reviews})</div>
          <button class="add-to-cart-btn" onclick="addToCart('${p._id}', '${p.name}', ${p.price}, '${p.vendorName}')">
            Add to Cart
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading products:', err);
  }
}

async function loadVendors() {
  try {
    const res = await fetch('/api/vendors');
    const vendors = await res.json();
    
    document.getElementById('vendorsGrid').innerHTML = vendors.slice(0, 6).map(v => `
      <div class="vendor-card">
        <div class="vendor-image">${v.image}</div>
        <h3>${v.storeName}</h3>
        <p>${v.storeDesc}</p>
        <div class="vendor-rating">⭐ ${v.rating}</div>
        <button class="btn btn-small" onclick="filterByVendor('${v._id}')">View Store</button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading vendors:', err);
  }
}

function filterCategory(cat) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  loadProducts(cat);
}

function searchProducts() {
  const search = document.getElementById('searchInput').value;
  if (search.length > 2) {
    fetch(`/api/products?search=${search}`)
      .then(r => r.json())
      .then(products => {
        document.getElementById('productsGrid').innerHTML = products.map(p => `
          <div class="product-card">
            <div class="product-image">${p.image || '📦'}</div>
            <div class="product-info">
              <div class="product-vendor">${p.vendorName}</div>
              <div class="product-name">${p.name}</div>
              <div class="product-price">$${p.price}</div>
              <button class="add-to-cart-btn" onclick="addToCart('${p._id}', '${p.name}', ${p.price}, '${p.vendorName}')">
                Add
              </button>
            </div>
          </div>
        `).join('');
      });
  }
}

// ─── SHOPPING CART ────────────────────────────────────────────────────

function addToCart(productId, name, price, vendor) {
  const existing = cart.find(item => item.productId === productId);
  
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ productId, name, price, vendorName: vendor, quantity: 1 });
  }
  
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartUI();
  alert(`✅ Added ${name} to cart!`);
}

function updateCartUI() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById('cartCount').textContent = count;

  const cartItems = document.getElementById('cartItems');
  if (cart.length === 0) {
    cartItems.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
  } else {
    cartItems.innerHTML = cart.map((item, i) => `
      <div class="cart-item">
        <div>
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-vendor">${item.vendorName}</div>
          <div class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
        </div>
        <div class="cart-item-qty">
          <button onclick="updateQty(${i}, ${item.quantity - 1})">−</button>
          <span>${item.quantity}</span>
          <button onclick="updateQty(${i}, ${item.quantity + 1})">+</button>
        </div>
        <button class="remove-btn" onclick="removeCart(${i})">✕</button>
      </div>
    `).join('');
  }

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  document.getElementById('cartTotal').textContent = '$' + total.toFixed(2);
}

function updateQty(i, qty) {
  if (qty < 1) return removeCart(i);
  cart[i].quantity = qty;
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartUI();
}

function removeCart(i) {
  cart.splice(i, 1);
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartUI();
}

function toggleCart() {
  document.getElementById('cartSidebar').classList.toggle('open');
}

function goToCheckout() {
  if (cart.length === 0) {
    alert('Your cart is empty!');
    return;
  }
  toggleCart();
  showModal('checkoutModal');
}

async function processCheckout(e) {
  e.preventDefault();
  
  const name = document.getElementById('customerName').value;
  const email = document.getElementById('customerEmail').value;
  const address = document.getElementById('shippingAddress').value;

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart,
        email,
        name,
        shippingAddress: address
      })
    });
    const data = await res.json();
    
    if (data.url) {
      window.location.href = data.url;
    }
  } catch (err) {
    alert('Payment error: ' + err.message);
  }
}

// ─── MODALS ───────────────────────────────────────────────────────────

function showModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tab).style.display = 'block';
  event.target.classList.add('active');
}

function scrollTo(selector) {
  document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth' });
}
