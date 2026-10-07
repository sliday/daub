import { Children, Fragment, cloneElement, createElement, isValidElement, useCallback, useEffect, useRef, type HTMLAttributes, type ReactElement, type ReactNode, type Ref } from "react";

const activeTraps: { element: HTMLElement; order: number }[] = [];
const escapeHandlers: { order: number }[] = [];
const originalInert = new Map<HTMLElement, boolean>();
let previousOverflow = "";
let activationOrder = 0;

export function useMergedRefs<T>(internal: React.RefObject<T | null>, forwarded?: Ref<T>) {
  const cleanupRef = useRef<(() => void) | undefined>(undefined);
  return useCallback((node: T | null) => {
    const previousCleanup = cleanupRef.current;
    cleanupRef.current = undefined;
    previousCleanup?.();
    internal.current = node;
    if (typeof forwarded === "function") {
      if (node === null && previousCleanup) return;
      const cleanup = forwarded(node);
      if (node !== null && typeof cleanup === "function") cleanupRef.current = cleanup;
    }
    else if (forwarded) forwarded.current = node;
  }, [internal, forwarded]);
}

function triggerElement(trigger: ReactNode): ReactElement<Record<string, unknown>> {
  if (isValidElement<Record<string, unknown>>(trigger)) {
    if (trigger.type !== Fragment) return trigger;
    const children = Children.toArray(trigger.props.children as ReactNode);
    if (children.length === 1) return triggerElement(children[0]);
  }
  return typeof trigger === "string" || typeof trigger === "number"
    ? createElement("button", { type: "button" }, trigger)
    : createElement("span", {}, trigger);
}

export function triggerId(trigger: ReactNode, fallback: string): string {
  const id = triggerElement(trigger).props.id;
  return typeof id === "string" ? id : fallback;
}

export function renderOverlayTrigger(trigger: ReactNode, attributes: HTMLAttributes<HTMLElement>) {
  const element = triggerElement(trigger);
  const props: Record<string, unknown> = element.props;
  const merged: Record<string, unknown> = { ...attributes };
  merged.id = props.id ?? attributes.id;
  merged.className = [props.className, attributes.className].filter(Boolean).join(" ");
  if (element.type === "button") merged.type = props.type ?? "button";
  if (attributes["aria-describedby"]) merged["aria-describedby"] = [props["aria-describedby"], attributes["aria-describedby"]].filter(Boolean).join(" ");
  for (const name of ["onClick", "onKeyDown", "onFocus", "onBlur"] as const) {
    const original = props[name] as ((event: React.SyntheticEvent<HTMLElement>) => void) | undefined;
    const added = attributes[name] as ((event: React.SyntheticEvent<HTMLElement>) => void) | undefined;
    if (added) merged[name] = (event: React.SyntheticEvent<HTMLElement>) => {
      original?.(event);
      if (!event.defaultPrevented) added(event);
    };
  }
  if (typeof element.type === "string" && !["button", "a", "input"].includes(element.type)) {
    merged.role = props.role ?? "button";
    merged.tabIndex = props.tabIndex ?? 0;
    const keyDown = merged.onKeyDown as ((event: React.KeyboardEvent<HTMLElement>) => void) | undefined;
    merged.onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
      keyDown?.(event);
      if (!event.defaultPrevented && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        event.currentTarget.click();
      }
    };
  }
  return cloneElement(element, merged);
}

export function useMenuNavigation(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void, last = false) {
  useEffect(() => {
    if (!open) return;
    const items = ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])');
    (last ? items?.[items.length - 1] : items?.[0])?.focus();
  }, [open, last, ref]);

  return (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    if (event.key === "Tab") { close(); return; }
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])') ?? []);
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
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

function useActivation(active: boolean) {
  const activation = useRef<{ active: boolean; order: number; previousFocus: HTMLElement | null }>({ active: false, order: 0, previousFocus: null });
  if (activation.current.active !== active) {
    // Capture parent-before-child activation before React runs child-first effects.
    activation.current = {
      active,
      order: active ? ++activationOrder : 0,
      previousFocus: active && typeof document !== "undefined" ? document.activeElement as HTMLElement | null : null,
    };
  }
  return activation.current;
}

function topTrap() {
  return activeTraps.reduce<(typeof activeTraps)[number] | undefined>((top, entry) =>
    !top || entry.order > top.order ? entry : top,
    undefined,
  )?.element;
}

function syncInert() {
  originalInert.forEach((inert, element) => { element.inert = inert; });
  const top = topTrap();
  if (!top) { originalInert.clear(); return; }
  const parent = top.parentElement;
  const boundary = parent?.matches('[data-db-react].db-modal-overlay, [data-db-react].db-sheet, [data-db-react].db-drawer, [data-db-react].db-alert-dialog, [data-db-react].db-command') ? parent : top;
  for (let element: HTMLElement | null = boundary; element && element !== document.body; element = element.parentElement) {
    const siblings: HTMLCollection | undefined = element.parentElement?.children;
    if (!siblings) break;
    for (const sibling of Array.from(siblings)) {
      if (sibling === element || !(sibling instanceof HTMLElement)) continue;
      if (!originalInert.has(sibling)) originalInert.set(sibling, sibling.inert);
      sibling.inert = true;
    }
  }
}

export function useEscapeKey(onClose: (() => void) | undefined, active: boolean, ref?: React.RefObject<HTMLElement | null>) {
  const { order } = useActivation(active);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const hasHandler = !!onClose;
  useEffect(() => {
    if (!active || !hasHandler) return;
    const entry = { order };
    escapeHandlers.push(entry);
    const handler = (e: KeyboardEvent) => {
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

export function useOutsideClick(
  ref: React.RefObject<HTMLElement | null>,
  onClose: (() => void) | undefined,
  active: boolean
) {
  useEffect(() => {
    if (!active || !onClose) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [active, onClose, ref]);
}

export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
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

    const getFocusable = () => Array.from(el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]'
    )).filter((node) => node.tabIndex >= 0 && !node.matches(':disabled') &&
      !node.closest('[hidden], [inert], [aria-hidden="true"]') &&
      node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden");

    const originalTabIndex = el.getAttribute("tabindex");
    if (!el.hasAttribute("tabindex")) el.tabIndex = -1;
    if (topTrap() === el && !el.contains(document.activeElement)) (getFocusable()[0] ?? el).focus();

    const handler = (e: KeyboardEvent) => {
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
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
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
