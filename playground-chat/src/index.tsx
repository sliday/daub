import { createRoot, type Root } from "react-dom/client";
import { DaubChat } from "./DaubChat";

let root: Root | null = null;

export function mount(container: HTMLElement) {
  if (root) root.unmount();
  root = createRoot(container);
  root.render(<DaubChat />);
}

export function unmount() {
  if (root) {
    root.unmount();
    root = null;
  }
}

// Exported as window.DaubChat.mount(el) via IIFE globalName
