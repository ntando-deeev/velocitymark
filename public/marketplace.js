// ── STATE ─────────────────────────────────────────────────────────────────────
let cart=[],wishlist=[],vendorToken=localStorage.getItem('vendorToken'),vendorId=localStorage.getItem('vendorId');
let allProducts=[],currentCategory='all',currentSort='default',currentPage=1,appliedCoupon=null,allMyOrders=[];
const PAGE_SIZE=12;
try{cart=JSON.parse(localStorage.getItem('vm_cart'))||[];}catch(e){cart=[];}
try{wishlist=JSON.parse(localStorage.getItem('vm_wishlist'))||[];}catch(e){wishlist=[];}

document.addEventListener('DOMContentLoaded',()=>{loadProducts();loadVendors();updateCartUI();updateWishlistUI();loadHeroStats();initNavbar();checkAuthState();});

function initNavbar(){
  const hb=document.getElementById('hamburger'),nm=document.getElementById('navMenu');
  if(hb)hb.addEventListener('click',()=>nm.classList.toggle('open'));
  window.addEventListener('scroll',()=>document.getElementById('navbar')?.classList.toggle('scrolled',window.scrollY>40));
  document.addEventListener('click',e=>{if(!e.target.closest('.nav-search-wrap'))closeSearchDropdown();});
}

function checkAuthState(){
  if(vendorToken){
    const a=document.getElementById('authNavItem');
    if(a)a.innerHTML=`<button class="btn btn-primary btn-sm" onclick="openDashboard()">📊 Dashboard</button><button class="btn btn-ghost btn-sm" onclick="vendorLogout()" style="margin-left:.5rem">Logout</button>`;
  }
}

async function loadHeroStats(){
  try{
    const [pr,vr]=await Promise.all([fetch('/api/products?limit=1'),fetch('/api/vendors')]);
    const pd=await pr.json(),vd=await vr.json();
    const ps=document.getElementById('statProducts'),vs=document.getElementById('statSellers');
    const pCount=pd.total||500, vCount=Array.isArray(vd)?vd.length:0;
    if(ps){ if(typeof animateStatNumber==='function') animateStatNumber(ps,pCount,'+'); else ps.textContent=pCount+'+'; }
    if(vs){ if(typeof animateStatNumber==='function') animateStatNumber(vs,vCount,'+'); else vs.textContent=vCount+'+'; }
  }catch(e){}
}

// ── PRODUCTS ──────────────────────────────────────────────────────────────────
async function loadProducts(reset=true){
  if(reset){currentPage=1;allProducts=[];}
  const grid=document.getElementById('productsGrid');
  try{
    let url=`/api/products?page=${currentPage}&limit=${PAGE_SIZE}`;
    if(currentCategory!=='all')url+=`&category=${currentCategory}`;
    const res=await fetch(url),data=await res.json();
    const items=Array.isArray(data)?data:(data.products||[]);
    const total=data.total||items.length;
    if(reset)allProducts=items;else allProducts=[...allProducts,...items];
    renderProducts(sortItems(allProducts));
    const lmw=document.getElementById('loadMoreWrap');
    if(lmw)lmw.style.display=allProducts.length<total?'block':'none';
    loadSponsored();
  }catch(err){
    if(reset&&grid)grid.innerHTML='<p style="color:var(--text-muted);text-align:center;padding:3rem;grid-column:1/-1">Could not load products right now.</p>';
  }
}

function sortItems(items){
  const s=[...items];
  if(currentSort==='price-asc')return s.sort((a,b)=>a.price-b.price);
  if(currentSort==='price-desc')return s.sort((a,b)=>b.price-a.price);
  if(currentSort==='rating')return s.sort((a,b)=>(b.rating||0)-(a.rating||0));
  if(currentSort==='newest')return s.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  return s.sort((a,b)=>(b.featured?1:0)-(a.featured?1:0));
}

function renderProducts(items){
  const grid=document.getElementById('productsGrid');
  if(!items.length){grid.innerHTML='<p style="color:var(--text-muted);text-align:center;padding:3rem;grid-column:1/-1">No products found.</p>';return;}
  grid.innerHTML=items.map(p=>productCard(p)).join('');
}

function productCard(p){
  const inWish=wishlist.some(w=>w._id===p._id||w.name===p.name);
  const disc=p.originalPrice?Math.round((1-p.price/p.originalPrice)*100):0;
  const pid=JSON.stringify(p).replace(/"/g,'&quot;');
  const imgHtml=p.image&&p.image.startsWith('http')?`<img class="product-img" src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`:'';
  const emojiHtml=`<div class="product-emoji"${imgHtml?' style="display:none"':''}>${(!p.image||p.image.startsWith('http'))?'📦':p.image}</div>`;
  return `<div class="product-card" onclick="openProduct('${p._id||encodeURIComponent(p.name)}')">
    <div class="product-img-wrap">
      ${imgHtml}${emojiHtml}
      ${disc>0?`<span class="product-badge sale">-${disc}%</span>`:p.featured?'<span class="product-badge">Featured</span>':''}
      <button class="product-wish-btn ${inWish?'active':''}" onclick="event.stopPropagation();toggleWishlist(${pid})" title="Wishlist">
        <svg viewBox="0 0 24 24" fill="${inWish?'currentColor':'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </button>
    </div>
    <div class="product-info">
      ${p.vendorName?`<div class="product-vendor">by ${p.vendorName}</div>`:''}
      <div class="product-name">${p.name}</div>
      <div class="product-pricing"><span class="product-price">$${Number(p.price).toFixed(2)}</span>${p.originalPrice?`<span class="product-original">$${Number(p.originalPrice).toFixed(2)}</span>`:''}</div>
      <div class="product-rating"><span class="stars">★</span> ${p.rating||'4.5'} <span>(${p.reviews||0})</span></div>
      <button class="add-to-cart-btn" onclick="event.stopPropagation();addToCart(${pid})">Add to Cart</button>
    </div>
  </div>`;
}

async function loadMoreProducts(){currentPage++;await loadProducts(false);}
function filterCategory(cat,btn){currentCategory=cat;document.querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));if(btn)btn.classList.add('active');loadProducts();}
function sortProducts(val){currentSort=val;renderProducts(sortItems(allProducts));}

async function loadSponsored(){
  try{
    const res=await fetch('/api/products/sponsored'),data=await res.json();
    const sec=document.getElementById('sponsored'),grid=document.getElementById('sponsoredGrid');
    if(Array.isArray(data)&&data.length&&sec&&grid){sec.style.display='block';grid.innerHTML=data.map(p=>productCard(p)).join('');}
  }catch(e){}
}

