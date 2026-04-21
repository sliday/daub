// Browser-side heuristics for layout failure detection.
// Exposed via window.__dbCheckLayout() so the harness can evaluate it.
(function () {
  function visibleText(root) {
    if (!root) return '';
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var out = [];
    var node;
    while ((node = walker.nextNode())) {
      var t = (node.nodeValue || '').trim();
      if (t) out.push(t);
    }
    return out.join(' ');
  }

  function isComponentRoot(el) {
    if (!(el && el.classList)) return false;
    for (var i = 0; i < el.classList.length; i++) {
      if (el.classList[i].indexOf('db-') === 0) return true;
    }
    return false;
  }

  window.__dbCheckLayout = function (expectedClass) {
    var slot = document.getElementById('slot');
    var issues = [];
    if (!slot) return { ok: false, issues: ['no slot'] };

    // Find the expected component root.
    var root = null;
    if (expectedClass) {
      root = slot.querySelector('.' + expectedClass);
    }
    if (!root) {
      // Fallback: first db-* descendant.
      var all = slot.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        if (isComponentRoot(all[i])) { root = all[i]; break; }
      }
    }
    if (!root) {
      // Some "components" like Label are used as a class on an element that
      // may be the slot's first child — inspect slot itself.
      root = slot.firstElementChild || slot;
    }

    var rect = root.getBoundingClientRect();
    var style = getComputedStyle(root);
    var text = visibleText(root);

    // Some components are intentionally hidden until activated (overlays),
    // responsive-hidden by default (bottom-nav), or decorative/empty-by-design.
    var overlayLike = /^db-(modal|modal-overlay|sheet|drawer|tooltip|popover|dropdown|context-menu|alert-dialog|toast|toast-stack|command|date-picker|custom-select|bottom-nav|skeleton|spinner|separator|divider|scroll-area|aspect|elevation)/;
    var isOverlayLike = false;
    if (root.className && typeof root.className === 'string') {
      var cls = root.className.split(/\s+/);
      for (var j = 0; j < cls.length; j++) {
        if (overlayLike.test(cls[j])) { isOverlayLike = true; break; }
      }
    }
    // Form controls never contain visible text of their own.
    var tagName = (root.tagName || '').toLowerCase();
    var isFormControl = tagName === 'input' || tagName === 'textarea' || tagName === 'select';

    // Zero-size detection: treat visibility: hidden/display: none for overlays as OK.
    if (!isOverlayLike) {
      if (rect.width <= 0) issues.push('zero width');
      if (rect.height <= 0) issues.push('zero height');
      if (style.display === 'none') issues.push('display:none');
      if (style.visibility === 'hidden') issues.push('visibility:hidden');
    }

    // Overflow-clip detection: children overflow their clipping parent.
    if (!isOverlayLike && (style.overflow === 'hidden' || style.overflowX === 'hidden' || style.overflowY === 'hidden')) {
      var kids = root.children;
      for (var k = 0; k < kids.length; k++) {
        var kr = kids[k].getBoundingClientRect();
        if (kr.right > rect.right + 2 || kr.bottom > rect.bottom + 2) {
          issues.push('child overflow clipped');
          break;
        }
      }
    }

    // Horizontal page overflow.
    if (document.documentElement.scrollWidth > window.innerWidth + 4) {
      issues.push('page horizontal overflow (' + document.documentElement.scrollWidth + 'px)');
    }

    // Text presence for components that should render copy. Skip overlays,
    // form controls, and icon-only / decorative variants.
    var shouldHaveText = !isOverlayLike && !isFormControl &&
      !/\bdb-(btn--icon|avatar|progress|surface|badge--new|badge--updated)\b/.test(root.className);
    if (shouldHaveText) {
      var hasContent = root.children.length > 0 || (root.textContent || '').trim().length > 0;
      if (!hasContent) issues.push('no visible content');
    }

    // Check contrast trivially: text color === background color on the root.
    if (style.color && style.backgroundColor &&
        style.color === style.backgroundColor &&
        style.color !== 'rgba(0, 0, 0, 0)') {
      issues.push('text color equals background color');
    }

    // Detect unresolved CSS custom properties manifesting as empty computed props.
    if (style.fontSize === '0px') issues.push('computed font-size is 0');

    return {
      ok: issues.length === 0,
      issues: issues,
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      text_sample: text.slice(0, 80),
      is_overlay: isOverlayLike,
      root_class: root.className || null
    };
  };
})();
