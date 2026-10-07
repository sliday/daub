import * as f2 from 'react';
import { forwardRef, createContext, useRef, useContext, useImperativeHandle, useId, useEffect, useState, Children, useCallback, useMemo, cloneElement, isValidElement, Fragment as Fragment$1, createElement } from 'react';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { createPortal } from 'react-dom';

// src/components/Stack.tsx

// src/utils/cn.ts
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
var Stack = forwardRef(
  ({ direction, gap, justify, align, wrap, container, className, style, ...props }, ref) => /* @__PURE__ */ jsx(
    "div",
    {
      ref,
      className: cn(
        "db-stack",
        "db-flex",
        direction !== "horizontal" && "db-flex--col",
        direction === "horizontal" && "db-stack--h",
        gap != null && `db-gap-${gap}`,
        justify && `db-justify-${justify}`,
        align && `db-align-${align}`,
        wrap && "db-flex--wrap",
        container === true && "db-container",
        container === "wide" && "db-container db-container--wide",
        container === "narrow" && "db-container db-container--narrow",
        className
      ),
      ...props,
      style: {
        justifyContent: justify ? { start: "flex-start", end: "flex-end", center: "center", between: "space-between", around: "space-around" }[justify] : void 0,
        alignItems: align ? { start: "flex-start", end: "flex-end", center: "center", stretch: "stretch" }[align] : void 0,
        ...style
      }
    }
  )
);
Stack.displayName = "Stack";
var Grid = forwardRef(
  ({ columns, gap, align, container, className, style, ...props }, ref) => /* @__PURE__ */ jsx(
    "div",
    {
      ref,
      className: cn(
        "db-grid",
        columns && `db-grid--${columns}`,
        gap != null && `db-gap-${gap}`,
        align && `db-align-${align}`,
        container === true && "db-container",
        container === "wide" && "db-container db-container--wide",
        container === "narrow" && "db-container db-container--narrow",
        className
      ),
      ...props,
      style: { justifyItems: align, ...style }
    }
  )
);
Grid.displayName = "Grid";
var Surface = forwardRef(
  ({ variant, className, ...props }, ref) => /* @__PURE__ */ jsx(
    "div",
    {
      ref,
      className: cn(
        "db-surface",
        variant && `db-surface--${variant}`,
        className
      ),
      ...props
    }
  )
);
Surface.displayName = "Surface";
var Container = forwardRef(
  ({ size, className, ...props }, ref) => /* @__PURE__ */ jsx(
    "div",
    {
      ref,
      className: cn(
        "db-container",
        size === "wide" && "db-container--wide",
        size === "narrow" && "db-container--narrow",
        className
      ),
      ...props
    }
  )
);
Container.displayName = "Container";
var Separator = forwardRef(
  ({ vertical, dashed, label, className, ...props }, ref) => {
    const classes = cn(
      "db-separator",
      vertical && "db-separator--vertical",
      dashed && "db-separator--dashed",
      className
    );
    if (label) {
      return /* @__PURE__ */ jsx(
        "div",
        {
          ref,
          "data-db-react": "",
          role: "separator",
          "aria-orientation": vertical ? "vertical" : "horizontal",
          className: classes,
          ...props,
          children: /* @__PURE__ */ jsx("span", { children: label })
        }
      );
    }
    return /* @__PURE__ */ jsx(
      "hr",
      {
        ref,
        "data-db-react": "",
        "aria-orientation": vertical ? "vertical" : "horizontal",
        className: classes,
        ...props
      }
    );
  }
);
Separator.displayName = "Separator";
var ScrollArea = forwardRef(
  ({ horizontal, className, ...props }, ref) => /* @__PURE__ */ jsx(
    "div",
    {
      ref,
      "data-db-react": "",
      tabIndex: 0,
      role: props["aria-label"] || props["aria-labelledby"] ? "region" : void 0,
      className: cn(
        "db-scroll-area",
        horizontal && "db-scroll-area--horizontal",
        className
      ),
      ...props
    }
  )
);
ScrollArea.displayName = "ScrollArea";
function S({ defaultTagName: a, props: r, render: t, state: n = {}, stateAttributesMapping: e }) {
  let o = d(R(n, e), r);
  if (!t) return f2.createElement(a, o);
  if (typeof t == "function") return t(o, n);
  if (!f2.isValidElement(t)) return null;
  let s = t.props, u = { ...d(o, s), ref: f(o.ref, s.ref) };
  return f2.cloneElement(t, u);
}
function d(...a) {
  let r = {};
  for (let t of a) {
    if (!t) continue;
    let n = t;
    for (let e of Object.keys(n)) {
      let o = n[e];
      if (o === void 0) continue;
      let s = r[e];
      e === "className" ? r[e] = [s, o].filter(Boolean).join(" ") : e === "style" ? r[e] = { ...s, ...o } : e === "ref" ? r[e] = f(s, o) : l(e) && typeof s == "function" && typeof o == "function" ? r[e] = p(o, s) : r[e] = o;
    }
  }
  return r;
}
function R(a, r) {
  let t = {};
  for (let n of Object.keys(a)) {
    let e = a[n], o = r?.[n]?.(e);
    if (o) {
      Object.assign(t, o);
      continue;
    }
    if (n === "slot") {
      t["data-slot"] = e;
      continue;
    }
    let s = `data-${String(n).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
    typeof e == "boolean" ? t[s] = e ? "" : void 0 : e != null && (t[s] = String(e));
  }
  return t;
}
function p(a, r) {
  return function(n) {
    a(n), n.defaultPrevented || r(n);
  };
}
function l(a) {
  return /^on[A-Z]/.test(a);
}
function f(...a) {
  let r = a.filter(Boolean);
  if (r.length !== 0) return (t) => {
    for (let n of r) typeof n == "function" ? n(t) : n && (n.current = t);
  };
}
var _e = 8;
var Be = 64;
var Fe = 0;
var J = 0.5;
var je = 180;
var Ge = /* @__PURE__ */ new Set(["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp", " "]);
var ge = { start: false, end: false };
var vt = [];
var Q = { currentAnchorId: null, visibleMessageIds: vt };
function Ne({ content: e, scrollEdgeThreshold: t, spacer: r, viewport: n }) {
  if (!n || !e) return ge;
  let l2 = Re({ content: e, spacer: r, viewport: n });
  return { start: n.scrollTop > t, end: l2 - n.scrollTop - n.clientHeight > t };
}
function Ue({ content: e, scrollMargin: t, scrollPreviousItemPeek: r, spacer: n, viewport: l2, visibleMessageIds: c }) {
  if (!e || !l2) return Q;
  let S2 = l2.getBoundingClientRect(), o = S2.top + t + r, b = typeof IntersectionObserver > "u", v = [], m = null;
  for (let L of ee(e, n)) {
    let R2 = L.dataset.messageId;
    if (!R2) continue;
    let E = L.dataset.scrollAnchor === "true", h = E || b ? L.getBoundingClientRect() : null;
    (b && h ? h.bottom > o && h.top < S2.bottom : c.has(R2)) && v.push(R2), E && h && h.top <= o + J && (m = R2);
  }
  return v.length === 0 && m === null ? Q : { currentAnchorId: m, visibleMessageIds: v };
}
function ee(e, t) {
  return Array.from(e.children).filter((r) => r instanceof HTMLElement && r !== t);
}
function Ye(e, t) {
  for (let r = t; r < e.length; r++) {
    let n = e[r];
    if (n?.dataset.scrollAnchor === "true") return n;
  }
  return null;
}
function ze(e, t) {
  for (let r of e) if (r.dataset.scrollAnchor === "true" && !t.has(r)) return r;
  return null;
}
function qe(e, t) {
  let r = 0;
  for (let n = t; n < e.length; n++) if (e[n]?.dataset.scrollAnchor === "true" && (r += 1, r > 1)) return true;
  return false;
}
function Ke(e) {
  for (let t = e.length - 1; t >= 0; t--) {
    let r = e[t];
    if (r?.dataset.scrollAnchor === "true") return r;
  }
  return null;
}
function We({ content: e, spacer: t, viewport: r }) {
  let n = r.getBoundingClientRect();
  for (let l2 of ee(e, t)) {
    if (!l2.dataset.messageId) continue;
    let c = l2.getBoundingClientRect();
    if (c.bottom > n.top && c.top < n.bottom) return l2;
  }
  return null;
}
function $e({ align: e, element: t, scrollMargin: r, spacer: n, viewport: l2 }) {
  let c = me(t, l2), S2 = t.getBoundingClientRect().height, o = ht(n);
  if (e === "center") {
    let b = Math.max(0, l2.clientHeight - o.start - o.end);
    return c - o.start - (b - S2) / 2 - r;
  }
  if (e === "end") return c - l2.clientHeight + S2 + o.end + r;
  if (e === "nearest") {
    let b = c + S2, v = l2.scrollTop + o.start, m = l2.scrollTop + l2.clientHeight - o.end;
    return c >= v && b <= m ? l2.scrollTop : c < v ? c - o.start - r : b - l2.clientHeight + o.end + r;
  }
  return c - o.start - r;
}
function me(e, t) {
  let r = e.getBoundingClientRect(), n = t.getBoundingClientRect();
  return r.top - n.top + t.scrollTop;
}
function te(e, t) {
  return e.getBoundingClientRect().top - t.getBoundingClientRect().top;
}
function Je({ content: e, scrollTop: t, spacer: r, viewport: n }) {
  let l2 = Re({ content: e, spacer: r, viewport: n });
  return t + n.clientHeight - l2;
}
function Re({ content: e, spacer: t, viewport: r }) {
  let n = ee(e, t), l2 = Xe(e), c = r.getBoundingClientRect(), S2 = r.scrollTop, o = l2.start + l2.end;
  for (let b of n) {
    let v = b.getBoundingClientRect();
    o = Math.max(o, v.bottom - c.top + S2 + l2.end);
  }
  return o;
}
function Qe(e) {
  return Math.max(0, e.scrollHeight - e.clientHeight);
}
function Xe(e) {
  let t = window.getComputedStyle(e);
  return { end: pe(t.paddingBlockEnd || t.paddingBottom), start: pe(t.paddingBlockStart || t.paddingTop) };
}
function ht(e) {
  let t = e?.parentElement;
  return t ? Xe(t) : { end: 0, start: 0 };
}
function Ze(e) {
  if (!e) return 0;
  let t = window.getComputedStyle(e), r = t.rowGap === "normal" ? t.gap : t.rowGap;
  return pe(r);
}
function pe(e) {
  if (!e) return 0;
  let t = Number.parseFloat(e);
  return Number.isFinite(t) ? t : 0;
}
function et(e, t) {
  let r = e, n = /* @__PURE__ */ new Set();
  return { getSnapshot: () => r, hasListeners: () => n.size > 0, setSnapshot: (l2) => {
    t(r, l2) || (r = l2, n.forEach((c) => c()));
  }, subscribe: (l2, c, S2) => {
    let o = n.size === 0;
    return n.add(l2), o && c?.(), () => {
      n.delete(l2), n.size === 0 && S2?.();
    };
  } };
}
function de(e, t) {
  return et(e, t);
}
function tt() {
  return et(Q, Lt);
}
function rt(e, t) {
  return e.start === t.start && e.end === t.end;
}
function Lt(e, t) {
  return e.currentAnchorId !== t.currentAnchorId || e.visibleMessageIds.length !== t.visibleMessageIds.length ? false : e.visibleMessageIds.every((r, n) => r === t.visibleMessageIds[n]);
}
function nt({ autoScroll: e, defaultScrollPosition: t, scrollEdgeThreshold: r, scrollMargin: n, scrollPreviousItemPeek: l2 }) {
  let c = f2.useRef(e), S2 = f2.useRef(false), o = f2.useRef(null), b = f2.useRef(false), v = f2.useRef(r), m = f2.useRef(0), L = f2.useRef(null), R2 = f2.useRef(0), E = f2.useRef(e ? "following-bottom" : "free-scrolling"), h = f2.useRef(/* @__PURE__ */ new Map()), I = f2.useRef(null), u = f2.useRef(null), k = f2.useRef(null), j = f2.useRef(l2), _ = f2.useRef(true), Y = f2.useRef(null), x = f2.useRef(n), V = f2.useRef(null), P = f2.useRef(0), G = f2.useRef(0), A = f2.useRef(null), le = f2.useRef(null), z = f2.useRef(null), B = f2.useRef(null), i2 = f2.useRef(null), d2 = f2.useRef(null), T = f2.useRef(null), w = f2.useRef(null), C = f2.useRef(null), y = f2.useRef(/* @__PURE__ */ new Set()), F = f2.useRef(/* @__PURE__ */ new WeakSet());
  return z.current === null && (z.current = de(t === "end" || t === "last-anchor", (q, X) => q === X)), B.current === null && (B.current = de(ge, rt)), C.current === null && (C.current = tt()), c.current = e, v.current = r, x.current = n, j.current = l2, { autoScrollRef: c, autoscrollingRef: S2, autoscrollingTimeoutRef: i2, streamingTurnRef: k, contentRef: o, defaultScrollPositionAppliedRef: b, firstItemRef: L, itemCountRef: m, lastScrollTopRef: R2, messageElementsRef: h, modeRef: E, pendingScrollFrameRef: V, pendingScrollToMessageRef: I, prependRestoreRef: u, preserveScrollOnPrependRef: _, pendingDefaultScrollStore: z.current, rootRef: Y, scrollEdgeThresholdRef: v, scrollMarginRef: x, scrollPreviousItemPeekRef: j, spacerGapRef: P, spacerHeightRef: G, spacerRef: A, stateFrameRef: le, stateStore: B.current, viewportRef: d2, visibilityFrameRef: T, visibilityObserverRef: w, visibilityStore: C.current, visibleMessageIdsRef: y, handledScrollAnchorsRef: F };
}
function Me(e) {
  e.pendingDefaultScrollStore.setSnapshot(false);
}
function re(e) {
  e.defaultScrollPositionAppliedRef.current = true, Me(e);
}
function lt({ refs: e, commitScrollState: t, scheduleStateCommit: r, scheduleVisibilitySync: n }) {
  let { streamingTurnRef: l2, autoScrollRef: c, autoscrollingRef: S2, autoscrollingTimeoutRef: o, contentRef: b, itemCountRef: v, messageElementsRef: m, modeRef: L, pendingScrollToMessageRef: R2, prependRestoreRef: E, scrollMarginRef: h, scrollPreviousItemPeekRef: I, spacerGapRef: u, spacerHeightRef: k, spacerRef: j, viewportRef: _ } = e, Y = f2.useCallback((i2) => {
    o.current !== null && (window.clearTimeout(o.current), o.current = null), S2.current !== i2 && (S2.current = i2, t()), i2 && (o.current = window.setTimeout(() => {
      o.current = null, S2.current = false, t();
    }, je));
  }, [t]), x = f2.useCallback((i2) => {
    let d2 = j.current;
    if (!d2) return;
    let T = Math.max(0, Math.ceil(i2));
    k.current !== T && (k.current = T, d2.hidden = T === 0, d2.style.height = `${T}px`, d2.style.marginTop = T > 0 ? `${-u.current}px` : "");
  }, []), V = f2.useCallback((i2, { behavior: d2 = "auto", autoscrolling: T = false } = {}) => {
    let w = _.current;
    if (!w) return;
    let C = Math.max(0, i2);
    if (Math.abs(w.scrollTop - C) <= J) {
      w.scrollTop = C, t();
      return;
    }
    T && Y(true), w.scrollTo({ top: C, behavior: d2 }), r();
  }, [t, r, Y]), P = f2.useCallback(({ behavior: i2 = "auto" } = {}) => _.current ? (x(0), l2.current = null, L.current = "free-scrolling", V(0, { behavior: i2 }), n(), true) : false, [n, V, x]), G = f2.useCallback(({ behavior: i2 = "auto" } = {}) => {
    let d2 = _.current;
    return d2 ? (x(0), l2.current = null, L.current = c.current ? "following-bottom" : "free-scrolling", V(Qe(d2), { autoscrolling: true, behavior: i2 }), n(), true) : false;
  }, [n, V, x]), A = f2.useCallback((i2, { align: d2 = "start", behavior: T = "auto", scrollMargin: w = h.current } = {}, { keepPreviousPeek: C = false } = {}) => {
    let y = b.current, F = _.current;
    if (!y || !F || !y.contains(i2)) return false;
    let q = $e({ align: d2, element: i2, scrollMargin: C ? w + I.current : w, spacer: j.current, viewport: F }), X = Je({ content: y, scrollTop: q, spacer: j.current, viewport: F });
    return x(X), E.current = { element: i2, viewportTop: te(i2, F) }, L.current = C ? "anchored-to-message" : "settling-jump", l2.current = C ? i2 : null, V(q, { behavior: T }), n(), true;
  }, [n, V, x]), le = f2.useCallback(() => {
    let i2 = l2.current;
    return !i2 || !i2.isConnected || L.current !== "anchored-to-message" ? false : A(i2, { align: "start" }, { keepPreviousPeek: true });
  }, [A]), z = f2.useCallback((i2, d2) => {
    let T = m.current.get(i2);
    return T ? (re(e), A(T, d2) ? (R2.current = null, true) : (R2.current = { messageId: i2, options: d2 }, true)) : v.current === 0 ? (R2.current = { messageId: i2, options: d2 }, re(e), true) : false;
  }, [A]);
  return { flushPendingScrollToMessage: f2.useCallback(() => {
    let i2 = R2.current;
    if (!i2) return false;
    let d2 = m.current.get(i2.messageId);
    return !d2 || !A(d2, i2.options) ? false : (R2.current = null, re(e), true);
  }, [A]), reanchorToAnchoredMessage: le, scrollToElement: A, scrollToEnd: G, scrollToMessage: z, scrollToStart: P };
}
function ot(e, t) {
  return f2.useCallback((r) => {
    e.current = r, r && t();
  }, [e, t]);
}
function st({ autoScroll: e = false, defaultScrollPosition: t = "end", scrollEdgeThreshold: r = _e, scrollPreviousItemPeek: n = Be, scrollMargin: l2 = Fe }) {
  let c = nt({ autoScroll: e, defaultScrollPosition: t, scrollEdgeThreshold: r, scrollMargin: l2, scrollPreviousItemPeek: n }), { streamingTurnRef: S2, autoScrollRef: o, autoscrollingRef: b, autoscrollingTimeoutRef: v, contentRef: m, defaultScrollPositionAppliedRef: L, firstItemRef: R2, itemCountRef: E, lastScrollTopRef: h, messageElementsRef: I, modeRef: u, pendingScrollFrameRef: k, pendingScrollToMessageRef: j, prependRestoreRef: _, preserveScrollOnPrependRef: Y, pendingDefaultScrollStore: x, rootRef: V, scrollEdgeThresholdRef: P, scrollMarginRef: G, scrollPreviousItemPeekRef: A, spacerGapRef: le, spacerHeightRef: z, spacerRef: B, stateFrameRef: i2, stateStore: d2, viewportRef: T, visibilityFrameRef: w, visibilityObserverRef: C, visibilityStore: y, visibleMessageIdsRef: F, handledScrollAnchorsRef: q } = c, X = f2.useRef(t);
  X.current !== t && (X.current = t, L.current = false);
  let ce = f2.useCallback((s) => {
    let a = V.current, M = T.current, H = [s.start && "start", s.end && "end"].filter(Boolean).join(" "), fe = b.current;
    for (let W of [a, M]) W && (H ? W.setAttribute("data-scrollable", H) : W.removeAttribute("data-scrollable"), W.toggleAttribute("data-autoscrolling", fe));
  }, []), be = f2.useCallback((s) => {
    let a = T.current?.scrollTop ?? 0, M = a < h.current - J;
    h.current = a, o.current && !s.end && u.current !== "settling-jump" && u.current !== "anchored-to-message" ? u.current = "following-bottom" : u.current === "following-bottom" && s.end && M && !b.current && (u.current = "free-scrolling");
  }, []), N = f2.useCallback(() => {
    let s = Ne({ content: m.current, scrollEdgeThreshold: P.current, spacer: B.current, viewport: T.current });
    be(s);
    let a = u.current === "following-bottom" ? { ...s, end: false } : s;
    ce(a), d2.setSnapshot(a);
  }, [be, d2, ce]), oe = f2.useCallback(() => {
    i2.current === null && (i2.current = window.requestAnimationFrame(() => {
      i2.current = null, N();
    }));
  }, [N]), O = f2.useCallback(() => {
    y.hasListeners() && w.current === null && (w.current = window.requestAnimationFrame(() => {
      w.current = null, y.hasListeners() && y.setSnapshot(Ue({ content: m.current, scrollMargin: G.current, scrollPreviousItemPeek: A.current, spacer: B.current, viewport: T.current, visibleMessageIds: F.current }));
    }));
  }, [y]), { flushPendingScrollToMessage: ae, reanchorToAnchoredMessage: Te, scrollToElement: se, scrollToEnd: D, scrollToMessage: Ee, scrollToStart: ie } = lt({ refs: c, commitScrollState: N, scheduleStateCommit: oe, scheduleVisibilitySync: O }), ve = f2.useCallback(() => {
    let s = _.current, a = T.current;
    if (!s || !a || !s.element.isConnected) return false;
    let H = te(s.element, a) - s.viewportTop;
    return Math.abs(H) <= J ? false : (a.scrollTop += H, s.viewportTop = te(s.element, a), oe(), O(), true);
  }, [oe, O]), Z = f2.useCallback(() => {
    let s = m.current, a = T.current;
    if (!s || !a) {
      _.current = null;
      return;
    }
    let M = We({ content: s, spacer: B.current, viewport: a });
    _.current = M ? { element: M, viewportTop: te(M, a) } : null;
  }, []), he = f2.useCallback(() => {
    k.current === null && (k.current = window.requestAnimationFrame(() => {
      k.current = null, ae() && Z();
    }));
  }, [Z, ae]), ue = f2.useCallback(() => {
    if (!t || L.current || E.current === 0) return false;
    let s = false;
    if (t === "last-anchor") {
      let a = m.current, M = T.current, H = a && M ? Ke(ee(a, B.current)) : null;
      if (!a || !M || !H) s = D({ behavior: "auto" });
      else {
        let fe = me(H, M);
        s = Re({ content: a, spacer: B.current, viewport: M }) - fe <= M.clientHeight ? D({ behavior: "auto" }) : se(H, { align: "start" }, { keepPreviousPeek: true });
      }
    } else s = t === "end" ? D({ behavior: "auto" }) : ie({ behavior: "auto" });
    return s ? (re(c), true) : false;
  }, [t, se, D, ie]), Le = f2.useCallback(() => {
    let s = m.current;
    if (!s) return;
    let a = ee(s, B.current), M = E.current, H = R2.current;
    E.current = a.length, R2.current = a[0] ?? null, (() => {
      if (ae()) return;
      if (M === 0) {
        if (ue() || a.length > 0 && o.current && D({ behavior: "auto" })) return;
        N(), O();
        return;
      }
      let W = H ? a.indexOf(H) : -1;
      if (Y.current && W > 0) {
        ve();
        return;
      }
      if (a.length > M) {
        let $ = Ye(a, M);
        if ($) {
          if (o.current && u.current === "following-bottom" && qe(a, M)) {
            D({ behavior: "auto" });
            return;
          }
          se($, { align: "start" }, { keepPreviousPeek: true }), q.current.add($);
          return;
        }
      }
      if (a.length === M) {
        let $ = ze(a, q.current);
        if ($) {
          se($, { align: "start" }, { keepPreviousPeek: true }), q.current.add($);
          return;
        }
      }
      u.current === "following-bottom" && o.current ? D({ behavior: "auto" }) : (N(), O());
    })(), Z();
  }, [ue, Z, N, ae, ve, O, se, D]), Ce = f2.useCallback(() => {
    if (u.current === "following-bottom" && o.current) {
      D({ behavior: "auto" });
      return;
    }
    let s = z.current;
    if (Te()) {
      o.current && s > 0 && z.current === 0 && D({ behavior: "auto" });
      return;
    }
    oe(), O();
  }, [Te, oe, O, D]), Pe = f2.useCallback(() => {
    let s = T.current;
    if (!(!s || !y.hasListeners())) {
      if (typeof IntersectionObserver > "u") {
        O();
        return;
      }
      C.current || (C.current = new IntersectionObserver((a) => {
        for (let M of a) {
          let H = M.target.dataset.messageId;
          H && (M.isIntersecting ? F.current.add(H) : F.current.delete(H));
        }
        O();
      }, { root: s, rootMargin: `${-(G.current + A.current)}px 0px 0px 0px`, threshold: [0, 0.01, 0.5, 1] })), I.current.forEach((a) => {
        C.current?.observe(a);
      }), O();
    }
  }, [O, y]), we = f2.useCallback(() => {
    w.current !== null && (window.cancelAnimationFrame(w.current), w.current = null), C.current?.disconnect(), C.current = null, F.current.clear(), y.setSnapshot(Q);
  }, [y]), bt = f2.useCallback((s, a, M) => {
    if (a) {
      I.current.set(s, a), C.current?.observe(a), O(), j.current?.messageId === s && he();
      return;
    }
    M && I.current.get(s) === M && (I.current.delete(s), F.current.delete(s), C.current?.unobserve(M), O());
  }, [he, O]), Oe = f2.useCallback(() => {
    (u.current === "following-bottom" || u.current === "anchored-to-message" || u.current === "settling-jump") && (S2.current = null, u.current = "free-scrolling");
  }, []), ye = f2.useCallback(() => ce(d2.getSnapshot()), [d2, ce]), He = ot(V, ye), Ie = ot(T, ye), Ae = f2.useCallback((s) => {
    m.current = s;
  }, []), De = f2.useCallback((s) => {
    B.current = s, le.current = Ze(s?.parentElement ?? null);
  }, []), xe = f2.useCallback(() => {
    N(), O(), Z();
  }, [Z, N, O]), Tt = f2.useMemo(() => ({ handleContentChange: Le, handleResize: Ce, observeVisibility: Pe, pendingDefaultScrollStore: x, preserveScrollOnPrependRef: Y, scrollToEnd: D, scrollToMessage: Ee, scrollToStart: ie, setContentElement: Ae, setRootElement: He, setSpacerElement: De, setViewportElement: Ie, stateStore: d2, syncAfterScroll: xe, unobserveVisibility: we, userScrollIntent: Oe, viewportRef: T, visibilityStore: y }), [Le, Ce, Pe, x, D, Ee, ie, Ae, He, De, Ie, d2, xe, we, Oe, y]);
  return f2.useLayoutEffect(() => {
    ue() || E.current === 0 && Me(c);
  }, [ue]), f2.useEffect(() => () => {
    i2.current !== null && (window.cancelAnimationFrame(i2.current), i2.current = null), w.current !== null && (window.cancelAnimationFrame(w.current), w.current = null), v.current !== null && (window.clearTimeout(v.current), v.current = null), k.current !== null && (window.cancelAnimationFrame(k.current), k.current = null), C.current?.disconnect(), C.current = null;
  }, []), f2.useLayoutEffect(() => {
    if (e && u.current === "following-bottom" && E.current > 0) {
      D({ behavior: "auto" });
      return;
    }
    N();
  }, [e, N, D]), { context: Tt, registerMessage: bt };
}
function at(e) {
  let t = f2.useRef(e);
  return t.current = e, t;
}
var it = f2.createContext(null);
var ut = f2.createContext(null);
function K() {
  let e = f2.useContext(it);
  if (!e) throw new Error("useMessageScroller must be used within a MessageScroller.");
  return e;
}
function Ct() {
  let e = f2.useContext(ut);
  if (!e) throw new Error("MessageScrollerItem must be used within a MessageScroller.");
  return e;
}
function Pt() {
  let { scrollToEnd: e, scrollToMessage: t, scrollToStart: r } = K();
  return f2.useMemo(() => ({ scrollToEnd: e, scrollToMessage: t, scrollToStart: r }), [e, t, r]);
}
function wt() {
  let { stateStore: e } = K();
  return f2.useSyncExternalStore(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function Ot() {
  let { observeVisibility: e, unobserveVisibility: t, visibilityStore: r } = K(), n = f2.useCallback((l2) => r.subscribe(l2, e, t), [e, t, r]);
  return f2.useSyncExternalStore(n, r.getSnapshot, r.getSnapshot);
}
function ft({ autoScroll: e = false, children: t, defaultScrollPosition: r = "end", scrollEdgeThreshold: n, scrollPreviousItemPeek: l2, scrollMargin: c }) {
  let { context: S2, registerMessage: o } = st({ autoScroll: e, defaultScrollPosition: r, scrollEdgeThreshold: n, scrollPreviousItemPeek: l2, scrollMargin: c });
  return jsx(it.Provider, { value: S2, children: jsx(ut.Provider, { value: o, children: t }) });
}
function St() {
  let { pendingDefaultScrollStore: e } = K();
  return f2.useSyncExternalStore(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function gt({ children: e, ...t }) {
  let { setRootElement: r } = K(), n = St();
  return jsx("div", { ref: r, ...t, ...n ? { "data-pending-scroll": "" } : null, children: e });
}
function Rt({ "aria-label": e, children: t, onKeyDown: r, onScroll: n, onTouchMove: l2, onWheel: c$1, preserveScrollOnPrepend: S2 = true, ref: o, role: b, tabIndex: v, ...m }) {
  let { handleResize: L, preserveScrollOnPrependRef: R2, setViewportElement: E, syncAfterScroll: h, userScrollIntent: I, viewportRef: u } = K(), k = St();
  R2.current = S2;
  let j = f2.useCallback((P) => {
    E(P), f(o)?.(P);
  }, [o, E]);
  function _(P) {
    h(), n?.(P);
  }
  function Y(P) {
    I(), c$1?.(P);
  }
  function x(P) {
    I(), l2?.(P);
  }
  function V(P) {
    Ge.has(P.key) && I(), r?.(P);
  }
  return f2.useEffect(() => {
    let P = u.current;
    if (!P || typeof ResizeObserver > "u") return;
    let G = 0, A = new ResizeObserver(() => {
      window.cancelAnimationFrame(G), G = window.requestAnimationFrame(L);
    });
    return A.observe(P), () => {
      window.cancelAnimationFrame(G), A.disconnect();
    };
  }, [L, u]), jsx("div", { ref: j, role: b ?? "region", "aria-label": e ?? "Messages", tabIndex: v ?? 0, onKeyDown: V, onScroll: _, onTouchMove: x, onWheel: Y, ...m, ...k ? { "data-pending-scroll": "" } : null, children: t });
}
function pt({ "aria-relevant": e, children: t, ref: r, role: n, spacerClassName: l2, ...c$1 }) {
  let { handleContentChange: S2, handleResize: o, setContentElement: b, setSpacerElement: v } = K(), m = f2.useRef(null), L = f2.useCallback((R2) => {
    m.current = R2, b(R2), f(r)?.(R2);
  }, [r, b]);
  return f2.useLayoutEffect(() => {
    let R2 = m.current;
    if (!R2 || (S2(), typeof MutationObserver > "u")) return;
    let E = new MutationObserver(() => {
      S2();
    });
    return E.observe(R2, { childList: true }), () => E.disconnect();
  }, [S2]), f2.useEffect(() => {
    let R2 = m.current;
    if (!R2 || typeof ResizeObserver > "u") return;
    let E = 0, h = new ResizeObserver(() => {
      window.cancelAnimationFrame(E), E = window.requestAnimationFrame(o);
    });
    return h.observe(R2), () => {
      window.cancelAnimationFrame(E), h.disconnect();
    };
  }, [o]), jsxs("div", { ref: L, role: n ?? "log", "aria-relevant": e ?? "additions", ...c$1, children: [t, jsx("div", { ref: v, "aria-hidden": "true", "data-message-scroller-spacer": "", hidden: true, className: l2 })] });
}
function mt({ messageId: e, ref: t, scrollAnchor: r = false, ...n }) {
  let l2 = Ct(), c$1 = f2.useRef(null), S2 = f2.useCallback((o) => {
    let b = c$1.current;
    c$1.current = o, e && l2(e, o, b), f(t)?.(o);
  }, [e, t, l2]);
  return jsx("div", { ref: S2, "data-message-id": e, "data-scroll-anchor": r ? "true" : "false", ...n });
}
function dt({ behavior: e = "smooth", children: t, direction: r = "end", onClick: n, render: l2, tabIndex: c, type: S2 = "button", ...o }) {
  let { scrollToEnd: b$1, scrollToStart: v, stateStore: m } = K(), L = at(n), R2 = f2.useCallback((u) => m.subscribe(u), [m]), E = f2.useCallback(() => {
    let u = m.getSnapshot();
    return r === "start" ? u.start : u.end;
  }, [r, m]), h = f2.useSyncExternalStore(R2, E, E), I = f2.useCallback((u) => {
    h && (L.current?.(u), u.defaultPrevented || (u.currentTarget.blur(), r === "start" ? v({ behavior: e }) : b$1({ behavior: e })));
  }, [e, r, h, L, b$1, v]);
  return S({ defaultTagName: "button", props: d({ type: S2, inert: !h, tabIndex: h ? c : -1, children: t ?? jsxs("span", { children: ["Scroll to ", r] }), onClick: I }, o), render: l2, state: { active: h, direction: r }, stateAttributesMapping: { active: (u) => ({ "data-active": u ? "true" : "false" }) } });
}
var er = { Provider: ft, Root: gt, Viewport: Rt, Content: pt, Item: mt, Button: dt };
var Button = forwardRef(
  ({ variant, size, loading, icon, className, disabled, children, type = "button", ...props }, ref) => /* @__PURE__ */ jsxs(
    "button",
    {
      ref,
      type,
      "aria-busy": loading || void 0,
      className: cn(
        "db-btn",
        variant && `db-btn--${variant}`,
        size && `db-btn--${size}`,
        loading && "db-btn--loading",
        className
      ),
      disabled: disabled || loading,
      ...props,
      "data-db-react": "",
      children: [
        icon && /* @__PURE__ */ jsx("span", { "aria-hidden": "true", style: { display: "inline-flex", width: "1em", height: "1em", flexShrink: 0 }, children: typeof icon === "string" ? /* @__PURE__ */ jsx("i", { "data-lucide": icon, "aria-hidden": "true", style: { width: "1em", height: "1em" } }) : icon }),
        children
      ]
    }
  )
);
Button.displayName = "Button";
var OptionsContext = createContext({ autoScroll: true, defaultScrollPosition: "end", scrollPreviousItemPeek: 64 });
function MessageScrollerProvider({ autoScroll = true, defaultScrollPosition = "end", scrollPreviousItemPeek = 64, children, ...props }) {
  return /* @__PURE__ */ jsx(OptionsContext.Provider, { value: { autoScroll, defaultScrollPosition, scrollPreviousItemPeek }, children: /* @__PURE__ */ jsx(er.Provider, { ...props, autoScroll, defaultScrollPosition, scrollPreviousItemPeek, children }) });
}
var MessageScroller = forwardRef(
  ({ className, children, ...props }, ref) => {
    const locatorRef = useRef(null);
    const options = useContext(OptionsContext);
    useImperativeHandle(ref, () => locatorRef.current.parentElement, []);
    return /* @__PURE__ */ jsxs(
      er.Root,
      {
        ...props,
        "data-db-react": "",
        "data-db-auto-scroll": String(options.autoScroll),
        "data-db-scroll-position": options.defaultScrollPosition,
        "data-db-scroll-peek": options.scrollPreviousItemPeek,
        className: cn("db-message-scroller", className),
        children: [
          /* @__PURE__ */ jsx("span", { ref: locatorRef, hidden: true, "aria-hidden": "true", style: { display: "none" } }),
          children
        ]
      }
    );
  }
);
MessageScroller.displayName = "MessageScroller";
var MessageScrollerViewport = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx(er.Viewport, { ...props, ref, "data-db-react": "", className: cn("db-message-scroller__viewport", className) })
);
MessageScrollerViewport.displayName = "MessageScrollerViewport";
var MessageScrollerContent = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx(er.Content, { ...props, ref, "data-db-react": "", className: cn("db-message-scroller__content", className) })
);
MessageScrollerContent.displayName = "MessageScrollerContent";
var MessageScrollerItem = forwardRef(
  ({ messageId, scrollAnchor = false, className, ...props }, ref) => /* @__PURE__ */ jsx(
    er.Item,
    {
      ...props,
      ref,
      messageId,
      scrollAnchor,
      "data-db-react": "",
      "data-db-message-id": messageId,
      "data-db-scroll-anchor": scrollAnchor ? "true" : void 0,
      className: cn("db-message-scroller__item", className)
    }
  )
);
MessageScrollerItem.displayName = "MessageScrollerItem";
var MessageScrollerButton = forwardRef(
  ({ className, direction = "end", children, hidden, disabled, render, "aria-label": label, ...props }, ref) => {
    const scrollable = wt();
    return /* @__PURE__ */ jsx(
      er.Button,
      {
        ...props,
        ref,
        direction,
        disabled,
        hidden: hidden || disabled || !scrollable[direction],
        "aria-label": label ?? `Scroll to ${direction}`,
        "data-db-react": "",
        "data-db-scroll-to": direction,
        className: cn("db-message-scroller__button", className),
        render: render ?? /* @__PURE__ */ jsx(Button, { size: "icon", variant: "secondary" }),
        children: children ?? /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: direction === "end" ? "\u2193" : "\u2191" })
      }
    );
  }
);
MessageScrollerButton.displayName = "MessageScrollerButton";
var Message = forwardRef(
  ({ align = "start", className, ...props }, ref) => /* @__PURE__ */ jsx("div", { ...props, ref, "data-db-react": "", className: cn("db-message", align === "end" && "db-message--end", className) })
);
Message.displayName = "Message";
var MessageAvatar = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx("div", { ...props, ref, "data-db-react": "", className: cn("db-message__avatar", className) })
);
MessageAvatar.displayName = "MessageAvatar";
var MessageContent = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx("div", { ...props, ref, "data-db-react": "", className: cn("db-message__content", className) })
);
MessageContent.displayName = "MessageContent";
var MessageHeader = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx("div", { ...props, ref, "data-db-react": "", className: cn("db-message__header", className) })
);
MessageHeader.displayName = "MessageHeader";
var MessageFooter = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx("div", { ...props, ref, "data-db-react": "", className: cn("db-message__footer", className) })
);
MessageFooter.displayName = "MessageFooter";
var MessageGroup = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx("div", { ...props, ref, "data-db-react": "", className: cn("db-message-group", className) })
);
MessageGroup.displayName = "MessageGroup";
function useControllable(controlled, defaultValue, onChange) {
  const isControlled = controlled !== void 0;
  const [internal, setInternal] = useState(defaultValue);
  const value = isControlled ? controlled : internal;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const setValue = useCallback(
    (next) => {
      if (!isControlled) setInternal(next);
      onChangeRef.current?.(next);
    },
    [isControlled]
  );
  return [value, setValue];
}
var Collapsible = forwardRef(
  ({ open, defaultOpen = false, onChange, trigger, className, children, ...props }, ref) => {
    const [isOpen, setIsOpen] = useControllable(open, defaultOpen, onChange);
    const id = useId();
    return /* @__PURE__ */ jsxs("div", { ref, "data-db-react": "", className: cn("db-collapsible", isOpen && "db-collapsible--open", className), ...props, children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          id: `${id}-trigger`,
          className: "db-collapsible__trigger",
          "aria-expanded": isOpen,
          "aria-controls": `${id}-content`,
          onClick: () => setIsOpen(!isOpen),
          type: "button",
          children: trigger
        }
      ),
      /* @__PURE__ */ jsx("div", { id: `${id}-content`, className: "db-collapsible__content", role: "region", "aria-labelledby": `${id}-trigger`, hidden: !isOpen, children })
    ] });
  }
);
Collapsible.displayName = "Collapsible";
var Bubble = forwardRef(
  ({ variant = "primary", align = "start", className, ...props }, ref) => /* @__PURE__ */ jsx("div", { ...props, ref, "data-db-react": "", className: cn(
    "db-bubble",
    `db-bubble--${variant === "default" ? "primary" : variant}`,
    align === "end" && "db-bubble--end",
    className
  ) })
);
Bubble.displayName = "Bubble";
var BubbleContent = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx("div", { ...props, ref, "data-db-react": "", className: cn("db-bubble__content", className) })
);
BubbleContent.displayName = "BubbleContent";
var BubbleReactions = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx("div", { ...props, ref, "data-db-react": "", className: cn("db-bubble__reactions", className) })
);
BubbleReactions.displayName = "BubbleReactions";
var BubbleGroup = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx("div", { ...props, ref, "data-db-react": "", className: cn("db-bubble-group", className) })
);
BubbleGroup.displayName = "BubbleGroup";
var BubbleCollapsible = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx(Collapsible, { ...props, ref, className: cn("db-bubble__content", className) })
);
BubbleCollapsible.displayName = "BubbleCollapsible";
var Progress = forwardRef(
  ({ value = 0, indeterminate, className, ...props }, ref) => {
    const bounded = Math.min(100, Math.max(0, Number.isNaN(value) ? 0 : value));
    return /* @__PURE__ */ jsx(
      "div",
      {
        ref,
        "data-db-react": "",
        role: "progressbar",
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuenow": indeterminate ? void 0 : bounded,
        className: cn(
          "db-progress",
          indeterminate && "db-progress--indeterminate",
          className
        ),
        ...props,
        children: /* @__PURE__ */ jsx(
          "div",
          {
            className: "db-progress__bar",
            style: indeterminate ? void 0 : { width: `${bounded}%` }
          }
        )
      }
    );
  }
);
Progress.displayName = "Progress";
var Attachment = forwardRef(
  ({ state = "idle", orientation = "horizontal", size = "default", className, ...props }, ref) => /* @__PURE__ */ jsx(
    "div",
    {
      "aria-busy": state === "uploading" || state === "processing" || void 0,
      ...props,
      ref,
      "data-db-react": "",
      "data-state": state,
      className: cn(
        "db-attachment",
        orientation === "vertical" && "db-attachment--vertical",
        size !== "default" && `db-attachment--${size}`,
        className
      )
    }
  )
);
Attachment.displayName = "Attachment";
var AttachmentMedia = forwardRef(
  ({ variant = "default", className, ...props }, ref) => /* @__PURE__ */ jsx("div", { ...props, ref, "data-db-react": "", className: cn("db-attachment__media", variant === "image" && "db-attachment__media--image", className) })
);
AttachmentMedia.displayName = "AttachmentMedia";
var AttachmentContent = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx("div", { ...props, ref, "data-db-react": "", className: cn("db-attachment__content", className) })
);
AttachmentContent.displayName = "AttachmentContent";
var AttachmentTitle = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx("div", { ...props, ref, "data-db-react": "", className: cn("db-attachment__title", className) })
);
AttachmentTitle.displayName = "AttachmentTitle";
var AttachmentDescription = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx("div", { ...props, ref, "data-db-react": "", className: cn("db-attachment__description", className) })
);
AttachmentDescription.displayName = "AttachmentDescription";
var AttachmentActions = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx("div", { ...props, ref, "data-db-react": "", className: cn("db-attachment__actions", className) })
);
AttachmentActions.displayName = "AttachmentActions";
var AttachmentAction = forwardRef(
  ({ className, type = "button", ...props }, ref) => /* @__PURE__ */ jsx("button", { ...props, ref, type, "data-db-react": "", className: cn("db-attachment__action", className) })
);
AttachmentAction.displayName = "AttachmentAction";
var AttachmentTrigger = forwardRef(
  ({ className, type = "button", ...props }, ref) => /* @__PURE__ */ jsx("button", { ...props, ref, type, "data-db-react": "", className: cn("db-attachment__trigger", className) })
);
AttachmentTrigger.displayName = "AttachmentTrigger";
var AttachmentGroup = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx("div", { ...props, ref, "data-db-react": "", className: cn("db-attachment-group", className) })
);
AttachmentGroup.displayName = "AttachmentGroup";
var AttachmentProgress = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx(Progress, { ...props, ref, className: cn("db-attachment__progress", className) })
);
AttachmentProgress.displayName = "AttachmentProgress";
var Marker = forwardRef(
  ({ variant = "default", busy = false, className, ...props }, ref) => /* @__PURE__ */ jsx(
    "div",
    {
      role: busy ? "status" : void 0,
      "aria-busy": busy || void 0,
      ...props,
      ref,
      "data-db-react": "",
      className: cn("db-marker", variant !== "default" && `db-marker--${variant}`, className)
    }
  )
);
Marker.displayName = "Marker";
var MarkerIcon = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx("span", { ...props, ref, "data-db-react": "", "aria-hidden": "true", className: cn("db-marker__icon", className) })
);
MarkerIcon.displayName = "MarkerIcon";
var MarkerContent = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx("div", { ...props, ref, "data-db-react": "", className: cn("db-marker__content", className) })
);
MarkerContent.displayName = "MarkerContent";
var hostEvents = {
  "db:chat-send": "onSend",
  "db:chat-steer": "onSteer",
  "db:chat-stop": "onStop",
  "db:chat-action": "onAction",
  "db:chat-queue": "onQueue",
  "db:chat-config": "onConfig",
  "db:chat-dictation": "onDictation",
  "db:chat-change": "onChange"
};
var ChatComposer = forwardRef(function ChatComposer2({
  models,
  model,
  effort,
  approval,
  mode,
  actions,
  capabilities,
  busy,
  placeholder,
  onSend,
  onSteer,
  onStop,
  onAction,
  onQueue,
  onConfig,
  onDictation,
  onChange,
  onReady,
  className,
  ...props
}, ref) {
  const root = useRef(null);
  const controller = useRef(null);
  const callbacks = useRef({ onSend, onSteer, onStop, onAction, onQueue, onConfig, onDictation, onChange, onReady });
  callbacks.current = { onSend, onSteer, onStop, onAction, onQueue, onConfig, onDictation, onChange, onReady };
  const options = { models, model, effort, approval, mode, actions, capabilities, busy, placeholder };
  const currentOptions = useRef(options);
  currentOptions.current = options;
  const setup = JSON.stringify({ models, actions, capabilities, placeholder });
  const serialized = JSON.stringify(options).replace(/[<>&\u2028\u2029]/g, (char) => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"));
  useImperativeHandle(ref, () => root.current, []);
  useEffect(() => {
    const element = root.current;
    const runtime = window.DAUB;
    if (!element || !runtime?.createChatComposer) throw new Error("ChatComposer requires daub.js with DAUB.createChatComposer. Load it before mounting.");
    const listeners = Object.entries(hostEvents).map(([name, callback]) => {
      const listener = (event) => {
        const handler = callbacks.current[callback];
        handler?.(event);
      };
      element.addEventListener(name, listener);
      return { name, listener };
    });
    try {
      controller.current = runtime.createChatComposer(element, currentOptions.current);
      if (!controller.current) throw new Error("DAUB.createChatComposer could not initialize the ChatComposer form.");
      callbacks.current.onReady?.(controller.current);
    } catch (error) {
      controller.current?.destroy();
      controller.current = null;
      for (const { name, listener } of listeners) element.removeEventListener(name, listener);
      throw error;
    }
    return () => {
      for (const { name, listener } of listeners) element.removeEventListener(name, listener);
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);
  useEffect(() => {
    controller.current?.setBusy(busy ?? false);
  }, [busy]);
  useEffect(() => {
    controller.current?.updateOptions(JSON.parse(setup));
  }, [setup]);
  useEffect(() => {
    if (model !== void 0) controller.current?.setModel(model);
  }, [model, busy, setup]);
  useEffect(() => {
    if (effort !== void 0) controller.current?.setEffort(effort);
  }, [effort, model, busy, setup]);
  useEffect(() => {
    if (approval !== void 0) controller.current?.setApproval(approval);
  }, [approval]);
  useEffect(() => {
    if (mode !== void 0) controller.current?.setMode(mode);
  }, [mode]);
  return /* @__PURE__ */ jsx("form", { ...props, ref: root, className: cn("db-chat-composer", className), "data-db-react": "", "data-db-chat-options": serialized });
});
ChatComposer.displayName = "ChatComposer";
var AspectRatio = forwardRef(
  ({ ratio = "16-9", className, ...props }, ref) => /* @__PURE__ */ jsx(
    "div",
    {
      ref,
      className: cn("db-aspect", `db-aspect--${ratio}`, className),
      ...props
    }
  )
);
AspectRatio.displayName = "AspectRatio";
var Frame = forwardRef(
  ({ header, footer, flush, className, children, ...props }, ref) => /* @__PURE__ */ jsxs(
    "div",
    {
      ref,
      className: cn("db-frame", flush && "db-frame--flush", className),
      ...props,
      children: [
        header && /* @__PURE__ */ jsx("div", { className: "db-frame__header", children: header }),
        /* @__PURE__ */ jsx("div", { className: "db-frame__body", children }),
        footer && /* @__PURE__ */ jsx("div", { className: "db-frame__footer", children: footer })
      ]
    }
  )
);
Frame.displayName = "Frame";
var Group = forwardRef(
  ({ attached, vertical, className, ...props }, ref) => /* @__PURE__ */ jsx(
    "div",
    {
      ref,
      className: cn(
        "db-group",
        attached && "db-group--attached",
        vertical && "db-group--vertical",
        className
      ),
      ...props
    }
  )
);
Group.displayName = "Group";
var Toolbar = forwardRef(
  ({ vertical, className, onKeyDown, onFocus, children, ...props }, ref) => {
    const toolbarRef = useRef(null);
    const [active, setActive] = useState(null);
    const controls = () => Array.from(toolbarRef.current?.querySelectorAll("button, a[href], input, select, textarea, [tabindex]") ?? []).filter((node) => !node.closest('[hidden], [inert], [aria-disabled="true"]') && !node.matches(":disabled") && node.getClientRects().length > 0);
    useEffect(() => {
      const nodes = controls();
      const current = active && nodes.includes(active) ? active : nodes[0];
      nodes.forEach((node) => {
        node.tabIndex = node === current ? 0 : -1;
      });
    });
    return /* @__PURE__ */ jsx(
      "div",
      {
        ref: (node) => {
          toolbarRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        },
        className: cn("db-toolbar", vertical && "db-toolbar--vertical", className),
        role: "toolbar",
        "aria-orientation": vertical ? "vertical" : "horizontal",
        ...props,
        "data-db-react": "",
        onFocus: (event) => {
          onFocus?.(event);
          setActive(event.target);
        },
        onKeyDown: (event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          const target = event.target;
          if (target.matches('input, textarea, select, [contenteditable="true"]')) return;
          const nodes = controls();
          const current = nodes.indexOf(target);
          if (current < 0) return;
          const direction = getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
          let index;
          if (event.key === "Home") index = 0;
          else if (event.key === "End") index = nodes.length - 1;
          else if (event.key === (vertical ? "ArrowDown" : "ArrowRight")) index = (current + (vertical ? 1 : direction) + nodes.length) % nodes.length;
          else if (event.key === (vertical ? "ArrowUp" : "ArrowLeft")) index = (current - (vertical ? 1 : direction) + nodes.length) % nodes.length;
          else return;
          event.preventDefault();
          nodes[index]?.focus();
        },
        children
      }
    );
  }
);
Toolbar.displayName = "Toolbar";
var Card = forwardRef(
  ({ title, description, media, footer, clip, interactive, className, children, onKeyDown, onKeyUp, onClick, onBlur, role, tabIndex, ...props }, ref) => {
    const spacePending = useRef(false);
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref,
        "data-db-react": "",
        role: role ?? (interactive ? "button" : void 0),
        tabIndex: tabIndex ?? (interactive ? props["aria-disabled"] === true || props["aria-disabled"] === "true" ? -1 : 0 : void 0),
        onClick: (event) => {
          if (interactive && (props["aria-disabled"] === true || props["aria-disabled"] === "true")) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
        },
        onKeyDown: (event) => {
          if (event.key === " ") spacePending.current = false;
          onKeyDown?.(event);
          if (!interactive || event.defaultPrevented || event.target !== event.currentTarget || props["aria-disabled"] === true || props["aria-disabled"] === "true") return;
          if (event.key === "Enter") {
            event.preventDefault();
            if (!event.repeat) event.currentTarget.click();
          } else if (event.key === " " && (!role || role === "button")) {
            event.preventDefault();
            spacePending.current = true;
          }
        },
        onKeyUp: (event) => {
          onKeyUp?.(event);
          if (event.key !== " ") return;
          const activate = spacePending.current;
          spacePending.current = false;
          if (activate && interactive && !event.defaultPrevented && event.target === event.currentTarget && (!role || role === "button") && props["aria-disabled"] !== true && props["aria-disabled"] !== "true") event.currentTarget.click();
        },
        onBlur: (event) => {
          spacePending.current = false;
          onBlur?.(event);
        },
        className: cn(
          "db-card",
          clip && "db-card--clip",
          interactive && "db-card--interactive",
          className
        ),
        ...props,
        children: [
          media,
          (title || description) && /* @__PURE__ */ jsxs("div", { className: "db-card__header", children: [
            title && /* @__PURE__ */ jsx("h3", { className: "db-card__title", children: title }),
            description && /* @__PURE__ */ jsx("p", { className: "db-card__desc", children: description })
          ] }),
          children && /* @__PURE__ */ jsx("div", { className: "db-card__body", children }),
          footer && /* @__PURE__ */ jsx("div", { className: "db-card__footer", children: footer })
        ]
      }
    );
  }
);
Card.displayName = "Card";
var Badge = forwardRef(
  ({ variant, className, ...props }, ref) => /* @__PURE__ */ jsx(
    "span",
    {
      ref,
      className: cn("db-badge", variant && `db-badge--${variant}`, className),
      ...props
    }
  )
);
Badge.displayName = "Badge";
var Avatar = forwardRef(
  ({ src, alt, initials, size, fallback, className, ...props }, ref) => {
    const [image, setImage] = useState({ src, failed: false });
    if (image.src !== src) setImage({ src, failed: false });
    const showImage = !!src && !image.failed;
    return /* @__PURE__ */ jsx(
      "div",
      {
        ref,
        "data-db-react": "",
        role: !showImage && alt ? "img" : void 0,
        "aria-label": !showImage && alt ? alt : void 0,
        className: cn("db-avatar", size && `db-avatar--${size}`, className),
        ...props,
        children: showImage ? /* @__PURE__ */ jsx("img", { src, alt: alt ?? "", onError: () => setImage({ src, failed: true }) }) : fallback ?? (initials ? /* @__PURE__ */ jsx("span", { children: initials }) : null)
      }
    );
  }
);
Avatar.displayName = "Avatar";
var AvatarGroup = forwardRef(
  ({ max, className, children, ...props }, ref) => {
    const avatars = Children.toArray(children);
    const limit = max === void 0 || !Number.isFinite(max) ? avatars.length : Math.max(0, Math.floor(max));
    const remaining = Math.max(0, avatars.length - limit);
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref,
        "data-db-react": "",
        className: cn("db-avatar-group", className),
        ...props,
        children: [
          avatars.slice(0, limit),
          remaining > 0 && /* @__PURE__ */ jsxs("span", { className: "db-avatar-group__overflow", "aria-label": `${remaining} more avatars`, children: [
            "+",
            remaining
          ] })
        ]
      }
    );
  }
);
AvatarGroup.displayName = "AvatarGroup";
var Alert = forwardRef(
  ({ variant, title, className, children, ...props }, ref) => /* @__PURE__ */ jsx(
    "div",
    {
      ref,
      "data-db-react": "",
      role: variant === "error" || variant === "warning" ? "alert" : "status",
      className: cn("db-alert", variant && `db-alert--${variant}`, className),
      ...props,
      children: /* @__PURE__ */ jsxs("div", { className: "db-alert__content", children: [
        title && /* @__PURE__ */ jsx("div", { className: "db-alert__title", children: title }),
        children
      ] })
    }
  )
);
Alert.displayName = "Alert";
var Meter = forwardRef(
  ({ value = 0, min = 0, max = 100, status = "success", className, style, ...props }, ref) => {
    const lower = Number.isFinite(min) ? min : 0;
    const upper = Math.max(lower, Number.isFinite(max) ? max : 100);
    const bounded = Math.min(upper, Math.max(lower, Number.isNaN(value) ? lower : value));
    const pct = upper === lower ? 0 : (bounded - lower) / (upper - lower) * 100;
    return /* @__PURE__ */ jsx(
      "div",
      {
        ref,
        "data-db-react": "",
        className: cn(
          "db-meter",
          status !== "success" && `db-meter--${status}`,
          className
        ),
        role: "meter",
        "aria-valuemin": lower,
        "aria-valuemax": upper,
        "aria-valuenow": bounded,
        style: { "--db-meter": `${pct}%`, ...style },
        ...props,
        children: /* @__PURE__ */ jsx("div", { className: "db-meter__bar" })
      }
    );
  }
);
Meter.displayName = "Meter";
var Skeleton = forwardRef(
  ({ variant, lines = 1, className, ...props }, ref) => {
    const classes = cn(
      "db-skeleton",
      variant && `db-skeleton--${variant}`,
      className
    );
    if (lines > 1) {
      return /* @__PURE__ */ jsx("div", { ref, "data-db-react": "", "aria-hidden": "true", ...props, children: Array.from({ length: lines }, (_, i2) => /* @__PURE__ */ jsx("div", { className: classes }, i2)) });
    }
    return /* @__PURE__ */ jsx("div", { ref, "data-db-react": "", "aria-hidden": "true", className: classes, ...props });
  }
);
Skeleton.displayName = "Skeleton";
var EmptyState = forwardRef(
  ({ title, message, icon, className, children, ...props }, ref) => /* @__PURE__ */ jsxs(
    "div",
    {
      ref,
      className: cn("db-empty", className),
      ...props,
      children: [
        icon && /* @__PURE__ */ jsx("div", { className: "db-empty__icon", children: icon }),
        title && /* @__PURE__ */ jsx("h3", { children: title }),
        message && /* @__PURE__ */ jsx("p", { children: message }),
        children
      ]
    }
  )
);
EmptyState.displayName = "EmptyState";
var Spinner = forwardRef(
  ({ size, className, ...props }, ref) => /* @__PURE__ */ jsx(
    "span",
    {
      ref,
      role: "status",
      "aria-label": "Loading",
      className: cn("db-spinner", size && `db-spinner--${size}`, className),
      ...props
    }
  )
);
Spinner.displayName = "Spinner";
var StatCard = forwardRef(
  ({ label, value, trend, trendValue, icon, horizontal, className, ...props }, ref) => /* @__PURE__ */ jsxs(
    "div",
    {
      ref,
      "data-db-react": "",
      className: cn(
        "db-stat",
        horizontal && "db-stat--horizontal",
        className
      ),
      ...props,
      children: [
        icon && /* @__PURE__ */ jsx("div", { className: "db-stat__icon", children: icon }),
        /* @__PURE__ */ jsx("div", { className: "db-stat__label", children: label }),
        /* @__PURE__ */ jsx("div", { className: "db-stat__value", children: value }),
        trend && /* @__PURE__ */ jsx("div", { className: cn("db-stat__change", `db-stat__change--${trend}`), children: trendValue })
      ]
    }
  )
);
StatCard.displayName = "StatCard";
var ChartCard = forwardRef(
  ({ title, emptyState = "No data", className, children, ...props }, ref) => {
    const titleId = useId();
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref,
        "data-db-react": "",
        role: "group",
        "aria-labelledby": title && !props["aria-label"] ? titleId : void 0,
        className: cn("db-chart-card", className),
        ...props,
        children: [
          title && /* @__PURE__ */ jsx("div", { className: "db-chart-card__header", children: /* @__PURE__ */ jsx("h3", { id: titleId, className: "db-chart-card__title", children: title }) }),
          /* @__PURE__ */ jsx("div", { className: "db-chart-card__body", children: Children.toArray(children).length ? children : emptyState })
        ]
      }
    );
  }
);
ChartCard.displayName = "ChartCard";
var activeTraps = [];
var escapeHandlers = [];
var originalInert = /* @__PURE__ */ new Map();
var previousOverflow = "";
var activationOrder = 0;
function useMergedRefs(internal, forwarded) {
  const cleanupRef = useRef(void 0);
  return useCallback((node) => {
    const previousCleanup = cleanupRef.current;
    cleanupRef.current = void 0;
    previousCleanup?.();
    internal.current = node;
    if (typeof forwarded === "function") {
      if (node === null && previousCleanup) return;
      const cleanup = forwarded(node);
      if (node !== null && typeof cleanup === "function") cleanupRef.current = cleanup;
    } else if (forwarded) forwarded.current = node;
  }, [internal, forwarded]);
}
function triggerElement(trigger) {
  if (isValidElement(trigger)) {
    if (trigger.type !== Fragment$1) return trigger;
    const children = Children.toArray(trigger.props.children);
    if (children.length === 1) return triggerElement(children[0]);
  }
  return typeof trigger === "string" || typeof trigger === "number" ? createElement("button", { type: "button" }, trigger) : createElement("span", {}, trigger);
}
function triggerId(trigger, fallback) {
  const id = triggerElement(trigger).props.id;
  return typeof id === "string" ? id : fallback;
}
function renderOverlayTrigger(trigger, attributes) {
  const element = triggerElement(trigger);
  const props = element.props;
  const merged = { ...attributes };
  merged.id = props.id ?? attributes.id;
  merged.className = [props.className, attributes.className].filter(Boolean).join(" ");
  if (element.type === "button") merged.type = props.type ?? "button";
  if (attributes["aria-describedby"]) merged["aria-describedby"] = [props["aria-describedby"], attributes["aria-describedby"]].filter(Boolean).join(" ");
  for (const name of ["onClick", "onKeyDown", "onFocus", "onBlur"]) {
    const original = props[name];
    const added = attributes[name];
    if (added) merged[name] = (event) => {
      original?.(event);
      if (!event.defaultPrevented) added(event);
    };
  }
  if (typeof element.type === "string" && !["button", "a", "input"].includes(element.type)) {
    merged.role = props.role ?? "button";
    merged.tabIndex = props.tabIndex ?? 0;
    const keyDown = merged.onKeyDown;
    merged.onKeyDown = (event) => {
      keyDown?.(event);
      if (!event.defaultPrevented && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        event.currentTarget.click();
      }
    };
  }
  return cloneElement(element, merged);
}
function useMenuNavigation(ref, open, close, last = false) {
  useEffect(() => {
    if (!open) return;
    const items = ref.current?.querySelectorAll('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])');
    (last ? items?.[items.length - 1] : items?.[0])?.focus();
  }, [open, last, ref]);
  return (event) => {
    if (event.defaultPrevented) return;
    if (event.key === "Tab") {
      close();
      return;
    }
    const items = Array.from(ref.current?.querySelectorAll('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])') ?? []);
    if (!items.length) return;
    const index = items.indexOf(document.activeElement);
    let next;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && event.key !== " ") {
      next = items.findIndex((_, offset) => items[(index + 1 + offset) % items.length].textContent?.trim().toLowerCase().startsWith(event.key.toLowerCase()));
      if (next < 0) return;
      next = (index + 1 + next) % items.length;
    } else return;
    event.preventDefault();
    items[next]?.focus();
  };
}
function useActivation(active) {
  const activation = useRef({ active: false, order: 0, previousFocus: null });
  if (activation.current.active !== active) {
    activation.current = {
      active,
      order: active ? ++activationOrder : 0,
      previousFocus: active && typeof document !== "undefined" ? document.activeElement : null
    };
  }
  return activation.current;
}
function topTrap() {
  return activeTraps.reduce(
    (top, entry) => !top || entry.order > top.order ? entry : top,
    void 0
  )?.element;
}
function syncInert() {
  originalInert.forEach((inert, element) => {
    element.inert = inert;
  });
  const top = topTrap();
  if (!top) {
    originalInert.clear();
    return;
  }
  const parent = top.parentElement;
  const boundary = parent?.matches("[data-db-react].db-modal-overlay, [data-db-react].db-sheet, [data-db-react].db-drawer, [data-db-react].db-alert-dialog, [data-db-react].db-command") ? parent : top;
  for (let element = boundary; element && element !== document.body; element = element.parentElement) {
    const siblings = element.parentElement?.children;
    if (!siblings) break;
    for (const sibling of Array.from(siblings)) {
      if (sibling === element || !(sibling instanceof HTMLElement)) continue;
      if (!originalInert.has(sibling)) originalInert.set(sibling, sibling.inert);
      sibling.inert = true;
    }
  }
}
function useEscapeKey(onClose, active, ref) {
  const { order } = useActivation(active);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const hasHandler = !!onClose;
  useEffect(() => {
    if (!active || !hasHandler) return;
    const entry = { order };
    escapeHandlers.push(entry);
    const handler = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const top = escapeHandlers.reduce((previous, current) => current.order > previous.order ? current : previous);
      if (top !== entry) return;
      e.preventDefault();
      onCloseRef.current?.();
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      escapeHandlers.splice(escapeHandlers.indexOf(entry), 1);
    };
  }, [active, hasHandler, order, ref]);
}
function useOutsideClick(ref, onClose, active) {
  useEffect(() => {
    if (!active || !onClose) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [active, onClose, ref]);
}
function useFocusTrap(ref, active) {
  const { order, previousFocus } = useActivation(active);
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    if (!activeTraps.length) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    const entry = { element: el, order };
    activeTraps.push(entry);
    syncInert();
    const getFocusable = () => Array.from(el.querySelectorAll(
      "button, [href], input, select, textarea, [tabindex]"
    )).filter((node) => node.tabIndex >= 0 && !node.matches(":disabled") && !node.closest('[hidden], [inert], [aria-hidden="true"]') && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden");
    const originalTabIndex = el.getAttribute("tabindex");
    if (!el.hasAttribute("tabindex")) el.tabIndex = -1;
    if (topTrap() === el && !el.contains(document.activeElement)) (getFocusable()[0] ?? el).focus();
    const handler = (e) => {
      if (e.key !== "Tab" || e.defaultPrevented || topTrap() !== el) return;
      const focusable = getFocusable();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        e.preventDefault();
        el.focus();
        return;
      }
      if (!el.contains(document.activeElement) || document.activeElement === el) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      activeTraps.splice(activeTraps.indexOf(entry), 1);
      syncInert();
      if (originalTabIndex === null) el.removeAttribute("tabindex");
      if (!activeTraps.length) document.body.style.overflow = previousOverflow;
      const remaining = topTrap();
      if (previousFocus?.isConnected && (!remaining || remaining.contains(previousFocus))) previousFocus.focus();
      else remaining?.focus();
    };
  }, [active, order, previousFocus, ref]);
}
var PreviewCard = forwardRef(
  ({ trigger, title, description, media, className, children, onMouseEnter, onMouseLeave, onFocus, onBlur, ...props }, forwardedRef) => {
    const ref = useRef(null);
    const setRef = useMergedRefs(ref, forwardedRef);
    const id = useId();
    const [open, setOpen] = useState(false);
    const close = useCallback(() => setOpen(false), []);
    useEscapeKey(close, open, ref);
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref: setRef,
        "data-db-react": "",
        className: cn("db-preview-card", className),
        ...props,
        onMouseEnter: (event) => {
          onMouseEnter?.(event);
          if (!event.defaultPrevented) setOpen(true);
        },
        onMouseLeave: (event) => {
          onMouseLeave?.(event);
          if (!event.defaultPrevented && !ref.current?.contains(document.activeElement)) close();
        },
        onFocus: (event) => {
          onFocus?.(event);
          if (!event.defaultPrevented) setOpen(true);
        },
        onBlur: (event) => {
          onBlur?.(event);
          if (!event.defaultPrevented && !event.currentTarget.contains(event.relatedTarget)) close();
        },
        children: [
          renderOverlayTrigger(trigger, { className: "db-preview-card__trigger", "aria-describedby": open ? id : void 0 }),
          open && /* @__PURE__ */ jsxs("div", { id, className: "db-preview-card__content", children: [
            media && /* @__PURE__ */ jsx("div", { className: "db-preview-card__media", children: media }),
            title && /* @__PURE__ */ jsx("div", { className: "db-preview-card__title", children: title }),
            description && /* @__PURE__ */ jsx("div", { className: "db-preview-card__desc", children: description }),
            children
          ] })
        ]
      }
    );
  }
);
PreviewCard.displayName = "PreviewCard";
var Image = forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx(
    "img",
    {
      ref,
      className: cn("db-img", className),
      ...props
    }
  )
);
Image.displayName = "Image";
var Chart = forwardRef(
  ({ bars, secondary, className, ...props }, ref) => {
    const boundedBars = bars.map((bar) => ({ ...bar, value: Math.min(100, Math.max(0, Number.isNaN(bar.value) ? 0 : bar.value)) }));
    const description = boundedBars.map((bar, i2) => `${bar.label ?? `Bar ${i2 + 1}`}: ${bar.value}`).join("; ") || "No data";
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          ref,
          "data-db-react": "",
          role: "img",
          "aria-label": props["aria-labelledby"] ? void 0 : description,
          ...props,
          className: cn(
            "db-chart",
            className
          ),
          children: boundedBars.map((bar, i2) => /* @__PURE__ */ jsx(
            "div",
            {
              className: cn("db-chart__bar", secondary && "db-chart__bar--secondary"),
              "aria-hidden": "true",
              style: { height: `${bar.value}%` }
            },
            i2
          ))
        }
      ),
      boundedBars.some((bar) => bar.label) && /* @__PURE__ */ jsx("div", { "data-db-react": "", className: "db-chart__labels", "aria-hidden": "true", children: boundedBars.map((bar, i2) => /* @__PURE__ */ jsx("span", { children: bar.label }, i2)) })
    ] });
  }
);
Chart.displayName = "Chart";
var ButtonGroup = forwardRef(
  ({ className, children, ...props }, ref) => /* @__PURE__ */ jsx("div", { ref, className: cn("db-btn-group", className), role: "group", ...props, "data-db-react": "", children })
);
ButtonGroup.displayName = "ButtonGroup";
var Input = forwardRef(
  ({ error, inputSize, className, ...props }, ref) => /* @__PURE__ */ jsx(
    "input",
    {
      ref,
      "aria-invalid": error || void 0,
      className: cn(
        "db-input",
        inputSize && `db-input--${inputSize}`,
        error && "db-input--error",
        className
      ),
      ...props,
      "data-db-react": ""
    }
  )
);
Input.displayName = "Input";
var Textarea = forwardRef(
  ({ error, className, ...props }, ref) => /* @__PURE__ */ jsx(
    "textarea",
    {
      ref,
      "aria-invalid": error || void 0,
      className: cn("db-textarea", error && "db-textarea--error", className),
      ...props,
      "data-db-react": ""
    }
  )
);
Textarea.displayName = "Textarea";
var NumberField = forwardRef(
  ({ value, defaultValue, onChange, step = 1, min, max, disabled, readOnly, className, "aria-label": ariaLabel, onBlur, ...props }, ref) => {
    const [val, setVal] = useControllable(value, defaultValue ?? min ?? 0, onChange);
    const [draft, setDraft] = useState(null);
    useEffect(() => {
      setDraft(null);
    }, [value]);
    const clamp = (next) => Math.min(max ?? next, Math.max(min ?? next, next));
    const update = (next) => {
      setDraft(null);
      setVal(clamp(next));
    };
    return /* @__PURE__ */ jsxs("div", { className: cn("db-number-field", className), role: "group", "data-db-react": "", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "db-btn db-btn--secondary db-number-field__btn",
          disabled: disabled || readOnly || min !== void 0 && val <= min,
          onClick: () => update(val - step),
          "aria-label": "Decrease",
          children: "-"
        }
      ),
      /* @__PURE__ */ jsx(
        "input",
        {
          ref,
          type: "number",
          className: "db-input",
          value: draft ?? val,
          min,
          max,
          step,
          disabled,
          readOnly,
          "aria-label": ariaLabel ?? "Value",
          onChange: (event) => {
            const text = event.target.value;
            const next = Number(text);
            if (!text || !Number.isFinite(next) || next !== clamp(next)) setDraft(text);
            else {
              setDraft(null);
              setVal(next);
            }
          },
          onBlur: (event) => {
            if (draft !== null) {
              if (draft && Number.isFinite(Number(draft))) update(Number(draft));
              else setDraft(null);
            }
            onBlur?.(event);
          },
          ...props
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "db-btn db-btn--secondary db-number-field__btn",
          disabled: disabled || readOnly || max !== void 0 && val >= max,
          onClick: () => update(val + step),
          "aria-label": "Increase",
          children: "+"
        }
      )
    ] });
  }
);
NumberField.displayName = "NumberField";
function useFormReset(ref, reset, enabled = true) {
  const resetRef = useRef(reset);
  const enabledRef = useRef(enabled);
  resetRef.current = reset;
  enabledRef.current = enabled;
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;
    const form = node.form ?? node.closest("form");
    if (!form) return;
    const handleReset = (event) => {
      queueMicrotask(() => {
        if (!event.defaultPrevented && enabledRef.current && ref.current === node) resetRef.current();
      });
    };
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  });
}
function useResettableControl(controlled, defaultValue, onChange, ref) {
  const resetting = useRef(false);
  const state = useControllable(controlled, defaultValue, (value) => {
    if (!resetting.current) onChange?.(value);
  });
  useFormReset(ref, () => {
    resetting.current = true;
    try {
      state[1](defaultValue);
    } finally {
      resetting.current = false;
    }
  }, controlled === void 0);
  return state;
}
var Checkbox = forwardRef(
  ({ checked, defaultChecked, onChange, label, indeterminate, className, ...props }, ref) => {
    const inputRef = useRef(null);
    const [on, setOn] = useResettableControl(checked, defaultChecked ?? false, onChange, inputRef);
    const setRef = useCallback((node) => {
      inputRef.current = node;
      if (node) node.indeterminate = !!indeterminate;
      if (typeof ref === "function") {
        const cleanup = ref(node);
        if (typeof cleanup === "function") return () => {
          inputRef.current = null;
          cleanup();
        };
      } else if (ref) ref.current = node;
    }, [ref, indeterminate, on]);
    return /* @__PURE__ */ jsxs("label", { className: cn("db-checkbox", className), "data-db-react": "", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          ref: setRef,
          type: "checkbox",
          className: "db-checkbox__input",
          "aria-checked": indeterminate ? "mixed" : void 0,
          checked: on,
          onChange: (event) => {
            if (event.defaultPrevented || event.nativeEvent.defaultPrevented) return;
            setOn(event.target.checked);
            event.target.indeterminate = !!indeterminate;
          },
          ...props
        }
      ),
      /* @__PURE__ */ jsx("span", { className: "db-checkbox__box", "aria-hidden": "true", children: /* @__PURE__ */ jsx("svg", { "aria-hidden": "true", focusable: "false", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ jsx("polyline", { points: "20 6 9 17 4 12" }) }) }),
      label && /* @__PURE__ */ jsx("span", { children: label })
    ] });
  }
);
Checkbox.displayName = "Checkbox";
var Select = forwardRef(
  ({ label, options, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return /* @__PURE__ */ jsxs("div", { className: cn("db-select", className), "data-db-react": "", children: [
      label && /* @__PURE__ */ jsx("label", { className: "db-label", htmlFor: inputId, children: label }),
      /* @__PURE__ */ jsx("select", { ref, id: inputId, className: "db-select__input db-select__native", ...props, children: options?.map((opt) => /* @__PURE__ */ jsx("option", { value: opt.value, children: opt.label }, opt.value)) })
    ] });
  }
);
Select.displayName = "Select";
var Field = forwardRef(
  ({ label, helper, error, htmlFor, className, children, ...props }, ref) => {
    const helperText = typeof error === "string" ? error : helper;
    const id = useId();
    let controlId = htmlFor ?? `${id}-control`;
    let associated = false;
    const associate = (nodes) => Children.map(nodes, (child) => {
      if (!isValidElement(child)) return child;
      const labelable = child.type === Input || child.type === Textarea || child.type === NumberField || child.type === Checkbox || child.type === Select || child.type === "input" || child.type === "textarea" || child.type === "select";
      if (labelable && !associated && (!htmlFor || !child.props.id || child.props.id === htmlFor)) {
        associated = true;
        controlId = child.props.id ?? controlId;
        return cloneElement(child, {
          id: controlId,
          "aria-labelledby": child.props["aria-labelledby"] ?? (label && !child.props["aria-label"] ? `${id}-label` : void 0),
          "aria-invalid": child.props["aria-invalid"] ?? (error ? true : void 0),
          "aria-describedby": [child.props["aria-describedby"], helperText && `${id}-helper`].filter(Boolean).join(" ") || void 0
        });
      }
      return child.props.children ? cloneElement(child, { children: associate(child.props.children) }) : child;
    });
    const controls = associate(children);
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref,
        className: cn("db-field", error && "db-field--error", className),
        ...props,
        "data-db-react": "",
        children: [
          label && /* @__PURE__ */ jsx("label", { id: `${id}-label`, className: "db-label", htmlFor: controlId, children: label }),
          controls,
          helperText && /* @__PURE__ */ jsx("span", { id: `${id}-helper`, className: "db-field__helper", children: helperText })
        ]
      }
    );
  }
);
Field.displayName = "Field";
var Fieldset = forwardRef(
  ({ legend, helper, className, children, ...props }, ref) => {
    const helperId = useId();
    return /* @__PURE__ */ jsxs("fieldset", { ref, className: cn("db-fieldset", className), ...props, "aria-describedby": [props["aria-describedby"], helper ? helperId : void 0].filter(Boolean).join(" ") || void 0, children: [
      legend && /* @__PURE__ */ jsx("legend", { className: "db-fieldset__legend", children: legend }),
      /* @__PURE__ */ jsx("div", { className: "db-fieldset__content", children }),
      helper && /* @__PURE__ */ jsx("span", { id: helperId, className: "db-fieldset__helper", children: helper })
    ] });
  }
);
Fieldset.displayName = "Fieldset";
var InputGroup = forwardRef(
  ({ addonBefore, addonAfter, className, children, ...props }, ref) => /* @__PURE__ */ jsxs("div", { ref, className: cn("db-input-group", className), ...props, children: [
    addonBefore && /* @__PURE__ */ jsx("span", { className: "db-input-group__addon", children: addonBefore }),
    children,
    addonAfter && /* @__PURE__ */ jsx("span", { className: "db-input-group__addon", children: addonAfter })
  ] })
);
InputGroup.displayName = "InputGroup";
var InputIcon = forwardRef(
  ({ icon, right, className, children, ...props }, ref) => /* @__PURE__ */ jsxs(
    "div",
    {
      ref,
      className: cn("db-input-icon", right && "db-input-icon--right", className),
      ...props,
      "data-db-react": "",
      children: [
        icon && /* @__PURE__ */ jsx("span", { className: "db-input-icon__icon", "aria-hidden": "true", children: icon }),
        children
      ]
    }
  )
);
InputIcon.displayName = "InputIcon";
var Search = forwardRef(
  ({ className, placeholder = "Search\u2026", ...props }, ref) => /* @__PURE__ */ jsxs("div", { className: cn("db-search", className), children: [
    /* @__PURE__ */ jsxs(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: "16",
        height: "16",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
        children: [
          /* @__PURE__ */ jsx("circle", { cx: "11", cy: "11", r: "8" }),
          /* @__PURE__ */ jsx("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      "input",
      {
        ref,
        type: "search",
        className: "db-input",
        placeholder,
        ...props
      }
    )
  ] })
);
Search.displayName = "Search";
var Label = forwardRef(
  ({ required, optional, className, children, ...props }, ref) => /* @__PURE__ */ jsxs("label", { ref, className: cn("db-label", className), ...props, children: [
    children,
    required && " *",
    optional && " (optional)"
  ] })
);
Label.displayName = "Label";
var Kbd = forwardRef(
  ({ keys, className, children, ...props }, ref) => {
    if (keys && keys.length > 0) {
      return /* @__PURE__ */ jsx("span", { ref, className, ...props, children: keys.map((key, i2) => /* @__PURE__ */ jsxs("span", { children: [
        i2 > 0 && " + ",
        /* @__PURE__ */ jsx("kbd", { className: "db-kbd", children: key })
      ] }, i2)) });
    }
    return /* @__PURE__ */ jsx("kbd", { ref, className: cn("db-kbd", className), ...props, children });
  }
);
Kbd.displayName = "Kbd";
var Prose = forwardRef(
  ({ size, className, children, ...props }, ref) => /* @__PURE__ */ jsx(
    "article",
    {
      ref,
      className: cn("db-prose", size && `db-prose--${size}`, className),
      ...props,
      children
    }
  )
);
Prose.displayName = "Prose";
var List = forwardRef(
  ({ items, className, children, ...props }, ref) => /* @__PURE__ */ jsxs("div", { ref, "data-db-react": "", role: "list", className: cn("db-list", className), ...props, children: [
    items?.map((item, i2) => /* @__PURE__ */ jsxs("div", { className: "db-list__item", role: "listitem", children: [
      item.icon && /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: item.icon }),
      /* @__PURE__ */ jsxs("div", { className: "db-list__content", children: [
        /* @__PURE__ */ jsx("span", { className: "db-list__title", children: item.title }),
        item.secondary && /* @__PURE__ */ jsx("span", { className: "db-list__secondary", children: item.secondary })
      ] })
    ] }, i2)),
    children
  ] })
);
List.displayName = "List";
var Table = forwardRef(
  ({ columns, rows, sortable, className, style, ...props }, ref) => {
    const [sort, setSort] = useState(null);
    const activeSort = sortable && sort && sort.column < columns.length ? sort : null;
    const ordered = rows.map((row, index) => ({ row, index }));
    if (activeSort) ordered.sort((a, b) => {
      const left = a.row[activeSort.column] ?? "";
      const right = b.row[activeSort.column] ?? "";
      const numeric = String(left).trim() !== "" && String(right).trim() !== "" && Number.isFinite(Number(left)) && Number.isFinite(Number(right));
      const compare = numeric ? Number(left) - Number(right) : String(left).localeCompare(String(right), void 0, { numeric: true });
      return (activeSort.direction === "ascending" ? compare : -compare) || a.index - b.index;
    });
    return /* @__PURE__ */ jsx("div", { "data-db-react": "", className: cn("db-table", sortable && "db-table--sortable", className), style: { overflowX: "auto", ...style }, ...props, children: /* @__PURE__ */ jsxs("table", { ref, style: { width: "100%" }, children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { children: columns.map((col, i2) => /* @__PURE__ */ jsx("th", { scope: "col", "aria-sort": activeSort?.column === i2 ? activeSort.direction : void 0, children: sortable ? /* @__PURE__ */ jsx("button", { type: "button", className: "db-btn db-btn--ghost", "aria-label": `Sort by ${col}`, onClick: () => setSort({ column: i2, direction: activeSort?.column === i2 && activeSort.direction === "ascending" ? "descending" : "ascending" }), children: col }) : col }, i2)) }) }),
      /* @__PURE__ */ jsx("tbody", { children: ordered.map(({ row, index: i2 }) => /* @__PURE__ */ jsx("tr", { children: row.map((cell, j) => /* @__PURE__ */ jsx("td", { children: cell }, j)) }, i2)) })
    ] }) });
  }
);
Table.displayName = "Table";
var DataTable = forwardRef(
  ({ columns, rows, selectable, sort, defaultSort = null, onSortChange, selectedRows, defaultSelectedRows = [], onSelectionChange, selectAllLabel = "Select all rows", getRowLabel, className, style, ...props }, ref) => {
    const [sorting, setSorting] = useControllable(sort, defaultSort, onSortChange);
    const [selection, setSelection] = useControllable(selectedRows, defaultSelectedRows, onSelectionChange);
    const selected = new Set(selection.filter((index) => Number.isInteger(index) && index >= 0 && index < rows.length));
    const allSelected = rows.length > 0 && selected.size === rows.length;
    const activeSort = sorting && columns[sorting.column]?.sortable ? sorting : null;
    const ordered = rows.map((row, index) => ({ row, index }));
    if (activeSort) ordered.sort((a, b) => {
      const left = a.row[activeSort.column] ?? "";
      const right = b.row[activeSort.column] ?? "";
      const numeric = String(left).trim() !== "" && String(right).trim() !== "" && Number.isFinite(Number(left)) && Number.isFinite(Number(right));
      const compare = numeric ? Number(left) - Number(right) : String(left).localeCompare(String(right), void 0, { numeric: true });
      return (activeSort.direction === "ascending" ? compare : -compare) || a.index - b.index;
    });
    const toggleSort = (column) => setSorting({ column, direction: activeSort?.column === column && activeSort.direction === "ascending" ? "descending" : "ascending" });
    return /* @__PURE__ */ jsx("div", { "data-db-react": "", className: cn("db-data-table", className), style: { overflowX: "auto", ...style }, ...props, children: /* @__PURE__ */ jsxs("table", { ref, style: { width: "100%" }, children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
        selectable && /* @__PURE__ */ jsx("th", { scope: "col", children: /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            className: "db-data-table__check",
            "aria-label": selectAllLabel,
            checked: allSelected,
            disabled: rows.length === 0,
            ref: (node) => {
              if (node) node.indeterminate = selected.size > 0 && !allSelected;
            },
            onChange: (event) => setSelection(event.target.checked ? rows.map((_, index) => index) : [])
          }
        ) }),
        columns.map((col, i2) => /* @__PURE__ */ jsx("th", { scope: "col", "data-sortable": col.sortable || void 0, "aria-sort": activeSort?.column === i2 ? activeSort.direction : void 0, children: col.sortable ? /* @__PURE__ */ jsxs("button", { type: "button", className: "db-btn db-btn--ghost", "aria-label": `Sort by ${col.label}`, onClick: () => toggleSort(i2), children: [
          col.label,
          /* @__PURE__ */ jsx("span", { className: "db-data-table__sort", "aria-hidden": "true", children: "\u2191" })
        ] }) : col.label }, i2))
      ] }) }),
      /* @__PURE__ */ jsxs("tbody", { children: [
        ordered.map(({ row, index: i2 }) => /* @__PURE__ */ jsxs("tr", { "data-selected": selectable && selected.has(i2) ? "" : void 0, children: [
          selectable && /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("input", { type: "checkbox", className: "db-data-table__check", "aria-label": getRowLabel?.(row, i2) ?? `Select row ${i2 + 1}`, checked: selected.has(i2), onChange: (event) => {
            const next = new Set(selected);
            if (event.target.checked) next.add(i2);
            else next.delete(i2);
            setSelection([...next].sort((a, b) => a - b));
          } }) }),
          row.map((cell, j) => /* @__PURE__ */ jsx("td", { children: cell }, j))
        ] }, i2)),
        rows.length === 0 && /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { className: "db-data-table__empty", colSpan: Math.max(1, columns.length + (selectable ? 1 : 0)), children: "No data" }) })
      ] })
    ] }) });
  }
);
DataTable.displayName = "DataTable";
var Chip = forwardRef(
  ({ color, active, closable, onClose, closeLabel = "Remove chip", className, children, ...props }, ref) => /* @__PURE__ */ jsxs(
    "span",
    {
      ref,
      "data-db-react": "",
      className: cn(
        "db-chip",
        color && `db-chip--${color}`,
        active && "db-chip--active",
        className
      ),
      ...props,
      children: [
        children,
        closable && /* @__PURE__ */ jsx("button", { className: "db-chip__close", onClick: onClose, type: "button", "aria-label": closeLabel, children: "\xD7" })
      ]
    }
  )
);
Chip.displayName = "Chip";
var Breadcrumbs = forwardRef(
  ({ items, className, ...props }, ref) => /* @__PURE__ */ jsx(
    "nav",
    {
      ref,
      "data-db-react": "",
      "aria-label": "Breadcrumb",
      ...props,
      className: cn("db-breadcrumbs", className),
      children: /* @__PURE__ */ jsx("ol", { children: items.map((item, i2) => {
        const isLast = i2 === items.length - 1;
        return /* @__PURE__ */ jsx("li", { children: isLast ? /* @__PURE__ */ jsx("span", { "aria-current": "page", children: item.label }) : item.href ? /* @__PURE__ */ jsx("a", { href: item.href, children: item.label }) : /* @__PURE__ */ jsx("span", { children: item.label }) }, i2);
      }) })
    }
  )
);
Breadcrumbs.displayName = "Breadcrumbs";
function getPages(current, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i2) => i2 + 1);
  }
  const pages = [1];
  if (current > 3) pages.push("ellipsis");
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  for (let i2 = start; i2 <= end; i2++) pages.push(i2);
  if (current < totalPages - 2) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}
var Pagination = forwardRef(
  ({ current, total, perPage = 10, onChange, disabled, className, ...props }, ref) => {
    const pageSize = Number.isFinite(perPage) && perPage > 0 ? perPage : 10;
    const totalPages = Math.max(1, Math.ceil((Number.isFinite(total) ? Math.max(0, total) : 0) / pageSize));
    const selected = Math.min(totalPages, Math.max(1, Number.isFinite(current) ? Math.trunc(current) : 1));
    const pages = getPages(selected, totalPages);
    return /* @__PURE__ */ jsxs(
      "nav",
      {
        ref,
        "aria-label": "Pagination",
        ...props,
        "data-db-react": "",
        className: cn("db-pagination", className),
        children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "db-pagination__btn db-pagination__prev",
              disabled: disabled || selected <= 1,
              onClick: () => onChange?.(selected - 1),
              "aria-label": "Previous page",
              children: "Prev"
            }
          ),
          pages.map(
            (page, i2) => page === "ellipsis" ? /* @__PURE__ */ jsx("span", { className: "db-pagination__ellipsis", children: "\u2026" }, `e${i2}`) : /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                disabled,
                className: cn(
                  "db-pagination__btn",
                  "db-pagination__page",
                  page === selected && "db-pagination__page--active"
                ),
                "aria-current": page === selected ? "page" : void 0,
                "aria-label": `Page ${page}`,
                onClick: () => onChange?.(page),
                children: page
              },
              page
            )
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "db-pagination__btn db-pagination__next",
              disabled: disabled || selected >= totalPages,
              onClick: () => onChange?.(selected + 1),
              "aria-label": "Next page",
              children: "Next"
            }
          )
        ]
      }
    );
  }
);
Pagination.displayName = "Pagination";
var NavMenu = forwardRef(
  ({ items, className, ...props }, ref) => /* @__PURE__ */ jsx("nav", { ref, "data-db-react": "", ...props, className: cn("db-nav-menu", className), children: items.map((item, i2) => {
    const Tag = item.href ? "a" : item.onClick ? "button" : "span";
    return /* @__PURE__ */ jsx(
      Tag,
      {
        href: item.href,
        type: Tag === "button" ? "button" : void 0,
        onClick: item.onClick,
        className: cn(
          "db-nav-menu__item",
          item.active && "db-nav-menu__item--active"
        ),
        "aria-current": item.active ? "page" : void 0,
        children: item.label
      },
      i2
    );
  }) })
);
NavMenu.displayName = "NavMenu";
var BottomNav = forwardRef(
  ({ items, className, ...props }, ref) => /* @__PURE__ */ jsx("nav", { ref, "data-db-react": "", ...props, className: cn("db-bottom-nav", className), children: items.map((item, i2) => {
    const Tag = item.href ? "a" : item.onClick ? "button" : "span";
    return /* @__PURE__ */ jsxs(
      Tag,
      {
        href: item.href,
        type: Tag === "button" ? "button" : void 0,
        onClick: item.onClick,
        className: cn(
          "db-bottom-nav__item",
          item.active && "db-bottom-nav__item--active"
        ),
        "aria-current": item.active ? "page" : void 0,
        children: [
          item.icon && /* @__PURE__ */ jsx("span", { className: "db-bottom-nav__icon", "aria-hidden": "true", children: item.icon }),
          /* @__PURE__ */ jsx("span", { className: "db-bottom-nav__label", children: item.label }),
          item.badge && /* @__PURE__ */ jsx("span", { className: "db-bottom-nav__badge", children: item.badge })
        ]
      },
      i2
    );
  }) })
);
BottomNav.displayName = "BottomNav";
var Stepper = forwardRef(
  ({ steps, vertical, className, ...props }, ref) => /* @__PURE__ */ jsx(
    "div",
    {
      ref,
      "data-db-react": "",
      role: "list",
      ...props,
      className: cn(
        "db-stepper",
        vertical && "db-stepper--vertical",
        className
      ),
      children: steps.map((step, i2) => /* @__PURE__ */ jsxs(
        "div",
        {
          role: "listitem",
          "aria-current": step.active ? "step" : void 0,
          className: cn(
            "db-stepper__step",
            !step.completed && !step.active && "db-stepper__step--pending",
            step.completed && "db-stepper__step--completed",
            step.active && "db-stepper__step--active"
          ),
          children: [
            /* @__PURE__ */ jsx("div", { className: "db-stepper__indicator", children: step.completed ? "\u2713" : i2 + 1 }),
            /* @__PURE__ */ jsx("span", { className: "db-stepper__label", children: step.label })
          ]
        },
        i2
      ))
    }
  )
);
Stepper.displayName = "Stepper";
var Navbar = forwardRef(
  ({ brand, brandHref, children, className, open, defaultOpen, onOpenChange, disabled, onKeyDown, ...props }, ref) => {
    const [isOpen, setOpen] = useControllable(open, defaultOpen ?? false, onOpenChange);
    const id = useId();
    const toggleRef = useRef(null);
    return /* @__PURE__ */ jsxs("nav", { ref, ...props, className: cn("db-navbar", isOpen && "db-navbar--open", className), "data-db-react": "", onKeyDown: (event) => {
      onKeyDown?.(event);
      if (!event.defaultPrevented && event.key === "Escape" && isOpen) {
        event.preventDefault();
        setOpen(false);
        toggleRef.current?.focus();
      }
    }, children: [
      brand && (brandHref ? /* @__PURE__ */ jsx("a", { className: "db-navbar__brand", href: brandHref, children: brand }) : /* @__PURE__ */ jsx("span", { className: "db-navbar__brand", children: brand })),
      /* @__PURE__ */ jsx("button", { ref: toggleRef, className: "db-navbar__toggle", type: "button", "aria-label": "Toggle navigation", "aria-expanded": isOpen, "aria-controls": `${id}-nav`, disabled, onClick: () => setOpen(!isOpen), children: /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "\u2630" }) }),
      /* @__PURE__ */ jsx("div", { id: `${id}-nav`, className: "db-navbar__nav", children })
    ] });
  }
);
Navbar.displayName = "Navbar";
var HoverCard = forwardRef(
  ({ trigger, content, className, children, onMouseEnter, onMouseLeave, onFocus, onBlur, ...props }, forwardedRef) => {
    const ref = useRef(null);
    const setRef = useMergedRefs(ref, forwardedRef);
    const id = useId();
    const [open, setOpen] = useState(false);
    const close = useCallback(() => setOpen(false), []);
    useEscapeKey(close, open, ref);
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref: setRef,
        "data-db-react": "",
        ...props,
        className: cn("db-hover-card", open && "db-hover-card--open", className),
        onMouseEnter: (event) => {
          onMouseEnter?.(event);
          if (!event.defaultPrevented) setOpen(true);
        },
        onMouseLeave: (event) => {
          onMouseLeave?.(event);
          if (!event.defaultPrevented && !ref.current?.contains(document.activeElement)) close();
        },
        onFocus: (event) => {
          onFocus?.(event);
          if (!event.defaultPrevented) setOpen(true);
        },
        onBlur: (event) => {
          onBlur?.(event);
          if (!event.defaultPrevented && !event.currentTarget.contains(event.relatedTarget)) close();
        },
        children: [
          renderOverlayTrigger(trigger, { className: "db-hover-card__trigger", "aria-describedby": open ? id : void 0 }),
          open && /* @__PURE__ */ jsxs("div", { id, className: "db-hover-card__content", children: [
            content,
            children
          ] })
        ]
      }
    );
  }
);
HoverCard.displayName = "HoverCard";
var PortalThemeContext = createContext(void 0);
var portalTextStyle = { color: "var(--db-color-text)", fontFamily: "var(--db-font-body)" };
function ThemeProvider({ theme, children }) {
  const inherited = useContext(PortalThemeContext);
  return /* @__PURE__ */ jsx(PortalThemeContext.Provider, { value: theme ?? inherited, children: /* @__PURE__ */ jsx("div", { "data-db-react": "", "data-theme": theme, style: { ...portalTextStyle, backgroundColor: "var(--db-color-bg)" }, children }) });
}
ThemeProvider.displayName = "ThemeProvider";
var Tabs = forwardRef(
  ({ tabs, activeTab, defaultActiveTab = 0, onChange, orientation = "horizontal", tabListProps, className, ...props }, ref) => {
    const [current, setCurrent] = useControllable(activeTab, defaultActiveTab, onChange);
    const id = useId();
    const selected = tabs[current] && !tabs[current].disabled ? current : tabs.findIndex((tab) => !tab.disabled);
    return /* @__PURE__ */ jsxs("div", { ref, className: cn("db-tabs", className), ...props, "data-db-react": "", children: [
      /* @__PURE__ */ jsx("div", { ...tabListProps, className: cn("db-tabs__list", tabListProps?.className), role: "tablist", "aria-orientation": orientation, "aria-label": tabListProps?.["aria-label"] ?? props["aria-label"], onKeyDown: (event) => {
        tabListProps?.onKeyDown?.(event);
        if (event.defaultPrevented) return;
        const buttons = Array.from(event.currentTarget.querySelectorAll('[role="tab"]')).filter((button) => !button.disabled);
        const index = buttons.indexOf(document.activeElement);
        if (index < 0) return;
        const rtl = orientation === "horizontal" && getComputedStyle(event.currentTarget).direction === "rtl";
        const direction = rtl ? -1 : 1;
        let next;
        if (event.key === (orientation === "vertical" ? "ArrowDown" : "ArrowRight")) next = (index + direction + buttons.length) % buttons.length;
        else if (event.key === (orientation === "vertical" ? "ArrowUp" : "ArrowLeft")) next = (index - direction + buttons.length) % buttons.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = buttons.length - 1;
        else return;
        event.preventDefault();
        buttons[next]?.focus();
        setCurrent(Number(buttons[next].dataset.index));
      }, children: tabs.map((t, i2) => /* @__PURE__ */ jsx(
        "button",
        {
          className: cn("db-tabs__tab", i2 === selected && "db-tabs__tab--active"),
          role: "tab",
          id: `${id}-tab-${i2}`,
          "aria-controls": `${id}-panel-${i2}`,
          "data-index": i2,
          disabled: t.disabled,
          "aria-selected": i2 === selected,
          tabIndex: i2 === selected ? 0 : -1,
          onClick: () => setCurrent(i2),
          type: "button",
          children: t.label
        },
        i2
      )) }),
      tabs.map((tab, i2) => /* @__PURE__ */ jsx("div", { className: "db-tabs__panel", role: "tabpanel", id: `${id}-panel-${i2}`, "aria-labelledby": `${id}-tab-${i2}`, hidden: i2 !== selected, tabIndex: 0, children: i2 === selected && tab.content }, i2))
    ] });
  }
);
Tabs.displayName = "Tabs";
var Accordion = forwardRef(
  ({ items, multi = false, openItems, defaultOpenItems = [], onChange, className, ...props }, ref) => {
    const [open, setOpen] = useControllable(openItems, defaultOpenItems, onChange);
    const id = useId();
    const toggle = (index) => {
      if (open.includes(index)) {
        setOpen(open.filter((i2) => i2 !== index));
      } else {
        setOpen(multi ? [...open, index] : [index]);
      }
    };
    const navigate = (event) => {
      const owner = event.currentTarget.closest(".db-accordion");
      const triggers = Array.from(owner?.querySelectorAll(".db-accordion__trigger") ?? []).filter((trigger) => trigger.closest(".db-accordion") === owner && !trigger.disabled);
      const index = triggers.indexOf(event.currentTarget);
      const next = { ArrowDown: (index + 1) % triggers.length, ArrowUp: (index + triggers.length - 1) % triggers.length, Home: 0, End: triggers.length - 1 }[event.key];
      if (next !== void 0 && triggers[next]) {
        event.preventDefault();
        triggers[next].focus();
      }
    };
    return /* @__PURE__ */ jsx("div", { ref, "data-db-react": "", className: cn("db-accordion", className), ...props, children: items.map((item, i2) => {
      const isOpen = open.includes(i2);
      return /* @__PURE__ */ jsxs("div", { className: cn("db-accordion__item", isOpen && "db-accordion__item--open"), children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            id: `${id}-trigger-${i2}`,
            className: "db-accordion__trigger",
            "aria-expanded": isOpen,
            "aria-controls": `${id}-panel-${i2}`,
            disabled: item.disabled,
            onClick: () => toggle(i2),
            onKeyDown: navigate,
            type: "button",
            children: [
              item.trigger,
              /* @__PURE__ */ jsx("span", { className: "db-accordion__icon", "aria-hidden": "true", children: "\u25B8" })
            ]
          }
        ),
        /* @__PURE__ */ jsx("div", { id: `${id}-panel-${i2}`, className: "db-accordion__content", role: "region", "aria-labelledby": `${id}-trigger-${i2}`, hidden: !isOpen, children: item.content })
      ] }, i2);
    }) });
  }
);
Accordion.displayName = "Accordion";
var CustomSelect = forwardRef(
  ({ value, defaultValue = "", onChange, options, placeholder = "Select...", searchable = false, disabled = false, className, onKeyDown, ...props }, ref) => {
    const [selected, setSelected] = useControllable(value, defaultValue, onChange);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef(null);
    const triggerRef = useRef(null);
    const searchRef = useRef(null);
    const id = useId();
    const [activeIndex, setActiveIndex] = useState(-1);
    const setRefs = useCallback(
      (node) => {
        containerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );
    useEffect(() => {
      if (!isOpen) return;
      const handleClick = (e) => {
        if (containerRef.current && !containerRef.current.contains(e.target)) {
          setIsOpen(false);
          setSearch("");
        }
      };
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [isOpen]);
    useEffect(() => {
      if (isOpen && searchable) searchRef.current?.focus();
    }, [isOpen, searchable]);
    const filtered = search ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())) : options;
    const selectedLabel = options.find((o) => o.value === selected)?.label;
    const activeOption = filtered[activeIndex];
    const activeId = activeOption && !activeOption.disabled ? `${id}-option-${options.indexOf(activeOption)}` : void 0;
    const isDisabled = disabled || props["aria-disabled"] === true || props["aria-disabled"] === "true";
    useEffect(() => {
      if (isDisabled) {
        setIsOpen(false);
        setSearch("");
      }
    }, [isDisabled]);
    useEffect(() => {
      if (isOpen && activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
    }, [activeId, isOpen]);
    const close = (restoreFocus = false) => {
      setIsOpen(false);
      setSearch("");
      if (restoreFocus) triggerRef.current?.focus();
    };
    const choose = (option) => {
      if (isDisabled || option.disabled) return;
      setSelected(option.value);
      close(true);
    };
    const move = (direction) => {
      const enabled = filtered.map((option, index2) => option.disabled ? -1 : index2).filter((index2) => index2 >= 0);
      if (!enabled.length) {
        setActiveIndex(-1);
        return;
      }
      const index = enabled.indexOf(isOpen ? activeIndex : filtered.findIndex((option) => option.value === selected));
      const nextIndex = index < 0 ? direction > 0 ? 0 : enabled.length - 1 : (index + direction + enabled.length) % enabled.length;
      setActiveIndex(enabled[nextIndex]);
    };
    return /* @__PURE__ */ jsxs("div", { ref: setRefs, "data-db-react": "", className: cn("db-custom-select", isOpen && "db-custom-select--open", className), ...props, onKeyDown: (event) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || isDisabled) return;
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      } else if (event.key === "Tab") {
        close();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        move(event.key === "ArrowDown" ? 1 : -1);
        setIsOpen(true);
      } else if (isOpen && (event.key === "Home" || event.key === "End") && event.target === triggerRef.current) {
        event.preventDefault();
        const indices = filtered.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0);
        setActiveIndex(event.key === "Home" ? indices[0] ?? -1 : indices[indices.length - 1] ?? -1);
      } else if (isOpen && (event.key === "Enter" || event.key === " " && event.target === triggerRef.current)) {
        event.preventDefault();
        if (activeOption) choose(activeOption);
      }
    }, children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          ref: triggerRef,
          className: "db-custom-select__trigger",
          role: "combobox",
          "aria-label": props["aria-label"],
          "aria-labelledby": props["aria-labelledby"],
          "aria-describedby": props["aria-describedby"],
          "aria-haspopup": "listbox",
          "aria-controls": `${id}-listbox`,
          "aria-expanded": isOpen,
          "aria-activedescendant": isOpen && !searchable ? activeId : void 0,
          disabled: isDisabled,
          onClick: () => {
            if (isOpen) close();
            else {
              setActiveIndex(filtered.findIndex((option) => option.value === selected && !option.disabled));
              setIsOpen(true);
            }
          },
          type: "button",
          children: /* @__PURE__ */ jsx("span", { className: selectedLabel ? "db-custom-select__value" : "db-custom-select__placeholder", children: selectedLabel || placeholder })
        }
      ),
      isOpen && /* @__PURE__ */ jsxs("div", { className: "db-custom-select__dropdown", children: [
        searchable && /* @__PURE__ */ jsx("div", { className: "db-custom-select__search", children: /* @__PURE__ */ jsx(
          "input",
          {
            ref: searchRef,
            className: "db-input db-input--sm",
            "aria-label": "Search options",
            "aria-controls": `${id}-listbox`,
            "aria-activedescendant": activeId,
            placeholder: "Search...",
            value: search,
            onChange: (e) => {
              setSearch(e.target.value);
              setActiveIndex(-1);
            }
          }
        ) }),
        /* @__PURE__ */ jsxs("div", { id: `${id}-listbox`, role: "listbox", "aria-label": props["aria-label"] ?? "Options", children: [
          filtered.map((opt) => /* @__PURE__ */ jsx(
            "div",
            {
              id: `${id}-option-${options.indexOf(opt)}`,
              role: "option",
              "aria-selected": opt.value === selected,
              "aria-disabled": opt.disabled || void 0,
              style: opt === activeOption && !opt.disabled ? { boxShadow: "var(--db-focus-ring)" } : void 0,
              className: cn("db-custom-select__option", opt.value === selected && "db-custom-select__option--selected", opt.disabled && "db-custom-select__option--disabled"),
              onClick: () => choose(opt),
              onMouseEnter: () => {
                if (!opt.disabled) setActiveIndex(filtered.indexOf(opt));
              },
              children: opt.label
            },
            opt.value
          )),
          !filtered.length && /* @__PURE__ */ jsx("div", { role: "status", className: "db-custom-select__option", children: "No options found" })
        ] })
      ] })
    ] });
  }
);
CustomSelect.displayName = "CustomSelect";
var DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
function toDateString(d2) {
  const y = d2.getFullYear();
  const m = String(d2.getMonth() + 1).padStart(2, "0");
  const day = String(d2.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function getDays(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const days = [];
  for (let i2 = -startDay; i2 < 42 - startDay; i2++) {
    const d2 = new Date(year, month, 1 + i2);
    days.push(d2);
    if (i2 >= 0 && d2.getMonth() !== month && d2.getDay() === 6) break;
  }
  return days;
}
var Calendar = forwardRef(
  ({ selected, defaultSelected = "", onChange, month: initialMonth, onMonthChange, disabled, min, max, className, onKeyDown, ...props }, ref) => {
    const [value, setValue] = useControllable(selected, defaultSelected, onChange);
    const parseDate = (text) => {
      if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return void 0;
      const date = /* @__PURE__ */ new Date(`${text}T00:00`);
      return Number.isFinite(date.getTime()) && toDateString(date) === text ? date : void 0;
    };
    const [displayed, setDisplayed] = useState(() => initialMonth && Number.isFinite(initialMonth.getTime()) ? initialMonth : parseDate(value) ?? /* @__PURE__ */ new Date());
    const [focused, setFocused] = useState(value);
    const rootRef = useRef(null);
    const pendingFocus = useRef(false);
    const titleId = useId();
    const monthTime = initialMonth?.getTime();
    useEffect(() => {
      if (monthTime === void 0 || !Number.isFinite(monthTime)) return;
      const next = new Date(monthTime);
      setDisplayed(next);
      const selection = parseDate(value);
      setFocused(selection && selection.getFullYear() === next.getFullYear() && selection.getMonth() === next.getMonth() ? value : toDateString(new Date(next.getFullYear(), next.getMonth(), 1)));
    }, [monthTime]);
    useEffect(() => {
      if (!pendingFocus.current) return;
      rootRef.current?.querySelector(`[data-date="${focused}"]`)?.focus();
      pendingFocus.current = false;
    }, [focused, displayed]);
    const year = displayed.getFullYear();
    const mo = displayed.getMonth();
    const days = getDays(year, mo);
    const todayStr = toDateString(/* @__PURE__ */ new Date());
    const monthName = displayed.toLocaleString("default", { month: "long" });
    const minimum = parseDate(min) ? min : void 0;
    const maximum = parseDate(max) ? max : void 0;
    const unavailable = (date) => !!disabled || !!minimum && date < minimum || !!maximum && date > maximum;
    const enabledDays = days.filter((date) => !unavailable(toDateString(date)));
    const tabDate = enabledDays.find((date) => toDateString(date) === focused) ?? enabledDays.find((date) => toDateString(date) === value) ?? enabledDays.find((date) => toDateString(date) === todayStr) ?? enabledDays.find((date) => date.getMonth() === mo) ?? enabledDays[0];
    const changeMonth = (next) => {
      setDisplayed(next);
      setFocused(toDateString(next));
      onMonthChange?.(next);
    };
    const navigate = (date) => {
      let next = date;
      if (minimum && toDateString(next) < minimum) next = parseDate(minimum);
      if (maximum && toDateString(next) > maximum) next = parseDate(maximum);
      pendingFocus.current = true;
      setFocused(toDateString(next));
      if (next.getFullYear() !== year || next.getMonth() !== mo) {
        const month = new Date(next.getFullYear(), next.getMonth(), 1);
        setDisplayed(month);
        onMonthChange?.(month);
      }
    };
    return /* @__PURE__ */ jsxs("div", { ref: (node) => {
      rootRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    }, className: cn("db-calendar", className), ...props, "data-db-react": "", onKeyDown: (event) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || disabled) return;
      const dateString = event.target.dataset.date;
      const date = parseDate(dateString);
      if (!date) return;
      let next = new Date(date);
      const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
      if (event.key === "ArrowRight") next.setDate(next.getDate() + (rtl ? -1 : 1));
      else if (event.key === "ArrowLeft") next.setDate(next.getDate() + (rtl ? 1 : -1));
      else if (event.key === "ArrowDown") next.setDate(next.getDate() + 7);
      else if (event.key === "ArrowUp") next.setDate(next.getDate() - 7);
      else if (event.key === "Home") next.setDate(next.getDate() - next.getDay());
      else if (event.key === "End") next.setDate(next.getDate() + 6 - next.getDay());
      else if (event.key === "PageUp" || event.key === "PageDown") {
        const amount = (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1);
        next = new Date(date.getFullYear(), date.getMonth() + amount, 1);
        next.setDate(Math.min(date.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      } else return;
      event.preventDefault();
      navigate(next);
    }, children: [
      /* @__PURE__ */ jsxs("div", { className: "db-calendar__header", children: [
        /* @__PURE__ */ jsx("button", { className: "db-calendar__nav", "aria-label": "Previous month", disabled: disabled || !!minimum && toDateString(new Date(year, mo, 0)) < minimum, onClick: () => changeMonth(new Date(year, mo - 1, 1)), type: "button", children: "\u2039" }),
        /* @__PURE__ */ jsxs("span", { id: titleId, className: "db-calendar__title", "aria-live": "polite", children: [
          monthName,
          " ",
          year
        ] }),
        /* @__PURE__ */ jsx("button", { className: "db-calendar__nav", "aria-label": "Next month", disabled: disabled || !!maximum && toDateString(new Date(year, mo + 1, 1)) > maximum, onClick: () => changeMonth(new Date(year, mo + 1, 1)), type: "button", children: "\u203A" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "db-calendar__grid", role: "grid", "aria-labelledby": titleId, children: [
        /* @__PURE__ */ jsx("div", { role: "row", style: { display: "contents" }, children: DAY_NAMES.map((d2) => /* @__PURE__ */ jsx("span", { className: "db-calendar__day-label", role: "columnheader", children: d2 }, d2)) }),
        Array.from({ length: days.length / 7 }, (_, week) => /* @__PURE__ */ jsx("div", { role: "row", style: { display: "contents" }, children: days.slice(week * 7, week * 7 + 7).map((d2) => {
          const ds = toDateString(d2);
          const inMonth = d2.getMonth() === mo;
          return /* @__PURE__ */ jsx(
            "button",
            {
              role: "gridcell",
              "data-date": ds,
              "aria-label": d2.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
              "aria-selected": ds === value,
              "aria-current": ds === todayStr ? "date" : void 0,
              disabled: unavailable(ds),
              tabIndex: tabDate && ds === toDateString(tabDate) ? 0 : -1,
              className: cn(
                "db-calendar__day",
                ds === value && "db-calendar__day--selected",
                ds === todayStr && "db-calendar__day--today",
                !inMonth && "db-calendar__day--outside",
                unavailable(ds) && "db-calendar__day--disabled"
              ),
              onFocus: () => setFocused(ds),
              onClick: () => {
                setFocused(ds);
                setValue(ds);
              },
              type: "button",
              children: d2.getDate()
            },
            ds
          );
        }) }, week))
      ] })
    ] });
  }
);
Calendar.displayName = "Calendar";
var DatePicker = forwardRef(
  ({ value, defaultValue = "", onChange, label, placeholder = "Select date", disabled, name, min, max, inputProps, className, onKeyDown, onBlur, ...props }, ref) => {
    const [val, setVal] = useControllable(value, defaultValue, onChange);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const id = useId();
    const inputId = inputProps?.id ?? `${id}-input`;
    const blocked = disabled || inputProps?.disabled;
    const close = () => {
      setIsOpen(false);
      inputRef.current?.focus();
    };
    useEffect(() => {
      if (blocked) {
        setIsOpen(false);
        return;
      }
      if (isOpen) containerRef.current?.querySelector('.db-calendar__day[tabindex="0"]')?.focus();
    }, [isOpen, blocked]);
    const setRefs = useCallback(
      (node) => {
        containerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );
    useEffect(() => {
      if (!isOpen) return;
      const handleClick = (e) => {
        if (containerRef.current && !containerRef.current.contains(e.target)) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [isOpen]);
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref: setRefs,
        className: cn("db-date-picker", isOpen && !blocked && "db-date-picker--open", className),
        ...props,
        "data-db-react": "",
        onKeyDown: (event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || blocked) return;
          if (event.key === "Escape" && isOpen) {
            event.preventDefault();
            event.stopPropagation();
            close();
          } else if (event.target === inputRef.current && ["ArrowDown", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            setIsOpen(true);
          }
        },
        onBlur: (event) => {
          onBlur?.(event);
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
        },
        children: [
          label && /* @__PURE__ */ jsx("label", { className: "db-label", htmlFor: inputId, children: label }),
          /* @__PURE__ */ jsx(
            "input",
            {
              ...inputProps,
              ref: inputRef,
              id: inputId,
              name: name ?? inputProps?.name,
              className: cn("db-input db-date-picker__trigger", inputProps?.className),
              role: "combobox",
              "aria-label": inputProps?.["aria-label"] ?? props["aria-label"] ?? (label ? void 0 : placeholder),
              "aria-labelledby": inputProps?.["aria-labelledby"] ?? props["aria-labelledby"],
              "aria-describedby": inputProps?.["aria-describedby"] ?? props["aria-describedby"],
              "aria-haspopup": "dialog",
              "aria-controls": isOpen && !blocked ? `${id}-dialog` : void 0,
              "aria-expanded": isOpen && !blocked,
              disabled: blocked,
              value: val,
              placeholder,
              readOnly: true,
              onClick: (event) => {
                inputProps?.onClick?.(event);
                if (!event.defaultPrevented && !blocked) setIsOpen(!isOpen);
              },
              onKeyDown: (event) => inputProps?.onKeyDown?.(event)
            }
          ),
          isOpen && !blocked && /* @__PURE__ */ jsx("div", { id: `${id}-dialog`, className: "db-date-picker__dropdown", role: "dialog", "aria-label": label ?? props["aria-label"] ?? "Choose date", children: /* @__PURE__ */ jsx(
            Calendar,
            {
              selected: val,
              min,
              max,
              onChange: (date) => {
                setVal(date);
                close();
              }
            }
          ) })
        ]
      }
    );
  }
);
DatePicker.displayName = "DatePicker";
var Carousel = forwardRef(
  ({ current, defaultCurrent = 0, onChange, autoplay = false, duration = 5e3, previousLabel = "Previous slide", nextLabel = "Next slide", disabled = false, className, children, onFocus, onBlur, onMouseEnter, onMouseLeave, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture, onClickCapture, onKeyDownCapture, onDragStart, ...props }, ref) => {
    const slides = Children.toArray(children);
    const count = slides.length;
    const [idx, setIdx] = useControllable(current, defaultCurrent, onChange);
    const active = Math.max(0, Math.min(count - 1, Number.isFinite(idx) ? Math.floor(idx) : 0));
    const [focused, setFocused] = useState(false);
    const [hovered, setHovered] = useState(false);
    const trackRef = useRef(null);
    const swipe = useRef(null);
    const suppressClick = useRef(false);
    const clickTimer = useRef(void 0);
    const disabledControl = disabled || props["aria-disabled"] === true || props["aria-disabled"] === "true" || /\bdb-[\w-]+--(?:disabled|loading)\b/.test(className ?? "");
    const isDisabled = (element) => {
      if (disabledControl) return true;
      for (let node = element; node; node = node.parentElement) {
        if (node.matches(':disabled, [disabled], [aria-disabled="true"], [inert]') || /\bdb-[\w-]+--(?:disabled|loading)\b/.test(node.getAttribute("class") ?? "")) return true;
      }
      return false;
    };
    const clearClick = () => {
      suppressClick.current = false;
      window.clearTimeout(clickTimer.current);
    };
    const endSwipe = (event, commit) => {
      const start = swipe.current;
      if (!start || start.id !== event.pointerId) return;
      swipe.current = null;
      if (commit && count > 1 && !isDisabled(start.track)) {
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        const threshold = Math.max(30, Math.min(80, event.currentTarget.clientWidth * 0.15));
        if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.25) {
          setIdx((active + (dx < 0 ? 1 : -1) + count) % count);
          clearClick();
          suppressClick.current = true;
          clickTimer.current = window.setTimeout(() => {
            suppressClick.current = false;
          }, 350);
        }
      }
      if (start.track.hasPointerCapture(event.pointerId)) start.track.releasePointerCapture(event.pointerId);
    };
    useEffect(() => {
      const track = trackRef.current;
      if (track && getComputedStyle(track).touchAction === "auto") track.style.touchAction = "pan-y";
      return () => {
        window.clearTimeout(clickTimer.current);
        const start = swipe.current;
        swipe.current = null;
        if (start?.track.hasPointerCapture(start.id)) start.track.releasePointerCapture(start.id);
      };
    }, []);
    const prev = () => {
      if (count > 1 && !isDisabled(trackRef.current)) setIdx((active - 1 + count) % count);
    };
    const next = () => {
      if (count > 1 && !isDisabled(trackRef.current)) setIdx((active + 1) % count);
    };
    useEffect(() => {
      if (!autoplay || count <= 1 || focused || hovered || disabledControl || !Number.isFinite(duration) || duration <= 0) return;
      const id = setInterval(() => {
        if (!swipe.current && !isDisabled(trackRef.current)) setIdx((active + 1) % count);
      }, duration);
      return () => clearInterval(id);
    }, [autoplay, duration, count, active, focused, hovered, disabledControl, setIdx]);
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref,
        "data-db-react": "",
        role: "region",
        "aria-roledescription": "carousel",
        "aria-label": props["aria-labelledby"] ? void 0 : "Carousel",
        className: cn("db-carousel", className),
        ...props,
        "aria-disabled": disabled ? true : props["aria-disabled"],
        onFocus: (event) => {
          onFocus?.(event);
          setFocused(true);
        },
        onBlur: (event) => {
          onBlur?.(event);
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        },
        onMouseEnter: (event) => {
          onMouseEnter?.(event);
          setHovered(true);
        },
        onMouseLeave: (event) => {
          onMouseLeave?.(event);
          setHovered(false);
        },
        onPointerDown: (event) => {
          onPointerDown?.(event);
          const track = trackRef.current;
          if (event.defaultPrevented || swipe.current || count <= 1 || !event.isPrimary || event.button !== 0 || event.pointerType !== "touch" && event.pointerType !== "pen" || !track || !track.contains(event.target) || isDisabled(event.target)) return;
          if (event.target.closest('button, input, select, textarea, [contenteditable]:not([contenteditable="false"])')) return;
          clearClick();
          swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY, track, horizontal: false };
        },
        onPointerMove: (event) => {
          onPointerMove?.(event);
          const start = swipe.current;
          if (!start || event.pointerId !== start.id) return;
          if (event.defaultPrevented || isDisabled(start.track)) {
            endSwipe(event, false);
            return;
          }
          const dx = event.clientX - start.x, dy = event.clientY - start.y;
          if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
            endSwipe(event, false);
            return;
          }
          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.25) {
            start.horizontal = true;
            if (!start.track.hasPointerCapture(event.pointerId)) start.track.setPointerCapture(event.pointerId);
            event.preventDefault();
          }
        },
        onPointerUp: (event) => {
          onPointerUp?.(event);
          endSwipe(event, !event.defaultPrevented);
        },
        onPointerCancel: (event) => {
          onPointerCancel?.(event);
          endSwipe(event, false);
        },
        onLostPointerCapture: (event) => {
          onLostPointerCapture?.(event);
          if (event.target === swipe.current?.track) endSwipe(event, false);
        },
        onClickCapture: (event) => {
          onClickCapture?.(event);
          if (suppressClick.current && trackRef.current?.contains(event.target)) {
            clearClick();
            event.preventDefault();
            event.stopPropagation();
          }
        },
        onKeyDownCapture: (event) => {
          onKeyDownCapture?.(event);
          if (!event.defaultPrevented && trackRef.current?.contains(event.target)) clearClick();
        },
        onDragStart: (event) => {
          onDragStart?.(event);
          if (!event.defaultPrevented && swipe.current?.horizontal && trackRef.current?.contains(event.target)) event.preventDefault();
        },
        children: [
          /* @__PURE__ */ jsx("div", { ref: trackRef, className: "db-carousel__track", "aria-live": autoplay && !focused && !hovered ? "off" : "polite", style: { transform: `translateX(-${active * 100}%)` }, children: slides.map((child, i2) => /* @__PURE__ */ jsx("div", { ref: (node) => {
            if (node) node.inert = i2 !== active;
          }, className: "db-carousel__slide", role: "group", "aria-roledescription": "slide", "aria-label": `${i2 + 1} of ${count}`, "aria-hidden": i2 !== active, children: child }, i2)) }),
          /* @__PURE__ */ jsx("button", { className: "db-carousel__btn db-carousel__btn--prev db-carousel__prev", "aria-label": previousLabel, disabled: disabledControl || count <= 1, onClick: prev, type: "button", children: "\u2039" }),
          /* @__PURE__ */ jsx("button", { className: "db-carousel__btn db-carousel__btn--next db-carousel__next", "aria-label": nextLabel, disabled: disabledControl || count <= 1, onClick: next, type: "button", children: "\u203A" }),
          /* @__PURE__ */ jsx("div", { className: "db-carousel__dots", children: slides.map((_, i2) => /* @__PURE__ */ jsx(
            "button",
            {
              className: cn("db-carousel__dot", i2 === active && "db-carousel__dot--active"),
              onClick: () => {
                if (!isDisabled(trackRef.current)) setIdx(i2);
              },
              disabled: disabledControl,
              type: "button",
              "aria-label": `Slide ${i2 + 1}`,
              "aria-current": i2 === active ? "true" : void 0
            },
            i2
          )) })
        ]
      }
    );
  }
);
Carousel.displayName = "Carousel";
function mapControlChildren(children, control, map, boundary) {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    if (child.type === control) return map(child);
    if (child.type === boundary || child.props.children === void 0) return child;
    return cloneElement(child, { children: mapControlChildren(child.props.children, control, map, boundary) });
  });
}
var CheckboxGroup = forwardRef(
  ({ label, helper, inline, value, defaultValue, onValueChange, disabled, className, children, ...props }, ref) => {
    const id = useId();
    const rootRef = useRef(null);
    const [selected, setSelected] = useResettableControl(value, defaultValue ?? [], onValueChange, rootRef);
    const setRef = useCallback((node) => {
      rootRef.current = node;
      if (typeof ref === "function") {
        const cleanup = ref(node);
        if (typeof cleanup === "function") return () => {
          rootRef.current = null;
          cleanup();
        };
      } else if (ref) ref.current = node;
    }, [ref]);
    const coordinated = value !== void 0 || defaultValue !== void 0 || onValueChange !== void 0;
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref: setRef,
        className: cn("db-checkbox-group", inline && "db-checkbox-group--inline", className),
        role: "group",
        "aria-labelledby": label ? `${id}-label` : void 0,
        "aria-disabled": disabled || void 0,
        ...props,
        "data-db-react": "",
        "aria-describedby": [props["aria-describedby"], helper && `${id}-helper`].filter(Boolean).join(" ") || void 0,
        children: [
          label && /* @__PURE__ */ jsx("span", { id: `${id}-label`, className: "db-checkbox-group__label", children: label }),
          mapControlChildren(children, Checkbox, (child) => {
            const key = child.props.value === void 0 ? void 0 : String(child.props.value);
            return cloneElement(child, {
              disabled: disabled || child.props.disabled,
              ...coordinated && key !== void 0 ? {
                checked: selected.includes(key),
                onChange: (checked) => {
                  if (disabled || child.props.disabled) return;
                  child.props.onChange?.(checked);
                  setSelected(checked ? [...selected, key] : selected.filter((entry) => entry !== key));
                }
              } : {}
            });
          }, CheckboxGroup),
          helper && /* @__PURE__ */ jsx("span", { id: `${id}-helper`, className: "db-checkbox-group__helper", children: helper })
        ]
      }
    );
  }
);
CheckboxGroup.displayName = "CheckboxGroup";
var Radio = forwardRef(
  ({ checked, defaultChecked, onChange, label, name, value, className, ...props }, ref) => {
    return /* @__PURE__ */ jsxs("label", { "data-db-react": "", className: cn("db-radio", className), children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          ref,
          className: "db-radio__input",
          type: "radio",
          name,
          value,
          checked,
          defaultChecked,
          onChange: (event) => onChange?.(event.target.checked),
          ...props
        }
      ),
      /* @__PURE__ */ jsx("span", { className: "db-radio__circle" }),
      label && /* @__PURE__ */ jsx("span", { children: label })
    ] });
  }
);
Radio.displayName = "Radio";
var RadioGroup = forwardRef(
  ({ value, defaultValue, onChange, name, options = [], disabled, required, className, ...props }, ref) => {
    const [selected, setSelected] = useControllable(value, defaultValue ?? "", onChange);
    const generatedName = useId();
    return /* @__PURE__ */ jsx("div", { ref, className: cn("db-radio-group", className), role: "radiogroup", "aria-disabled": disabled || void 0, ...props, "data-db-react": "", children: options.map((opt) => /* @__PURE__ */ jsx(
      Radio,
      {
        name: name ?? generatedName,
        value: opt.value,
        label: opt.label,
        checked: selected === opt.value,
        disabled: disabled || opt.disabled,
        required,
        onChange: () => setSelected(opt.value)
      },
      opt.value
    )) });
  }
);
RadioGroup.displayName = "RadioGroup";
var Switch = forwardRef(
  ({ checked, defaultChecked, onChange, label, disabled, className, onClick, onKeyDown, tabIndex, "aria-disabled": ariaDisabled, ...props }, ref) => {
    const [on, setOn] = useControllable(checked, defaultChecked ?? false, onChange);
    const isDisabled = disabled || ariaDisabled === true || ariaDisabled === "true";
    const toggle = () => setOn(!on);
    const handleKeyDown = (e) => {
      onKeyDown?.(e);
      if (!isDisabled && !e.defaultPrevented && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        toggle();
      }
    };
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref,
        className: cn("db-switch", on && "db-switch--on", className),
        role: "switch",
        "aria-checked": on,
        "aria-disabled": isDisabled || ariaDisabled,
        tabIndex: isDisabled ? -1 : tabIndex ?? 0,
        onClick: (e) => {
          onClick?.(e);
          if (!isDisabled && !e.defaultPrevented) toggle();
        },
        onKeyDown: handleKeyDown,
        ...props,
        "data-db-react": "",
        children: [
          /* @__PURE__ */ jsx("span", { className: "db-switch__track", children: /* @__PURE__ */ jsx("span", { className: "db-switch__thumb" }) }),
          label && /* @__PURE__ */ jsx("span", { children: label })
        ]
      }
    );
  }
);
Switch.displayName = "Switch";
var Slider = forwardRef(
  ({ value, defaultValue, onChange, min = 0, max = 100, step = 1, label, disabled, name, form, inputProps, className, ...props }, ref) => {
    const [val, setVal] = useControllable(value, defaultValue ?? min, onChange);
    const generatedId = useId();
    const inputId = inputProps?.id ?? generatedId;
    return /* @__PURE__ */ jsxs("div", { className: cn("db-slider", className), ...props, "data-db-react": "", children: [
      label && /* @__PURE__ */ jsxs("label", { className: "db-slider__label", htmlFor: inputId, children: [
        label,
        /* @__PURE__ */ jsx("span", { className: "db-slider__value", "aria-hidden": "true", children: val })
      ] }),
      /* @__PURE__ */ jsx(
        "input",
        {
          ...inputProps,
          ref,
          id: inputId,
          type: "range",
          name: name ?? inputProps?.name,
          form: form ?? inputProps?.form,
          disabled: disabled || inputProps?.disabled,
          "aria-label": inputProps?.["aria-label"] ?? props["aria-label"],
          "aria-labelledby": inputProps?.["aria-labelledby"] ?? props["aria-labelledby"],
          "aria-describedby": inputProps?.["aria-describedby"] ?? props["aria-describedby"],
          className: cn("db-slider__input", inputProps?.className),
          min,
          max,
          step,
          value: val,
          onChange: (e) => setVal(+e.target.value)
        }
      )
    ] });
  }
);
Slider.displayName = "Slider";
var Toggle = forwardRef(
  ({ pressed, defaultPressed, onChange, size, className, children, onClick, ...props }, ref) => {
    const [on, setOn] = useControllable(pressed, defaultPressed ?? false, onChange);
    return /* @__PURE__ */ jsx(
      "button",
      {
        ref,
        type: "button",
        className: cn(
          "db-toggle",
          on && "db-toggle--active",
          size && `db-toggle--${size}`,
          className
        ),
        "aria-pressed": on,
        onClick: (event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setOn(!on);
        },
        ...props,
        "data-db-react": "",
        children
      }
    );
  }
);
Toggle.displayName = "Toggle";
var ToggleGroup = forwardRef(
  ({ value, defaultValue, onChange, multiple, values, defaultValues, onValuesChange, disabled, className, children, ...props }, ref) => {
    const rootRef = useRef(null);
    const [selected, setSelected] = useResettableControl(value, defaultValue ?? "", onChange, rootRef);
    const [selectedValues, setSelectedValues] = useResettableControl(values, defaultValues ?? (defaultValue ? defaultValue.split(",") : []), onValuesChange, rootRef);
    const setRef = useCallback((node) => {
      rootRef.current = node;
      if (typeof ref === "function") {
        const cleanup = ref(node);
        if (typeof cleanup === "function") return () => {
          rootRef.current = null;
          cleanup();
        };
      } else if (ref) ref.current = node;
    }, [ref]);
    const arrayMode = values !== void 0 || defaultValues !== void 0;
    const active = multiple ? arrayMode ? selectedValues : selected.split(",").filter(Boolean) : [selected];
    return /* @__PURE__ */ jsx(
      "div",
      {
        ref: setRef,
        className: cn("db-toggle-group", className),
        role: "group",
        "aria-disabled": disabled || void 0,
        ...props,
        "data-db-react": "",
        children: mapControlChildren(children, Toggle, (child) => {
          if (child.props.value === void 0) return child;
          const key = String(child.props.value);
          return cloneElement(child, {
            pressed: active.includes(key),
            disabled: disabled || child.props.disabled,
            onChange: (pressed) => {
              if (disabled || child.props.disabled) return;
              child.props.onChange?.(pressed);
              if (multiple) {
                const next = pressed ? [...active, key] : active.filter((entry) => entry !== key);
                if (arrayMode) setSelectedValues(next);
                else onValuesChange?.(next);
                if (!arrayMode || onChange) setSelected(next.join(","));
              } else setSelected(pressed ? key : "");
            }
          });
        }, ToggleGroup)
      }
    );
  }
);
ToggleGroup.displayName = "ToggleGroup";
var InputOTP = forwardRef(
  ({ length = 6, value, defaultValue = "", onChange, separator, disabled, readOnly, required, name, className, onKeyDown, onPaste, ...props }, ref) => {
    const count = Number.isFinite(length) ? Math.max(1, Math.trunc(length)) : 6;
    const digits = (text) => text.replace(/[^0-9]/g, "").slice(0, count);
    const [internal, setInternal] = useState(() => digits(defaultValue).split(""));
    const pending = useRef(null);
    const slotsRef = useRef([]);
    const rootRef = useRef(null);
    const setRef = useCallback((node) => {
      rootRef.current = node;
      if (typeof ref === "function") {
        const cleanup = ref(node);
        if (typeof cleanup === "function") return () => {
          rootRef.current = null;
          cleanup();
        };
      } else if (ref) ref.current = node;
    }, [ref]);
    useFormReset(rootRef, () => {
      pending.current = null;
      setInternal(digits(defaultValue).split(""));
    }, value === void 0);
    const source = value === void 0 ? internal : pending.current?.value === value ? pending.current.slots : digits(value).split("");
    const values = Array.from({ length: count }, (_, i2) => source[i2] ?? "");
    const blocked = disabled || readOnly || props["aria-disabled"] === true || props["aria-disabled"] === "true";
    const focusSlot = (index) => {
      slotsRef.current[index]?.focus();
      slotsRef.current[index]?.select();
    };
    const update = (next) => {
      if (blocked) return;
      const nextValue = next.join("");
      pending.current = { value: nextValue, slots: next };
      if (value === void 0) setInternal(next);
      onChange?.(nextValue);
    };
    const handleInput = (index, text) => {
      if (blocked) return;
      const incoming = digits(text);
      if (text && !incoming) return;
      const next = [...values];
      if (!incoming) next[index] = "";
      else incoming.split("").slice(0, count - index).forEach((char, offset) => {
        next[index + offset] = char;
      });
      update(next);
      if (incoming) focusSlot(Math.min(count - 1, index + incoming.length));
    };
    const handleKeyDown = (index, event) => {
      if (event.defaultPrevented) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? count - 1 : index + (event.key === "ArrowLeft" ? -1 : 1);
        focusSlot(Math.max(0, Math.min(count - 1, next)));
      } else if (!blocked && (event.key === "Backspace" || event.key === "Delete")) {
        event.preventDefault();
        const next = [...values];
        const target = event.key === "Backspace" && !next[index] && index > 0 ? index - 1 : index;
        next[target] = "";
        update(next);
        focusSlot(target);
      }
    };
    const slots = values.map((char, i2) => {
      const slot = /* @__PURE__ */ jsx(
        "input",
        {
          ref: (el) => {
            slotsRef.current[i2] = el;
          },
          className: "db-otp__input db-otp__slot",
          type: "text",
          inputMode: "numeric",
          pattern: "[0-9]*",
          autoComplete: i2 === 0 ? "one-time-code" : "off",
          maxLength: count,
          disabled,
          readOnly,
          required,
          "aria-label": `Digit ${i2 + 1} of ${count}`,
          "aria-invalid": props["aria-invalid"],
          "aria-describedby": props["aria-describedby"],
          value: char,
          onFocus: (event) => event.target.select(),
          onChange: (e) => handleInput(i2, e.target.value)
        },
        i2
      );
      if (separator !== void 0 && i2 === separator - 1 && i2 < count - 1) {
        return /* @__PURE__ */ jsxs("span", { className: "db-otp__group", children: [
          slot,
          /* @__PURE__ */ jsx("span", { className: "db-otp__separator", "aria-hidden": "true", children: "-" })
        ] }, `s${i2}`);
      }
      return slot;
    });
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref: setRef,
        className: cn("db-otp", className),
        role: "group",
        "aria-label": "Verification code",
        ...props,
        "data-db-react": "",
        onKeyDown: (event) => {
          onKeyDown?.(event);
          const index = slotsRef.current.indexOf(event.target);
          if (!event.defaultPrevented && index >= 0) handleKeyDown(index, event);
        },
        onPaste: (event) => {
          onPaste?.(event);
          const index = slotsRef.current.indexOf(event.target);
          if (event.defaultPrevented || index < 0) return;
          event.preventDefault();
          handleInput(index, event.clipboardData.getData("text"));
        },
        children: [
          name && /* @__PURE__ */ jsx("input", { type: "hidden", name, value: values.join(""), disabled }),
          slots
        ]
      }
    );
  }
);
InputOTP.displayName = "InputOTP";
var Modal = forwardRef(function Modal2({ open, onClose, title, footer, className, children, ...props }, forwardedRef) {
  const ref = useRef(null);
  const setRef = useMergedRefs(ref, forwardedRef);
  const theme = useContext(PortalThemeContext);
  const titleId = useId();
  const labelledBy = props["aria-labelledby"] ?? (!props["aria-label"] && title ? titleId : void 0);
  useEscapeKey(onClose, open, ref);
  useFocusTrap(ref, open);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    /* @__PURE__ */ jsx("div", { "data-db-react": "", "data-theme": theme, style: portalTextStyle, className: "db-modal-overlay db-modal--open", onClick: onClose, children: /* @__PURE__ */ jsxs(
      "div",
      {
        ...props,
        ref: setRef,
        className: cn("db-modal", className),
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": labelledBy,
        "aria-label": props["aria-label"] ?? (labelledBy ? void 0 : "Dialog"),
        tabIndex: -1,
        onClick: (e) => {
          props.onClick?.(e);
          e.stopPropagation();
        },
        children: [
          title && /* @__PURE__ */ jsxs("div", { className: "db-modal__header", children: [
            /* @__PURE__ */ jsx("h3", { id: titleId, className: "db-modal__title", children: title }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "db-modal__close", "aria-label": "Close", onClick: onClose, children: "\xD7" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "db-modal__body", children }),
          footer && /* @__PURE__ */ jsx("div", { className: "db-modal__footer", children: footer })
        ]
      }
    ) }),
    document.body
  );
});
var AlertDialog = forwardRef(function AlertDialog2({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "info",
  ...props
}, forwardedRef) {
  const ref = useRef(null);
  const setRef = useMergedRefs(ref, forwardedRef);
  const theme = useContext(PortalThemeContext);
  const titleId = useId();
  const descriptionId = useId();
  useEscapeKey(onClose, open, ref);
  useFocusTrap(ref, open);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    /* @__PURE__ */ jsxs("div", { "data-db-react": "", "data-theme": theme, style: portalTextStyle, className: "db-alert-dialog db-alert-dialog--open", onClick: onClose, children: [
      /* @__PURE__ */ jsx("div", { className: "db-alert-dialog__overlay" }),
      /* @__PURE__ */ jsxs(
        "div",
        {
          ...props,
          ref: setRef,
          className: cn("db-alert-dialog__panel", props.className),
          role: "alertdialog",
          "aria-modal": "true",
          "aria-labelledby": props["aria-labelledby"] ?? (props["aria-label"] ? void 0 : titleId),
          "aria-describedby": [props["aria-describedby"], description ? descriptionId : void 0].filter(Boolean).join(" ") || void 0,
          tabIndex: -1,
          onClick: (e) => {
            props.onClick?.(e);
            e.stopPropagation();
          },
          children: [
            /* @__PURE__ */ jsx("h3", { id: titleId, className: "db-alert-dialog__title", children: title }),
            description && /* @__PURE__ */ jsx("p", { id: descriptionId, className: "db-alert-dialog__desc", children: description }),
            /* @__PURE__ */ jsxs("div", { className: "db-alert-dialog__actions", children: [
              /* @__PURE__ */ jsx("button", { type: "button", className: "db-btn db-btn--ghost", onClick: onClose, children: cancelLabel }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  className: "db-btn db-btn--primary",
                  onClick: () => {
                    onConfirm?.();
                    onClose();
                  },
                  children: confirmLabel
                }
              )
            ] })
          ]
        }
      )
    ] }),
    document.body
  );
});
var Sheet = forwardRef(function Sheet2({ open, onClose, side = "right", title, children, ...props }, forwardedRef) {
  const ref = useRef(null);
  const setRef = useMergedRefs(ref, forwardedRef);
  const theme = useContext(PortalThemeContext);
  const titleId = useId();
  const labelledBy = props["aria-labelledby"] ?? (!props["aria-label"] && title ? titleId : void 0);
  useEscapeKey(onClose, open, ref);
  useFocusTrap(ref, open);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    /* @__PURE__ */ jsxs("div", { "data-db-react": "", "data-theme": theme, style: portalTextStyle, className: cn("db-sheet", `db-sheet--${side}`, "db-sheet--open"), onClick: onClose, children: [
      /* @__PURE__ */ jsx("div", { className: "db-sheet__overlay" }),
      /* @__PURE__ */ jsxs(
        "div",
        {
          ...props,
          ref: setRef,
          className: cn("db-sheet__panel", props.className),
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": labelledBy,
          "aria-label": props["aria-label"] ?? (labelledBy ? void 0 : "Sheet"),
          tabIndex: -1,
          onClick: (e) => {
            props.onClick?.(e);
            e.stopPropagation();
          },
          children: [
            /* @__PURE__ */ jsxs("div", { className: "db-sheet__header", children: [
              title && /* @__PURE__ */ jsx("h3", { id: titleId, className: "db-sheet__title", children: title }),
              /* @__PURE__ */ jsx("button", { type: "button", className: "db-sheet__close", "aria-label": "Close", onClick: onClose, children: "\xD7" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "db-sheet__body", children })
          ]
        }
      )
    ] }),
    document.body
  );
});
var Drawer = forwardRef(function Drawer2({ open, onClose, children, ...props }, forwardedRef) {
  const ref = useRef(null);
  const setRef = useMergedRefs(ref, forwardedRef);
  const theme = useContext(PortalThemeContext);
  useEscapeKey(onClose, open, ref);
  useFocusTrap(ref, open);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    /* @__PURE__ */ jsxs("div", { "data-db-react": "", "data-theme": theme, style: portalTextStyle, className: "db-drawer db-drawer--open", onClick: onClose, children: [
      /* @__PURE__ */ jsx("div", { className: "db-drawer__overlay" }),
      /* @__PURE__ */ jsxs(
        "div",
        {
          ...props,
          ref: setRef,
          className: cn("db-drawer__panel", props.className),
          role: "dialog",
          "aria-modal": "true",
          "aria-label": props["aria-label"] ?? (props["aria-labelledby"] ? void 0 : "Drawer"),
          tabIndex: -1,
          onClick: (e) => {
            props.onClick?.(e);
            e.stopPropagation();
          },
          children: [
            /* @__PURE__ */ jsx("div", { className: "db-drawer__handle" }),
            /* @__PURE__ */ jsx("div", { className: "db-drawer__body", children })
          ]
        }
      )
    ] }),
    document.body
  );
});
function Toast({ id, type = "info", title, message, onDismiss, dismissLabel = "Dismiss notification", role }) {
  return /* @__PURE__ */ jsxs("div", { "data-db-react": "", role: role ?? (type === "error" ? "alert" : "status"), "aria-atomic": "true", className: cn("db-toast", `db-toast--${type}`), children: [
    /* @__PURE__ */ jsxs("div", { className: "db-toast__content", children: [
      title && /* @__PURE__ */ jsx("strong", { children: title }),
      /* @__PURE__ */ jsx("span", { children: message })
    ] }),
    /* @__PURE__ */ jsx("button", { type: "button", "aria-label": dismissLabel, className: "db-btn db-btn--ghost db-btn--icon", onClick: () => onDismiss(id), children: "\xD7" })
  ] });
}
var ToastContext = createContext(null);
var uid = 0;
function ToastProvider({ children }) {
  const theme = useContext(PortalThemeContext);
  const [toasts, setToasts] = useState([]);
  const timers = useRef(/* @__PURE__ */ new Map());
  const dismiss = useCallback((id) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t2) => t2.id !== id));
  }, []);
  const toast = useCallback((opts) => {
    const id = `toast-${++uid}`;
    const duration = opts.duration ?? 4e3;
    const item = { id, type: opts.type, title: opts.title, message: opts.message, duration };
    setToasts((prev) => [...prev, item]);
    if (duration > 0) {
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
    }
  }, [dismiss]);
  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, []);
  return /* @__PURE__ */ jsxs(ToastContext.Provider, { value: { toast }, children: [
    children,
    toasts.length > 0 && createPortal(
      /* @__PURE__ */ jsx("div", { "data-db-react": "", "data-theme": theme, style: portalTextStyle, className: "db-toast-stack", children: toasts.map((t) => /* @__PURE__ */ jsx(Toast, { id: t.id, type: t.type, title: t.title, message: t.message, onDismiss: dismiss }, t.id)) }),
      document.body
    )
  ] });
}
function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
var Tooltip = forwardRef(function Tooltip2({
  content,
  position = "top",
  children,
  className
}, forwardedRef) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  const setRef = useMergedRefs(ref, forwardedRef);
  const id = useId();
  const close = useCallback(() => setVisible(false), []);
  useEscapeKey(close, visible, ref);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref: setRef,
      "data-db-react": "",
      className: cn("db-tooltip", visible && "db-tooltip--open", className),
      onMouseEnter: () => setVisible(true),
      onMouseLeave: () => {
        if (!ref.current?.contains(document.activeElement)) close();
      },
      children: [
        renderOverlayTrigger(children, {
          className: "db-tooltip__trigger",
          "aria-describedby": visible ? id : void 0,
          onFocus: () => setVisible(true),
          onBlur: close
        }),
        visible && /* @__PURE__ */ jsx(
          "div",
          {
            className: cn("db-tooltip__content", `db-tooltip__content--${position}`),
            role: "tooltip",
            id,
            children: content
          }
        )
      ]
    }
  );
});
Tooltip.displayName = "Tooltip";
var Popover = forwardRef(
  ({
    trigger,
    content,
    position = "bottom",
    open,
    defaultOpen = false,
    onChange,
    className
  }, forwardedRef) => {
    const internalRef = useRef(null);
    const setRefs = useMergedRefs(internalRef, forwardedRef);
    const id = useId();
    const labelId = triggerId(trigger, `${id}-trigger`);
    const [isOpen, setIsOpen] = useControllable(open, defaultOpen, onChange);
    const close = useCallback(() => {
      setIsOpen(false);
      internalRef.current?.querySelector(".db-popover__trigger")?.focus();
    }, [setIsOpen]);
    const dismiss = useCallback(() => setIsOpen(false), [setIsOpen]);
    const toggle = useCallback(() => setIsOpen(!isOpen), [setIsOpen, isOpen]);
    useOutsideClick(internalRef, dismiss, isOpen);
    useEscapeKey(close, isOpen, internalRef);
    return /* @__PURE__ */ jsxs("div", { ref: setRefs, "data-db-react": "", className: cn("db-popover", isOpen && "db-popover--open", className), children: [
      renderOverlayTrigger(trigger, {
        id: labelId,
        className: "db-popover__trigger",
        "aria-haspopup": "dialog",
        "aria-expanded": isOpen,
        "aria-controls": `${id}-content`,
        onClick: toggle
      }),
      isOpen && /* @__PURE__ */ jsx(
        "div",
        {
          id: `${id}-content`,
          role: "dialog",
          "aria-labelledby": labelId,
          className: cn(
            "db-popover__content",
            `db-popover__content--${position}`
          ),
          children: content
        }
      )
    ] });
  }
);
Popover.displayName = "Popover";
var DropdownMenu = forwardRef(function DropdownMenu2({
  trigger,
  items,
  align = "left",
  className
}, forwardedRef) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const setRef = useMergedRefs(ref, forwardedRef);
  const menuRef = useRef(null);
  const id = useId();
  const labelId = triggerId(trigger, `${id}-trigger`);
  const [last, setLast] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
    ref.current?.querySelector(".db-dropdown__trigger")?.focus();
  }, []);
  const dismiss = useCallback(() => setOpen(false), []);
  const handleMenuKey = useMenuNavigation(menuRef, open, close, last);
  useOutsideClick(ref, dismiss, open);
  useEscapeKey(close, open, ref);
  return /* @__PURE__ */ jsxs("div", { ref: setRef, "data-db-react": "", className: cn("db-dropdown", open && "db-dropdown--open", className), children: [
    renderOverlayTrigger(trigger, {
      id: labelId,
      className: "db-dropdown__trigger",
      "aria-haspopup": "menu",
      "aria-expanded": open,
      "aria-controls": `${id}-menu`,
      onClick: () => {
        setLast(false);
        setOpen(!open);
      },
      onKeyDown: (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setLast(event.key === "ArrowUp");
          setOpen(true);
        }
      }
    }),
    open && /* @__PURE__ */ jsx("div", { ref: menuRef, id: `${id}-menu`, role: "menu", "aria-labelledby": labelId, className: cn("db-dropdown__menu", `db-dropdown__menu--${align}`), onKeyDown: handleMenuKey, children: items.map(
      (item, i2) => item.divider ? /* @__PURE__ */ jsx("hr", { role: "separator", className: "db-dropdown__separator" }, i2) : /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          role: "menuitem",
          tabIndex: -1,
          className: cn(
            "db-dropdown__item",
            item.disabled && "db-dropdown__item--disabled"
          ),
          onClick: () => {
            item.onClick?.();
            close();
          },
          disabled: item.disabled,
          children: [
            item.icon && /* @__PURE__ */ jsx("span", { className: "db-dropdown__icon", "aria-hidden": "true", children: item.icon }),
            item.label
          ]
        },
        i2
      )
    ) })
  ] });
});
DropdownMenu.displayName = "DropdownMenu";
var ContextMenu = forwardRef(function ContextMenu2({ items, children, className }, forwardedRef) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef(null);
  const ref = useRef(null);
  const setRef = useMergedRefs(ref, forwardedRef);
  const invoker = useRef(null);
  const id = useId();
  const close = useCallback(() => {
    setOpen(false);
    invoker.current?.focus();
  }, []);
  const dismiss = useCallback(() => setOpen(false), []);
  const handleMenuKey = useMenuNavigation(menuRef, open, close);
  const handleRightClick = useCallback(
    (e) => {
      e.preventDefault();
      invoker.current = e.target instanceof HTMLElement ? e.target.closest("button, a, input, [tabindex]") ?? ref.current : ref.current;
      setPos({ x: e.clientX, y: e.clientY });
      setOpen(true);
    },
    []
  );
  useOutsideClick(menuRef, dismiss, open);
  useEscapeKey(close, open, menuRef);
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const box = menuRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(pos.x, window.innerWidth - box.width));
    const y = Math.max(0, Math.min(pos.y, window.innerHeight - box.height));
    if (x !== pos.x || y !== pos.y) setPos({ x, y });
  }, [open, pos]);
  return /* @__PURE__ */ jsxs("div", { ref: setRef, "data-db-react": "", className, tabIndex: 0, "aria-haspopup": "menu", "aria-controls": `${id}-menu`, onContextMenu: handleRightClick, onKeyDown: (event) => {
    if (event.defaultPrevented || menuRef.current?.contains(event.target)) return;
    if (event.key === "ContextMenu" || event.shiftKey && event.key === "F10") {
      event.preventDefault();
      invoker.current = document.activeElement;
      const box = invoker.current.getBoundingClientRect();
      setPos({ x: box.left, y: box.bottom });
      setOpen(true);
    }
  }, children: [
    children,
    open && /* @__PURE__ */ jsx(
      "div",
      {
        ref: menuRef,
        id: `${id}-menu`,
        role: "menu",
        "aria-label": "Context menu",
        className: "db-context-menu db-context-menu--open",
        onKeyDown: handleMenuKey,
        onClick: (event) => event.stopPropagation(),
        style: { position: "fixed", top: pos.y, left: pos.x },
        children: items.map(
          (item, i2) => item.divider ? /* @__PURE__ */ jsx("hr", { role: "separator", className: "db-context-menu__separator" }, i2) : /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              role: "menuitem",
              tabIndex: -1,
              className: cn(
                "db-context-menu__item",
                item.disabled && "db-context-menu__item--disabled"
              ),
              onClick: () => {
                item.onClick?.();
                close();
              },
              disabled: item.disabled,
              children: item.label
            },
            i2
          )
        )
      }
    )
  ] });
});
ContextMenu.displayName = "ContextMenu";
var CommandPalette = forwardRef(function CommandPalette2({
  open,
  onClose,
  groups,
  placeholder = "Type a command...",
  className,
  ...props
}, forwardedRef) {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(-1);
  const [previousOpen, setPreviousOpen] = useState(open);
  if (open !== previousOpen) {
    setPreviousOpen(open);
    if (open) {
      setSearch("");
      setActive(-1);
    }
  }
  const ref = useRef(null);
  const setRef = useMergedRefs(ref, forwardedRef);
  const theme = useContext(PortalThemeContext);
  const id = useId();
  useEscapeKey(onClose, open, ref);
  useFocusTrap(ref, open);
  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups.map((g) => ({
      ...g,
      items: g.items.filter((item) => item.label.toLowerCase().includes(q))
    })).filter((g) => g.items.length > 0);
  }, [groups, search]);
  const items = filteredGroups.flatMap((group) => group.items);
  const activeItem = items[active];
  useEffect(() => {
    if (open && active >= 0) ref.current?.querySelector(`[id="${id}-option-${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, id, open]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    /* @__PURE__ */ jsxs("div", { "data-db-react": "", "data-theme": theme, style: portalTextStyle, className: cn("db-command", "db-command--open", className), onClick: onClose, children: [
      /* @__PURE__ */ jsx("div", { className: "db-command__overlay" }),
      /* @__PURE__ */ jsxs(
        "div",
        {
          ...props,
          ref: setRef,
          className: "db-command__panel",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": props["aria-label"] ?? (props["aria-labelledby"] ? void 0 : "Commands"),
          tabIndex: -1,
          onClick: (e) => {
            props.onClick?.(e);
            e.stopPropagation();
          },
          onKeyDown: (event) => {
            props.onKeyDown?.(event);
            if (event.defaultPrevented || event.target !== ref.current?.querySelector(".db-command__input")) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const enabled = items.map((item, index) => item.disabled ? -1 : index).filter((index) => index >= 0);
              if (!enabled.length) return;
              const current = enabled.indexOf(active);
              const next = current < 0 ? event.key === "ArrowDown" ? 0 : enabled.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length;
              setActive(enabled[next]);
            } else if (event.key === "Enter") {
              event.preventDefault();
              const item = activeItem ?? items.find((item2) => !item2.disabled);
              if (item && !item.disabled) {
                item.onClick?.();
                onClose();
              }
            }
          },
          children: [
            /* @__PURE__ */ jsx("div", { className: "db-command__input-wrap", children: /* @__PURE__ */ jsx(
              "input",
              {
                className: "db-command__input",
                role: "combobox",
                "aria-label": "Search commands",
                "aria-expanded": "true",
                "aria-controls": `${id}-listbox`,
                "aria-autocomplete": "list",
                "aria-activedescendant": activeItem && !activeItem.disabled ? `${id}-option-${active}` : void 0,
                placeholder,
                value: search,
                onChange: (e) => {
                  setSearch(e.target.value);
                  setActive(-1);
                },
                autoFocus: true
              }
            ) }),
            /* @__PURE__ */ jsxs("div", { id: `${id}-listbox`, className: "db-command__list", role: "listbox", "aria-label": "Commands", children: [
              filteredGroups.map((g, groupIndex) => /* @__PURE__ */ jsxs("div", { className: "db-command__group", role: "group", "aria-labelledby": `${id}-group-${groupIndex}`, children: [
                /* @__PURE__ */ jsx("div", { id: `${id}-group-${groupIndex}`, className: "db-command__group-label", children: g.label }),
                g.items.map((item) => {
                  const index = items.indexOf(item);
                  return /* @__PURE__ */ jsxs(
                    "button",
                    {
                      id: `${id}-option-${index}`,
                      type: "button",
                      role: "option",
                      "aria-selected": index === active,
                      disabled: item.disabled,
                      tabIndex: -1,
                      className: cn("db-command__item", index === active && "db-command__item--active"),
                      onMouseEnter: () => {
                        if (!item.disabled) setActive(index);
                      },
                      onClick: () => {
                        item.onClick?.();
                        onClose();
                      },
                      children: [
                        /* @__PURE__ */ jsx("span", { children: item.label }),
                        item.shortcut && /* @__PURE__ */ jsx("kbd", { className: "db-command__shortcut", children: item.shortcut })
                      ]
                    },
                    item.label
                  );
                })
              ] }, g.label)),
              !items.length && /* @__PURE__ */ jsx("div", { className: "db-command__empty", role: "status", children: "No commands found" })
            ] })
          ]
        }
      )
    ] }),
    document.body
  );
});
CommandPalette.displayName = "CommandPalette";

