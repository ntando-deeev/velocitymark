// ═══════════════════════════════════════════════════════════════════════════
//  PREMIUM FEATURES — VelocityMark
//  Scroll progress · Back-to-top · Dark mode · Cookie consent · Promo bar
//  Animated counters · Testimonials carousel · FAQ accordion
//  Recently viewed products
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initScrollProgress();
  initBackToTop();
  initTheme();
  initCookieConsent();
  initPromoBar();
  initTestimonials();
  initFaq();
  initAnimatedCounters();
  initRecentlyViewed();
});

// ── SCROLL PROGRESS BAR ──────────────────────────────────────────────────────
function initScrollProgress() {
  const bar = document.getElementById('scrollProgress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const total = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = total > 0 ? (scrolled / total * 100) + '%' : '0%';
  }, { passive: true });
}

// ── BACK TO TOP ──────────────────────────────────────────────────────────────
function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── DARK / LIGHT MODE TOGGLE ─────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('vm_theme') || 'dark';
  applyTheme(saved, false);
}

function toggleTheme() {
  const isLight = document.body.classList.contains('light-mode');
  const next = isLight ? 'dark' : 'light';
  applyTheme(next, true);
  localStorage.setItem('vm_theme', next);
}

function applyTheme(theme, animate) {
  const body = document.body;
  const iconDark  = document.getElementById('themeIconDark');
  const iconLight = document.getElementById('themeIconLight');
  if (theme === 'light') {
    body.classList.add('light-mode');
    if (iconDark)  iconDark.style.display  = 'none';
    if (iconLight) iconLight.style.display = '';
  } else {
    body.classList.remove('light-mode');
    if (iconDark)  iconDark.style.display  = '';
    if (iconLight) iconLight.style.display = 'none';
  }
}

// ── COOKIE CONSENT ────────────────────────────────────────────────────────────
function initCookieConsent() {
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;
  if (!localStorage.getItem('vm_cookies_decided')) {
    // Small delay so it doesn't compete with page load
    setTimeout(() => { banner.style.display = 'block'; }, 1500);
  }
}

function acceptCookies() {
  localStorage.setItem('vm_cookies_decided', 'accepted');
  hideCookieBanner();
}

function declineCookies() {
  localStorage.setItem('vm_cookies_decided', 'declined');
  hideCookieBanner();
}

function hideCookieBanner() {
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;
  banner.style.opacity = '0';
  banner.style.transition = 'opacity 0.4s';
  setTimeout(() => { banner.style.display = 'none'; }, 400);
}

// ── PROMO BAR ─────────────────────────────────────────────────────────────────
function initPromoBar() {
  const bar = document.getElementById('promoBar');
  if (!bar) return;
  // Show only for non-logged-in visitors who haven't dismissed it this session
  const dismissed = sessionStorage.getItem('vm_promo_dismissed');
  const loggedIn  = !!localStorage.getItem('vendorToken');
  if (!dismissed && !loggedIn) {
    bar.style.display = 'block';
  }
}

function hidePromoBar() {
  const bar = document.getElementById('promoBar');
  if (!bar) return;
  bar.style.opacity = '0';
  bar.style.transition = 'opacity 0.3s';
  setTimeout(() => { bar.style.display = 'none'; }, 300);
  sessionStorage.setItem('vm_promo_dismissed', '1');
}

// ── ANIMATED STAT COUNTERS ────────────────────────────────────────────────────
function initAnimatedCounters() {
  // Wait for hero stats to be populated by marketplace.js, then animate
  const observer = new MutationObserver(() => {
    const els = document.querySelectorAll('.stat-num[data-target]');
    els.forEach(el => animateCounter(el, parseInt(el.dataset.target)));
  });
  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) observer.observe(heroStats, { subtree: true, characterData: true, childList: true });
}

// Called externally from marketplace.js after stats load
function animateStatNumber(el, target, suffix = '+') {
  if (!el || el.dataset.animated) return;
  el.dataset.animated = '1';
  el.dataset.target = target;
  const duration = 1600;
  const start = performance.now();
  const from = 0;
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(from + (target - from) * eased);
    el.textContent = current.toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target.toLocaleString() + suffix;
  }
  requestAnimationFrame(step);
}

