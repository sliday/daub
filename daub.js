/* ============================================================
   DAUB UI KIT — Interactive Behaviors
   Version 1.1
   IIFE module exposing window.DAUB = { init, toast, theme API }
   ============================================================ */
;(function() {
  'use strict';

  /* ----------------------------------------------------------
     Theme Manager
     ---------------------------------------------------------- */
  var THEMES = ['light', 'dark', 'grunge-light', 'grunge-dark'];
  var _grungeFontLoaded = false;
  var _userExplicitTheme = false;

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function setTheme(theme) {
    if (THEMES.indexOf(theme) === -1) return;
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('db-theme', theme); } catch(e) {}
    _userExplicitTheme = true;
    if (theme.indexOf('grunge') !== -1) loadGrungeFont();
    updateSwitcherUI();
  }

  function cycleTheme() {
    var current = getTheme();
    var idx = THEMES.indexOf(current);
    var next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next);
    return next;
  }

  function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem('db-theme'); } catch(e) {}

    if (stored && THEMES.indexOf(stored) !== -1) {
      document.documentElement.setAttribute('data-theme', stored);
      _userExplicitTheme = true;
      if (stored.indexOf('grunge') !== -1) loadGrungeFont();
    } else if (!document.documentElement.hasAttribute('data-theme')) {
      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }

    // Listen for OS theme changes
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var handler = function(e) {
        if (!_userExplicitTheme) {
          document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
          updateSwitcherUI();
        }
      };
      if (mq.addEventListener) mq.addEventListener('change', handler);
      else if (mq.addListener) mq.addListener(handler);
    }
  }

  function loadGrungeFont() {
    if (_grungeFontLoaded) return;
    _grungeFontLoaded = true;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Special+Elite&display=swap';
    document.head.appendChild(link);
  }

  /* ----------------------------------------------------------
     Theme Switcher UI
     ---------------------------------------------------------- */
  function initThemeSwitcher() {
    var switcher = document.querySelector('.db-theme-switcher');
    if (!switcher) return;

    switcher.querySelectorAll('.db-theme-switcher__btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var theme = btn.getAttribute('data-theme');
        if (theme) setTheme(theme);
      });
    });

    updateSwitcherUI();
  }

  function updateSwitcherUI() {
    var switcher = document.querySelector('.db-theme-switcher');
    if (!switcher) return;
    var current = getTheme();

    switcher.querySelectorAll('.db-theme-switcher__btn').forEach(function(btn) {
      var isActive = btn.getAttribute('data-theme') === current;
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  /* ----------------------------------------------------------
     Switch / Toggle
     ---------------------------------------------------------- */
  function initSwitches(root) {
    root.querySelectorAll('.db-switch').forEach(function(sw) {
      if (sw._dbInit) return;
      sw._dbInit = true;

      if (!sw.hasAttribute('role')) sw.setAttribute('role', 'switch');
      if (!sw.hasAttribute('tabindex')) sw.setAttribute('tabindex', '0');
      if (!sw.hasAttribute('aria-checked')) sw.setAttribute('aria-checked', 'false');

      sw.addEventListener('click', toggleSwitch);
      sw.addEventListener('keydown', function(e) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggleSwitch.call(sw);
        }
      });
    });
  }

  function toggleSwitch() {
    var on = this.getAttribute('aria-checked') === 'true';
    this.setAttribute('aria-checked', String(!on));
    this.dispatchEvent(new CustomEvent('db:change', { detail: { checked: !on } }));
  }

  /* ----------------------------------------------------------
     Tabs
     ---------------------------------------------------------- */
  function initTabs(root) {
    root.querySelectorAll('.db-tabs').forEach(function(tabs) {
      if (tabs._dbInit) return;
      tabs._dbInit = true;

      var tabList = tabs.querySelector('.db-tabs__list');
      var tabBtns = Array.from(tabList.querySelectorAll('.db-tabs__tab'));
      var panels = Array.from(tabs.querySelectorAll('.db-tabs__panel'));

      tabList.setAttribute('role', 'tablist');

      tabBtns.forEach(function(btn, i) {
        btn.setAttribute('role', 'tab');
        if (!btn.id) btn.id = 'db-tab-' + uid();
        var panel = panels[i];
        if (panel) {
          panel.setAttribute('role', 'tabpanel');
          if (!panel.id) panel.id = 'db-panel-' + uid();
          btn.setAttribute('aria-controls', panel.id);
          panel.setAttribute('aria-labelledby', btn.id);
        }
        var isSelected = btn.getAttribute('aria-selected') === 'true';
        if (!isSelected && i === 0 && !tabBtns.some(function(b) { return b.getAttribute('aria-selected') === 'true'; })) {
          isSelected = true;
        }
        setTabState(btn, panel, isSelected);

        btn.addEventListener('click', function() {
          selectTab(tabBtns, panels, i);
        });
      });

      tabList.addEventListener('keydown', function(e) {
        var idx = tabBtns.indexOf(document.activeElement);
        if (idx === -1) return;
        var next = -1;
        if (e.key === 'ArrowRight') next = (idx + 1) % tabBtns.length;
        else if (e.key === 'ArrowLeft') next = (idx - 1 + tabBtns.length) % tabBtns.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabBtns.length - 1;
        if (next >= 0) {
          e.preventDefault();
          tabBtns[next].focus();
          selectTab(tabBtns, panels, next);
        }
      });
    });
  }

  function selectTab(tabBtns, panels, idx) {
    tabBtns.forEach(function(btn, i) {
      setTabState(btn, panels[i], i === idx);
    });
  }

  function setTabState(btn, panel, selected) {
    btn.setAttribute('aria-selected', String(selected));
    btn.setAttribute('tabindex', selected ? '0' : '-1');
    if (panel) {
      if (selected) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    }
  }

  /* ----------------------------------------------------------
     Modal
     ---------------------------------------------------------- */
  function initModals(root) {
    root.querySelectorAll('[data-db-modal-trigger]').forEach(function(trigger) {
      if (trigger._dbInit) return;
      trigger._dbInit = true;

      trigger.addEventListener('click', function() {
        var id = trigger.getAttribute('data-db-modal-trigger');
        openModal(id, trigger);
      });
    });

    root.querySelectorAll('.db-modal-overlay').forEach(function(overlay) {
      if (overlay._dbInit) return;
      overlay._dbInit = true;

      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeModal(overlay);
      });

      var closeBtn = overlay.querySelector('.db-modal__close');
      if (closeBtn) {
        closeBtn.addEventListener('click', function() {
          closeModal(overlay);
        });
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var open = document.querySelector('.db-modal--open');
        if (open) closeModal(open);
      }
    });
  }

  var _lastModalTrigger = null;

  function openModal(id, trigger) {
    var overlay = document.getElementById(id);
    if (!overlay) return;
    _lastModalTrigger = trigger || null;
    overlay.classList.add('db-modal--open');
    overlay.setAttribute('aria-hidden', 'false');

    var modal = overlay.querySelector('.db-modal');
    if (modal) {
      var focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length) focusable[0].focus();

      overlay._dbTrap = function(e) {
        if (e.key !== 'Tab') return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      overlay.addEventListener('keydown', overlay._dbTrap);
    }

    document.body.style.overflow = 'hidden';
  }

  function closeModal(overlay) {
    overlay.classList.remove('db-modal--open');
    overlay.setAttribute('aria-hidden', 'true');
    if (overlay._dbTrap) {
      overlay.removeEventListener('keydown', overlay._dbTrap);
      overlay._dbTrap = null;
    }
    document.body.style.overflow = '';
    if (_lastModalTrigger) {
      _lastModalTrigger.focus();
      _lastModalTrigger = null;
    }
  }

  /* ----------------------------------------------------------
     Toast — built with safe DOM methods (no innerHTML)
     ---------------------------------------------------------- */
  function getToastStack() {
    var stack = document.querySelector('.db-toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'db-toast-stack';
      stack.setAttribute('aria-live', 'polite');
      stack.setAttribute('role', 'status');
      document.body.appendChild(stack);
    }
    return stack;
  }

  function createSvgIcon(type) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    function el(tag, attrs) {
      var e = document.createElementNS(ns, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    }

    if (type === 'success') {
      svg.appendChild(el('path', { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' }));
      svg.appendChild(el('polyline', { points: '22 4 12 14.01 9 11.01' }));
    } else if (type === 'error') {
      svg.appendChild(el('circle', { cx: '12', cy: '12', r: '10' }));
      svg.appendChild(el('line', { x1: '15', y1: '9', x2: '9', y2: '15' }));
      svg.appendChild(el('line', { x1: '9', y1: '9', x2: '15', y2: '15' }));
    } else if (type === 'warning') {
      svg.appendChild(el('path', { d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' }));
      svg.appendChild(el('line', { x1: '12', y1: '9', x2: '12', y2: '13' }));
      svg.appendChild(el('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' }));
    } else {
      svg.appendChild(el('circle', { cx: '12', cy: '12', r: '10' }));
      svg.appendChild(el('line', { x1: '12', y1: '16', x2: '12', y2: '12' }));
      svg.appendChild(el('line', { x1: '12', y1: '8', x2: '12.01', y2: '8' }));
    }
    return svg;
  }

  function createCloseIcon() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    var l1 = document.createElementNS(ns, 'line');
    l1.setAttribute('x1', '18'); l1.setAttribute('y1', '6');
    l1.setAttribute('x2', '6'); l1.setAttribute('y2', '18');
    var l2 = document.createElementNS(ns, 'line');
    l2.setAttribute('x1', '6'); l2.setAttribute('y1', '6');
    l2.setAttribute('x2', '18'); l2.setAttribute('y2', '18');
    svg.appendChild(l1);
    svg.appendChild(l2);
    return svg;
  }

  function toast(opts) {
    opts = opts || {};
    var type = opts.type || 'info';
    var title = opts.title || '';
    var message = opts.message || '';
    var duration = opts.duration !== undefined ? opts.duration : 4000;

    var el = document.createElement('div');
    el.className = 'db-toast db-toast--' + type;

    // Icon
    var iconWrap = document.createElement('span');
    iconWrap.className = 'db-toast__icon';
    iconWrap.appendChild(createSvgIcon(type));
    el.appendChild(iconWrap);

    // Content
    var content = document.createElement('div');
    content.className = 'db-toast__content';
    if (title) {
      var titleEl = document.createElement('div');
      titleEl.className = 'db-toast__title';
      titleEl.textContent = title;
      content.appendChild(titleEl);
    }
    var msgEl = document.createElement('div');
    msgEl.className = 'db-toast__message';
    msgEl.textContent = message;
    content.appendChild(msgEl);
    el.appendChild(content);

    // Close button
    var closeBtn = document.createElement('button');
    closeBtn.className = 'db-toast__close';
    closeBtn.setAttribute('aria-label', 'Dismiss');
    closeBtn.appendChild(createCloseIcon());
    closeBtn.addEventListener('click', function() { removeToast(el); });
    el.appendChild(closeBtn);

    var stack = getToastStack();
    stack.appendChild(el);

    if (duration > 0) {
      setTimeout(function() { removeToast(el); }, duration);
    }

    return el;
  }

  function removeToast(el) {
    if (!el || !el.parentNode) return;
    el.classList.add('db-toast--removing');
    setTimeout(function() {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 200);
  }

  /* ----------------------------------------------------------
     Stepper
     ---------------------------------------------------------- */
  function initSteppers(root) {
    root.querySelectorAll('.db-stepper').forEach(function(stepper) {
      if (stepper._dbInit) return;
      stepper._dbInit = true;
    });
  }

  /* ----------------------------------------------------------
     Tooltip
     ---------------------------------------------------------- */
  function initTooltips(root) {
    root.querySelectorAll('.db-tooltip-wrap').forEach(function(wrap) {
      if (wrap._dbInit) return;
      wrap._dbInit = true;

      var tip = wrap.querySelector('.db-tooltip');
      if (!tip) return;

      if (!tip.id) tip.id = 'db-tip-' + uid();
      var trigger = wrap.querySelector('[data-db-tooltip]') || wrap.children[0];
      if (trigger) trigger.setAttribute('aria-describedby', tip.id);
      tip.setAttribute('role', 'tooltip');
    });
  }

  /* ----------------------------------------------------------
     Slider — sync value display
     ---------------------------------------------------------- */
  function initSliders(root) {
    root.querySelectorAll('.db-slider').forEach(function(slider) {
      if (slider._dbInit) return;
      slider._dbInit = true;

      var input = slider.querySelector('.db-slider__input');
      var valueEl = slider.querySelector('.db-slider__value');
      if (!input || !valueEl) return;

      var update = function() { valueEl.textContent = input.value; };
      input.addEventListener('input', update);
      update();
    });
  }

  /* ----------------------------------------------------------
     Checkbox (CSS handles visual sync via :checked)
     ---------------------------------------------------------- */
  function initCheckboxes(root) {
    root.querySelectorAll('.db-checkbox').forEach(function(label) {
      if (label._dbInit) return;
      label._dbInit = true;
    });
  }

  /* ----------------------------------------------------------
     Radio (native inputs handle group management)
     ---------------------------------------------------------- */
  function initRadios(root) {
    root.querySelectorAll('.db-radio-group').forEach(function(group) {
      if (group._dbInit) return;
      group._dbInit = true;
    });
  }

  /* ----------------------------------------------------------
     Helpers
     ---------------------------------------------------------- */
  var _uid = 0;
  function uid() { return 'db' + (++_uid) + '_' + Math.random().toString(36).slice(2, 6); }

  /* ----------------------------------------------------------
     Init
     ---------------------------------------------------------- */
  function init(root) {
    root = root || document;
    initTheme();
    initSwitches(root);
    initTabs(root);
    initModals(root);
    initSteppers(root);
    initTooltips(root);
    initSliders(root);
    initCheckboxes(root);
    initRadios(root);
    initThemeSwitcher();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { init(); });
  } else {
    init();
  }

  /* ----------------------------------------------------------
     Public API
     ---------------------------------------------------------- */
  window.DAUB = {
    init: init,
    toast: toast,
    openModal: openModal,
    closeModal: closeModal,
    getTheme: getTheme,
    setTheme: setTheme,
    cycleTheme: cycleTheme,
    THEMES: THEMES
  };

})();
