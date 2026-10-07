/* ============================================================
   DAUB UI KIT — Interactive Behaviors
   Version 3.20.6
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
    'monospace','monospace-light','synthwave','synthwave-light','shades-of-purple','shades-of-purple-light','ayu','ayu-dark','horizon','horizon-light'
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
    'monospace':  { light: 'monospace-light', dark: 'monospace' },
    'synthwave':  { light: 'synthwave-light',dark: 'synthwave' },
    'shades-of-purple':{ light: 'shades-of-purple-light',dark: 'shades-of-purple' },
    'ayu':        { light: 'ayu',           dark: 'ayu-dark' },
    'horizon':    { light: 'horizon-light', dark: 'horizon' }
  };
  var FAMILY_NAMES = [
    'default','grunge','solarized','ink','ember','bone',
    'dracula','nord','one-dark','monokai','gruvbox',
    'night-owl','github','catppuccin','tokyo-night','material','monospace',
    'synthwave','shades-of-purple','ayu','horizon'
  ];

  var THEME_CATEGORIES = {
    'originals': ['default','grunge','solarized','ink','ember','bone'],
    'classics':  ['dracula','nord','one-dark','monokai','gruvbox'],
    'modern':    ['night-owl','github','catppuccin','tokyo-night','material','monospace'],
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
  var _themeInitialized = false;

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function setTheme(theme) {
    if (THEMES.indexOf(theme) === -1) return;
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('db-theme', theme); } catch(e) {}
    _userExplicitTheme = true;
    var st = document.documentElement.style, acc = st.getPropertyValue('--db-terracotta').trim();
    if (st.getPropertyValue('--db-terracotta-text') && /^#[0-9a-fA-F]{6}$/.test(acc)) st.setProperty('--db-terracotta-text', accentText(acc));
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
    if (_themeInitialized) return;
    _themeInitialized = true;
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
  // Accent text must read on the ground: darker on light themes, at least 75% lightness on dark ones
  function accentText(hex) {
    var info=THEME_TO_FAMILY[getTheme()];
    if (!info || info.mode !== 'dark') return darken(hex, 20);
    var hsl=hexToHSL(hex);
    return hslToHex(hsl[0],hsl[1],Math.max(75,hsl[2]));
  }

  function setAccentButtonContrast(root, colors) {
    function luminance(channels) {
      return channels.reduce(function(sum, channel, i) {
        var value = channel / 255;
        var linear = value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
        return sum + [0.2126, 0.7152, 0.0722][i] * linear;
      }, 0);
    }
    var backgrounds = colors.map(function(hex) {
      return [1, 3, 5].map(function(offset) { return parseInt(hex.slice(offset, offset + 2), 16); });
    });
    var candidates = [
      { text: '#fff', mix: '#000', target: 0, luminance: 1 },
      { text: '#111', mix: '#fff', target: 255, luminance: luminance([17, 17, 17]) }
    ];
    for (var percent = 0; percent <= 100; percent++) {
      for (var i = 0; i < candidates.length; i++) {
        var candidate = candidates[i];
        var amount = percent / 100;
        var passes = backgrounds.every(function(rgb) {
          var background = luminance(rgb.map(function(channel) { return channel * (1 - amount) + candidate.target * amount; }));
          return (Math.max(candidate.luminance, background) + 0.05) / (Math.min(candidate.luminance, background) + 0.05) >= 4.6;
        });
        if (passes) {
          root.style.setProperty('--db-btn-color', candidate.text);
          root.style.setProperty('--db-btn-contrast-color', candidate.mix);
          root.style.setProperty('--db-btn-contrast-mix', percent + '%');
          return;
        }
      }
    }
  }

  function setAccent(hex) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
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
    root.style.setProperty('--db-terracotta-text', accentText(hex));
    setAccentButtonContrast(root, [hex, darken(hex, 15), darken(hex, 10), darken(hex, 20)]);
    try { localStorage.setItem('db-accent', hex); } catch(e) {}
    updateAccentPickerUI();
  }

  function resetAccent() {
    var props=['--db-terracotta','--db-accent-rgb','--db-accent-hover',
      '--db-accent-pressed','--db-accent-dark','--db-accent-light','--db-terracotta-text',
      '--db-btn-color','--db-btn-contrast-color','--db-btn-contrast-mix'];
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
    nativeElements(document, '.db-accent-picker__dot').forEach(function(btn) {
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
    'monospace':{light:'#F7F7F2',dark:'#101410',accent:'#7DD3FC'},
    'synthwave':{light:'#F5E6FF',dark:'#2B213A',accent:'#F92AAD'},
    'shades-of-purple':{light:'#F3EFFF',dark:'#2D2B55',accent:'#FAD000'},
    'ayu':{light:'#FAFAFA',dark:'#0B0E14',accent:'#FF8F40'},
    'horizon':{light:'#FDF0ED',dark:'#1C1E26',accent:'#E95678'}
  };
  var CATEGORY_LABELS = {originals:'Originals',classics:'Classics',modern:'Modern',trending:'Trending'};
  var FAMILY_LABELS = {
    'default':'Default','grunge':'Grunge','solarized':'Solar','ink':'Ink','ember':'Ember','bone':'Bone',
    'dracula':'Dracula','nord':'Nord','one-dark':'One Dark','monokai':'Monokai','gruvbox':'Gruvbox',
    'night-owl':'Night Owl','github':'GitHub','catppuccin':'Catppuccin','tokyo-night':'Tokyo','material':'Material','monospace':'Mono',
    'synthwave':'Synthwave','shades-of-purple':'Purple','ayu':'Ayu','horizon':'Horizon'
  };

  function buildPopoverContent(popover) {
    while (popover.firstChild) popover.removeChild(popover.firstChild);
    var isInline = popover.classList.contains('db-theme-switcher__popover--inline');
    // Category tabs row
    var tabRow = document.createElement('div');
    tabRow.className = 'db-theme-switcher__tabs';
    var panels = [];
    for (var ci = 0; ci < CATEGORY_NAMES.length; ci++) {
      var cat = CATEGORY_NAMES[ci];
      var families = THEME_CATEGORIES[cat];
      // Tab button
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'db-theme-switcher__tab';
      tab.setAttribute('data-cat', cat);
      tab.setAttribute('aria-pressed', ci === 0 ? 'true' : 'false');
      tab.textContent = CATEGORY_LABELS[cat];
      tabRow.appendChild(tab);
      // Items panel
      var row = document.createElement('div');
      row.className = 'db-theme-switcher__category-items';
      row.setAttribute('data-cat', cat);
      if (ci > 0) row.style.display = 'none';
      for (var fi = 0; fi < families.length; fi++) {
        var fam = families[fi];
        var sw = FAMILY_SWATCHES[fam] || {light:'#ccc',dark:'#333'};
        var item = document.createElement('button');
        item.type = 'button';
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
      panels.push(row);
    }
    popover.appendChild(tabRow);
    for (var pi = 0; pi < panels.length; pi++) popover.appendChild(panels[pi]);
    // Tab click handler
    tabRow.addEventListener('click', function(e) {
      var tab = e.target.closest('.db-theme-switcher__tab');
      if (!tab) return;
      var activeCat = tab.getAttribute('data-cat');
      nativeElements(tabRow, '.db-theme-switcher__tab').forEach(function(t) {
        t.setAttribute('aria-pressed', t.getAttribute('data-cat') === activeCat ? 'true' : 'false');
      });
      nativeElements(popover, '.db-theme-switcher__category-items').forEach(function(p) {
        p.style.display = p.getAttribute('data-cat') === activeCat ? '' : 'none';
      });
    });
    if (!popover.classList.contains('db-theme-switcher__popover--inline')) {
      var schemeRow = document.createElement('div');
      schemeRow.className = 'db-theme-switcher__scheme';
      ['auto','light','dark'].forEach(function(s) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'db-theme-switcher__scheme-btn';
        btn.setAttribute('data-scheme', s);
        btn.setAttribute('aria-label', s + ' mode');
        btn.setAttribute('aria-pressed', 'false');
        btn.textContent = s;
        schemeRow.appendChild(btn);
      });
      popover.appendChild(schemeRow);
    }
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
    var c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', '13.5'); c.setAttribute('cy', '6.5'); c.setAttribute('r', '.5'); c.setAttribute('fill', 'currentColor');
    var c2 = document.createElementNS(ns, 'circle');
    c2.setAttribute('cx', '17.5'); c2.setAttribute('cy', '10.5'); c2.setAttribute('r', '.5'); c2.setAttribute('fill', 'currentColor');
    var c3 = document.createElementNS(ns, 'circle');
    c3.setAttribute('cx', '8.5'); c3.setAttribute('cy', '7.5'); c3.setAttribute('r', '.5'); c3.setAttribute('fill', 'currentColor');
    var c4 = document.createElementNS(ns, 'circle');
    c4.setAttribute('cx', '6.5'); c4.setAttribute('cy', '12.5'); c4.setAttribute('r', '.5'); c4.setAttribute('fill', 'currentColor');
    var p1 = document.createElementNS(ns, 'path');
    p1.setAttribute('d', 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z');
    svg.appendChild(p1); svg.appendChild(c); svg.appendChild(c2); svg.appendChild(c3); svg.appendChild(c4);
    return svg;
  }

  function initThemeSwitcher() {
    // Auto-populate empty theme switcher containers
    nativeElements(document, '.db-theme-switcher').forEach(function(sw) {
      if (sw.querySelector('.db-theme-switcher__toggle')) return;
      var toggle = document.createElement('button');
      toggle.type = 'button';
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
    nativeElements(document, '.db-theme-switcher__popover').forEach(function(pop) {
      if (!pop._dbBuilt) { pop._dbBuilt = true; buildPopoverContent(pop); }
    });

    // Popover toggle
    nativeElements(document, '.db-theme-switcher__toggle').forEach(function(btn) {
      if (btn._dbInit) return;
      btn._dbInit = true;
      var popover = nativeElement(btn.parentElement, '.db-theme-switcher__popover');
      if (popover) {
        if (!popover.id) popover.id = uid();
        btn.setAttribute('aria-controls', popover.id);
        btn.setAttribute('aria-expanded', String(popover.hasAttribute('data-open')));
        popover.setAttribute('aria-hidden', String(!popover.hasAttribute('data-open')));
      }
      btn.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowDown' && popover) {
          e.preventDefault();
          popover.setAttribute('data-open', '');
          popover.setAttribute('aria-hidden', 'false');
          btn.setAttribute('aria-expanded', 'true');
          var first = focusableElements(popover)[0];
          if (first) first.focus();
        }
      });
      if (popover) popover.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          e.preventDefault(); e.stopPropagation();
          popover.removeAttribute('data-open');
          popover.setAttribute('aria-hidden', 'true');
          btn.setAttribute('aria-expanded', 'false');
          btn.focus();
        }
      });
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var popover = nativeElement(btn.parentElement, '.db-theme-switcher__popover');
        if (!popover) return;
        var open = popover.hasAttribute('data-open');
        if (open) { popover.removeAttribute('data-open'); btn.setAttribute('aria-expanded','false'); }
        else { popover.setAttribute('data-open',''); btn.setAttribute('aria-expanded','true'); }
        popover.setAttribute('aria-hidden', String(open));
      });
    });

    // Close popover on outside click
    if (!document._dbPopoverClose) {
      document._dbPopoverClose = true;
      document.addEventListener('click', function(e) {
        nativeElements(document, '.db-theme-switcher__popover[data-open]').forEach(function(pop) {
          var toggle = nativeElement(pop.parentElement, '.db-theme-switcher__toggle');
          if (!pop.contains(e.target) && (!toggle || !toggle.contains(e.target))) {
            pop.removeAttribute('data-open');
            pop.setAttribute('aria-hidden', 'true');
            if (toggle) toggle.setAttribute('aria-expanded','false');
          }
        });
      });
    }

    // Legacy data-theme buttons
    nativeElements(document, '.db-showcase__theme-swatch[data-theme]').forEach(function(btn) {
      if (btn._dbInit) return; btn._dbInit = true;
      btn.addEventListener('click', function() { var t = btn.getAttribute('data-theme'); if (t) setTheme(t); });
    });

    // Family buttons (dots + configurator swatches)
    nativeElements(document, '[data-family]').forEach(function(btn) {
      if (btn._dbInit) return; btn._dbInit = true;
      btn.addEventListener('click', function() { var f = btn.getAttribute('data-family'); if (f) setFamily(f); });
    });

    // Scheme buttons
    nativeElements(document, '[data-scheme]:not(html)').forEach(function(btn) {
      if (btn._dbInit) return; btn._dbInit = true;
      btn.addEventListener('click', function() { var s = btn.getAttribute('data-scheme'); if (s) setScheme(s); });
    });

    // Accent picker
    nativeElements(document, '.db-accent-picker__dot').forEach(function(btn) {
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
    nativeElements(document, '.db-showcase__theme-swatch[data-theme]').forEach(function(btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-theme') === current));
    });

    // Family buttons (dots + swatches)
    nativeElements(document, '[data-family]').forEach(function(btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-family') === currentFamily));
    });

    // Scheme buttons
    nativeElements(document, '[data-scheme]:not(html)').forEach(function(btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-scheme') === _scheme));
    });

    updateAccentPickerUI();
  }

  /* ----------------------------------------------------------
     Switch / Toggle
     ---------------------------------------------------------- */
  function initSwitches(root) {
    nativeElements(root, '.db-switch').forEach(function(sw) {
      if (sw._dbInit) return;
      sw._dbInit = true;

      if (!sw.hasAttribute('role')) sw.setAttribute('role', 'switch');
      if (!sw.hasAttribute('tabindex')) sw.setAttribute('tabindex', '0');
      if (!sw.hasAttribute('aria-checked')) sw.setAttribute('aria-checked', 'false');

      sw.addEventListener('click', toggleSwitch);
      sw.addEventListener('keydown', function(e) {
        if (sw.tagName === 'BUTTON' || sw.tagName === 'INPUT') return;
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggleSwitch.call(sw);
        }
      });
    });
  }

  function toggleSwitch() {
    if (isDisabled(this)) return;
    var on = this.getAttribute('aria-checked') === 'true';
    this.setAttribute('aria-checked', String(!on));
    this.dispatchEvent(new CustomEvent('db:change', { detail: { checked: !on } }));
  }

  /* ----------------------------------------------------------
     Tabs
     ---------------------------------------------------------- */
  function initTabs(root) {
    nativeElements(root, '.db-tabs').forEach(function(tabs) {
      if (tabs._dbInit) return;
      if (tabs.classList.contains('db-tabs--static')) return;
      tabs._dbInit = true;

      function own(el) { return el.closest('.db-tabs') === tabs; }
      var tabList = nativeElements(tabs, '.db-tabs__list').filter(own)[0];
      if (!tabList) { tabs._dbInit = false; return; }
      var tabBtns = nativeElements(tabList, '.db-tabs__tab').filter(own);
      var panels = nativeElements(tabs, '.db-tabs__panel').filter(own);
      var selected = tabBtns.findIndex(function(btn) { return !isDisabled(btn) && btn.getAttribute('aria-selected') === 'true'; });
      if (selected < 0) selected = tabBtns.findIndex(function(btn) { return !isDisabled(btn); });

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
        setTabState(btn, panel, i === selected);

        btn.addEventListener('click', function() {
          if (isDisabled(btn)) return;
          selectTab(tabBtns, panels, i);
        });
      });

      tabList.addEventListener('keydown', function(e) {
        var idx = tabBtns.indexOf(document.activeElement);
        if (idx === -1) return;
        var next = -1;
        var enabled = tabBtns.filter(function(btn) { return !isDisabled(btn); });
        var active = enabled.indexOf(tabBtns[idx]);
        var vertical = tabList.getAttribute('aria-orientation') === 'vertical';
        if (e.key === (vertical ? 'ArrowDown' : 'ArrowRight')) next = tabBtns.indexOf(enabled[(active + 1) % enabled.length]);
        else if (e.key === (vertical ? 'ArrowUp' : 'ArrowLeft')) next = tabBtns.indexOf(enabled[(active - 1 + enabled.length) % enabled.length]);
        else if (e.key === 'Home') next = tabBtns.indexOf(enabled[0]);
        else if (e.key === 'End') next = tabBtns.indexOf(enabled[enabled.length - 1]);
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
  var _dbModalKeyInit = false;
  function _isDialog(el) { return el && el.tagName === 'DIALOG'; }
  /* An open modal <dialog> (a browser without :modal counts any open <dialog>) */
  function _modalDialogOpen() {
    try { return !!document.querySelector('dialog:modal'); } catch (err) { return !!document.querySelector('dialog[open]'); }
  }

  function initModals(root) {
    nativeElements(root, '[data-db-modal-trigger]').forEach(function(trigger) {
      if (trigger._dbInit) return;
      trigger._dbInit = true;

      trigger.addEventListener('click', function() {
        var id = trigger.getAttribute('data-db-modal-trigger');
        openModal(id, trigger);
      });
    });

    nativeElements(root, '.db-modal-overlay').forEach(function(overlay) {
      if (overlay._dbInit) return;
      overlay._dbInit = true;
      prepareOverlay(overlay, '.db-modal', 'db-modal--open');

      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeModal(overlay);
      });

      var modalEl = nativeElement(overlay, '.db-modal');
      if (modalEl) {
        if (!modalEl.hasAttribute('role')) modalEl.setAttribute('role', 'dialog');
        if (!modalEl.hasAttribute('aria-modal')) modalEl.setAttribute('aria-modal', 'true');
      }

      nativeElements(overlay, '.db-modal__close').forEach(function(closeBtn) {
        closeBtn.addEventListener('click', function() {
          closeModal(overlay);
        });
      });
    });

    /* Native <dialog> elements */
    nativeElements(root, 'dialog.db-modal').forEach(function(dialog) {
      if (dialog._dbInit) return;
      dialog._dbInit = true;
      prepareOverlay(dialog, null, 'db-modal--open');

      /* Close on backdrop click */
      dialog.addEventListener('click', function(e) {
        if (e.target !== dialog) return;
        var rect = dialog.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) closeModal(dialog);
      });

      nativeElements(dialog, '.db-modal__close').forEach(function(closeBtn) {
        closeBtn.addEventListener('click', function() {
          closeModal(dialog);
        });
      });

      /* Restore focus on close */
      dialog.addEventListener('close', function() {
        if (!dialog.open) finishOverlayClose(dialog);
      });
    });

    if (!_dbModalKeyInit) {
      _dbModalKeyInit = true;
      /* Escape closes the open Modal, Alert Dialog, Sheet or Drawer on top. A modal <dialog> sits above all of them
         and the browser closes it on Escape itself, so the overlays under it stay open */
      document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape' || e.defaultPrevented || isReactOwned(e.target) || _overlayStack.length || _modalDialogOpen()) return;
        var top = topOverlay();
        if (top) { e.preventDefault(); dismissOverlay(top); }
      });
      /* [data-db-dismiss] closes the overlay it sits in, or the one whose id it names.
         Delegated, so buttons rendered after init work too. */
      document.addEventListener('click', function(e) {
        var btn = e.target.closest && e.target.closest('[data-db-dismiss]');
        if (!btn || isReactOwned(btn) || isDisabled(btn)) return;
        var id = btn.getAttribute('data-db-dismiss');
        dismissOverlay(id ? document.getElementById(id) : btn.closest(OVERLAY_SEL));
      });
    }
  }

  function openModal(id, triggerOrOpts, opts) {
    var trigger, options;
    if (triggerOrOpts && typeof triggerOrOpts === 'object' && !(triggerOrOpts instanceof HTMLElement)) {
      options = triggerOrOpts;
      trigger = null;
    } else {
      trigger = triggerOrOpts || null;
      options = opts || null;
    }
    var overlay = typeof id === 'string' ? document.getElementById(id) : id;
    if (!overlay) return;

    if (options) {
      if (options.title != null) {
        var titleEl = nativeElement(overlay, '.db-modal__title');
        if (titleEl) titleEl.textContent = options.title;
      }
      if (options.body != null) {
        var bodyEl = nativeElement(overlay, '.db-modal__body');
        if (bodyEl) bodyEl.textContent = options.body;
      }
      if (options.footer != null) {
        var footerEl = nativeElement(overlay, '.db-modal__footer');
        if (footerEl) footerEl.textContent = options.footer;
      }
    }

    openOverlay(overlay, '.db-modal', 'db-modal--open', trigger);
  }

  function closeModal(overlay) {
    overlay = typeof overlay === 'string' ? document.getElementById(overlay) : overlay;
    if (!overlay) return;

    closeOverlay(overlay);
  }

  var OVERLAY_SEL = '.db-modal-overlay, dialog.db-modal, .db-alert-dialog, .db-sheet, .db-drawer';

  /* Close a Modal (overlay or <dialog>), Alert Dialog, Sheet or Drawer element */
  function dismissOverlay(el) {
    if (!el || !el.classList || isReactOwned(el)) return;
    if (!el._dbOverlay) {
      if (el.classList.contains('db-alert-dialog')) prepareOverlay(el, '.db-alert-dialog__panel', 'db-alert-dialog--open');
      else if (el.classList.contains('db-sheet')) prepareOverlay(el, '.db-sheet__panel', 'db-sheet--open');
      else if (el.classList.contains('db-drawer')) prepareOverlay(el, '.db-drawer__panel', 'db-drawer--open');
      else if (el.classList.contains('db-modal-overlay') || _isDialog(el)) prepareOverlay(el, '.db-modal', 'db-modal--open');
    }
    if (el.classList.contains('db-modal-overlay') || _isDialog(el)) closeModal(el);
    else closeOverlay(el);
  }

  /* The open overlay on top: highest z-index, the later one in the DOM on a tie */
  function topOverlay() {
    var top = null, topZ = -Infinity;
    nativeElements(document, '.db-modal--open, .db-alert-dialog--open, .db-sheet--open, .db-drawer--open').forEach(function(el) {
      var z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
      if (z >= topZ) { top = el; topZ = z; }
    });
    return top;
  }

  /* ----------------------------------------------------------
     Toast — built with safe DOM methods (no innerHTML)
     ---------------------------------------------------------- */
  function getToastStack() {
    var stack = nativeElements(document, '.db-toast-stack:not([data-db-toast-preview])')[0];
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
    nativeElements(root, '.db-stepper').forEach(function(stepper) {
      if (stepper._dbInit) return;
      stepper._dbInit = true;
    });
  }

  /* ----------------------------------------------------------
     Tooltip
     ---------------------------------------------------------- */
  function initTooltips(root) {
    nativeElements(root, '.db-tooltip').forEach(function(wrap) {
      if (wrap._dbInit) return;
      wrap._dbInit = true;

      var tip = nativeElement(wrap, '.db-tooltip__content');
      if (!tip) return;

      if (!tip.id) tip.id = 'db-tip-' + uid();
      var trigger = nativeElement(wrap, '[data-db-tooltip]') || wrap.children[0];
      if (trigger) {
        var descriptions = (trigger.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
        if (descriptions.indexOf(tip.id) < 0) descriptions.push(tip.id);
        trigger.setAttribute('aria-describedby', descriptions.join(' '));
        var openedOnFocus = false;
        trigger.addEventListener('focus', function() {
          openedOnFocus = !wrap.classList.contains('db-tooltip--open');
          wrap.classList.add('db-tooltip--open');
          tip.style.visibility = '';
        });
        trigger.addEventListener('keydown', function(e) {
          if (e.key === 'Escape' && tip.getClientRects().length && getComputedStyle(tip).visibility !== 'hidden') {
            e.preventDefault(); e.stopPropagation();
            tip.style.visibility = 'hidden';
          }
        });
        function resetTip() { tip.style.visibility = ''; }
        trigger.addEventListener('blur', function() {
          if (openedOnFocus) wrap.classList.remove('db-tooltip--open');
          resetTip();
        });
        wrap.addEventListener('mouseleave', resetTip);
      }
      tip.setAttribute('role', 'tooltip');
      watchHoverPanel(wrap, 'db-tooltip--open', tip);
    });
  }

  /* ----------------------------------------------------------
     Hover Card
     ---------------------------------------------------------- */
  function initHoverCards(root) {
    nativeElements(root, '.db-hover-card').forEach(function(card) {
      if (card._dbInit) return;
      card._dbInit = true;
      watchHoverPanel(card, 'db-hover-card--open', nativeElement(card, '.db-hover-card__content'));
    });
  }

  /* ----------------------------------------------------------
     Slider — sync value display
     ---------------------------------------------------------- */
  function initSliders(root) {
    nativeElements(root, '.db-slider').forEach(function(slider) {
      if (slider._dbInit) return;
      slider._dbInit = true;

      var input = nativeElement(slider, '.db-slider__input');
      var valueEl = nativeElement(slider, '.db-slider__value');
      if (!input || !valueEl) return;

      var update = function() { valueEl.textContent = input.value; };
      input.addEventListener('input', update);
      update();
    });
  }

  /* ----------------------------------------------------------
     Temperature — cold (-1) to neutral (0) to warm (+1)
     Supports 'auto' mode: adjusts based on time of day and
     estimated daylight hours for the current date (~45°N).
     ---------------------------------------------------------- */
  var _tempAutoTimer = null;

  // Estimate daylight temperature from time of day and date.
  // Uses solar declination to approximate sunrise/sunset at ~45°N latitude.
  // Returns a value from -0.3 (cool midday) to +0.6 (warm golden hour) to +0.35 (night).
  function calcAutoTemperature() {
    var now = new Date();
    var dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    // Solar declination (radians) — simplified equation of time
    var decl = -23.44 * Math.cos(2 * Math.PI * (dayOfYear + 10) / 365) * Math.PI / 180;
    var lat = 45 * Math.PI / 180; // ~45°N — reasonable mid-latitude default
    // Hour angle at sunrise/sunset
    var cosH = -Math.tan(lat) * Math.tan(decl);
    cosH = Math.max(-1, Math.min(1, cosH)); // clamp for polar edge cases
    var halfDay = Math.acos(cosH) / Math.PI * 12; // hours of daylight / 2
    var solarNoon = 12; // approximate
    var sunrise = solarNoon - halfDay;
    var sunset = solarNoon + halfDay;

    var hour = now.getHours() + now.getMinutes() / 60;
    var goldenBefore = sunrise + 0.75; // ~45 min after sunrise
    var goldenAfter = sunset - 0.75;   // ~45 min before sunset

    if (hour < sunrise - 0.5 || hour > sunset + 0.5) {
      // Night — warm like candlelight
      return 0.35;
    } else if (hour < goldenBefore) {
      // Sunrise golden hour — warm
      var t = (hour - (sunrise - 0.5)) / (goldenBefore - (sunrise - 0.5));
      return 0.35 + (0.6 - 0.35) * Math.sin(t * Math.PI / 2); // peak at golden
    } else if (hour > goldenAfter) {
      // Sunset golden hour — warm
      var t2 = (hour - goldenAfter) / ((sunset + 0.5) - goldenAfter);
      return -0.15 + (0.6 + 0.15) * Math.sin((1 - t2) * Math.PI / 2); // peak at golden start
    } else {
      // Daytime — cooler/neutral, slight midday dip
      var dayProgress = (hour - goldenBefore) / (goldenAfter - goldenBefore);
      return -0.15 - 0.15 * Math.sin(dayProgress * Math.PI); // -0.15 to -0.3 midday
    }
  }

  function applyAutoTemperature() {
    var val = calcAutoTemperature();
    document.documentElement.style.setProperty('--db-temperature', val.toFixed(3));
  }

  function startAutoTemperature() {
    if (_tempAutoTimer) clearInterval(_tempAutoTimer);
    applyAutoTemperature();
    _tempAutoTimer = setInterval(applyAutoTemperature, 15 * 60 * 1000); // every 15 min
  }

  function stopAutoTemperature() {
    if (_tempAutoTimer) { clearInterval(_tempAutoTimer); _tempAutoTimer = null; }
  }

  function setTemperature(val) {
    if (val === 'auto') {
      saveSetting('db-temperature', 'auto');
      startAutoTemperature();
    } else {
      stopAutoTemperature();
      var n = parseFloat(val);
      if (isNaN(n)) n = 0;
      n = Math.max(-1, Math.min(1, n));
      document.documentElement.style.setProperty('--db-temperature', n);
      saveSetting('db-temperature', String(n));
    }
  }

  function getTemperature() {
    var saved = readSetting('db-temperature');
    if (saved === 'auto') return 'auto';
    return parseFloat(document.documentElement.style.getPropertyValue('--db-temperature')) || 0;
  }

  function initTemperature() {
    var saved = readSetting('db-temperature');
    if (saved === 'auto') {
      startAutoTemperature();
    } else if (saved !== null) {
      document.documentElement.style.setProperty('--db-temperature', saved);
    }

    nativeElements(document, '[data-db-temperature]').forEach(function(slider) {
      if (slider._dbTempInit) return;
      slider._dbTempInit = true;
      var input = nativeElement(slider, '.db-slider__input');
      var valueEl = nativeElement(slider, '.db-slider__value');
      if (!input) return;

      if (saved === 'auto') {
        // In auto mode, show current computed value but mark as auto
        var current = calcAutoTemperature();
        input.value = Math.round(current * 100);
        if (valueEl) valueEl.textContent = 'auto';
      } else if (saved !== null) {
        input.value = Math.round(parseFloat(saved) * 100);
        if (valueEl) valueEl.textContent = input.value;
      }

      input.addEventListener('input', function() {
        // Manual slider interaction exits auto mode
        stopAutoTemperature();
        var val = input.value / 100;
        document.documentElement.style.setProperty('--db-temperature', val);
        saveSetting('db-temperature', val);
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
    var saved = readSetting('db-noise');
    if (saved !== null) {
      document.documentElement.style.setProperty('--db-noise', saved);
    }

    nativeElements(document, '[data-db-noise]').forEach(function(slider) {
      if (slider._dbNoiseInit) return;
      slider._dbNoiseInit = true;
      var input = nativeElement(slider, '.db-slider__input');
      var valueEl = nativeElement(slider, '.db-slider__value');
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
        saveSetting('db-noise', rounded);
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
    var saved = readSetting('db-texture') || 'grain';
    document.documentElement.setAttribute('data-db-texture', saved);

    nativeElements(document, '[data-db-texture-btn]').forEach(function(btn) {
      if (btn._dbInit) return;
      btn._dbInit = true;
      var type = btn.getAttribute('data-db-texture-btn');
      btn.setAttribute('aria-pressed', type === saved ? 'true' : 'false');

      btn.addEventListener('click', function() {
        document.documentElement.setAttribute('data-db-texture', type);
        saveSetting('db-texture', type);
        nativeElements(document, '[data-db-texture-btn]').forEach(function(b) {
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
    var containers = nativeElements(root, '.db-card, .db-modal, .db-sheet, .db-drawer, .db-alert-dialog, .db-showcase__frame, [data-db-radius]');
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

  var RADIUS_SKIP = /\bdb-(btn|input|field|textarea|switch|slider|checkbox|radio|toggle|badge|avatar|alert|chip|kbd|spinner|select|custom-select|search|otp|progress|pagination|stepper|tabs|separator|divider|nav-menu|bottom-nav|breadcrumbs|carousel|calendar|popover|tooltip|hover-card|dropdown|context-menu|command|stat|chart-card)/;

  function propagateRadius(parent, innerR) {
    var children = Array.from(parent.children);
    var targets = [];
    var recurse = [];
    children.forEach(function(child) {
      if (child.nodeType !== 1) return;
      if (isReactOwned(child)) return;
      if (RADIUS_SKIP.test(child.className)) return;
      var cs = getComputedStyle(child);
      var hasBg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
      var hasBorder = cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none';
      var hasRadius = (parseFloat(cs.borderTopLeftRadius) || 0) > 0;
      if (hasBg || hasBorder || hasRadius) {
        targets.push(child);
      } else {
        recurse.push(child);
      }
    });
    targets.forEach(function(child) { child.style.borderRadius = innerR + 'px'; });
    recurse.forEach(function(child) { propagateRadius(child, innerR); });
  }

  /* ----------------------------------------------------------
     Checkbox (CSS handles visual sync via :checked)
     ---------------------------------------------------------- */
  function initCheckboxes(root) {
    nativeElements(root, '.db-checkbox').forEach(function(label) {
      if (label._dbInit) return;
      label._dbInit = true;
    });
  }

  /* ----------------------------------------------------------
     Radio (native inputs handle group management)
     ---------------------------------------------------------- */
  function initRadios(root) {
    nativeElements(root, '.db-radio-group').forEach(function(group) {
      if (group._dbInit) return;
      group._dbInit = true;
    });
  }

  /* ----------------------------------------------------------
     Helpers
     ---------------------------------------------------------- */
  var _uid = 0;
  function uid() { return 'db' + (++_uid) + '_' + Math.random().toString(36).slice(2, 6); }

  function isReactOwned(el) {
    return el && el.nodeType === 1 && !!el.closest('[data-db-react]');
  }

  function nativeElements(root, selector) {
    return Array.from(root.querySelectorAll(selector)).filter(function(el) { return !isReactOwned(el); });
  }

  function nativeElement(root, selector) {
    return nativeElements(root, selector)[0] || null;
  }

  function readSetting(key) {
    try { return localStorage.getItem(key); } catch(e) { return null; }
  }

  function saveSetting(key, value) {
    try { localStorage.setItem(key, value); } catch(e) {}
  }

  function isDisabled(el) {
    for (var node = el; node && node.nodeType === 1; node = node.parentElement) {
      if (node.matches(':disabled, [disabled], [aria-disabled="true"], [inert]') || /\bdb-[\w-]+--(?:disabled|loading)\b/.test(node.getAttribute('class') || '')) return true;
    }
    return false;
  }

  function focusableElements(root) {
    return Array.from(root.querySelectorAll('button, [href], input:not([type="hidden"]), select, textarea, [tabindex], [contenteditable="true"]')).filter(function(el) {
      return el.tabIndex >= 0 && !isDisabled(el) && !el.closest('[hidden]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    });
  }

  function setDisclosure(trigger, content, open) {
    trigger.setAttribute('aria-expanded', String(open));
    if (content) {
      if (!content.id) content.id = uid();
      trigger.setAttribute('aria-controls', content.id);
      content.hidden = !open;
    }
  }

  var _interactionGuardInit = false;
  function initInteractionGuards() {
    if (_interactionGuardInit) return;
    _interactionGuardInit = true;
    ['click', 'keydown'].forEach(function(type) {
      document.addEventListener(type, function(e) {
        if (isReactOwned(e.target)) return;
        if (isDisabled(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); }
      }, true);
    });
  }

  var _overlayStack = [];
  var _overlayOverflow = '';
  var _overlayKeysInit = false;
  var _overlayInert = new Map();

  function syncOverlayInert() {
    _overlayInert.forEach(function(inert, el) { el.inert = inert; });
    var top = _overlayStack[_overlayStack.length - 1];
    if (!top) { _overlayInert.clear(); return; }
    for (var el = top; el && el !== document.body; el = el.parentElement) {
      if (!el.parentElement) break;
      Array.from(el.parentElement.children).forEach(function(sibling) {
        if (sibling === el) return;
        if (!_overlayInert.has(sibling)) _overlayInert.set(sibling, sibling.inert);
        sibling.inert = true;
      });
    }
  }

  function syncOverlayTriggers(el, open) {
    nativeElements(document, '[data-db-trigger], [data-db-modal-trigger], [data-db-sheet-trigger], [data-db-drawer-trigger], [data-db-alert-dialog-trigger], [data-db-command-trigger]').forEach(function(trigger) {
      var id = trigger.getAttribute('data-db-trigger') || trigger.getAttribute('data-db-modal-trigger') || trigger.getAttribute('data-db-sheet-trigger') || trigger.getAttribute('data-db-drawer-trigger') || trigger.getAttribute('data-db-alert-dialog-trigger') || trigger.getAttribute('data-db-command-trigger');
      if (id === el.id) {
        trigger.setAttribute('aria-controls', id);
        trigger.setAttribute('aria-expanded', String(open));
        trigger.setAttribute('aria-haspopup', 'dialog');
      }
    });
  }

  function prepareOverlay(el, panelSelector, openClass) {
    if (!el._dbOverlay) el._dbOverlay = { panel: (_isDialog(el) ? el : nativeElement(el, panelSelector)) || el, openClass: openClass };
    var panel = el._dbOverlay.panel;
    if (!panel.hasAttribute('role')) panel.setAttribute('role', el.classList.contains('db-alert-dialog') ? 'alertdialog' : 'dialog');
    panel.setAttribute('aria-modal', 'true');
    if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
    var title = nativeElement(panel, '.db-modal__title, .db-sheet__title, .db-drawer__title, .db-alert-dialog__title');
    if (title && !panel.hasAttribute('aria-labelledby') && !panel.hasAttribute('aria-label')) {
      if (!title.id) title.id = uid();
      panel.setAttribute('aria-labelledby', title.id);
    }
    el.setAttribute('aria-hidden', String(!(_isDialog(el) ? el.open : el.classList.contains(openClass))));
    if (_overlayKeysInit) return;
    _overlayKeysInit = true;
    document.addEventListener('keydown', function(e) {
      var top = _overlayStack[_overlayStack.length - 1];
      if (!top || e.defaultPrevented || (isReactOwned(e.target) && !top.contains(e.target))) return;
      var modal = null;
      try { modal = document.querySelector('dialog:modal'); } catch (err) { modal = document.querySelector('dialog[open]'); }
      if (modal && modal !== top) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeOverlay(top);
      } else if (e.key === 'Tab') {
        var panel = top._dbOverlay.panel;
        var els = focusableElements(panel);
        var first = els[0] || panel, last = els[els.length - 1] || panel;
        if (!els.length || !panel.contains(document.activeElement) || (e.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
      }
    });
  }

  function openOverlay(el, panelSelector, openClass, trigger, preferred) {
    if (isReactOwned(el)) return;
    prepareOverlay(el, panelSelector, openClass);
    if (_overlayStack.indexOf(el) !== -1) return;
    el._dbOverlay.trigger = trigger || document.activeElement;
    if (_isDialog(el)) el.showModal();
    else el.classList.add(openClass);
    if (!_overlayStack.length) _overlayOverflow = document.body.style.overflow;
    _overlayStack.push(el);
    syncOverlayInert();
    el.setAttribute('aria-hidden', 'false');
    syncOverlayTriggers(el, true);
    document.body.style.overflow = 'hidden';
    var panel = el._dbOverlay.panel;
    var target = preferred && panel.querySelector(preferred);
    if (!target || isDisabled(target)) target = focusableElements(panel)[0] || panel;
    target.focus();
  }

  function finishOverlayClose(el) {
    var index = _overlayStack.indexOf(el);
    el.classList.remove(el._dbOverlay.openClass);
    el.setAttribute('aria-hidden', 'true');
    syncOverlayTriggers(el, false);
    if (index < 0) return;
    var wasTop = index === _overlayStack.length - 1;
    _overlayStack.splice(index, 1);
    syncOverlayInert();
    if (!_overlayStack.length) document.body.style.overflow = _overlayOverflow;
    var trigger = el._dbOverlay.trigger;
    el._dbOverlay.trigger = null;
    if (wasTop) {
      var top = _overlayStack[_overlayStack.length - 1];
      if (trigger && trigger.isConnected && !isDisabled(trigger) && (!top || top.contains(trigger))) trigger.focus();
      else if (top) (focusableElements(top._dbOverlay.panel)[0] || top._dbOverlay.panel).focus();
    }
  }

  function closeOverlay(el) {
    if (!el || !el._dbOverlay) return;
    if (_isDialog(el) && el.open) el.close();
    finishOverlayClose(el);
  }

  function popupState(el, open, restore) {
    if (isReactOwned(el)) return;
    var state = el._dbPopup;
    if (!state) return;
    var composerRoot = el.closest('.db-chat-composer');
    var composer = _chatComposers && _chatComposers.get(composerRoot);
    if (composer) composer.closePanels(open ? el : null, open ? null : el);
    if (open) nativeElements(document, '.' + state.openClass).forEach(function(peer) {
      if (peer !== el && (!composer || (peer.closest('.db-chat-composer') === composerRoot && !peer.contains(el)))) popupState(peer, false);
    });
    el.classList.toggle(state.openClass, open);
    state.trigger.setAttribute('aria-expanded', String(open));
    state.content.setAttribute('aria-hidden', String(!open));
    state.content.inert = !open;
    if (!open && restore) state.trigger.focus();
  }

  function menuItems(content, selector) {
    return Array.from(nativeElements(content, selector)).filter(function(item) {
      return !isDisabled(item) && !item.hidden && item.getClientRects().length > 0;
    });
  }

  function initMenuKeys(content, selector, role) {
    content.setAttribute('role', role === 'option' ? 'listbox' : 'menu');
    nativeElements(content, selector).forEach(function(item) {
      item.setAttribute('role', role);
      item.setAttribute('tabindex', '-1');
      if (/--disabled\b/.test(item.className)) item.setAttribute('aria-disabled', 'true');
    });
    content.addEventListener('keydown', function(e) {
      var items = menuItems(content, selector);
      var idx = items.indexOf(document.activeElement);
      var next = -1;
      if (e.key === 'ArrowDown') next = (idx + 1) % items.length;
      else if (e.key === 'ArrowUp') next = idx < 0 ? items.length - 1 : (idx - 1 + items.length) % items.length;
      else if (e.key === 'Home' && idx >= 0) next = 0;
      else if (e.key === 'End' && idx >= 0) next = items.length - 1;
      if (next >= 0 && items[next]) { e.preventDefault(); items[next].focus(); }
      else if ((e.key === 'Enter' || e.key === ' ') && idx >= 0 && !items[idx].matches('button, a[href], input')) {
        e.preventDefault(); items[idx].click();
      }
    });
  }

  function initPopup(el, trigger, content, openClass, itemSelector, role) {
    if (!trigger || !content) return;
    el._dbPopup = { trigger: trigger, content: content, openClass: openClass };
    if (!content.id) content.id = uid();
    trigger.setAttribute('aria-controls', content.id);
    if (itemSelector) {
      trigger.setAttribute('aria-haspopup', role === 'option' ? 'listbox' : 'menu');
      initMenuKeys(content, itemSelector, role || 'menuitem');
    }
    popupState(el, el.classList.contains(openClass));
    trigger.addEventListener('keydown', function(e) {
      if (e.target !== trigger) return;
      if ((e.key === 'Enter' || e.key === ' ') && !trigger.matches('button, input, a[href]')) {
        e.preventDefault(); trigger.click(); return;
      }
      if (!itemSelector || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      e.preventDefault();
      popupState(el, true);
      var items = menuItems(content, itemSelector);
      var item = e.key === 'ArrowUp' ? items[items.length - 1] : items[0];
      if (item) item.focus();
    });
    el.addEventListener('keydown', function(e) {
      if (!el.classList.contains(openClass)) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); popupState(el, false, true); }
    });
    el.addEventListener('focusout', function() {
      setTimeout(function() {
        if (el.isConnected && !el.contains(document.activeElement)) popupState(el, false);
      }, 0);
    });
  }

  /* ----------------------------------------------------------
     Accordion
     ---------------------------------------------------------- */
  function initAccordions(root) {
    nativeElements(root, '.db-accordion').forEach(function(acc) {
      if (acc._dbInit) return;
      acc._dbInit = true;
      nativeElements(acc, '.db-accordion__trigger').forEach(function(trigger) {
        var ownItem = trigger.closest('.db-accordion__item');
        if (!ownItem || trigger.closest('.db-accordion') !== acc) return;
        setDisclosure(trigger, nativeElement(ownItem, '.db-accordion__content'), ownItem.classList.contains('db-accordion__item--open'));
        trigger.addEventListener('click', function() {
          var item = trigger.closest('.db-accordion__item');
          if (!item) return;
          var isOpen = item.classList.contains('db-accordion__item--open');
          // Close siblings if single mode (default)
          if (!acc.hasAttribute('data-multi')) {
            nativeElements(acc, '.db-accordion__item--open').forEach(function(openItem) {
              if (openItem.closest('.db-accordion') !== acc) return;
              openItem.classList.remove('db-accordion__item--open');
              var siblingTrigger = nativeElement(openItem, '.db-accordion__trigger');
              if (siblingTrigger) setDisclosure(siblingTrigger, nativeElement(openItem, '.db-accordion__content'), false);
            });
          }
          if (!isOpen) {
            item.classList.add('db-accordion__item--open');
            setDisclosure(trigger, nativeElement(item, '.db-accordion__content'), true);
          } else {
            item.classList.remove('db-accordion__item--open');
            setDisclosure(trigger, nativeElement(item, '.db-accordion__content'), false);
          }
        });
      });
    });
  }

  /* ----------------------------------------------------------
     Collapsible
     ---------------------------------------------------------- */
  function initCollapsibles(root) {
    nativeElements(root, '.db-collapsible').forEach(function(col) {
      if (col._dbInit) return;
      col._dbInit = true;
      var trigger = nativeElement(col, '.db-collapsible__trigger');
      if (!trigger) return;
      var content = nativeElement(col, '.db-collapsible__content');
      setDisclosure(trigger, content, col.classList.contains('db-collapsible--open'));
      trigger.addEventListener('click', function() {
        var isOpen = col.classList.contains('db-collapsible--open');
        col.classList.toggle('db-collapsible--open');
        setDisclosure(trigger, content, !isOpen);
      });
    });
  }

  /* ----------------------------------------------------------
     Alert Dialog
     ---------------------------------------------------------- */
  function openAlertDialog(id) {
    var dialog = document.getElementById(id);
    if (!dialog) return;
    openOverlay(dialog, '.db-alert-dialog__panel', 'db-alert-dialog--open', null, '[data-action="cancel"]');
  }

  function closeAlertDialog(id) {
    var dialog = document.getElementById(id);
    if (!dialog) return;
    closeOverlay(dialog);
  }

  function initAlertDialogs(root) {
    nativeElements(root, '.db-alert-dialog').forEach(function(dialog) {
      if (dialog._dbInit) return;
      dialog._dbInit = true;
      prepareOverlay(dialog, '.db-alert-dialog__panel', 'db-alert-dialog--open');
      nativeElement(dialog, '.db-alert-dialog__overlay')?.addEventListener('click', function(e) {
        if (e.target === e.currentTarget) closeOverlay(dialog);
      });
      nativeElements(dialog, '[data-action="cancel"]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          closeOverlay(dialog);
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
    openOverlay(sheet, '.db-sheet__panel', 'db-sheet--open');
  }

  function closeSheet(id) {
    var sheet = document.getElementById(id);
    if (!sheet) return;
    closeOverlay(sheet);
  }

  function initSheets(root) {
    nativeElements(root, '.db-sheet').forEach(function(sheet) {
      if (sheet._dbInit) return;
      sheet._dbInit = true;
      prepareOverlay(sheet, '.db-sheet__panel', 'db-sheet--open');
      nativeElement(sheet, '.db-sheet__overlay')?.addEventListener('click', function(e) {
        if (e.target === e.currentTarget) closeOverlay(sheet);
      });
      nativeElements(sheet, '.db-sheet__close').forEach(function(btn) {
        btn.addEventListener('click', function() {
          closeOverlay(sheet);
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
    openOverlay(drawer, '.db-drawer__panel', 'db-drawer--open');
  }

  function closeDrawer(id) {
    var drawer = document.getElementById(id);
    if (!drawer) return;
    closeOverlay(drawer);
  }

  function initDrawers(root) {
    nativeElements(root, '.db-drawer').forEach(function(drawer) {
      if (drawer._dbInit) return;
      drawer._dbInit = true;
      prepareOverlay(drawer, '.db-drawer__panel', 'db-drawer--open');
      nativeElements(drawer, '.db-drawer__close, [data-action="cancel"]').forEach(function(btn) {
        btn.addEventListener('click', function() { closeOverlay(drawer); });
      });
      nativeElement(drawer, '.db-drawer__overlay')?.addEventListener('click', function(e) {
        if (e.target === e.currentTarget) closeOverlay(drawer);
      });
    });
  }

  /* ----------------------------------------------------------
     Floating panels: shift an open popover, dropdown, hover card
     or tooltip sideways so it stays inside the viewport. The shift
     goes in --db-panel-shift, which daub.css applies as translate.
     The panel always gets its own value, so a panel nested in a
     shifted one does not inherit the ancestor's shift.
     ---------------------------------------------------------- */
  var PANEL_GUTTER = 8;
  function clampPanel(panel) {
    panel.style.setProperty('--db-panel-shift', '0px');
    var r = panel.getBoundingClientRect();
    if (!r.width) return;
    var vw = document.documentElement.clientWidth;
    var dx = 0;
    if (r.right > vw - PANEL_GUTTER) dx = vw - PANEL_GUTTER - r.right;
    if (r.left + dx < PANEL_GUTTER) dx = PANEL_GUTTER - r.left;
    if (dx) panel.style.setProperty('--db-panel-shift', dx + 'px');
  }
  // Re-clamp on every class change of the wrapper, so programmatic opens
  // (classList.add('db-popover--open')) are covered too. A closed panel measures
  // 0 wide and keeps a zero shift.
  function watchPanel(wrap, openClass, panel) {
    if (!panel) return;
    var sync = function() { clampPanel(panel); };
    if (typeof MutationObserver === 'function') {
      new MutationObserver(sync).observe(wrap, { attributes: true, attributeFilter: ['class'] });
    }
    if (wrap.classList.contains(openClass)) sync();
  }
  // Hover cards and tooltips open on :hover / :focus-within, or with an --open class.
  function watchHoverPanel(wrap, openClass, panel) {
    if (!panel) return;
    var clamp = function() { clampPanel(panel); };
    wrap.addEventListener('mouseenter', clamp);
    wrap.addEventListener('focusin', clamp);
    watchPanel(wrap, openClass, panel);
  }

  /* ----------------------------------------------------------
     Popover
     ---------------------------------------------------------- */
  var _dbPopoverClickInit = false;
  function initPopovers(root) {
    nativeElements(root, '.db-popover').forEach(function(pop) {
      if (pop._dbInit) return;
      pop._dbInit = true;
      watchPanel(pop, 'db-popover--open', nativeElement(pop, '.db-popover__content'));
      var trigger = nativeElement(pop, '.db-popover__trigger');
      if (!trigger) return;
      initPopup(pop, trigger, nativeElement(pop, '.db-popover__content'), 'db-popover--open');
      trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        popupState(pop, !pop.classList.contains('db-popover--open'));
      });
    });
    if (!_dbPopoverClickInit) {
      _dbPopoverClickInit = true;
      document.addEventListener('click', function(e) {
        nativeElements(document, '.db-popover--open').forEach(function(p) {
          if (!p.contains(e.target)) popupState(p, false);
        });
      });
    }
  }

  /* ----------------------------------------------------------
     Context Menu
     ---------------------------------------------------------- */
  var _dbCtxClickInit = false;
  function initContextMenus(root) {
    nativeElements(root, '[data-context-menu]').forEach(function(el) {
      if (el._dbCtx) return;
      el._dbCtx = true;
      var menuId = el.getAttribute('data-context-menu');
      var menu = document.getElementById(menuId);
      if (!menu) return;
      el.setAttribute('aria-haspopup', 'menu');
      el.setAttribute('aria-controls', menuId);
      menu.setAttribute('aria-hidden', String(!menu.classList.contains('db-context-menu--open')));
      if (!menu._dbMenuKeys) {
        menu._dbMenuKeys = true;
        initMenuKeys(menu, '.db-context-menu__item', 'menuitem');
        menu.addEventListener('keydown', function(e) {
          if (e.key === 'Escape' || e.key === 'Tab') {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
            menu.classList.remove('db-context-menu--open');
            menu.setAttribute('aria-hidden', 'true');
            if (menu._dbInvoker) menu._dbInvoker.focus();
          }
        });
      }
      function openContext(e) {
        if (isDisabled(el)) return;
        e.preventDefault();
        nativeElements(document, '.db-context-menu--open').forEach(function(m) {
          m.classList.remove('db-context-menu--open');
          m.setAttribute('aria-hidden', 'true');
        });
        var rect = el.getBoundingClientRect();
        menu.style.left = (e.type === 'keydown' ? rect.left : e.clientX) + 'px';
        menu.style.top = (e.type === 'keydown' ? rect.bottom : e.clientY) + 'px';
        menu.classList.add('db-context-menu--open');
        menu.setAttribute('aria-hidden', 'false');
        menu._dbInvoker = el;
        var box = menu.getBoundingClientRect();
        menu.style.left = Math.max(0, Math.min(parseFloat(menu.style.left), window.innerWidth - box.width)) + 'px';
        menu.style.top = Math.max(0, Math.min(parseFloat(menu.style.top), window.innerHeight - box.height)) + 'px';
        var first = menuItems(menu, '.db-context-menu__item')[0];
        if (first) first.focus();
      }
      el.addEventListener('contextmenu', openContext);
      el.addEventListener('keydown', function(e) {
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) openContext(e);
      });
    });
    if (!_dbCtxClickInit) {
      _dbCtxClickInit = true;
      document.addEventListener('click', function() {
        nativeElements(document, '.db-context-menu--open').forEach(function(m) {
          m.classList.remove('db-context-menu--open');
          m.setAttribute('aria-hidden', 'true');
        });
      });
    }
  }

  /* ----------------------------------------------------------
     Dropdown Menu
     ---------------------------------------------------------- */
  var _dbDropClickInit = false;
  function initDropdowns(root) {
    nativeElements(root, '.db-dropdown').forEach(function(drop) {
      if (drop._dbInit) return;
      drop._dbInit = true;
      var trigger = nativeElement(drop, '.db-dropdown__trigger');
      if (!trigger) return;
      var content = nativeElement(drop, '.db-dropdown__content') || nativeElement(drop, '.db-dropdown__menu');
      if (!content) return;
      initPopup(drop, trigger, content, 'db-dropdown--open', '.db-dropdown__item', 'menuitem');
      watchPanel(drop, 'db-dropdown--open', content);
      trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        var wasOpen = drop.classList.contains('db-dropdown--open');
        var composerRoot = drop.closest('.db-chat-composer');
        nativeElements(document, '.db-dropdown--open').forEach(function(d) {
          if (!composerRoot || d.closest('.db-chat-composer') === composerRoot) popupState(d, false);
        });
        if (!wasOpen) popupState(drop, true);
      });
    });
    if (!_dbDropClickInit) {
      _dbDropClickInit = true;
      document.addEventListener('click', function() {
        nativeElements(document, '.db-dropdown--open').forEach(function(d) {
          popupState(d, false, d.contains(document.activeElement));
        });
      });
    }
  }

  /* ----------------------------------------------------------
     Toggle / Toggle Group
     ---------------------------------------------------------- */
  function initToggles(root) {
    nativeElements(root, '.db-toggle').forEach(function(toggle) {
      if (toggle._dbInit) return;
      toggle._dbInit = true;
      var active = toggle.getAttribute('aria-pressed') === 'true' || toggle.classList.contains('db-toggle--active');
      toggle.setAttribute('aria-pressed', String(active));
      toggle.classList.toggle('db-toggle--active', active);
      toggle.addEventListener('click', function() {
        var wasActive = toggle.getAttribute('aria-pressed') === 'true';
        var group = toggle.closest('.db-toggle-group');
        if (group && !group.hasAttribute('data-multi')) {
          nativeElements(group, '.db-toggle').forEach(function(t) {
            t.setAttribute('aria-pressed', 'false');
            t.classList.remove('db-toggle--active');
          });
        }
        toggle.setAttribute('aria-pressed', String(!wasActive));
        toggle.classList.toggle('db-toggle--active', !wasActive);
      });
    });
  }

  /* ----------------------------------------------------------
     Custom Select
     ---------------------------------------------------------- */
  var _dbCustomSelectClickInit = false;
  function initCustomSelects(root) {
    nativeElements(root, '.db-custom-select').forEach(function(sel) {
      if (sel._dbInit) return;
      sel._dbInit = true;
      var trigger = nativeElement(sel, '.db-custom-select__trigger');
      if (!trigger) return;
      initPopup(sel, trigger, nativeElement(sel, '.db-custom-select__dropdown'), 'db-custom-select--open', '.db-custom-select__option', 'option');

      trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        var wasOpen = sel.classList.contains('db-custom-select--open');
        nativeElements(document, '.db-custom-select--open').forEach(function(s) {
          popupState(s, false);
        });
        if (!wasOpen) {
          popupState(sel, true);
          var searchInput = nativeElement(sel, '.db-custom-select__search input');
          if (searchInput) searchInput.focus();
        }
      });

      nativeElements(sel, '.db-custom-select__option').forEach(function(opt) {
        opt.setAttribute('aria-selected', String(opt.classList.contains('db-custom-select__option--selected')));
        opt.addEventListener('click', function() {
          if (isDisabled(opt)) return;
          nativeElements(sel, '.db-custom-select__option--selected').forEach(function(s) {
            s.classList.remove('db-custom-select__option--selected');
            s.setAttribute('aria-selected', 'false');
          });
          opt.classList.add('db-custom-select__option--selected');
          opt.setAttribute('aria-selected', 'true');
          var valueEl = nativeElement(trigger, '.db-custom-select__value') || nativeElement(trigger, '.db-custom-select__placeholder');
          if (valueEl) {
            valueEl.textContent = opt.textContent.trim();
            valueEl.classList.remove('db-custom-select__placeholder');
            valueEl.classList.add('db-custom-select__value');
          }
          popupState(sel, false, true);
        });
      });

      // Search filter
      var searchInput = nativeElement(sel, '.db-custom-select__search input');
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          var q = searchInput.value.toLowerCase();
          nativeElements(sel, '.db-custom-select__option').forEach(function(opt) {
            opt.style.display = opt.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
          });
        });
        searchInput.addEventListener('click', function(e) { e.stopPropagation(); });
      }
    });

    if (!_dbCustomSelectClickInit) {
      _dbCustomSelectClickInit = true;
      document.addEventListener('click', function(e) {
        nativeElements(document, '.db-custom-select--open').forEach(function(s) {
          if (!s.contains(e.target)) popupState(s, false);
        });
      });
    }
  }

  /* ----------------------------------------------------------
     Command Palette
     ---------------------------------------------------------- */
  function openCommand(id) {
    var cmd = document.getElementById(id);
    if (!cmd) return;
    var input = nativeElement(cmd, '.db-command__input');
    cmd._dbCommandActive = -1;
    if (input) { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); }
    openOverlay(cmd, '.db-command__panel', 'db-command--open', null, '.db-command__input');
  }

  function closeCommand(id) {
    var cmd = document.getElementById(id);
    if (!cmd) return;
    closeOverlay(cmd);
  }

  var _dbCommandKeyInit = false;
  function initCommands(root) {
    nativeElements(root, '.db-command').forEach(function(cmd) {
      if (cmd._dbInit) return;
      cmd._dbInit = true;
      prepareOverlay(cmd, '.db-command__panel', 'db-command--open');
      var list = nativeElement(cmd, '.db-command__list');
      if (list) {
        if (!list.id) list.id = uid();
        list.setAttribute('role', 'listbox');
      }
      nativeElements(cmd, '.db-command__item').forEach(function(item) {
        if (!item.id) item.id = uid();
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', 'false');
        item.addEventListener('click', function() { closeOverlay(cmd); });
      });

      nativeElement(cmd, '.db-command__overlay')?.addEventListener('click', function(e) {
        if (e.target === e.currentTarget) closeOverlay(cmd);
      });

      var input = nativeElement(cmd, '.db-command__input');
      if (input) {
        if (list) {
          input.setAttribute('role', 'combobox');
          input.setAttribute('aria-controls', list.id);
          input.setAttribute('aria-expanded', 'true');
          input.setAttribute('aria-autocomplete', 'list');
        }
        if (!input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby')) {
          input.setAttribute('aria-label', 'Search commands');
        }
        input.addEventListener('input', function() {
          var q = input.value.toLowerCase();
          cmd._dbCommandActive = -1;
          input.removeAttribute('aria-activedescendant');
          nativeElements(cmd, '.db-command__item').forEach(function(item) {
            item.style.display = item.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
            item.setAttribute('aria-selected', 'false');
            item.classList.remove('db-command__item--active');
          });
          var empty = nativeElement(cmd, '.db-command__empty');
          if (empty) {
            var anyVisible = nativeElement(cmd, '.db-command__item:not([style*="display: none"])');
            empty.style.display = anyVisible ? 'none' : '';
          }
        });

        input.addEventListener('keydown', function(e) {
          var items = menuItems(cmd, '.db-command__item');
          var idx = cmd._dbCommandActive == null ? -1 : cmd._dbCommandActive;
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!items.length) return;
            idx = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx < 0 ? items.length - 1 : (idx - 1 + items.length) % items.length);
            cmd._dbCommandActive = idx;
            items.forEach(function(item, i) {
              item.classList.toggle('db-command__item--active', i === idx);
              item.setAttribute('aria-selected', String(i === idx));
            });
            input.setAttribute('aria-activedescendant', items[idx].id);
            items[idx].scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'Enter' && items[idx]) {
            e.preventDefault(); items[idx].click(); closeOverlay(cmd);
          }
        });
      }
    });

    // Ctrl+K / Cmd+K global shortcut
    if (!_dbCommandKeyInit) {
      _dbCommandKeyInit = true;
      document.addEventListener('keydown', function(e) {
        if (isReactOwned(e.target)) return;
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !e.repeat) {
          var cmd = nativeElements(document, '.db-command')[0];
          if (cmd) {
            e.preventDefault();
            if (cmd.classList.contains('db-command--open')) {
              closeCommand(cmd.id);
            } else {
              openCommand(cmd.id);
            }
          }
        }
      });
    }
  }

  /* ----------------------------------------------------------
     Menubar
     ---------------------------------------------------------- */
  var _dbMenubarClickInit = false;
  function initMenubars(root) {
    nativeElements(root, '.db-menubar').forEach(function(bar) {
      if (bar._dbInit) return;
      bar._dbInit = true;
      bar.setAttribute('role', 'menubar');
      nativeElements(bar, '.db-menubar__item').forEach(function(item) {
        var dropdown = nativeElement(item, '.db-menubar__dropdown');
        item.setAttribute('role', 'menuitem');
        if (dropdown) initPopup(item, item, dropdown, 'db-menubar__item--open', '.db-dropdown__item', 'menuitem');
        item.addEventListener('keydown', function(e) {
          if (e.target !== item || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
          var items = Array.from(nativeElements(bar, '.db-menubar__item')).filter(function(i) { return !isDisabled(i); });
          var idx = items.indexOf(item);
          var next = items[(idx + (e.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length];
          if (!next) return;
          e.preventDefault();
          var open = !!nativeElement(bar, '.db-menubar__item--open');
          items.forEach(function(i) { popupState(i, false); });
          next.focus();
          if (open) popupState(next, true);
        });
        item.addEventListener('click', function(e) {
          e.stopPropagation();
          if (dropdown && dropdown.contains(e.target)) { popupState(item, false, true); return; }
          var wasOpen = item.classList.contains('db-menubar__item--open');
          nativeElements(bar, '.db-menubar__item--open').forEach(function(i) {
            popupState(i, false);
          });
          if (!wasOpen) popupState(item, true);
        });
        item.addEventListener('mouseenter', function() {
          if (nativeElement(bar, '.db-menubar__item--open')) {
            nativeElements(bar, '.db-menubar__item--open').forEach(function(i) {
              popupState(i, false);
            });
            if (!isDisabled(item)) popupState(item, true);
          }
        });
      });
    });
    if (!_dbMenubarClickInit) {
      _dbMenubarClickInit = true;
      document.addEventListener('click', function() {
        nativeElements(document, '.db-menubar__item--open').forEach(function(i) {
          popupState(i, false);
        });
      });
    }
  }

  /* ----------------------------------------------------------
     Calendar / Date Picker
     ---------------------------------------------------------- */
  var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DAY_LABELS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

  function renderCalendarGrid(cal, year, month) {
    cal._dbYear = year;
    cal._dbMonth = month;
    var title = nativeElement(cal, '.db-calendar__title');
    if (title) title.textContent = MONTH_NAMES[month] + ' ' + year;
    var grid = nativeElement(cal, '.db-calendar__grid');
    if (!grid) return;

    // Clear day buttons but keep labels
    var labels = nativeElements(grid, '.db-calendar__day-label');
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    labels.forEach(function(l) { grid.appendChild(l); });
    if (!labels.length) {
      DAY_LABELS.forEach(function(d) {
        var lbl = document.createElement('span');
        lbl.className = 'db-calendar__day-label';
        lbl.textContent = d;
        grid.appendChild(lbl);
      });
    }

    var now = new Date();
    var todayY = now.getFullYear(), todayM = now.getMonth(), todayD = now.getDate();
    var firstDay = new Date(year, month, 1);
    var startDow = (firstDay.getDay() + 6) % 7; // Monday=0
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var daysInPrev = new Date(year, month, 0).getDate();
    var selectedDate = cal._dbSelected || null;

    // Previous month outside days
    for (var p = startDow - 1; p >= 0; p--) {
      var ob = document.createElement('button');
      ob.className = 'db-calendar__day db-calendar__day--outside';
      ob.textContent = String(daysInPrev - p);
      ob.type = 'button';
      var prevDate = new Date(year, month - 1, daysInPrev - p);
      ob.setAttribute('aria-label', MONTH_NAMES[prevDate.getMonth()] + ' ' + prevDate.getDate() + ', ' + prevDate.getFullYear());
      ob.setAttribute('tabindex', '-1');
      grid.appendChild(ob);
    }

    // Current month days
    for (var d = 1; d <= daysInMonth; d++) {
      var btn = document.createElement('button');
      btn.className = 'db-calendar__day';
      btn.type = 'button';
      if (year === todayY && month === todayM && d === todayD) btn.classList.add('db-calendar__day--today');
      if (selectedDate && selectedDate.year === year && selectedDate.month === month && selectedDate.day === d) {
        btn.classList.add('db-calendar__day--selected');
      }
      btn.textContent = String(d);
      btn.setAttribute('data-day', d);
      btn.setAttribute('aria-label', MONTH_NAMES[month] + ' ' + d + ', ' + year);
      btn.setAttribute('aria-pressed', String(btn.classList.contains('db-calendar__day--selected')));
      btn.setAttribute('tabindex', '-1');
      if (year === todayY && month === todayM && d === todayD) btn.setAttribute('aria-current', 'date');
      if (cal._dbDisabledDates && cal._dbDisabledDates[year + '-' + month + '-' + d]) {
        btn.disabled = true;
        btn.classList.add('db-calendar__day--disabled');
      }
      grid.appendChild(btn);
    }

    // Next month outside days to fill last row
    var totalCells = startDow + daysInMonth;
    var remainder = totalCells % 7;
    if (remainder > 0) {
      for (var n = 1; n <= 7 - remainder; n++) {
        var nb = document.createElement('button');
        nb.className = 'db-calendar__day db-calendar__day--outside';
        nb.textContent = String(n);
        nb.type = 'button';
        var nextDate = new Date(year, month + 1, n);
        nb.setAttribute('aria-label', MONTH_NAMES[nextDate.getMonth()] + ' ' + n + ', ' + nextDate.getFullYear());
        nb.setAttribute('tabindex', '-1');
        grid.appendChild(nb);
      }
    }
    var activeDay = nativeElement(grid, '.db-calendar__day--selected:not([disabled])') || nativeElement(grid, '.db-calendar__day--today:not([disabled])') || nativeElement(grid, '[data-day]:not([disabled])');
    if (activeDay) activeDay.setAttribute('tabindex', '0');
  }

  var _dbCalendarClickInit = false;
  function initCalendars(root) {
    nativeElements(root, '.db-calendar').forEach(function(cal) {
      if (cal._dbInit) return;
      cal._dbInit = true;

      // Parse initial state
      if (cal._dbYear == null) {
        var titleEl = nativeElement(cal, '.db-calendar__title');
        var titleText = titleEl ? titleEl.textContent : '';
        var match = titleText.match(/(\w+)\s+(\d{4})/);
        if (match) {
          var mi = MONTH_NAMES.indexOf(match[1]);
          cal._dbYear = parseInt(match[2]);
          cal._dbMonth = mi >= 0 ? mi : new Date().getMonth();
        } else {
          cal._dbYear = new Date().getFullYear();
          cal._dbMonth = new Date().getMonth();
        }
      }

      // Detect initial selected day
      var selBtn = nativeElement(cal, '.db-calendar__day--selected');
      if (selBtn && !cal._dbSelected) {
        var dayNum = parseInt(selBtn.textContent);
        if (dayNum) cal._dbSelected = { year: cal._dbYear, month: cal._dbMonth, day: dayNum };
      }

      // Re-render with proper outside days
      cal._dbDisabledDates = cal._dbDisabledDates || {};
      nativeElements(cal, '.db-calendar__day--disabled, .db-calendar__day[disabled], .db-calendar__day[aria-disabled="true"]').forEach(function(day) {
        if (!day.classList.contains('db-calendar__day--outside')) cal._dbDisabledDates[cal._dbYear + '-' + cal._dbMonth + '-' + parseInt(day.textContent)] = true;
      });
      renderCalendarGrid(cal, cal._dbYear, cal._dbMonth);
      cal.addEventListener('keydown', function(e) {
        var day = e.target.closest('.db-calendar__day[data-day]');
        if (!day) return;
        var number = parseInt(day.getAttribute('data-day'));
        var delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
        var target;
        if (delta) target = new Date(cal._dbYear, cal._dbMonth, number + delta);
        else if (e.key === 'Home') target = new Date(cal._dbYear, cal._dbMonth, number - (new Date(cal._dbYear, cal._dbMonth, number).getDay() + 6) % 7);
        else if (e.key === 'End') target = new Date(cal._dbYear, cal._dbMonth, number + 6 - (new Date(cal._dbYear, cal._dbMonth, number).getDay() + 6) % 7);
        else if (e.key === 'PageUp' || e.key === 'PageDown') {
          var month = cal._dbMonth + (e.key === 'PageDown' ? 1 : -1);
          target = new Date(cal._dbYear, month, Math.min(number, new Date(cal._dbYear, month + 1, 0).getDate()));
        }
        if (!target) return;
        e.preventDefault();
        var direction = delta < 0 || e.key === 'PageUp' || e.key === 'Home' ? -1 : 1;
        for (var attempts = 0; attempts < 366 && cal._dbDisabledDates[target.getFullYear() + '-' + target.getMonth() + '-' + target.getDate()]; attempts++) {
          target.setDate(target.getDate() + direction);
        }
        if (target.getMonth() !== cal._dbMonth || target.getFullYear() !== cal._dbYear) {
          renderCalendarGrid(cal, target.getFullYear(), target.getMonth());
          bindDayClicks(cal);
        }
        var next = nativeElement(cal, '[data-day="' + target.getDate() + '"]');
        if (next && !isDisabled(next)) {
          nativeElements(cal, '.db-calendar__day').forEach(function(d) { d.setAttribute('tabindex', '-1'); });
          next.setAttribute('tabindex', '0'); next.focus();
        }
      });

      // Navigation
      var navBtns = nativeElements(cal, '.db-calendar__nav');
      if (navBtns.length >= 2) {
        if (!navBtns[0].hasAttribute('aria-label')) navBtns[0].setAttribute('aria-label', 'Previous month');
        if (!navBtns[1].hasAttribute('aria-label')) navBtns[1].setAttribute('aria-label', 'Next month');
        navBtns[0].addEventListener('click', function(e) {
          e.stopPropagation();
          var m = cal._dbMonth - 1, y = cal._dbYear;
          if (m < 0) { m = 11; y--; }
          renderCalendarGrid(cal, y, m);
          bindDayClicks(cal);
        });
        navBtns[1].addEventListener('click', function(e) {
          e.stopPropagation();
          var m = cal._dbMonth + 1, y = cal._dbYear;
          if (m > 11) { m = 0; y++; }
          renderCalendarGrid(cal, y, m);
          bindDayClicks(cal);
        });
      }

      bindDayClicks(cal);
    });

    nativeElements(root, '.db-date-picker').forEach(function(dp) {
      if (dp._dbInit) return;
      dp._dbInit = true;
      var trigger = nativeElement(dp, '.db-date-picker__trigger');
      if (trigger) {
        initPopup(dp, trigger, nativeElement(dp, '.db-date-picker__dropdown'), 'db-date-picker--open');
        trigger.addEventListener('click', function(e) {
          e.stopPropagation();
          popupState(dp, !dp.classList.contains('db-date-picker--open'));
          if (dp.classList.contains('db-date-picker--open')) {
            var first = nativeElement(dp, '.db-calendar__day[tabindex="0"]');
            if (first) first.focus();
          }
        });
      }

      // When a day is selected inside date-picker, update trigger and close
      var cal = nativeElement(dp, '.db-calendar');
      if (cal && trigger) {
        cal.addEventListener('db-date-select', function(e) {
          var sel = e.detail;
          var mm = String(sel.month + 1);
          if (mm.length < 2) mm = '0' + mm;
          var dd = String(sel.day);
          if (dd.length < 2) dd = '0' + dd;
          trigger.textContent = sel.year + '-' + mm + '-' + dd;
          popupState(dp, false, true);
        });
      }
    });

    if (!_dbCalendarClickInit) {
      _dbCalendarClickInit = true;
      document.addEventListener('click', function(e) {
        nativeElements(document, '.db-date-picker--open').forEach(function(dp) {
          if (!dp.contains(e.target)) popupState(dp, false);
        });
      });
    }
  }

  function bindDayClicks(cal) {
    nativeElements(cal, '.db-calendar__day').forEach(function(day) {
      if (day._dbBound) return;
      day._dbBound = true;
      if (day.classList.contains('db-calendar__day--disabled')) return;

      day.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isDisabled(day)) return;
        if (day.classList.contains('db-calendar__day--outside')) {
          // Navigate to that month
          var dayNum = parseInt(day.textContent);
          var grid = nativeElement(cal, '.db-calendar__grid');
          var allDays = nativeElements(grid, '.db-calendar__day');
          var idx = Array.prototype.indexOf.call(allDays, day);
          var firstCurrent = nativeElement(grid, '.db-calendar__day:not(.db-calendar__day--outside)');
          var firstIdx = Array.prototype.indexOf.call(allDays, firstCurrent);
          var m = cal._dbMonth, y = cal._dbYear;
          if (idx < firstIdx) { m--; if (m < 0) { m = 11; y--; } }
          else { m++; if (m > 11) { m = 0; y++; } }
          cal._dbSelected = { year: y, month: m, day: dayNum };
          renderCalendarGrid(cal, y, m);
          bindDayClicks(cal);
          cal.dispatchEvent(new CustomEvent('db-date-select', { detail: cal._dbSelected, bubbles: true }));
          return;
        }
        nativeElements(cal, '.db-calendar__day--selected').forEach(function(d) {
          d.classList.remove('db-calendar__day--selected');
          d.setAttribute('aria-pressed', 'false');
        });
        day.classList.add('db-calendar__day--selected');
        day.setAttribute('aria-pressed', 'true');
        var selDay = parseInt(day.textContent);
        cal._dbSelected = { year: cal._dbYear, month: cal._dbMonth, day: selDay };
        cal.dispatchEvent(new CustomEvent('db-date-select', { detail: cal._dbSelected, bubbles: true }));
      });
    });
  }

  /* ----------------------------------------------------------
     Carousel
     ---------------------------------------------------------- */
  function initCarousels(root) {
    nativeElements(root, '.db-carousel').forEach(function(car) {
      if (car._dbInit) return;
      car._dbInit = true;
      var track = nativeElement(car, '.db-carousel__track');
      var slides = nativeElements(car, '.db-carousel__slide');
      var dots = nativeElements(car, '.db-carousel__dot');
      var current = 0;
      if (!track || !slides.length) return;

      function goTo(idx) {
        if (idx < 0) idx = slides.length - 1;
        if (idx >= slides.length) idx = 0;
        current = idx;
        track.style.transform = 'translateX(-' + (current * 100) + '%)';
        dots.forEach(function(d, i) {
          d.classList.toggle('db-carousel__dot--active', i === current);
          d.setAttribute('aria-current', String(i === current));
        });
        slides.forEach(function(slide, i) {
          slide.setAttribute('aria-hidden', String(i !== current));
          slide.inert = i !== current;
        });
      }

      var prev = nativeElement(car, '.db-carousel__btn--prev');
      var next = nativeElement(car, '.db-carousel__btn--next');
      if (prev) prev.addEventListener('click', function() { goTo(current - 1); });
      if (next) next.addEventListener('click', function() { goTo(current + 1); });
      dots.forEach(function(d, i) {
        d.addEventListener('click', function() { goTo(i); });
      });
      if (getComputedStyle(track).touchAction === 'auto') track.style.touchAction = 'pan-y';
      var swipe = null;
      var suppressClick = false;
      var clickTimer;
      track.addEventListener('pointerdown', function(e) {
        if (swipe || !e.isPrimary || e.button !== 0 || (e.pointerType !== 'touch' && e.pointerType !== 'pen') || isDisabled(track) || isReactOwned(e.target)) return;
        if (e.target.closest('button, input, select, textarea, [contenteditable="true"]')) return;
        suppressClick = false;
        clearTimeout(clickTimer);
        swipe = { id: e.pointerId, x: e.clientX, y: e.clientY };
      });
      track.addEventListener('pointermove', function(e) {
        if (!swipe || e.pointerId !== swipe.id) return;
        if (isDisabled(track) || isReactOwned(track)) { endSwipe(e); return; }
        var dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { endSwipe(e); return; }
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.25) {
          if (!track.hasPointerCapture(e.pointerId)) track.setPointerCapture(e.pointerId);
          e.preventDefault();
        }
      });
      function endSwipe(e) {
        if (!swipe || e.pointerId !== swipe.id) return;
        var start = swipe;
        swipe = null;
        if (e.type === 'pointerup' && !isDisabled(track) && !isReactOwned(track)) {
          var dx = e.clientX - start.x, dy = e.clientY - start.y;
          var threshold = Math.max(30, Math.min(80, car.clientWidth * 0.15));
          if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.25) {
            goTo(current + (dx < 0 ? 1 : -1));
            suppressClick = true;
            clickTimer = setTimeout(function() { suppressClick = false; }, 350);
          }
        }
        if (track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
      }
      track.addEventListener('pointerup', endSwipe);
      track.addEventListener('pointercancel', endSwipe);
      track.addEventListener('lostpointercapture', function(e) { if (e.target === track) endSwipe(e); });
      track.addEventListener('click', function(e) {
        if (!suppressClick) return;
        suppressClick = false;
        e.preventDefault(); e.stopImmediatePropagation();
      }, true);
      track.addEventListener('keydown', function() { suppressClick = false; });
      goTo(0);
    });
  }

  /* ----------------------------------------------------------
     Data Table — select-all sync + click-to-sort
     ---------------------------------------------------------- */
  function initDataTables(root) {
    nativeElements(root, '.db-data-table').forEach(function(table) {
      if (table._dbInit) return;
      table._dbInit = true;

      /* Row selection: keep the thead checkbox in sync with tbody rows */
      var headCheck = nativeElement(table, 'thead .db-data-table__check');
      function rowChecks() {
        return Array.prototype.slice.call(nativeElements(table, 'tbody .db-data-table__check')).filter(function(c) { return !isDisabled(c); });
      }
      function syncRow(check) {
        var row = check.closest('tr');
        if (!row) return;
        if (check.checked) row.setAttribute('data-selected', '');
        else row.removeAttribute('data-selected');
      }
      function syncHead() {
        if (!headCheck) return;
        var checks = rowChecks();
        var checked = checks.filter(function(c) { return c.checked; }).length;
        headCheck.checked = checks.length > 0 && checked === checks.length;
        headCheck.indeterminate = checked > 0 && checked < checks.length;
      }
      if (headCheck) {
        headCheck.addEventListener('change', function() {
          rowChecks().forEach(function(c) { c.checked = headCheck.checked; syncRow(c); });
          headCheck.indeterminate = false;
        });
      }
      table.addEventListener('change', function(e) {
        var check = e.target && e.target.classList && e.target.classList.contains('db-data-table__check') ? e.target : null;
        if (!check || !check.closest('tbody') || isReactOwned(check)) return;
        syncRow(check);
        syncHead();
      });
      rowChecks().forEach(syncRow);
      syncHead();

      /* Sortable headers: toggle aria-sort, reorder tbody rows */
      var headers = nativeElements(table, 'th[data-sortable], th[data-db-sort]');
      headers.forEach(function(th) {
        if (!th.hasAttribute('tabindex') && !nativeElement(th, 'button, a[href]')) th.setAttribute('tabindex', '0');
        th.addEventListener('keydown', function(e) {
          if (e.target === th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); th.click(); }
        });
        th.addEventListener('click', function() {
          var dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
          headers.forEach(function(h) { h.removeAttribute('aria-sort'); });
          th.setAttribute('aria-sort', dir);
          var tbody = nativeElement(table, 'tbody');
          if (!tbody) return;
          var col = Array.prototype.indexOf.call(th.parentNode.children, th);
          var rows = Array.prototype.slice.call(nativeElements(tbody, 'tr'));
          rows.sort(function(a, b) {
            var av = a.children[col] ? a.children[col].textContent.trim() : '';
            var bv = b.children[col] ? b.children[col].textContent.trim() : '';
            var an = parseFloat(av.replace(/[^0-9.\-]/g, ''));
            var bn = parseFloat(bv.replace(/[^0-9.\-]/g, ''));
            var cmp = (!isNaN(an) && !isNaN(bn) && av !== '' && bv !== '') ? an - bn : av.localeCompare(bv);
            return dir === 'ascending' ? cmp : -cmp;
          });
          rows.forEach(function(r) { tbody.appendChild(r); });
        });
      });
    });
  }

  /* ----------------------------------------------------------
     Input OTP
     ---------------------------------------------------------- */
  function initOTP(root) {
    nativeElements(root, '.db-otp').forEach(function(otp) {
      if (otp._dbInit) return;
      otp._dbInit = true;
      var inputs = nativeElements(otp, '.db-otp__input');
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
          var clipboard = e.clipboardData || window.clipboardData;
          if (!clipboard) return;
          var data = clipboard.getData('text').trim();
          if (!data || isDisabled(input)) return;
          var available = Array.from(inputs).slice(idx).filter(function(i) { return !isDisabled(i) && !i.readOnly; });
          for (var i = 0; i < Math.min(data.length, available.length); i++) {
            available[i].value = data[i];
            available[i].dispatchEvent(new Event('input', { bubbles: true }));
          }
          var focusIdx = Math.min(data.length, available.length - 1);
          if (available[focusIdx]) available[focusIdx].focus();
        });
      });
    });
  }

  /* ----------------------------------------------------------
     Resizable
     ---------------------------------------------------------- */
  function initResizables(root) {
    nativeElements(root, '.db-resizable').forEach(function(el) {
      if (el._dbInit) return;
      el._dbInit = true;
      nativeElements(el, '.db-resizable__handle').forEach(function(handle) {
        var startX, startY, startW, startH;
        var pointer = null;
        var horizontal = handle.classList.contains('db-resizable__handle--right') || handle.classList.contains('db-resizable__handle--corner');
        var vertical = handle.classList.contains('db-resizable__handle--bottom') || handle.classList.contains('db-resizable__handle--corner');
        handle.setAttribute('tabindex', '0');
        handle.setAttribute('role', horizontal && vertical ? 'button' : 'separator');
        handle.setAttribute('aria-label', 'Resize panel');
        handle.style.touchAction = 'none';
        if (!(horizontal && vertical)) handle.setAttribute('aria-orientation', horizontal ? 'vertical' : 'horizontal');
        handle.addEventListener('keydown', function(e) {
          var step = e.shiftKey ? 50 : 10;
          if (horizontal && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            e.preventDefault(); el.style.width = Math.max(1, el.offsetWidth + (e.key === 'ArrowRight' ? step : -step)) + 'px';
          }
          if (vertical && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault(); el.style.height = Math.max(1, el.offsetHeight + (e.key === 'ArrowDown' ? step : -step)) + 'px';
          }
          handle.setAttribute('aria-valuenow', horizontal ? el.offsetWidth : el.offsetHeight);
        });
        handle.addEventListener('pointerdown', function(e) {
          if (pointer !== null || !e.isPrimary || e.button !== 0 || isDisabled(handle) || isReactOwned(handle)) return;
          e.preventDefault();
          pointer = e.pointerId;
          handle.setPointerCapture(pointer);
          startX = e.clientX;
          startY = e.clientY;
          startW = el.offsetWidth;
          startH = el.offsetHeight;
          function onMove(ev) {
            if (ev.pointerId !== pointer) return;
            if (!el.isConnected || isDisabled(handle) || isReactOwned(handle)) { cleanup(); return; }
            if (handle.classList.contains('db-resizable__handle--right') || handle.classList.contains('db-resizable__handle--corner')) {
              el.style.width = Math.max(1, startW + ev.clientX - startX) + 'px';
            }
            if (handle.classList.contains('db-resizable__handle--bottom') || handle.classList.contains('db-resizable__handle--corner')) {
              el.style.height = Math.max(1, startH + ev.clientY - startY) + 'px';
            }
            handle.setAttribute('aria-valuenow', horizontal ? el.offsetWidth : el.offsetHeight);
          }
          function cleanup() {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('pointercancel', onUp);
            handle.removeEventListener('lostpointercapture', onUp);
            window.removeEventListener('blur', cleanup);
            var id = pointer;
            pointer = null;
            if (id !== null && handle.hasPointerCapture(id)) handle.releasePointerCapture(id);
          }
          function onUp(ev) { if (ev.pointerId === pointer) cleanup(); }
          document.addEventListener('pointermove', onMove);
          document.addEventListener('pointerup', onUp);
          document.addEventListener('pointercancel', onUp);
          handle.addEventListener('lostpointercapture', onUp);
          window.addEventListener('blur', cleanup);
        });
      });
    });
  }

  /* ----------------------------------------------------------
     Sidebar Toggle
     ---------------------------------------------------------- */
  var _sidebarMedia = null;

  function isSidebarCollapsed(sidebar) {
    return sidebar.classList.contains('db-sidebar--collapsed') ||
      (!sidebar.classList.contains('db-sidebar--expanded') && (_sidebarMedia || window.matchMedia('(max-width: 640px)')).matches);
  }

  function hideSidebarTooltip(sidebar) {
    var tip = sidebar._dbSidebarTooltip;
    if (!tip) return;
    if (typeof tip.hidePopover === 'function') {
      if (tip.matches(':popover-open')) tip.hidePopover();
    } else tip.hidden = true;
    if (tip._dbTrigger) {
      var descriptions = (tip._dbTrigger.getAttribute('aria-describedby') || '').split(/\s+/).filter(function(id) { return id && id !== tip.id; });
      if (descriptions.length) tip._dbTrigger.setAttribute('aria-describedby', descriptions.join(' '));
      else tip._dbTrigger.removeAttribute('aria-describedby');
      tip._dbTrigger = null;
    }
  }

  function showSidebarTooltip(sidebar, item) {
    if (!isSidebarCollapsed(sidebar) || isDisabled(item) || !item.getAttribute('data-tooltip')) return;
    hideSidebarTooltip(sidebar);
    var tip = sidebar._dbSidebarTooltip;
    if (!tip) {
      tip = document.createElement('span');
      tip.id = uid();
      tip.className = 'db-sidebar__tooltip';
      tip.setAttribute('role', 'tooltip');
      tip.setAttribute('popover', 'manual');
      sidebar.appendChild(tip);
      sidebar._dbSidebarTooltip = tip;
    }
    tip.textContent = item.getAttribute('data-tooltip');
    tip._dbTrigger = item;
    var descriptions = (item.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    descriptions.push(tip.id);
    item.setAttribute('aria-describedby', descriptions.join(' '));
    tip.style.visibility = 'hidden';
    if (typeof tip.showPopover === 'function') tip.showPopover();
    else tip.hidden = false;
    var anchor = item.getBoundingClientRect();
    var rect = tip.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(sidebar.getBoundingClientRect().right + 8, document.documentElement.clientWidth - rect.width - 8)) + 'px';
    tip.style.top = Math.max(8, Math.min(anchor.top + (anchor.height - rect.height) / 2, window.innerHeight - rect.height - 8)) + 'px';
    tip.style.visibility = '';
  }

  function syncSidebar(sidebar) {
    if (!sidebar.id) sidebar.id = uid();
    nativeElements(sidebar, '.db-sidebar__toggle').forEach(function(btn) {
      if (btn.closest('.db-sidebar') !== sidebar) return;
      btn.setAttribute('aria-controls', sidebar.id);
      btn.setAttribute('aria-expanded', String(!isSidebarCollapsed(sidebar)));
    });
    hideSidebarTooltip(sidebar);
  }

  function initSidebarToggle(root) {
    if (!_sidebarMedia) {
      _sidebarMedia = window.matchMedia('(max-width: 640px)');
      _sidebarMedia.addEventListener('change', function() { nativeElements(document, '.db-sidebar').forEach(syncSidebar); });
      window.addEventListener('resize', function() { nativeElements(document, '.db-sidebar').forEach(hideSidebarTooltip); });
    }
    nativeElements(root, '.db-sidebar').forEach(function(sidebar) {
      syncSidebar(sidebar);
      nativeElements(sidebar, '.db-sidebar__toggle').forEach(function(btn) {
        if (btn.closest('.db-sidebar') !== sidebar) return;
        if (btn._dbSidebar) return;
        btn._dbSidebar = true;
        btn.addEventListener('click', function() { toggleSidebar(sidebar); });
      });
      nativeElements(sidebar, '.db-sidebar__item[data-tooltip]').forEach(function(item) {
        if (item.closest('.db-sidebar') !== sidebar) return;
        if (item._dbSidebarTooltip) return;
        item._dbSidebarTooltip = true;
        item.addEventListener('mouseenter', function() { showSidebarTooltip(sidebar, item); });
        item.addEventListener('mouseleave', function() { if (document.activeElement !== item) hideSidebarTooltip(sidebar); });
        item.addEventListener('focus', function() { showSidebarTooltip(sidebar, item); });
        item.addEventListener('blur', function() { hideSidebarTooltip(sidebar); });
        item.addEventListener('keydown', function(e) {
          var tip = sidebar._dbSidebarTooltip;
          if (e.key === 'Escape' && tip && tip._dbTrigger === item) {
            e.preventDefault(); e.stopPropagation(); hideSidebarTooltip(sidebar);
          }
        });
      });
      if (!sidebar._dbSidebarScroll) {
        sidebar._dbSidebarScroll = true;
        sidebar.addEventListener('scroll', function() { hideSidebarTooltip(sidebar); });
      }
    });
  }

  function toggleSidebar(el) {
    if (typeof el === 'string') el = nativeElement(document, el);
    if (el) {
      var collapsed = isSidebarCollapsed(el);
      el.classList.toggle('db-sidebar--collapsed', !collapsed);
      el.classList.toggle('db-sidebar--expanded', collapsed);
      syncSidebar(el);
    }
  }

  /* ----------------------------------------------------------
     Chip Close
     ---------------------------------------------------------- */
  function initChipClose(root) {
    nativeElements(root, '.db-chip__close').forEach(function(btn) {
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
    nativeElements(root, '.db-navbar__toggle').forEach(function(btn) {
      if (btn._dbNavbar) return;
      btn._dbNavbar = true;
      var navbar = btn.closest('.db-navbar');
      if (navbar) btn.setAttribute('aria-expanded', String(navbar.classList.contains('db-navbar--open')));
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var navbar = btn.closest('.db-navbar');
        if (navbar) toggleNavbar(navbar);
      });
    });
    // Close on outside click
    if (!document._dbNavbarOutside) {
      document._dbNavbarOutside = true;
      document.addEventListener('click', function(e) {
        if (!e.target.closest('.db-navbar')) {
          nativeElements(document, '.db-navbar--open').forEach(function(n) {
            toggleNavbar(n, false);
          });
        }
      });
      // Escape closes an open menu; focus inside it goes back to the toggle
      document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape' || e.defaultPrevented || isReactOwned(e.target)) return;
        nativeElements(document, '.db-navbar--open').forEach(function(n) {
          var t = nativeElement(n, '.db-navbar__toggle');
          var inside = n.contains(document.activeElement);
          toggleNavbar(n, false);
          if (t && inside) t.focus();
        });
      });
    }
  }

  function toggleNavbar(el, open) {
    if (typeof el === 'string') el = nativeElement(document, el);
    if (!el || isReactOwned(el)) return;
    if (typeof open !== 'boolean') open = !el.classList.contains('db-navbar--open');
    if (open) el.classList.add('db-navbar--open');
    else el.classList.remove('db-navbar--open');
    nativeElements(el, '.db-navbar__toggle').forEach(function(btn) { btn.setAttribute('aria-expanded', String(open)); });
  }

  /* ----------------------------------------------------------
     Chip Toggle
     ---------------------------------------------------------- */
  function initChipToggle(root) {
    nativeElements(root, '[data-db-chip-toggle]').forEach(function(container) {
      if (container._dbChipToggle) return;
      container._dbChipToggle = true;
      nativeElements(container, '.db-chip').forEach(function(chip) {
        if (!chip.hasAttribute('role')) chip.setAttribute('role', 'button');
        if (!chip.hasAttribute('tabindex')) chip.setAttribute('tabindex', '0');
        chip.setAttribute('aria-pressed', String(chip.classList.contains('db-chip--active')));
      });
      container.addEventListener('keydown', function(e) {
        if (e.target.matches('.db-chip') && !e.target.matches('button') && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault(); e.target.click();
        }
      });
      container.addEventListener('click', function(e) {
        var chip = e.target.closest('.db-chip');
        if (!chip || isReactOwned(chip) || e.target.closest('.db-chip__close')) return;
        var mode = container.getAttribute('data-db-chip-mode');
        var willBeActive = !chip.classList.contains('db-chip--active');
        var evt = new CustomEvent('db:chip:change', {
          bubbles: true,
          cancelable: true,
          detail: {
            chip: chip,
            value: chip.textContent.trim(),
            active: willBeActive
          }
        });
        if (!chip.dispatchEvent(evt)) return;
        if (mode === 'single') {
          nativeElements(container, '.db-chip--active').forEach(function(c) {
            if (c !== chip) { c.classList.remove('db-chip--active'); c.setAttribute('aria-pressed', 'false'); }
          });
        }
        chip.classList.toggle('db-chip--active');
        chip.setAttribute('aria-pressed', String(willBeActive));
      });
    });
  }

  /* ----------------------------------------------------------
     Message Scroller
     ---------------------------------------------------------- */
  var _messageScrollers = new Map();
  var _messageScrollerCleanup = null;

  function watchMessageScrollerCleanup() {
    if (_messageScrollerCleanup || typeof MutationObserver === 'undefined') return;
    _messageScrollerCleanup = new MutationObserver(function() {
      _messageScrollers.forEach(function(instance, root) {
        if (!root.isConnected || isReactOwned(root)) instance.destroy();
      });
    });
    _messageScrollerCleanup.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-db-react'] });
  }

  function createMessageScroller(root, options) {
    if (!root || root.nodeType !== 1 || !root.matches('.db-message-scroller') || !root.isConnected || isReactOwned(root)) return null;
    if (_messageScrollers.has(root)) return _messageScrollers.get(root);
    function owns(el) { return el.closest('.db-message-scroller') === root && !isReactOwned(el); }
    function part(selector) { return nativeElements(root, selector).filter(owns)[0]; }
    var viewport = part('.db-message-scroller__viewport');
    var content = part('.db-message-scroller__content');
    if (!viewport || !content || !viewport.contains(content)) return null;
    options = options || {};
    var autoScroll = options.autoScroll === undefined ? root.getAttribute('data-db-auto-scroll') !== 'false' : !!options.autoScroll;
    var initialPosition = options.scrollPosition || root.getAttribute('data-db-scroll-position') || 'end';
    if (['start', 'end', 'last-anchor'].indexOf(initialPosition) === -1) initialPosition = 'end';
    var peek = Number(options.scrollPeek === undefined ? (root.getAttribute('data-db-scroll-peek') || 0) : options.scrollPeek);
    if (!Number.isFinite(peek)) peek = 0;
    peek = Math.max(0, peek);
    var threshold = 8;
    var destroyed = false, initialized = false, frame = 0;
    var following = null, liveAnchor = null, extraPadding = 0;
    var rows = [], observedRows = new Set(), snapshot = null, lastTop = viewport.scrollTop;
    var lastState = '', scrollTarget = null, pointer = null, touchY = null;
    var savedAttributes = [], listeners = [];
    var paddingValue = content.style.getPropertyValue('padding-bottom');
    var paddingPriority = content.style.getPropertyPriority('padding-bottom');
    var basePadding = parseFloat(getComputedStyle(content).paddingBottom) || 0;
    var overflowAnchor = viewport.style.getPropertyValue('overflow-anchor');
    var overflowAnchorPriority = viewport.style.getPropertyPriority('overflow-anchor');
    viewport.style.setProperty('overflow-anchor', 'none');

    function attribute(el, name, value) {
      var saved = savedAttributes.find(function(entry) { return entry.el === el && entry.name === name; });
      if (!saved) {
        saved = { el: el, name: name, original: el.getAttribute(name), value: null };
        savedAttributes.push(saved);
      }
      saved.value = value;
      if (value === null) { if (el.hasAttribute(name)) el.removeAttribute(name); }
      else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
    }
    function defaultAttribute(el, name, value) {
      if (!el.hasAttribute(name)) attribute(el, name, value);
    }
    defaultAttribute(viewport, 'tabindex', '0');
    defaultAttribute(viewport, 'role', 'region');
    if (!viewport.hasAttribute('aria-labelledby')) defaultAttribute(viewport, 'aria-label', 'Messages');
    defaultAttribute(content, 'role', 'log');
    defaultAttribute(content, 'aria-relevant', 'additions');

    function queryRows() { return Array.from(content.querySelectorAll('[data-db-message-id]')).filter(owns); }
    function readRows() {
      rows = queryRows();
      if (resizeObserver) {
        observedRows.forEach(function(row) {
          if (rows.indexOf(row) === -1) { resizeObserver.unobserve(row); observedRows.delete(row); }
        });
        rows.forEach(function(row) { if (!observedRows.has(row)) { resizeObserver.observe(row); observedRows.add(row); } });
      }
    }
    function origin() { return viewport.getBoundingClientRect().top + viewport.clientTop; }
    function rowTop(row) { return row.getBoundingClientRect().top - origin() + viewport.scrollTop; }
    function anchor(row) { return row.hasAttribute('data-db-scroll-anchor') && row.getAttribute('data-db-scroll-anchor') !== 'false'; }
    function maxTop() { return Math.max(0, viewport.scrollHeight - viewport.clientHeight); }
    function collectState(items) {
      var top = origin(), bottom = top + viewport.clientHeight, current = null, visible = [];
      (items || rows).forEach(function(row) {
        var rect = row.getBoundingClientRect();
        if (!row.getClientRects().length || rect.height <= 0) return;
        var id = row.getAttribute('data-db-message-id');
        if (rect.bottom > top && rect.top < bottom) visible.push(id);
        if (anchor(row) && rect.top <= top + peek + threshold) current = id;
      });
      return { atStart: viewport.scrollTop <= threshold, atEnd: maxTop() - viewport.scrollTop <= threshold, currentAnchorId: current, visibleMessageIds: visible };
    }
    function remember() {
      var top = origin();
      var first = rows.find(function(row) {
        var rect = row.getBoundingClientRect();
        return row.getClientRects().length && rect.height > 0 && rect.bottom > top && rect.top < top + viewport.clientHeight;
      });
      snapshot = first ? { id: first.getAttribute('data-db-message-id'), offset: first.getBoundingClientRect().top - top, scrollTop: viewport.scrollTop } : null;
      lastTop = viewport.scrollTop;
    }
    function publish() {
      var state = collectState();
      var scrollable = (state.atStart ? '' : 'start') + (!state.atStart && !state.atEnd ? ' ' : '') + (state.atEnd ? '' : 'end');
      [root, viewport].forEach(function(el) { attribute(el, 'data-scrollable', scrollable || null); });
      nativeElements(root, '[data-db-scroll-to], .db-message-scroller__button').filter(owns).forEach(function(button) {
        var direction = button.getAttribute('data-db-scroll-to') === 'start' ? 'start' : 'end';
        if (button.tagName === 'BUTTON') defaultAttribute(button, 'type', 'button');
        if (!button.hasAttribute('aria-labelledby')) defaultAttribute(button, 'aria-label', direction === 'start' ? 'Scroll to first message' : 'Scroll to latest message');
        if (!button.matches('button, a[href], input')) {
          defaultAttribute(button, 'role', 'button');
          defaultAttribute(button, 'tabindex', '0');
        }
        attribute(button, 'data-active', String(direction === 'start' ? !state.atStart : !state.atEnd));
      });
      var key = JSON.stringify(state);
      if (key !== lastState) {
        lastState = key;
        root.dispatchEvent(new CustomEvent('db:message-scroll', { bubbles: true, detail: state }));
      }
    }
    function padding(value) {
      value = Math.max(0, Math.ceil(value));
      if (value === extraPadding) return;
      extraPadding = value;
      if (value) content.style.setProperty('padding-bottom', (basePadding + value) + 'px', paddingPriority);
      else if (paddingValue) content.style.setProperty('padding-bottom', paddingValue, paddingPriority);
      else content.style.removeProperty('padding-bottom');
    }
    function motion(behavior) {
      return behavior === 'smooth' && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'smooth' : 'instant';
    }
    function move(top, behavior) {
      var target = Math.max(0, Math.min(maxTop(), top));
      var mode = motion(behavior);
      scrollTarget = mode === 'smooth' && Math.abs(target - viewport.scrollTop) > 1 ? target : null;
      viewport.scrollTo({ top: target, behavior: mode });
      lastTop = viewport.scrollTop;
    }
    function release() {
      if (scrollTarget !== null) viewport.scrollTo({ top: viewport.scrollTop, behavior: 'instant' });
      scrollTarget = null;
      following = null;
      remember();
    }
    function update() {
      frame = 0;
      if (destroyed) return;
      if (!root.isConnected || isReactOwned(root) || !owns(viewport) || !owns(content) || !viewport.contains(content)) { destroy(); return; }
      var previousRows = rows;
      readRows();
      if (!viewport.clientHeight) { publish(); return; }
      if (!rows.length) attribute(viewport, 'data-pending-scroll', null);
      var previousIds = new Set(previousRows.map(function(row) { return row.getAttribute('data-db-message-id'); }));
      var previousLast = previousRows.length ? previousRows[previousRows.length - 1].getAttribute('data-db-message-id') : null;
      var previousLastIndex = rows.findIndex(function(row) { return row.getAttribute('data-db-message-id') === previousLast; });
      var newAnchor = null;
      rows.forEach(function(row, index) {
        if (anchor(row) && !previousIds.has(row.getAttribute('data-db-message-id')) && index > previousLastIndex) newAnchor = row;
      });
      if (!initialized && rows.length) {
        initialized = true;
        if (initialPosition === 'last-anchor') liveAnchor = rows.filter(anchor).pop() || null;
        following = initialPosition === 'start' ? null : (liveAnchor ? 'anchor' : 'end');
        if (initialPosition === 'start') move(0);
        attribute(viewport, 'data-pending-scroll', null);
      } else if (autoScroll && following && newAnchor) {
        liveAnchor = newAnchor;
        following = 'anchor';
      }
      if (liveAnchor && (rows.indexOf(liveAnchor) === -1 || !anchor(liveAnchor))) {
        var anchorId = liveAnchor.getAttribute('data-db-message-id');
        liveAnchor = rows.find(function(row) { return row.getAttribute('data-db-message-id') === anchorId && anchor(row); }) || null;
        if (!liveAnchor) { padding(0); if (following) following = 'end'; }
      }
      if (liveAnchor) {
        var target = Math.max(0, rowTop(liveAnchor) - Math.min(peek, viewport.clientHeight));
        var tail = Array.from(content.children).filter(function(el) { return el.getClientRects().length; }).pop();
        var contentStyle = getComputedStyle(content);
        // Ignore spare min-height space when calculating room for a short turn.
        var naturalBottom = tail ? tail.getBoundingClientRect().bottom - origin() + viewport.scrollTop + (parseFloat(getComputedStyle(tail).marginBottom) || 0) + basePadding + (parseFloat(contentStyle.borderBottomWidth) || 0) : 0;
        var naturalEnd = naturalBottom - viewport.clientHeight;
        padding(target - naturalEnd);
        if (following === 'anchor') move(Math.max(target, naturalEnd));
      } else if (following === 'end') move(maxTop());
      if (!following && snapshot && scrollTarget === null) {
        var stable = rows.find(function(row) { return row.getAttribute('data-db-message-id') === snapshot.id; });
        if (stable) {
          // Account for a scroll event that has not arrived before this layout change.
          var offset = snapshot.offset - (viewport.scrollTop - snapshot.scrollTop);
          var preservedTop = rowTop(stable) - offset;
          if (Math.abs(preservedTop - viewport.scrollTop) > 0.5) move(preservedTop);
        }
      }
      if (!autoScroll) following = null;
      remember();
      publish();
    }
    function schedule() { if (!destroyed && !frame) frame = requestAnimationFrame(update); }
    function listen(el, type, handler, opts) { el.addEventListener(type, handler, opts); listeners.push(function() { el.removeEventListener(type, handler, opts); }); }
    function usable() { return !destroyed && root.isConnected && root.contains(viewport) && viewport.contains(content) && owns(viewport) && owns(content); }
    function scrollToEnd(opts) {
      if (!usable()) return false;
      initialized = true;
      liveAnchor = null;
      padding(0);
      following = autoScroll ? 'end' : null;
      move(maxTop(), opts && opts.behavior);
      readRows(); remember(); publish();
      return true;
    }
    function scrollToStart(opts) {
      if (!usable()) return false;
      initialized = true;
      release(); liveAnchor = null; padding(0);
      move(0, opts && opts.behavior);
      readRows(); remember(); publish();
      return true;
    }
    function scrollToMessage(id, opts) {
      if (!usable()) return false;
      readRows();
      var row = rows.find(function(el) { return el.getAttribute('data-db-message-id') === id; });
      if (!row) return false;
      opts = opts || {};
      initialized = true;
      release(); liveAnchor = null; padding(0);
      var top = rowTop(row), height = row.getBoundingClientRect().height;
      var block = opts.block || 'start', target = top;
      if (block === 'center') target -= (viewport.clientHeight - height) / 2;
      else if (block === 'end') target -= viewport.clientHeight - height;
      else if (block === 'nearest') {
        var end = top + height;
        if (top >= viewport.scrollTop && end <= viewport.scrollTop + viewport.clientHeight) target = viewport.scrollTop;
        else if (top < viewport.scrollTop && end > viewport.scrollTop + viewport.clientHeight) target = viewport.scrollTop;
        else if ((top < viewport.scrollTop && height > viewport.clientHeight) || (end > viewport.scrollTop + viewport.clientHeight && height <= viewport.clientHeight)) target = end - viewport.clientHeight;
      }
      move(target, opts.behavior);
      remember(); publish();
      return true;
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (scrollTarget !== null) viewport.scrollTo({ top: viewport.scrollTop, behavior: 'instant' });
      scrollTarget = null;
      if (frame) cancelAnimationFrame(frame);
      if (mutationObserver) mutationObserver.disconnect();
      if (resizeObserver) resizeObserver.disconnect();
      listeners.forEach(function(remove) { remove(); });
      padding(0);
      if (overflowAnchor) viewport.style.setProperty('overflow-anchor', overflowAnchor, overflowAnchorPriority);
      else viewport.style.removeProperty('overflow-anchor');
      savedAttributes.forEach(function(saved) {
        if (saved.el.getAttribute(saved.name) !== saved.value) return;
        if (saved.original === null) saved.el.removeAttribute(saved.name);
        else saved.el.setAttribute(saved.name, saved.original);
      });
      rows = []; observedRows.clear(); snapshot = null;
      _messageScrollers.delete(root);
      if (!_messageScrollers.size && _messageScrollerCleanup) { _messageScrollerCleanup.disconnect(); _messageScrollerCleanup = null; }
    }

    var resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    var mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(function() { if (!usable()) destroy(); else schedule(); });
    var handle = { scrollToEnd: scrollToEnd, scrollToStart: scrollToStart, scrollToMessage: scrollToMessage, getState: function() { return collectState(destroyed ? [] : queryRows()); }, destroy: destroy };
    _messageScrollers.set(root, handle);
    watchMessageScrollerCleanup();
    listen(viewport, 'scroll', function() {
      var top = viewport.scrollTop;
      var commanded = scrollTarget !== null;
      if (scrollTarget !== null && Math.abs(top - scrollTarget) <= 1) scrollTarget = null;
      else if (scrollTarget === null && top < lastTop - 1) following = null;
      if (!commanded && autoScroll && !following && top > lastTop && maxTop() - top <= threshold) {
        liveAnchor = null; padding(0); following = 'end'; move(maxTop());
      }
      remember(); publish();
    }, { passive: true });
    listen(viewport, 'wheel', function(e) { if (owns(e.target) && e.deltaY < 0) release(); }, { passive: true });
    listen(viewport, 'touchstart', function(e) { if (owns(e.target) && e.touches.length === 1) touchY = e.touches[0].clientY; }, { passive: true });
    listen(viewport, 'touchmove', function(e) {
      if (!owns(e.target) || touchY === null || e.touches.length !== 1) return;
      if (e.touches[0].clientY > touchY) release();
      touchY = e.touches[0].clientY;
    }, { passive: true });
    listen(viewport, 'touchend', function() { touchY = null; }, { passive: true });
    listen(viewport, 'touchcancel', function() { touchY = null; }, { passive: true });
    listen(viewport, 'pointerdown', function(e) {
      if (!owns(e.target)) return;
      pointer = { id: e.pointerId, y: e.clientY, type: e.pointerType };
      if (e.target === viewport && e.pointerType === 'mouse') release();
    }, { passive: true });
    listen(viewport, 'pointermove', function(e) {
      if (!pointer || e.pointerId !== pointer.id || !owns(e.target)) return;
      if (pointer.type !== 'mouse' && e.clientY > pointer.y) release();
      pointer.y = e.clientY;
    }, { passive: true });
    listen(root, 'pointerup', function() { pointer = null; }, { passive: true });
    listen(root, 'pointercancel', function() { pointer = null; }, { passive: true });
    listen(viewport, 'keydown', function(e) {
      if (!owns(e.target) || e.defaultPrevented || e.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      if (e.target.closest('button, a[href], [role="button"]')) return;
      if (e.key === 'End') { e.preventDefault(); scrollToEnd(); }
      else if (e.key === 'Home') { e.preventDefault(); scrollToStart(); }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) release();
    });
    function control(e) {
      var button = e.target.closest('[data-db-scroll-to], .db-message-scroller__button');
      if (!button || !owns(button) || e.defaultPrevented || isDisabled(button)) return;
      if (e.type === 'keydown' && (button.matches('button, a[href], input') || (e.key !== 'Enter' && e.key !== ' '))) return;
      e.preventDefault();
      var opts = { behavior: 'smooth' };
      if (button.getAttribute('data-db-scroll-to') === 'start') scrollToStart(opts);
      else scrollToEnd(opts);
    }
    listen(root, 'click', control);
    listen(root, 'keydown', control);
    listen(content, 'load', schedule, true);
    listen(content, 'error', schedule, true);
    listen(window, 'resize', schedule);
    if (initialPosition !== 'start') attribute(viewport, 'data-pending-scroll', '');
    if (mutationObserver) mutationObserver.observe(root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['data-db-message-id', 'data-db-scroll-anchor', 'class', 'style', 'hidden', 'data-db-react'] });
    if (resizeObserver) { resizeObserver.observe(viewport); resizeObserver.observe(content); }
    update();
    return handle;
  }

  function initMessageScrollers(root) {
    _messageScrollers.forEach(function(instance, el) { if (!el.isConnected || isReactOwned(el)) instance.destroy(); });
    if (root.nodeType === 1 && root.matches('.db-message-scroller')) createMessageScroller(root);
    nativeElements(root, '.db-message-scroller').forEach(function(el) { createMessageScroller(el); });
  }

  /* ----------------------------------------------------------
     Chat Composer
     ---------------------------------------------------------- */
  var _chatComposers = new Map();
  var _chatComposerCleanup = null;

  function watchChatComposerCleanup() {
    if (_chatComposerCleanup || typeof MutationObserver === 'undefined') return;
    _chatComposerCleanup = new MutationObserver(function() {
      _chatComposers.forEach(function(instance, root) {
        if (!root.isConnected || isReactOwned(root) !== instance.reactOwned) instance.handle.destroy();
      });
    });
    _chatComposerCleanup.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-db-react'] });
  }

  function createChatComposer(root, options) {
    if (!root || root.nodeType !== 1 || !root.matches('.db-chat-composer') || !root.isConnected) return null;
    if (_chatComposers.has(root)) return _chatComposers.get(root).handle;
    var reactOwned = isReactOwned(root);
    var declared = {};
    try { declared = JSON.parse(root.getAttribute('data-db-chat-options') || '{}') || {}; } catch (e) {}
    options = Object.assign({}, declared, options || {});
    if (!root.childElementCount) {
      root.innerHTML = '<div class="db-chat-composer__queue" role="list" aria-label="Queued messages" hidden></div>' +
        '<div class="db-chat-composer__panel"><div class="db-chat-composer__dropzone" hidden>Drop files</div>' +
        '<div class="db-chat-composer__attachments" aria-label="Attachments" hidden></div>' +
        '<textarea class="db-chat-composer__input" aria-label="Message" rows="2" placeholder="Message"></textarea>' +
        '<div class="db-chat-composer__dictation-bar" role="status" hidden><span class="db-chat-composer__dictation-state"></span>' +
        '<button type="button" class="db-chat-composer__dictation-stop" aria-label="Stop dictation" title="Stop dictation"><i data-lucide="square" aria-hidden="true"></i></button>' +
        '<button type="button" class="db-chat-composer__dictation-cancel" aria-label="Cancel dictation" title="Cancel dictation"><i data-lucide="x" aria-hidden="true"></i></button></div>' +
        '<div class="db-chat-composer__toolbar">' +
        '<div class="db-dropdown"><button type="button" class="db-dropdown__trigger db-chat-composer__add" aria-label="Add" title="Add"><i data-lucide="plus" aria-hidden="true"></i></button>' +
        '<div class="db-dropdown__menu db-chat-composer__add-menu" hidden></div></div>' +
        '<select class="db-chat-composer__model" aria-label="Model" name="model"></select>' +
        '<select class="db-chat-composer__effort" aria-label="Effort" name="effort"></select>' +
        '<select class="db-chat-composer__approval" aria-label="Approval" name="approval"><option value="ask">Ask for approval</option><option value="auto">Auto-approve safe actions</option></select>' +
        '<select class="db-chat-composer__mode" aria-label="Mode" name="mode"><option value="chat">Chat</option><option value="plan">Plan</option></select>' +
        '<input class="db-chat-composer__goal" aria-label="Goal" name="goal" placeholder="Goal" type="text">' +
        '<span class="db-chat-composer__status" role="status" aria-live="polite">Ready</span>' +
        '<button type="button" class="db-chat-composer__dictation" aria-label="Start dictation" title="Start dictation"><i data-lucide="mic" aria-hidden="true"></i></button>' +
        '<button type="button" class="db-chat-composer__stop" aria-label="Stop response" title="Stop response" hidden><i data-lucide="square" aria-hidden="true"></i></button>' +
        '<button type="submit" class="db-chat-composer__send" aria-label="Send message" title="Send message"><i data-lucide="arrow-up" aria-hidden="true"></i></button>' +
        '</div><input class="db-chat-composer__file-input" type="file" multiple aria-label="Attach files" hidden>' +
        '<input class="db-chat-composer__folder-input" type="file" multiple aria-label="Choose folder" hidden></div>';
    }
    function owns(el) {
      return el && el.closest('.db-chat-composer') === root && (reactOwned || !isReactOwned(el));
    }
    function part(name) {
      return Array.from(root.querySelectorAll('.db-chat-composer__' + name)).filter(owns)[0];
    }
    var input = part('input'), panel = part('panel'), queueEl = part('queue'), attachments = part('attachments');
    var modelEl = part('model'), effortEl = part('effort'), approvalEl = part('approval'), modeEl = part('mode'), goalEl = part('goal');
    var sendEl = part('send'), stopEl = part('stop'), statusEl = part('status'), addEl = part('add'), addMenu = part('add-menu');
    var fileInput = part('file-input'), folderInput = part('folder-input'), dictationEl = part('dictation'), dictationBar = part('dictation-bar');
    if (!input || !panel || !queueEl || !attachments || !sendEl) return null;
    if (options.placeholder !== undefined) input.placeholder = String(options.placeholder);
    var defaults = [
      { id: 'demo-review', label: 'Review assistant (demo)' },
      { id: 'demo-brief', label: 'Concise assistant (demo)' },
      { id: 'demo-code', label: 'Code reviewer (demo)' }
    ];
    function normalizeModels(value) {
      var result = (Array.isArray(value) ? value : defaults).filter(function(m) {
        return m && typeof m.id === 'string' && m.id && typeof m.label === 'string';
      }).map(function(m) { return { id: m.id, label: m.label, efforts: Array.isArray(m.efforts) ? m.efforts.filter(function(v) { return typeof v === 'string' && v; }) : [] }; });
      return result.length ? result : defaults;
    }
    function normalizeActions(value) {
      return (Array.isArray(value) ? value : []).filter(function(action) {
        return action && typeof action.id === 'string' && typeof action.label === 'string';
      }).map(function(action) { return Object.assign({}, action); });
    }
    var models = normalizeModels(options.models);
    var capabilities = options.capabilities || {};
    var allowQueue = capabilities.queue !== false, allowSteer = capabilities.steer !== false;
    var allowAttachments = capabilities.attachments !== false, allowApproval = capabilities.approval !== false;
    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    function microphoneBlocked() {
      var policy = document.permissionsPolicy || document.featurePolicy;
      if (!policy || typeof policy.allowsFeature !== 'function') return false;
      try { return policy.allowsFeature('microphone') === false; } catch (e) { return false; }
    }
    var dictationBlocked = microphoneBlocked();
    var allowDictation = capabilities.dictation !== false && typeof Recognition === 'function' && !dictationBlocked;
    var allowFolders = allowAttachments && capabilities.folders !== false && folderInput && 'webkitdirectory' in folderInput;
    var actions = normalizeActions(options.actions);
    var model = models.some(function(m) { return m.id === options.model; }) ? options.model : models[0].id;
    function efforts() {
      var selected = models.filter(function(m) { return m.id === model; })[0];
      return selected.efforts && selected.efforts.length ? selected.efforts : ['low', 'medium', 'high'];
    }
    function defaultEffort() { var values = efforts(); return values.indexOf('high') !== -1 ? 'high' : values[values.length - 1]; }
    var effort = efforts().indexOf(options.effort) !== -1 ? options.effort : defaultEffort();
    var approval = allowApproval && options.approval === 'auto' ? 'auto' : 'ask';
    var mode = options.mode === 'plan' ? 'plan' : 'chat', goal = options.goal == null ? null : String(options.goal);
    var files = [], queue = [], busy = !!options.busy, destroyed = false, draftRequest = null;
    var previews = new Map(), listeners = [], menus = [], choices = [], recognition = null, clickGesture = false, gestureTimer = 0;
    var dictation = allowDictation ? 'stopped' : 'unsupported', dictationError = null, dictationSession = null;
    var submitting = false, steering = new Set(), pendingOptions = null;

    function usable() {
      if (destroyed) return false;
      if (!root.isConnected || isReactOwned(root) !== reactOwned) { destroy(); return false; }
      return true;
    }
    function listen(el, name, handler, opts) {
      if (!el) return;
      el.addEventListener(name, handler, opts);
      listeners.push(function() { el.removeEventListener(name, handler, opts); });
    }
    function element(tag, className, text) {
      var el = document.createElement(tag);
      el.className = className;
      if (text !== undefined) el.textContent = text;
      return el;
    }
    function button(className, label, icon, command) {
      var el = element('button', className);
      el.type = 'button'; el.setAttribute('aria-label', label); el.title = label;
      if (icon) {
        var glyph = document.createElement('i');
        glyph.setAttribute('data-lucide', icon); glyph.setAttribute('aria-hidden', 'true'); el.appendChild(glyph);
      } else el.textContent = label;
      if (command) el.setAttribute('data-db-composer-command', command);
      return el;
    }
    function copyRequest(request) { return Object.assign({}, request, { files: request.files.slice() }); }
    function getQueue() { return queue.map(copyRequest); }
    function config() { return { model: model, effort: effort, approval: approval, mode: mode, goal: goal }; }
    function getState() {
      return Object.assign(config(), { text: input.value, files: files.slice(), queue: getQueue(), busy: busy, dictation: dictation });
    }
    function emit(name, detail, cancelable) {
      return root.dispatchEvent(new CustomEvent('db:chat-' + name, { bubbles: true, cancelable: !!cancelable, detail: detail }));
    }
    function changed() { if (!destroyed) emit('change', { state: getState() }); }
    function selectOptions(el, entries, value) {
      if (!el) return;
      el.replaceChildren();
      entries.forEach(function(entry) {
        var option = document.createElement('option'); option.value = entry.id; option.textContent = entry.label; el.appendChild(option);
      });
      el.value = value;
    }
    function createChoice(field, el, setter) {
      if (!el) return;
      var wrap = el.closest('.db-chat-composer__choice');
      if (!wrap || !owns(wrap)) {
        wrap = element('div', 'db-chat-composer__choice'); wrap.setAttribute('data-field', field);
        el.before(wrap); wrap.appendChild(el);
      }
      var label = wrap.getAttribute('data-db-choice-label') || el.getAttribute('aria-label') || field.charAt(0).toUpperCase() + field.slice(1);
      wrap.setAttribute('data-db-choice-label', label);
      el.hidden = true; el.tabIndex = -1; el.setAttribute('aria-label', label + ' value');
      var trigger = wrap.querySelector('.db-chat-composer__choice-trigger');
      if (!trigger) {
        trigger = button('db-chat-composer__choice-trigger', label);
        trigger.textContent = '';
        trigger.appendChild(element('span', 'db-chat-composer__choice-label'));
        var chevron = element('i', ''); chevron.setAttribute('data-lucide', 'chevron-down'); chevron.setAttribute('aria-hidden', 'true');
        trigger.appendChild(chevron); wrap.appendChild(trigger);
      }
      trigger.setAttribute('role', 'combobox');
      trigger.tabIndex = 0;
      var menu = wrap.querySelector('.db-chat-composer__choice-menu');
      if (!menu) { menu = element('div', 'db-chat-composer__choice-menu'); wrap.appendChild(menu); }
      var entry = registerMenu(trigger, menu, 'option');
      entry.field = field; entry.select = el; entry.setter = setter; entry.label = trigger.querySelector('.db-chat-composer__choice-label');
      menu.setAttribute('aria-label', label); choices.push(entry);
    }
    function syncChoices() {
      var rebuilt = false;
      choices.forEach(function(entry) {
        var options = Array.from(entry.select.options);
        var items = Array.from(entry.menu.children);
        var rebuild = items.length !== options.length || options.some(function(option, index) {
          var item = items[index];
          return !item || item.getAttribute('data-value') !== option.value || item.textContent !== option.textContent || item.disabled !== option.disabled || item.hidden !== option.hidden;
        });
        if (rebuild) {
          rebuilt = true;
          menuState(entry, false, entry.menu.contains(document.activeElement));
          entry.menu.replaceChildren();
          options.forEach(function(option) {
            var item = element('button', 'db-chat-composer__choice-option db-dropdown__item');
            item.appendChild(element('span', '', option.textContent));
            var check = element('i', ''); check.setAttribute('data-lucide', 'check'); check.setAttribute('aria-hidden', 'true'); item.appendChild(check);
            item.type = 'button'; item.tabIndex = -1; item.disabled = option.disabled; item.hidden = option.hidden;
            item.setAttribute('role', 'option'); item.setAttribute('data-value', option.value); entry.menu.appendChild(item);
          });
        }
        var selected = entry.select.options[entry.select.selectedIndex];
        entry.label.textContent = selected ? selected.textContent : '';
        if (entry.field === 'model' && part('effort-summary')) part('effort-summary').textContent = effort.charAt(0).toUpperCase() + effort.slice(1);
        entry.trigger.disabled = entry.select.disabled;
        entry.wrap.hidden = entry.field === 'approval' && !allowApproval;
        entry.select.hidden = true;
        Array.from(entry.menu.children).forEach(function(item, index) { item.setAttribute('aria-selected', String(index === entry.select.selectedIndex)); });
        if (entry.trigger.disabled || entry.wrap.hidden) {
          var focused = entry.wrap.contains(document.activeElement);
          menuState(entry, false);
          if (focused) input.focus();
        }
      });
      if (rebuilt) refreshIcons();
    }
    function sync() {
      if (modelEl) { modelEl.value = model; modelEl.disabled = busy; }
      if (effortEl) { effortEl.value = effort; effortEl.disabled = busy; }
      if (approvalEl) { approvalEl.value = approval; approvalEl.hidden = !allowApproval; }
      if (modeEl) modeEl.value = mode;
      syncChoices();
      if (goalEl) goalEl.value = goal || '';
      sendEl.disabled = (!input.value.trim() && !files.length) || (busy && !allowQueue) || !!recognition;
      sendEl.setAttribute('aria-label', busy && allowQueue ? 'Queue message' : 'Send message');
      sendEl.title = sendEl.getAttribute('aria-label');
      if (stopEl) stopEl.hidden = !busy;
      Array.from(queueEl.querySelectorAll('.db-chat-composer__steer')).forEach(function(el) {
        el.setAttribute('aria-label', busy ? 'Steer queued message' : 'Send queued message now'); el.title = el.getAttribute('aria-label');
      });
      root.setAttribute('data-busy', String(busy));
      root.setAttribute('data-dictation', dictation);
      if (dictationEl) {
        dictationEl.disabled = !allowDictation;
        dictationEl.setAttribute('aria-pressed', String(dictation === 'listening'));
        dictationEl.setAttribute('aria-label', recognition ? 'Stop dictation' : 'Start dictation');
        dictationEl.title = allowDictation ? dictationEl.getAttribute('aria-label') : capabilities.dictation === false ? 'Dictation is not enabled' : dictationBlocked ? 'Microphone access is blocked on this page' : 'Dictation unavailable in this browser';
      }
      if (dictationBar) {
        dictationBar.hidden = dictation !== 'listening' && dictation !== 'error';
        var stateEl = part('dictation-state');
        if (stateEl) stateEl.textContent = dictation === 'error' ? dictationMessage(dictationError) : dictationSession && !dictationSession.started ? 'Starting dictation...' : 'Listening';
        var dictationStop = part('dictation-stop');
        if (dictationStop) dictationStop.hidden = dictation !== 'listening';
      }
    }
    function configChanged() {
      draftRequest = null;
      selectOptions(effortEl, efforts().map(function(v) { return { id: v, label: v.charAt(0).toUpperCase() + v.slice(1) }; }), effort);
      sync(); emit('config', config()); changed();
    }
    function setModel(value) {
      if (!usable() || busy || !models.some(function(m) { return m.id === value; })) return false;
      model = value;
      if (efforts().indexOf(effort) === -1) effort = defaultEffort();
      configChanged(); return true;
    }
    function setEffort(value) {
      if (!usable() || busy || efforts().indexOf(value) === -1) return false;
      effort = value; configChanged(); return true;
    }
    function setMode(value) {
      if (!usable() || ['chat', 'plan'].indexOf(value) === -1) return false;
      mode = value; configChanged(); return true;
    }
    function setApproval(value) {
      if (!usable() || !allowApproval || ['ask', 'auto'].indexOf(value) === -1) return false;
      approval = value; configChanged(); return true;
    }
    function setGoal(value) {
      if (!usable() || (value !== null && typeof value !== 'string')) return false;
      goal = value; configChanged(); return true;
    }
    function releasePreviews() {
      var retained = new Set(files);
      queue.forEach(function(request) { request.files.forEach(function(file) { retained.add(file); }); });
      previews.forEach(function(url, file) {
        if (!retained.has(file)) { URL.revokeObjectURL(url); previews.delete(file); }
      });
    }
    function attachment(file, index, removable) {
      var tile = element('div', 'db-attachment db-chat-composer__attachment');
      if (/^image\//.test(file.type) && typeof URL.createObjectURL === 'function') {
        var url = previews.get(file);
        if (!url) { url = URL.createObjectURL(file); previews.set(file, url); }
        var media = element('div', 'db-attachment__media db-attachment__media--image');
        var image = element('img', 'db-attachment__preview'); image.src = url; image.alt = file.name; media.appendChild(image); tile.appendChild(media);
      }
      var info = element('div', 'db-attachment__content');
      var title = element('span', 'db-attachment__title', file.name); title.title = file.name; info.appendChild(title);
      info.appendChild(element('span', 'db-attachment__description', String(file.size) + ' bytes'));
      tile.appendChild(info);
      if (removable) {
        var remove = button('db-attachment__action', 'Remove ' + file.name, 'x', 'remove-file');
        var controls = element('div', 'db-attachment__actions');
        remove.setAttribute('data-db-file-index', String(index)); controls.appendChild(remove); tile.appendChild(controls);
      }
      return tile;
    }
    function renderFiles() {
      attachments.replaceChildren();
      files.forEach(function(file, index) { attachments.appendChild(attachment(file, index, true)); });
      attachments.hidden = !files.length;
      releasePreviews(); sync(); refreshIcons(); changed();
    }
    function attachFiles(incoming) {
      if (!usable() || !allowAttachments) return false;
      Array.from(incoming || []).forEach(function(file) { if (file instanceof File && files.indexOf(file) === -1) files.push(file); });
      draftRequest = null; renderFiles(); return true;
    }
    function pasteImages(event) {
      if (event.defaultPrevented || !usable() || !allowAttachments || !event.clipboardData) return;
      var clipboard = event.clipboardData, text = clipboard.getData('text/plain');
      var incoming = Array.from(clipboard.files || []).filter(function(file) { return /^image\//.test(file.type); });
      if (!incoming.length) incoming = Array.from(clipboard.items || []).filter(function(item) {
        return item.kind === 'file' && /^image\//.test(item.type);
      }).map(function(item) { return item.getAsFile(); }).filter(Boolean);
      if (!incoming.length) {
        var sources = new Set(), html = clipboard.getData('text/html');
        if (html) {
          var template = document.createElement('template'); template.innerHTML = html;
          template.content.querySelectorAll('img[src]').forEach(function(image) { sources.add(image.getAttribute('src')); });
        }
        sources.add(text.trim());
        sources.forEach(function(source) {
          var match = /^data:image\/(png|jpeg|gif|webp|avif);base64,([a-z0-9+/=\s]+)$/i.exec(source);
          if (!match) return;
          try {
            var decoded = atob(match[2].replace(/\s/g, ''));
            if (!decoded.length) return;
            var bytes = Uint8Array.from(decoded, function(character) { return character.charCodeAt(0); });
            var format = match[1].toLowerCase();
            incoming.push(new File([bytes], 'pasted-image-' + (files.length + incoming.length + 1) + '.' + (format === 'jpeg' ? 'jpg' : format), { type: 'image/' + format }));
            if (source === text.trim()) text = '';
          } catch (error) {}
        });
      }
      if (!incoming.length) return;
      event.preventDefault();
      if (text) {
        input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      attachFiles(incoming);
    }
    function registerMenu(trigger, menu, role) {
      if (!trigger || !menu) return;
      var wrap = trigger.closest('.db-chat-composer__choice') || trigger.closest('.db-dropdown') || trigger.parentElement;
      wrap._dbInit = true;
      if (!menu.id) menu.id = uid();
      var popupRole = role === 'option' ? 'listbox' : role === 'dialog' ? 'dialog' : 'menu';
      trigger.setAttribute('aria-haspopup', popupRole); trigger.setAttribute('aria-controls', menu.id); trigger.setAttribute('aria-expanded', 'false');
      menu.setAttribute('role', popupRole); menu.hidden = true; menu.inert = true; menu.setAttribute('aria-hidden', 'true');
      if (role !== 'dialog') Array.from(menu.querySelectorAll('button')).forEach(function(item) { item.setAttribute('role', role || 'menuitem'); item.tabIndex = -1; });
      var entry = { wrap: wrap, trigger: trigger, menu: menu, role: popupRole, search: '', searchTime: 0 };
      menus.push(entry); return entry;
    }
    function closePanels(except, within) {
      menus.forEach(function(entry) {
        if (entry.wrap !== except && (!except || !entry.wrap.contains(except)) && (!within || within.contains(entry.wrap))) menuState(entry, false);
      });
      Array.from(root.querySelectorAll('.db-popover--open, .db-dropdown--open')).filter(owns).forEach(function(pop) {
        if (pop !== except && pop !== within && (!except || !pop.contains(except)) && (!within || within.contains(pop))) popupState(pop, false);
      });
    }
    function menuState(entry, open, restore) {
      if (open) closePanels(entry.wrap);
      if (!open) { entry.search = ''; entry.searchTime = 0; }
      entry.wrap.classList.toggle('db-dropdown--open', open);
      entry.trigger.setAttribute('aria-expanded', String(open)); entry.menu.hidden = !open; entry.menu.inert = !open; entry.menu.setAttribute('aria-hidden', String(!open));
      if (open) {
        entry.menu.style.top = ''; entry.menu.style.bottom = ''; entry.menu.style.maxHeight = '';
        clampPanel(entry.menu);
        var rect = entry.menu.getBoundingClientRect();
        if (rect.top < 8 && getComputedStyle(entry.menu).position === 'absolute') {
          entry.menu.style.top = 'calc(100% + 4px)'; entry.menu.style.bottom = 'auto';
          rect = entry.menu.getBoundingClientRect();
        }
        if (rect.bottom > window.innerHeight - 8) entry.menu.style.maxHeight = Math.max(44, window.innerHeight - rect.top - 8) + 'px';
        var items = Array.from(entry.menu.querySelectorAll('button, input')).filter(function(item) { return !isDisabled(item) && !item.hidden && item.getClientRects().length; });
        var first = items.filter(function(item) { return item.getAttribute('aria-selected') === 'true'; })[0] || items[0];
        if (first) first.focus();
      }
      else if (restore) entry.trigger.focus();
    }
    function renderQueue(resetEditId) {
      var edits = new Map(), activeEdit = null;
      Array.from(queueEl.querySelectorAll('.db-chat-composer__queued-item')).forEach(function(row) {
        var id = row.getAttribute('data-db-request-id'), editor = row.querySelector('.db-chat-composer__queued-editor'), text = row.querySelector('textarea');
        if (!editor || !text || editor.hidden || id === resetEditId) return;
        edits.set(id, { value: text.value, start: text.selectionStart, end: text.selectionEnd });
        if (text === document.activeElement) activeEdit = id;
      });
      menus = menus.filter(function(entry) { return !queueEl.contains(entry.wrap); });
      queueEl.replaceChildren(); queueEl.hidden = !queue.length;
      queue.forEach(function(request) {
        var row = element('div', 'db-chat-composer__queued-item'); row.setAttribute('role', 'listitem'); row.setAttribute('data-db-request-id', request.id);
        row.appendChild(element('div', 'db-chat-composer__queued-text', request.text));
        if (request.files.length) {
          var rowFiles = element('div', 'db-chat-composer__queued-files');
          request.files.forEach(function(file, index) { rowFiles.appendChild(attachment(file, index, false)); }); row.appendChild(rowFiles);
        }
        var controls = element('div', 'db-chat-composer__queued-actions');
        if (allowSteer) {
          var steer = button('db-chat-composer__steer', busy ? 'Steer queued message' : 'Send queued message now', 'corner-up-left', 'steer');
          steer.appendChild(element('span', '', busy ? 'Steer' : 'Send now'));
          controls.appendChild(steer);
        }
        var drop = element('div', 'db-dropdown');
        var edit = button('db-dropdown__trigger', 'Edit queued message', 'pencil');
        var menu = element('div', 'db-dropdown__menu'); menu.appendChild(button('db-dropdown__item', 'Edit message', null, 'edit'));
        drop.appendChild(edit); drop.appendChild(menu); controls.appendChild(drop); registerMenu(edit, menu);
        controls.appendChild(button('db-chat-composer__remove', 'Remove queued message', 'x', 'remove'));
        var sideChat = actions.filter(function(action) { return action.id === 'side-chat'; })[0];
        if (sideChat) {
          var sideButton = button('db-chat-composer__side-chat', sideChat.label, sideChat.icon || 'messages-square', 'side-chat');
          sideButton.disabled = !!sideChat.disabled; controls.appendChild(sideButton);
        }
        row.appendChild(controls);
        var editor = element('div', 'db-chat-composer__queued-editor'); editor.hidden = true;
        var text = element('textarea', 'db-chat-composer__queued-input'); text.rows = 3; text.value = request.text; text.setAttribute('aria-label', 'Edit queued message');
        var savedEdit = edits.get(request.id);
        if (savedEdit) { editor.hidden = false; text.value = savedEdit.value; text.setSelectionRange(savedEdit.start, savedEdit.end); }
        editor.appendChild(text); editor.appendChild(button('db-chat-composer__edit-save', 'Save edit', 'check', 'save-edit'));
        editor.appendChild(button('db-chat-composer__edit-cancel', 'Cancel edit', 'x', 'cancel-edit')); row.appendChild(editor); queueEl.appendChild(row);
        if (request.id === activeEdit) text.focus();
      });
      releasePreviews(); refreshIcons();
    }
    function queueChanged(request, resetEditId) { renderQueue(resetEditId); emit('queue', { request: request ? copyRequest(request) : null, queue: getQueue() }); changed(); }
    function removeQueued(id) {
      if (!usable()) return false;
      var index = queue.findIndex(function(request) { return request.id === id; });
      if (index === -1) return false;
      var request = queue.splice(index, 1)[0]; queueChanged(request); return true;
    }
    function editQueued(id, text) {
      if (!usable() || typeof text !== 'string') return false;
      var request = queue.filter(function(item) { return item.id === id; })[0];
      if (!request || (!text.trim() && !request.files.length)) return false;
      request.text = text; queueChanged(request, id); return true;
    }
    function steerQueued(id) {
      if (!usable() || !allowSteer || steering.has(id)) return false;
      var request = queue.filter(function(item) { return item.id === id; })[0];
      if (!request) return false;
      steering.add(id);
      try {
        if (!emit('steer', { request: copyRequest(request) }, true) || !usable()) return false;
        removeQueued(id); return true;
      } finally { steering.delete(id); }
    }
    function takeNext() {
      if (!usable() || !queue.length) return null;
      var request = queue.shift(); queueChanged(request); return copyRequest(request);
    }
    function submit() {
      if (!usable() || submitting || isDisabled(root) || sendEl.disabled) return false;
      submitting = true;
      try {
        var request = draftRequest || Object.assign({ id: uid(), text: input.value, files: files.slice() }, config());
        draftRequest = request;
        if (busy) { queue.push(request); }
        else if (!emit('send', { request: copyRequest(request) }, true) || !usable()) return false;
        // A host may replace the draft while handling a send event.
        if (draftRequest === request) { input.value = ''; files = []; draftRequest = null; }
        if (busy && queue.indexOf(request) !== -1) queueChanged(request);
        renderFiles(); return true;
      } finally { submitting = false; }
    }
    function dictationState(state, error) {
      dictation = state; dictationError = error || null; sync();
      emit('dictation', error ? { state: state, error: error } : { state: state });
      changed();
    }
    function dictationMessage(error) {
      if (error === 'not-allowed' || error === 'NotAllowedError' || error === 'SecurityError') return 'Microphone access denied. Check browser or app permissions.';
      if (error === 'service-not-allowed') return 'Your browser has blocked the dictation service. Check your browser settings.';
      if (error === 'audio-capture' || error === 'NotFoundError') return 'No microphone is available. Connect a microphone to use dictation.';
      if (error === 'network') return 'Dictation could not connect. Check your connection before trying again.';
      if (error === 'no-speech') return 'No speech detected. Start dictation again when you are ready.';
      if (error === 'aborted' || error === 'AbortError') return 'Dictation stopped. Your draft is ready to edit.';
      if (error === 'language-not-supported') return 'Your browser does not support dictation in this language.';
      return 'Dictation could not start. You can type your message or try again.';
    }
    function joined(base, transcript) { return base + (base && transcript && !/\s$/.test(base) ? ' ' : '') + transcript; }
    function detachRecognition(abort) {
      var current = recognition; recognition = null;
      if (!current) return;
      current.onstart = current.onresult = current.onerror = current.onend = null;
      if (abort) { try { current.abort(); } catch (e) {} }
    }
    function cancelDictation(restore) {
      if (!usable()) return false;
      if (dictationSession && restore) input.value = dictationSession.base;
      detachRecognition(true); dictationSession = null; draftRequest = null;
      dictationState(allowDictation ? 'stopped' : 'unsupported'); return true;
    }
    function startDictation() {
      if (!usable()) return false;
      dictationBlocked = microphoneBlocked();
      if (dictationBlocked) { allowDictation = false; dictation = 'unsupported'; sync(); return false; }
      if (!allowDictation || !clickGesture || recognition || isDisabled(root)) return false;
      var session = { base: input.value, finalText: '', started: false };
      dictationSession = session;
      try {
        var current = new Recognition(); recognition = current;
        current.continuous = true; current.interimResults = true;
        current.lang = root.getAttribute('lang') || document.documentElement.lang || navigator.language || 'en-US';
        current.onstart = function() {
          if (!usable() || recognition !== current) return;
          session.started = true; sync();
        };
        current.onresult = function(event) {
          if (!usable() || recognition !== current) return;
          var finalText = '', interim = '';
          for (var i = 0; i < event.results.length; i++) {
            var result = event.results[i];
            if (result.isFinal) finalText += result[0].transcript;
            else interim += result[0].transcript;
          }
          session.finalText = finalText; input.value = joined(session.base, finalText + interim); draftRequest = null; sync(); changed();
        };
        current.onerror = function(event) {
          if (!usable() || recognition !== current) return;
          input.value = joined(session.base, session.finalText); detachRecognition(true); dictationSession = null;
          dictationState('error', event.error || 'recognition-failed');
        };
        current.onend = function() {
          if (!usable() || recognition !== current) return;
          input.value = joined(session.base, session.finalText); detachRecognition(false); dictationSession = null;
          dictationState('stopped');
        };
        dictationState('listening');
        if (recognition !== current || !usable()) return false;
        current.start(); return true;
      } catch (error) {
        detachRecognition(true); dictationSession = null; dictationState('error', error.name || 'recognition-failed'); return false;
      }
    }
    function stopDictation() {
      if (!usable() || !recognition) return false;
      try { recognition.stop(); dictationState('stopped'); return true; }
      catch (error) { detachRecognition(true); dictationSession = null; dictationState('error', error.name || 'recognition-failed'); return false; }
    }
    function setDraft(text) {
      if (!usable()) return false;
      if (recognition) cancelDictation(false);
      input.value = String(text); draftRequest = null; sync(); changed(); return true;
    }
    function clearDraft() {
      if (!usable()) return false;
      if (recognition) cancelDictation(false);
      input.value = ''; files = []; draftRequest = null; renderFiles(); return true;
    }
    function renderAddMenu() {
      if (!addMenu) return;
      menus.forEach(function(entry) { if (entry.menu === addMenu) menuState(entry, false, entry.menu.contains(document.activeElement)); });
      menus = menus.filter(function(entry) { return entry.menu !== addMenu; });
      addMenu.replaceChildren();
      if (allowAttachments) {
        var filesItem = button('db-dropdown__item', 'Add files', 'paperclip', 'files');
        filesItem.appendChild(element('span', '', 'Add files')); addMenu.appendChild(filesItem);
      }
      if (allowFolders) {
        var folderItem = button('db-dropdown__item', 'Add folder', 'folder-plus', 'folder');
        folderItem.appendChild(element('span', '', 'Add folder')); addMenu.appendChild(folderItem);
      }
      actions.forEach(function(action, index) {
        var item = button('db-dropdown__item', action.label, action.icon, 'action');
        if (action.icon) item.appendChild(element('span', '', action.label));
        item.setAttribute('data-db-action-index', String(index)); item.disabled = !!action.disabled; addMenu.appendChild(item);
      });
      if (addEl) { addEl.hidden = !addMenu.childElementCount; if (addEl.hidden && document.activeElement === addEl) input.focus(); }
      registerMenu(addEl, addMenu);
    }
    function applyOptions(patch) {
      if (patch.models !== undefined) models = normalizeModels(patch.models);
      if (patch.actions !== undefined) actions = normalizeActions(patch.actions);
      if (patch.capabilities !== undefined) {
        capabilities = Object.assign({}, capabilities, patch.capabilities);
        allowQueue = capabilities.queue !== false; allowSteer = capabilities.steer !== false;
        allowAttachments = capabilities.attachments !== false; allowApproval = capabilities.approval !== false;
        dictationBlocked = microphoneBlocked();
        allowDictation = capabilities.dictation !== false && typeof Recognition === 'function' && !dictationBlocked;
        allowFolders = allowAttachments && capabilities.folders !== false && folderInput && 'webkitdirectory' in folderInput;
        if (folderInput) { if (allowFolders) folderInput.setAttribute('webkitdirectory', ''); else folderInput.removeAttribute('webkitdirectory'); }
        if (!allowAttachments) { root.classList.remove('db-chat-composer--dragover'); if (part('dropzone')) part('dropzone').hidden = true; }
        if (!allowDictation && recognition) cancelDictation(false);
        if (!allowDictation) dictation = 'unsupported';
        else if (dictation === 'unsupported') dictation = 'stopped';
      }
      if (patch.model !== undefined) model = patch.model;
      if (!models.some(function(m) { return m.id === model; })) model = models[0].id;
      if (patch.effort !== undefined) effort = patch.effort;
      if (efforts().indexOf(effort) === -1) effort = defaultEffort();
      if (patch.approval !== undefined) approval = patch.approval;
      if (!allowApproval) approval = 'ask';
      if (patch.mode !== undefined) mode = patch.mode;
      if (patch.goal !== undefined) goal = patch.goal;
      if (patch.models !== undefined) selectOptions(modelEl, models, model);
      if (patch.actions !== undefined || patch.capabilities !== undefined) { renderAddMenu(); renderQueue(); }
      configChanged(); refreshIcons();
    }
    function updateOptions(patch) {
      if (!usable() || !patch || typeof patch !== 'object' || Array.isArray(patch)) return false;
      if ((patch.models !== undefined && !Array.isArray(patch.models)) || (patch.actions !== undefined && !Array.isArray(patch.actions)) ||
          (patch.capabilities !== undefined && (!patch.capabilities || typeof patch.capabilities !== 'object' || Array.isArray(patch.capabilities))) ||
          (patch.model !== undefined && typeof patch.model !== 'string') || (patch.effort !== undefined && typeof patch.effort !== 'string') ||
          (patch.approval !== undefined && ['ask', 'auto'].indexOf(patch.approval) === -1) ||
          (patch.mode !== undefined && ['chat', 'plan'].indexOf(patch.mode) === -1) ||
          (patch.goal !== undefined && patch.goal !== null && typeof patch.goal !== 'string') ||
          (patch.placeholder !== undefined && typeof patch.placeholder !== 'string')) return false;
      if (patch.placeholder !== undefined) input.placeholder = patch.placeholder;
      if (busy && patch.capabilities && patch.capabilities.dictation === false) {
        capabilities = Object.assign({}, capabilities, { dictation: false });
        allowDictation = false;
        if (recognition) cancelDictation(false);
        dictationState('unsupported');
      }
      var next = {};
      ['models', 'actions', 'capabilities', 'model', 'effort', 'approval', 'mode', 'goal'].forEach(function(key) {
        if (patch[key] !== undefined) next[key] = patch[key];
      });
      if (!Object.keys(next).length) return true;
      if (next.models !== undefined) next.models = normalizeModels(next.models);
      if (next.actions !== undefined) next.actions = normalizeActions(next.actions);
      if (next.capabilities !== undefined) next.capabilities = Object.assign({}, pendingOptions && pendingOptions.capabilities, next.capabilities);
      if (busy) pendingOptions = Object.assign({}, pendingOptions, next);
      else applyOptions(next);
      return true;
    }
    function setBusy(value) {
      if (!usable()) return;
      busy = !!value;
      if (!busy && pendingOptions) {
        var patch = pendingOptions; pendingOptions = null; applyOptions(patch);
      } else { sync(); changed(); }
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true; detachRecognition(true); dictationSession = null;
      clearTimeout(gestureTimer); clickGesture = false;
      listeners.forEach(function(remove) { remove(); }); listeners = [];
      menus.forEach(function(entry) { menuState(entry, false); }); menus = [];
      previews.forEach(function(url) { URL.revokeObjectURL(url); }); previews.clear();
      files = []; queue = []; draftRequest = null; pendingOptions = null; steering.clear(); dictation = allowDictation ? 'stopped' : 'unsupported'; sync();
      _chatComposers.delete(root);
      if (!_chatComposers.size && _chatComposerCleanup) { _chatComposerCleanup.disconnect(); _chatComposerCleanup = null; }
    }
    var handle = {
      getState: getState, getQueue: getQueue, takeNext: takeNext, removeQueued: removeQueued, editQueued: editQueued, steerQueued: steerQueued,
      setDraft: setDraft, clearDraft: clearDraft, attachFiles: attachFiles, setModel: setModel, setEffort: setEffort, setMode: setMode, setApproval: setApproval, setGoal: setGoal,
      setBusy: setBusy, updateOptions: updateOptions,
      setStatus: function(text) { if (usable() && statusEl) statusEl.textContent = String(text); },
      startDictation: startDictation, stopDictation: stopDictation, destroy: destroy
    };
    _chatComposers.set(root, { handle: handle, reactOwned: reactOwned, closePanels: closePanels }); watchChatComposerCleanup();
    [[modelEl, 'model', setModel], [effortEl, 'effort', setEffort], [approvalEl, 'approval', setApproval], [modeEl, 'mode', setMode]].forEach(function(entry) { createChoice(entry[1], entry[0], entry[2]); });
    var toolbar = part('toolbar');
    if (toolbar && !part('settings')) {
      var settings = element('div', 'db-chat-composer__settings');
      var settingsTrigger = button('db-chat-composer__settings-trigger', 'Chat settings', 'sliders-horizontal');
      var settingsPanel = element('div', 'db-chat-composer__settings-panel');
      settingsPanel.setAttribute('aria-label', 'Chat settings');
      settingsPanel.appendChild(element('h3', '', 'Chat settings'));
      [[effortEl, 'Effort'], [modeEl, 'Mode'], [goalEl, 'Goal']].forEach(function(pair) {
        if (!pair[0]) return;
        var field = element('div', 'db-chat-composer__settings-field');
        field.appendChild(element('span', '', pair[1]));
        field.appendChild(pair[0].closest('.db-chat-composer__choice') || pair[0]);
        settingsPanel.appendChild(field);
      });
      settings.appendChild(settingsTrigger); settings.appendChild(settingsPanel);
      var modelChoice = modelEl && modelEl.closest('.db-chat-composer__choice');
      var approvalChoice = approvalEl && approvalEl.closest('.db-chat-composer__choice');
      if (modelChoice) {
        if (approvalChoice) modelChoice.before(approvalChoice);
        modelChoice.before(settings);
        var modelTrigger = modelChoice.querySelector('.db-chat-composer__choice-trigger');
        modelTrigger.querySelector('.db-chat-composer__choice-label').after(element('span', 'db-chat-composer__effort-summary'));
      } else toolbar.appendChild(settings);
      if (approvalChoice) {
        var shield = element('i', ''); shield.setAttribute('data-lucide', 'shield-check'); shield.setAttribute('aria-hidden', 'true');
        approvalChoice.querySelector('.db-chat-composer__choice-trigger').prepend(shield);
      }
    }
    if (part('settings')) {
      registerMenu(part('settings-trigger'), part('settings-panel'), 'dialog');
      listen(part('settings-panel'), 'keydown', function(event) {
        if (event.key === 'Enter' && event.target === goalEl) { event.preventDefault(); setGoal(goalEl.value.trim() || null); }
      });
    }
    selectOptions(modelEl, models, model);
    selectOptions(effortEl, efforts().map(function(v) { return { id: v, label: v.charAt(0).toUpperCase() + v.slice(1) }; }), effort);
    if (folderInput && allowFolders) folderInput.setAttribute('webkitdirectory', '');
    renderAddMenu();
    listen(window, 'pagehide', function() { if (recognition) cancelDictation(false); });
    listen(document, 'click', function(event) {
      clickGesture = event.isTrusted;
      clearTimeout(gestureTimer);
      gestureTimer = setTimeout(function() { clickGesture = false; }, 0);
      menus.forEach(function(entry) { if (!entry.wrap.contains(event.target)) menuState(entry, false); });
    }, true);
    listen(document, 'focusin', function(event) {
      menus.forEach(function(entry) { if (!entry.wrap.contains(event.target)) menuState(entry, false); });
    });
    listen(root, 'submit', function(event) { if (event.target === root) { event.preventDefault(); submit(); } });
    listen(input, 'input', function() { if (!usable()) return; if (recognition) cancelDictation(false); draftRequest = null; sync(); changed(); });
    listen(input, 'paste', pasteImages);
    listen(input, 'keydown', function(event) {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229 && !event.defaultPrevented) { event.preventDefault(); submit(); }
    });
    [[modelEl, setModel], [effortEl, setEffort], [approvalEl, setApproval], [modeEl, setMode], [goalEl, setGoal]].forEach(function(pair) {
      listen(pair[0], 'change', function() { pair[1](pair[0].value); sync(); });
    });
    [fileInput, folderInput].forEach(function(el) {
      listen(el, 'change', function() { attachFiles(Array.from(el.files || [])); el.value = ''; });
    });
    listen(root, 'dragover', function(event) {
      if (!owns(event.target) || !usable()) return;
      event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = allowAttachments ? 'copy' : 'none';
      if (allowAttachments) root.classList.add('db-chat-composer--dragover');
      if (part('dropzone')) part('dropzone').hidden = !allowAttachments;
    });
    listen(root, 'dragleave', function(event) {
      if (!root.contains(event.relatedTarget)) { root.classList.remove('db-chat-composer--dragover'); if (part('dropzone')) part('dropzone').hidden = true; }
    });
    listen(root, 'drop', function(event) {
      if (!owns(event.target) || !usable()) return;
      event.preventDefault(); event.stopPropagation(); root.classList.remove('db-chat-composer--dragover');
      if (part('dropzone')) part('dropzone').hidden = true;
      if (event.dataTransfer) attachFiles(Array.from(event.dataTransfer.files || []));
    });
    listen(root, 'click', function(event) {
      if (!usable() || !owns(event.target) || event.defaultPrevented) return;
      var target = event.target.closest('button');
      if (!target || isDisabled(target)) return;
      var entry = menus.filter(function(menu) { return menu.trigger === target; })[0];
      if (entry) { event.preventDefault(); event.stopPropagation(); menuState(entry, entry.menu.hidden); return; }
      var choice = choices.filter(function(menu) { return menu.menu.contains(target); })[0];
      if (choice) {
        event.preventDefault(); event.stopPropagation();
        choice.setter(target.getAttribute('data-value')); menuState(choice, false, true); return;
      }
      if (target === sendEl && root.tagName !== 'FORM') { event.preventDefault(); submit(); return; }
      if (target === stopEl) { emit('stop', undefined, true); return; }
      if (target === dictationEl) { if (recognition) stopDictation(); else startDictation(); return; }
      if (target === part('dictation-stop')) { stopDictation(); return; }
      if (target === part('dictation-cancel')) { cancelDictation(true); return; }
      var command = target.getAttribute('data-db-composer-command');
      if (!command) return;
      menus.forEach(function(menu) { if (menu.menu.contains(target)) { event.stopPropagation(); menuState(menu, false, true); } });
      var row = target.closest('.db-chat-composer__queued-item');
      var id = row && row.getAttribute('data-db-request-id');
      if (command === 'files' && fileInput) fileInput.click();
      else if (command === 'folder' && folderInput) folderInput.click();
      else if (command === 'action') emit('action', { action: Object.assign({}, actions[Number(target.getAttribute('data-db-action-index'))]) }, true);
      else if (command === 'remove-file') { files.splice(Number(target.getAttribute('data-db-file-index')), 1); draftRequest = null; renderFiles(); }
      else if (command === 'remove') removeQueued(id);
      else if (command === 'steer') steerQueued(id);
      else if (command === 'side-chat') {
        var request = queue.filter(function(item) { return item.id === id; })[0];
        if (request) emit('action', { action: 'side-chat', request: copyRequest(request) }, true);
      }
      else if (command === 'edit' && row) { row.querySelector('.db-chat-composer__queued-editor').hidden = false; row.querySelector('textarea').focus(); }
      else if (command === 'save-edit' && row) editQueued(id, row.querySelector('textarea').value);
      else if (command === 'cancel-edit' && row) { row.querySelector('.db-chat-composer__queued-editor').hidden = true; row.querySelector('.db-dropdown__trigger').focus(); }
    });
    listen(root, 'keydown', function(event) {
      if (!usable() || !owns(event.target)) return;
      var entry = menus.filter(function(menu) { return menu.wrap.contains(event.target) && (!menu.menu.hidden || (event.target === menu.trigger && event.key !== 'Escape')); })[0];
      if (!entry) return;
      if (isDisabled(entry.trigger) || isDisabled(root)) return;
      if (event.target === entry.trigger && ['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(event.key) !== -1) {
        event.preventDefault(); event.stopPropagation(); menuState(entry, true);
        var edge = event.key === 'Home' ? 'first' : event.key === 'End' ? 'last' : null;
        if (edge) {
          var enabled = Array.from(entry.menu.querySelectorAll('button')).filter(function(item) { return !isDisabled(item) && !item.hidden; });
          if (enabled.length) enabled[edge === 'first' ? 0 : enabled.length - 1].focus();
        }
        return;
      }
      var typing = entry.field && event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing;
      if (typing && entry.menu.hidden) menuState(entry, true);
      if (entry.menu.hidden) return;
      if (entry.role === 'dialog' && event.key !== 'Escape') return;
      if (event.key === 'Escape' || event.key === 'Tab') { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); } menuState(entry, false, event.key === 'Escape'); return; }
      var items = Array.from(entry.menu.querySelectorAll('button')).filter(function(item) { return !isDisabled(item) && !item.hidden; });
      var index = items.indexOf(document.activeElement);
      if (typing) {
        event.preventDefault(); event.stopPropagation();
        var now = Date.now(); entry.search = now - entry.searchTime < 700 ? entry.search + event.key.toLowerCase() : event.key.toLowerCase(); entry.searchTime = now;
        var search = entry.search.split('').every(function(char) { return char === entry.search[0]; }) ? entry.search[0] : entry.search;
        for (var i = 1; i <= items.length; i++) {
          var item = items[(Math.max(index, 0) + i) % items.length];
          if (item.textContent.trim().toLowerCase().indexOf(search) === 0) { item.focus(); break; }
        }
        return;
      }
      if (!items.length || ['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(event.key) === -1) return;
      event.preventDefault(); event.stopPropagation();
      if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = items.length - 1;
      else index = (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[index].focus();
    }, true);
    renderFiles(); renderQueue(); sync();
    return handle;
  }

  function initChatComposers(root) {
    if (root.nodeType === 1 && root.matches('.db-chat-composer') && !isReactOwned(root)) createChatComposer(root);
    nativeElements(root, '.db-chat-composer').forEach(function(el) { createChatComposer(el); });
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
      ['.db-dropdown', '.db-dropdown__trigger', 'DAUB: .db-dropdown missing __trigger child. Add a button.db-dropdown__trigger.'],
      ['.db-dropdown', '.db-dropdown__content, .db-dropdown__menu', 'DAUB: .db-dropdown missing __content child. Add a div.db-dropdown__content with your menu items.'],
      ['.db-custom-select', '.db-custom-select__trigger', 'DAUB: .db-custom-select missing __trigger child'],
      ['.db-tabs', '.db-tabs__list', 'DAUB: .db-tabs missing __list child'],
      ['.db-field', '.db-field__input', 'DAUB: .db-field missing child with class "db-field__input". Add db-field__input to your input, textarea, select wrapper, or custom control element.'],
      ['.db-slider', '.db-slider__input', 'DAUB: .db-slider missing __input child'],
      ['.db-accordion', '.db-accordion__item', 'DAUB: .db-accordion has no __item children'],
      ['.db-checkbox', '.db-checkbox__input', 'DAUB: .db-checkbox missing __input child'],
      ['.db-radio', '.db-radio__input', 'DAUB: .db-radio missing __input child']
    ];
    checks.forEach(function(c) {
      nativeElements(root, c[0]).forEach(function(el) {
        if (!el.querySelector(c[1])) console.warn(c[2], el);
      });
    });
    nativeElements(root, '.db-modal-overlay').forEach(function(el) {
      if (!el.id) console.warn('DAUB: .db-modal-overlay missing id attribute — JS API needs an id to target this modal.', el);
      if (!el.hasAttribute('aria-hidden')) console.warn('DAUB: .db-modal-overlay should have aria-hidden="true" for accessibility.', el);
    });
    nativeElements(root, '.db-tabs').forEach(function(tabs) {
      var tabCount = nativeElements(tabs, '.db-tabs__tab').length;
      var panelCount = nativeElements(tabs, '.db-tabs__panel').length;
      if (panelCount > 0 && tabCount !== panelCount)
        console.warn('DAUB: .db-tabs has ' + tabCount + ' tabs but ' + panelCount + ' panels — counts should match.', tabs);
    });
  }

  /* ----------------------------------------------------------
     Generic Trigger System
     ---------------------------------------------------------- */
  function initTriggers(root) {
    nativeElements(root, '[data-db-trigger], [data-db-sheet-trigger], [data-db-drawer-trigger], [data-db-alert-dialog-trigger], [data-db-command-trigger]').forEach(function(el) {
      if (el._dbTriggerInit) return;
      el._dbTriggerInit = true;
      el.addEventListener('click', function() {
        var id = el.getAttribute('data-db-trigger') || el.getAttribute('data-db-sheet-trigger') || el.getAttribute('data-db-drawer-trigger') || el.getAttribute('data-db-alert-dialog-trigger') || el.getAttribute('data-db-command-trigger');
        var target = document.getElementById(id);
        if (!target) return;
        if (target.classList.contains('db-modal-overlay') || _isDialog(target)) openModal(id, el);
        else if (target.classList.contains('db-alert-dialog')) openAlertDialog(id);
        else if (target.classList.contains('db-sheet')) openSheet(id);
        else if (target.classList.contains('db-drawer')) openDrawer(id);
        else if (target.classList.contains('db-command')) openCommand(id);
      });
    });
  }

  /* ----------------------------------------------------------
     Init
     ---------------------------------------------------------- */
  function init(root) {
    root = root || document;
    if (isReactOwned(root)) return;
    _overlayStack.slice().forEach(function(el) { if (!el.isConnected) finishOverlayClose(el); });
    initInteractionGuards();
    initTheme();
    initSwitches(root);
    initTabs(root);
    initModals(root);
    initSteppers(root);
    initTooltips(root);
    initHoverCards(root);
    initSliders(root);
    initTemperature();
    initNoise();
    initTexture();
    initCheckboxes(root);
    initRadios(root);
    initAccordions(root);
    initCollapsibles(root);
    initAlertDialogs(root);
    initSheets(root);
    initDrawers(root);
    initChatComposers(root);
    initPopovers(root);
    initContextMenus(root);
    initDropdowns(root);
    initToggles(root);
    initCustomSelects(root);
    initCommands(root);
    initMenubars(root);
    initCalendars(root);
    initCarousels(root);
    initDataTables(root);
    initOTP(root);
    initResizables(root);
    initChipClose(root);
    initChipToggle(root);
    initNavbars(root);
    initSidebarToggle(root);
    initMessageScrollers(root);
    initTriggers(root);
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

  function getColor(token) {
    var prop = token.indexOf('--') === 0 ? token : '--db-' + token;
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  }

  /* ----------------------------------------------------------
     Public API
     ---------------------------------------------------------- */
  window.DAUB = {
    getColor: getColor,
    init: init,
    createMessageScroller: createMessageScroller,
    createChatComposer: createChatComposer,
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
      saveSetting('db-texture', type);
      nativeElements(document, '[data-db-texture-btn]').forEach(function(btn) {
        btn.setAttribute('aria-pressed', String(btn.getAttribute('data-db-texture-btn') === type));
      });
    },
    getTexture: function() {
      return document.documentElement.getAttribute('data-db-texture') || 'grain';
    },
    setTemperature: setTemperature,
    getTemperature: getTemperature,
    TEXTURES: ['grain', 'paper', 'metal', 'wood', 'glass', 'none'],
    toggleSidebar: toggleSidebar,
    toggleNavbar: toggleNavbar,
    refreshIcons: refreshIcons,
    THEME_CATEGORIES: THEME_CATEGORIES,
    CATEGORY_NAMES: CATEGORY_NAMES,
    getCategory: getCategory
  };

})();
