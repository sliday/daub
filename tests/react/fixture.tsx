import { createElement, StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  AlertDialog, Drawer, Modal, NumberField, Popover, Select, Sheet, Slider,
  Switch, Tabs, Toggle, CustomSelect,
  useEscapeKey, useFocusTrap,
  DropdownMenu, ContextMenu, HoverCard, PreviewCard, Tooltip, ThemeProvider, ToastProvider, useToast, CommandPalette,
} from "../../react/src";

const components = { NumberField, Select, Slider, Switch, Tabs, Toggle, CustomSelect };
const events: unknown[] = [];
const refs: Record<string, HTMLElement | null> = {};

function Overlay({ kind, empty = false, popover = false, tooltip = false, dropdown = false, themed = false }: { kind: string; empty?: boolean; popover?: boolean; tooltip?: boolean; dropdown?: boolean; themed?: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => { events.push("close"); setOpen(false); };
  const children = empty ? "Dialog content" : <div className="db-stack db-gap-2">
    {themed && <p data-testid="portal-plain-child">Plain portal content</p>}
    <button className="db-btn db-btn--secondary" disabled>Disabled action</button>
    <button hidden>Hidden action</button>
    <button className="db-btn db-btn--primary" onClick={() => events.push("action")}>Dialog action</button>
    <button className="db-btn db-btn--secondary" onClick={close}>Done</button>
    {popover && <Popover trigger={<button>Open popover</button>} content={<button>Popover action</button>} />}
    {tooltip && <Tooltip content="A tooltip"><button>Tooltip target</button></Tooltip>}
    {dropdown && <DropdownMenu trigger={<button>Actions</button>} items={[{ label: 'Save', onClick: () => events.push('save') }]} />}
  </div>;
  return <>
    <button id="opener" onClick={() => setOpen(true)}>Open overlay</button>
    {kind === "Modal" && <Modal open={open} onClose={close} title={empty ? undefined : "Edit profile"}>{children}</Modal>}
    {kind === "AlertDialog" && <AlertDialog open={open} onClose={close} title="Delete profile" description="This removes your profile." onConfirm={() => events.push("confirm")} />}
    {kind === "Sheet" && <Sheet open={open} onClose={close} title="Edit profile">{children}</Sheet>}
    {kind === "Drawer" && <Drawer open={open} onClose={close}>{children}</Drawer>}
  </>;
}

function NestedOverlay() {
  const [outer, setOuter] = useState(false);
  const [inner, setInner] = useState(false);
  return <>
    <button id="opener" onClick={() => setOuter(true)}>Open outer</button>
    <Modal open={outer} onClose={() => { events.push("outer-close"); setOuter(false); }} title="Outer">
      <button id="inner-opener" onClick={() => setInner(true)}>Open inner</button>
      <Modal open={inner} onClose={() => { events.push("inner-close"); setInner(false); }} title="Inner">
        <button>Inner action</button>
      </Modal>
    </Modal>
  </>;
}

function SiblingOverlays() {
  const [earlier, setEarlier] = useState(false);
  const [later, setLater] = useState(false);
  const [count, setCount] = useState(0);
  const earlierRef = useRef<HTMLDivElement>(null);
  const laterRef = useRef<HTMLDivElement>(null);
  useEscapeKey(() => { events.push("earlier-close"); setEarlier(false); }, earlier, earlierRef);
  useFocusTrap(earlierRef, earlier);
  useEscapeKey(() => { events.push("later-close"); setLater(false); }, later, laterRef);
  useFocusTrap(laterRef, later);
  return <>
    <button id="opener" onClick={() => setLater(true)}>Open later DOM sibling</button>
    <button id="first-opener" onClick={() => setEarlier(true)}>Open first DOM sibling</button>
    <div ref={earlierRef} role="dialog" aria-label="Earlier DOM sibling" hidden={!earlier}>
      <button id="later-opener" onClick={() => setLater(true)}>Open later sibling from earlier</button>
      <button onClick={() => setCount(count + 1)}>Rerender {count}</button>
    </div>
    <div ref={laterRef} role="dialog" aria-label="Later DOM sibling" hidden={!later}>
      <button id="earlier-opener" onClick={() => setEarlier(true)}>Open earlier DOM sibling</button>
      <button onClick={() => setCount(count + 1)}>Rerender {count}</button>
    </div>
  </>;
}

function SimultaneousNestedOverlay() {
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(true);
  return <>
    <button id="opener" onClick={() => setOpen(true)}>Open nested pair</button>
    <Modal open={open} onClose={() => { events.push("outer-close"); setOpen(false); }} title="Outer">
      <button>Outer action</button>
      <Modal open={open && inner} onClose={() => { events.push("inner-close"); setInner(false); }} title="Inner">
        <button>Inner action</button>
      </Modal>
    </Modal>
  </>;
}

function ToastButton() {
  const { toast } = useToast();
  return <button onClick={() => toast({ message: 'Theme toast', duration: 0 })}>Show toast</button>;
}

function ThemedPortals({ kind, theme = 'dracula', nested = false }: { kind: string; theme?: string; nested?: boolean }) {
  const content = kind === 'Toast' ? <ToastProvider><ToastButton /></ToastProvider> : kind === 'CommandPalette'
    ? <CommandPalette open onClose={() => events.push('close')} groups={[{ label: 'Actions', items: [{ label: 'Save', onClick: () => events.push('save') }] }]} />
    : <Overlay kind={kind} themed />;
  const children = <><div data-testid="plain-themed-child">Plain themed child</div><button type="button" className="db-btn db-btn--primary" data-testid="themed-primary">Primary sample</button><div className="db-card" data-testid="themed-card">Card sample</div>{content}</>;
  return <ThemeProvider theme="github"><ThemeProvider theme={theme}>{nested ? <ThemeProvider>{children}</ThemeProvider> : children}</ThemeProvider></ThemeProvider>;
}

function App({ kind, props }: { kind: string; props: Record<string, unknown> }) {
  if (kind === "NestedOverlay") return <NestedOverlay />;
  if (kind === "SiblingOverlays") return <SiblingOverlays />;
  if (kind === "SimultaneousNestedOverlay") return <SimultaneousNestedOverlay />;
  if (kind === 'ThemedPortals') return <ThemedPortals {...props as any} />;
  if (kind === 'RefOverlay') {
    const overlay = { Modal, AlertDialog, Sheet, Drawer, CommandPalette }[props.kind as string as 'Modal'];
    return createElement(overlay as React.ComponentType<any>, { open: true, onClose: () => events.push('close'), ...(props.kind === 'CommandPalette' ? { groups: [] } : {}), ...Object.fromEntries(Object.entries(props).filter(([key]) => key !== 'kind')), ref: (node: HTMLElement | null) => { refs.panel = node; } });
  }
  if (kind === 'RefCleanup') return <Modal open onClose={() => events.push('close')} aria-label="Ref cleanup" ref={(node) => {
    refs.panel = node;
    if (node) return () => { refs.panel = null; events.push('panel-cleanup'); };
  }} />;
  if (kind === 'TriggerCallbacks') return <DropdownMenu trigger={<button ref={(node) => {
    refs.trigger = node;
    if (node) return () => { refs.trigger = null; events.push('trigger-cleanup'); };
  }} onClick={(event) => { events.push('click'); if (props.cancel) event.preventDefault(); }} onKeyDown={(event) => { events.push(event.key); if (props.cancel) event.preventDefault(); }}>Actions</button>} items={[{ label: 'Save' }]} />;
  if (kind === 'DropdownMenu') return <form onSubmit={(event) => { event.preventDefault(); events.push('submit'); }}>
    <DropdownMenu trigger={props.fragment ? <><button id="fragment-trigger">Actions</button></> : <button onClick={(event) => { events.push('trigger'); if (props.cancel) event.preventDefault(); }}>Actions</button>} items={[{ label: 'Unavailable', disabled: true }, { label: 'Save', onClick: () => events.push('save') }, { label: 'Divider', divider: true }, { label: 'Delete', onClick: () => events.push('delete') }]} />
    <button type="button">Outside</button>
  </form>;
  if (kind === 'ContextMenu') return <ContextMenu items={[{ label: 'Unavailable', disabled: true }, { label: 'Copy', onClick: () => events.push('copy') }, { label: 'Paste', onClick: () => events.push('paste') }]}><button>Document</button></ContextMenu>;
  if (kind === 'HoverCard') return <HoverCard trigger={<button aria-describedby="old-description">Profile</button>} content={<span>Profile preview</span>} />;
  if (kind === 'PreviewCard') return <PreviewCard ref={(node) => { refs.preview = node; }} trigger={<button aria-describedby="old-description">Profile</button>} title="Preview title" description="Preview description" />;
  if (kind === 'Tooltip') return <Tooltip ref={(node) => { refs.tooltip = node; }} content="Tooltip content"><button aria-describedby="old-description">Tooltip target</button></Tooltip>;
  if (kind === 'Commands') return <CommandPalette ref={(node) => { refs.panel = node; }} open={props.open !== false} onClose={() => events.push('close')} onKeyDown={props.cancel ? (event) => event.preventDefault() : undefined} groups={[{ label: 'Actions', items: [{ label: 'Unavailable', disabled: true }, { label: 'Save', onClick: () => events.push('save') }, { label: 'Delete', onClick: () => events.push('delete') }] }]} />;
  if (["Modal", "AlertDialog", "Sheet", "Drawer"].includes(kind)) return <Overlay kind={kind} {...props} />;
  if (kind === "Popover") return <>
    <Popover ref={(node) => { refs.popover = node; }} trigger={<button>Open popover</button>} content={<button>Popover action</button>} onChange={(value) => events.push(value)} {...props} />
    <button>Outside</button>
  </>;
  const Component = components[kind as keyof typeof components];
  return createElement(Component as React.ComponentType<any>, {
    ref: (node: HTMLElement | null) => { refs.control = node; },
    onChange: (value: unknown) => events.push(value),
    ...(props.handlers ? {
      onClick: (event: React.MouseEvent) => { events.push("click"); if (props.cancel) event.preventDefault(); },
      onKeyDown: (event: React.KeyboardEvent) => { events.push(event.key); if (props.cancel) event.preventDefault(); },
    } : {}),
    ...Object.fromEntries(Object.entries(props).filter(([key]) => !["handlers", "cancel"].includes(key))),
  });
}

const root = createRoot(document.getElementById("root")!);
Object.assign(window, {
  events,
  refs,
  mount: (kind: string, props: Record<string, unknown> = {}) => {
    flushSync(() => root.render(<App key={kind} kind={kind} props={props} />));
  },
  mountStrict: (kind: string) => {
    flushSync(() => root.render(<StrictMode><App kind={kind} props={{}} /></StrictMode>));
  },
});
