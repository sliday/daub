    var MAX_DEPTH = 20;

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
            if ((aname === 'href' || aname === 'src') && /^\s*javascript:/i.test(v)) continue;
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
    
    // Guard against javascript: and data: URLs from AI-generated content
    function isSafeUrl(url) {
      if (!url || typeof url !== 'string') return false;
      var trimmed = url.trim().toLowerCase();
      if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) return false;
      return true;
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
        return el;
      }
    
      var children = def.children || (def.props && def.props.children) || [];
      var el = render(def.props || {}, children, elements, depth);
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
      (childIds || []).forEach(function(id) {
        var el = renderElement(elements, id, depth + 1);
        if (el) frag.appendChild(el);
      });
      return frag;
    }

    var RENDERERS = {};
    
    // -- Stack (flexbox) --
    RENDERERS.Stack = function(p, ch, els, d) {
      var el = document.createElement('div');
      if (p.container) {
        el.className = 'db-container' + (p.container === 'wide' ? ' db-container--wide' : p.container === 'narrow' ? ' db-container--narrow' : '');
      }
      var isH = p.direction === 'horizontal';
      el.style.display = 'flex';
      el.style.flexDirection = isH ? 'row' : 'column';
      el.style.gap = 'var(--db-space-' + Math.max(0, Math.min(6, p.gap || 2)) + ')';
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
      return el;
    };
    
    // -- Grid (CSS grid) --
    RENDERERS.Grid = function(p, ch, els, d) {
      var el = document.createElement('div');
      if (p.container) {
        el.className = 'db-container' + (p.container === 'wide' ? ' db-container--wide' : p.container === 'narrow' ? ' db-container--narrow' : '');
      }
      el.classList.add('db-grid', 'db-grid--' + (p.columns || 2));
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
      el.className = p.variant ? 'db-surface--' + p.variant : 'db-surface';
      el.style.padding = 'var(--db-space-4, 16px)';
      el.style.borderRadius = 'var(--db-radius-2, 8px)';
      el.appendChild(renderChildren(els, ch, d));
      return el;
    };
    
    // -- Text --
    RENDERERS.Text = function(p) {
      var tag = ['h1','h2','h3','h4','p','span'].indexOf(p.tag) >= 0 ? p.tag : 'p';
      var el = document.createElement(tag);
      var classMap = { h1:'db-h1', h2:'db-h2', h3:'db-h3', h4:'db-h4', p:'db-body', span:'' };
      el.className = (classMap[tag] || '') + (p.class ? ' ' + p.class : '');
      el.textContent = p.content || '';
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
      if (p.variant) cls += ' db-btn--' + p.variant;
      if (p.size) cls += ' db-btn--' + p.size;
      if (p.loading) { cls += ' db-btn--loading'; el.disabled = true; }
      el.className = cls;
      if (p.icon) {
        var ico = document.createElement('i');
        ico.setAttribute('data-lucide', p.icon);
        ico.style.width = '16px';
        ico.style.height = '16px';
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
    RENDERERS.Field = function(p, ch, els, d) {
      var el = mkEl('div', 'db-field' + (p.error ? ' db-field--error' : ''));
      if (p.label) {
        var lbl = mkEl('label', 'db-field__label', p.label);
        el.appendChild(lbl);
      }
      if (ch && ch.length) {
        el.appendChild(renderChildren(els, ch, d));
      } else {
        var inp = document.createElement('input');
        inp.className = 'db-field__input';
        inp.type = p.type || 'text';
        inp.placeholder = p.placeholder || '';
        el.appendChild(inp);
      }
      if (p.helper) {
        var help = mkEl('span', 'db-field__helper', p.helper);
        el.appendChild(help);
      }
      return el;
    };
    
    // -- Input --
    RENDERERS.Input = function(p) {
      var el = document.createElement('input');
      el.className = 'db-input' + (p.size ? ' db-input--' + p.size : '') + (p.error ? ' db-input--error' : '');
      el.type = p.type || 'text';
      el.placeholder = p.placeholder || '';
      return el;
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
      if (p.icon) {
        var ico = document.createElement('i');
        ico.setAttribute('data-lucide', p.icon);
        ico.style.width = '16px';
        ico.style.height = '16px';
        el.appendChild(ico);
      }
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
      return el;
    };
    
    // -- Checkbox --
    RENDERERS.Checkbox = function(p) {
      var el = mkEl('label', 'db-checkbox');
      var inp = document.createElement('input');
      inp.className = 'db-checkbox__input';
      inp.type = 'checkbox';
      if (p.checked) inp.checked = true;
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
      (p.options || []).forEach(function(opt) {
        var lbl = mkEl('label', 'db-radio');
        var inp = document.createElement('input');
        inp.className = 'db-radio__input';
        inp.type = 'radio';
        inp.name = name;
        inp.value = opt.value || '';
        if (opt.value === p.selected) inp.checked = true;
        lbl.appendChild(inp);
        lbl.appendChild(mkEl('span', 'db-radio__circle'));
        lbl.appendChild(document.createTextNode(' ' + (opt.label || '')));
        el.appendChild(lbl);
      });
      return el;
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
      (p.options || []).forEach(function(opt) {
        var btn = document.createElement('button');
        btn.className = 'db-toggle';
        btn.setAttribute('aria-pressed', opt.value === p.selected ? 'true' : 'false');
        btn.textContent = opt.label || '';
        el.appendChild(btn);
      });
      return el;
    };
    
    // -- Select --
    RENDERERS.Select = function(p) {
      var el = mkEl('div', 'db-select');
      if (p.label) el.appendChild(mkEl('label', 'db-label', p.label));
      var sel = document.createElement('select');
      sel.className = 'db-select__input';
      (p.options || []).forEach(function(o) {
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
      var selectedOpt = (p.options || []).filter(function(o) { return o.selected; })[0];
      var triggerText = mkEl('span', 'db-custom-select__placeholder', selectedOpt ? selectedOpt.label : (p.placeholder || 'Select...'));
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
      (p.options || []).forEach(function(o) {
        var optCls = 'db-custom-select__option' + (o.selected ? ' db-custom-select__option--selected' : '') + (o.disabled ? ' db-custom-select__option--disabled' : '');
        dd.appendChild(mkEl('div', optCls, o.label || ''));
      });
      el.appendChild(dd);
      return el;
    };
    
    // -- Kbd --
    RENDERERS.Kbd = function(p) {
      var el = document.createElement('span');
      (p.keys || []).forEach(function(k, i) {
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
      var tabs = p.tabs || [];
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
      if (ch.length) {
        ch.forEach(function(cid, i) {
          var panel = mkEl('div', 'db-tabs__panel');
          if (i !== activeIdx) panel.hidden = true;
          var child = renderElement(els, cid, d + 1);
          if (child) panel.appendChild(child);
          el.appendChild(panel);
        });
      } else {
        tabs.forEach(function(t, i) {
          var panel = mkEl('div', 'db-tabs__panel');
          if (i !== activeIdx) panel.hidden = true;
          panel.appendChild(mkEl('p', 'db-body', (t.label || '') + ' content'));
          el.appendChild(panel);
        });
      }
      return el;
    };
    
    // -- Breadcrumbs --
    RENDERERS.Breadcrumbs = function(p) {
      var el = document.createElement('nav');
      el.className = 'db-breadcrumbs';
      el.setAttribute('aria-label', 'Breadcrumb');
      var ol = document.createElement('ol');
      var items = p.items || [];
      items.forEach(function(item, i) {
        var li = document.createElement('li');
        if (i === items.length - 1) {
          li.setAttribute('aria-current', 'page');
          li.textContent = item.label || '';
        } else {
          var a = document.createElement('a');
          a.href = item.href || '#';
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
      (p.steps || []).forEach(function(s, i) {
        var step = mkEl('div', 'db-stepper__step db-stepper__step--' + (s.status || 'pending'));
        step.appendChild(mkEl('div', 'db-stepper__indicator', String(i + 1)));
        step.appendChild(mkEl('div', 'db-stepper__label', s.label || ''));
        el.appendChild(step);
      });
      return el;
    };
    
    // -- NavMenu --
    RENDERERS.NavMenu = function(p) {
      var el = document.createElement('nav');
      el.className = 'db-nav-menu' + (p.direction === 'vertical' ? ' db-nav-menu--vertical' : '');
      (p.items || []).forEach(function(item) {
        var a = document.createElement('a');
        a.className = 'db-nav-menu__item' + (item.active ? ' db-nav-menu__item--active' : '');
        a.href = item.href || '#';
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
      brand.href = p.brandHref || '#';
      brand.textContent = p.brand || 'App';
      el.appendChild(brand);
      if (ch.length) {
        var nav = mkEl('div', 'db-navbar__nav');
        nav.appendChild(renderChildren(els, ch, d));
        el.appendChild(nav);
      }
      return el;
    };
    
    // -- Menubar --
    RENDERERS.Menubar = function(p) {
      var el = mkEl('div', 'db-menubar');
      (p.items || []).forEach(function(item) {
        var btn = document.createElement('button');
        btn.className = 'db-menubar__item';
        btn.textContent = item.label || '';
        if (item.dropdown) {
          var dd = mkEl('div', 'db-menubar__dropdown');
          item.dropdown.forEach(function(dItem) {
            dd.appendChild(mkEl('button', 'db-dropdown__item', dItem.label || ''));
          });
          btn.appendChild(dd);
        }
        el.appendChild(btn);
      });
      return el;
    };
    
    // -- Sidebar --
    RENDERERS.Sidebar = function(p) {
      var el = document.createElement('aside');
      el.className = 'db-sidebar' + (p.collapsed ? ' db-sidebar--collapsed' : '');
      el.style.position = 'relative';
      el.style.height = 'auto';
      (p.sections || []).forEach(function(sec) {
        var section = mkEl('div', 'db-sidebar__section');
        if (sec.title) section.appendChild(mkEl('div', 'db-sidebar__label', sec.title));
        (sec.items || []).forEach(function(item) {
          var a = document.createElement('a');
          a.className = 'db-sidebar__item' + (item.active ? ' db-sidebar__item--active' : '');
          a.setAttribute('data-tooltip', item.label || '');
          a.href = item.href || '#';
          if (item.icon) {
            var ico = document.createElement('i');
            ico.setAttribute('data-lucide', item.icon);
            ico.style.width = '16px';
            ico.style.height = '16px';
            a.appendChild(ico);
          }
          a.appendChild(document.createTextNode(' ' + (item.label || '')));
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
      (p.items || []).forEach(function(item) {
        var a = document.createElement('a');
        a.className = 'db-bottom-nav__item' + (item.active ? ' db-bottom-nav__item--active' : '');
        a.href = '#';
        if (item.icon) {
          var ico = document.createElement('i');
          ico.setAttribute('data-lucide', item.icon);
          ico.style.width = '20px';
          ico.style.height = '20px';
          a.appendChild(ico);
        }
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
      var footerIds = p.footer || [];
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
    RENDERERS.Table = function(p) {
      var el = document.createElement('table');
      el.className = 'db-table';
      var cols = p.columns || [];
      var rows = p.rows || [];
      var thead = document.createElement('thead');
      var headRow = document.createElement('tr');
      cols.forEach(function(c) {
        var th = document.createElement('th');
        if (p.sortable) th.setAttribute('data-db-sort', '');
        if (c.numeric) th.className = 'db-numeric';
        th.textContent = c.label || '';
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
          td.textContent = r[c.key] || '';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      el.appendChild(tbody);
      return el;
    };
    
    // -- DataTable --
    RENDERERS.DataTable = function(p) {
      var el = document.createElement('table');
      el.className = 'db-data-table';
      var cols = p.columns || [];
      var rows = p.rows || [];
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
          // Flatten object cell values (e.g. Badge specs) to string
          var val = (raw && typeof raw === 'object') ? (raw.label || raw.text || raw.content || raw.value || '') : (raw || '');
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
      return el;
    };
    
    // -- List --
    RENDERERS.List = function(p) {
      var el = mkEl('div', 'db-list');
      (p.items || []).forEach(function(item) {
        var li = mkEl('div', 'db-list__item');
        var obj = typeof item === 'string' ? { title: item } : item;
        if (obj.icon) {
          var iconWrap = mkEl('div', 'db-list__icon');
          var ico = document.createElement('i');
          ico.setAttribute('data-lucide', obj.icon);
          ico.style.width = '16px';
          ico.style.height = '16px';
          iconWrap.appendChild(ico);
          li.appendChild(iconWrap);
        }
        var content = mkEl('div', 'db-list__content');
        content.appendChild(mkEl('div', 'db-list__title', obj.title || ''));
        if (obj.secondary) content.appendChild(mkEl('div', 'db-list__secondary', obj.secondary));
        li.appendChild(content);
        el.appendChild(li);
      });
      return el;
    };
    
    // -- Badge --
    RENDERERS.Badge = function(p) {
      return mkEl('span', 'db-badge' + (p.variant ? ' db-badge--' + p.variant : ''), p.text || '');
    };
    
    // -- Avatar --
    RENDERERS.Avatar = function(p) {
      var el = mkEl('div', 'db-avatar' + (p.size ? ' db-avatar--' + p.size : ' db-avatar--md'));
      if (p.src && isSafeUrl(p.src)) {
        var img = document.createElement('img');
        img.src = p.src;
        img.alt = '';
        el.appendChild(img);
      } else if (!p.src) {
        el.textContent = p.initials || '?';
      }
      return el;
    };
    
    // -- AvatarGroup --
    RENDERERS.AvatarGroup = function(p) {
      var el = mkEl('div', 'db-avatar-group');
      var avatars = p.avatars || [];
      var max = p.max || avatars.length;
      avatars.slice(0, max).forEach(function(a) {
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
      var bars = p.bars || [];
      var maxVal = Math.max.apply(null, bars.map(function(b) { return b.max || b.value || 100; }));
      if (maxVal <= 0) maxVal = 100;
      var chart = mkEl('div', 'db-chart');
      bars.forEach(function(b) {
        var bar = mkEl('div', 'db-chart__bar');
        bar.style.height = Math.round(((b.value || 0) / maxVal) * 100) + '%';
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
    RENDERERS.Carousel = function(p) {
      var el = mkEl('div', 'db-carousel');
      var track = mkEl('div', 'db-carousel__track');
      var slides = p.slides || [];
      slides.forEach(function(s) {
        track.appendChild(mkEl('div', 'db-carousel__slide', s.content || ''));
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
      var el = mkEl('span', 'db-chip' + (p.color ? ' db-chip--' + p.color : '') + (p.active ? ' db-chip--active' : ''), p.label || '');
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
      var el = mkEl('div', 'db-alert' + (p.type ? ' db-alert--' + p.type : ''));
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
      return el;
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
    RENDERERS.EmptyState = function(p) {
      var el = mkEl('div', 'db-empty');
      if (p.icon) {
        var iconWrap = mkEl('div', 'db-empty__icon');
        var ico = document.createElement('i');
        ico.setAttribute('data-lucide', p.icon);
        ico.style.width = '48px';
        ico.style.height = '48px';
        iconWrap.appendChild(ico);
        el.appendChild(iconWrap);
      }
      el.appendChild(mkEl('h3', 'db-empty__title', p.title || 'No items'));
      el.appendChild(mkEl('p', 'db-empty__desc', p.message || ''));
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
      var footerIds = p.footer || [];
      var bodyIds = footerIds.length ? ch.filter(function(id) { return footerIds.indexOf(id) < 0; }) : ch;
      var body = mkEl('div', 'db-modal__body');
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
      var footerIds = p.footer || [];
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
      body.appendChild(renderChildren(els, ch, d));
      panel.appendChild(body);
      el.appendChild(panel);
      return el;
    };
    
    // -- Popover --
    RENDERERS.Popover = function(p, ch, els, d) {
      var el = mkEl('div', 'db-popover');
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
      if (ch.length) {
        el.appendChild(renderElement(els, ch[0], d + 1));
      } else {
        var trigger = document.createElement('button');
        trigger.className = 'db-btn db-dropdown__trigger';
        trigger.textContent = 'Options';
        el.appendChild(trigger);
      }
      var content = mkEl('div', 'db-dropdown__content');
      (p.items || []).forEach(function(item) {
        if (item.separator) {
          content.appendChild(mkEl('hr', 'db-dropdown__separator'));
        } else if (item.groupLabel) {
          content.appendChild(mkEl('div', 'db-dropdown__label', item.groupLabel));
        } else {
          var btn = document.createElement('button');
          btn.className = 'db-dropdown__item' + (item.active ? ' db-dropdown__item--active' : '');
          if (item.icon) {
            var ico = document.createElement('i');
            ico.setAttribute('data-lucide', item.icon);
            ico.style.width = '16px';
            ico.style.height = '16px';
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
      (p.items || []).forEach(function(item) {
        if (item.separator) {
          menu.appendChild(mkEl('hr', 'db-context-menu__separator'));
        } else {
          var btn = document.createElement('button');
          btn.className = 'db-context-menu__item';
          if (item.icon) {
            var ico = document.createElement('i');
            ico.setAttribute('data-lucide', item.icon);
            ico.style.width = '16px';
            ico.style.height = '16px';
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
      (p.groups || []).forEach(function(g) {
        list.appendChild(mkEl('div', 'db-command__group-label', g.label || ''));
        (g.items || []).forEach(function(item) {
          var cmdItem = mkEl('div', 'db-command__item');
          if (item.icon) {
            var ico = document.createElement('i');
            ico.setAttribute('data-lucide', item.icon);
            ico.style.width = '16px';
            ico.style.height = '16px';
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
      (p.items || []).forEach(function(item, i) {
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
      if (p.icon) {
        var ico = mkEl('div', 'db-stat__icon');
        var icoI = document.createElement('i');
        icoI.setAttribute('data-lucide', p.icon);
        icoI.style.width = '20px';
        icoI.style.height = '20px';
        ico.appendChild(icoI);
        el.appendChild(ico);
      }
      el.appendChild(mkEl('span', 'db-stat__label', p.label || ''));
      el.appendChild(mkEl('span', 'db-stat__value', p.value || ''));
      if (p.trend) {
        var change = mkEl('span', 'db-stat__change db-stat__change--' + p.trend);
        change.textContent = (p.trend === 'up' ? '\u2191' : '\u2193') + ' ' + (p.trendValue || '');
        el.appendChild(change);
      }
      return el;
    };
    
    // -- ChartCard --
    RENDERERS.ChartCard = function(p, ch, els, d) {
      var el = mkEl('div', 'db-chart-card');
      var hdr = mkEl('div', 'db-chart-card__header');
      hdr.appendChild(mkEl('span', 'db-chart-card__title', p.title || ''));
      el.appendChild(hdr);
      var body = mkEl('div', 'db-chart-card__body');
      body.appendChild(renderChildren(els, ch, d));
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
    
    // -- Icon (Lucide) --
    RENDERERS.Icon = function(p) {
      var sizes = { xs: 14, sm: 16, md: 20, lg: 24, xl: 32 };
      var sz = sizes[p.size] || sizes.md;
      var el = document.createElement('i');
      el.setAttribute('data-lucide', p.name || 'circle');
      el.style.width = sz + 'px';
      el.style.height = sz + 'px';
      el.style.display = 'inline-block';
      return el;
    };

    // -- Image --
    RENDERERS.Image = function(p) {
      var el = document.createElement('img');
      el.alt = p.alt || '';
      el.style.maxWidth = '100%';
      el.style.height = 'auto';
      el.style.borderRadius = 'var(--db-radius-md)';
      if (p.src && isSafeUrl(p.src)) {
        el.src = p.src;
      } else {
        // Placeholder when no valid src
        el.style.display = 'block';
        el.style.width = p.width ? p.width + 'px' : '100%';
        el.style.height = p.height ? p.height + 'px' : '200px';
        el.style.background = 'var(--db-muted)';
        el.style.objectFit = 'cover';
        el.removeAttribute('src');
      }
      if (p.width) el.style.width = p.width + 'px';
      if (p.height) el.style.height = p.height + 'px';
      return el;
    };
    
    // ---- Component props documentation (single source of truth for AI prompt) ----