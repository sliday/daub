import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
} from "@assistant-ui/react";
import { getBridge } from "../runtime/bridge";

const EXAMPLES = [
  "SaaS dashboard with sidebar, stats cards, and activity feed",
  "E-commerce product page with image gallery and reviews",
  "Settings page with tabs for profile, notifications, and security",
  "Blog layout with featured post, grid, and newsletter signup",
];

function ExampleChips() {
  return (
    <div className="pg-chat__examples">
      <p className="pg-chat__examples-label">Try an example</p>
      <div className="pg-chat__examples-grid">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            className="pg-chat__example-chip"
            data-example={ex}
            onClick={() => {
              const input = document.querySelector(
                "[data-aui-composer-input]"
              ) as HTMLTextAreaElement | null;
              if (input) {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                  window.HTMLTextAreaElement.prototype,
                  "value"
                )?.set;
                nativeInputValueSetter?.call(input, ex);
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.focus();
              }
            }}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root>
      <div className="pg-chat__msg pg-chat__msg--user">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root>
      <div className="pg-chat__msg pg-chat__msg--ai">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
}

export function DaubThread() {
  return (
    <ThreadPrimitive.Root
      className="pg-chat pg-chat--react"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <ThreadPrimitive.Viewport
        className="pg-chat__messages"
        style={{ flex: 1, overflowY: "auto" }}
      >
        <ThreadPrimitive.Empty>
          <div className="pg-chat__empty">
            <ExampleChips />
          </div>
        </ThreadPrimitive.Empty>

        <ThreadPrimitive.Messages>
          {({ message }) => {
            if (message.role === "user") return <UserMessage />;
            return <AssistantMessage />;
          }}
        </ThreadPrimitive.Messages>
      </ThreadPrimitive.Viewport>

      <ThreadPrimitive.ViewportFooter
        className="pg-chat__footer"
        style={{ borderTop: "1px solid var(--db-sand)", padding: "12px" }}
      >
        <ComposerPrimitive.Root className="pg-chat__input-wrap">
          <ComposerPrimitive.Input
            placeholder="Describe a UI to generate..."
            className="pg-chat__input"
            data-aui-composer-input=""
            style={{
              width: "100%",
              resize: "none",
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "var(--db-font-body)",
              fontSize: "0.9375rem",
              color: "var(--db-ink)",
              minHeight: "40px",
            }}
          />
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              marginTop: "8px",
            }}
          >
            <button
              className="db-btn db-btn--ghost db-btn--sm"
              onClick={() => getBridge().openByokModal()}
              type="button"
            >
              🔑 BYOK
            </button>
            <div style={{ flex: 1 }} />
            <ComposerPrimitive.Cancel className="db-btn db-btn--ghost db-btn--sm">
              Stop
            </ComposerPrimitive.Cancel>
            <ComposerPrimitive.Send className="db-btn db-btn--primary db-btn--sm">
              Send
            </ComposerPrimitive.Send>
          </div>
        </ComposerPrimitive.Root>
      </ThreadPrimitive.ViewportFooter>
    </ThreadPrimitive.Root>
  );
}
