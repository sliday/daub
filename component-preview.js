(function () {
  'use strict';
  const root = document.getElementById('preview-root');
  const overlays = { 'db-modal': ['openModal', '.db-modal-overlay'], 'db-modal-overlay': ['openModal', '.db-modal-overlay'], 'db-alert-dialog': ['openAlertDialog', '.db-alert-dialog'], 'db-sheet': ['openSheet', '.db-sheet'], 'db-drawer': ['openDrawer', '.db-drawer'], 'db-command': ['openCommand', '.db-command'] };

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) return;
    if (event.data?.type === 'daub:preview-reset') { location.replace(location.href); return; }
    if (event.data?.type !== 'daub:preview') return;
    const data = event.data;
    if (typeof data.html !== 'string' || typeof data.component !== 'string' || !window.DAUB) return;
    document.body.style.overflow = '';
    root.innerHTML = data.html;
    if (DAUB.THEMES.includes(data.theme)) {
      DAUB.setTheme(data.theme);
      const pair = Object.values(DAUB.THEME_FAMILIES).find((item) => item.light === data.theme || item.dark === data.theme);
      const scheme = pair?.dark === data.theme ? 'dark' : 'light';
      DAUB.setScheme(scheme);
      document.documentElement.style.colorScheme = scheme;
    }
    const overlay = overlays[data.component];
    if (overlay) {
      const target = root.querySelector(overlay[1]);
      if (target && !root.querySelector('[data-db-modal-trigger], [data-db-alert-dialog-trigger], [data-db-sheet-trigger], [data-db-drawer-trigger], [data-db-command-trigger], [data-db-trigger]')) {
        if (!target.id) target.id = 'preview-overlay';
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'db-btn db-btn--primary preview-trigger';
        trigger.textContent = 'Open ' + data.component.slice(3).replaceAll('-', ' ');
        trigger.addEventListener('click', () => DAUB[overlay[0]](target.id));
        root.prepend(trigger);
      }
    }
    if (data.component === 'db-toast-stack') {
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'db-btn db-btn--primary preview-trigger';
      trigger.textContent = 'Show notification';
      trigger.addEventListener('click', () => DAUB.toast({ title: 'Changes saved', message: 'Your settings are up to date.', type: 'success' }));
      root.prepend(trigger);
    }
    DAUB.init();
    requestAnimationFrame(() => DAUB.fixNestedRadius());
  });
  document.addEventListener('submit', (event) => event.preventDefault());
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (link) {
      event.preventDefault();
      const nav = link.closest('.db-nav-menu, .db-bottom-nav');
      if (nav) {
        const activeClass = nav.classList.contains('db-bottom-nav') ? 'db-bottom-nav__item--active' : 'db-nav-menu__item--active';
        for (const item of nav.querySelectorAll('a')) { item.classList.remove(activeClass); item.removeAttribute('aria-current'); }
        link.classList.add(activeClass);
        link.setAttribute('aria-current', 'page');
      }
    }
  });
  window.parent.postMessage({ type: 'daub:preview-ready' }, '*');
})();