// ── PRODUCT DETAIL ────────────────────────────────────────────────────────────
async function openProduct(idOrName){
  showModal('productModal');
  const content=document.getElementById('productModalContent');
  content.innerHTML='<div style="padding:3rem;text-align:center;color:var(--text-muted)">Loading...</div>';
  try{
    let p=allProducts.find(x=>x._id===idOrName||encodeURIComponent(x.name)===idOrName);
    if(!p){const res=await fetch(`/api/products/${idOrName}`);p=await res.json();}
    if(p&&p._id&&typeof trackRecentlyViewed==='function') trackRecentlyViewed(p);
    const inWish=wishlist.some(w=>w._id===p._id||w.name===p.name);
    const pid=JSON.stringify(p).replace(/"/g,'&quot;');
    content.innerHTML=`
      <div class="product-detail">
        <div class="product-detail-img" id="productGalleryMount-${p._id||'x'}"></div>
        <div class="product-detail-info">
          <div class="product-detail-badge">${p.category||''} ${p.vendorName?'· by '+p.vendorName:''}</div>
          <div class="product-detail-name">${p.name}</div>
          <div class="product-detail-rating"><span style="color:#f59e0b">★★★★★</span><span>${p.rating||'4.5'}</span><span style="color:var(--text-muted)">(${p.reviews||0} reviews)</span></div>
          <div class="product-detail-price">${Number(p.price).toFixed(2)}</div>
          ${p.originalPrice?`<div class="product-detail-original">Was ${Number(p.originalPrice).toFixed(2)}</div>`:''}
          <div class="product-detail-desc">${p.description||'No description available.'}</div>
          <div id="paymentPlansContainer-${p._id||'x'}"></div>
          <div class="product-detail-actions">
            <button class="btn btn-primary" onclick="addToCart(${pid});closeModal('productModal')">Add to Cart</button>
            <button id="wishBtn-${p._id}" class="btn btn-outline" onclick="toggleWishlist(${pid});updateWishBtnState('${p._id}')">${inWish?'♥ Saved':'♡ Save'}</button>
          </div>
          <div class="product-detail-vendor" id="vendorContact-${p._id||'x'}"></div>
        </div>
      </div>
      <div class="product-reviews">
        <h4>Reviews</h4>
        <div id="reviewsList-${p._id||'x'}">Loading reviews...</div>
        <div class="review-form">
          <h5>Write a Review</h5>
          <div class="stars-input" id="starsInput"><span onclick="setRating(1)">★</span><span onclick="setRating(2)">★</span><span onclick="setRating(3)">★</span><span onclick="setRating(4)">★</span><span onclick="setRating(5)">★</span></div>
          <div class="form-group" style="margin-top:.75rem"><input type="text" id="reviewName" placeholder="Your name"></div>
          <div class="form-group"><textarea id="reviewComment" rows="2" placeholder="Share your experience..."></textarea></div>
          <button class="btn btn-primary btn-sm" onclick="submitReview('${p._id}')">Post Review</button>
        </div>
      </div>`;
    if(p.vendorId)loadVendorContact(p.vendorId,`vendorContact-${p._id||'x'}`);
    if(p._id)loadProductReviews(p._id,`reviewsList-${p._id}`);
    if(p._id)loadBuyerPaymentPlans(p._id,p.price,`paymentPlansContainer-${p._id||'x'}`);
    // Render image gallery
    const galleryMount=document.getElementById(`productGalleryMount-${p._id||'x'}`);
    if(galleryMount&&typeof renderProductGallery==='function'){
      const imgs=Array.isArray(p.images)&&p.images.length?p.images:[p.image||'📦'];
      renderProductGallery(imgs,galleryMount);
    }
  }catch(e){content.innerHTML='<p style="color:var(--text-muted);padding:2rem">Could not load product details.</p>';}
}

function updateWishBtnState(id){
  const btn=document.getElementById('wishBtn-'+id);
  if(btn)btn.textContent=wishlist.some(w=>w._id===id)?'♥ Saved':'♡ Save';
}

async function loadVendorContact(vid,targetId){
  try{
    const res=await fetch(`/api/vendors/${vid}`),v=await res.json();
    const el=document.getElementById(targetId);
    if(!el||!v)return;
    let links='';
    const waNum=(v.whatsapp||v.contactPhone||'').replace(/\D/g,'');
    if(waNum)links+=`<a href="https://wa.me/${waNum}" target="_blank" class="contact-link whatsapp-link">💬 WhatsApp</a>`;
    if(v.contactPhone)links+=`<a href="tel:${v.contactPhone}" class="contact-link">📞 ${v.contactPhone}</a>`;
    if(v.contactEmail)links+=`<a href="mailto:${v.contactEmail}" class="contact-link">✉️ ${v.contactEmail}</a>`;
    if(v.website)links+=`<a href="${v.website}" target="_blank" class="contact-link">🌐 Website</a>`;
    if(v.location)links+=`<span class="contact-link">📍 ${v.location}</span>`;
    el.innerHTML=links?`<div style="font-size:.85rem;color:var(--text-muted);margin-bottom:.5rem">Seller: <strong style="color:var(--text)">${v.storeName||''}</strong>${v.verified?' '+velocityBadge('13'):''}</div><div class="contact-links">${links}</div>`:'';
  }catch(e){}
}

async function loadProductReviews(productId,targetId){
  try{
    const res=await fetch(`/api/products/${productId}/reviews`),reviews=await res.json();
    const el=document.getElementById(targetId);
    if(!el)return;
    if(!reviews.length){el.innerHTML='<p style="color:var(--text-muted);font-size:.9rem">No reviews yet. Be the first!</p>';return;}
    el.innerHTML=reviews.slice(0,5).map(r=>`<div class="review-card"><div class="review-header"><span class="review-name">${r.customerName}</span><span class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span></div><div class="review-text">${r.comment||''}</div></div>`).join('');
  }catch(e){}
}

let selectedRating=0;
function setRating(val){
  selectedRating=val;
  document.querySelectorAll('.stars-input span').forEach((s,i)=>s.classList.toggle('active',i<val));
}

async function submitReview(productId){
  const name=document.getElementById('reviewName')?.value.trim();
  const comment=document.getElementById('reviewComment')?.value.trim();
  if(!name||!selectedRating){showToast('Enter your name and select a rating','error');return;}
  try{
    const res=await fetch(`/api/products/${productId}/reviews`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerName:name,comment,rating:selectedRating})});
    const d=await res.json();
    if(d._id||d.success){showToast('Review posted!','success');loadProductReviews(productId,`reviewsList-${productId}`);}
    else showToast(d.error||'Failed','error');
  }catch(e){showToast('Error posting review','error');}
}

// ── VENDORS ───────────────────────────────────────────────────────────────────
async function loadVendors(){
  const grid=document.getElementById('vendorsGrid');
  try{
    const res=await fetch('/api/vendors'),data=await res.json();
    if(!Array.isArray(data)||!data.length){grid.innerHTML='<p style="color:var(--text-muted);text-align:center;grid-column:1/-1;padding:2rem">No sellers yet. Be the first!</p>';return;}
    grid.innerHTML=data.slice(0,8).map(v=>{
      const av=v.image&&v.image.startsWith('http')?`<img src="${v.image}" alt="${v.storeName}" style="width:64px;height:64px;border-radius:50%;object-fit:cover" onerror="this.style.display='none'">`:`<span style="font-size:1.8rem">${v.image||'🏪'}</span>`;
      return `<div class="seller-card" onclick="openSellerStore('${v._id}')">
        <div class="seller-avatar">${av}</div>
        <div class="seller-name">${v.storeName}${v.verified ? velocityBadge('15') : ''}</div>
        <div class="seller-category">${v.category||'General'}</div>
        <div class="seller-rating">★ ${v.rating||'5.0'} <span style="color:var(--text-muted)">(${v.reviews||0})</span></div>
        ${v.location?`<div style="font-size:.75rem;color:var(--text-muted);margin-top:.25rem">📍 ${v.location}</div>`:''}
      </div>`;
    }).join('');
  }catch(e){grid.innerHTML='<p style="color:var(--text-muted);text-align:center;grid-column:1/-1">Could not load sellers.</p>';}
}