export { Accordion, Alert, AlertDialog, AspectRatio, Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentGroup, AttachmentMedia, AttachmentProgress, AttachmentTitle, AttachmentTrigger, Avatar, AvatarGroup, Badge, BottomNav, Breadcrumbs, Bubble, BubbleCollapsible, BubbleContent, BubbleGroup, BubbleReactions, Button, ButtonGroup, Calendar, Card, Carousel, Chart, ChartCard, ChatComposer, Checkbox, CheckboxGroup, Chip, Collapsible, CommandPalette, Container, ContextMenu, CustomSelect, DataTable, DatePicker, Drawer, DropdownMenu, EmptyState, Field, Fieldset, Frame, Grid, Group, HoverCard, Image, Input, InputGroup, InputIcon, InputOTP, Kbd, Label, List, Marker, MarkerContent, MarkerIcon, Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader, MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport, Meter, Modal, NavMenu, Navbar, NumberField, Pagination, Popover, PreviewCard, Progress, Prose, Radio, RadioGroup, ScrollArea, Search, Select, Separator, Sheet, Skeleton, Slider, Spinner, Stack, StatCard, Stepper, Surface, Switch, Table, Tabs, Textarea, ThemeProvider, Toast, ToastProvider, Toggle, ToggleGroup, Toolbar, Tooltip, useControllable, useEscapeKey, useFocusTrap, Pt as useMessageScroller, wt as useMessageScrollerScrollable, Ot as useMessageScrollerVisibility, useOutsideClick, useToast };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map