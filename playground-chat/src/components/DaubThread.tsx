import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
} from "@assistant-ui/react";
import { getBridge } from "../runtime/bridge";

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
    <ThreadPrimitive.Root style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ThreadPrimitive.Viewport style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />
      </ThreadPrimitive.Viewport>

      <div style={{ borderTop: "1px solid var(--db-sand)", padding: "12px" }}>
        <ComposerPrimitive.Root style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
          <ComposerPrimitive.Input
            placeholder="Describe a UI to generate..."
            style={{
              flex: 1,
              resize: "none",
              border: "1px solid var(--db-sand)",
              borderRadius: "var(--db-radius-2)",
              padding: "8px 12px",
              fontFamily: "var(--db-font-body)",
              fontSize: "0.9375rem",
              color: "var(--db-ink)",
              background: "var(--db-white)",
              outline: "none",
              minHeight: "40px",
            }}
          />
          <ComposerPrimitive.Send className="db-btn db-btn--primary db-btn--sm">
            Send
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <button
            className="db-btn db-btn--ghost db-btn--sm"
            onClick={() => getBridge()?.openByokModal()}
            type="button"
          >
            Own Key
          </button>
        </div>
      </div>
    </ThreadPrimitive.Root>
  );
}