async function openSellerStore(vid){
  showModal('productModal');
  const content=document.getElementById('productModalContent');
  content.innerHTML='<div style="padding:3rem;text-align:center;color:var(--text-muted)">Loading store...</div>';
  try{
    const [vRes,pRes]=await Promise.all([fetch(`/api/vendors/${vid}`),fetch(`/api/products?vendor=${vid}`)]);
    const v=await vRes.json(),pData=await pRes.json();
    const products=Array.isArray(pData)?pData:(pData.products||[]);
    const av=v.image&&v.image.startsWith('http')?`<img src="${v.image}" alt="${v.storeName}" style="width:64px;height:64px;border-radius:50%;object-fit:cover">`:`<span style="font-size:2.5rem">${v.image||'🏪'}</span>`;
    let contacts='';
    const waNum=(v.whatsapp||v.contactPhone||'').replace(/\D/g,'');
    if(waNum)contacts+=`<a href="https://wa.me/${waNum}" target="_blank" class="contact-link whatsapp-link">💬 WhatsApp</a>`;
    if(v.contactPhone)contacts+=`<a href="tel:${v.contactPhone}" class="contact-link">📞 ${v.contactPhone}</a>`;
    if(v.contactEmail)contacts+=`<a href="mailto:${v.contactEmail}" class="contact-link">✉️ ${v.contactEmail}</a>`;
    if(v.website)contacts+=`<a href="${v.website}" target="_blank" class="contact-link">🌐 Website</a>`;
    if(v.location)contacts+=`<span class="contact-link">📍 ${v.location}</span>`;
    content.innerHTML=`
      <div style="padding:.5rem">
        <div style="display:flex;align-items:center;gap:1.25rem;margin-bottom:1.5rem;flex-wrap:wrap">
          <div style="width:64px;height:64px;border-radius:50%;background:var(--bg-card2);display:flex;align-items:center;justify-content:center;overflow:hidden;border:2px solid var(--border-md);flex-shrink:0">${av}</div>
          <div>
            <h2 style="font-family:'Space Grotesk',sans-serif;font-size:1.5rem;margin-bottom:.2rem">${v.storeName}</h2>
            <div style="color:var(--text-muted);font-size:.85rem">${v.category||'General'} · ★ ${v.rating||'5.0'} ${v.verified?'· '+velocityBadge('14'):''}</div>
          </div>
        </div>
        ${v.storeDesc?`<p style="color:var(--text-muted);font-size:.9rem;margin-bottom:1rem">${v.storeDesc}</p>`:''}
        ${contacts?`<div class="contact-links" style="margin-bottom:1.5rem">${contacts}</div>`:''}
        <h4 style="margin-bottom:1rem;font-size:1rem">Products (${products.length})</h4>
        <div class="products-grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">
          ${products.length?products.map(p=>productCard(p)).join(''):'<p style="color:var(--text-muted)">No products listed yet.</p>'}
        </div>
      </div>`;
  }catch(e){document.getElementById('productModalContent').innerHTML='<p style="color:var(--text-muted);padding:2rem">Could not load store.</p>';}
}

// ── CART ──────────────────────────────────────────────────────────────────────
function saveCart(){localStorage.setItem('vm_cart',JSON.stringify(cart));}

function addToCart(p){
  const ex=cart.find(i=>i._id===p._id||i.name===p.name);
  if(ex)ex.quantity++;
  else cart.push({...p,quantity:1});
  saveCart();updateCartUI();
  showToast(`${p.name} added to cart`,'success');
}

function removeFromCart(key){
  cart=cart.filter(i=>i._id!==key&&i.name!==key);
  saveCart();updateCartUI();
}

function updateCartQty(key,qty){
  const item=cart.find(i=>i._id===key||i.name===key);
  if(item){item.quantity=Math.max(1,qty);saveCart();updateCartUI();}
}

function updateCartUI(){
  const count=cart.reduce((s,i)=>s+i.quantity,0);
  const el=document.getElementById('cartCount');
  if(el)el.textContent=count;
  const items=document.getElementById('cartItems');
  const footer=document.getElementById('cartFooter');
  if(!items)return;
  if(!cart.length){
    items.innerHTML='<div class="cart-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg><p>Your cart is empty</p></div>';
    if(footer)footer.style.display='none';return;
  }
  items.innerHTML=cart.map(i=>{
    const key=i._id||i.name;
    const img=i.image&&i.image.startsWith('http')?`<img src="${i.image}" alt="${i.name}" onerror="this.style.display='none'">`:`<span style="font-size:1.4rem">${i.image&&!i.image.startsWith('http')?i.image:'📦'}</span>`;
    return `<div class="cart-item">
      <div class="cart-item-img">${img}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${i.name}</div>
        <div class="cart-item-price">$${(i.price*i.quantity).toFixed(2)}</div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="updateCartQty('${key}',${i.quantity-1})">−</button>
          <span class="qty-val">${i.quantity}</span>
          <button class="qty-btn" onclick="updateCartQty('${key}',${i.quantity+1})">+</button>
        </div>
      </div>
      <button class="cart-item-del" onclick="removeFromCart('${key}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
    </div>`;
  }).join('');
  const total=cart.reduce((s,i)=>s+i.price*i.quantity,0);
  const tot=document.getElementById('cartTotal');
  if(tot)tot.textContent='$'+total.toFixed(2);
  if(footer)footer.style.display='block';
}

function toggleCart(){
  const sb=document.getElementById('cartSidebar'),ov=document.getElementById('sidebarOverlay');
  document.getElementById('wishlistSidebar')?.classList.remove('open');
  sb.classList.toggle('open');
  if(ov)ov.classList.toggle('open',sb.classList.contains('open'));
}

function closeAllSidebars(){
  document.getElementById('cartSidebar')?.classList.remove('open');
  document.getElementById('wishlistSidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}

function goToCheckout(){
  closeAllSidebars();
  renderOrderSummary();
  showModal('checkoutModal');
}

function renderOrderSummary(){
  const el=document.getElementById('orderSummary');
  if(!el)return;
  const sub=cart.reduce((s,i)=>s+i.price*i.quantity,0);
  let disc=0;
  if(appliedCoupon)disc=appliedCoupon.type==='percent'?(sub*appliedCoupon.value/100):appliedCoupon.value;
  el.innerHTML=`
    <div class="order-summary-line"><span>Subtotal (${cart.reduce((s,i)=>s+i.quantity,0)} items)</span><span>$${sub.toFixed(2)}</span></div>
    ${disc?`<div class="order-summary-line"><span>Discount (${appliedCoupon.code})</span><span style="color:#22c55e">-$${disc.toFixed(2)}</span></div>`:''}
    <div class="order-summary-line total"><span>Total</span><span>$${(sub-disc).toFixed(2)}</span></div>`;
}

// ── COUPON ────────────────────────────────────────────────────────────────────
async function applyCoupon(){
  const code=document.getElementById('couponInput')?.value.trim().toUpperCase();
  const result=document.getElementById('couponResult');
  if(!code){if(result)result.innerHTML='<p class="coupon-error">Enter a code</p>';return;}
  const sub=cart.reduce((s,i)=>s+i.price*i.quantity,0);
  try{
    const res=await fetch('/api/coupons/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,subtotal:sub})});
    const d=await res.json();
    if(d.success){
      appliedCoupon=d.coupon;
      if(result)result.innerHTML=`<p class="coupon-success">✓ Code applied — saving $${d.coupon.discount.toFixed(2)}</p>`;
      renderOrderSummary();
    }else{if(result)result.innerHTML=`<p class="coupon-error">${d.error}</p>`;}
  }catch(e){if(result)result.innerHTML='<p class="coupon-error">Could not validate code</p>';}
}

// ── CHECKOUT ──────────────────────────────────────────────────────────────────
async function processCheckout(e){
  e.preventDefault();
  if(!cart.length){showToast('Your cart is empty','error');return;}
  const btn=document.getElementById('checkoutBtn');
  if(btn){btn.disabled=true;btn.textContent='Processing...';}
  const name=document.getElementById('customerName')?.value;
  const email=document.getElementById('customerEmail')?.value;
  const addr=document.getElementById('shippingAddress')?.value;
  const sub=cart.reduce((s,i)=>s+i.price*i.quantity,0);
  let disc=0;
  if(appliedCoupon)disc=appliedCoupon.type==='percent'?(sub*appliedCoupon.value/100):appliedCoupon.value;
  try{
    const res=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      customerName:name,email,shippingAddress:addr,
      items:cart.map(i=>({productId:i._id,name:i.name,price:i.price,quantity:i.quantity,vendorId:i.vendorId})),
      couponCode:appliedCoupon?.code,subtotal:sub-disc
    })});
    const d=await res.json();
    if(d.success||d.orderId){
      cart=[];saveCart();updateCartUI();appliedCoupon=null;
      closeModal('checkoutModal');
      showOrderConfirmation(d.orderId||d.order?.orderId,email);
    }else{showToast(d.error||'Checkout failed','error');}
  }catch(err){showToast('Checkout error. Try again.','error');}
  finally{if(btn){btn.disabled=false;btn.textContent='Place Order';}}
}