// ── TESTIMONIALS CAROUSEL ─────────────────────────────────────────────────────
let testimonialIndex = 0;
let testimonialTimer = null;
let testimonialPerPage = 1;

function initTestimonials() {
  const track = document.getElementById('testimonialsTrack');
  const dotsWrap = document.getElementById('testimonialDots');
  if (!track || !dotsWrap) return;

  const cards = track.querySelectorAll('.testimonial-card');
  const total = cards.length;

  function getPerPage() {
    return window.innerWidth >= 900 ? 3 : window.innerWidth >= 600 ? 2 : 1;
  }

  function getPageCount() {
    return Math.ceil(total / testimonialPerPage);
  }

  function buildDots() {
    dotsWrap.innerHTML = '';
    const pages = getPageCount();
    for (let i = 0; i < pages; i++) {
      const dot = document.createElement('button');
      dot.className = 'testimonial-dot' + (i === testimonialIndex ? ' active' : '');
      dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
      dot.onclick = () => goToTestimonial(i);
      dotsWrap.appendChild(dot);
    }
  }

  function goToTestimonial(idx) {
    testimonialPerPage = getPerPage();
    const pages = getPageCount();
    testimonialIndex = ((idx % pages) + pages) % pages;
    const cardWidth = cards[0].getBoundingClientRect().width;
    const gap = 24; // 1.5rem
    const offset = testimonialIndex * testimonialPerPage * (cardWidth + gap);
    track.style.transform = `translateX(-${offset}px)`;
    document.querySelectorAll('.testimonial-dot').forEach((d, i) => {
      d.classList.toggle('active', i === testimonialIndex);
    });
  }

  function autoPlay() {
    clearTimeout(testimonialTimer);
    testimonialTimer = setTimeout(() => {
      goToTestimonial(testimonialIndex + 1);
      autoPlay();
    }, 5000);
  }

  // Drag/swipe support
  let dragStartX = 0;
  let isDragging = false;
  track.addEventListener('mousedown',  e => { isDragging = true; dragStartX = e.clientX; });
  track.addEventListener('touchstart', e => { isDragging = true; dragStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('mousemove',  e => { if (!isDragging) return; e.preventDefault(); });
  track.addEventListener('mouseup',    e => {
    if (!isDragging) return; isDragging = false;
    const diff = e.clientX - dragStartX;
    if (Math.abs(diff) > 50) goToTestimonial(diff < 0 ? testimonialIndex + 1 : testimonialIndex - 1);
    autoPlay();
  });
  track.addEventListener('touchend', e => {
    if (!isDragging) return; isDragging = false;
    const diff = e.changedTouches[0].clientX - dragStartX;
    if (Math.abs(diff) > 50) goToTestimonial(diff < 0 ? testimonialIndex + 1 : testimonialIndex - 1);
    autoPlay();
  });

  // Pause on hover
  track.addEventListener('mouseenter', () => clearTimeout(testimonialTimer));
  track.addEventListener('mouseleave', autoPlay);

  // Recalculate on resize
  window.addEventListener('resize', () => {
    testimonialPerPage = getPerPage();
    testimonialIndex = 0;
    buildDots();
    goToTestimonial(0);
  });

  testimonialPerPage = getPerPage();
  buildDots();
  goToTestimonial(0);
  autoPlay();
}

// ── FAQ ACCORDION ─────────────────────────────────────────────────────────────
function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  if (!item) return;
  const isOpen = item.classList.contains('open');
  // Close all
  document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
  // Open clicked (unless it was already open)
  if (!isOpen) item.classList.add('open');
}

// ── RECENTLY VIEWED ───────────────────────────────────────────────────────────
const RECENTLY_VIEWED_KEY = 'vm_recently_viewed';
const RECENTLY_VIEWED_MAX = 8;

function trackRecentlyViewed(product) {
  if (!product || !product._id) return;
  try {
    let items = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
    // Remove if already present (move to front)
    items = items.filter(p => p._id !== product._id);
    items.unshift(product);
    if (items.length > RECENTLY_VIEWED_MAX) items = items.slice(0, RECENTLY_VIEWED_MAX);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(items));
  } catch (e) {}
}

