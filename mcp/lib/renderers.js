    var MAX_DEPTH = 20;
    var RENDERING = Object.create(null); // element ids on the current render path (see specRef)

    // Safe HTML-entity escaping via textContent
    function esc(s) {
      if (s == null) return '';
      var d = document.createElement('span');
      d.textContent = String(s);
      return d.innerHTML;
    }
    
    // Sanitize HTML: allowlisted tags/attrs, strip event handlers & javascript: URIs
    var _sanitizeTags = 'p,strong,em,b,i,u,br,a,ul,ol,li,h1,h2,h3,h4,h5,h6,blockquote,pre,code,span,div,hr,mark,small,del,table,thead,tbody,tr,th,td,img'.split(',');
    var _sanitizeAttrs = { a: ['href','title'], img: ['src','alt','width','height'], td: ['colspan','rowspan'], th: ['colspan','rowspan'], ol: ['start','type'], '*': ['class'] };
    function sanitizeHtml(html) {
      if (!html) return '';
      var doc = new DOMParser().parseFromString(html, 'text/html');
      function walk(node) {
        var out = '';
        for (var i = 0; i < node.childNodes.length; i++) {
          var n = node.childNodes[i];
          if (n.nodeType === 3) { out += esc(n.textContent); continue; }
          if (n.nodeType !== 1) continue;
          var tag = n.tagName.toLowerCase();
          if (_sanitizeTags.indexOf(tag) < 0) { out += walk(n); continue; }
          var allowed = (_sanitizeAttrs[tag] || []).concat(_sanitizeAttrs['*'] || []);
          var attrs = '';
          for (var j = 0; j < n.attributes.length; j++) {
            var a = n.attributes[j], aname = a.name.toLowerCase();
            if (aname.indexOf('on') === 0) continue;
            if (allowed.indexOf(aname) < 0) continue;
            var v = a.value;
            if ((aname === 'href' || aname === 'src') && /^javascript:/i.test(v.replace(/[\u0000- ]/g, ''))) continue;
            attrs += ' ' + aname + '="' + esc(v) + '"';
          }
          if (tag === 'a') attrs += ' rel="noopener" target="_blank"';
          if (tag === 'br' || tag === 'hr' || tag === 'img') { out += '<' + tag + attrs + '>'; }
          else { out += '<' + tag + attrs + '>' + walk(n) + '</' + tag + '>'; }
        }
        return out;
      }
      return walk(doc.body);
    }
    
    function iconHtml(name, size) {
      if (!name) return '';
      return '<i data-lucide="' + esc(name) + '" style="width:' + (size||16) + 'px;height:' + (size||16) + 'px;"></i>';
    }
    
    // Helper: create element and set safe text/attributes
    function mkEl(tag, cls, text) {
      var el = document.createElement(tag);
      if (cls) el.className = cls;
      if (text != null) el.textContent = text;
      return el;
    }

    // Icon names models borrow from other icon sets -> the lucide 0.576 name
    var ICON_ALIASES = {
      refresh: 'refresh-cw', reload: 'refresh-cw', sync: 'refresh-cw', rotate: 'rotate-cw', replay: 'rotate-ccw',
      chart: 'chart-bar', stats: 'chart-bar', analytics: 'chart-line', dashboard: 'layout-dashboard',
      alert: 'circle-alert', error: 'circle-alert', warning: 'triangle-alert', success: 'circle-check', help: 'circle-help', question: 'circle-help',
      close: 'x', cancel: 'circle-x', add: 'plus', more: 'ellipsis', sort: 'arrow-up-down', gear: 'settings',
      cart: 'shopping-cart', bag: 'shopping-bag', dollar: 'dollar-sign', money: 'banknote', cash: 'banknote', payment: 'credit-card', ethereum: 'coins',
      email: 'mail', message: 'message-square', chat: 'message-square', comment: 'message-square', notification: 'bell', notifications: 'bell',
      profile: 'user', account: 'user', person: 'user', people: 'users', team: 'users', visitors: 'users', bounce: 'undo-2',
      location: 'map-pin', document: 'file-text', doc: 'file-text', draft: 'file-pen', log: 'logs', flask: 'flask-conical',
      time: 'clock', schedule: 'calendar', event: 'calendar', date: 'calendar', logout: 'log-out', login: 'log-in',
      favorite: 'heart', like: 'thumbs-up', visibility: 'eye', back: 'arrow-left', previous: 'arrow-left', prev: 'arrow-left', next: 'arrow-right'
    };

    // Same PascalCase key lucide.createIcons() derives from data-lucide
    function lucideKey(n) {
      var c = n.replace(/^([A-Z])|[\s-_]+(\w)/g, function(m, a, b) { return b ? b.toUpperCase() : a.toLowerCase(); });
      return c.charAt(0).toUpperCase() + c.slice(1);
    }

    // Icon element for a spec icon name. Aliases map to lucide, "google" is an inline G in lucide's stroke style,
    // an emoji or symbol renders as text, and a name the loaded lucide build lacks (in any case) returns null (no empty slot)
    function mkIcon(name, size) {
      name = typeof name === 'string' ? name.trim() : '';
      if (!name) return null;
      var px = (size || 16) + 'px', key = name.toLowerCase(), el;
      if (!/[a-z]/.test(key)) {
        el = mkEl('span', null, name);
        el.setAttribute('aria-hidden', 'true');
        el.style.fontSize = px;
        el.style.lineHeight = '1';
        return el;
      }
      if (key === 'google') {
        var ns = 'http://www.w3.org/2000/svg', path = document.createElementNS(ns, 'path');
        el = document.createElementNS(ns, 'svg');
        var at = { 'class': 'lucide lucide-google', width: size || 16, height: size || 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
          'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' };
        for (var k in at) el.setAttribute(k, at[k]);
        path.setAttribute('d', 'M18.4 5.6A9 9 0 1 0 21 12h-9');
        el.appendChild(path);
        return el;
      }
      if (Object.prototype.hasOwnProperty.call(ICON_ALIASES, key)) name = ICON_ALIASES[key];
      var lib = typeof lucide !== 'undefined' && lucide.icons;
      if (lib && !lib[lucideKey(name)]) {
        if (!lib[lucideKey(key)]) return null;
        name = key; // "GitHub" -> "github": lucide names are lowercase
      }
      el = document.createElement('i');
      el.setAttribute('data-lucide', name);
      el.style.width = px;
      el.style.height = px;
      return el;
    }
    
    // Map a variant-like prop onto a modifier daub.css defines (aliases first); any other value -> '' so no dead class ships
    function knownMod(v, known, alias) {
      if (v == null || v === false || v === '') return '';
      var k = String(v).trim().toLowerCase();
      if (alias && Object.prototype.hasOwnProperty.call(alias, k)) k = alias[k];
      return known.indexOf(k) >= 0 ? k : '';
    }

    // Guard against javascript: and data: URLs from AI-generated content
    function isSafeUrl(url) {
      if (!url || typeof url !== 'string') return false;
      var trimmed = url.replace(/[\u0000- ]/g, '').toLowerCase();
      if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) return false;
      return true;
    }

    // Cross-realm safe plain-object test (specs may come from a parent frame)
    function isPlain(v) {
      return Object.prototype.toString.call(v) === '[object Object]';
    }

    // Coerce a list-like prop to an array: {items|data|rows|options|list: [...]} unwraps, a keyed object of objects -> its values,
    // a string/number/boolean -> [value], anything else -> []
    function toArr(v) {
      if (Array.isArray(v)) return v;
      if (v == null) return [];
      if (isPlain(v)) {
        var wrap = ['items', 'data', 'rows', 'options', 'list'];
        for (var i = 0; i < wrap.length; i++) {
          if (Array.isArray(v[wrap[i]])) return v[wrap[i]];
        }
        var ks = Object.keys(v);
        return ks.every(function(k) { return isPlain(v[k]); }) ? ks.map(function(k) { return v[k]; }) : [];
      }
      var t = typeof v;
      return t === 'string' || t === 'number' || t === 'boolean' ? [v] : [];
    }

    // Option lists: a bare "Small" or 3 -> {label: "Small", value: "Small"}
    function toOpts(v) {
      return toArr(v).map(function(o) {
        return typeof o === 'string' || typeof o === 'number' ? { label: String(o), value: String(o) } : o;
      });
    }

    // footer: [childIds] keeps only ids present in els ("Cancel | Save" is text, not a ref); none left = no footer
    function footerRefs(v, els) {
      // One nested level flattens: footer: [cardFooter] with cardFooter = [buyBtn] arrives as [["buyBtn"]]
      return [].concat.apply([], toArr(v)).filter(function(id) { return typeof id === 'string' && !!els && Object.prototype.hasOwnProperty.call(els, id); });
    }

    // A data entry that names a spec element: OpenUI hoists inline components (Breadcrumbs([Text(..)]), Table([[Text(..)]]))
    // to element ids. An id some element lists as a child stays text, so a cell that equals an id is not pulled out of its parent.
    // So does an id on the current render path: a cell naming the root ("home") must not nest the page inside itself
    function specRef(v, els) {
      if (typeof v !== 'string' || !els || !Object.prototype.hasOwnProperty.call(els, v) || RENDERING[v]) return null;
      for (var k in els) {
        var e = els[k], c = e && (e.children || (e.props && e.props.children));
        if (Array.isArray(c) && c.indexOf(v) >= 0) return null;
      }
      return v;
    }

    // Entries of a list-like renderer: its data items ({ref} for spec elements, else {data}), or its child elements when it has none
    function entries(items, ch, els) {
      items = toArr(items);
      if (!items.length) return toArr(ch).map(function(id) { return { ref: id }; });
      return items.map(function(v) { var id = specRef(v, els); return id ? { ref: id } : { data: v }; });
    }

    // Number from a number or formatted string ("$1,200", "42%"); 0 when unparseable, so bar heights never go NaN%
    function toNum(v) {
      var n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
      return isFinite(n) ? n : 0;
    }

    // Kbd keys: "Ctrl+K" -> ["Ctrl", "K"], "\u2318K" -> ["\u2318K"]
    function kbdKeys(v) {
      if (typeof v !== 'string') return toArr(v);
      var parts = v.split('+').map(function(s) { return s.trim(); }).filter(Boolean);
      return parts.length ? parts : [v];
    }

    // Renderable text: a non-empty string or a number ($state/$cond objects resolve later in the iframe)
    function isText(v) {
      return (typeof v === 'string' && v !== '') || typeof v === 'number';
    }

    function withProp(o, key, v) {
      var c = {};
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = o[k];
      c[key] = v;
      return c;
    }

    // Fill an empty slot from the first alias that holds text; returns a copy, never touches the spec
    function fillAlias(o, key, names) {
      if (o[key] != null && o[key] !== '') return o;
      for (var i = 0; i < names.length; i++) {
        if (isText(o[names[i]])) return withProp(o, key, o[names[i]]);
      }
      return o;
    }

    // Image-URL shape: http(s), protocol-relative, a path, blob:, or a filename with an image extension ("sm" and "Jordan Diaz" are not)
    function isImgUrl(s) {
      return typeof s === 'string' && /^((https?:)?\/\/|\.{0,2}\/|blob:)|^\S+\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(s.trim());
    }

    // AI-written prop names -> the names the renderers read (Badge label -> text, List items[].primary -> title)
    function normalizeProps(type, p) {
      var items, on, tv, q, slid, signed;
      switch (type) {
        case 'Badge':
        case 'Label':
          return fillAlias(p, 'text', ['label', 'content']);
        case 'Alert':
          p = fillAlias(p, 'message', ['description', 'content', 'text']);
          return /^(info|success|warning|error)$/.test(p.variant) ? fillAlias(p, 'type', ['variant']) : p;
        case 'EmptyState':
          return fillAlias(p, 'message', ['description', 'text']);
        case 'StatCard':
          p = fillAlias(p, 'label', ['title']);
          tv = p.trendValue;
          // trend "neutral"/"flat": no direction word, the value shows uncoloured
          if (/^(neutral|flat)$/.test(p.trend)) return withProp(withProp(p, 'trend', isText(tv) ? String(tv) : null), 'trendValue', null);
          // StatCard("Keys", "14", "key-round", "up", "+2") / StatCard("Support", "24/7", "headset", "Replies in 2 min"): a Lucide name in the trend slot
          if (typeof p.trend !== 'string' || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(p.trend) || /^(up|down)$/.test(p.trend) || !mkIcon(p.trend)) return p;
          slid = /^(up|down)$/.test(tv);
          signed = typeof tv === 'string' && /^[+\u2191\-\u2212\u2193]/.test(tv);
          q = withProp(withProp(withProp(p, 'icon', p.trend), 'trend', slid || signed ? tv : null), 'trendValue', slid && isText(p.icon) && p.icon !== p.trend ? p.icon : null);
          return slid || signed || !isText(tv) || isText(q.description) ? q : withProp(q, 'description', tv);
        case 'Switch':
        case 'Checkbox':
          // Switch(true): a boolean in the label slot is the checked state, not text
          return typeof p.label === 'boolean' && p.checked == null ? withProp(withProp(p, 'checked', p.label), 'label', '') : p;
        case 'CustomSelect':
          // CustomSelect("Language", opts, "de"): a string in the searchable slot is the selection
          if (typeof p.searchable === 'string' && !/^(true|false)$/.test(p.searchable)) p = withProp(fillAlias(p, 'selected', ['searchable']), 'searchable', false);
          // A top-level selected (as Select and RadioGroup take it) marks the matching option; a label is the placeholder
          p = fillAlias(fillAlias(p, 'selected', ['value', 'defaultValue']), 'placeholder', ['label']);
          items = toOpts(p.options);
          if (!isText(p.selected) || items.some(function(o) { return o && o.selected; })) return p;
          return withProp(p, 'options', items.map(function(o) { return isPlain(o) && (String(o.value) === String(p.selected) || o.label === p.selected) ? withProp(o, 'selected', true) : o; }));
        case 'Avatar':
          // src holds only an image URL: Avatar("MC", "sm") is a size, Avatar("JD", "Jordan Diaz") a name, Avatar(url, "Name") swapped args
          if (isImgUrl(p.initials) && !isImgUrl(p.src)) p = withProp(withProp(p, 'src', p.initials), 'initials', '');
          if (typeof p.src !== 'string' || !p.src || isImgUrl(p.src)) return p;
          if (p.size == null && /^(xs|sm|md|lg|xl|2xl)$/i.test(p.src)) p = withProp(p, 'size', p.src);
          return withProp(p, 'src', '');
        case 'List':
          if (p.items == null) return p;
          return withProp(p, 'items', toArr(p.items).map(function(it) {
            return isPlain(it) ? fillAlias(fillAlias(it, 'title', ['primary', 'label', 'text']), 'secondary', ['description', 'subtitle']) : it;
          }));
        case 'ToggleGroup':
          p = fillAlias(p, 'selected', ['defaultValue', 'value']);
          if (p.options != null || p.items == null) return p;
          // Valueless items would all match an unset selected and render pressed; the item marked active is the selection
          items = toArr(p.items).map(function(o) { return isPlain(o) ? fillAlias(o, 'value', ['id', 'label']) : o; });
          p = withProp(p, 'options', items);
          on = items.filter(function(o) { return o && o.active === true; })[0];
          return p.selected == null && on ? withProp(p, 'selected', on.value) : p;
        case 'Tabs':
          // Tabs(tabs: ["All", "Done"]): a bare string tab is its own label and id
          items = toArr(p.tabs != null ? p.tabs : p.items);
          if (items.some(isText)) p = withProp(p, p.tabs != null ? 'tabs' : 'items', items.map(function(t) { return isText(t) ? { label: String(t), id: String(t) } : t; }));
          if (p.tabs != null || p.items == null) return p;
          items = toArr(p.items).map(function(t) { return isPlain(t) ? fillAlias(t, 'id', ['value']) : t; });
          p = withProp(p, 'tabs', items);
          on = items.filter(function(t) { return t && t.active === true; })[0];
          return p.active == null && on ? withProp(p, 'active', on.id) : p;
      }
      return p;
    }

    // Visible label above a control whose markup has no label slot (Input, Progress, RadioGroup, ToggleGroup).
    // fill: the control is width:100%, so the wrapper takes its place in a row the same way.
    function withLabel(el, text, fill) {
      if (!isText(text)) return el;
      var wrap = mkEl('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:var(--db-space-2);' + (fill ? 'width:100%;' : 'align-items:flex-start;');
      var lbl = mkEl(el.tagName === 'INPUT' ? 'label' : 'span', 'db-label', String(text));
      if (el.tagName === 'INPUT') {
        el.id = 'db-input-' + Math.random().toString(36).slice(2, 8);
        lbl.htmlFor = el.id;
      }
      wrap.appendChild(lbl);
      wrap.appendChild(el);
      return wrap;
    }

    // Chart bars from [{label, value}] or chart.js-style {labels, data} / {labels, datasets: [{data}]} / {type, data, labels}
    function chartBars(p) {
      var src = p.bars != null ? p.bars : (p.data != null || p.datasets != null ? p : null);
      if (src && typeof src === 'object' && !Array.isArray(src) && (src.data != null || src.datasets != null)) {
        var ds = toArr(src.datasets)[0];
        var labels = toArr(src.labels);
        src = toArr(src.data != null ? src.data : ds && ds.data).map(function(v, i) {
          return v && typeof v === 'object' ? { label: v.label != null ? v.label : labels[i], value: v.value, max: v.max } : { label: labels[i], value: v };
        });
      }
      return toArr(src).map(function(b) { return b && typeof b === 'object' ? b : { value: b }; });
    }

    // Table/DataTable: unwrap one {columns, rows} object, string columns -> {key, label}, array rows -> objects keyed by column
    function tableShape(p) {
      var cols = p.columns, rows = p.rows;
      if (cols && typeof cols === 'object' && !Array.isArray(cols) && (cols.columns != null || cols.rows != null)) {
        if (rows == null) rows = cols.rows;
        cols = cols.columns;
      }
      // A scalar ("Name, Email", 3) is not a column/row list: render none rather than one bogus column/row
      if (cols != null && typeof cols !== 'object') cols = [];
      if (rows != null && typeof rows !== 'object') rows = [];
      rows = toArr(rows);
      // Column map {name: 'Name', email: 'Email'} -> [{key: 'name', label: 'Name'}, ...]
      if (isPlain(cols) && Object.keys(cols).length && Object.keys(cols).every(function(k) { return typeof cols[k] === 'string'; })) {
        cols = Object.keys(cols).map(function(k) { return { key: k, label: cols[k] }; });
      }
      cols = toArr(cols).map(function(c, i) {
        if (c && typeof c === 'object') return c;
        var s = c == null ? '' : String(c);
        // Key by the label when a row object has it, else by its slug ("Unit Price" -> unit_price)
        var own = rows.some(function(r) { return isPlain(r) && Object.prototype.hasOwnProperty.call(r, s); });
        return { key: own ? s : (s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'c' + i), label: s };
      });
      rows = rows.map(function(r) {
        if (!Array.isArray(r)) return r && typeof r === 'object' ? r : {};
        var o = {};
        cols.forEach(function(c, i) { o[c.key] = r[i]; });
        return o;
      });
      return { cols: cols, rows: rows };
    }

    // Table/DataTable: a scroll box, so a wide table scrolls inside its column instead of widening the page or a grid cell
    function tableScroll(table) {
      var wrap = mkEl('div', 'db-table-scroll');
      wrap.appendChild(table);
      return wrap;
    }

    // Row-action verbs a model packs into one "Actions" cell ("copy,revoke", "Copy \u00b7 Revoke", "\u22ef") -> the icon each renders as
    var ACTION_ICONS = { copy: 'copy', revoke: 'ban', 'delete': 'trash-2', remove: 'trash-2', edit: 'pencil', view: 'eye', open: 'external-link',
      download: 'download', share: 'share-2', archive: 'archive', rotate: 'refresh-cw', menu: 'ellipsis', more: 'ellipsis', '\u22ef': 'ellipsis', '\u2026': 'ellipsis', '...': 'ellipsis' };

    // An "Actions" column cell made only of action verbs -> ghost icon buttons; anything else stays text (null)
    function actionCell(c, v) {
      if (typeof v !== 'string' || !(/^actions?$/i.test(c.key || '') || /^actions?$/i.test(c.label || ''))) return null;
      var names = v.split(/\s*[,\u00b7|\/]\s*/).filter(Boolean);
      if (!names.length || !names.every(function(n) { return Object.prototype.hasOwnProperty.call(ACTION_ICONS, n.toLowerCase()); })) return null;
      var box = mkEl('div');
      box.style.cssText = 'display:inline-flex;align-items:center;gap:var(--db-space-1)';
      names.forEach(function(n) {
        var b = RENDERERS.Button({ variant: 'ghost', size: 'icon', icon: ACTION_ICONS[n.toLowerCase()] });
        b.setAttribute('aria-label', n);
        box.appendChild(b);
      });
      return box;
    }

    // A cell that names spec elements: one id, or a list of ids (row actions: [Button(..), Button(..)]); null when any entry is data
    function cellRefs(v, els) {
      var ids = toArr(v).map(function(x) { return specRef(x, els); });
      return ids.length && ids.every(Boolean) ? ids : null;
    }

    // Several elements in one cell sit in a row
    function cellElements(els, ids, d) {
      if (ids.length === 1) return renderChildren(els, ids, d);
      var box = mkEl('div');
      box.style.cssText = 'display:inline-flex;align-items:center;gap:var(--db-space-1)';
      box.appendChild(renderChildren(els, ids, d));
      return box;
    }
    
    // ---- Declarative State Engine ----
    // Shared between main page (renderElement) and iframe (runtime).
    // The iframe gets a copy of this code injected via buildIframeSrcdoc().
    
    // State store: simple JSON pointer-based reactive store
    function createStateStore(initial) {
      var _state = initial || {};
      var _subs = [];
      function _get(path) {
        if (!path || path === '/') return _state;
        var parts = path.replace(/^\//, '').split('/');
        var v = _state;
        for (var i = 0; i < parts.length; i++) {
          if (v == null) return undefined;
          v = v[parts[i]];
        }
        return v;
      }
      function _set(path, value) {
        if (!path || path === '/') { _state = value; _notify(path); return; }
        var parts = path.replace(/^\//, '').split('/');
        var obj = _state;
        for (var i = 0; i < parts.length - 1; i++) {
          if (obj[parts[i]] == null) obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
        _notify(path);
      }
      function _push(path, value) {
        var arr = _get(path);
        if (!Array.isArray(arr)) { arr = []; _set(path, arr); }
        arr.push(value);
        _notify(path);
      }
      function _remove(path) {
        if (!path || path === '/') { _state = {}; _notify(path); return; }
        var parts = path.replace(/^\//, '').split('/');
        var obj = _state;
        for (var i = 0; i < parts.length - 1; i++) {
          if (obj[parts[i]] == null) return;
          obj = obj[parts[i]];
        }
        delete obj[parts[parts.length - 1]];
        _notify(path);
      }
      function _toggle(path) {
        _set(path, !_get(path));
      }
      function _notify(path) {
        for (var i = 0; i < _subs.length; i++) _subs[i](path);
      }
      return { get: _get, set: _set, push: _push, remove: _remove, toggle: _toggle, subscribe: function(fn) { _subs.push(fn); }, getAll: function() { return _state; } };
    }
    
    // Resolve $-expressions against state store
    function resolveExpr(expr, store) {
      if (expr == null || typeof expr !== 'object') return expr;
      // $state: read value from state
      if (expr['$state'] != null) {
        var val = store.get(expr['$state']);
        if (expr.eq != null) return val === expr.eq;
        if (expr.neq != null) return val !== expr.neq;
        return val;
      }
      // $cond: conditional expression
      if (expr['$cond'] != null) {
        var cond = resolveExpr(expr['$cond'], store);
        return cond ? resolveExpr(expr['$then'], store) : resolveExpr(expr['$else'], store);
      }
      // $template: string template with ${/path} interpolation
      if (expr['$template'] != null) {
        return String(expr['$template']).replace(/\$\{([^}]+)\}/g, function(_, path) {
          var v = store.get(path);
          return v != null ? String(v) : '';
        });
      }
      return expr;
    }
    
    // Resolve all props that may contain $-expressions
    function resolveProps(props, store) {
      if (!props || !store) return props;
      var resolved = {};
      var keys = Object.keys(props);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = props[k];
        if (v && typeof v === 'object' && !Array.isArray(v) && (v['$state'] != null || v['$cond'] != null || v['$template'] != null)) {
          resolved[k] = resolveExpr(v, store);
        } else {
          resolved[k] = v;
        }
      }
      return resolved;
    }
    
    // Dispatch an action from an "on" handler
    function dispatchAction(action, store, event) {
      if (!action) return;
      var p = action.params || {};
      switch (action.action) {
        case 'setState':
          store.set(p.path, p.value != null ? p.value : (event && event.target ? event.target.value : undefined));
          break;
        case 'toggleState':
          store.toggle(p.path);
          break;
        case 'pushState':
          store.push(p.path, p.value);
          break;
        case 'removeState':
          store.remove(p.path);
          break;
      }
    }
    
    // Collect declarative state actions and initial state from spec
    function collectStateConfig(spec) {
      var config = { initialState: {}, bindings: [], actions: [] };
      if (!spec || !spec.elements) return config;
      if (spec.state) config.initialState = spec.state;
      Object.keys(spec.elements).forEach(function(id) {
        var def = spec.elements[id];
        // Collect $bindState props
        if (def.props) {
          Object.keys(def.props).forEach(function(prop) {
            var v = def.props[prop];
            if (v && typeof v === 'object' && v['$bindState'] != null) {
              config.bindings.push({ id: id, prop: prop, path: v['$bindState'] });
            }
          });
        }
        // Collect "on" handlers
        if (def.on) {
          Object.keys(def.on).forEach(function(evt) {
            config.actions.push({ id: id, event: evt, action: def.on[evt] });
          });
        }
      });
      return config;
    }
    
    // ---- Component Renderers (67 types) ----

    function renderElement(elements, id, depth) {
      if (depth > MAX_DEPTH) return document.createTextNode('[max depth]');
      var def = elements[id];
      if (!def) return null;
      if (RENDERING[id]) return null; // cycle: an element listed inside itself (or a descendant)
    
      // Encode visible expression as data attribute for iframe-side evaluation
      if (def.visible != null) {
        // At render time, serialize the visibility expression for the iframe state engine
        // The iframe will evaluate this and toggle display
      }
    
      var render = RENDERERS[def.type];
      if (!render) {
        var el = document.createElement('div');
        el.className = 'db-alert db-alert--warning';
        var content = document.createElement('div');
        content.className = 'db-alert__content';
        var title = document.createElement('div');
        title.className = 'db-alert__title';
        title.textContent = 'Unknown: ' + def.type;
        content.appendChild(title);
        el.appendChild(content);
        el.setAttribute('data-spec-id', id); // so the orphan pass does not render it a second time
        return el;
      }
    
      var children = toArr(def.children || (def.props && def.props.children));
      var el;
      RENDERING[id] = (RENDERING[id] || 0) + 1;
      try {
        el = render(normalizeProps(def.type, def.props || {}), children, elements, depth);
      } catch (err) {
        // One bad element must not blank the page: inline notice here, siblings keep rendering
        var msg = String(err && err.message || err);
        if (typeof console !== 'undefined') console.warn('[daub-render] ' + def.type + ' "' + id + '": ' + msg);
        el = mkEl('div', 'db-alert db-alert--warning');
        el.setAttribute('data-render-error', msg);
        var errContent = mkEl('div', 'db-alert__content');
        errContent.appendChild(mkEl('div', 'db-alert__title', "Couldn't render " + def.type));
        el.appendChild(errContent);
      } finally {
        RENDERING[id]--;
      }
      if (el && el.setAttribute) {
        el.setAttribute('data-spec-id', id);
        // Encode declarative state metadata as data attributes for iframe runtime
        if (def.visible != null) {
          el.setAttribute('data-ds-visible', JSON.stringify(def.visible));
        }
        if (def.on) {
          el.setAttribute('data-ds-on', JSON.stringify(def.on));
        }
        if (def.props) {
          // Mark $bindState and $state props for iframe-side resolution
          var stateProps = {};
          var hasStateProps = false;
          Object.keys(def.props).forEach(function(k) {
            var v = def.props[k];
            if (v && typeof v === 'object' && (v['$state'] != null || v['$bindState'] != null || v['$cond'] != null || v['$template'] != null)) {
              stateProps[k] = v;
              hasStateProps = true;
            }
          });
          if (hasStateProps) {
            el.setAttribute('data-ds-props', JSON.stringify(stateProps));
          }
        }
      }
      return el;
    }
    
    function renderChildren(elements, childIds, depth) {
      var frag = document.createDocumentFragment();
      toArr(childIds).forEach(function(id) {
        var el = renderElement(elements, id, depth + 1);
        if (el) frag.appendChild(el);
      });
      return frag;
    }

    // Parent of each element some other element references (a children entry or a prop holding its id; trigger-like
    // props excluded), for the orphan pass
    function orphanParents(els) {
      var parentOf = {};
      Object.keys(els).forEach(function(pid) {
        (function refs(v, depth) {
          if (v == null || depth > 6) return;
          if (typeof v === 'string') { if (v !== pid && Object.prototype.hasOwnProperty.call(els, v) && !parentOf[v]) parentOf[v] = pid; return; }
          if (typeof v === 'object') for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k) && !/^(trigger|target|for|controls|id|opens)$/.test(k)) refs(v[k], depth + 1);
        })({ c: els[pid] && els[pid].children, p: els[pid] && els[pid].props }, 0);
      });
      return parentOf;
    }

    // Append what the root tree did not place (overlays opened by a trigger, unreferenced statements) to container.
    // Each one renders through its top-most unplaced ancestor, so a Modal's inline children render inside the Modal
    // instead of first standing alone and then again inside it. Returns [{id, node}] for each appended element
    function renderOrphans(spec, container) {
      var els = spec.elements, rendered = {}, out = [];
      container.querySelectorAll('[data-spec-id]').forEach(function(n) { rendered[n.getAttribute('data-spec-id')] = true; });
      var parentOf = orphanParents(els);
      Object.keys(els).forEach(function(id) {
        var top = id, hops = 0;
        while (parentOf[top] && !rendered[parentOf[top]] && hops++ < 50) top = parentOf[top];
        [top, id].forEach(function(oid) {
          if (oid === spec.root || rendered[oid]) return;
          rendered[oid] = true;
          var node = renderElement(els, oid, 0);
          if (!node) return;
          container.appendChild(node);
          out.push({ id: oid, node: node });
          if (node.querySelectorAll) node.querySelectorAll('[data-spec-id]').forEach(function(n) { rendered[n.getAttribute('data-spec-id')] = true; });
        });
      });
      return out;
    }

    var RENDERERS = {};
    
    // A Checkbox or Switch whose label repeats text beside it (Stack([Text("Email alerts"), Switch("Email alerts", true)])):
    // the row shows the name once, and the control keeps it as its accessible name
    function dedupeControlLabels(row) {
      var kids = [].slice.call(row.children), seen = {};
      var isCtl = function(k) { return k.classList && (k.classList.contains('db-checkbox') || k.classList.contains('db-switch')); };
      kids.forEach(function(k) {
        if (isCtl(k)) return;
        [k].concat([].slice.call(k.querySelectorAll('h1,h2,h3,h4,p,span,label'))).forEach(function(n) {
          var t = n.textContent.trim().toLowerCase();
          if (t) seen[t] = true;
        });
      });
      kids.forEach(function(k) {
        if (!isCtl(k)) return;
        var last = k.lastChild, t = last && last.nodeType === 3 ? last.nodeValue.trim() : '';
        if (!t || !seen[t.toLowerCase()]) return;
        k.removeChild(last);
        (k.querySelector('input') || k).setAttribute('aria-label', t);
      });
    }

    // -- Stack (flexbox) --
    RENDERERS.Stack = function(p, ch, els, d) {
      var el = document.createElement('div');
      if (p.container) {
        el.className = 'db-container' + (p.container === 'wide' ? ' db-container--wide' : p.container === 'narrow' ? ' db-container--narrow' : '');
      }
      var isH = p.direction === 'horizontal';
      el.style.display = 'flex';
      el.style.flexDirection = isH ? 'row' : 'column';
      el.style.gap = 'var(--db-space-' + Math.max(0, Math.min(6, p.gap != null ? p.gap : 2)) + ')';
      if (isH && p.wrap !== false) el.style.flexWrap = 'wrap';
      if (p.justify === 'center') el.style.justifyContent = 'center';
      else if (p.justify === 'end') el.style.justifyContent = 'flex-end';
      else if (p.justify === 'between') el.style.justifyContent = 'space-between';
      else if (p.justify === 'evenly') el.style.justifyContent = 'space-evenly';
      if (p.align === 'center') el.style.alignItems = 'center';
      else if (p.align === 'end') el.style.alignItems = 'flex-end';
      else if (p.align === 'start') el.style.alignItems = 'flex-start';
      else if (p.align === 'stretch') el.style.alignItems = 'stretch';
      el.appendChild(renderChildren(els, ch, d));
      dedupeControlLabels(el);
      // Sidebar rows: give the content a flex basis so it sits beside the sidebar instead of wrapping below it (still wraps on narrow screens)
      if (isH && Array.isArray(ch) && ch.some(function(id) { return els[id] && els[id].type === 'Sidebar'; })) {
        for (var si = 0; si < el.children.length; si++) {
          var sc = el.children[si], sid = sc.getAttribute('data-spec-id');
          if (sid && els[sid] && els[sid].type === 'Sidebar') sc.style.flex = '0 0 auto';
          else { sc.style.flex = '1 1 480px'; sc.style.minWidth = '0'; }
        }
      }
      return el;
    };
    
    // -- Grid (CSS grid) --
    RENDERERS.Grid = function(p, ch, els, d) {
      var el = document.createElement('div');
      if (p.container) {
        el.className = 'db-container' + (p.container === 'wide' ? ' db-container--wide' : p.container === 'narrow' ? ' db-container--narrow' : '');
      }
      // columns 2-6 map to db-grid--N; 7-12 (week calendars) get an inline template; 1 or junk stays one column
      var cols = parseInt(p.columns || 2, 10);
      el.classList.add('db-grid');
      if (p.columns === 'sidebar-main') el.classList.add('db-grid--sidebar-main');
      else if (cols >= 2 && cols <= 6) el.classList.add('db-grid--' + cols);
      else if (cols > 6) el.style.gridTemplateColumns = 'repeat(' + Math.min(cols, 12) + ', minmax(0, 1fr))';
      if (p.gap) el.classList.add('db-gap-' + Math.max(1, Math.min(6, p.gap)));
      if (p.align === 'center') el.style.justifyItems = 'center';
      else if (p.align === 'end') el.style.justifyItems = 'end';
      el.appendChild(renderChildren(els, ch, d));
      return el;
    };
    
    // -- Layout (deprecated, maps to Stack/Grid) --
    RENDERERS.Layout = function(p, ch, els, d) {
      if (p.columns) return RENDERERS.Grid(p, ch, els, d);
      var mapped = {justify: p.align, align: p.valign};
      for (var k in p) { if (k !== 'align' && k !== 'valign') mapped[k] = p[k]; }
      return RENDERERS.Stack(mapped, ch, els, d);
    };
    
    // -- Surface --
    RENDERERS.Surface = function(p, ch, els, d) {
      var el = document.createElement('div');
      var sv = knownMod(p.variant, ['raised', 'inset', 'pressed'], { bordered: 'raised', card: 'raised', elevated: 'raised', sunken: 'inset' });
      el.className = 'db-surface' + (sv ? ' db-surface--' + sv : '');
      el.style.padding = 'var(--db-space-4, 16px)';
      el.style.borderRadius = 'var(--db-radius-2, 8px)';
      el.appendChild(renderChildren(els, ch, d));
      return el;
    };
    
    // -- Text --
    RENDERERS.Text = function(p) {
      var validTags = ['h1','h2','h3','h4','p','span'];
      var t = p.tag, c = p.content;
      if (validTags.indexOf(t) < 0 && validTags.indexOf(c) >= 0) { t = c; c = p.tag; }
      if (validTags.indexOf(c) >= 0 && c === t) { c = ''; }
      var tag = validTags.indexOf(t) >= 0 ? t : 'p';
      var el = document.createElement(tag);
      var classMap = { h1:'db-h1', h2:'db-h2', h3:'db-h3', h4:'db-h4', p:'db-body', span:'' };
      el.className = (classMap[tag] || '') + (p.class ? ' ' + p.class : '');
      // Utility names models borrow from Tailwind: line-through strikes the text, text-muted maps to the DAUB muted class
      var cl = String(p.class || '').split(/\s+/);
      if (cl.indexOf('line-through') >= 0) el.style.textDecoration = 'line-through';
      if (cl.indexOf('text-muted') >= 0 || cl.indexOf('text-muted-foreground') >= 0) el.classList.add('db-text-muted');
      el.textContent = c || '';
      return el;
    };
    
    // -- Prose --
    RENDERERS.Prose = function(p) {
      var el = document.createElement('div');
      el.className = 'db-prose' + (p.size ? ' db-prose--' + p.size : '');
      el.innerHTML = sanitizeHtml(p.content || '');
      return el;
    };
    
    // -- Separator --
    RENDERERS.Separator = function(p) {
      if (p.label) {
        var el = document.createElement('div');
        el.className = 'db-separator__label';
        el.textContent = p.label;
        return el;
      }
      var hr = document.createElement('hr');
      hr.className = 'db-separator' + (p.dashed ? ' db-separator--dashed' : '') + (p.vertical ? ' db-separator--vertical' : '');
      return hr;
    };
    RENDERERS.Divider = RENDERERS.Separator;
    
    // -- Button --
    RENDERERS.Button = function(p) {
      var el = document.createElement('button');
      var cls = 'db-btn';
      var bv = knownMod(p.variant, ['primary', 'secondary', 'ghost', 'icon-danger', 'icon-success', 'icon-accent'], { outline: 'secondary', 'default': 'secondary', link: 'ghost', destructive: 'icon-danger', danger: 'icon-danger' });
      var bs = knownMod(p.size, ['sm', 'lg', 'icon']);
      if (bv) cls += ' db-btn--' + bv;
      if (bs) cls += ' db-btn--' + bs;
      if (p.loading) { cls += ' db-btn--loading'; el.disabled = true; }
      el.className = cls;
      var ico = mkIcon(p.icon, 16);
      if (ico) {
        el.appendChild(ico);
        el.appendChild(document.createTextNode(' '));
      }
      el.appendChild(document.createTextNode(p.label || ''));
      if (p.trigger) el.setAttribute('data-db-trigger', p.trigger);
      return el;
    };
    
    // -- ButtonGroup --
    RENDERERS.ButtonGroup = function(p, ch, els, d) {
      var el = mkEl('div', 'db-btn-group');
      el.appendChild(renderChildren(els, ch, d));
      return el;
    };
    
    // -- Field --
    RENDERERS.Field = function(p) {
      var el = mkEl('div', 'db-field' + (p.error ? ' db-field--error' : ''));
      if (p.label) {
        var lbl = mkEl('label', 'db-field__label', p.label);
        el.appendChild(lbl);
      }
      var inp = document.createElement('input');
      inp.className = 'db-field__input';
      inp.type = p.type || 'text';
      inp.placeholder = p.placeholder || '';
      // value is the text the field holds (placeholder only hints); as an attribute it survives serialized HTML
      if (isText(p.value)) inp.setAttribute('value', String(p.value));
      el.appendChild(inp);
      if (p.helper) {
        var help = mkEl('span', 'db-field__helper', p.helper);
        el.appendChild(help);
      }
      return el;
    };
    
    // -- Input --
    RENDERERS.Input = function(p) {
      var el = document.createElement('input');
      var isz = knownMod(p.size, ['sm', 'lg']);
      el.className = 'db-input' + (isz ? ' db-input--' + isz : '') + (p.error ? ' db-input--error' : '');
      el.type = p.type || 'text';
      el.placeholder = p.placeholder || '';
      if (isText(p.value)) el.setAttribute('value', String(p.value));
      return withLabel(el, p.label, true);
    };
    
    // -- InputGroup --
    RENDERERS.InputGroup = function(p, ch, els, d) {
      var el = mkEl('div', 'db-input-group');
      if (p.addonBefore) {
        el.appendChild(mkEl('span', 'db-input-group__addon', p.addonBefore));
      }
      el.appendChild(renderChildren(els, ch, d));
      if (p.addonAfter) {
        el.appendChild(mkEl('span', 'db-input-group__addon', p.addonAfter));
      }
      return el;
    };
    
    // -- InputIcon --
    RENDERERS.InputIcon = function(p, ch, els, d) {
      var el = mkEl('div', 'db-input-icon' + (p.right ? ' db-input-icon--right' : ''));
      var ico = mkIcon(p.icon, 16);
      if (ico) el.appendChild(ico);
      el.appendChild(renderChildren(els, ch, d));
      return el;
    };
    
    // -- Search --
    RENDERERS.Search = function(p) {
      var el = mkEl('div', 'db-search');
      var ico = document.createElement('i');
      ico.setAttribute('data-lucide', 'search');
      ico.className = 'db-search__icon';
      ico.style.width = '16px';
      ico.style.height = '16px';
      el.appendChild(ico);
      var inp = document.createElement('input');
      inp.className = 'db-input';
      inp.type = 'search';
      inp.placeholder = p.placeholder || 'Search...';
      el.appendChild(inp);
      var clr = document.createElement('button');
      clr.className = 'db-search__clear';
      clr.type = 'button';
      clr.setAttribute('aria-label', 'Clear search');
      el.appendChild(clr);
      return el;
    };
    
    // -- Textarea --
    RENDERERS.Textarea = function(p) {
      var el = document.createElement('textarea');
      el.className = 'db-textarea' + (p.error ? ' db-textarea--error' : '');
      el.placeholder = p.placeholder || '';
      if (p.rows) el.rows = p.rows;
      if (isText(p.value)) el.textContent = String(p.value);
      return el;
    };
    
    // -- Checkbox --
    RENDERERS.Checkbox = function(p) {
      var el = mkEl('label', 'db-checkbox');
      var inp = document.createElement('input');
      inp.className = 'db-checkbox__input';
      inp.type = 'checkbox';
      // Serialized HTML keeps state only in attributes; the property alone is dropped
      if (p.checked) { inp.checked = true; inp.setAttribute('checked', ''); }
      el.appendChild(inp);
      var box = document.createElement('span');
      box.className = 'db-checkbox__box';
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      poly.setAttribute('points', '20 6 9 17 4 12');
      svg.appendChild(poly);
      box.appendChild(svg);
      el.appendChild(box);
      el.appendChild(document.createTextNode(' ' + (p.label || '')));
      return el;
    };
    
    // -- RadioGroup --
    RENDERERS.RadioGroup = function(p) {
      var el = mkEl('div', 'db-radio-group');
      var name = 'rg-' + Math.random().toString(36).slice(2,8);
      toOpts(p.options).forEach(function(opt) {
        var lbl = mkEl('label', 'db-radio');
        var inp = document.createElement('input');
        inp.className = 'db-radio__input';
        inp.type = 'radio';
        inp.name = name;
        inp.value = opt.value || '';
        if (opt.value === p.selected) { inp.checked = true; inp.setAttribute('checked', ''); }
        lbl.appendChild(inp);
        lbl.appendChild(mkEl('span', 'db-radio__circle'));
        lbl.appendChild(document.createTextNode(' ' + (opt.label || '')));
        el.appendChild(lbl);
      });
      return withLabel(el, p.label);
    };
    
    // -- Switch --
    RENDERERS.Switch = function(p) {
      var el = mkEl('div', 'db-switch');
      el.setAttribute('role', 'switch');
      el.tabIndex = 0;
      el.setAttribute('aria-checked', p.checked ? 'true' : 'false');
      var track = mkEl('span', 'db-switch__track');
      track.appendChild(mkEl('span', 'db-switch__thumb'));
      el.appendChild(track);
      el.appendChild(document.createTextNode(' ' + (p.label || '')));
      return el;
    };
    
    // -- Slider --
    RENDERERS.Slider = function(p) {
      var el = mkEl('div', 'db-slider');
      var lbl = mkEl('div', 'db-slider__label');
      lbl.appendChild(mkEl('span', null, p.label || ''));
      lbl.appendChild(mkEl('span', 'db-slider__value', String(p.value != null ? p.value : 50)));
      el.appendChild(lbl);
      var inp = document.createElement('input');
      inp.className = 'db-slider__input';
      inp.type = 'range';
      inp.min = p.min != null ? p.min : 0;
      inp.max = p.max != null ? p.max : 100;
      inp.value = p.value != null ? p.value : 50;
      if (p.step) inp.step = p.step;
      el.appendChild(inp);
      return el;
    };
    
    // -- Toggle --
    RENDERERS.Toggle = function(p) {
      var el = document.createElement('button');
      el.className = 'db-toggle' + (p.size === 'sm' ? ' db-toggle--sm' : '');
      el.setAttribute('aria-pressed', p.pressed ? 'true' : 'false');
      el.textContent = p.label || '';
      return el;
    };
    
    // -- ToggleGroup --
    RENDERERS.ToggleGroup = function(p) {
      var el = mkEl('div', 'db-toggle-group');
      toOpts(p.options).forEach(function(opt) {
        var btn = document.createElement('button');
        btn.className = 'db-toggle';
        btn.setAttribute('aria-pressed', opt.value === p.selected ? 'true' : 'false');
        btn.textContent = opt.label || '';
        el.appendChild(btn);
      });
      return withLabel(el, p.label);
    };
    
    // -- Select --
    RENDERERS.Select = function(p) {
      var el = mkEl('div', 'db-select');
      if (p.label) el.appendChild(mkEl('label', 'db-label', p.label));
      var sel = document.createElement('select');
      sel.className = 'db-select__input';
      toOpts(p.options).forEach(function(o) {
        var opt = document.createElement('option');
        opt.value = o.value || '';
        opt.textContent = o.label || '';
        if (o.value === p.selected) opt.selected = true;
        sel.appendChild(opt);
      });
      el.appendChild(sel);
      return el;
    };
    
    // -- CustomSelect --
    RENDERERS.CustomSelect = function(p) {
      var el = mkEl('div', 'db-custom-select');
      var trigger = document.createElement('button');
      trigger.className = 'db-custom-select__trigger';
      trigger.type = 'button';
      var selectedOpt = toOpts(p.options).filter(function(o) { return o.selected; })[0];
      var triggerText = mkEl('span', selectedOpt ? 'db-custom-select__value' : 'db-custom-select__placeholder', selectedOpt ? selectedOpt.label : (p.placeholder || 'Select...'));
      trigger.appendChild(triggerText);
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'db-custom-select__icon');
      svg.setAttribute('viewBox', '0 0 24 24');
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'm6 9 6 6 6-6');
      svg.appendChild(path);
      trigger.appendChild(svg);
      el.appendChild(trigger);
      var dd = mkEl('div', 'db-custom-select__dropdown');
      if (p.searchable) {
        var searchDiv = mkEl('div', 'db-custom-select__search');
        var searchInp = document.createElement('input');
        searchInp.type = 'text';
        searchInp.placeholder = 'Search...';
        searchDiv.appendChild(searchInp);
        dd.appendChild(searchDiv);
      }
      toOpts(p.options).forEach(function(o) {
        var optCls = 'db-custom-select__option' + (o.selected ? ' db-custom-select__option--selected' : '') + (o.disabled ? ' db-custom-select__option--disabled' : '');
        dd.appendChild(mkEl('div', optCls, o.label || ''));
      });
      el.appendChild(dd);
      return el;
    };
    
    // -- Kbd --
    RENDERERS.Kbd = function(p) {
      var el = document.createElement('span');
      kbdKeys(p.keys).forEach(function(k, i) {
        if (i > 0) el.appendChild(document.createTextNode(' + '));
        el.appendChild(mkEl('kbd', 'db-kbd', k));
      });
      return el;
    };
    
    // -- Label --
    RENDERERS.Label = function(p) {
      var el = mkEl('label', 'db-label' + (p.required ? ' db-label--required' : '') + (p.optional ? ' db-label--optional' : ''), p.text || '');
      return el;
    };
    
    // -- Spinner --
    RENDERERS.Spinner = function(p) {
      return mkEl('span', 'db-spinner' + (p.size ? ' db-spinner--' + p.size : ''));
    };
    
    // -- InputOTP --
    RENDERERS.InputOTP = function(p) {
      var el = mkEl('div', 'db-otp');
      var len = p.length || 6;
      var half = Math.ceil(len / 2);
      for (var i = 0; i < len; i++) {
        if (p.separator && i === half) {
          el.appendChild(mkEl('span', 'db-otp__separator', '-'));
        }
        var inp = document.createElement('input');
        inp.className = 'db-otp__input';
        inp.type = 'text';
        inp.inputMode = 'numeric';
        inp.maxLength = 1;
        el.appendChild(inp);
      }
      return el;
    };
    
    // -- Tabs --
    RENDERERS.Tabs = function(p, ch, els, d) {
      var el = mkEl('div', 'db-tabs');
      var list = mkEl('div', 'db-tabs__list');
      list.setAttribute('role', 'tablist');
      var tabs = toArr(p.tabs);
      var activeIdx = 0;
      tabs.forEach(function(t, i) {
        if (t.id === p.active) activeIdx = i;
        var btn = document.createElement('button');
        btn.className = 'db-tabs__tab';
        if (t.id === p.active) btn.setAttribute('aria-selected', 'true');
        btn.textContent = t.label || '';
        list.appendChild(btn);
      });
      el.appendChild(list);
      // No children: a filter strip (Tabs(["All", "Done"], "All")) with no panels, not "All content" filler
      ch.forEach(function(cid, i) {
        var panel = mkEl('div', 'db-tabs__panel');
        if (i !== activeIdx) panel.hidden = true;
        var child = renderElement(els, cid, d + 1);
        if (child) panel.appendChild(child);
        el.appendChild(panel);
      });
      return el;
    };
    
    // -- Breadcrumbs --
    RENDERERS.Breadcrumbs = function(p, ch, els, d) {
      var el = document.createElement('nav');
      el.className = 'db-breadcrumbs';
      el.setAttribute('aria-label', 'Breadcrumb');
      var ol = document.createElement('ol');
      var items = entries(p.items, ch, els);
      items.forEach(function(e, i) {
        var li = document.createElement('li');
        var item = e.data;
        if (e.ref) {
          // Spec element (Text children, or Breadcrumbs([Text(..)])): it is the crumb
          if (i === items.length - 1) li.setAttribute('aria-current', 'page');
          li.appendChild(renderChildren(els, [e.ref], d));
        } else if (i === items.length - 1) {
          li.setAttribute('aria-current', 'page');
          li.textContent = item.label || '';
        } else {
          var a = document.createElement('a');
          a.href = isSafeUrl(item.href) ? item.href : '#';
          a.textContent = item.label || '';
          li.appendChild(a);
        }
        ol.appendChild(li);
      });
      el.appendChild(ol);
      return el;
    };
    
    // -- Pagination --
    RENDERERS.Pagination = function(p) {
      var el = document.createElement('nav');
      el.className = 'db-pagination';
      el.setAttribute('aria-label', 'Pagination');
      var total = Math.ceil((p.total || 1) / (p.perPage || 10));
      var cur = p.current || 1;
      var prev = document.createElement('button');
      prev.className = 'db-pagination__btn';
      prev.textContent = '\u00AB';
      if (cur <= 1) prev.disabled = true;
      el.appendChild(prev);
      for (var i = 1; i <= Math.min(total, 5); i++) {
        var btn = document.createElement('button');
        btn.className = 'db-pagination__btn';
        btn.textContent = String(i);
        if (i === cur) btn.setAttribute('aria-current', 'page');
        el.appendChild(btn);
      }
      if (total > 5) {
        el.appendChild(mkEl('span', 'db-pagination__ellipsis', '...'));
        var last = document.createElement('button');
        last.className = 'db-pagination__btn';
        last.textContent = String(total);
        el.appendChild(last);
      }
      var next = document.createElement('button');
      next.className = 'db-pagination__btn';
      next.textContent = '\u00BB';
      if (cur >= total) next.disabled = true;
      el.appendChild(next);
      return el;
    };
    
    // -- Stepper --
    RENDERERS.Stepper = function(p) {
      var el = mkEl('div', 'db-stepper' + (p.vertical ? ' db-stepper--vertical' : ''));
      // current: 0-based index of the active step; earlier steps are completed. An explicit step status wins
      var cur = parseInt(p.current, 10);
      toArr(p.steps).forEach(function(s, i) {
        var st = s.status || (isNaN(cur) ? 'pending' : i < cur ? 'completed' : i === cur ? 'active' : 'pending');
        var step = mkEl('div', 'db-stepper__step db-stepper__step--' + st);
        step.appendChild(mkEl('div', 'db-stepper__indicator', String(i + 1)));
        var label = mkEl('div', 'db-stepper__label', s.label || '');
        if (isText(s.description)) label.appendChild(mkEl('div', 'db-caption', String(s.description)));
        step.appendChild(label);
        el.appendChild(step);
      });
      return el;
    };
    
    // -- NavMenu --
    RENDERERS.NavMenu = function(p) {
      var el = document.createElement('nav');
      el.className = 'db-nav-menu' + (p.direction === 'vertical' ? ' db-nav-menu--vertical' : '');
      toArr(p.items).forEach(function(item) {
        var a = document.createElement('a');
        a.className = 'db-nav-menu__item' + (item.active ? ' db-nav-menu__item--active' : '');
        a.href = isSafeUrl(item.href) ? item.href : '#';
        a.textContent = item.label || '';
        el.appendChild(a);
      });
      return el;
    };

    // -- Navbar --
    RENDERERS.Navbar = function(p, ch, els, d) {
      var el = document.createElement('nav');
      el.className = 'db-navbar';
      var brand = document.createElement('a');
      brand.className = 'db-navbar__brand';
      brand.href = isSafeUrl(p.brandHref) ? p.brandHref : '#';
      brand.textContent = p.brand || 'App';
      el.appendChild(brand);
      var links = ch.length ? [] : toArr(p.links);
      if (ch.length || links.length) {
        var nav = mkEl('div', 'db-navbar__nav');
        nav.appendChild(ch.length ? renderChildren(els, ch, d) : RENDERERS.NavMenu({ items: links }));
        el.appendChild(nav);
      }
      return el;
    };
    
    // -- Menubar --
    RENDERERS.Menubar = function(p) {
      var el = mkEl('div', 'db-menubar');
      toArr(p.items).forEach(function(item) {
        var btn = document.createElement('button');
        btn.className = 'db-menubar__item';
        btn.textContent = item.label || '';
        if (item.dropdown) {
          var dd = mkEl('div', 'db-menubar__dropdown');
          toArr(item.dropdown).forEach(function(dItem) {
            dd.appendChild(mkEl('button', 'db-dropdown__item', dItem.label || ''));
          });
          btn.appendChild(dd);
        }
        el.appendChild(btn);
      });
      return el;
    };
    
    // -- Sidebar --
    RENDERERS.Sidebar = function(p, ch, els, d) {
      var el = document.createElement('aside');
      el.className = 'db-sidebar' + (p.collapsed ? ' db-sidebar--collapsed' : '');
      el.style.position = 'relative';
      el.style.height = 'auto';
      var secs = toArr(p.sections);
      // A flat list of nav items (sections: [{label, icon}]) -> one untitled section
      if (secs.length && secs.every(function(s) { return isPlain(s) && s.label != null && s.items == null && s.title == null; })) {
        secs = [{ title: '', items: secs }];
      }
      secs.forEach(function(sec) {
        // Models often pass a child ref (Sidebar([navMenu])): render that element in place
        if (typeof sec === 'string' && els && els[sec]) {
          var ref = renderElement(els, sec, d + 1);
          if (ref && ref.classList && ref.classList.contains('db-nav-menu')) ref.classList.add('db-nav-menu--vertical');
          if (ref) el.appendChild(ref);
          return;
        }
        if (typeof sec === 'string') sec = { items: [sec] };
        var section = mkEl('div', 'db-sidebar__section');
        if (sec.title) section.appendChild(mkEl('div', 'db-sidebar__label', sec.title));
        toArr(sec.items).forEach(function(item) {
          if (typeof item === 'string') item = { label: item };
          var a = document.createElement('a');
          a.className = 'db-sidebar__item' + (item.active ? ' db-sidebar__item--active' : '');
          a.setAttribute('data-tooltip', item.label || '');
          a.href = isSafeUrl(item.href) ? item.href : '#';
          var ico = mkIcon(item.icon, 16);
          if (ico) a.appendChild(ico);
          // Label in a <span> (canonical markup) so the icon rail (<=640px, --collapsed) can hide it
          a.appendChild(mkEl('span', null, item.label || ''));
          section.appendChild(a);
        });
        el.appendChild(section);
      });
      return el;
    };
    
    // -- BottomNav --
    RENDERERS.BottomNav = function(p) {
      var el = document.createElement('nav');
      el.className = 'db-bottom-nav';
      toArr(p.items).forEach(function(item) {
        var a = document.createElement('a');
        a.className = 'db-bottom-nav__item' + (item.active ? ' db-bottom-nav__item--active' : '');
        a.href = '#';
        var ico = mkIcon(item.icon, 20);
        if (ico) a.appendChild(ico);
        a.appendChild(mkEl('span', null, item.label || ''));
        if (item.badge) a.appendChild(mkEl('span', 'db-bottom-nav__badge', item.badge));
        el.appendChild(a);
      });
      return el;
    };
    
    // -- Card --
    RENDERERS.Card = function(p, ch, els, d) {
      var el = mkEl('div', 'db-card' + (p.media ? ' db-card--media' : '') + (p.interactive ? ' db-card--interactive' : '') + (p.clip ? ' db-card--clip' : ''));
      if (p.media && isSafeUrl(p.media)) {
        var media = mkEl('div', 'db-card__media');
        var img = document.createElement('img');
        img.src = p.media;
        img.alt = '';
        media.appendChild(img);
        el.appendChild(media);
      }
      if (p.title || p.description) {
        var hdr = mkEl('div', 'db-card__header');
        if (p.title) hdr.appendChild(mkEl('h3', 'db-card__title', p.title));
        if (p.description) hdr.appendChild(mkEl('p', 'db-card__desc', p.description));
        el.appendChild(hdr);
      }
      var footerIds = footerRefs(p.footer, els);
      var bodyIds = footerIds.length ? ch.filter(function(id) { return footerIds.indexOf(id) < 0; }) : ch;
      if (bodyIds.length) {
        var body = mkEl('div', 'db-card__body');
        body.style.display = 'flex';
        body.style.flexDirection = 'column';
        body.style.gap = 'var(--db-space-3)';
        body.appendChild(renderChildren(els, bodyIds, d));
        el.appendChild(body);
      }
      if (footerIds.length) {
        var foot = mkEl('div', 'db-card__footer');
        foot.appendChild(renderChildren(els, footerIds, d));
        el.appendChild(foot);
      }
      return el;
    };
    
    // -- Table --
    RENDERERS.Table = function(p, ch, els, d) {
      var el = document.createElement('table');
      el.className = 'db-table';
      // Table([[head, ..], [cell, ..], ..]): a matrix in columns is the header row, then the body rows
      var matrix = !toArr(p.rows).length && Array.isArray(p.columns) && p.columns.length > 0 && p.columns.every(Array.isArray);
      var shape = tableShape(matrix ? { columns: p.columns[0], rows: p.columns.slice(1) } : p);
      var cols = shape.cols;
      var rows = shape.rows;
      var thead = document.createElement('thead');
      var headRow = document.createElement('tr');
      cols.forEach(function(c) {
        var th = document.createElement('th');
        if (p.sortable) th.setAttribute('data-db-sort', '');
        if (c.numeric) th.className = 'db-numeric';
        var hRef = specRef(c.label, els);
        if (hRef) th.appendChild(renderChildren(els, [hRef], d));
        else th.textContent = c.label || '';
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      el.appendChild(thead);
      var tbody = document.createElement('tbody');
      rows.forEach(function(r) {
        var tr = document.createElement('tr');
        cols.forEach(function(c) {
          var td = document.createElement('td');
          if (c.numeric) td.className = 'db-numeric';
          var cRefs = cellRefs(r[c.key], els), act = cRefs ? null : actionCell(c, r[c.key]);
          if (cRefs) td.appendChild(cellElements(els, cRefs, d));
          else if (act) td.appendChild(act);
          else td.textContent = r[c.key] == null ? '' : String(r[c.key]);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      // No data rows: each child element is a full-width row
      if (!rows.length) toArr(ch).forEach(function(id) {
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.colSpan = Math.max(1, cols.length);
        td.appendChild(renderChildren(els, [id], d));
        tr.appendChild(td);
        tbody.appendChild(tr);
      });
      el.appendChild(tbody);
      return tableScroll(el);
    };
    
    // -- DataTable --
    RENDERERS.DataTable = function(p, ch, els, d) {
      var el = document.createElement('table');
      el.className = 'db-data-table';
      var shape = tableShape(p);
      var cols = shape.cols;
      var rows = shape.rows;
      var thead = document.createElement('thead');
      var headRow = document.createElement('tr');
      if (p.selectable) {
        var thChk = document.createElement('th');
        var chk = document.createElement('input');
        chk.className = 'db-data-table__check';
        chk.type = 'checkbox';
        thChk.appendChild(chk);
        headRow.appendChild(thChk);
      }
      cols.forEach(function(c) {
        var th = document.createElement('th');
        th.setAttribute('data-sortable', '');
        th.textContent = c.label || '';
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      el.appendChild(thead);
      var tbody = document.createElement('tbody');
      rows.forEach(function(r) {
        var tr = document.createElement('tr');
        if (p.selectable) {
          var tdChk = document.createElement('td');
          var chk2 = document.createElement('input');
          chk2.className = 'db-data-table__check';
          chk2.type = 'checkbox';
          tdChk.appendChild(chk2);
          tr.appendChild(tdChk);
        }
        cols.forEach(function(c) {
          var td = document.createElement('td');
          var raw = r[c.key];
          // A Button (or [Button, Button]) in a cell renders as elements; "copy,revoke" in an Actions column as icon buttons
          var refs = cellRefs(raw, els), act = refs ? null : actionCell(c, raw);
          if (refs || act) { td.appendChild(refs ? cellElements(els, refs, d) : act); tr.appendChild(td); return; }
          // Flatten object cell values (e.g. Badge specs) to string
          var val = (raw && typeof raw === 'object') ? (raw.label || raw.text || raw.content || raw.value || '') : (raw == null ? '' : String(raw));
          // Auto-detect status badges
          if (/^(active|completed|shipped|approved|paid|live|verified|published|resolved)$/i.test(val)) {
            td.appendChild(mkEl('span', 'db-badge db-badge--new', val));
          } else if (/^(pending|review|processing|in progress|draft|scheduled|new|open)$/i.test(val)) {
            td.appendChild(mkEl('span', 'db-badge db-badge--updated', val));
          } else if (/^(error|failed|rejected|cancelled|canceled|blocked|expired)$/i.test(val)) {
            td.appendChild(mkEl('span', 'db-badge db-badge--error', val));
          } else if (/^(on leave|away|inactive|paused|remote|archived|suspended|overdue|closed)$/i.test(val)) {
            td.appendChild(mkEl('span', 'db-badge db-badge--warning', val));
          } else {
            td.textContent = val;
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      el.appendChild(tbody);
      return tableScroll(el);
    };
    
    // -- List --
    RENDERERS.List = function(p, ch, els, d) {
      var el = mkEl('div', 'db-list');
      entries(p.items, ch, els).forEach(function(e) {
        var li = mkEl('div', 'db-list__item');
        // Spec element (Text children, or List([Text(..)])): it is the item content
        if (e.ref) {
          li.appendChild(mkEl('div', 'db-list__content')).appendChild(renderChildren(els, [e.ref], d));
          el.appendChild(li);
          return;
        }
        var item = e.data;
        var obj = typeof item === 'string' ? { title: item } : item;
        var ico = mkIcon(obj.icon, 16);
        if (ico) {
          var iconWrap = mkEl('div', 'db-list__icon');
          iconWrap.appendChild(ico);
          li.appendChild(iconWrap);
        }
        var content = mkEl('div', 'db-list__content');
        content.appendChild(mkEl('div', 'db-list__title', obj.title || ''));
        if (obj.secondary) content.appendChild(mkEl('div', 'db-list__secondary', obj.secondary));
        if (isText(obj.meta)) content.appendChild(mkEl('div', 'db-caption', String(obj.meta)));
        li.appendChild(content);
        el.appendChild(li);
      });
      return el;
    };
    
    // -- Badge --
    RENDERERS.Badge = function(p) {
      var bv = knownMod(p.variant, ['new', 'updated', 'success', 'warning', 'error', 'danger', 'info', 'gray', 'red', 'green', 'blue', 'amber', 'purple'], { secondary: 'gray', 'default': 'gray', neutral: 'gray', muted: 'gray', outline: 'gray', primary: 'new', accent: 'new', destructive: 'red' });
      return mkEl('span', 'db-badge' + (bv ? ' db-badge--' + bv : ''), p.text || '');
    };
    
    // -- Avatar --
    RENDERERS.Avatar = function(p, ch, els, d) {
      var px = /^\d+(px)?$/.test(String(p.size)) ? parseInt(p.size, 10) : 0;
      var asz = px ? (px < 36 ? 'sm' : px < 48 ? 'md' : 'lg') : knownMod(p.size, ['sm', 'md', 'lg'], { xs: 'sm', xl: 'lg', '2xl': 'lg' });
      var el = mkEl('div', 'db-avatar db-avatar--' + (asz || 'md'));
      if (p.src && isSafeUrl(p.src)) {
        var img = document.createElement('img');
        img.src = p.src;
        img.alt = '';
        el.appendChild(img);
      } else if (!p.src) {
        // No initials: child elements (a Text "DP") fill the circle instead of "?"
        if (!p.initials && toArr(ch).length) el.appendChild(renderChildren(els, ch, d));
        else el.textContent = p.initials || '?';
      }
      return el;
    };
    
    // -- AvatarGroup --
    RENDERERS.AvatarGroup = function(p, ch, els, d) {
      var el = mkEl('div', 'db-avatar-group');
      var avatars = entries(p.avatars, ch, els);
      var max = p.max || avatars.length;
      avatars.forEach(function(e, i) {
        // Spec element (Avatar children, or AvatarGroup([Avatar(..)])): rendered as is. Past max it stays hidden
        // (counted in +N) rather than left for the page's orphan pass to append below
        if (e.ref) {
          var node = renderElement(els, e.ref, d + 1);
          if (node && i >= max) node.style.display = 'none';
          if (node) el.appendChild(node);
          return;
        }
        if (i >= max) return;
        var a = e.data;
        var av = mkEl('div', 'db-avatar db-avatar--md');
        if (a.src) {
          var img = document.createElement('img');
          img.src = a.src;
          img.alt = '';
          av.appendChild(img);
        } else {
          av.textContent = a.initials || '?';
        }
        el.appendChild(av);
      });
      if (avatars.length > max) {
        el.appendChild(mkEl('span', 'db-avatar-group__overflow', '+' + (avatars.length - max)));
      }
      return el;
    };
    
    // -- Calendar --
    RENDERERS.Calendar = function(p) {
      var el = mkEl('div', 'db-calendar');
      var now = new Date();
      var selDate = p.selected ? new Date(p.selected) : null;
      var todayDate = p.today ? new Date(p.today) : now;
      var viewDate = selDate || todayDate;
      var year = viewDate.getFullYear(), month = viewDate.getMonth();
      var hdr = mkEl('div', 'db-calendar__header');
      var prevBtn = document.createElement('button');
      prevBtn.className = 'db-calendar__nav';
      prevBtn.type = 'button';
      var prevIco = document.createElement('i');
      prevIco.setAttribute('data-lucide', 'chevron-left');
      prevIco.style.width = '14px';
      prevIco.style.height = '14px';
      prevBtn.appendChild(prevIco);
      hdr.appendChild(prevBtn);
      var MNAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      hdr.appendChild(mkEl('span', 'db-calendar__title', MNAMES[month] + ' ' + year));
      var nextBtn = document.createElement('button');
      nextBtn.className = 'db-calendar__nav';
      nextBtn.type = 'button';
      var nextIco = document.createElement('i');
      nextIco.setAttribute('data-lucide', 'chevron-right');
      nextIco.style.width = '14px';
      nextIco.style.height = '14px';
      nextBtn.appendChild(nextIco);
      hdr.appendChild(nextBtn);
      el.appendChild(hdr);
      var grid = mkEl('div', 'db-calendar__grid');
      ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(function(d) {
        grid.appendChild(mkEl('span', 'db-calendar__day-label', d));
      });
      var firstDay = new Date(year, month, 1);
      var startDow = (firstDay.getDay() + 6) % 7;
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var daysInPrev = new Date(year, month, 0).getDate();
      var todayY = todayDate.getFullYear(), todayM = todayDate.getMonth(), todayD = todayDate.getDate();
      var selY = selDate ? selDate.getFullYear() : -1, selM = selDate ? selDate.getMonth() : -1, selD = selDate ? selDate.getDate() : -1;
      for (var op = startDow - 1; op >= 0; op--) {
        var ob = document.createElement('button');
        ob.className = 'db-calendar__day db-calendar__day--outside';
        ob.type = 'button';
        ob.textContent = String(daysInPrev - op);
        grid.appendChild(ob);
      }
      for (var i = 1; i <= daysInMonth; i++) {
        var day = document.createElement('button');
        day.className = 'db-calendar__day';
        day.type = 'button';
        if (year === todayY && month === todayM && i === todayD) day.classList.add('db-calendar__day--today');
        if (year === selY && month === selM && i === selD) day.classList.add('db-calendar__day--selected');
        day.textContent = String(i);
        grid.appendChild(day);
      }
      var totalCells = startDow + daysInMonth;
      var rem = totalCells % 7;
      if (rem > 0) {
        for (var n = 1; n <= 7 - rem; n++) {
          var nb = document.createElement('button');
          nb.className = 'db-calendar__day db-calendar__day--outside';
          nb.type = 'button';
          nb.textContent = String(n);
          grid.appendChild(nb);
        }
      }
      el.appendChild(grid);
      return el;
    };
    
    // -- Chart --
    RENDERERS.Chart = function(p) {
      var wrap = document.createElement('div');
      var bars = chartBars(p);
      var maxVal = Math.max.apply(null, bars.map(function(b) { return toNum(b.max) || toNum(b.value) || 100; }));
      if (maxVal <= 0) maxVal = 100;
      var chart = mkEl('div', 'db-chart');
      bars.forEach(function(b) {
        var bar = mkEl('div', 'db-chart__bar');
        bar.style.height = Math.round((toNum(b.value) / maxVal) * 100) + '%';
        bar.title = (b.label || '') + ': ' + (b.value || 0);
        chart.appendChild(bar);
      });
      wrap.appendChild(chart);
      var labels = mkEl('div', 'db-chart__labels');
      bars.forEach(function(b) {
        labels.appendChild(mkEl('span', null, b.label || ''));
      });
      wrap.appendChild(labels);
      return wrap;
    };
    
    // -- Carousel --
    RENDERERS.Carousel = function(p, ch, els, d) {
      var el = mkEl('div', 'db-carousel');
      var track = mkEl('div', 'db-carousel__track');
      var slides = toArr(p.slides);
      slides.forEach(function(s) {
        // {content: "w1"} names a spec element: render it in the slide instead of printing the id
        var ref = specRef(s.content, els), node = ref && renderElement(els, ref, (d || 0) + 1);
        var slide = mkEl('div', 'db-carousel__slide', node ? null : (s.content || ''));
        if (node) slide.appendChild(node);
        track.appendChild(slide);
      });
      el.appendChild(track);
      var prevBtn = document.createElement('button');
      prevBtn.className = 'db-carousel__btn db-carousel__btn--prev';
      prevBtn.textContent = '\u2039';
      el.appendChild(prevBtn);
      var nextBtn = document.createElement('button');
      nextBtn.className = 'db-carousel__btn db-carousel__btn--next';
      nextBtn.textContent = '\u203A';
      el.appendChild(nextBtn);
      var dots = mkEl('div', 'db-carousel__dots');
      slides.forEach(function(_, i) {
        var dot = document.createElement('button');
        dot.className = 'db-carousel__dot' + (i === 0 ? ' db-carousel__dot--active' : '');
        dots.appendChild(dot);
      });
      el.appendChild(dots);
      return el;
    };
    
    // -- AspectRatio --
    RENDERERS.AspectRatio = function(p, ch, els, d) {
      var el = mkEl('div', 'db-aspect' + (p.ratio ? ' db-aspect--' + p.ratio : ' db-aspect--16-9'));
      el.appendChild(renderChildren(els, ch, d));
      return el;
    };
    
    // -- Chip --
    RENDERERS.Chip = function(p) {
      var cc = knownMod(p.color, ['red', 'green', 'blue', 'purple', 'amber', 'pink']);
      var el = mkEl('span', 'db-chip' + (cc ? ' db-chip--' + cc : '') + (p.active ? ' db-chip--active' : ''), p.label || '');
      if (p.closable) {
        var close = document.createElement('button');
        close.className = 'db-chip__close';
        close.textContent = '\u00D7';
        el.appendChild(close);
      }
      return el;
    };
    
    // -- ScrollArea --
    RENDERERS.ScrollArea = function(p, ch, els, d) {
      var el = mkEl('div', 'db-scroll-area' + (p.direction ? ' db-scroll-area--' + p.direction : ''));
      el.style.maxHeight = '300px';
      el.appendChild(renderChildren(els, ch, d));
      return el;
    };
    
    // -- Alert --
    RENDERERS.Alert = function(p) {
      var at = knownMod(p.type, ['info', 'warning', 'error', 'success'], { danger: 'error', destructive: 'error', warn: 'warning' });
      var el = mkEl('div', 'db-alert' + (at ? ' db-alert--' + at : ''));
      var content = mkEl('div', 'db-alert__content');
      if (p.title) content.appendChild(mkEl('div', 'db-alert__title', p.title));
      if (p.message) content.appendChild(mkEl('p', null, p.message));
      el.appendChild(content);
      return el;
    };
    
    // -- Progress --
    RENDERERS.Progress = function(p) {
      var el = mkEl('div', 'db-progress' + (p.indeterminate ? ' db-progress--indeterminate' : ''));
      var bar = mkEl('div', 'db-progress__bar');
      bar.style.setProperty('--db-progress', (p.value || 0) + '%');
      el.appendChild(bar);
      return withLabel(el, p.label, true);
    };
    
    // -- Skeleton --
    RENDERERS.Skeleton = function(p) {
      var lines = p.lines || 1;
      if (lines === 1) {
        return mkEl('div', 'db-skeleton' + (p.variant ? ' db-skeleton--' + p.variant : ' db-skeleton--text'));
      }
      var wrapper = mkEl('div');
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.gap = '8px';
      for (var i = 0; i < lines; i++) {
        wrapper.appendChild(mkEl('div', 'db-skeleton' + (p.variant ? ' db-skeleton--' + p.variant : ' db-skeleton--text')));
      }
      return wrapper;
    };
    
    // -- EmptyState --
    RENDERERS.EmptyState = function(p, ch, els, d) {
      var el = mkEl('div', 'db-empty');
      var ico = mkIcon(p.icon, 48);
      if (ico) {
        var iconWrap = mkEl('div', 'db-empty__icon');
        iconWrap.appendChild(ico);
        el.appendChild(iconWrap);
      }
      el.appendChild(mkEl('h3', 'db-empty__title', p.title || 'No items'));
      el.appendChild(mkEl('p', 'db-empty__message', p.message || ''));
      // Action children (a Button) sit centered under the message
      if (toArr(ch).length) el.appendChild(renderChildren(els, toArr(ch), d));
      return el;
    };
    
    // -- Tooltip --
    RENDERERS.Tooltip = function(p, ch, els, d) {
      var el = mkEl('div', 'db-tooltip');
      el.appendChild(renderChildren(els, ch, d));
      el.appendChild(mkEl('span', 'db-tooltip__content db-tooltip__content--' + (p.position || 'top'), p.text || ''));
      return el;
    };
    
    // -- Modal --
    RENDERERS.Modal = function(p, ch, els, d) {
      var el = mkEl('div', 'db-modal-overlay');
      el.id = p.id || 'modal-' + Math.random().toString(36).slice(2,8);
      el.setAttribute('aria-hidden', 'true');
      var modal = mkEl('div', 'db-modal');
      var hdr = mkEl('div', 'db-modal__header');
      hdr.appendChild(mkEl('h2', 'db-modal__title', p.title || 'Modal'));
      var closeBtn = document.createElement('button');
      closeBtn.className = 'db-modal__close';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.textContent = '\u00D7';
      hdr.appendChild(closeBtn);
      modal.appendChild(hdr);
      var footerIds = footerRefs(p.footer, els);
      var bodyIds = footerIds.length ? ch.filter(function(id) { return footerIds.indexOf(id) < 0; }) : ch;
      var body = mkEl('div', 'db-modal__body');
      if (isText(p.description)) {
        var desc = mkEl('p', 'db-text-muted', String(p.description));
        desc.style.marginBottom = 'var(--db-space-4)';
        body.appendChild(desc);
      }
      body.appendChild(renderChildren(els, bodyIds, d));
      modal.appendChild(body);
      var footer = mkEl('div', 'db-modal__footer');
      if (footerIds.length) {
        footer.appendChild(renderChildren(els, footerIds, d));
      } else {
        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'db-btn db-btn--secondary';
        cancelBtn.setAttribute('data-action', 'cancel');
        cancelBtn.textContent = 'Cancel';
        footer.appendChild(cancelBtn);
        var confirmBtn = mkEl('button', 'db-btn db-btn--primary', 'Confirm');
        footer.appendChild(confirmBtn);
      }
      modal.appendChild(footer);
      el.appendChild(modal);
      return el;
    };
    
    // -- AlertDialog --
    RENDERERS.AlertDialog = function(p, ch, els, d) {
      var el = mkEl('div', 'db-alert-dialog');
      el.id = p.id || 'alert-' + Math.random().toString(36).slice(2,8);
      el.appendChild(mkEl('div', 'db-alert-dialog__overlay'));
      var panel = mkEl('div', 'db-alert-dialog__panel');
      panel.appendChild(mkEl('h3', 'db-alert-dialog__title', p.title || 'Confirm'));
      panel.appendChild(mkEl('p', 'db-alert-dialog__desc', p.description || ''));
      var footerIds = footerRefs(p.footer, els);
      var actionIds = footerIds.length ? footerIds : ch;
      var actions = mkEl('div', 'db-alert-dialog__actions');
      if (actionIds.length) {
        actions.appendChild(renderChildren(els, actionIds, d));
      } else {
        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'db-btn db-btn--secondary';
        cancelBtn.setAttribute('data-action', 'cancel');
        cancelBtn.textContent = 'Cancel';
        actions.appendChild(cancelBtn);
        actions.appendChild(mkEl('button', 'db-btn db-btn--primary', 'Continue'));
      }
      panel.appendChild(actions);
      el.appendChild(panel);
      return el;
    };
    
    // -- Sheet --
    RENDERERS.Sheet = function(p, ch, els, d) {
      var el = mkEl('div', 'db-sheet db-sheet--' + (p.position || 'right'));
      el.id = p.id || 'sheet-' + Math.random().toString(36).slice(2,8);
      el.appendChild(mkEl('div', 'db-sheet__overlay'));
      var panel = mkEl('div', 'db-sheet__panel');
      var hdr = mkEl('div', 'db-sheet__header');
      hdr.appendChild(mkEl('span', 'db-sheet__title', p.title || 'Sheet'));
      var closeBtn = document.createElement('button');
      closeBtn.className = 'db-sheet__close';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.textContent = '\u00D7';
      hdr.appendChild(closeBtn);
      panel.appendChild(hdr);
      var body = mkEl('div', 'db-sheet__body');
      body.appendChild(renderChildren(els, ch, d));
      panel.appendChild(body);
      el.appendChild(panel);
      return el;
    };
    
    // -- Drawer --
    RENDERERS.Drawer = function(p, ch, els, d) {
      var el = mkEl('div', 'db-drawer');
      el.id = p.id || 'drawer-' + Math.random().toString(36).slice(2,8);
      el.appendChild(mkEl('div', 'db-drawer__overlay'));
      var panel = mkEl('div', 'db-drawer__panel');
      panel.appendChild(mkEl('div', 'db-drawer__handle'));
      var body = mkEl('div', 'db-drawer__body');
      if (isText(p.title)) body.appendChild(mkEl('h3', 'db-h3', String(p.title)));
      body.appendChild(renderChildren(els, ch, d));
      panel.appendChild(body);
      el.appendChild(panel);
      return el;
    };
    
    // -- Popover --
    RENDERERS.Popover = function(p, ch, els, d) {
      var el = mkEl('div', 'db-popover');
      var first = ch.length > 1 && els[ch[0]];
      var trig = first && (first.type === 'Button' || first.type === 'Link') ? renderElement(els, ch[0], d + 1) : null;
      if (trig && trig.classList) {
        trig.classList.add('db-popover__trigger');
        ch = ch.slice(1);
      } else {
        trig = document.createElement('button');
        trig.className = 'db-btn db-popover__trigger';
        trig.textContent = 'Open';
      }
      el.appendChild(trig);
      var content = mkEl('div', 'db-popover__content db-popover__content--' + (p.position || 'bottom'));
      content.appendChild(renderChildren(els, ch, d));
      el.appendChild(content);
      return el;
    };
    
    // -- HoverCard --
    RENDERERS.HoverCard = function(p, ch, els, d) {
      var el = mkEl('div', 'db-hover-card');
      var content = mkEl('div', 'db-hover-card__content');
      content.appendChild(renderChildren(els, ch, d));
      el.appendChild(content);
      return el;
    };
    
    // -- DropdownMenu --
    RENDERERS.DropdownMenu = function(p, ch, els, d) {
      var el = mkEl('div', 'db-dropdown');
      var first = ch.length ? els[ch[0]] : null;
      var childTrig = first ? renderElement(els, ch[0], d + 1) : null;
      if (childTrig && childTrig.classList && (first.type === 'Button' || first.type === 'Link')) {
        childTrig.classList.add('db-dropdown__trigger');
        el.appendChild(childTrig);
      } else {
        var trigger = document.createElement('button');
        trigger.className = 'db-btn db-dropdown__trigger';
        // Any other child (Avatar, Icon, Text) becomes the default trigger's label instead of being dropped
        if (childTrig) trigger.appendChild(childTrig);
        else trigger.textContent = 'Options';
        el.appendChild(trigger);
      }
      var content = mkEl('div', 'db-dropdown__content');
      toArr(p.items).forEach(function(item) {
        if (item.separator) {
          content.appendChild(mkEl('hr', 'db-dropdown__separator'));
        } else if (item.groupLabel) {
          content.appendChild(mkEl('div', 'db-dropdown__label', item.groupLabel));
        } else {
          var btn = document.createElement('button');
          btn.className = 'db-dropdown__item' + (item.active ? ' db-dropdown__item--active' : '');
          var ico = mkIcon(item.icon, 16);
          if (ico) {
            btn.appendChild(ico);
            btn.appendChild(document.createTextNode(' '));
          }
          btn.appendChild(document.createTextNode(item.label || ''));
          content.appendChild(btn);
        }
      });
      el.appendChild(content);
      return el;
    };
    
    // -- ContextMenu --
    RENDERERS.ContextMenu = function(p, ch, els, d) {
      var id = 'ctx-' + Math.random().toString(36).slice(2,8);
      var wrapper = document.createElement('div');
      var target = document.createElement('div');
      target.setAttribute('data-context-menu', id);
      target.style.padding = '16px';
      target.style.border = '1px dashed var(--db-sand)';
      target.style.borderRadius = 'var(--db-radius-2)';
      target.style.textAlign = 'center';
      target.style.color = 'var(--db-warm-gray)';
      target.style.fontFamily = 'var(--db-font-ui)';
      target.style.fontSize = '0.8125rem';
      if (ch.length) {
        target.appendChild(renderChildren(els, ch, d));
      } else {
        target.textContent = 'Right-click here';
      }
      wrapper.appendChild(target);
      var menu = mkEl('div', 'db-context-menu');
      menu.id = id;
      toArr(p.items).forEach(function(item) {
        if (item.separator) {
          menu.appendChild(mkEl('hr', 'db-context-menu__separator'));
        } else {
          var btn = document.createElement('button');
          btn.className = 'db-context-menu__item';
          var ico = mkIcon(item.icon, 16);
          if (ico) {
            btn.appendChild(ico);
            btn.appendChild(document.createTextNode(' '));
          }
          btn.appendChild(document.createTextNode(item.label || ''));
          menu.appendChild(btn);
        }
      });
      wrapper.appendChild(menu);
      return wrapper;
    };
    
    // -- CommandPalette --
    RENDERERS.CommandPalette = function(p) {
      var el = mkEl('div', 'db-command');
      el.id = p.id || 'cmd-' + Math.random().toString(36).slice(2,8);
      el.appendChild(mkEl('div', 'db-command__overlay'));
      var panel = mkEl('div', 'db-command__panel');
      var inputWrap = mkEl('div', 'db-command__input-wrap');
      var searchIco = document.createElement('i');
      searchIco.setAttribute('data-lucide', 'search');
      searchIco.style.width = '16px';
      searchIco.style.height = '16px';
      inputWrap.appendChild(searchIco);
      var inp = document.createElement('input');
      inp.className = 'db-command__input';
      inp.placeholder = p.placeholder || 'Search...';
      inputWrap.appendChild(inp);
      panel.appendChild(inputWrap);
      var list = mkEl('div', 'db-command__list');
      toArr(p.groups).forEach(function(g) {
        list.appendChild(mkEl('div', 'db-command__group-label', g.label || ''));
        toArr(g.items).forEach(function(item) {
          var cmdItem = mkEl('div', 'db-command__item');
          var ico = mkIcon(item.icon, 16);
          if (ico) {
            cmdItem.appendChild(ico);
            cmdItem.appendChild(document.createTextNode(' '));
          }
          cmdItem.appendChild(document.createTextNode(item.label || ''));
          if (item.shortcut) {
            var shortcut = mkEl('span', 'db-command__shortcut');
            shortcut.appendChild(mkEl('kbd', 'db-kbd db-kbd--sm', item.shortcut));
            cmdItem.appendChild(shortcut);
          }
          list.appendChild(cmdItem);
        });
      });
      var empty = mkEl('div', 'db-command__empty', 'No results.');
      empty.style.display = 'none';
      list.appendChild(empty);
      panel.appendChild(list);
      el.appendChild(panel);
      return el;
    };
    
    // -- Accordion --
    RENDERERS.Accordion = function(p, ch, els, d) {
      var el = mkEl('div', 'db-accordion');
      if (p.multi) el.setAttribute('data-multi', '');
      toArr(p.items).forEach(function(item, i) {
        var open = i === 0;
        var accItem = mkEl('div', 'db-accordion__item' + (open ? ' db-accordion__item--open' : ''));
        var trigger = document.createElement('button');
        trigger.className = 'db-accordion__trigger';
        trigger.setAttribute('aria-expanded', String(open));
        trigger.textContent = item.title || '';
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'db-accordion__icon');
        svg.setAttribute('viewBox', '0 0 24 24');
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'm6 9 6 6 6-6');
        svg.appendChild(path);
        trigger.appendChild(svg);
        accItem.appendChild(trigger);
        var content = mkEl('div', 'db-accordion__content');
        if (item.children && item.children.length) {
          content.appendChild(renderChildren(els, item.children, d));
        } else {
          content.textContent = item.content || '';
        }
        accItem.appendChild(content);
        el.appendChild(accItem);
      });
      return el;
    };
    
    // -- Collapsible --
    RENDERERS.Collapsible = function(p, ch, els, d) {
      var el = mkEl('div', 'db-collapsible');
      var trigger = document.createElement('button');
      trigger.className = 'db-collapsible__trigger';
      trigger.setAttribute('aria-expanded', 'false');
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'db-collapsible__icon');
      svg.setAttribute('viewBox', '0 0 24 24');
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'm9 18 6-6-6-6');
      svg.appendChild(path);
      trigger.appendChild(svg);
      trigger.appendChild(document.createTextNode(' ' + (p.label || 'Show more')));
      el.appendChild(trigger);
      var content = mkEl('div', 'db-collapsible__content');
      content.appendChild(renderChildren(els, ch, d));
      el.appendChild(content);
      return el;
    };
    
    // -- Resizable --
    RENDERERS.Resizable = function(p, ch, els, d) {
      var el = mkEl('div', 'db-resizable');
      el.style.width = '100%';
      el.style.minHeight = '100px';
      el.style.border = '1px solid var(--db-sand)';
      el.appendChild(renderChildren(els, ch, d));
      el.appendChild(mkEl('div', 'db-resizable__handle db-resizable__handle--' + (p.direction === 'horizontal' ? 'right' : 'bottom')));
      return el;
    };
    
    // -- DatePicker --
    RENDERERS.DatePicker = function(p) {
      var el = mkEl('div', 'db-date-picker');
      if (p.label) el.appendChild(mkEl('label', 'db-label', p.label));
      var trigger = document.createElement('button');
      trigger.className = 'db-date-picker__trigger db-input';
      trigger.type = 'button';
      trigger.textContent = p.selected || p.placeholder || 'Select date...';
      el.appendChild(trigger);
      var dd = mkEl('div', 'db-date-picker__dropdown');
      // Reuse Calendar renderer for the embedded calendar
      var calEl = RENDERERS.Calendar({ selected: p.selected, today: p.today });
      dd.appendChild(calEl);
      el.appendChild(dd);
      return el;
    };
    
    // -- StatCard --
    RENDERERS.StatCard = function(p) {
      var el = mkEl('div', 'db-stat' + (p.horizontal ? ' db-stat--horizontal' : ''));
      var icoI = mkIcon(p.icon, 20);
      if (icoI) {
        var ico = mkEl('div', 'db-stat__icon');
        ico.appendChild(icoI);
        el.appendChild(ico);
      }
      el.appendChild(mkEl('span', 'db-stat__label', p.label || ''));
      el.appendChild(mkEl('span', 'db-stat__value', p.value || ''));
      if (p.trend) {
        // trend is "up"/"down"; free text ("+2.8% vs last month") shows as written, coloured by its leading sign or arrow
        var tr = String(p.trend), dir = tr === 'up' || tr === 'down' ? tr : /^[+\u2191]/.test(tr) ? 'up' : /^[-\u2212\u2193]/.test(tr) ? 'down' : '';
        var change = mkEl('span', 'db-stat__change' + (dir ? ' db-stat__change--' + dir : ''));
        change.textContent = dir === tr ? (tr === 'up' ? '\u2191' : '\u2193') + ' ' + (p.trendValue || '') : tr + (p.trendValue ? ' ' + p.trendValue : '');
        el.appendChild(change);
      }
      if (isText(p.description)) el.appendChild(mkEl('span', 'db-caption', String(p.description)));
      return el;
    };
    
    // -- ChartCard --
    RENDERERS.ChartCard = function(p, ch, els, d) {
      var el = mkEl('div', 'db-chart-card');
      var hdr = mkEl('div', 'db-chart-card__header');
      var title = mkEl('span', 'db-chart-card__title', p.title || '');
      if (isText(p.description)) {
        var head = mkEl('div');
        head.appendChild(title);
        head.appendChild(mkEl('div', 'db-caption', String(p.description)));
        hdr.appendChild(head);
      } else {
        hdr.appendChild(title);
      }
      el.appendChild(hdr);
      var body = mkEl('div', 'db-chart-card__body');
      if (!(ch && ch.length) && p.bars != null && chartBars(p).length) {
        body.appendChild(RENDERERS.Chart({ bars: p.bars }));
      } else {
        body.appendChild(renderChildren(els, ch, d));
      }
      el.appendChild(body);
      return el;
    };
    
    // -- CustomHTML: raw HTML+CSS+JS rendered in a container --
    RENDERERS.CustomHTML = function(p, ch, els, d) {
      var el = document.createElement('div');
      el.className = 'pg-custom-html';
      if (p.css) {
        var style = document.createElement('style');
        style.textContent = p.css;
        el.appendChild(style);
      }
      if (p.html) {
        var frag = document.createRange().createContextualFragment(
          p.html.replace(new RegExp('<script[\\s\\S]*?<\\/script>', 'gi'), '') // strip script tags from user HTML
        );
        el.appendChild(frag);
      }
      if (ch && ch.length) {
        el.appendChild(renderChildren(els, ch, d));
      }
      // JS is collected by collectCustomJS() and executed inside the iframe via postMessage
      return el;
    };
    
    // -- Link (inline text CTA) --
    RENDERERS.Link = function(p) {
      var el = document.createElement('a');
      el.className = 'db-link';
      el.textContent = p.label || '';
      if (p.href) el.href = isSafeUrl(p.href) ? p.href : '#';
      return el;
    };

    // -- Icon (Lucide) --
    RENDERERS.Icon = function(p) {
      var sizes = { xs: 14, sm: 16, md: 20, lg: 24, xl: 32 };
      var sz = sizes[p.size] || sizes.md;
      var el = mkIcon(p.name, sz) || mkIcon('circle', sz);
      el.style.display = 'inline-flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.flexShrink = '0';
      return el;
    };

    // -- Image --
    RENDERERS.Image = function(p) {
      var el = document.createElement('img');
      el.alt = p.alt || '';
      el.style.maxWidth = '100%';
      el.style.height = 'auto';
      el.style.borderRadius = 'var(--db-radius-md)';
      // width/height in px: a number, "800" or "800px" (other units are ignored)
      var px = function(v) { return /^\s*\d+(\.\d+)?(px)?\s*$/.test(String(v)) ? parseFloat(v) : 0; };
      var w = px(p.width), h = px(p.height);
      // As attributes they size the box before the image loads, while max-width:100% caps the width and height:auto
      // keeps the ratio. A px height beside max-width squashed a 1200x800 image in a 564px column to 564x800.
      if (w) el.setAttribute('width', w);
      if (h) el.setAttribute('height', h);
      if (p.src && isSafeUrl(p.src)) {
        el.src = p.src;
        // A height alone is a fixed height: crop to it rather than squash when max-width narrows the image
        if (h && !w) { el.style.height = h + 'px'; el.style.objectFit = 'cover'; }
      } else {
        // Placeholder when no valid src: fills the column up to its width, and with both sizes keeps their ratio.
        // Without a src it has no image to shrink, so a px width would widen a grid column past the page.
        el.style.display = 'block';
        el.style.width = '100%';
        if (w) el.style.maxWidth = w + 'px';
        if (w && h) el.style.aspectRatio = w + ' / ' + h;
        else el.style.height = h ? h + 'px' : '200px';
        el.style.background = 'var(--db-muted)';
        el.style.objectFit = 'cover';
        el.removeAttribute('src');
      }
      return el;
    };
    
    // ---- Component props documentation (single source of truth for AI prompt) ----