function showOrderConfirmation(orderId,email){
  const content=document.getElementById('productModalContent');
  showModal('productModal');
  content.innerHTML=`
    <div style="text-align:center;padding:3rem 2rem">
      <div style="font-size:4rem;margin-bottom:1rem">🎉</div>
      <h2 style="font-family:'Space Grotesk',sans-serif;margin-bottom:.75rem">Order Placed!</h2>
      <p style="color:var(--text-muted);margin-bottom:.5rem">Order ID: <strong style="color:var(--accent)">${orderId||'Pending'}</strong></p>
      <p style="color:var(--text-muted);margin-bottom:2rem">Confirmation sent to <strong>${email}</strong></p>
      <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="openTrackOrder('${orderId}')">Track My Order</button>
        <button class="btn btn-ghost" onclick="closeModal('productModal')">Continue Shopping</button>
      </div>
    </div>`;
}

// ── WISHLIST ──────────────────────────────────────────────────────────────────
function saveWishlist(){localStorage.setItem('vm_wishlist',JSON.stringify(wishlist));}

function toggleWishlist(p){
  const idx=wishlist.findIndex(w=>w._id===p._id||w.name===p.name);
  if(idx>-1){wishlist.splice(idx,1);showToast('Removed from wishlist','info');}
  else{wishlist.push(p);showToast('Saved to wishlist','success');}
  saveWishlist();updateWishlistUI();
  document.querySelectorAll('.product-wish-btn').forEach(btn=>{
    const card=btn.closest('.product-card');
    if(card){const nameEl=card.querySelector('.product-name');if(nameEl&&nameEl.textContent===p.name){btn.classList.toggle('active',wishlist.some(w=>w.name===p.name));}}
  });
}

function updateWishlistUI(){
  const el=document.getElementById('wishlistCount');
  if(el)el.textContent=wishlist.length;
  const items=document.getElementById('wishlistItems');
  if(!items)return;
  if(!wishlist.length){items.innerHTML='<div class="cart-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><p>No saved items</p></div>';return;}
  items.innerHTML=wishlist.map(p=>{
    const img=p.image&&p.image.startsWith('http')?`<img src="${p.image}" alt="${p.name}" onerror="this.style.display='none'">`:`<span style="font-size:1.4rem">${p.image&&!p.image.startsWith('http')?p.image:'📦'}</span>`;
    const pid=JSON.stringify(p).replace(/"/g,'&quot;');
    return `<div class="cart-item">
      <div class="cart-item-img">${img}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${p.name}</div>
        <div class="cart-item-price">$${Number(p.price).toFixed(2)}</div>
        <button class="btn btn-primary btn-sm" style="margin-top:.4rem" onclick="addToCart(${pid})">Add to Cart</button>
      </div>
      <button class="cart-item-del" onclick="toggleWishlist(${pid})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>`;
  }).join('');
}

function toggleWishlistPanel(){
  const sb=document.getElementById('wishlistSidebar'),ov=document.getElementById('sidebarOverlay');
  document.getElementById('cartSidebar')?.classList.remove('open');
  sb.classList.toggle('open');
  if(ov)ov.classList.toggle('open',sb.classList.contains('open'));
}

// ── ORDER TRACKING ────────────────────────────────────────────────────────────
function openTrackOrder(orderId){
  closeModal('productModal');
  showModal('trackOrderModal');
  if(orderId){document.getElementById('trackInput').value=orderId;trackOrder();}
}

async function trackOrder(){
  const input=document.getElementById('trackInput')?.value.trim();
  const result=document.getElementById('trackResult');
  if(!input||!result)return;
  result.innerHTML='<p style="color:var(--text-muted)">Searching...</p>';
  try{
    const res=await fetch(`/api/orders/track?q=${encodeURIComponent(input)}`);
    const d=await res.json();
    if(d.error||(!d.orderId&&!Array.isArray(d))){result.innerHTML=`<p style="color:var(--accent2)">${d.error||'No order found with that ID or email.'}</p>`;return;}
    const orders=Array.isArray(d)?d:[d];
    result.innerHTML=orders.map(o=>{
      const steps=['Order Placed','Processing','Shipped','Delivered'];
      const statusIdx={'pending':1,'processing':2,'shipped':3,'delivered':4}[o.status?.toLowerCase()]||1;
      return `<div class="track-result-card" style="margin-bottom:1rem">
        <h4>Order ${o.orderId||o._id}</h4>
        <div class="track-status-row">
          <span class="order-status ${o.status}">${o.status||'pending'}</span>
          <span style="color:var(--text-muted);font-size:.85rem">$${(o.subtotal||0).toFixed(2)}</span>
        </div>
        ${o.shippingAddress?`<p style="font-size:.82rem;color:var(--text-muted);margin:.5rem 0">📍 ${o.shippingAddress}</p>`:''}
        <div class="track-progress">
          ${steps.map((s,i)=>`<div class="track-step ${i<statusIdx?'done':i===statusIdx-1?'active':''}">
            <div class="track-step-dot"></div><span>${s}</span>
          </div>`).join('')}
        </div>
      </div>`;
    }).join('');
  }catch(e){result.innerHTML='<p style="color:var(--accent2)">Could not retrieve order info.</p>';}
}

// ── SEARCH ────────────────────────────────────────────────────────────────────
let searchTimer=null;
function handleNavSearch(val){
  clearTimeout(searchTimer);
  const dd=document.getElementById('searchDropdown');
  if(!val.trim()){closeSearchDropdown();return;}
  searchTimer=setTimeout(async()=>{
    try{
      const res=await fetch(`/api/products?search=${encodeURIComponent(val)}&limit=6`);
      const data=await res.json();
      const items=Array.isArray(data)?data:(data.products||[]);
      if(!items.length){closeSearchDropdown();return;}
      dd.innerHTML=items.map(p=>{
        const img=p.image&&p.image.startsWith('http')?`<img src="${p.image}" alt="${p.name}" style="width:40px;height:40px;border-radius:8px;object-fit:cover">`:`<div style="width:40px;height:40px;border-radius:8px;background:var(--bg-card);display:flex;align-items:center;justify-content:center;font-size:1.2rem">${p.image||'📦'}</div>`;
        return `<div class="search-result-item" onclick="openProduct('${p._id||encodeURIComponent(p.name)}');closeSearchDropdown();document.getElementById('navSearch').value=''">
          ${img}<div><div class="search-result-name">${p.name}</div><div class="search-result-price">$${Number(p.price).toFixed(2)}</div></div>
        </div>`;
      }).join('');
      dd.classList.add('open');
    }catch(e){}
  },300);
}
function closeSearchDropdown(){const dd=document.getElementById('searchDropdown');if(dd)dd.classList.remove('open');}

// ── AUTH ──────────────────────────────────────────────────────────────────────
async function vendorLogin(e){
  e.preventDefault();
  const btn=e.target.querySelector('button[type="submit"]');
  if(btn){btn.disabled=true;btn.textContent='Logging in...';}
  try{
    const res=await fetch('/api/vendor/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('loginEmail').value,password:document.getElementById('loginPassword').value})});
    const d=await res.json();
    if(d.success){
      localStorage.setItem('vendorToken',d.token);localStorage.setItem('vendorId',d.vendor.id);
      vendorToken=d.token;vendorId=d.vendor.id;
      showToast('Welcome back, '+d.vendor.storeName,'success');
      closeModal('loginModal');checkAuthState();
    }else showToast(d.error||'Login failed','error');
  }catch(e){showToast('Login error','error');}
  finally{if(btn){btn.disabled=false;btn.textContent='Login to Store';}}
}

async function vendorRegister(e){
  e.preventDefault();
  const btn=e.target.querySelector('button[type="submit"]');
  if(btn){btn.disabled=true;btn.textContent='Creating store...';}
  try{
    const res=await fetch('/api/vendor/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      name:document.getElementById('regName').value,email:document.getElementById('regEmail').value,
      password:document.getElementById('regPassword').value,storeName:document.getElementById('storeName').value,
      storeDesc:document.getElementById('storeDesc').value,category:document.getElementById('storeCategory').value
    })});
    const d=await res.json();
    if(d.success){
      localStorage.setItem('vendorToken',d.token);localStorage.setItem('vendorId',d.vendorId);
      vendorToken=d.token;vendorId=d.vendorId;
      showToast('Store created! Welcome to VelocityMark 🎉','success');
      closeModal('loginModal');checkAuthState();
      // Auto-redirect seller to their dashboard after registration
      setTimeout(()=>openDashboard(),400);
    }else showToast(d.error||'Registration failed','error');
  }catch(e){showToast('Registration error','error');}
  finally{if(btn){btn.disabled=false;btn.textContent='Create My Store';}}
}

