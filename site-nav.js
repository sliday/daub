(function () {
  'use strict';
  function init() {
    document.querySelectorAll('.db-nav').forEach(function (nav, index) {
      const toggle = nav.querySelector('.db-nav__toggle');
      const links = nav.querySelector('.db-nav__links');
      if (!toggle || !links) return;
      if (!links.id) links.id = 'site-navigation-' + index;
      toggle.type = 'button';
      toggle.removeAttribute('onclick');
      toggle.setAttribute('aria-controls', links.id);
      function setOpen(open) {
        nav.classList.toggle('db-nav--open', open);
        toggle.setAttribute('aria-expanded', String(open));
      }
      toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('db-nav--open')); });
      links.addEventListener('click', function (event) { if (event.target.closest('a')) setOpen(false); });
      document.addEventListener('click', function (event) { if (!nav.contains(event.target)) setOpen(false); });
      nav.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && nav.classList.contains('db-nav--open')) {
          event.preventDefault();
          setOpen(false);
          toggle.focus();
        }
      });
      window.addEventListener('resize', function () { if (!toggle.getClientRects().length) setOpen(false); });
      setOpen(nav.classList.contains('db-nav--open'));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
