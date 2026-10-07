import { forwardRef, useEffect, useImperativeHandle, useRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface ChatComposerModel {
  id: string;
  label: string;
  efforts?: string[];
}

export interface ChatComposerAction {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
}

export interface ChatComposerCapabilities {
  queue?: boolean;
  steer?: boolean;
  attachments?: boolean;
  folders?: boolean;
  dictation?: boolean;
  approval?: boolean;
}

export interface ChatComposerOptions {
  models?: ChatComposerModel[];
  model?: string;
  effort?: string;
  approval?: "ask" | "auto";
  mode?: "chat" | "plan";
  actions?: ChatComposerAction[];
  capabilities?: ChatComposerCapabilities;
  busy?: boolean;
  placeholder?: string;
}

export interface ChatComposerRequest {
  id: string;
  text: string;
  files: File[];
  model: string;
  effort: string;
  approval: "ask" | "auto";
  mode: "chat" | "plan";
  goal?: string | null;
}

export type ChatComposerDictationState = "unsupported" | "listening" | "stopped" | "error";

export interface ChatComposerState extends Omit<ChatComposerRequest, "id" | "goal"> {
  queue: ChatComposerRequest[];
  busy: boolean;
  goal: string | null;
  dictation: ChatComposerDictationState;
}

export interface ChatComposerController {
  getState(): ChatComposerState;
  setBusy(busy: boolean): void;
  setStatus(status: string): void;
  setDraft(text: string): boolean;
  clearDraft(): boolean;
  updateOptions(options: ChatComposerOptions): boolean;
  attachFiles(files: File[]): boolean;
  getQueue(): ChatComposerRequest[];
  takeNext(): ChatComposerRequest | null;
  removeQueued(id: string): boolean;
  editQueued(id: string, text: string): boolean;
  steerQueued(id: string): boolean;
  setModel(id: string): boolean;
  setEffort(value: string): boolean;
  setMode(value: "chat" | "plan"): boolean;
  setApproval(value: "ask" | "auto"): boolean;
  setGoal(goal: string | null): boolean;
  startDictation(): boolean;
  stopDictation(): boolean;
  destroy(): void;
}

export interface ChatComposerConfig extends Pick<ChatComposerState, "model" | "effort" | "approval" | "mode" | "goal"> {}
export interface ChatComposerQueueDetail {
  request: ChatComposerRequest | null;
  queue: ChatComposerRequest[];
}
export interface ChatComposerDictationDetail {
  state: ChatComposerDictationState;
  error?: string;
}
export interface ChatComposerChangeDetail {
  state: ChatComposerState;
}
export interface ChatComposerActionDetail {
  action: string | ChatComposerAction;
  request?: ChatComposerRequest;
}

export interface ChatComposerProps extends Omit<ComponentProps<"form">, "children" | "dangerouslySetInnerHTML" | "onChange">, ChatComposerOptions {
  onSend?: (event: CustomEvent<{ request: ChatComposerRequest }>) => void;
  onSteer?: (event: CustomEvent<{ request: ChatComposerRequest }>) => void;
  onStop?: (event: CustomEvent) => void;
  onAction?: (event: CustomEvent<ChatComposerActionDetail>) => void;
  onQueue?: (event: CustomEvent<ChatComposerQueueDetail>) => void;
  onConfig?: (event: CustomEvent<ChatComposerConfig>) => void;
  onDictation?: (event: CustomEvent<ChatComposerDictationDetail>) => void;
  onChange?: (event: CustomEvent<ChatComposerChangeDetail>) => void;
  onReady?: (controller: ChatComposerController) => void;
}

const hostEvents = {
  "db:chat-send": "onSend",
  "db:chat-steer": "onSteer",
  "db:chat-stop": "onStop",
  "db:chat-action": "onAction",
  "db:chat-queue": "onQueue",
  "db:chat-config": "onConfig",
  "db:chat-dictation": "onDictation",
  "db:chat-change": "onChange",
} as const;

/** Requires daub.js alongside daub.css; the native controller owns the form contents. */
export const ChatComposer = forwardRef<HTMLFormElement, ChatComposerProps>(function ChatComposer({
  models, model, effort, approval, mode, actions, capabilities, busy, placeholder,
  onSend, onSteer, onStop, onAction, onQueue, onConfig, onDictation, onChange, onReady,
  className, ...props
}, ref) {
  const root = useRef<HTMLFormElement>(null);
  const controller = useRef<ChatComposerController | null>(null);
  const callbacks = useRef({ onSend, onSteer, onStop, onAction, onQueue, onConfig, onDictation, onChange, onReady });
  callbacks.current = { onSend, onSteer, onStop, onAction, onQueue, onConfig, onDictation, onChange, onReady };
  const options = { models, model, effort, approval, mode, actions, capabilities, busy, placeholder };
  const currentOptions = useRef(options);
  currentOptions.current = options;
  const setup = JSON.stringify({ models, actions, capabilities, placeholder });
  const serialized = JSON.stringify(options).replace(/[<>&\u2028\u2029]/g, char => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"));

  useImperativeHandle(ref, () => root.current!, []);

  useEffect(() => {
    const element = root.current;
    const runtime = (window as unknown as { DAUB?: { createChatComposer?: (root: HTMLFormElement, options: ChatComposerOptions) => ChatComposerController | null } }).DAUB;
    if (!element || !runtime?.createChatComposer) throw new Error("ChatComposer requires daub.js with DAUB.createChatComposer. Load it before mounting.");
    const listeners = Object.entries(hostEvents).map(([name, callback]) => {
      const listener = (event: Event) => {
        const handler = callbacks.current[callback] as ((event: CustomEvent) => void) | undefined;
        handler?.(event as CustomEvent);
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

  useEffect(() => { controller.current?.setBusy(busy ?? false); }, [busy]);
  useEffect(() => { controller.current?.updateOptions(JSON.parse(setup)); }, [setup]);
  useEffect(() => { if (model !== undefined) controller.current?.setModel(model); }, [model, busy, setup]);
  useEffect(() => { if (effort !== undefined) controller.current?.setEffort(effort); }, [effort, model, busy, setup]);
  useEffect(() => { if (approval !== undefined) controller.current?.setApproval(approval); }, [approval]);
  useEffect(() => { if (mode !== undefined) controller.current?.setMode(mode); }, [mode]);

  return <form {...props} ref={root} className={cn("db-chat-composer", className)} data-db-react="" data-db-chat-options={serialized} />;
});

ChatComposer.displayName = "ChatComposer";