function vendorLogout(){
  localStorage.removeItem('vendorToken');localStorage.removeItem('vendorId');
  vendorToken=null;vendorId=null;
  const a=document.getElementById('authNavItem');
  if(a)a.innerHTML='<button class="btn btn-primary btn-sm" onclick="showModal(\'loginModal\')">Sell on VelocityMark</button>';
  showToast('Logged out','info');
}

function switchToRegister(){document.getElementById('loginForm').style.display='none';document.getElementById('registerForm').style.display='block';}
function switchToLogin(){document.getElementById('loginForm').style.display='block';document.getElementById('registerForm').style.display='none';}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
async function openDashboard(){
  showModal('dashboardModal');
  await loadDashboardData();
  switchDashTab('analytics',document.querySelector('.dash-tab'));
}

async function loadDashboardData(){
  try{
    const res=await fetch('/api/vendor/dashboard',{headers:{Authorization:`Bearer ${vendorToken}`}});
    const d=await res.json();
    const pc=document.getElementById('productCount'),oc=document.getElementById('orderCount'),tr=document.getElementById('totalRevenue');
    if(pc)pc.textContent=d.stats?.productCount??'0';
    if(oc)oc.textContent=d.stats?.orderCount??'0';
    if(tr)tr.textContent='$'+(d.stats?.totalRevenue||0).toFixed(2);
    if(d.vendor){
      setVal('profileStoreName',d.vendor.storeName);setVal('profileStoreDesc',d.vendor.storeDesc);
      setVal('profileCategory',d.vendor.category);setVal('profileImage',d.vendor.image);
      setVal('profileContactEmail',d.vendor.contactEmail);setVal('profileContactPhone',d.vendor.contactPhone);
      setVal('profileLocation',d.vendor.location);setVal('profileWebsite',d.vendor.website);
      setVal('profileWhatsapp',d.vendor.whatsapp);
    }
  }catch(e){}
}

function setVal(id,val){const el=document.getElementById(id);if(el&&val)el.value=val;}

function switchDashTab(name,btn){
  document.querySelectorAll('.dash-panel').forEach(p=>{p.style.display='none';p.classList.remove('active');});
  document.querySelectorAll('.dash-tab').forEach(t=>t.classList.remove('active'));
  const panel=document.getElementById('tab-'+name);
  if(panel){panel.style.display='block';panel.classList.add('active');}
  if(btn)btn.classList.add('active');
  if(name==='analytics')loadAnalytics();
  if(name==='products')loadMyProducts();
  if(name==='orders')loadMyOrders();
  if(name==='coupons')loadMyCoupons();
  if(name==='stock')loadStockOverview();
  if(name==='myshop')loadMyShop();
}

async function loadAnalytics(){
  try{
    const res=await fetch('/api/vendor/analytics',{headers:{Authorization:`Bearer ${vendorToken}`}});
    const d=await res.json();
    const ob=d.orderBreakdown||{};
    const obEl=document.getElementById('orderBreakdown');
    if(obEl)obEl.innerHTML=`<div class="ob-chip pending"><span>${ob.pending||0}</span><small>Pending</small></div><div class="ob-chip shipped"><span>${ob.shipped||0}</span><small>Shipped</small></div><div class="ob-chip delivered"><span>${ob.delivered||0}</span><small>Delivered</small></div><div class="ob-chip"><span>${ob.total||0}</span><small>Total</small></div>`;
    const days=d.salesByDay||[];const maxR=Math.max(...days.map(d=>d.revenue),1);
    const sc=document.getElementById('salesChart');
    if(sc)sc.innerHTML=days.map(d=>`<div class="bar-col"><div class="bar-val">$${d.revenue.toFixed(0)}</div><div class="bar" style="height:${Math.max((d.revenue/maxR)*100,3)}%"></div><div class="bar-label">${d.date.slice(5)}</div></div>`).join('');
    const tp=d.topProducts||[];const tpEl=document.getElementById('topProductsList');
    if(tpEl)tpEl.innerHTML=tp.length?tp.map(p=>`<div class="top-product-row"><span>${p.name}</span><span style="color:var(--accent)">${p.sold} sold</span></div>`).join(''):'<p style="color:var(--text-muted);font-size:.85rem">No sales yet</p>';
    const ls=d.lowStock||[];const lsEl=document.getElementById('lowStockList');
    if(lsEl)lsEl.innerHTML=ls.length?ls.map(p=>`<div class="low-stock-row"><span>${p.name}</span><span class="stock-badge ${p.stock===0?'out':'low'}">${p.stock===0?'Out':'Low: '+p.stock}</span></div>`).join(''):'<p style="color:#22c55e;font-size:.85rem">All stocked up ✓</p>';
  }catch(e){}
}

// ── PRODUCTS (DASHBOARD) ──────────────────────────────────────────────────────
function showAddProductForm(){
  const f=document.getElementById('addProductForm');
  if(f)f.style.display=f.style.display==='none'?'block':'none';
}

