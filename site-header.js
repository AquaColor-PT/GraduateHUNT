// site-header.js
// One shared top panel for every page.
// Change the name or the menu links below once, and every page that loads this file updates.
//
// On a page that is not in the menu (for example applicationform.html), you can choose which
// menu item to highlight: <div id="site-header" data-active="alljobs.html"></div>

(function () {
  'use strict';

  var BRAND = 'GraduateInHunt';
  var HOME = 'homepageRegisteredUser.html';

  var LINKS = [
    {
      href: 'homepageRegisteredUser.html',
      label: 'Home',
      icon: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>'
    },
    {
      href: 'graduate-profile.html',
      label: 'My Profile',
      icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
    },
    {
      href: 'alljobs.html',
      label: 'All Jobs',
      icon: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>'
    }
  ];

  var CSS = [
    '.gh-topbar{position:sticky;top:0;z-index:100;background:rgba(255,255,255,0.9);',
    '-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);',
    'border-bottom:1px solid #e2e8f0;padding-top:env(safe-area-inset-top,0px);',
    "font-family:'Inter',Arial,sans-serif;}",
    '.gh-topbar *{box-sizing:border-box;}',
    '.gh-inner{max-width:1000px;margin:0 auto;padding:10px 16px;display:flex;',
    'align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 16px;}',
    '.gh-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#0f172a;',
    'font-weight:800;font-size:1.1rem;letter-spacing:-0.02em;}',
    '.gh-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;',
    'background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:#fff;font-weight:800;}',
    '.gh-nav{display:flex;gap:4px;}',
    '.gh-link{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;',
    'color:#64748b;font-weight:600;font-size:0.95rem;text-decoration:none;',
    'transition:background 0.2s,color 0.2s;}',
    '.gh-link svg{width:18px;height:18px;flex:0 0 auto;}',
    '.gh-link:hover,.gh-link[aria-current="page"]{background:#eef2ff;color:#1e3a8a;}',
    '.gh-link:focus-visible,.gh-brand:focus-visible{outline:3px solid #f5b800;outline-offset:2px;}',
    '@media (max-width:640px){',
    '.gh-nav{width:100%;justify-content:space-between;}',
    '.gh-link{flex:1;justify-content:center;padding:8px 6px;font-size:0.88rem;gap:6px;}',
    '.gh-link svg{width:16px;height:16px;}',
    '}',
    '@media (prefers-reduced-motion:reduce){.gh-link{transition:none;}}'
  ].join('');

  function addStyles() {
    if (document.getElementById('gh-header-styles')) return;
    var style = document.createElement('style');
    style.id = 'gh-header-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // Loads the Inter font if the page has not already done so
  function addFont() {
    if (document.querySelector('link[href*="family=Inter"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap';
    document.head.appendChild(link);
  }

  function build() {
    var host = document.getElementById('site-header');
    if (!host) return;

    var current = (
      host.getAttribute('data-active') ||
      location.pathname.split('/').pop() ||
      'index.html'
    ).toLowerCase();

    var header = document.createElement('header');
    header.className = 'gh-topbar';

    var inner = document.createElement('div');
    inner.className = 'gh-inner';

    var brand = document.createElement('a');
    brand.className = 'gh-brand';
    brand.href = HOME;

    var mark = document.createElement('span');
    mark.className = 'gh-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = BRAND.charAt(0);

    var name = document.createElement('span');
    name.textContent = BRAND;

    brand.appendChild(mark);
    brand.appendChild(name);

    var nav = document.createElement('nav');
    nav.className = 'gh-nav';
    nav.setAttribute('aria-label', 'Main');

    LINKS.forEach(function (item) {
      var a = document.createElement('a');
      a.className = 'gh-link';
      a.href = item.href;
      a.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + item.icon + '</svg>';

      var label = document.createElement('span');
      label.textContent = item.label;
      a.appendChild(label);

      if (item.href.toLowerCase() === current) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });

    inner.appendChild(brand);
    inner.appendChild(nav);
    header.appendChild(inner);

    // Replace the placeholder with the header itself, so it can stick to the top while scrolling
    host.replaceWith(header);
  }

  addStyles();
  addFont();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
