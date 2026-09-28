// In-page half of the combo audit. Loaded by the harness shell after daub.js and
// daub-render.js. window.__combo.render(job) renders one json-render spec the way
// the hosted MCP HTML does (renderElement(root) + orphans, DAUB.init(),
// lucide.createIcons()), opens requested overlays, then runs the checks and
// returns { findings, stats }.
(function () {
  'use strict';
  var app = document.getElementById('app');
  var SHELL = new Set(Array.prototype.slice.call(document.body.children));
  var logs = [];

  function fmtArgs(args) {
    var el = null;
    var msg = Array.prototype.map.call(args, function (a) {
      if (a && a.nodeType === 1) { el = a; return '<' + a.tagName.toLowerCase() + '>'; }
      try { return typeof a === 'string' ? a : (a && a.message) || JSON.stringify(a); } catch (e) { return String(a); }
    }).join(' ');
    return { msg: msg, el: el };
  }
  var _err = console.error, _warn = console.warn;
  console.error = function () { var f = fmtArgs(arguments); logs.push({ level: 'error', msg: f.msg, el: f.el }); return _err.apply(console, arguments); };
  console.warn = function () {
    var f = fmtArgs(arguments);
    // "[daub-render] Type id: msg" = a renderer threw and fell back to an inline notice.
    if (/^\[daub-render\]/.test(f.msg)) logs.push({ level: 'error', msg: f.msg, el: f.el });
    // daub.js _validate() dev lint: runs only on localhost/127.0.0.1, so production never logs it.
    else if (/^DAUB:/.test(f.msg)) logs.push({ level: 'lint', msg: f.msg, el: f.el });
    return _warn.apply(console, arguments);
  };
  window.addEventListener('error', function (e) { if (e && e.message) logs.push({ level: 'error', msg: 'pageerror: ' + e.message }); });
  window.addEventListener('unhandledrejection', function (e) { logs.push({ level: 'error', msg: 'unhandledrejection: ' + (e && e.reason && e.reason.message || e && e.reason) }); });

  // ---- helpers ----------------------------------------------------------------
  var ST, RC, SHOWN, TYPE;
  function st(el) { var s = ST.get(el); if (!s) { s = getComputedStyle(el); ST.set(el, s); } return s; }
  function rect(el) { var r = RC.get(el); if (!r) { r = el.getBoundingClientRect(); RC.set(el, r); } return r; }
  function isEl(n) { return n && n.nodeType === 1 && (n instanceof HTMLElement || n.tagName === 'svg'); }

  // Visible by design: not display:none / visibility:hidden / opacity~0 / [hidden],
  // no such ancestor, and no ancestor that clips and is collapsed to 0 (closed accordion).
  function shown(el) {
    if (SHOWN.has(el)) return SHOWN.get(el);
    var v = true;
    if (el === app || el === document.body || el === document.documentElement) v = true;
    else {
      var s = st(el);
      if (s.display === 'none' || s.visibility !== 'visible' || parseFloat(s.opacity) < 0.05 || el.hidden || s.contentVisibility === 'hidden') v = false;
      else {
        var p = el.parentElement;
        if (p && !shown(p)) v = false;
        else if (p && p !== app && p !== document.body) {
          var ps = st(p);
          if (ps.overflowX !== 'visible' || ps.overflowY !== 'visible') {
            var pr = rect(p);
            if (pr.width < 1 || pr.height < 1) v = false;
          }
        }
      }
    }
    SHOWN.set(el, v);
    return v;
  }

  // Text directly inside a clipping box collapsed to 0 (closed accordion item) is hidden.
  function textHidden(pe) {
    if (!shown(pe)) return true;
    var s = st(pe);
    if (s.overflowX === 'visible' && s.overflowY === 'visible') return false;
    var r = rect(pe);
    return r.width < 1 || r.height < 1;
  }
  function hasVisibleBox(el) {
    var d = el.querySelectorAll('*');
    for (var i = 0; i < d.length && i < 400; i++) {
      if (!isEl(d[i]) || !shown(d[i])) continue;
      var r = rect(d[i]);
      if (r.width >= 1 && r.height >= 1) return true;
    }
    return false;
  }

  function specEl(el) { return el && el.closest ? el.closest('[data-spec-id]') : null; }
  function who(el) {
    var s = specEl(el);
    var id = s ? s.getAttribute('data-spec-id') : null;
    return { id: id, type: id ? (TYPE[id] || '?') : '(shell)', sel: sel(el, s) };
  }
  function short(el) {
    if (!el || !el.tagName) return '';
    var cls = typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '';
    var c = cls.trim().split(/\s+/).filter(function (x) { return /^db-|^lucide/.test(x); }).slice(0, 2).join('.');
    return el.tagName.toLowerCase() + (c ? '.' + c : '');
  }
  function sel(el, stop) {
    var parts = [], cur = el, n = 0;
    while (cur && cur !== stop && n < 3 && cur !== app) { parts.unshift(short(cur)); cur = cur.parentElement; n++; }
    if (stop && el !== stop) parts.unshift('[' + stop.getAttribute('data-spec-id') + ']');
    return parts.join(' > ') || short(el);
  }
  function r1(x) { return Math.round(x * 10) / 10; }

  // ---- contrast (sampler reused from tests/component-audit/audit.mjs A11Y_RULES) --
  function parseColor(str) {
    var m = /rgba?\(([^)]+)\)/.exec(str || ''); if (!m) return null;
    var parts = m[1].split(/[\s,\/]+/).filter(Boolean).map(function (x) { return parseFloat(x); });
    if (parts.length >= 3) return [parts[0], parts[1], parts[2], parts.length >= 4 ? parts[3] : 1];
    return null;
  }
  function lum(rgb) {
    function ch(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2]);
  }
  function contrast(fg, bg) { var a = lum(fg), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
  function canvasColor() {
    var cs = getComputedStyle(document.documentElement).colorScheme || '';
    return /dark/.test(cs) && !/light/.test(cs) ? [18, 18, 18, 1] : [255, 255, 255, 1];
  }
  // Walks to the first opaque background; the component-audit sampler assumed cream at
  // the root, here we fall back to the real canvas colour (the hosted shell can leave
  // body transparent).
  function effectiveBg(el) {
    for (var cur = el; cur && cur.nodeType === 1; cur = cur.parentElement) {
      var c = parseColor(st(cur).backgroundColor);
      if (c && c[3] > 0.01) return c;
    }
    return canvasColor();
  }
  function unstableBg(el) {
    for (var cur = el; cur && cur.nodeType === 1; cur = cur.parentElement) {
      var s = st(cur);
      var bi = s.backgroundImage;
      if (bi && bi !== 'none') return true;
      var bc = parseColor(s.backgroundColor);
      if (bc && bc[3] > 0.01 && bc[3] < 0.99) return true;
      if (bc && bc[3] >= 0.99) return false; // opaque layer reached; nothing below matters
    }
    return false;
  }
  function effOpacity(el) { var o = 1; for (var c = el; c && c.nodeType === 1; c = c.parentElement) o *= parseFloat(st(c).opacity); return o; }

  // ---- checks -------------------------------------------------------------------
  var CAP_PER_CHECK = 12;
  // Containers that clip their children by design. Accordion/collapsible content is NOT
  // listed: closed ones are 0-high (children count as hidden), open ones clipping at
  // max-height is a real defect.
  var INTENTIONAL_CLIP = /db-carousel|db-avatar|db-aspect|db-progress|db-skeleton|db-chart|db-card__media|db-switch|db-slider|db-scroll-area/;
  var OVERLAP_OK = /db-avatar-group/;
  var WRAPPER_TYPES = { Tooltip: 1, Popover: 1, HoverCard: 1, Field: 1, InputGroup: 1, InputIcon: 1, ButtonGroup: 1, Navbar: 1, Modal: 1, Sheet: 1, Drawer: 1, AlertDialog: 1, CommandPalette: 1, DropdownMenu: 1, ContextMenu: 1, AspectRatio: 1 };
  var OVERLAY_TYPES = { Modal: 1, Sheet: 1, Drawer: 1, AlertDialog: 1, CommandPalette: 1, ContextMenu: 1 };
  var CONTAINER_TYPES = { Stack: 1, Grid: 1, Card: 1, Surface: 1, Tabs: 1, Accordion: 1, Collapsible: 1, ScrollArea: 1, ChartCard: 1, Layout: 1, Resizable: 1, Carousel: 1 };
  var PANEL_OF = { Modal: '.db-modal', Sheet: '.db-sheet__panel', Drawer: '.db-drawer__panel', AlertDialog: '.db-alert-dialog__panel', Popover: '.db-popover__content', DropdownMenu: '.db-dropdown__content', CommandPalette: '.db-command__panel' };
  var FIELD_CONTROLS = '.db-field__input, .db-input, .db-select, .db-textarea, .db-custom-select, .db-otp, input, select, textarea';
  // Faded on purpose (outside-month days, placeholder hints) or coloured by the block author (CustomHTML).
  var CONTRAST_EXEMPT = '.db-calendar__day--outside, .db-custom-select__placeholder, .pg-custom-html';
  var NEAR_MISS = 0.25; // ratios within this of the AA threshold report as contrast_near (info)
  // db-block--mod / db-block__elem--mod
  var MODIFIER = /^db-[a-z0-9]+(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?--[a-z0-9]+(?:-[a-z0-9]+)*$/;
  // Joined controls sit flush on purpose; their labels are padded apart.
  var JOINED = /db-btn-group|db-input-group|db-toggle-group|db-segmented/;
  // Spec props that carry visible text, and list props whose entries carry it.
  var TEXT_KEYS = { content: 1, text: 1, title: 1, description: 1, label: 1, message: 1, primary: 1, secondary: 1, subtitle: 1, heading: 1, caption: 1, helper: 1, quote: 1, author: 1, meta: 1 };
  var LIST_KEYS = { items: 1, steps: 1, sections: 1, tabs: 1, stats: 1, features: 1, links: 1, options: 1, events: 1, actions: 1, crumbs: 1, groups: 1 };
  var SPEC = null, ORPH = [];

  // The daub.css / shell rules, collected once (CustomHTML <style> tags inside #app excluded).
  var CSS_CLASSES = null;
  function cssClasses() {
    if (CSS_CLASSES) return CSS_CLASSES;
    var set = new Set();
    (function walk(rules) {
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        if (r.selectorText) { var m = r.selectorText.match(/\.[A-Za-z0-9_-]+/g); if (m) m.forEach(function (c) { set.add(c.slice(1)); }); }
        if (r.cssRules) walk(r.cssRules);
      }
    })(Array.prototype.reduce.call(document.styleSheets, function (acc, s) {
      if (s.ownerNode && app.contains(s.ownerNode)) return acc;
      try { return acc.concat(Array.prototype.slice.call(s.cssRules)); } catch (e) { return acc; }
    }, []));
    if (set.size > 100) CSS_CLASSES = set; // daub.css loaded; otherwise retry next render
    return set;
  }

  // Box paints something of its own against refBg: background, image, shadow or a border.
  function paints(s, refBg) {
    var bgc = parseColor(s.backgroundColor);
    if (bgc && bgc[3] > 0.05 && (Math.abs(bgc[0] - refBg[0]) + Math.abs(bgc[1] - refBg[1]) + Math.abs(bgc[2] - refBg[2]) > 6)) return true;
    if (s.backgroundImage && s.backgroundImage !== 'none') return true;
    if (s.boxShadow && s.boxShadow !== 'none') return true;
    return ['Top', 'Right', 'Bottom', 'Left'].some(function (sd) { return parseFloat(s['border' + sd + 'Width']) > 0 && s['border' + sd + 'Style'] !== 'none' && (parseColor(s['border' + sd + 'Color']) || [0, 0, 0, 0])[3] > 0.05; });
  }
  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ''); }

  function runChecks(opts) {
    ST = new Map(); RC = new Map(); SHOWN = new Map();
    var findings = [];
    var perCheck = {};
    var seen = {};
    function add(check, el, extra) {
      var w = el ? who(el) : { id: null, type: '(page)', sel: '' };
      var key = check + '|' + w.id + '|' + w.sel + '|' + (extra && extra.key || '');
      if (seen[key]) return;
      seen[key] = 1;
      perCheck[check] = (perCheck[check] || 0) + 1;
      if (perCheck[check] > CAP_PER_CHECK) return;
      if (el && el.setAttribute && !el.hasAttribute('data-combo-f')) el.setAttribute('data-combo-f', check);
      var f = { check: check, id: w.id, type: w.type, sel: w.sel };
      if (extra) for (var k in extra) if (k !== 'key') f[k] = extra[k];
      findings.push(f);
    }

    var roots = [app];
    Array.prototype.forEach.call(document.body.children, function (n) { if (!SHELL.has(n) && n.tagName !== 'SCRIPT') roots.push(n); });
    var all = [];
    roots.forEach(function (r) { if (r !== app) all.push(r); Array.prototype.forEach.call(r.querySelectorAll('*'), function (n) { if (isEl(n) && !(n.ownerSVGElement)) all.push(n); }); });
    var vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;

    // 1. console / render errors
    logs.forEach(function (l) {
      // A Field wrapping a styled control (.db-input, .db-select ...) renders fine; the validator only knows .db-field__input.
      if (l.level === 'lint' && /db-field missing child/.test(l.msg) && l.el && l.el.querySelector && l.el.querySelector(FIELD_CONTROLS)) return;
      var check = l.level === 'error' ? 'console_error' : l.level === 'lint' ? 'lint' : 'console_warn';
      add(check, l.el && l.el.isConnected ? l.el : null, { msg: String(l.msg).slice(0, 220), key: l.msg });
    });
    all.forEach(function (n) {
      if (n.hasAttribute('data-render-error')) add('console_error', n, { msg: 'render error: ' + n.getAttribute('data-render-error') });
      else if (n.classList.contains('db-alert__title') && /^Unknown: /.test(n.textContent)) add('console_error', n, { msg: n.textContent });
    });

    // 2. zero-size elements that should be visible
    all.forEach(function (n) {
      if (!shown(n)) return;
      var s = st(n);
      if (s.display === 'contents') return;
      if (n.tagName === 'OPTION' || n.tagName === 'OPTGROUP' || (n.parentElement && n.parentElement.closest('select'))) return;
      var isSpec = n.hasAttribute('data-spec-id');
      // Containers render nothing of their own; their leaves are checked individually.
      if (isSpec && (CONTAINER_TYPES[TYPE[n.getAttribute('data-spec-id')]] || WRAPPER_TYPES[TYPE[n.getAttribute('data-spec-id')]])) return;
      var hasText = false;
      for (var c = n.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && c.nodeValue.trim()) { hasText = true; break; }
      var replaced = /^(IMG|svg|INPUT|BUTTON|SELECT|TEXTAREA|CANVAS|VIDEO)$/.test(n.tagName);
      if (!isSpec && !hasText && !replaced) return;
      if (n.tagName === 'INPUT' && n.type === 'hidden') return;
      // Native checkbox/radio inputs hidden via size 0 behind a custom visual are by design.
      if (n.tagName === 'INPUT' && /checkbox|radio/.test(n.type) && !isSpec) return;
      var r = rect(n);
      // A clipping box collapsed to 0 is closed by design (accordion item max-height:0).
      // A wrapper of positioned content (open sheet root, fixed bottom nav) is 0x0 but visible.
      if ((r.width < 1 || r.height < 1) && s.overflowX === 'visible' && s.overflowY === 'visible' && !hasVisibleBox(n)) add('zero_size', n, { w: r1(r.width), h: r1(r.height) });
    });

    var textNodes = [];
    roots.forEach(function (r) {
      var tw = document.createTreeWalker(r, NodeFilter.SHOW_TEXT, null);
      var t;
      while ((t = tw.nextNode())) { if (t.nodeValue.trim()) textNodes.push(t); }
    });
    var range = document.createRange();

    // 3. page horizontal overflow + culprits, and 4. child overflow
    var de = document.documentElement;
    var pageOver = de.scrollWidth - de.clientWidth;
    var culprits = [];
    all.forEach(function (n) {
      if (!shown(n)) return;
      var r = rect(n);
      if (r.width < 1 || r.height < 1) return;
      if (r.right > vw + 1) {
        var p = n.parentElement;
        var pr = p ? rect(p) : null;
        if (!pr || pr.right <= vw + 1 || p === app || p === document.body) culprits.push(n);
      }
    });
    if (pageOver > 1 && !culprits.length) {
      // No box crosses the edge: an unbreakable text run (URL, email) does.
      for (var tx = 0; tx < textNodes.length && culprits.length < 4; tx++) {
        var tpe = textNodes[tx].parentElement;
        if (!tpe || textHidden(tpe)) continue;
        range.selectNodeContents(textNodes[tx]);
        if (range.getBoundingClientRect().right > vw + 1) culprits.push(tpe);
      }
    }
    if (pageOver > 1) {
      var first = culprits[0] || null;
      add('page_overflow', first, { side: 'right', scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, over: pageOver, culprits: culprits.slice(0, 4).map(function (c) { var w = who(c); return w.id + ':' + w.type + ' ' + w.sel + ' right=' + r1(rect(c).right); }) });
    }
    // Past the left edge (a centred row wider than its column): scrollWidth misses it and
    // nobody can scroll to it. Only in-flow boxes with no clipping/positioned ancestor count.
    var leftOver = 0, leftEl = null;
    all.forEach(function (n) {
      if (!shown(n)) return;
      var r = rect(n);
      if (r.width < 1 || r.height < 1 || r.left >= -1) return;
      var p = n.parentElement;
      if (p && p !== app && rect(p).left < -1) return; // report the outermost box only
      for (var a = n; a && a !== app; a = a.parentElement) {
        var as = st(a);
        if (as.position === 'fixed' || as.position === 'absolute' || (a !== n && (as.overflowX !== 'visible' || as.transform !== 'none'))) return;
      }
      if (-r.left > leftOver) { leftOver = -r.left; leftEl = n; }
    });
    if (leftEl) add('page_overflow', leftEl, { side: 'left', over: r1(leftOver), key: 'left' });

    var flaggedOverflow = new Set();
    all.forEach(function (n) {
      if (!shown(n)) return;
      var p = n.parentElement;
      if (!p || p === document.body || p === app || !isEl(p)) return;
      // Report the outermost overflowing box only, not each descendant riding along.
      for (var a = p; a && a !== app; a = a.parentElement) if (flaggedOverflow.has(a)) return;
      var s = st(n);
      if (s.position === 'absolute' || s.position === 'fixed') return;
      var r = rect(n), pr = rect(p);
      if (r.width < 1 || r.height < 1 || pr.width < 1 || pr.height < 1) return;
      var dx = Math.max(r.right - pr.right, pr.left - r.left);
      var dy = Math.max(r.bottom - pr.bottom, pr.top - r.top);
      if (dx <= 1 && dy <= 1) return;
      var ps = st(p);
      // Inline parents have no box of their own (a kbd inside a span pokes out vertically by design).
      if (ps.display === 'inline' || ps.display === 'contents') return;
      var axis = dx > 1 ? 'x' : 'y';
      var ov = axis === 'x' ? ps.overflowX : ps.overflowY;
      if (ov === 'auto' || ov === 'scroll') return;
      var mode = ov === 'visible' ? 'spill' : 'clip';
      if (mode === 'spill') {
        // Spilling out of a carousel track etc. into a box that clips on purpose.
        for (var ca = p.parentElement; ca && ca !== app; ca = ca.parentElement) {
          var cas = st(ca), cov2 = axis === 'x' ? cas.overflowX : cas.overflowY;
          if (cov2 !== 'visible') { if (INTENTIONAL_CLIP.test(typeof ca.className === 'string' ? ca.className : '')) return; break; }
        }
      }
      if (mode === 'clip') {
        var pc = (typeof p.className === 'string' ? p.className : '') + ' ' + (typeof n.className === 'string' ? n.className : '');
        if (INTENTIONAL_CLIP.test(pc)) return;
        if (Math.max(dx, dy) <= 2) return;
      }
      // Spilling out of a box that itself sits inside a scroll area is still visible overlap.
      flaggedOverflow.add(n);
      var co = { mode: mode, axis: axis, dx: r1(dx), dy: r1(dy), parent: short(p), childW: r1(r.width), parentW: r1(pr.width) };
      if (mode === 'clip' && axis === 'y' && p.classList.contains('db-accordion__content')) co.note = 'content truncated (max-height)';
      add('child_overflow', n, co);
    });

    // 5. offscreen positioned content (opened popovers/menus/panels running off the viewport)
    all.forEach(function (n) {
      if (!shown(n)) return;
      var s = st(n);
      if (s.position !== 'absolute' && s.position !== 'fixed') return;
      var r = rect(n);
      if (r.width < 2 || r.height < 2) return;
      // Screen-reader-only / visually clipped helpers
      if (r.width <= 2 && r.height <= 2) return;
      var off = {};
      if (r.left < -1) off.left = r1(-r.left);
      if (r.right > vw + 1) off.right = r1(r.right - vw);
      if (s.position === 'fixed') {
        if (r.top < -1) off.top = r1(-r.top);
        if (r.bottom > vh + 1 && s.overflowY === 'visible') off.bottom = r1(r.bottom - vh);
      }
      if (Object.keys(off).length) {
        // Only report the outermost positioned box, not each descendant.
        for (var a = n.parentElement; a && a !== app; a = a.parentElement) { var as = st(a); if ((as.position === 'absolute' || as.position === 'fixed') && shown(a)) { var ar = rect(a); if (ar.left < -1 || ar.right > vw + 1) return; } }
        off.position = s.position;
        add('offscreen', n, off);
      }
    });

    // 5b. position:fixed components nested inside containers escape to the viewport
    // (BottomNav inside a Card renders glued to the screen bottom, detached from the card).
    all.forEach(function (n) {
      var id = n.getAttribute && n.getAttribute('data-spec-id');
      if (!id || OVERLAY_TYPES[TYPE[id]] || !shown(n)) return;
      var fixedEl = st(n).position === 'fixed' ? n : null;
      if (!fixedEl) return;
      // A page-level Stack parent is the intended placement; anything deeper or boxier is not.
      var depth = 0, boxed = null;
      for (var a = n.parentElement; a && a !== app; a = a.parentElement) {
        var aid = a.getAttribute('data-spec-id');
        if (!aid) continue;
        depth++;
        if (!boxed && TYPE[aid] !== 'Stack') boxed = TYPE[aid];
      }
      if (depth >= 2 || boxed) { var r = rect(n); add('escaped_fixed', n, { depth: depth, inside: boxed || 'Stack', top: r1(r.top), bottom: r1(r.bottom), w: r1(r.width) }); }
    });

    // 6. overlapping siblings in flex/grid
    all.forEach(function (p) {
      if (!shown(p)) return;
      var d = st(p).display;
      if (!/flex|grid/.test(d)) return;
      var pc = typeof p.className === 'string' ? p.className : '';
      if (OVERLAP_OK.test(pc)) return;
      var kids = [];
      for (var c = p.firstElementChild; c && kids.length < 60; c = c.nextElementSibling) {
        if (!isEl(c) || !shown(c)) continue;
        var cs = st(c);
        if (cs.position === 'absolute' || cs.position === 'fixed' || cs.display === 'contents') continue;
        var cr = rect(c);
        if (cr.width < 1 || cr.height < 1) continue;
        kids.push(c);
      }
      for (var i = 0; i < kids.length; i++) for (var j = i + 1; j < kids.length; j++) {
        var a = rect(kids[i]), b = rect(kids[j]);
        var iw = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        var ih = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        // >4px^2 and more than a shared 1px border (btn-group / input-group collapse borders on purpose)
        if (iw > 1.5 && ih > 1.5 && iw * ih > 4) {
          var wb = who(kids[j]);
          add('overlap', kids[i], { with: wb.id + ':' + wb.type + ' ' + wb.sel, iw: r1(iw), ih: r1(ih), area: Math.round(iw * ih), container: short(p), key: wb.sel });
        }
      }
    });

    // 7. text clipping / spilling: a text run extends beyond its block box
    var clipDone = new Set();
    textNodes.forEach(function (t) {
      var pe = t.parentElement;
      if (!pe || textHidden(pe)) return;
      if (/^(OPTION|SCRIPT|STYLE|TEXTAREA|SELECT)$/.test(pe.tagName)) return;
      var b = pe;
      while (b && b !== app && /^(inline|contents)$/.test(st(b).display)) b = b.parentElement;
      if (!b || b === app || clipDone.has(b)) return;
      range.selectNodeContents(t);
      var tr = range.getBoundingClientRect();
      if (tr.width < 1 || tr.height < 1) return;
      var br = rect(b);
      var ox = Math.max(tr.right - br.right, br.left - tr.left);
      var oy = Math.max(tr.bottom - br.bottom, br.top - tr.top);
      // Glyph boxes poke out of tight line-heights (h1 at line-height 1.1) by a few px;
      // vertical overflow only counts from ~half a line up.
      var yTol = Math.max(1, 0.45 * parseFloat(st(pe).fontSize || 16));
      if (ox <= 1 && oy <= yTol) return;
      // Find the first ancestor (from b) that clips on the offending axis.
      var axis = ox > 1 ? 'x' : 'y';
      if (axis === 'y' && oy <= yTol) return;
      var clipper = null;
      for (var a = b; a && a !== app && a !== document.body; a = a.parentElement) {
        var ov = axis === 'x' ? st(a).overflowX : st(a).overflowY;
        if (ov !== 'visible') { clipper = a; break; }
      }
      if (clipper) {
        var cov = axis === 'x' ? st(clipper).overflowX : st(clipper).overflowY;
        var scrolls = cov === 'auto' || cov === 'scroll';
        // Vertical scroll is normal. Horizontal scroll to read a label is not, unless the
        // box is a deliberate horizontal scroller (ScrollArea, table wrapper, pre).
        if (scrolls && (axis === 'y' || clipper.tagName === 'PRE' || /db-scroll-area|db-table|db-data-table|db-carousel/.test(typeof clipper.className === 'string' ? clipper.className : ''))) return;
        var cr = rect(clipper);
        var inside = tr.left >= cr.left - 1 && tr.right <= cr.right + 1 && tr.top >= cr.top - 1 && tr.bottom <= cr.bottom + 1;
        if (!inside) {
          var bs = st(b), cs2 = st(clipper);
          if (axis === 'x' && (bs.textOverflow === 'ellipsis' || cs2.textOverflow === 'ellipsis')) return; // intended truncation
          if (axis === 'y' && (bs.webkitLineClamp && bs.webkitLineClamp !== 'none' || cs2.webkitLineClamp && cs2.webkitLineClamp !== 'none')) return;
          var ccls = typeof clipper.className === 'string' ? clipper.className : '';
          if (/db-carousel/.test(ccls)) return;
          clipDone.add(b);
          add('text_clip', b, { mode: scrolls ? 'scroll-clipped' : 'clipped', axis: axis, over: r1(axis === 'x' ? ox : oy), text: t.nodeValue.trim().slice(0, 60), clipper: short(clipper) });
          return;
        }
      }
      clipDone.add(b);
      add('text_clip', b, { mode: 'spills', axis: axis, over: r1(axis === 'x' ? ox : oy), text: t.nodeValue.trim().slice(0, 60) });
    });

    // 8. contrast
    var sampled = 0, sampledEls = new Set();
    for (var ti = 0; ti < textNodes.length && sampled < 80; ti++) {
      var tn = textNodes[ti], p = tn.parentElement;
      if (!p || sampledEls.has(p) || textHidden(p) || p.closest('select')) continue;
      sampledEls.add(p);
      var pr2 = rect(p); if (pr2.width < 1 || pr2.height < 1) continue;
      if (p.closest(':disabled, [aria-disabled="true"], [disabled]') || p.closest(CONTRAST_EXEMPT)) continue;
      var cs = st(p);
      var fg = parseColor(cs.color); if (!fg) continue;
      sampled++;
      if (unstableBg(p)) continue;
      var bg = effectiveBg(p);
      var alpha = fg[3] * effOpacity(p);
      if (alpha < 0.1) continue;
      var fgb = [fg[0] * alpha + bg[0] * (1 - alpha), fg[1] * alpha + bg[1] * (1 - alpha), fg[2] * alpha + bg[2] * (1 - alpha)];
      var ratio = contrast(fgb, bg);
      var size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
      var req = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
      if (ratio < req - 0.01) add(ratio >= req - NEAR_MISS ? 'contrast_near' : 'contrast', p, { ratio: Math.round(ratio * 100) / 100, required: req, fg: cs.color, bg: 'rgb(' + bg.slice(0, 3).map(Math.round).join(',') + ')', text: tn.nodeValue.trim().slice(0, 40) });
    }

    // 9. empty regions in large containers
    var containers = [];
    all.forEach(function (n) {
      var id = n.getAttribute && n.getAttribute('data-spec-id');
      if (!id) return;
      var t = TYPE[id];
      if (CONTAINER_TYPES[t]) containers.push(n);
      else if (PANEL_OF[t]) { var pnl = n.matches(PANEL_OF[t]) ? n : n.querySelector(PANEL_OF[t]); if (pnl) containers.push(pnl); }
    });
    containers.forEach(function (c) {
      if (!shown(c)) return;
      var cr = rect(c);
      if (cr.width < 200 || cr.height < 120) return;
      if (c.querySelector('.db-empty')) return; // an EmptyState panel is empty on purpose
      if (c.classList.contains('db-sheet__panel')) return; // sheets are full-height by design
      // A transparent layout box (Stack, Grid, unstyled Surface) has no visible edge: its
      // whitespace reads as page whitespace. Unstyled variants surface as unknown_variant.
      if (!paints(st(c), c.parentElement ? effectiveBg(c.parentElement) : canvasColor())) return;
      // Content boxes are dilated by DIL px so ordinary gaps between items count as used;
      // what stays empty has no content within DIL px.
      var CELL = 8, DIL = 12, cols = Math.ceil(cr.width / CELL), rows = Math.ceil(cr.height / CELL);
      var grid = new Uint8Array(cols * rows);
      function mark(r) {
        var x0 = Math.max(0, Math.floor((r.left - DIL - cr.left) / CELL)), x1 = Math.min(cols - 1, Math.ceil((r.right + DIL - cr.left) / CELL) - 1);
        var y0 = Math.max(0, Math.floor((r.top - DIL - cr.top) / CELL)), y1 = Math.min(rows - 1, Math.ceil((r.bottom + DIL - cr.top) / CELL) - 1);
        for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) grid[y * cols + x] = 1;
      }
      var cbg = effectiveBg(c);
      var cFixed = st(c).position === 'fixed';
      (function walk(node) {
        for (var k = node.firstChild; k; k = k.nextSibling) {
          if (k.nodeType === 3) {
            if (!k.nodeValue.trim()) continue;
            range.selectNodeContents(k);
            var rs = range.getClientRects();
            for (var q = 0; q < rs.length; q++) mark(rs[q]);
            continue;
          }
          if (!isEl(k) || !shown(k)) continue;
          var ks = st(k);
          if (ks.position === 'fixed' && !cFixed) continue;
          if ((ks.overflowX !== 'visible' || ks.overflowY !== 'visible') && (rect(k).width < 1 || rect(k).height < 1)) continue;
          var kr = rect(k);
          if (kr.width < 1 && kr.height < 1 && ks.overflowX === 'visible') { walk(k); continue; }
          if (/^(IMG|svg|INPUT|BUTTON|SELECT|TEXTAREA|CANVAS|VIDEO|HR|IFRAME|TABLE)$/.test(k.tagName)) { mark(kr); continue; }
          var bgc = parseColor(ks.backgroundColor);
          var painted = (bgc && bgc[3] > 0.05 && (Math.abs(bgc[0] - cbg[0]) + Math.abs(bgc[1] - cbg[1]) + Math.abs(bgc[2] - cbg[2]) > 6)) ||
            (ks.backgroundImage && ks.backgroundImage !== 'none') || (ks.boxShadow && ks.boxShadow !== 'none') ||
            ['Top', 'Right', 'Bottom', 'Left'].some(function (sd) { return parseFloat(ks['border' + sd + 'Width']) > 0 && ks['border' + sd + 'Style'] !== 'none' && (parseColor(ks['border' + sd + 'Color']) || [0, 0, 0, 0])[3] > 0.05; });
          if (painted) { mark(kr); continue; }
          walk(k);
        }
      })(c);
      var filled = 0; for (var g = 0; g < grid.length; g++) filled += grid[g];
      var ratio = filled / grid.length;
      if (ratio < 0.15) add('empty_region', c, { ratio: Math.round(ratio * 1000) / 1000, w: Math.round(cr.width), h: Math.round(cr.height) });
    });

    // 10. broken media: images that failed, lucide placeholders never replaced
    all.forEach(function (n) {
      if (n.tagName === 'IMG' && n.getAttribute('src')) {
        if (!n.complete) add('broken_media', n, { kind: 'img-timeout', src: n.getAttribute('src').slice(0, 120) });
        else if (!n.naturalWidth) add('broken_media', n, { kind: 'img-failed', src: n.getAttribute('src').slice(0, 120) });
      } else if (n.tagName === 'I' && n.hasAttribute('data-lucide')) {
        add('broken_media', n, { kind: 'icon-unknown', icon: n.getAttribute('data-lucide'), key: n.getAttribute('data-lucide') });
      }
    });

    // 11. orphaned: elements the hosted orphan pass appended at the bottom of the page.
    // dropped-by-parent = a parent lists it but its renderer never placed it (reported on the parent).
    var parentOf = {};
    Object.keys(SPEC.elements || {}).forEach(function (pid) {
      (function refs(v, depth) {
        if (depth > 6 || v == null) return;
        if (typeof v === 'string') { if (v !== pid && SPEC.elements[v] && !parentOf[v]) parentOf[v] = pid; return; }
        // trigger/target point at an overlay; they do not place it inside the element.
        if (typeof v === 'object') for (var key in v) if (Object.prototype.hasOwnProperty.call(v, key) && !/^(trigger|target|for|controls|id|opens)$/.test(key)) refs(v[key], depth + 1);
      })({ c: SPEC.elements[pid] && SPEC.elements[pid].children, p: SPEC.elements[pid] && SPEC.elements[pid].props }, 0);
    });
    ORPH.forEach(function (o) {
      var pid = parentOf[o.id];
      // The orphan pass is how the hosted page mounts overlays (Modal opened by a Button trigger): by design,
      // unless the overlay also got rendered somewhere else.
      if (OVERLAY_TYPES[TYPE[o.id]] && document.querySelectorAll('[data-spec-id="' + CSS.escape(o.id) + '"]').length < 2) return;
      var pnode = pid ? document.querySelector('[data-spec-id="' + CSS.escape(pid) + '"]') : null;
      // Child of an element that itself went through the orphan pass: rendered twice.
      if (document.querySelectorAll('[data-spec-id="' + CSS.escape(o.id) + '"]').length > 1) add('orphaned', o.node, { reason: 'duplicate-render', child: o.id + ':' + TYPE[o.id], key: o.id });
      else if (pid && pnode) add('orphaned', pnode, { reason: 'dropped-by-parent', child: o.id + ':' + TYPE[o.id], key: o.id });
      else add('orphaned', o.node && o.node.nodeType === 1 ? o.node : null, { reason: pid ? 'parent-not-rendered' : 'unreferenced', child: o.id + ':' + TYPE[o.id], key: o.id });
    });

    // 12. unknown_variant: a db-*--modifier class no daub.css rule mentions (db-btn--outline
    // renders as the chrome-less .db-btn base, db-grid--sidebar-main as one column).
    var known = cssClasses();
    all.forEach(function (n) {
      if (!n.classList || !n.classList.length || n.closest('.pg-custom-html')) return;
      for (var ci = 0; ci < n.classList.length; ci++) {
        var cl = n.classList[ci];
        // --md is the default size: no rule needed (db-btn--md renders like db-btn).
        if (MODIFIER.test(cl) && !known.has(cl) && !/--md$/.test(cl)) add('unknown_variant', n, { cls: cl, key: cl });
      }
    });

    // 13. touching_text: adjacent items of a flex row whose text runs sit < 2px apart
    // ("Remember meForgot password?"). overlap needs >4px² of intersection and misses it.
    function textBox(el) {
      var box = null, n = 0;
      var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), t;
      while ((t = tw.nextNode()) && n < 30) {
        if (!t.nodeValue.trim() || !t.parentElement || textHidden(t.parentElement)) continue;
        n++;
        range.selectNodeContents(t);
        var rr = range.getBoundingClientRect();
        if (rr.width < 1 || rr.height < 1) continue;
        box = box ? { left: Math.min(box.left, rr.left), right: Math.max(box.right, rr.right), top: Math.min(box.top, rr.top), bottom: Math.max(box.bottom, rr.bottom) } : { left: rr.left, right: rr.right, top: rr.top, bottom: rr.bottom };
      }
      return box;
    }
    all.forEach(function (p) {
      if (!shown(p)) return;
      var ps = st(p);
      if (!/flex/.test(ps.display) || /column/.test(ps.flexDirection)) return;
      if (JOINED.test(typeof p.className === 'string' ? p.className : '')) return;
      if (p.closest('.db-carousel')) return; // slides sit flush in a clipping track; one shows at a time
      var items = [];
      for (var c = p.firstElementChild; c && items.length < 40; c = c.nextElementSibling) {
        if (!isEl(c) || !shown(c)) continue;
        var cs = st(c);
        if (cs.position === 'absolute' || cs.position === 'fixed') continue;
        var tb = textBox(c);
        if (tb) items.push({ el: c, tb: tb });
      }
      for (var i = 0; i + 1 < items.length; i++) {
        var a = items[i].tb, b = items[i + 1].tb;
        var vo = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (vo < 0.5 * Math.min(a.bottom - a.top, b.bottom - b.top)) continue; // wrapped to another line
        var gap = ps.flexDirection === 'row-reverse' ? a.left - b.right : b.left - a.right;
        if (gap > -1 && gap < 2) { var wb = who(items[i + 1].el); add('touching_text', items[i].el, { gap: r1(gap), with: wb.id + ':' + wb.type + ' ' + wb.sel, container: short(p), key: wb.sel }); }
      }
    });

    // 14. dropped_content: a text prop (content, title, items[].primary ...) that appears
    // nowhere in the element's rendered text or attributes: the renderer ignored the prop.
    Object.keys(SPEC.elements || {}).forEach(function (id) {
      var def = SPEC.elements[id];
      if (!def || !def.props || def.type === 'CustomHTML') return;
      var node = document.querySelector('[data-spec-id="' + CSS.escape(id) + '"]');
      if (!node) return;
      var want = [];
      (function collect(obj, path, depth) {
        if (depth > 5 || !obj || typeof obj !== 'object') return; // props > sections[] > items[] > label
        for (var key in obj) {
          if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
          var v = obj[key];
          if (typeof v === 'string' && (TEXT_KEYS[key] || (Array.isArray(obj) && depth > 0))) {
            if (!SPEC.elements[v] && norm(v).length >= 3 && v.length < 300 && !/^(https?:|\/|#|data:)/.test(v)) want.push({ path: Array.isArray(obj) ? path + '[]' : (path ? path + '.' : '') + key, text: v });
          } else if (Array.isArray(v) && (LIST_KEYS[key] || Array.isArray(obj))) collect(v, (path ? path + '.' : '') + key, depth + 1);
          else if (Array.isArray(obj) && v && typeof v === 'object') collect(v, path + '[]', depth + 1);
        }
      })(def.props, '', 0);
      if (!want.length) return;
      var hay = node.textContent;
      [node].concat(Array.prototype.slice.call(node.querySelectorAll('*'), 0, 2000)).forEach(function (e) {
        for (var ai = 0; ai < e.attributes.length; ai++) { var at = e.attributes[ai]; if (!/^(class|style|id|data-spec-id|data-lucide|href|src|d|viewBox|points|fill|stroke|transform)$|^data-ds-/.test(at.name)) hay += ' ' + at.value; }
        if ((e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') && e.value) hay += ' ' + e.value;
      });
      hay = norm(hay);
      // HTML props (Prose content) render as markup: compare their text, not their tags.
      var miss = want.filter(function (w) { var t = norm(w.text.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ')); return t.length >= 3 && hay.indexOf(t) < 0; });
      if (!miss.length) return;
      var paths = Array.from(new Set(miss.map(function (m) { return m.path; })));
      add('dropped_content', node, { props: paths.join(','), missing: miss.length, of: want.length, text: miss[0].text.slice(0, 60), key: paths.join(',') });
    });

    var totals = {};
    for (var k in perCheck) totals[k] = perCheck[k];
    return { findings: findings, totals: totals, stats: { elements: all.length, texts: textNodes.length, vw: vw, vh: vh, scrollH: de.scrollHeight } };
  }

  // ---- render --------------------------------------------------------------------
  function reset() {
    Array.prototype.slice.call(document.body.children).forEach(function (n) { if (!SHELL.has(n)) n.remove(); });
    app.replaceChildren();
    document.body.removeAttribute('style');
    document.body.className = '';
    document.documentElement.removeAttribute('style');
    window.scrollTo(0, 0);
    logs.length = 0;
  }

  function openOverlay(o) {
    var el = document.querySelector('[data-spec-id="' + o.id + '"]');
    if (!el) return 'missing';
    var D = window.DAUB;
    switch (o.type) {
      case 'Modal': D.openModal(el.id); break;
      case 'Sheet': D.openSheet(el.id); break;
      case 'Drawer': D.openDrawer(el.id); break;
      case 'AlertDialog': D.openAlertDialog(el.id); break;
      case 'CommandPalette': D.openCommand(el.id); break;
      // Popover / dropdown / collapsible handlers in daub.js only toggle these classes.
      case 'Popover': el.classList.add('db-popover--open'); break;
      case 'DropdownMenu': el.classList.add('db-dropdown--open'); break;
      case 'Collapsible': el.classList.add('db-collapsible--open'); var t = el.querySelector('.db-collapsible__trigger'); if (t) t.setAttribute('aria-expanded', 'true'); break;
    }
    return 'ok';
  }

  function nextFrame() { return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); }); }
  function waitImages(ms) {
    var imgs = Array.prototype.filter.call(document.images, function (i) { return !i.complete; });
    if (!imgs.length) return Promise.resolve();
    return Promise.race([
      Promise.all(imgs.map(function (i) { return new Promise(function (r) { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }); })),
      new Promise(function (r) { setTimeout(r, ms); })
    ]);
  }

  async function render(job) {
    var t0 = performance.now();
    reset();
    document.documentElement.setAttribute('data-theme', job.theme);
    var spec = job.spec;
    TYPE = {};
    Object.keys(spec.elements || {}).forEach(function (k) { var d = spec.elements[k]; TYPE[k] = d && d.type; });
    // Same sequence as renderToHTML() in functions/api/mcp.js
    if (typeof renderElement !== 'function') throw new Error('renderElement missing (daub-render.js not loaded)');
    var root = renderElement(spec.elements, spec.root, 0);
    if (root) app.appendChild(root);
    var rendered = {};
    document.querySelectorAll('[data-spec-id]').forEach(function (n) { rendered[n.getAttribute('data-spec-id')] = true; });
    SPEC = spec; ORPH = [];
    Object.keys(spec.elements).forEach(function (id) {
      if (id !== spec.root && !rendered[id]) {
        var orphan = renderElement(spec.elements, id, 0);
        if (orphan) { app.appendChild(orphan); ORPH.push({ id: id, node: orphan }); }
      }
    });
    if (typeof DAUB !== 'undefined') DAUB.init();
    if (typeof lucide !== 'undefined') lucide.createIcons();
    var opened = (job.open || []).map(openOverlay);
    await waitImages(job.imageWaitMs || 1500);
    // Under heavy machine load stubbed images can lag; give stragglers one long grace
    // period so img-timeout means "never loaded", not "the box was busy".
    if (Array.prototype.some.call(document.images, function (i) { return !i.complete; })) await waitImages(5000);
    if (document.fonts && document.fonts.status !== 'loaded') await Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 500); })]);
    await nextFrame();
    var res = runChecks(job);
    res.stats.opened = opened;
    res.stats.ms = Math.round(performance.now() - t0);
    return res;
  }

  // Outline the finding elements and return document-space rects for a focused crop.
  // runChecks tags each finding element with data-combo-f, so the crop targets the
  // exact offending box (e.g. an offscreen popover panel, not the popover wrapper).
  function highlight() {
    var rects = [];
    Array.prototype.slice.call(document.querySelectorAll('[data-combo-f]'), 0, 4).forEach(function (el) {
      el.style.outline = '2px solid #ff00aa';
      el.style.outlineOffset = '1px';
      var r = el.getBoundingClientRect();
      rects.push({ x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height });
    });
    return { rects: rects, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight };
  }

  window.__combo = { render: render, highlight: highlight, ready: true };
})();
