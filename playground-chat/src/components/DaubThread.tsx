import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
} from "@assistant-ui/react";
import { getBridge } from "../runtime/bridge";

const EXAMPLES = [
  "SaaS dashboard with sidebar, stats, and activity feed",
  "E-commerce product page with gallery and reviews",
  "Settings page with tabs and form fields",
  "Sign-in page with social login options",
  "Pricing page with three tiers and FAQ",
  "Blog with featured post and sidebar",
];

function EmptyState() {
  return (
    <ThreadPrimitive.Empty>
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: "32px 16px",
        gap: "16px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "32px", opacity: 0.6 }}>&#x2728;</div>
        <h3 style={{
          fontFamily: "var(--db-font-heading)",
          fontWeight: 700,
          fontSize: "1.125rem",
          color: "var(--db-ink)",
          margin: 0,
        }}>
          What would you like to build?
        </h3>
        <p style={{
          fontFamily: "var(--db-font-body)",
          fontSize: "0.875rem",
          color: "var(--db-warm-gray)",
          margin: 0,
          maxWidth: "300px",
          lineHeight: 1.5,
        }}>
          Describe a UI and watch it come to life with DAUB components.
        </p>
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          justifyContent: "center",
          marginTop: "8px",
          maxWidth: "340px",
        }}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              className="db-chip db-chip--sm"
              style={{ cursor: "pointer", textAlign: "left", fontSize: "0.75rem" }}
              onClick={() => {
                const input = document.querySelector(
                  "[data-aui-composer-input]"
                ) as HTMLTextAreaElement | null;
                if (input) {
                  const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype, "value"
                  )?.set;
                  setter?.call(input, ex);
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
    </ThreadPrimitive.Empty>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root>
      <div style={{
        marginLeft: "auto",
        maxWidth: "85%",
        padding: "10px 14px",
        borderRadius: "var(--db-radius-3)",
        background: "var(--db-terracotta)",
        color: "#fff",
        fontFamily: "var(--db-font-body)",
        fontSize: "0.875rem",
        lineHeight: 1.5,
        marginBottom: "8px",
        wordBreak: "break-word",
      }}>
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root>
      <div style={{
        maxWidth: "85%",
        padding: "10px 14px",
        borderRadius: "var(--db-radius-3)",
        background: "var(--db-white)",
        border: "1px solid var(--db-sand)",
        fontFamily: "var(--db-font-body)",
        fontSize: "0.8125rem",
        lineHeight: 1.6,
        color: "var(--db-ink)",
        marginBottom: "8px",
        wordBreak: "break-word",
        maxHeight: "200px",
        overflowY: "auto",
        whiteSpace: "pre-wrap",
      }}>
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
}

export function DaubThread() {
  return (
    <ThreadPrimitive.Root style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      fontFamily: "var(--db-font-body)",
    }}>
      <ThreadPrimitive.Viewport style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px",
      }}>
        <EmptyState />
        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />
      </ThreadPrimitive.Viewport>

      <div style={{
        borderTop: "1px solid var(--db-sand)",
        padding: "12px",
        background: "var(--db-cream-dark)",
      }}>
        <ComposerPrimitive.Root style={{
          display: "flex",
          gap: "8px",
          alignItems: "flex-end",
        }}>
          <ComposerPrimitive.Input
            placeholder="Describe a UI to generate..."
            data-aui-composer-input=""
            autoFocus
            style={{
              flex: 1,
              resize: "none",
              border: "1px solid var(--db-sand)",
              borderRadius: "var(--db-radius-2)",
              padding: "10px 12px",
              fontFamily: "var(--db-font-body)",
              fontSize: "0.875rem",
              color: "var(--db-ink)",
              background: "var(--db-white)",
              outline: "none",
              minHeight: "42px",
              lineHeight: 1.5,
            }}
          />
          <ComposerPrimitive.Send
            className="db-btn db-btn--primary db-btn--sm"
            style={{ flexShrink: 0 }}
          >
            Send
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
        <div style={{
          display: "flex",
          gap: "8px",
          marginTop: "8px",
          alignItems: "center",
        }}>
          <button
            className="db-btn db-btn--ghost db-btn--sm"
            onClick={() => getBridge()?.openByokModal()}
            type="button"
            style={{ fontSize: "0.75rem" }}
          >
            Own Key
          </button>
          <ComposerPrimitive.Cancel
            className="db-btn db-btn--ghost db-btn--sm"
            style={{ fontSize: "0.75rem" }}
          >
            Stop
          </ComposerPrimitive.Cancel>
        </div>
      </div>
    </ThreadPrimitive.Root>
  );
}
