import { createElement, StrictMode, type ErrorInfo, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { ChatComposer, type ChatComposerProps, type ChatComposerController } from "../../react/src/index";

const events: unknown[] = [];
const handles: ChatComposerController[] = [];
let form: HTMLFormElement | null = null;
let host = createRoot(document.getElementById("root")!);

class Boundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) {}
  render() { return this.state.error ? <p id="error">{this.state.error}</p> : this.props.children; }
}

Object.assign(window, {
  composerEvents: events, composerHandles: handles,
  composerRoot: () => form,
  mountComposer: (props: ChatComposerProps = {}, cancel = false, version = "first", strict = false) => {
    const callback = (event: CustomEvent) => {
      events.push({ type: event.type, detail: event.detail, cancelable: event.cancelable, version });
      if (cancel && ["db:chat-send", "db:chat-steer", "db:chat-stop", "db:chat-action"].includes(event.type)) event.preventDefault();
    };
    const composer = <ChatComposer {...props} ref={node => { form = node; }} onReady={handle => { handles.push(handle); }}
      onSend={callback} onSteer={callback} onStop={callback} onAction={callback}
      onQueue={callback} onConfig={callback} onDictation={callback} onChange={callback} />;
    flushSync(() => host.render(<Boundary>{strict ? createElement(StrictMode, null, composer) : composer}</Boundary>));
  },
  unmountComposer: () => { flushSync(() => host.unmount()); },
  remountComposer: () => { host = createRoot(document.getElementById("root")!); },
});