function initRecentlyViewed() {
  try {
    const items = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
    if (items.length < 2) return; // Not worth showing for 0-1 items
    const section = document.getElementById('recentlyViewedSection');
    const grid = document.getElementById('recentlyViewedGrid');
    if (!section || !grid) return;
    section.style.display = '';
    // Use productCard from marketplace.js — available globally
    grid.innerHTML = items.map(p => {
      if (typeof productCard === 'function') return productCard(p);
      // Fallback minimal card
      return `<div class="product-card" onclick="openProduct('${p._id||encodeURIComponent(p.name)}')">
        <div class="product-img-wrap"><div class="product-emoji">📦</div></div>
        <div class="product-info">
          <div class="product-name">${p.name}</div>
          <div class="product-pricing"><span class="product-price">$${Number(p.price).toFixed(2)}</span></div>
        </div>
      </div>`;
    }).join('');
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════════════════
//  PAYMENT PLANS — Seller Dashboard + Buyer Product Detail
// ═══════════════════════════════════════════════════════════════════════════

// ── SELLER: Add a new plan row to the product form ───────────────────────────
window.addPaymentPlanRow = function(plan) {
  const container = document.getElementById('prodPaymentPlans');
  if (!container) return;
  const idx = container.children.length;
  const p = plan || {};
  const row = document.createElement('div');
  row.className = 'payment-plan-row';
  row.dataset.planIdx = idx;
  row.innerHTML = `
    <div>
      <input type="text" placeholder="Plan label (e.g. Pay in Full)" value="${p.label||''}"
             data-field="label" oninput="updatePlanRowId(this)">
    </div>
    <div>
      <select data-field="type" onchange="onPlanTypeChange(this)">
        <option value="full"          ${(p.type||'full')==='full'          ?'selected':''}>Pay in Full</option>
        <option value="installments"  ${(p.type||'')==='installments'      ?'selected':''}>Installments</option>
        <option value="deposit"       ${(p.type||'')==='deposit'           ?'selected':''}>Deposit + Balance</option>
      </select>
    </div>
    <div>
      <input type="number" min="1" max="24" placeholder="# pays" value="${p.installments||1}"
             data-field="installments" title="Number of payments" style="${(p.type||'full')==='full'?'opacity:0.4':''}" ${(p.type||'full')==='full'?'disabled':''}>
    </div>
    <div>
      <input type="number" min="0" max="100" placeholder="Dep %" value="${p.depositPct||''}"
             data-field="depositPct" title="Deposit %" style="${(p.type||'full')!=='deposit'?'opacity:0.4':''}" ${(p.type||'full')!=='deposit'?'disabled':''}>
    </div>
    <div>
      <select data-field="interval" ${(p.type||'full')==='full'?'disabled style="opacity:0.4"':''}>
        <option value="immediate" ${(p.interval||'immediate')==='immediate' ?'selected':''}>Immediate</option>
        <option value="weekly"    ${(p.interval||'')==='weekly'             ?'selected':''}>Weekly</option>
        <option value="biweekly"  ${(p.interval||'')==='biweekly'          ?'selected':''}>Bi-weekly</option>
        <option value="monthly"   ${(p.interval||'')==='monthly'           ?'selected':''}>Monthly</option>
      </select>
    </div>
    <button type="button" class="plan-remove-btn" onclick="this.closest('.payment-plan-row').remove()" title="Remove plan">✕</button>
  `;
  container.appendChild(row);
};

window.onPlanTypeChange = function(sel) {
  const row = sel.closest('.payment-plan-row');
  const instInput  = row.querySelector('[data-field="installments"]');
  const depInput   = row.querySelector('[data-field="depositPct"]');
  const intSelect  = row.querySelector('[data-field="interval"]');
  const type = sel.value;
  // Installments field
  if (type === 'installments') {
    instInput.disabled = false; instInput.style.opacity = '1';
  } else {
    instInput.disabled = true; instInput.style.opacity = '0.4';
  }
  // Deposit field
  if (type === 'deposit') {
    depInput.disabled = false; depInput.style.opacity = '1';
  } else {
    depInput.disabled = true; depInput.style.opacity = '0.4';
  }
  // Interval
  if (type === 'full') {
    intSelect.disabled = true; intSelect.style.opacity = '0.4';
  } else {
    intSelect.disabled = false; intSelect.style.opacity = '1';
  }
};

window.updatePlanRowId = function(input) {
  // Auto-generate ID from label
  const row = input.closest('.payment-plan-row');
  if (row) row.dataset.planId = input.value.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,20);
};

// Collect all plan rows into an array
window.collectPaymentPlans = function() {
  const rows = document.querySelectorAll('#prodPaymentPlans .payment-plan-row');
  return Array.from(rows).map(row => {
    const get = field => row.querySelector(`[data-field="${field}"]`);
    return {
      id:           (row.dataset.planId || 'plan_' + row.dataset.planIdx),
      label:        get('label')?.value?.trim() || 'Payment Plan',
      type:         get('type')?.value || 'full',
      installments: parseInt(get('installments')?.value) || 1,
      depositPct:   parseFloat(get('depositPct')?.value) || 0,
      interval:     get('interval')?.value || 'immediate',
    };
  }).filter(p => p.label);
};

// Load existing plans into form (called when editing a product)
window.loadPaymentPlansIntoForm = function(plans) {
  const container = document.getElementById('prodPaymentPlans');
  if (!container) return;
  container.innerHTML = '';
  (plans || []).forEach(p => addPaymentPlanRow(p));
};

// ── BUYER: Render plan selector on the product detail modal ─────────────────
window.renderBuyerPlans = function(plans, price, container) {
  if (!container || !plans || !plans.length) return;
  container.innerHTML = `
    <div class="buyer-plans-wrap">
      <label>💳 Choose how to pay</label>
      <div class="buyer-plan-options" id="buyerPlanOptions">
        ${plans.map((plan, i) => `
          <button type="button" class="buyer-plan-btn ${i===0?'selected':''}"
                  onclick="selectBuyerPlan(this,'${plan.id}',${price})"
                  data-plan='${JSON.stringify(plan).replace(/'/g,"&#39;")}'>
            <span class="plan-name">${plan.label}</span>
            <span class="plan-detail">${formatPlanDetail(plan, price)}</span>
          </button>
        `).join('')}
      </div>
      <div id="buyerPlanSummary"></div>
    </div>
  `;
  // Auto-select first
  const first = container.querySelector('.buyer-plan-btn');
  if (first) selectBuyerPlan(first, plans[0].id, price);
};

