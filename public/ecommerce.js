// Sample Products
const SAMPLE_PRODUCTS = [
  { name: 'Wireless Headphones', category: 'electronics', price: 149.99, originalPrice: 199.99, rating: 4.8, reviews: 342, emoji: '🎧', featured: true },
  { name: 'Smart Watch', category: 'electronics', price: 299.99, originalPrice: 399.99, rating: 4.6, reviews: 218, emoji: '⌚', featured: true },
  { name: 'Leather Wallet', category: 'fashion', price: 49.99, rating: 4.7, reviews: 156, emoji: '👜', featured: false },
  { name: 'Running Shoes', category: 'sports', price: 129.99, originalPrice: 179.99, rating: 4.9, reviews: 524, emoji: '👟', featured: true },
  { name: 'Yoga Mat', category: 'sports', price: 39.99, rating: 4.5, reviews: 89, emoji: '🧘', featured: false },
  { name: 'Coffee Maker', category: 'home', price: 79.99, rating: 4.4, reviews: 203, emoji: '☕', featured: false },
  { name: 'Desk Lamp', category: 'home', price: 59.99, originalPrice: 89.99, rating: 4.6, reviews: 127, emoji: '💡', featured: true },
  { name: 'Bluetooth Speaker', category: 'electronics', price: 89.99, rating: 4.7, reviews: 345, emoji: '🔊', featured: false },
  { name: 'Fitness Tracker', category: 'sports', price: 179.99, rating: 4.8, reviews: 412, emoji: '⌚', featured: true },
  { name: 'Winter Jacket', category: 'fashion', price: 199.99, originalPrice: 299.99, rating: 4.5, reviews: 198, emoji: '🧥', featured: false },
  { name: 'Air Purifier', category: 'home', price: 189.99, rating: 4.3, reviews: 87, emoji: '💨', featured: false },
  { name: 'Sunglasses', category: 'fashion', price: 149.99, rating: 4.6, reviews: 267, emoji: '😎', featured: true }
];

let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currentCategory = 'all';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadProducts('all');
  updateCartUI();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('contactForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Thank you for reaching out! We\'ll respond soon.');
    e.target.reset();
  });

  document.getElementById('checkoutForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    processCheckout();
  });
}

function loadProducts(category) {
  currentCategory = category;
  const grid = document.getElementById('productsGrid');
  
  const filtered = category === 'all' 
    ? SAMPLE_PRODUCTS 
    : SAMPLE_PRODUCTS.filter(p => p.category === category);

  grid.innerHTML = filtered.map(product => `
    <div class="product-card" onclick="showProductDetail('${product.name}')">
      <div class="product-image">${product.emoji}</div>
      <div class="product-info">
        <div class="product-name">${product.name}</div>
        <div class="product-price">$${product.price.toFixed(2)}</div>
        ${product.originalPrice ? `<div style="text-decoration: line-through; color: #999; font-size: 0.9rem;">$${product.originalPrice.toFixed(2)}</div>` : ''}
        <div class="product-rating">⭐ ${product.rating} (${product.reviews} reviews)</div>
        <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart('${product.name}', ${product.price})">Add to Cart</button>
      </div>
    </div>
  `).join('');
}

function filterCategory(category) {
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  loadProducts(category);
}

function addToCart(name, price) {
  const existing = cart.find(item => item.name === name);
  
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ name, price, quantity: 1 });
  }
  
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartUI();
  showNotification(`Added ${name} to cart!`);
}

function removeFromCart(name) {
  cart = cart.filter(item => item.name !== name);
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartUI();
}

function updateQuantity(name, qty) {
  const item = cart.find(item => item.name === name);
  if (item) {
    item.quantity = Math.max(1, qty);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
  }
}

function updateCartUI() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById('cartCount').textContent = count;

  const cartItems = document.getElementById('cartItems');
  if (cart.length === 0) {
    cartItems.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
  } else {
    cartItems.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div>
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
        </div>
        <div class="cart-item-qty">
          <button onclick="updateQuantity('${item.name}', ${item.quantity - 1})">−</button>
          <span>${item.quantity}</span>
          <button onclick="updateQuantity('${item.name}', ${item.quantity + 1})">+</button>
        </div>
        <button class="remove-btn" onclick="removeFromCart('${item.name}')">Remove</button>
      </div>
    `).join('');
  }

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  document.getElementById('cartTotal').textContent = '$' + total.toFixed(2);
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
  document.getElementById('checkoutModal').classList.add('open');
}

function closeCheckout() {
  document.getElementById('checkoutModal').classList.remove('open');
}

async function processCheckout() {
  const name = document.getElementById('customerName').value;
  const email = document.getElementById('customerEmail').value;
  const address = document.getElementById('shippingAddress').value;

  if (!name || !email || !address || cart.length === 0) {
    alert('Please fill in all fields');
    return;
  }

  try {
    // Create checkout session with Stripe
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart,
        email,
        name,
        shippingAddress: address
      })
    });

    const data = await response.json();
    
    if (data.url) {
      // Redirect to Stripe checkout
      window.location.href = data.url;
    } else if (data.error) {
      alert('Checkout error: ' + data.error);
    }
  } catch (err) {
    alert('Payment error: ' + err.message);
  }
}

function showProductDetail(name) {
  const product = SAMPLE_PRODUCTS.find(p => p.name === name);
  if (product) {
    alert(`${product.name}\n\nPrice: $${product.price}\n\nRating: ${product.rating}⭐ (${product.reviews} reviews)\n\nAdd to cart to purchase!`);
  }
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 1rem 2rem; border-radius: 6px; z-index: 999; animation: slideIn 0.3s;';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.remove(), 3000);
}

function scrollTo(selector) {
  document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth' });
}

// Check for order success
if (new URLSearchParams(window.location.search).has('session_id')) {
  const sessionId = new URLSearchParams(window.location.search).get('session_id');
  const modal = document.getElementById('successModal');
  document.getElementById('orderMessage').textContent = `Order placed successfully! Session: ${sessionId.substring(0, 20)}...`;
  modal.classList.add('open');
  localStorage.removeItem('cart');
  location.href = '/?order_success=true';
}

// Mobile menu
document.getElementById('hamburger')?.addEventListener('click', () => {
  document.getElementById('navMenu').classList.toggle('active');
});
