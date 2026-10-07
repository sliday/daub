import { createElement, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Button } from "../../react/src/components/Button";
import { ButtonGroup } from "../../react/src/components/ButtonGroup";
import { Field } from "../../react/src/components/Field";
import { Input } from "../../react/src/components/Input";
import { Textarea } from "../../react/src/components/Textarea";
import { InputIcon } from "../../react/src/components/InputIcon";
import { InputOTP } from "../../react/src/components/InputOTP";
import { Checkbox } from "../../react/src/components/Checkbox";
import { CheckboxGroup } from "../../react/src/components/CheckboxGroup";
import { RadioGroup } from "../../react/src/components/RadioGroup";
import { Toggle } from "../../react/src/components/Toggle";
import { ToggleGroup } from "../../react/src/components/ToggleGroup";
import { Pagination } from "../../react/src/components/Pagination";
import { Tabs } from "../../react/src/components/Tabs";
import { Slider } from "../../react/src/components/Slider";
import { Select } from "../../react/src/components/Select";
import { NumberField } from "../../react/src/components/NumberField";
import { Kbd } from "../../react/src/components/Kbd";
import { Label } from "../../react/src/components/Label";
import { Toolbar } from "../../react/src/components/Toolbar";
import { Calendar } from "../../react/src/components/Calendar";
import { DatePicker } from "../../react/src/components/DatePicker";
import { Navbar } from "../../react/src/components/Navbar";

const components = { Button, ButtonGroup, Input, Textarea, InputOTP, Checkbox, Toggle, RadioGroup, Pagination, Tabs, Slider, Select, NumberField, Kbd, Calendar, DatePicker };
const events: unknown[] = [];
const refs: Record<string, HTMLElement | null> = {};
const record = (value: unknown) => events.push(value);
function controlRef(node: HTMLElement | null) {
  refs.control = node;
  if (node) return () => { refs.control = null; events.push("ref-cleanup"); };
}
function Wrap({ children, theme }: { children: ReactNode; theme?: string }) { return <div data-testid="custom-wrap" data-theme={theme}>{children}</div>; }
const wrapControls = (children: ReactNode, nested?: boolean, theme?: string) => nested ? <><div><><Wrap theme={theme}>{children}</Wrap></></div></> : children;

function App({ kind, props }: { kind: string; props: Record<string, any> }) {
  let content;
  if (kind === "Field") {
    const { control = "Input", controlProps = {}, nested, ...fieldProps } = props;
    const Control = control === "Textarea" ? Textarea : control === "NumberField" ? NumberField : Input;
    const input = <Control ref={(node) => { refs.control = node; }} {...controlProps} />;
    content = <><span id="external-help">Existing hint</span><Field {...fieldProps}>{nested ? <InputIcon icon={<i>Decorative</i>}>{input}</InputIcon> : input}</Field></>;
  } else if (kind === "ToggleGroup") {
    const { nested, cancelChild, cancelReset, refCleanup, scopeTheme, ...groupProps } = props;
    content = <ToggleGroup ref={refCleanup ? controlRef : undefined} {...groupProps} onChange={record} onValuesChange={(value) => events.push({ values: value })}>
      {wrapControls(<>
      <Toggle value="a" onChange={(value) => events.push({ a: value })}>Alpha</Toggle>
      <Toggle value="b" onClick={cancelChild ? (event) => { events.push("child-click"); event.preventDefault(); } : undefined}>Beta</Toggle>
      <Toggle value="c" disabled>Gamma</Toggle>
      </>, nested, scopeTheme)}
    </ToggleGroup>;
  } else if (kind === "CheckboxGroup") {
    const { nested, cancelChild, cancelReset, refCleanup, scopeTheme, ...groupProps } = props;
    content = <CheckboxGroup ref={refCleanup ? controlRef : undefined} {...groupProps} onValueChange={record}>
      {wrapControls(<>
      <Checkbox value="a" label="Alpha" onChange={(value) => events.push({ a: value })} />
      <Checkbox value="b" label="Beta" onClick={cancelChild ? (event) => { events.push("child-click"); event.preventDefault(); } : undefined} />
      <Checkbox value="c" label="Gamma" disabled />
      </>, nested, scopeTheme)}
    </CheckboxGroup>;
  } else if (kind === "Toolbar") {
    content = <Toolbar {...props} onKeyDown={(event) => { events.push(event.key); if (props["data-cancel"]) event.preventDefault(); }}>
      <Button>Alpha</Button><Button disabled>Unavailable</Button><Button hidden>Hidden</Button><Button>Beta</Button>
    </Toolbar>;
  } else if (kind === "Navbar") {
    content = <Navbar brand="DAUB" {...props}><a href="#account">Account</a><a href="#billing">Billing</a></Navbar>;
  } else if (kind === "Label") {
    content = <><Label htmlFor="label-input" {...props}>Account</Label><Input id="label-input" /></>;
  } else {
    const Component = components[kind as keyof typeof components];
    const componentProps = { ...props };
    delete componentProps.cancelReset;
    delete componentProps.refCleanup;
    if (componentProps.month) componentProps.month = new Date(componentProps.month + "T00:00");
    if (kind === "Button" && props.nodeIcon) {
      delete componentProps.nodeIcon;
      componentProps.icon = <svg data-testid="node-icon" viewBox="0 0 24 24"><path d="M4 12h16" /></svg>;
    }
    if (kind === "NumberField") componentProps.onBlur = () => events.push("blur");
    if (kind === "InputOTP" && componentProps["data-cancel"]) {
      componentProps.onKeyDown = (event: React.KeyboardEvent) => { record(event.key); event.preventDefault(); };
      componentProps.onPaste = (event: React.ClipboardEvent) => { record("paste"); event.preventDefault(); };
    }
    content = createElement(Component as ComponentType<any>, { ref: props.refCleanup ? controlRef : (node: HTMLElement | null) => { refs.control = node; }, onChange: record, ...componentProps });
  }
  return <form onSubmit={(event) => { event.preventDefault(); events.push("submit"); }} onReset={(event) => { if (props.cancelReset) event.preventDefault(); }}>
    {content}<button type="button" id="outside" style={{ display: "block", marginTop: 400 }}>Outside</button>
  </form>;
}

const root = createRoot(document.getElementById("root")!);
Object.assign(window, {
  events, refs,
  mountControls: (kind: string, props: Record<string, unknown> = {}) => {
    flushSync(() => root.render(<App key={kind} kind={kind} props={props} />));
  },
});