async function uploadProduct(){
  const name=document.getElementById('prodName')?.value.trim();
  const price=parseFloat(document.getElementById('prodPrice')?.value);
  const category=document.getElementById('prodCategory')?.value;
  if(!name||!price||!category){showToast('Name, price and category required','error');return;}
  try{
    const res=await fetch('/api/products/upload',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${vendorToken}`},body:JSON.stringify({
      name,price,
      originalPrice:parseFloat(document.getElementById('prodOriginal')?.value)||undefined,
      category,stock:parseInt(document.getElementById('prodStock')?.value)||999,
      sku:document.getElementById('prodSku')?.value,
      image:document.getElementById('prodImage')?.value||'📦',
      images:typeof collectGalleryImages==='function'?collectGalleryImages():[],
      description:document.getElementById('prodDesc')?.value,
      tags:(document.getElementById('prodTags')?.value||'').split(',').map(t=>t.trim()).filter(Boolean)
    })});
    const d=await res.json();
    if(d.success){
      showToast('Product added!','success');
      document.getElementById('addProductForm').style.display='none';
      // Save payment plans if any were added
      if(d.product&&d.product._id) await saveProductPaymentPlans(d.product._id);
      loadMyProducts();
    }
    else showToast(d.error||'Failed','error');
  }catch(e){showToast('Error adding product','error');}
}

async function loadMyProducts(){
  const list=document.getElementById('myProductsList');if(!list)return;
  list.innerHTML='<p style="color:var(--text-muted);font-size:.9rem">Loading...</p>';
  try{
    const res=await fetch('/api/vendor/products',{headers:{Authorization:`Bearer ${vendorToken}`}});
    const products=await res.json();
    if(!products.length){list.innerHTML='<p style="color:var(--text-muted)">No products yet. Add your first one above.</p>';return;}
    list.innerHTML=products.map(p=>{
      const img=p.image&&p.image.startsWith('http')?`<img src="${p.image}" alt="${p.name}" style="width:44px;height:44px;object-fit:cover;border-radius:8px">`:`<span style="font-size:1.4rem">${p.image&&!p.image.startsWith('http')?p.image:'📦'}</span>`;
      return `<div class="my-product-row">
        <div class="my-product-img">${img}</div>
        <div class="my-product-info">
          <div class="my-product-name">${p.name}</div>
          <div class="my-product-meta">$${p.price} · ${p.category} · Stock: ${p.stock}</div>
        </div>
        <div class="my-product-actions">
          <button class="btn btn-outline btn-sm" onclick="editProduct('${p._id}',${JSON.stringify(p).replace(/"/g,'&quot;')})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p._id}')">Delete</button>
        </div>
      </div>`;
    }).join('');
  }catch(e){list.innerHTML='<p style="color:var(--accent2)">Could not load products.</p>';}
}

function editProduct(id,p){
  // Prefill add form with existing data
  const f=document.getElementById('addProductForm');if(f)f.style.display='block';
  setVal('prodName',p.name);setVal('prodPrice',p.price);setVal('prodOriginal',p.originalPrice);
  setVal('prodStock',p.stock);setVal('prodSku',p.sku);setVal('prodImage',p.image);
  setVal('prodDesc',p.description);setVal('prodCategory',p.category);
  if(document.getElementById('prodTags'))document.getElementById('prodTags').value=(p.tags||[]).join(', ');
  // Load existing payment plans into the form
  if(typeof loadPaymentPlansIntoForm==='function') loadPaymentPlansIntoForm(p.paymentPlans||[]);
  // Load existing gallery images into the form
  if(typeof loadGalleryIntoForm==='function') loadGalleryIntoForm(p.images||[]);
  // Change button to update
  const btn=document.querySelector('#addProductForm .btn-primary');
  if(btn){btn.textContent='Update Product';btn.onclick=()=>updateProduct(id);}
}

async function updateProduct(id){
  try{
    const res=await fetch(`/api/products/${id}`,{method:'PUT',headers:{'Content-Type':'application/json','Authorization':`Bearer ${vendorToken}`},body:JSON.stringify({
      name:document.getElementById('prodName')?.value,price:parseFloat(document.getElementById('prodPrice')?.value),
      originalPrice:parseFloat(document.getElementById('prodOriginal')?.value)||undefined,
      category:document.getElementById('prodCategory')?.value,stock:parseInt(document.getElementById('prodStock')?.value)||999,
      sku:document.getElementById('prodSku')?.value,image:document.getElementById('prodImage')?.value||'📦',
      images:typeof collectGalleryImages==='function'?collectGalleryImages():[],
      description:document.getElementById('prodDesc')?.value,
      tags:(document.getElementById('prodTags')?.value||'').split(',').map(t=>t.trim()).filter(Boolean)
    })});
    const d=await res.json();
    if(d.success){
      showToast('Product updated!','success');
      document.getElementById('addProductForm').style.display='none';
      // Save payment plans
      await saveProductPaymentPlans(id);
      loadMyProducts();
    }
    else showToast(d.error||'Failed','error');
  }catch(e){showToast('Error updating','error');}
}

async function deleteProduct(id){
  if(!confirm('Delete this product?'))return;
  try{
    const res=await fetch(`/api/products/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${vendorToken}`}});
    const d=await res.json();
    if(d.success){showToast('Product deleted','info');loadMyProducts();}
    else showToast(d.error||'Failed','error');
  }catch(e){showToast('Error deleting','error');}
}

// ── ORDERS (DASHBOARD) ────────────────────────────────────────────────────────
async function loadMyOrders(){
  const list=document.getElementById('myOrdersList');if(!list)return;
  list.innerHTML='<p style="color:var(--text-muted);font-size:.9rem">Loading...</p>';
  try{
    const res=await fetch('/api/vendor/orders',{headers:{Authorization:`Bearer ${vendorToken}`}});
    allMyOrders=await res.json();renderOrders(allMyOrders);
  }catch(e){list.innerHTML='<p style="color:var(--accent2)">Could not load orders.</p>';}
}

function filterOrders(){
  const status=document.getElementById('orderStatusFilter')?.value;
  renderOrders(status?allMyOrders.filter(o=>o.status===status):allMyOrders);
}

function renderOrders(orders){
  const list=document.getElementById('myOrdersList');if(!list)return;
  if(!orders.length){list.innerHTML='<p style="color:var(--text-muted)">No orders yet.</p>';return;}
  list.innerHTML=orders.map(o=>`
    <div class="order-row">
      <div class="order-row-header">
        <span class="order-id">${o.orderId||o._id}</span>
        <span class="order-status ${o.status}">${o.status||'pending'}</span>
      </div>
      <div class="order-meta">$${(o.vendorEarnings||o.subtotal||0).toFixed(2)} · ${o.email||''} · ${new Date(o.createdAt).toLocaleDateString()}</div>
      ${o.shippingAddress?`<div style="font-size:.8rem;color:var(--text-muted);margin-top:.3rem">📍 ${o.shippingAddress}</div>`:''}
      <div class="order-actions">
        ${o.status==='pending'?`<button class="btn btn-primary btn-sm" onclick="updateOrderStatus('${o._id}','shipped')">Mark Shipped</button>`:''}
        ${o.status==='shipped'?`<button class="btn btn-primary btn-sm" onclick="updateOrderStatus('${o._id}','delivered')">Mark Delivered</button>`:''}
      </div>
    </div>`).join('');
}

async function updateOrderStatus(id,status){
  try{
    const res=await fetch(`/api/orders/${id}/status`,{method:'PUT',headers:{'Content-Type':'application/json','Authorization':`Bearer ${vendorToken}`},body:JSON.stringify({status})});
    const d=await res.json();
    if(d.success){showToast('Order updated','success');loadMyOrders();}
    else showToast(d.error||'Failed','error');
  }catch(e){showToast('Error updating order','error');}
}

// ── COUPONS ───────────────────────────────────────────────────────────────────
async function createCoupon(){
  const code=document.getElementById('couponCode')?.value.trim().toUpperCase();
  const type=document.getElementById('couponType')?.value;
  const value=parseFloat(document.getElementById('couponValue')?.value);
  if(!code||!type||!value){showToast('Code, type and value required','error');return;}
  try{
    const res=await fetch('/api/vendor/coupons',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${vendorToken}`},body:JSON.stringify({
      code,type,value,
      minOrder:parseFloat(document.getElementById('couponMin')?.value)||0,
      maxUses:parseInt(document.getElementById('couponMaxUses')?.value)||0,
      expiresAt:document.getElementById('couponExpiry')?.value||undefined
    })});
    const d=await res.json();
    if(d.success){showToast('Coupon created!','success');loadMyCoupons();}
    else showToast(d.error||'Failed','error');
  }catch(e){showToast('Error creating coupon','error');}
}

