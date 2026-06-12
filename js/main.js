/* ═══════════════════════════════════════════════════════════════
   MENLABO v3 — main.js
   Interactions, animations, and mobile UX
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ─── Mobile Menu ───
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('.nav-menu');
  const nav = document.querySelector('.site-nav');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const isOpen = toggle.classList.toggle('active');
      menu.classList.toggle('open');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close on link click
    menu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        toggle.classList.remove('active');
        menu.classList.remove('open');
        document.body.style.overflow = '';
      });
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        toggle.classList.remove('active');
        menu.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  // ─── Nav Scroll Effect ───
  if (nav) {
    let lastScroll = 0;
    const handleScroll = () => {
      const y = window.scrollY;
      nav.classList.toggle('scrolled', y > 60);
      lastScroll = y;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  // ─── Scroll Reveal (IntersectionObserver) ───
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length > 0 && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });

    reveals.forEach(el => revealObserver.observe(el));
  }

  // ─── Smooth Scroll for Anchor Links ───
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ─── Hero Parallax (subtle, mobile-friendly) ───
  const heroMedia = document.querySelector('.hero-media');
  if (heroMedia && window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
    const heroSection = document.querySelector('.hero');
    if (heroSection) {
      window.addEventListener('scroll', () => {
        const y = window.scrollY;
        const heroH = heroSection.offsetHeight;
        if (y < heroH) {
          const translate = y * 0.15;
          const scale = 1 + (y * 0.0002);
          heroMedia.style.transform = `translateY(${translate}px) scale(${scale})`;
        }
      }, { passive: true });
    }
  }

  // ─── Current Page Highlight ───
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-menu a, .nav-desktop a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // ─── Telephone Link for Mobile ───
  document.querySelectorAll('a[href^="tel:"]').forEach(link => {
    link.addEventListener('click', (e) => {
      // Allow default behavior on mobile
      if (window.innerWidth > 1024) {
        e.preventDefault();
        // Copy number to clipboard on desktop
        const number = link.href.replace('tel:', '');
        navigator.clipboard?.writeText(number);
      }
    });
  });

});
