/* ============================================================
   DAUB UI KIT — Interactive Behaviors
   Version 2.2
   IIFE module exposing window.DAUB = { init, toast, theme API }
   ============================================================ */
;(function() {
  'use strict';

  /* ----------------------------------------------------------
     Theme Manager
     ---------------------------------------------------------- */
  var THEMES = [
    'light','dark','grunge-light','grunge-dark','solarized','solarized-dark','ink-light','ink','ember-light','ember','bone','bone-dark',
    'dracula','dracula-light','nord','nord-light','one-dark','one-dark-light','monokai','monokai-light','gruvbox','gruvbox-light',
    'night-owl','night-owl-light','github','github-dark','catppuccin','catppuccin-dark','tokyo-night','tokyo-night-light','material','material-light',
    'synthwave','synthwave-light','shades-of-purple','shades-of-purple-light','ayu','ayu-dark','horizon','horizon-light'
  ];

  var THEME_FAMILIES = {
    'default':    { light: 'light',        dark: 'dark' },
    'grunge':     { light: 'grunge-light',  dark: 'grunge-dark' },
    'solarized':  { light: 'solarized',     dark: 'solarized-dark' },
    'ink':        { light: 'ink-light',     dark: 'ink' },
    'ember':      { light: 'ember-light',   dark: 'ember' },
    'bone':       { light: 'bone',         dark: 'bone-dark' },
    'dracula':    { light: 'dracula-light', dark: 'dracula' },
    'nord':       { light: 'nord-light',    dark: 'nord' },
    'one-dark':   { light: 'one-dark-light',dark: 'one-dark' },
    'monokai':    { light: 'monokai-light', dark: 'monokai' },
    'gruvbox':    { light: 'gruvbox-light', dark: 'gruvbox' },
    'night-owl':  { light: 'night-owl-light',dark: 'night-owl' },
    'github':     { light: 'github',        dark: 'github-dark' },
    'catppuccin': { light: 'catppuccin',    dark: 'catppuccin-dark' },
    'tokyo-night':{ light: 'tokyo-night-light',dark: 'tokyo-night' },
    'material':   { light: 'material-light', dark: 'material' },
    'synthwave':  { light: 'synthwave-light',dark: 'synthwave' },
    'shades-of-purple':{ light: 'shades-of-purple-light',dark: 'shades-of-purple' },
    'ayu':        { light: 'ayu',           dark: 'ayu-dark' },
    'horizon':    { light: 'horizon-light', dark: 'horizon' }
  };
  var FAMILY_NAMES = [
    'default','grunge','solarized','ink','ember','bone',
    'dracula','nord','one-dark','monokai','gruvbox',
    'night-owl','github','catppuccin','tokyo-night','material',
    'synthwave','shades-of-purple','ayu','horizon'
  ];

  var THEME_CATEGORIES = {
    'originals': ['default','grunge','solarized','ink','ember','bone'],
    'classics':  ['dracula','nord','one-dark','monokai','gruvbox'],
    'modern':    ['night-owl','github','catppuccin','tokyo-night','material'],
    'trending':  ['synthwave','shades-of-purple','ayu','horizon']
  };
  var CATEGORY_NAMES = ['originals','classics','modern','trending'];

  function getCategory(family) {
    for (var i = 0; i < CATEGORY_NAMES.length; i++) {
      if (THEME_CATEGORIES[CATEGORY_NAMES[i]].indexOf(family) !== -1) return CATEGORY_NAMES[i];
    }
    return 'originals';
  }

  // Reverse lookup: theme name → { family, mode }
  var THEME_TO_FAMILY = {};
  Object.keys(THEME_FAMILIES).forEach(function(f) {
    THEME_TO_FAMILY[THEME_FAMILIES[f].light] = { family: f, mode: 'light' };
    THEME_TO_FAMILY[THEME_FAMILIES[f].dark]  = { family: f, mode: 'dark' };
  });

  var _grungeFontLoaded = false;
  var _userExplicitTheme = false;
  var _scheme = 'auto';

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
    requestAnimationFrame(function() { fixNestedRadius(); });
  }

  function cycleTheme() {
    var fam = getFamily();
    var idx = FAMILY_NAMES.indexOf(fam);
    var next = FAMILY_NAMES[(idx + 1) % FAMILY_NAMES.length];
    setFamily(next);
    return getTheme();
  }

  function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem('db-theme'); } catch(e) {}

    // Restore scheme
    var storedScheme = null;
    try { storedScheme = localStorage.getItem('db-scheme'); } catch(e) {}
    if (storedScheme && ['auto','light','dark'].indexOf(storedScheme) !== -1) {
      _scheme = storedScheme;
      document.documentElement.setAttribute('data-scheme', storedScheme);
    }

    if (stored && THEMES.indexOf(stored) !== -1) {
      document.documentElement.setAttribute('data-theme', stored);
      _userExplicitTheme = true;
      if (stored.indexOf('grunge') !== -1) loadGrungeFont();
    } else if (!document.documentElement.hasAttribute('data-theme')) {
      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }

    // Restore accent
    var storedAccent = null;
    try { storedAccent = localStorage.getItem('db-accent'); } catch(e) {}
    if (storedAccent) setAccent(storedAccent);

    // Listen for OS theme changes — only applies in auto scheme
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var handler = function(e) {
        if (_scheme === 'auto') {
          var family = getFamily();
          var target = THEME_FAMILIES[family][e.matches ? 'dark' : 'light'];
          setTheme(target);
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
     Scheme & Family API
     ---------------------------------------------------------- */
  function getScheme() { return _scheme; }

  function getFamily() {
    var info = THEME_TO_FAMILY[getTheme()];
    return info ? info.family : 'default';
  }

  function getEffectiveMode() {
    if (_scheme === 'auto')
      return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    return _scheme;
  }

  function setScheme(scheme) {
    if (['auto','light','dark'].indexOf(scheme) === -1) return;
    _scheme = scheme;
    try { localStorage.setItem('db-scheme', scheme); } catch(e) {}
    document.documentElement.setAttribute('data-scheme', scheme);
    var family = getFamily();
    var target = THEME_FAMILIES[family][getEffectiveMode()];
    if (target !== getTheme()) setTheme(target);
    updateSwitcherUI();
  }

  function setFamily(family) {
    if (!THEME_FAMILIES[family]) return;
    setTheme(THEME_FAMILIES[family][getEffectiveMode()]);
    document.dispatchEvent(new CustomEvent('daub:familychange', {detail: {family: family}}));
  }

  /* ----------------------------------------------------------
     Accent Color
     ---------------------------------------------------------- */
  function clamp(v) { return Math.max(0, Math.min(255, v)); }
  function hexToHSL(hex) {
    var r = parseInt(hex.slice(1,3),16)/255;
    var g = parseInt(hex.slice(3,5),16)/255;
    var b = parseInt(hex.slice(5,7),16)/255;
    var max = Math.max(r,g,b), min = Math.min(r,g,b);
    var h, s, l = (max+min)/2;
    if (max===min) { h=s=0; }
    else {
      var d=max-min;
      s=l>0.5?d/(2-max-min):d/(max+min);
      if(max===r) h=((g-b)/d+(g<b?6:0))/6;
      else if(max===g) h=((b-r)/d+2)/6;
      else h=((r-g)/d+4)/6;
    }
    return [h*360,s*100,l*100];
  }
  function hslToHex(h,s,l) {
    h/=360; s/=100; l/=100;
    var r,g,b;
    if(s===0){r=g=b=l;}
    else {
      var hue2rgb=function(p,q,t){if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};
      var q=l<0.5?l*(1+s):l+s-l*s;var p=2*l-q;
      r=hue2rgb(p,q,h+1/3);g=hue2rgb(p,q,h);b=hue2rgb(p,q,h-1/3);
    }
    return '#'+[r,g,b].map(function(x){var hex=Math.round(x*255).toString(16);return hex.length===1?'0'+hex:hex;}).join('');
  }
  function darken(hex, pct) {
    var hsl=hexToHSL(hex);
    return hslToHex(hsl[0],hsl[1],Math.max(0,hsl[2]-pct));
  }
  function lighten(hex, pct) {
    var hsl=hexToHSL(hex);
    return hslToHex(hsl[0],hsl[1],Math.min(100,hsl[2]+pct));
  }

  function setAccent(hex) {
    var r=parseInt(hex.slice(1,3),16);
    var g=parseInt(hex.slice(3,5),16);
    var b=parseInt(hex.slice(5,7),16);
    var root=document.documentElement;
    root.style.setProperty('--db-terracotta', hex);
    root.style.setProperty('--db-accent-rgb', r+','+g+','+b);
    root.style.setProperty('--db-accent-hover', darken(hex, 10));
    root.style.setProperty('--db-accent-pressed', darken(hex, 20));
    root.style.setProperty('--db-accent-dark', darken(hex, 15));
    root.style.setProperty('--db-accent-light', lighten(hex, 10));
    root.style.setProperty('--db-terracotta-text', darken(hex, 20));
    try { localStorage.setItem('db-accent', hex); } catch(e) {}
    updateAccentPickerUI();
  }

  function resetAccent() {
    var props=['--db-terracotta','--db-accent-rgb','--db-accent-hover',
      '--db-accent-pressed','--db-accent-dark','--db-accent-light','--db-terracotta-text'];
    props.forEach(function(p){document.documentElement.style.removeProperty(p);});
    try { localStorage.removeItem('db-accent'); } catch(e) {}
    updateAccentPickerUI();
  }

  function getAccent() {
    return getComputedStyle(document.documentElement).getPropertyValue('--db-terracotta').trim();
  }

  function updateAccentPickerUI() {
    var stored = null;
    try { stored = localStorage.getItem('db-accent'); } catch(e) {}
    document.querySelectorAll('.db-accent-picker__dot').forEach(function(btn) {
      var accent = btn.getAttribute('data-accent');
      var isActive = stored ? (accent === stored) : (accent === 'reset');
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  /* ----------------------------------------------------------
     Theme Switcher UI
     ---------------------------------------------------------- */
  var FAMILY_SWATCHES = {
    'default':{light:'#FAF8F0',dark:'#2C2824',accent:'#D48B6A'},
    'grunge':{light:'#EDE8DF',dark:'#1E1B17',accent:'#CC7F55'},
    'solarized':{light:'#fdf6e3',dark:'#073642',accent:'#2aa198'},
    'ink':{light:'#EEF0F5',dark:'#1C2030',accent:'#8B9DC3'},
    'ember':{light:'#F8F0E8',dark:'#201810',accent:'#D48B6A'},
    'bone':{light:'#FAFAFA',dark:'#1A1A1A',accent:'#A0A0A0'},
    'dracula':{light:'#FFFBEB',dark:'#282A36',accent:'#BD93F9'},
    'nord':{light:'#ECEFF4',dark:'#2E3440',accent:'#88C0D0'},
    'one-dark':{light:'#FAFAFA',dark:'#282C34',accent:'#61AFEF'},
    'monokai':{light:'#FAFAF8',dark:'#272822',accent:'#66D9EF'},
    'gruvbox':{light:'#FBF1C7',dark:'#282828',accent:'#FE8019'},
    'night-owl':{light:'#FBFBFB',dark:'#011627',accent:'#82AAFF'},
    'github':{light:'#FFFFFF',dark:'#0D1117',accent:'#58A6FF'},
    'catppuccin':{light:'#EFF1F5',dark:'#1E1E2E',accent:'#CBA6F7'},
    'tokyo-night':{light:'#D5D6DB',dark:'#1A1B26',accent:'#7AA2F7'},
    'material':{light:'#FAFAFA',dark:'#263238',accent:'#82AAFF'},
    'synthwave':{light:'#F5E6FF',dark:'#2B213A',accent:'#F92AAD'},
    'shades-of-purple':{light:'#F3EFFF',dark:'#2D2B55',accent:'#FAD000'},
    'ayu':{light:'#FAFAFA',dark:'#0B0E14',accent:'#FF8F40'},
    'horizon':{light:'#FDF0ED',dark:'#1C1E26',accent:'#E95678'}
  };
  var CATEGORY_LABELS = {originals:'Originals',classics:'Classics',modern:'Modern',trending:'Trending'};
  var FAMILY_LABELS = {
    'default':'Default','grunge':'Grunge','solarized':'Solar','ink':'Ink','ember':'Ember','bone':'Bone',
    'dracula':'Dracula','nord':'Nord','one-dark':'One Dark','monokai':'Monokai','gruvbox':'Gruvbox',
    'night-owl':'Night Owl','github':'GitHub','catppuccin':'Catppuccin','tokyo-night':'Tokyo','material':'Material',
    'synthwave':'Synthwave','shades-of-purple':'Purple','ayu':'Ayu','horizon':'Horizon'
  };

  function buildPopoverContent(popover) {
    while (popover.firstChild) popover.removeChild(popover.firstChild);
    for (var ci = 0; ci < CATEGORY_NAMES.length; ci++) {
      var cat = CATEGORY_NAMES[ci];
      var families = THEME_CATEGORIES[cat];
      var lbl = document.createElement('div');
      lbl.className = 'db-theme-switcher__category-label';
      lbl.textContent = CATEGORY_LABELS[cat];
      popover.appendChild(lbl);
      var row = document.createElement('div');
      row.className = 'db-theme-switcher__category-items';
      for (var fi = 0; fi < families.length; fi++) {
        var fam = families[fi];
        var sw = FAMILY_SWATCHES[fam] || {light:'#ccc',dark:'#333'};
        var item = document.createElement('button');
        item.className = 'db-theme-switcher__item';
        item.setAttribute('data-family', fam);
        item.setAttribute('aria-label', fam.replace(/-/g,' '));
        item.setAttribute('aria-pressed', 'false');
        item.title = (FAMILY_LABELS[fam] || fam);
        var dot = document.createElement('span');
        dot.className = 'db-theme-switcher__dot';
        var halfL = document.createElement('span');
        halfL.className = 'db-theme-switcher__dot-light';
        halfL.style.background = sw.light;
        var accentBar = document.createElement('span');
        accentBar.className = 'db-theme-switcher__dot-accent';
        accentBar.style.background = sw.accent;
        var halfD = document.createElement('span');
        halfD.className = 'db-theme-switcher__dot-dark';
        halfD.style.background = sw.dark;
        dot.appendChild(halfL);
        dot.appendChild(accentBar);
        dot.appendChild(halfD);
        item.appendChild(dot);
        var name = document.createElement('span');
        name.className = 'db-theme-switcher__name';
        name.textContent = FAMILY_LABELS[fam] || fam;
        item.appendChild(name);
        row.appendChild(item);
      }
      popover.appendChild(row);
    }
    var schemeRow = document.createElement('div');
    schemeRow.className = 'db-theme-switcher__scheme';
    ['auto','light','dark'].forEach(function(s) {
      var btn = document.createElement('button');
      btn.className = 'db-theme-switcher__scheme-btn';
      btn.setAttribute('data-scheme', s);
      btn.setAttribute('aria-label', s + ' mode');
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = s;
      schemeRow.appendChild(btn);
    });
    popover.appendChild(schemeRow);
  }

  function _createPaletteIcon() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    var p1 = document.createElementNS(ns, 'path');
    p1.setAttribute('d', 'm2 13.12 7.05-7.05a2 2 0 0 1 1.41-.59H14l2-2 4 4-2 2v3.54a2 2 0 0 1-.59 1.41L10.88 22');
    var p2 = document.createElementNS(ns, 'path');
    p2.setAttribute('d', 'm14.5 9.5-5 5');
    var p3 = document.createElementNS(ns, 'path');
    p3.setAttribute('d', 'm2.05 13.07 5.88 5.88');
    svg.appendChild(p1); svg.appendChild(p2); svg.appendChild(p3);
    return svg;
  }

  function initThemeSwitcher() {
    // Auto-populate empty theme switcher containers
    document.querySelectorAll('.db-theme-switcher').forEach(function(sw) {
      if (sw.querySelector('.db-theme-switcher__toggle')) return;
      var toggle = document.createElement('button');
      toggle.className = 'db-theme-switcher__toggle';
      toggle.setAttribute('aria-label', 'Open theme picker');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.appendChild(_createPaletteIcon());
      var popover = document.createElement('div');
      popover.className = 'db-theme-switcher__popover';
      sw.appendChild(toggle);
      sw.appendChild(popover);
    });

    // Build popover content
    document.querySelectorAll('.db-theme-switcher__popover').forEach(function(pop) {
      if (!pop._dbBuilt) { pop._dbBuilt = true; buildPopoverContent(pop); }
    });

    // Popover toggle
    document.querySelectorAll('.db-theme-switcher__toggle').forEach(function(btn) {
      if (btn._dbInit) return;
      btn._dbInit = true;
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var popover = btn.parentElement.querySelector('.db-theme-switcher__popover');
        if (!popover) return;
        var open = popover.hasAttribute('data-open');
        if (open) { popover.removeAttribute('data-open'); btn.setAttribute('aria-expanded','false'); }
        else { popover.setAttribute('data-open',''); btn.setAttribute('aria-expanded','true'); }
      });
    });

    // Close popover on outside click
    if (!document._dbPopoverClose) {
      document._dbPopoverClose = true;
      document.addEventListener('click', function(e) {
        document.querySelectorAll('.db-theme-switcher__popover[data-open]').forEach(function(pop) {
          var toggle = pop.parentElement.querySelector('.db-theme-switcher__toggle');
          if (!pop.contains(e.target) && (!toggle || !toggle.contains(e.target))) {
            pop.removeAttribute('data-open');
            if (toggle) toggle.setAttribute('aria-expanded','false');
          }
        });
      });
    }

    // Legacy data-theme buttons
    document.querySelectorAll('.db-showcase__theme-swatch[data-theme]').forEach(function(btn) {
      if (btn._dbInit) return; btn._dbInit = true;
      btn.addEventListener('click', function() { var t = btn.getAttribute('data-theme'); if (t) setTheme(t); });
    });

    // Family buttons (dots + configurator swatches)
    document.querySelectorAll('[data-family]').forEach(function(btn) {
      if (btn._dbInit) return; btn._dbInit = true;
      btn.addEventListener('click', function() { var f = btn.getAttribute('data-family'); if (f) setFamily(f); });
    });

    // Scheme buttons
    document.querySelectorAll('[data-scheme]').forEach(function(btn) {
      if (btn._dbInit) return; btn._dbInit = true;
      btn.addEventListener('click', function() { var s = btn.getAttribute('data-scheme'); if (s) setScheme(s); });
    });

    // Accent picker
    document.querySelectorAll('.db-accent-picker__dot').forEach(function(btn) {
      if (btn._dbInit) return; btn._dbInit = true;
      btn.addEventListener('click', function() {
        var accent = btn.getAttribute('data-accent');
        if (accent === 'reset') resetAccent();
        else if (accent) setAccent(accent);
      });
    });

    updateSwitcherUI();
  }

  function updateSwitcherUI() {
    var current = getTheme();
    var currentFamily = getFamily();

    // Legacy theme buttons
    document.querySelectorAll('.db-showcase__theme-swatch[data-theme]').forEach(function(btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-theme') === current));
    });

    // Family buttons (dots + swatches)
    document.querySelectorAll('[data-family]').forEach(function(btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-family') === currentFamily));
    });

    // Scheme buttons
    document.querySelectorAll('[data-scheme]').forEach(function(btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-scheme') === _scheme));
    });

    updateAccentPickerUI();
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
    var overlay = typeof id === 'string' ? document.getElementById(id) : id;
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
    overlay = typeof overlay === 'string' ? document.getElementById(overlay) : overlay;
    if (!overlay) return;
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
    if (typeof opts === 'string') opts = { message: opts };
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
     Warmth — apply filter via CSS custom property
     ---------------------------------------------------------- */
  function initWarmth() {
    var saved = localStorage.getItem('db-warmth');
    if (saved !== null) {
      document.documentElement.style.setProperty('--db-warmth', saved);
    }

    document.querySelectorAll('[data-db-warmth]').forEach(function(slider) {
      var input = slider.querySelector('.db-slider__input');
      var valueEl = slider.querySelector('.db-slider__value');
      if (!input) return;

      if (saved !== null) {
        input.value = Math.round(parseFloat(saved) * 100);
        if (valueEl) valueEl.textContent = input.value;
      }

      input.addEventListener('input', function() {
        var val = input.value / 100;
        document.documentElement.style.setProperty('--db-warmth', val);
        localStorage.setItem('db-warmth', val);
        if (valueEl) valueEl.textContent = input.value;
      });
    });
  }

  /* ----------------------------------------------------------
     Noise Control
     CSS variable --db-noise (0-1) controls grain texture opacity.
     Persists via localStorage.
     ---------------------------------------------------------- */
  // Non-linear curve for noise slider: gives fine control in the low range
  // slider 0→0, 25→0.09, 50→0.18, 75→0.49, 100→1.0
  function noiseSliderToCSS(v) { return Math.pow(v / 100, 2.5); }
  function noiseCSSToSlider(c) { return Math.round(Math.pow(c, 1 / 2.5) * 100); }

  function initNoise() {
    var saved = localStorage.getItem('db-noise');
    if (saved !== null) {
      document.documentElement.style.setProperty('--db-noise', saved);
    }

    document.querySelectorAll('[data-db-noise]').forEach(function(slider) {
      var input = slider.querySelector('.db-slider__input');
      var valueEl = slider.querySelector('.db-slider__value');
      if (!input) return;

      if (saved !== null) {
        var sliderPos = noiseCSSToSlider(parseFloat(saved));
        input.value = sliderPos;
        if (valueEl) valueEl.textContent = sliderPos;
      }

      input.addEventListener('input', function() {
        var cssVal = noiseSliderToCSS(parseInt(input.value));
        var rounded = Math.round(cssVal * 1000) / 1000;
        document.documentElement.style.setProperty('--db-noise', rounded);
        localStorage.setItem('db-noise', rounded);
        if (valueEl) valueEl.textContent = input.value;
      });
    });
  }

  /* ----------------------------------------------------------
     Texture Type Control
     Sets data-db-texture on <html>: grain (default), paper, metal, wood, glass, none.
     Persists via localStorage.
     ---------------------------------------------------------- */
  function initTexture() {
    var saved = localStorage.getItem('db-texture') || 'grain';
    document.documentElement.setAttribute('data-db-texture', saved);

    document.querySelectorAll('[data-db-texture-btn]').forEach(function(btn) {
      var type = btn.getAttribute('data-db-texture-btn');
      btn.setAttribute('aria-pressed', type === saved ? 'true' : 'false');

      btn.addEventListener('click', function() {
        document.documentElement.setAttribute('data-db-texture', type);
        localStorage.setItem('db-texture', type);
        document.querySelectorAll('[data-db-texture-btn]').forEach(function(b) {
          b.setAttribute('aria-pressed', b.getAttribute('data-db-texture-btn') === type ? 'true' : 'false');
        });
      });
    });
  }

  /* ----------------------------------------------------------
     Nested Border Radius
     innerRadius = outerRadius - padding
     Auto-applies to elements with [data-db-radius] or known containers.
     ---------------------------------------------------------- */
  function fixNestedRadius(root) {
    root = root || document;
    var containers = root.querySelectorAll('.db-card, .db-modal, .db-sheet, .db-drawer, .db-alert-dialog, .db-showcase__frame, [data-db-radius]');
    containers.forEach(function(el) {
      var style = getComputedStyle(el);
      var outerR = parseFloat(style.borderTopLeftRadius) || 0;
      if (outerR < 2) return;
      var padTop = parseFloat(style.paddingTop) || 0;
      var padLeft = parseFloat(style.paddingLeft) || 0;
      var gap = Math.max(padTop, padLeft);
      if (gap < 1) return;
      var innerR = Math.max(0, outerR - gap);
      propagateRadius(el, innerR);
    });
  }

  function propagateRadius(parent, innerR) {
    Array.from(parent.children).forEach(function(child) {
      if (child.nodeType !== 1) return;
      var cs = getComputedStyle(child);
      var hasBg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
      var hasBorder = cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none';
      var hasRadius = (parseFloat(cs.borderTopLeftRadius) || 0) > 0;
      if (hasBg || hasBorder || hasRadius) {
        child.style.borderRadius = innerR + 'px';
      } else {
        propagateRadius(child, innerR);
      }
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
     Accordion
     ---------------------------------------------------------- */
  var _dbAccordionInit = false;
  function initAccordions(root) {
    if (_dbAccordionInit && root === document) return;
    root.querySelectorAll('.db-accordion').forEach(function(acc) {
      if (acc._dbInit) return;
      acc._dbInit = true;
      acc.querySelectorAll('.db-accordion__trigger').forEach(function(trigger) {
        trigger.addEventListener('click', function() {
          var item = trigger.closest('.db-accordion__item');
          if (!item) return;
          var isOpen = item.classList.contains('db-accordion__item--open');
          // Close siblings if single mode (default)
          if (!acc.hasAttribute('data-multi')) {
            acc.querySelectorAll('.db-accordion__item--open').forEach(function(openItem) {
              openItem.classList.remove('db-accordion__item--open');
              openItem.querySelector('.db-accordion__trigger').setAttribute('aria-expanded', 'false');
            });
          }
          if (!isOpen) {
            item.classList.add('db-accordion__item--open');
            trigger.setAttribute('aria-expanded', 'true');
          } else {
            item.classList.remove('db-accordion__item--open');
            trigger.setAttribute('aria-expanded', 'false');
          }
        });
      });
    });
    if (root === document) _dbAccordionInit = true;
  }

  /* ----------------------------------------------------------
     Collapsible
     ---------------------------------------------------------- */
  var _dbCollapsibleInit = false;
  function initCollapsibles(root) {
    if (_dbCollapsibleInit && root === document) return;
    root.querySelectorAll('.db-collapsible').forEach(function(col) {
      if (col._dbInit) return;
      col._dbInit = true;
      var trigger = col.querySelector('.db-collapsible__trigger');
      if (!trigger) return;
      trigger.addEventListener('click', function() {
        var isOpen = col.classList.contains('db-collapsible--open');
        col.classList.toggle('db-collapsible--open');
        trigger.setAttribute('aria-expanded', String(!isOpen));
      });
    });
    if (root === document) _dbCollapsibleInit = true;
  }

  /* ----------------------------------------------------------
     Alert Dialog
     ---------------------------------------------------------- */
  function openAlertDialog(id) {
    var dialog = document.getElementById(id);
    if (!dialog) return;
    dialog.classList.add('db-alert-dialog--open');
    var cancel = dialog.querySelector('[data-action="cancel"]');
    if (cancel) cancel.focus();
  }

  function closeAlertDialog(id) {
    var dialog = document.getElementById(id);
    if (!dialog) return;
    dialog.classList.remove('db-alert-dialog--open');
  }

  function initAlertDialogs(root) {
    root.querySelectorAll('.db-alert-dialog').forEach(function(dialog) {
      if (dialog._dbInit) return;
      dialog._dbInit = true;
      dialog.querySelector('.db-alert-dialog__overlay')?.addEventListener('click', function() {
        dialog.classList.remove('db-alert-dialog--open');
      });
      dialog.querySelectorAll('[data-action="cancel"]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          dialog.classList.remove('db-alert-dialog--open');
        });
      });
    });
  }

  /* ----------------------------------------------------------
     Sheet
     ---------------------------------------------------------- */
  function openSheet(id) {
    var sheet = document.getElementById(id);
    if (!sheet) return;
    sheet.classList.add('db-sheet--open');
  }

  function closeSheet(id) {
    var sheet = document.getElementById(id);
    if (!sheet) return;
    sheet.classList.remove('db-sheet--open');
  }

  function initSheets(root) {
    root.querySelectorAll('.db-sheet').forEach(function(sheet) {
      if (sheet._dbInit) return;
      sheet._dbInit = true;
      sheet.querySelector('.db-sheet__overlay')?.addEventListener('click', function() {
        sheet.classList.remove('db-sheet--open');
      });
      sheet.querySelectorAll('.db-sheet__close').forEach(function(btn) {
        btn.addEventListener('click', function() {
          sheet.classList.remove('db-sheet--open');
        });
      });
    });
  }

  /* ----------------------------------------------------------
     Drawer
     ---------------------------------------------------------- */
  function openDrawer(id) {
    var drawer = document.getElementById(id);
    if (!drawer) return;
    drawer.classList.add('db-drawer--open');
  }

  function closeDrawer(id) {
    var drawer = document.getElementById(id);
    if (!drawer) return;
    drawer.classList.remove('db-drawer--open');
  }

  function initDrawers(root) {
    root.querySelectorAll('.db-drawer').forEach(function(drawer) {
      if (drawer._dbInit) return;
      drawer._dbInit = true;
      drawer.querySelector('.db-drawer__overlay')?.addEventListener('click', function() {
        drawer.classList.remove('db-drawer--open');
      });
    });
  }

  /* ----------------------------------------------------------
     Popover
     ---------------------------------------------------------- */
  var _dbPopoverInit = false;
  function initPopovers(root) {
    if (_dbPopoverInit && root === document) return;
    root.querySelectorAll('.db-popover').forEach(function(pop) {
      if (pop._dbInit) return;
      pop._dbInit = true;
      var trigger = pop.querySelector('.db-popover__trigger');
      if (!trigger) return;
      trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        pop.classList.toggle('db-popover--open');
      });
    });
    document.addEventListener('click', function() {
      document.querySelectorAll('.db-popover--open').forEach(function(p) {
        p.classList.remove('db-popover--open');
      });
    });
    if (root === document) _dbPopoverInit = true;
  }

  /* ----------------------------------------------------------
     Context Menu
     ---------------------------------------------------------- */
  var _dbCtxInit = false;
  function initContextMenus(root) {
    if (_dbCtxInit && root === document) return;
    root.querySelectorAll('[data-context-menu]').forEach(function(el) {
      if (el._dbCtx) return;
      el._dbCtx = true;
      var menuId = el.getAttribute('data-context-menu');
      el.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        document.querySelectorAll('.db-context-menu--open').forEach(function(m) {
          m.classList.remove('db-context-menu--open');
        });
        var menu = document.getElementById(menuId);
        if (!menu) return;
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.classList.add('db-context-menu--open');
      });
    });
    document.addEventListener('click', function() {
      document.querySelectorAll('.db-context-menu--open').forEach(function(m) {
        m.classList.remove('db-context-menu--open');
      });
    });
    if (root === document) _dbCtxInit = true;
  }

  /* ----------------------------------------------------------
     Dropdown Menu
     ---------------------------------------------------------- */
  var _dbDropInit = false;
  var _dbDropClickInit = false;
  function initDropdowns(root) {
    if (_dbDropInit && root === document) return;
    root.querySelectorAll('.db-dropdown').forEach(function(drop) {
      if (drop._dbInit) return;
      drop._dbInit = true;
      var trigger = drop.querySelector('.db-dropdown__trigger');
      if (!trigger) return;
      trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        var wasOpen = drop.classList.contains('db-dropdown--open');
        document.querySelectorAll('.db-dropdown--open').forEach(function(d) {
          d.classList.remove('db-dropdown--open');
        });
        if (!wasOpen) drop.classList.add('db-dropdown--open');
      });
    });
    if (!_dbDropClickInit) {
      _dbDropClickInit = true;
      document.addEventListener('click', function() {
        document.querySelectorAll('.db-dropdown--open').forEach(function(d) {
          d.classList.remove('db-dropdown--open');
        });
      });
    }
    if (root === document) _dbDropInit = true;
  }

  /* ----------------------------------------------------------
     Toggle / Toggle Group
     ---------------------------------------------------------- */
  var _dbToggleInit = false;
  function initToggles(root) {
    if (_dbToggleInit && root === document) return;
    root.querySelectorAll('.db-toggle').forEach(function(toggle) {
      if (toggle._dbInit) return;
      toggle._dbInit = true;
      toggle.addEventListener('click', function() {
        var group = toggle.closest('.db-toggle-group');
        if (group && !group.hasAttribute('data-multi')) {
          group.querySelectorAll('.db-toggle').forEach(function(t) {
            t.setAttribute('aria-pressed', 'false');
            t.classList.remove('db-toggle--active');
          });
        }
        var wasActive = toggle.getAttribute('aria-pressed') === 'true';
        toggle.setAttribute('aria-pressed', String(!wasActive));
        toggle.classList.toggle('db-toggle--active');
      });
    });
    if (root === document) _dbToggleInit = true;
  }

  /* ----------------------------------------------------------
     Custom Select
     ---------------------------------------------------------- */
  var _dbCustomSelectInit = false;
  var _dbCustomSelectClickInit = false;
  function initCustomSelects(root) {
    if (_dbCustomSelectInit && root === document) return;
    root.querySelectorAll('.db-custom-select').forEach(function(sel) {
      if (sel._dbInit) return;
      sel._dbInit = true;
      var trigger = sel.querySelector('.db-custom-select__trigger');
      if (!trigger) return;

      trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        var wasOpen = sel.classList.contains('db-custom-select--open');
        document.querySelectorAll('.db-custom-select--open').forEach(function(s) {
          s.classList.remove('db-custom-select--open');
        });
        if (!wasOpen) {
          sel.classList.add('db-custom-select--open');
          var searchInput = sel.querySelector('.db-custom-select__search input');
          if (searchInput) searchInput.focus();
        }
      });

      sel.querySelectorAll('.db-custom-select__option').forEach(function(opt) {
        if (opt.classList.contains('db-custom-select__option--disabled')) return;
        opt.addEventListener('click', function() {
          sel.querySelectorAll('.db-custom-select__option--selected').forEach(function(s) {
            s.classList.remove('db-custom-select__option--selected');
          });
          opt.classList.add('db-custom-select__option--selected');
          var valueEl = trigger.querySelector('.db-custom-select__value') || trigger.querySelector('.db-custom-select__placeholder');
          if (valueEl) {
            valueEl.textContent = opt.textContent.trim();
            valueEl.classList.remove('db-custom-select__placeholder');
            valueEl.classList.add('db-custom-select__value');
          }
          sel.classList.remove('db-custom-select--open');
        });
      });

      // Search filter
      var searchInput = sel.querySelector('.db-custom-select__search input');
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          var q = searchInput.value.toLowerCase();
          sel.querySelectorAll('.db-custom-select__option').forEach(function(opt) {
            opt.style.display = opt.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
          });
        });
        searchInput.addEventListener('click', function(e) { e.stopPropagation(); });
      }
    });

    if (!_dbCustomSelectClickInit) {
      _dbCustomSelectClickInit = true;
      document.addEventListener('click', function() {
        document.querySelectorAll('.db-custom-select--open').forEach(function(s) {
          s.classList.remove('db-custom-select--open');
        });
      });
    }
    if (root === document) _dbCustomSelectInit = true;
  }

  /* ----------------------------------------------------------
     Command Palette
     ---------------------------------------------------------- */
  function openCommand(id) {
    var cmd = document.getElementById(id);
    if (!cmd) return;
    cmd.classList.add('db-command--open');
    var input = cmd.querySelector('.db-command__input');
    if (input) { input.value = ''; input.focus(); }
  }

  function closeCommand(id) {
    var cmd = document.getElementById(id);
    if (!cmd) return;
    cmd.classList.remove('db-command--open');
  }

  function initCommands(root) {
    root.querySelectorAll('.db-command').forEach(function(cmd) {
      if (cmd._dbInit) return;
      cmd._dbInit = true;

      cmd.querySelector('.db-command__overlay')?.addEventListener('click', function() {
        cmd.classList.remove('db-command--open');
      });

      var input = cmd.querySelector('.db-command__input');
      if (input) {
        input.addEventListener('input', function() {
          var q = input.value.toLowerCase();
          cmd.querySelectorAll('.db-command__item').forEach(function(item) {
            item.style.display = item.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
          });
          var empty = cmd.querySelector('.db-command__empty');
          if (empty) {
            var anyVisible = cmd.querySelector('.db-command__item:not([style*="display: none"])');
            empty.style.display = anyVisible ? 'none' : '';
          }
        });

        input.addEventListener('keydown', function(e) {
          if (e.key === 'Escape') cmd.classList.remove('db-command--open');
        });
      }
    });

    // Ctrl+K / Cmd+K global shortcut
    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        var cmd = document.querySelector('.db-command');
        if (cmd) {
          if (cmd.classList.contains('db-command--open')) {
            cmd.classList.remove('db-command--open');
          } else {
            cmd.classList.add('db-command--open');
            var input = cmd.querySelector('.db-command__input');
            if (input) { input.value = ''; input.focus(); }
          }
        }
      }
    });
  }

  /* ----------------------------------------------------------
     Menubar
     ---------------------------------------------------------- */
  var _dbMenubarInit = false;
  function initMenubars(root) {
    if (_dbMenubarInit && root === document) return;
    root.querySelectorAll('.db-menubar').forEach(function(bar) {
      if (bar._dbInit) return;
      bar._dbInit = true;
      bar.querySelectorAll('.db-menubar__item').forEach(function(item) {
        item.addEventListener('click', function(e) {
          e.stopPropagation();
          var wasOpen = item.classList.contains('db-menubar__item--open');
          bar.querySelectorAll('.db-menubar__item--open').forEach(function(i) {
            i.classList.remove('db-menubar__item--open');
          });
          if (!wasOpen) item.classList.add('db-menubar__item--open');
        });
        item.addEventListener('mouseenter', function() {
          if (bar.querySelector('.db-menubar__item--open')) {
            bar.querySelectorAll('.db-menubar__item--open').forEach(function(i) {
              i.classList.remove('db-menubar__item--open');
            });
            item.classList.add('db-menubar__item--open');
          }
        });
      });
    });
    document.addEventListener('click', function() {
      document.querySelectorAll('.db-menubar__item--open').forEach(function(i) {
        i.classList.remove('db-menubar__item--open');
      });
    });
    if (root === document) _dbMenubarInit = true;
  }

  /* ----------------------------------------------------------
     Calendar / Date Picker
     ---------------------------------------------------------- */
  function initCalendars(root) {
    root.querySelectorAll('.db-calendar').forEach(function(cal) {
      if (cal._dbInit) return;
      cal._dbInit = true;
      cal.querySelectorAll('.db-calendar__day').forEach(function(day) {
        if (day.classList.contains('db-calendar__day--disabled') || day.classList.contains('db-calendar__day--outside')) return;
        day.addEventListener('click', function() {
          cal.querySelectorAll('.db-calendar__day--selected').forEach(function(d) {
            d.classList.remove('db-calendar__day--selected');
          });
          day.classList.add('db-calendar__day--selected');
        });
      });
    });

    root.querySelectorAll('.db-date-picker').forEach(function(dp) {
      if (dp._dbInit) return;
      dp._dbInit = true;
      var trigger = dp.querySelector('.db-date-picker__trigger');
      if (trigger) {
        trigger.addEventListener('click', function(e) {
          e.stopPropagation();
          dp.classList.toggle('db-date-picker--open');
        });
      }
    });

    document.addEventListener('click', function(e) {
      document.querySelectorAll('.db-date-picker--open').forEach(function(dp) {
        if (!dp.contains(e.target)) dp.classList.remove('db-date-picker--open');
      });
    });
  }

  /* ----------------------------------------------------------
     Carousel
     ---------------------------------------------------------- */
  function initCarousels(root) {
    root.querySelectorAll('.db-carousel').forEach(function(car) {
      if (car._dbInit) return;
      car._dbInit = true;
      var track = car.querySelector('.db-carousel__track');
      var slides = car.querySelectorAll('.db-carousel__slide');
      var dots = car.querySelectorAll('.db-carousel__dot');
      var current = 0;

      function goTo(idx) {
        if (idx < 0) idx = slides.length - 1;
        if (idx >= slides.length) idx = 0;
        current = idx;
        track.style.transform = 'translateX(-' + (current * 100) + '%)';
        dots.forEach(function(d, i) {
          d.classList.toggle('db-carousel__dot--active', i === current);
        });
      }

      var prev = car.querySelector('.db-carousel__btn--prev');
      var next = car.querySelector('.db-carousel__btn--next');
      if (prev) prev.addEventListener('click', function() { goTo(current - 1); });
      if (next) next.addEventListener('click', function() { goTo(current + 1); });
      dots.forEach(function(d, i) {
        d.addEventListener('click', function() { goTo(i); });
      });
    });
  }

  /* ----------------------------------------------------------
     Input OTP
     ---------------------------------------------------------- */
  function initOTP(root) {
    root.querySelectorAll('.db-otp').forEach(function(otp) {
      if (otp._dbInit) return;
      otp._dbInit = true;
      var inputs = otp.querySelectorAll('.db-otp__input');
      inputs.forEach(function(input, idx) {
        input.setAttribute('maxlength', '1');
        input.addEventListener('input', function() {
          if (input.value.length === 1 && idx < inputs.length - 1) {
            inputs[idx + 1].focus();
          }
        });
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Backspace' && !input.value && idx > 0) {
            inputs[idx - 1].focus();
          }
        });
        input.addEventListener('paste', function(e) {
          e.preventDefault();
          var data = (e.clipboardData || window.clipboardData).getData('text').trim();
          for (var i = 0; i < Math.min(data.length, inputs.length); i++) {
            inputs[i].value = data[i];
          }
          var focusIdx = Math.min(data.length, inputs.length - 1);
          inputs[focusIdx].focus();
        });
      });
    });
  }

  /* ----------------------------------------------------------
     Resizable
     ---------------------------------------------------------- */
  function initResizables(root) {
    root.querySelectorAll('.db-resizable').forEach(function(el) {
      if (el._dbInit) return;
      el._dbInit = true;
      el.querySelectorAll('.db-resizable__handle').forEach(function(handle) {
        var startX, startY, startW, startH;
        handle.addEventListener('mousedown', function(e) {
          e.preventDefault();
          startX = e.clientX;
          startY = e.clientY;
          startW = el.offsetWidth;
          startH = el.offsetHeight;
          function onMove(ev) {
            if (handle.classList.contains('db-resizable__handle--right') || handle.classList.contains('db-resizable__handle--corner')) {
              el.style.width = (startW + ev.clientX - startX) + 'px';
            }
            if (handle.classList.contains('db-resizable__handle--bottom') || handle.classList.contains('db-resizable__handle--corner')) {
              el.style.height = (startH + ev.clientY - startY) + 'px';
            }
          }
          function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
          }
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
      });
    });
  }

  /* ----------------------------------------------------------
     Sidebar Toggle
     ---------------------------------------------------------- */
  function initSidebarToggle(root) {
    root.querySelectorAll('.db-sidebar__toggle').forEach(function(btn) {
      if (btn._dbSidebar) return;
      btn._dbSidebar = true;
      btn.addEventListener('click', function() {
        var sidebar = btn.closest('.db-sidebar');
        if (!sidebar) return;
        sidebar.classList.toggle('db-sidebar--collapsed');
      });
    });
  }

  function toggleSidebar(el) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (el) el.classList.toggle('db-sidebar--collapsed');
  }

  /* ----------------------------------------------------------
     Chip Close
     ---------------------------------------------------------- */
  function initChipClose(root) {
    root.querySelectorAll('.db-chip__close').forEach(function(btn) {
      if (btn._dbChip) return;
      btn._dbChip = true;
      btn.addEventListener('click', function() {
        var chip = btn.closest('.db-chip');
        if (!chip) return;
        chip.style.transition = 'opacity 150ms ease, transform 150ms ease';
        chip.style.opacity = '0';
        chip.style.transform = 'scale(0.8)';
        setTimeout(function() { chip.remove(); }, 150);
      });
    });
  }

  /* ----------------------------------------------------------
     Navbar
     ---------------------------------------------------------- */
  function initNavbars(root) {
    root.querySelectorAll('.db-navbar__toggle').forEach(function(btn) {
      if (btn._dbNavbar) return;
      btn._dbNavbar = true;
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var navbar = btn.closest('.db-navbar');
        if (navbar) navbar.classList.toggle('db-navbar--open');
      });
    });
    // Close on outside click
    if (!document._dbNavbarOutside) {
      document._dbNavbarOutside = true;
      document.addEventListener('click', function(e) {
        if (!e.target.closest('.db-navbar')) {
          document.querySelectorAll('.db-navbar--open').forEach(function(n) {
            n.classList.remove('db-navbar--open');
          });
        }
      });
    }
  }

  function toggleNavbar(el) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (el) el.classList.toggle('db-navbar--open');
  }

  /* ----------------------------------------------------------
     Chip Toggle
     ---------------------------------------------------------- */
  function initChipToggle(root) {
    root.querySelectorAll('[data-db-chip-toggle]').forEach(function(container) {
      if (container._dbChipToggle) return;
      container._dbChipToggle = true;
      container.addEventListener('click', function(e) {
        var chip = e.target.closest('.db-chip');
        if (!chip || e.target.closest('.db-chip__close')) return;
        chip.classList.toggle('db-chip--active');
      });
    });
  }

  /* ----------------------------------------------------------
     Icon Refresh
     ---------------------------------------------------------- */
  function refreshIcons() {
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  }

  /* ----------------------------------------------------------
     Dev-mode validation warnings
     ---------------------------------------------------------- */
  function _validate(root) {
    var host = location.hostname;
    var isDev = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || document.documentElement.hasAttribute('data-db-debug');
    if (!isDev) return;
    var checks = [
      ['.db-dropdown', '.db-dropdown__trigger', 'DAUB: .db-dropdown missing __trigger child'],
      ['.db-custom-select', '.db-custom-select__trigger', 'DAUB: .db-custom-select missing __trigger child'],
      ['.db-tabs', '.db-tabs__list', 'DAUB: .db-tabs missing __list child'],
      ['.db-field', '.db-field__input', 'DAUB: .db-field missing __input child'],
      ['.db-slider', '.db-slider__input', 'DAUB: .db-slider missing __input child'],
      ['.db-accordion', '.db-accordion__item', 'DAUB: .db-accordion has no __item children'],
      ['.db-checkbox', '.db-checkbox__input', 'DAUB: .db-checkbox missing __input child'],
      ['.db-radio', '.db-radio__input', 'DAUB: .db-radio missing __input child']
    ];
    checks.forEach(function(c) {
      root.querySelectorAll(c[0]).forEach(function(el) {
        if (!el.querySelector(c[1])) console.warn(c[2], el);
      });
    });
    root.querySelectorAll('.db-modal').forEach(function(el) {
      if (!el.id) console.warn('DAUB: .db-modal missing id attribute', el);
    });
  }

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
    initWarmth();
    initNoise();
    initTexture();
    initCheckboxes(root);
    initRadios(root);
    initAccordions(root);
    initCollapsibles(root);
    initAlertDialogs(root);
    initSheets(root);
    initDrawers(root);
    initPopovers(root);
    initContextMenus(root);
    initDropdowns(root);
    initToggles(root);
    initCustomSelects(root);
    initCommands(root);
    initMenubars(root);
    initCalendars(root);
    initCarousels(root);
    initOTP(root);
    initResizables(root);
    initChipClose(root);
    initChipToggle(root);
    initNavbars(root);
    initSidebarToggle(root);
    initThemeSwitcher();
    fixNestedRadius(root);
    refreshIcons();
    _validate(root);
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
    openAlertDialog: openAlertDialog,
    closeAlertDialog: closeAlertDialog,
    openSheet: openSheet,
    closeSheet: closeSheet,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    openCommand: openCommand,
    closeCommand: closeCommand,
    getTheme: getTheme,
    setTheme: setTheme,
    cycleTheme: cycleTheme,
    THEMES: THEMES,
    THEME_FAMILIES: THEME_FAMILIES,
    FAMILY_NAMES: FAMILY_NAMES,
    getScheme: getScheme,
    setScheme: setScheme,
    getFamily: getFamily,
    setFamily: setFamily,
    setAccent: setAccent,
    resetAccent: resetAccent,
    getAccent: getAccent,
    fixNestedRadius: fixNestedRadius,
    setTexture: function(type) {
      document.documentElement.setAttribute('data-db-texture', type);
      localStorage.setItem('db-texture', type);
    },
    getTexture: function() {
      return document.documentElement.getAttribute('data-db-texture') || 'grain';
    },
    TEXTURES: ['grain', 'paper', 'metal', 'wood', 'glass', 'none'],
    toggleSidebar: toggleSidebar,
    toggleNavbar: toggleNavbar,
    refreshIcons: refreshIcons,
    THEME_CATEGORIES: THEME_CATEGORIES,
    CATEGORY_NAMES: CATEGORY_NAMES,
    getCategory: getCategory
  };

})();