window.selectBuyerPlan = function(btn, planId, price) {
  document.querySelectorAll('.buyer-plan-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const plan = JSON.parse(btn.dataset.plan.replace(/&#39;/g,"'"));
  const summaryEl = document.getElementById('buyerPlanSummary');
  if (summaryEl) summaryEl.innerHTML = buildPlanSummary(plan, price);
  // Store chosen plan on window for cart
  window._selectedPaymentPlan = plan;
};

function formatPlanDetail(plan, price) {
  const p = Number(price);
  if (plan.type === 'full')         return `$${p.toFixed(2)} today`;
  if (plan.type === 'installments') {
    const amt = (p / plan.installments).toFixed(2);
    const freq = plan.interval === 'immediate' ? '' : ` ${plan.interval}`;
    return `${plan.installments}× $${amt}${freq}`;
  }
  if (plan.type === 'deposit') {
    const dep = (p * plan.depositPct / 100).toFixed(2);
    const bal = (p - parseFloat(dep)).toFixed(2);
    return `$${dep} deposit · $${bal} balance`;
  }
  return '';
}

function buildPlanSummary(plan, price) {
  const p = Number(price);
  let rows = '';
  if (plan.type === 'full') {
    rows = `<div class="plan-row"><span>Pay today</span><strong>$${p.toFixed(2)}</strong></div>`;
  } else if (plan.type === 'installments') {
    const each = (p / plan.installments).toFixed(2);
    const freq = { immediate:'immediately', weekly:'each week', biweekly:'every 2 weeks', monthly:'per month' }[plan.interval] || '';
    rows = `<div class="plan-row"><span>1st payment today</span><strong>$${each}</strong></div>
            <div class="plan-row"><span>${plan.installments - 1} more × $${each} ${freq}</span><strong>$${(each*(plan.installments-1)).toFixed(2)}</strong></div>
            <div class="plan-row"><span>Total</span><strong>$${p.toFixed(2)}</strong></div>`;
  } else if (plan.type === 'deposit') {
    const dep = (p * plan.depositPct / 100).toFixed(2);
    const bal = (p - parseFloat(dep)).toFixed(2);
    rows = `<div class="plan-row"><span>Deposit today (${plan.depositPct}%)</span><strong>$${dep}</strong></div>
            <div class="plan-row"><span>Balance on delivery</span><strong>$${bal}</strong></div>
            <div class="plan-row"><span>Total</span><strong>$${p.toFixed(2)}</strong></div>`;
  }
  const note = plan.note ? `<div class="buyer-plan-note">ℹ️ ${plan.note}</div>` : '';
  return `<div class="buyer-plan-summary">${rows}</div>${note}`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  PRODUCT IMAGE GALLERY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * renderProductGallery(images, container)
 * Called from marketplace.js when rendering the product detail modal.
 * images: string[] — array of image URLs (or emoji fallbacks)
 * container: DOM element to inject the gallery into
 */
window.renderProductGallery = function(images, container) {
  if (!container) return;

  // Filter to real URLs only; keep emoji fallback if nothing else
  const imgs = (images || []).filter(Boolean);
  if (!imgs.length) imgs.push('📦');

  let currentIdx = 0;

  function isUrl(s) { return s && (s.startsWith('http') || s.startsWith('//')); }

  function mainContent(src) {
    if (isUrl(src)) {
      return `<img class="gallery-main-img" id="galleryMainImg" src="${src}"
                   alt="Product image"
                   onerror="this.style.display='none';document.getElementById('galleryMainEmoji').style.display='flex'">
              <div class="gallery-main-emoji" id="galleryMainEmoji" style="display:none">📦</div>`;
    }
    return `<div class="gallery-main-emoji" id="galleryMainEmoji">${src}</div>`;
  }

  function thumbContent(src, i) {
    if (isUrl(src)) {
      return `<img src="${src}" alt="Thumb ${i+1}" onerror="this.parentElement.innerHTML='📦'">`;
    }
    return src;
  }

  const showArrows = imgs.length > 1;

  container.innerHTML = `
    <div class="product-gallery">
      <div class="gallery-main-wrap" id="galleryMainWrap" onclick="galleryZoom(${JSON.stringify(imgs).replace(/"/g,'&quot;')}, ${0})">
        ${mainContent(imgs[0])}
        ${showArrows ? `
          <button class="gallery-arrow prev" onclick="event.stopPropagation();galleryGo(-1)" aria-label="Previous">&#8249;</button>
          <button class="gallery-arrow next" onclick="event.stopPropagation();galleryGo(1)"  aria-label="Next">&#8250;</button>
        ` : ''}
        ${imgs.length > 1 ? `<div class="gallery-counter" id="galleryCounter">1 / ${imgs.length}</div>` : ''}
      </div>
      ${imgs.length > 1 ? `
        <div class="gallery-thumbs" id="galleryThumbs">
          ${imgs.map((src, i) => `
            <div class="gallery-thumb ${i===0?'active':''}" onclick="gallerySetIdx(${i})" data-idx="${i}">
              ${thumbContent(src, i)}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  // Store state on element for cross-function access
  container._galleryImgs = imgs;
  container._galleryIdx  = 0;
  window._activeGalleryContainer = container;

  // Keyboard navigation
  document.addEventListener('keydown', galleryKeyHandler);
};

window.galleryGo = function(dir) {
  const c = window._activeGalleryContainer;
  if (!c) return;
  const imgs = c._galleryImgs;
  c._galleryIdx = ((c._galleryIdx + dir) + imgs.length) % imgs.length;
  galleryUpdateDisplay(c);
};

window.gallerySetIdx = function(idx) {
  const c = window._activeGalleryContainer;
  if (!c) return;
  c._galleryIdx = idx;
  galleryUpdateDisplay(c);
};

function galleryUpdateDisplay(c) {
  const imgs = c._galleryImgs;
  const idx  = c._galleryIdx;
  const src  = imgs[idx];

  // Update main image
  const mainImg   = c.querySelector('#galleryMainImg');
  const mainEmoji = c.querySelector('#galleryMainEmoji');
  if (mainImg && src && src.startsWith('http')) {
    mainImg.style.opacity = '0';
    setTimeout(() => {
      mainImg.src = src;
      mainImg.style.display = '';
      if (mainEmoji) mainEmoji.style.display = 'none';
      mainImg.style.opacity = '1';
    }, 120);
  } else if (mainEmoji) {
    if (mainImg) mainImg.style.display = 'none';
    mainEmoji.textContent = src || '📦';
    mainEmoji.style.display = 'flex';
  }

  // Update counter
  const counter = c.querySelector('#galleryCounter');
  if (counter) counter.textContent = `${idx + 1} / ${imgs.length}`;

  // Update zoom onclick
  const wrap = c.querySelector('#galleryMainWrap');
  if (wrap) wrap.onclick = (e) => {
    if (e.target.classList.contains('gallery-arrow')) return;
    galleryZoom(imgs, idx);
  };

  // Update thumbnails
  c.querySelectorAll('.gallery-thumb').forEach(t => {
    t.classList.toggle('active', parseInt(t.dataset.idx) === idx);
  });
}

function galleryKeyHandler(e) {
  const overlay = document.getElementById('galleryZoomOverlay');
  if (overlay) {
    if (e.key === 'Escape')      closeGalleryZoom();
    if (e.key === 'ArrowRight')  galleryZoomGo(1);
    if (e.key === 'ArrowLeft')   galleryZoomGo(-1);
    return;
  }
  if (e.key === 'ArrowRight') galleryGo(1);
  if (e.key === 'ArrowLeft')  galleryGo(-1);
}

// ── ZOOM OVERLAY ─────────────────────────────────────────────────────────────
let _zoomImgs = [], _zoomIdx = 0;

window.galleryZoom = function(imgs, startIdx) {
  const src = imgs[startIdx];
  if (!src || !src.startsWith('http')) return; // don't zoom emojis
  _zoomImgs = imgs.filter(i => i && i.startsWith('http'));
  _zoomIdx  = _zoomImgs.indexOf(src);
  if (_zoomIdx < 0) _zoomIdx = 0;
  renderZoomOverlay();
};

function renderZoomOverlay() {
  let overlay = document.getElementById('galleryZoomOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'galleryZoomOverlay';
    overlay.className = 'gallery-zoom-overlay';
    overlay.onclick = (e) => { if (e.target === overlay || e.target.tagName === 'IMG') closeGalleryZoom(); };
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <button class="gallery-zoom-close" onclick="closeGalleryZoom()">✕</button>
    <img src="${_zoomImgs[_zoomIdx]}" alt="Zoomed product image">
  `;
  overlay.style.display = 'flex';
}

window.galleryZoomGo = function(dir) {
  _zoomIdx = ((_zoomIdx + dir) + _zoomImgs.length) % _zoomImgs.length;
  renderZoomOverlay();
};

window.closeGalleryZoom = function() {
  const overlay = document.getElementById('galleryZoomOverlay');
  if (overlay) { overlay.style.display = 'none'; overlay.innerHTML = ''; }
};

// ── SELLER: Collect gallery images from form ──────────────────────────────────
window.collectGalleryImages = function() {
  return Array.from(document.querySelectorAll('.gallery-img-input'))
    .map(i => i.value.trim())
    .filter(v => v.startsWith('http'));
};

// Load existing gallery into edit form
window.loadGalleryIntoForm = function(images) {
  const inputs = document.querySelectorAll('.gallery-img-input');
  // images[0] is already the primary (prodImage), so start from index 1
  const extras = (images || []).slice(1);
  inputs.forEach((input, i) => {
    input.value = extras[i] || '';
  });
};