async function loadMyCoupons(){
  const list=document.getElementById('couponsList');if(!list)return;
  try{
    const res=await fetch('/api/vendor/coupons',{headers:{Authorization:`Bearer ${vendorToken}`}});
    const coupons=await res.json();
    if(!coupons.length){list.innerHTML='<p style="color:var(--text-muted)">No coupons yet.</p>';return;}
    list.innerHTML=coupons.map(c=>`
      <div class="coupon-row-item">
        <div class="coupon-info">
          <div class="coupon-code-badge">${c.code}</div>
          <div class="coupon-detail">${c.type==='percent'?c.value+'% off':'$'+c.value+' off'} ${c.minOrder?'· Min $'+c.minOrder:''} ${c.expiresAt?'· Expires '+new Date(c.expiresAt).toLocaleDateString():''}</div>
        </div>
        <div class="coupon-actions">
          <span style="font-size:.8rem;padding:3px 8px;border-radius:50px;background:${c.active?'rgba(34,197,94,.15)':'rgba(107,114,128,.15)'};color:${c.active?'#22c55e':'#9ca3af'}">${c.active?'Active':'Paused'}</span>
          <button class="btn btn-outline btn-sm" onclick="toggleCoupon('${c._id}')">${c.active?'Pause':'Enable'}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteCoupon('${c._id}')">Delete</button>
        </div>
      </div>`).join('');
  }catch(e){}
}

async function toggleCoupon(id){
  try{await fetch(`/api/vendor/coupons/${id}/toggle`,{method:'PUT',headers:{Authorization:`Bearer ${vendorToken}`}});loadMyCoupons();}catch(e){}
}
async function deleteCoupon(id){
  if(!confirm('Delete this coupon?'))return;
  try{await fetch(`/api/vendor/coupons/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${vendorToken}`}});showToast('Coupon deleted','info');loadMyCoupons();}catch(e){}
}

// ── STOCK ─────────────────────────────────────────────────────────────────────
async function loadStockOverview(){
  const list=document.getElementById('stockList');if(!list)return;
  try{
    const res=await fetch('/api/vendor/stock',{headers:{Authorization:`Bearer ${vendorToken}`}});
    const items=await res.json();
    if(!items.length){list.innerHTML='<p style="color:var(--text-muted)">No products to manage.</p>';return;}
    list.innerHTML=items.map(p=>`
      <div class="stock-row">
        <div class="stock-row-info">
          <div class="stock-row-name">${p.name}</div>
          <div class="stock-row-meta">${p.category||''} ${p.sku?'· SKU: '+p.sku:''}</div>
        </div>
        <div class="stock-controls">
          <span class="stock-badge ${p.status}">${p.status==='out'?'Out of Stock':p.status==='low'?'Low: '+p.stock:'In Stock: '+p.stock}</span>
          <input type="number" class="stock-input" id="stockQty-${p._id}" value="${p.stock}" min="0">
          <button class="btn btn-primary btn-sm" onclick="adjustStock('${p._id}','adjustment')">Update</button>
          <button class="btn btn-outline btn-sm" onclick="adjustStock('${p._id}','add')">+ Add</button>
        </div>
      </div>`).join('');
  }catch(e){}
}

async function adjustStock(productId,type){
  const qty=parseInt(document.getElementById('stockQty-'+productId)?.value)||0;
  try{
    const res=await fetch('/api/vendor/stock/adjust',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${vendorToken}`},body:JSON.stringify({productId,type,qty})});
    const d=await res.json();
    if(d.success){showToast('Stock updated','success');loadStockOverview();}
    else showToast(d.error||'Failed','error');
  }catch(e){showToast('Error updating stock','error');}
}

// ── STORE PROFILE ─────────────────────────────────────────────────────────────
async function saveStoreProfile(e){
  e.preventDefault();
  try{
    const res=await fetch('/api/vendor/profile',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':`Bearer ${vendorToken}`},body:JSON.stringify({
      storeName:document.getElementById('profileStoreName')?.value,
      storeDesc:document.getElementById('profileStoreDesc')?.value,
      category:document.getElementById('profileCategory')?.value,
      image:document.getElementById('profileImage')?.value,
      contactEmail:document.getElementById('profileContactEmail')?.value,
      contactPhone:document.getElementById('profileContactPhone')?.value,
      whatsapp:document.getElementById('profileWhatsapp')?.value,
      location:document.getElementById('profileLocation')?.value,
      website:document.getElementById('profileWebsite')?.value
    })});
    const d=await res.json();
    if(d.success)showToast('Profile saved!','success');
    else showToast(d.error||'Failed','error');
  }catch(e){showToast('Error saving profile','error');}
}

// ── MODALS ────────────────────────────────────────────────────────────────────
function showModal(id){
  const m=document.getElementById(id);if(m){m.classList.add('open');document.body.style.overflow='hidden';}
}
function closeModal(id){
  const m=document.getElementById(id);if(m){m.classList.remove('open');document.body.style.overflow='';}
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('.modal.open').forEach(m=>m.classList.remove('open'));document.body.style.overflow='';closeAllSidebars();}});

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(msg,type='info'){
  const container=document.getElementById('toastContainer');if(!container)return;
  const t=document.createElement('div');t.className=`toast ${type}`;
  const icons={success:'✓',error:'✕',info:'ℹ'};
  t.innerHTML=`<span>${icons[type]||'ℹ'}</span><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateY(10px)';setTimeout(()=>t.remove(),300);},3500);
}


// ── PAYMENT PLANS (BUYER) ──────────────────────────────────────────────────
async function loadBuyerPaymentPlans(productId, price, containerId) {
  try {
    const res = await fetch(`/api/products/${productId}/payment-plans`);
    const data = await res.json();
    const container = document.getElementById(containerId);
    if (!container) return;
    if (data.paymentPlans && data.paymentPlans.length > 0 && typeof renderBuyerPlans === 'function') {
      renderBuyerPlans(data.paymentPlans, price, container);
    }
  } catch (e) {}
}

// ── PAYMENT PLANS (SELLER DASHBOARD) ─────────────────────────────────────────
// Patch uploadProduct to include payment plans
const _origUploadProduct = typeof uploadProduct !== 'undefined' ? uploadProduct : null;

async function saveProductPaymentPlans(productId) {
  if (typeof collectPaymentPlans !== 'function') return;
  const plans = collectPaymentPlans();
  if (!plans.length) return;
  try {
    await fetch(`/api/products/${productId}/payment-plans`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` },
      body: JSON.stringify({ paymentPlans: plans })
    });
  } catch (e) {}
}

// ── VELOCITY VERIFIED BADGE ───────────────────────────────────────────────────
// Inline SVG badge shown on all verified shops — free, automatic on registration
function velocityBadge(size='18') {
  return `<span class="vm-verified-badge" title="VelocityMark Verified Shop" aria-label="Verified">
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="vm-badge-svg">
      <path d="M12 2L14.5 8.5H21.5L16 13L18 20L12 16L6 20L8 13L2.5 8.5H9.5L12 2Z" fill="url(#vmGrad)" stroke="none"/>
      <path d="M8.5 12.5L11 15L15.5 10" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <defs>
        <linearGradient id="vmGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#6366f1"/>
          <stop offset="100%" stop-color="#8b5cf6"/>
        </linearGradient>
      </defs>
    </svg>
    <span class="vm-badge-label">Verified</span>
  </span>`;
}

async function uploadImageFile(file) {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch('/api/upload/image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${vendorToken}` },
    body: fd
  });
  const d = await res.json();
  if (!d.success) throw new Error(d.error || 'Upload failed');
  return d.url;
}

async function handleProdImageUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  if (file.size > 8 * 1024 * 1024) { showToast('Image must be under 8 MB', 'error'); return; }
  showToast('Uploading image...', 'info');
  try {
    const url = await uploadImageFile(file);
    document.getElementById('prodImage').value = url;
    const prev = document.getElementById('prodImagePreview');
    if (prev) prev.innerHTML = `<img src="${url}" alt="preview" class="img-thumb-preview">`;
    showToast('Image uploaded ✓', 'success');
  } catch (e) { showToast('Upload failed: ' + e.message, 'error'); }
}

