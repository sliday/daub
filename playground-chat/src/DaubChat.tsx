import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";
import { DaubThread } from "./components/DaubThread";
import { getBridge } from "./runtime/bridge";

const daubAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal }) {
    const bridge = getBridge();
    if (!bridge) {
      yield { content: [{ type: "text" as const, text: "Bridge not available" }] };
      return;
    }

    const config = bridge.getProviderConfig();
    const systemPrompt = bridge.getSystemPrompt();
    const currentSpec = bridge.getCurrentSpec();

    const apiMessages: any[] = [{ role: "system", content: systemPrompt }];

    if (currentSpec) {
      apiMessages.push(
        { role: "user", content: "(previous request)" },
        { role: "assistant", content: JSON.stringify(currentSpec) }
      );
    }

    for (const m of messages) {
      const text = m.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("");
      if (text) apiMessages.push({ role: m.role, content: text });
    }

    let accumulated = "";
    let done = false;
    let error: Error | null = null;

    const selectStream = bridge.isDefaultMode()
      ? bridge.streamDefault
      : config.provider === "anthropic"
        ? bridge.streamAnthropic
        : config.provider === "openrouter"
          ? bridge.streamOpenRouter
          : bridge.streamOpenAI;

    const onChunk = (chunk: string) => { accumulated += chunk; };
    const onDone = () => { done = true; };
    const onError = (err: any) => { error = new Error(String(err)); };

    const streamPromise = new Promise<void>((resolve, reject) => {
      const wrappedDone = () => { onDone(); resolve(); };
      const wrappedError = (err: any) => { onError(err); reject(error); };

      if (bridge.isDefaultMode()) {
        bridge.streamDefault(apiMessages, onChunk, wrappedDone, wrappedError, undefined, abortSignal);
      } else if (config.provider === "anthropic") {
        bridge.streamAnthropic(apiMessages, onChunk, wrappedDone, wrappedError, abortSignal);
      } else if (config.provider === "openrouter") {
        bridge.streamOpenRouter(apiMessages, onChunk, wrappedDone, wrappedError, abortSignal);
      } else {
        bridge.streamOpenAI(apiMessages, onChunk, wrappedDone, wrappedError, abortSignal);
      }
    });

    // Show generating status instead of raw JSON
    let ticks = 0;
    const dots = ["", ".", "..", "..."];
    while (!done && !error) {
      await new Promise((r) => setTimeout(r, 300));
      ticks++;
      const chars = accumulated.length;
      const progress = chars > 0 ? `Generating UI${dots[ticks % 4]}  (${chars} chars)` : `Connecting${dots[ticks % 4]}`;
      yield { content: [{ type: "text" as const, text: progress }] };
    }

    if (error) throw error;
    await streamPromise;

    // Try to parse spec and render
    let summary = "Response received. Could not parse as UI spec.";
    try {
      const clean = bridge.cleanJSON(accumulated);
      let spec: any;
      try { spec = JSON.parse(clean); } catch { spec = bridge.repairJSON(clean); }

      if (spec?.root && spec?.elements) {
        bridge.setJsonValue(JSON.stringify(spec, null, 2));
        const prevSpec = bridge.getCurrentSpec();
        bridge.pushVersion(spec, "via chat");
        bridge.renderSpec(spec, prevSpec);
        bridge.refreshJsonTree();
        bridge.updatePreviewToolbar();
        bridge.hideJsonError();

        const count = Object.keys(spec.elements).length;
        const types = new Set(Object.values(spec.elements).map((e: any) => e.type));
        const typeList = Array.from(types).slice(0, 5).join(", ");
        summary = `✅ ${count} elements · ${types.size} types (${typeList}${types.size > 5 ? " …" : ""}) · Theme: ${spec.theme || "default"}`;
      }
    } catch (e) {
      console.error("[daub-adapter] spec parse error:", e);
    }

    yield { content: [{ type: "text" as const, text: summary }] };
  },
};

export function DaubChat() {
  const runtime = useLocalRuntime(daubAdapter);

  (window as any).__chatBridge = {
    clearChat: () => runtime.switchToNewThread(),
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <DaubThread />
    </AssistantRuntimeProvider>
  );
}
