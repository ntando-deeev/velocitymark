// Mobile Navigation
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');

if (hamburger) {
    hamburger.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
        });
    });
}

// Smooth Scroll
function scrollTo(selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

window.scrollTo = scrollTo;

// Load Services
async function loadServices() {
    try {
        const response = await fetch('/api/services');
        const services = await response.json();
        const servicesGrid = document.getElementById('servicesGrid');
        
        servicesGrid.innerHTML = services.map(service => `
            <div class="service-card">
                <h3>${service.name}</h3>
                <p>${service.description}</p>
                <div class="service-price">${service.price}</div>
                <ul>
                    ${service.features.map(feature => `<li>${feature}</li>`).join('')}
                </ul>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading services:', error);
    }
}

// Load Case Studies
async function loadCaseStudies() {
    try {
        const response = await fetch('/api/case-studies');
        const cases = await response.json();
        const casesGrid = document.getElementById('casesGrid');
        
        casesGrid.innerHTML = cases.map(caseItem => `
            <div class="case-card">
                <h3>${caseItem.title}</h3>
                <div class="case-meta">
                    <span class="case-badge">${caseItem.client}</span>
                    <span class="case-badge">${caseItem.industry}</span>
                </div>
                <p>${caseItem.services.join(', ')}</p>
                <div class="case-result">📈 ${caseItem.result}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading case studies:', error);
    }
}

// Load Team
async function loadTeam() {
    try {
        const response = await fetch('/api/team');
        const team = await response.json();
        const teamGrid = document.getElementById('teamGrid');
        
        teamGrid.innerHTML = team.map(member => `
            <div class="team-member">
                <div class="member-avatar">${member.image}</div>
                <div class="member-name">${member.name}</div>
                <div class="member-role">${member.role}</div>
                <p class="member-expertise">${member.expertise}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading team:', error);
    }
}

// Contact Form Handler
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData);
        
        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert('✅ ' + result.message);
                contactForm.reset();
                
                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                alert('❌ ' + (result.error || 'Something went wrong'));
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('❌ Error submitting form. Please try again.');
        }
    });
}

// Newsletter Form Handler
const newsletterForm = document.getElementById('newsletterForm');
if (newsletterForm) {
    newsletterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = newsletterForm.querySelector('input[type="email"]').value;
        
        try {
            const response = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert('✅ ' + result.message);
                newsletterForm.reset();
            } else {
                alert('❌ ' + (result.error || 'Something went wrong'));
            }
        } catch (error) {
            console.error('Error subscribing:', error);
            alert('❌ Error subscribing. Please try again.');
        }
    });
}

// Initialize on Page Load
document.addEventListener('DOMContentLoaded', () => {
    loadServices();
    loadCaseStudies();
    loadTeam();
    
    // Add scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeIn 0.6s ease-out forwards';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.service-card, .feature, .case-card, .team-member, .pricing-card').forEach(el => {
        observer.observe(el);
    });
});

// Performance: Add service worker for offline support
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
        // Service worker registration failed, app will work without offline support
    });
}

// Active nav link on scroll
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        if (pageYOffset >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').slice(1) === current) {
            link.classList.add('active');
        }
    });
});

// Add visual feedback for form interactions
document.querySelectorAll('input, textarea, select').forEach(field => {
    field.addEventListener('focus', function() {
        this.style.borderColor = 'white';
    });
    
    field.addEventListener('blur', function() {
        this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });
});

// Analytics tracking (optional - uncomment if using Google Analytics)
// function trackEvent(eventName, eventData) {
//     if (window.gtag) {
//         gtag('event', eventName, eventData);
//     }
// }

console.log('🚀 VelocityMark loaded successfully');
console.log('📧 Created by Mr Ntando Ofc');
console.log('🌍 Global Marketing Platform');