async function handleGalleryUpload(input) {
  if (!input.files || !input.files.length) return;
  const files = Array.from(input.files).slice(0, 5);
  showToast(`Uploading ${files.length} image(s)...`, 'info');
  try {
    const urls = [];
    for (const file of files) {
      if (file.size > 8 * 1024 * 1024) { showToast(`${file.name} is over 8 MB, skipped`, 'error'); continue; }
      const url = await uploadImageFile(file);
      urls.push(url);
    }
    // Fill gallery URL inputs
    const galleryInputs = document.querySelectorAll('.gallery-img-input');
    urls.forEach((url, i) => { if (galleryInputs[i]) galleryInputs[i].value = url; });
    // Show previews
    const prev = document.getElementById('galleryPreview');
    if (prev) prev.innerHTML = urls.map(u => `<img src="${u}" alt="gallery" class="img-thumb-preview">`).join('');
    showToast(`${urls.length} gallery image(s) uploaded ✓`, 'success');
  } catch (e) { showToast('Gallery upload failed: ' + e.message, 'error'); }
}

async function handleProfileImageUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  if (file.size > 8 * 1024 * 1024) { showToast('Image must be under 8 MB', 'error'); return; }
  showToast('Uploading logo...', 'info');
  try {
    const url = await uploadImageFile(file);
    document.getElementById('profileImage').value = url;
    const prev = document.getElementById('profileImagePreview');
    if (prev) prev.innerHTML = `<img src="${url}" alt="logo" class="img-thumb-preview" style="border-radius:50%">`;
    showToast('Logo uploaded ✓', 'success');
  } catch (e) { showToast('Upload failed: ' + e.message, 'error'); }
}

// ── MY SHOP TAB ───────────────────────────────────────────────────────────────

async function loadMyShop() {
  const preview = document.getElementById('myShopPreview');
  const linkEl = document.getElementById('myShopLink');
  if (!preview) return;
  preview.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:2rem">Loading your shop...</div>';
  try {
    const res = await fetch('/api/vendor/dashboard', { headers: { Authorization: `Bearer ${vendorToken}` } });
    const d = await res.json();
    const v = d.vendor;
    if (!v) { preview.innerHTML = '<p style="color:var(--accent2)">Could not load shop data.</p>'; return; }

    const shopUrl = `#sellers`;
    if (linkEl) {
      linkEl.href = `#sellers`;
      linkEl.onclick = (e) => { e.preventDefault(); closeModal('dashboardModal'); setTimeout(() => { const s = document.getElementById('sellers'); if(s) s.scrollIntoView({behavior:'smooth'}); }, 300); };
    }

    const avatar = v.image && v.image.startsWith('http')
      ? `<img src="${v.image}" alt="${v.storeName}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid var(--accent)">`
      : `<span style="font-size:3rem">${v.image || '🏪'}</span>`;

    // Load vendor products
    const prodRes = await fetch(`/api/vendor/products`, { headers: { Authorization: `Bearer ${vendorToken}` } });
    const products = await prodRes.json();

    preview.innerHTML = `
      <div class="my-shop-header">
        <div class="my-shop-avatar">${avatar}</div>
        <div class="my-shop-meta">
          <h2>${v.storeName || 'My Store'}${v.verified ? ' ' + velocityBadge('18') : ''}</h2>
          <p style="color:var(--text-muted);margin:.3rem 0">${v.storeDesc || 'No description yet — add one in Profile.'}</p>
          <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:.5rem">
            ${v.category ? `<span class="pill">${v.category}</span>` : ''}
            ${v.location ? `<span style="color:var(--text-muted);font-size:.85rem">📍 ${v.location}</span>` : ''}
            ${v.website ? `<a href="${v.website}" target="_blank" style="color:var(--accent);font-size:.85rem">🌐 Website</a>` : ''}
          </div>
          <div style="display:flex;gap:1rem;margin-top:.75rem;flex-wrap:wrap">
            ${v.whatsapp ? `<a href="https://wa.me/${v.whatsapp.replace(/\D/g,'')}" target="_blank" class="btn btn-outline btn-sm">💬 WhatsApp</a>` : ''}
            ${v.contactEmail ? `<a href="mailto:${v.contactEmail}" class="btn btn-outline btn-sm">✉️ Email</a>` : ''}
            ${v.contactPhone ? `<a href="tel:${v.contactPhone}" class="btn btn-outline btn-sm">📞 Call</a>` : ''}
          </div>
        </div>
      </div>
      <div class="my-shop-stats">
        <div class="my-shop-stat"><span>${products.length || 0}</span><small>Products</small></div>
        <div class="my-shop-stat"><span>${v.rating || '5.0'}</span><small>Rating ★</small></div>
        <div class="my-shop-stat"><span>${v.totalSales || 0}</span><small>Sales</small></div>
        <div class="my-shop-stat"><span class="plan-badge ${v.plan}">${(v.plan || 'free').toUpperCase()}</span><small>Plan</small></div>
      </div>
      <h4 style="margin:1.5rem 0 .75rem;font-size:1rem">My Products (${products.length})</h4>
      <div class="my-shop-products">
        ${products.length ? products.map(p => {
          const img = p.image && p.image.startsWith('http')
            ? `<img src="${p.image}" alt="${p.name}" style="width:100%;height:120px;object-fit:cover;border-radius:8px 8px 0 0">`
            : `<div style="height:80px;display:flex;align-items:center;justify-content:center;font-size:2.5rem">${p.image || '📦'}</div>`;
          return `<div class="my-shop-product-card">
            ${img}
            <div style="padding:.6rem">
              <div style="font-weight:600;font-size:.9rem;margin-bottom:.2rem">${p.name}</div>
              <div style="color:var(--accent);font-weight:700">${Number(p.price).toFixed(2)}</div>
              <div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem">Stock: ${p.stock ?? 0}</div>
            </div>
          </div>`;
        }).join('') : '<p style="color:var(--text-muted)">No products yet. Add some in the Products tab.</p>'}
      </div>
    `;
  } catch (e) {
    preview.innerHTML = '<p style="color:var(--accent2)">Could not load shop. Please try again.</p>';
  }
}
