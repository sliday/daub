(function () {
  'use strict';
  const stylesheet = new URL('site-nav.css', document.currentScript?.src || location.href).href;
  if (!document.querySelector('link[data-site-nav-style]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = stylesheet;
    link.dataset.siteNavStyle = '';
    document.head.appendChild(link);
  }
  const primary = [
    ['Docs', 'components.html#getting-started', 'docs'],
    ['Components', 'components.html', 'components'],
    ['Layouts', 'demo.html', 'demo'],
    ['Themes', 'themes.html', 'themes'],
    ['Playground', 'playground.html', 'playground']
  ];
  const resources = [
    ['Chat demo', 'chat-demo.html', 'chat-demo'],
    ['Roadmap', 'roadmap.html', 'roadmap'],
    ['Case studies', 'case-studies.html', 'case-studies'],
    ['AI docs', 'llms.txt', 'llms']
  ];
  function navLink([label, href, key]) {
    return '<a href="' + href + '" data-page="' + key + '">' + label + '</a>';
  }
  function init() {
    document.querySelectorAll('.db-nav').forEach(function (nav, index) {
      if (nav.hasAttribute('data-site-nav')) return;
      nav.dataset.siteNav = '';
      nav.setAttribute('aria-label', 'Main');
      nav.innerHTML = '<a class="site-nav__brand site-brand" href="index.html" aria-label="DAUB home">DAUB</a>'
        + '<button type="button" class="site-nav__toggle" aria-label="Open site navigation" aria-expanded="false" aria-controls="site-navigation-' + index + '"><i data-lucide="menu" aria-hidden="true"></i></button>'
        + '<div class="site-nav__links" id="site-navigation-' + index + '">'
        + primary.map(navLink).join('')
        + '<div class="site-nav__resources"><button type="button" class="site-nav__resources-toggle" aria-expanded="false" aria-controls="site-resources-' + index + '">Resources<i data-lucide="chevron-down" aria-hidden="true"></i></button>'
        + '<div class="site-nav__resource-links" id="site-resources-' + index + '" hidden>' + resources.map(navLink).join('') + '</div></div>'
        + '<a class="site-nav__github" href="https://github.com/sliday/daub" target="_blank" rel="noopener" aria-label="GitHub (opens in new tab)"><i data-lucide="github" aria-hidden="true"></i><span>GitHub</span></a></div>';
      const toggle = nav.querySelector('.site-nav__toggle');
      const links = nav.querySelector('.site-nav__links');
      const resourceToggle = nav.querySelector('.site-nav__resources-toggle');
      const resourceLinks = nav.querySelector('.site-nav__resource-links');
      nav.querySelectorAll('a, button').forEach(function (control) { control.tabIndex = 0; });
      function setResources(open) {
        resourceToggle.setAttribute('aria-expanded', String(open));
        resourceLinks.hidden = !open;
      }
      function setOpen(open) {
        nav.classList.toggle('site-nav--open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close site navigation' : 'Open site navigation');
        if (!open) setResources(false);
      }
      function updateCurrent() {
        let page = location.pathname.split('/').filter(Boolean).pop()?.replace(/\.html$/, '') || 'index';
        if (page === 'theme-preview') page = 'themes';
        if (page === 'components' && /^#(getting-started|guide-title|installation|react|chat|themes)$/.test(location.hash)) page = 'docs';
        nav.querySelectorAll('[data-page]').forEach(function (link) {
          if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
          else link.removeAttribute('aria-current');
        });
        resourceToggle.classList.toggle('site-nav__current-group', resources.some(item => item[2] === page));
      }
      toggle.addEventListener('click', function () { toggle.focus(); setOpen(!nav.classList.contains('site-nav--open')); });
      resourceToggle.addEventListener('click', function () { resourceToggle.focus(); setResources(resourceLinks.hidden); });
      links.addEventListener('click', function (event) { if (event.target.closest('a')) setOpen(false); });
      document.addEventListener('click', function (event) { if (!nav.contains(event.target)) setOpen(false); });
      nav.addEventListener('focusout', function (event) { if (!nav.contains(event.relatedTarget)) setOpen(false); });
      nav.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        if (!resourceLinks.hidden) {
          event.preventDefault();
          setResources(false);
          resourceToggle.focus();
        } else if (nav.classList.contains('site-nav--open')) {
          event.preventDefault();
          setOpen(false);
          toggle.focus();
        }
      });
      window.addEventListener('resize', function () { if (!toggle.getClientRects().length) setOpen(false); });
      window.addEventListener('hashchange', updateCurrent);
      updateCurrent();
      setOpen(false);
    });
    if (window.lucide) window.lucide.createIcons();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
