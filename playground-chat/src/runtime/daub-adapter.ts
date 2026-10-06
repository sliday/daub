import type { ChatModelAdapter } from "@assistant-ui/react";
import { getBridge } from "./bridge";

export const daubAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal }) {
    if (abortSignal.aborted) return;
    const bridge = getBridge();
    if (!bridge) throw new Error("Playground bridge is unavailable");
    const config = bridge.getProviderConfig();
    if (!bridge.isDefaultMode() && !config.apiKey?.trim()) {
      throw new Error("Add an API key in Own Key settings");
    }
    const currentSpec = bridge.getCurrentSpec();
    const apiMessages: any[] = [{ role: "system", content: bridge.getSystemPrompt() }];

    if (currentSpec) {
      apiMessages.push(
        { role: "user", content: "(previous request)" },
        { role: "assistant", content: JSON.stringify(currentSpec) }
      );
    }
    for (const message of messages) {
      const text = message.content.filter((part) => part.type === "text").map((part) => part.text).join("");
      if (text) apiMessages.push({ role: message.role, content: text });
    }

    let accumulated = "";
    let done = false;
    let error: Error | null = null;
    let renderedPartial = false;
    const onChunk = (chunk: string) => { if (!abortSignal.aborted) accumulated += chunk; };
    const onDone = () => { done = true; };
    const onError = (value: unknown) => { error = value instanceof Error ? value : new Error(String(value)); };

    if (bridge.isDefaultMode()) {
      bridge.streamDefault(apiMessages, onChunk, onDone, onError, undefined, abortSignal);
    } else if (config.provider === "anthropic") {
      bridge.streamAnthropic(apiMessages, onChunk, onDone, onError, abortSignal);
    } else if (config.provider === "openrouter") {
      bridge.streamOpenRouter(apiMessages, onChunk, onDone, onError, abortSignal);
    } else {
      bridge.streamOpenAI(apiMessages, onChunk, onDone, onError, abortSignal);
    }

    let ticks = 0;
    let lastRenderLength = 0;
    const dots = ["", ".", "..", "..."];
    while (!done && !error && !abortSignal.aborted) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (done || error || abortSignal.aborted) break;
      ticks++;
      const chars = accumulated.length;
      yield { content: [{ type: "text", text: chars ? `Generating UI${dots[ticks % 4]} (${chars} chars)` : `Connecting${dots[ticks % 4]}` }] };
      if (chars - lastRenderLength > 500) {
        try {
          const partial = bridge.repairJSON(bridge.cleanJSON(accumulated));
          if (partial?.root && partial?.elements && Object.keys(partial.elements).length > 2) {
            bridge.renderSpec(partial, null);
            renderedPartial = true;
            lastRenderLength = chars;
          }
        } catch { /* Wait for a complete spec. */ }
      }
    }
    if (abortSignal.aborted || error) {
      if (renderedPartial && bridge.getCurrentSpec() === currentSpec) {
        if (currentSpec) bridge.renderSpec(currentSpec, null);
        else bridge.postToPreview({ type: "clear" });
      }
      if (abortSignal.aborted) return;
      throw error;
    }

    let summary = "Response received. Could not parse as UI spec.";
    try {
      const clean = bridge.cleanJSON(accumulated);
      let spec: any;
      try { spec = JSON.parse(clean); } catch { spec = bridge.repairJSON(clean); }
      if (spec?.root && spec?.elements) {
        const userMessages = messages.filter((message) => message.role === "user");
        const lastUserMessage = userMessages[userMessages.length - 1];
        const prompt = lastUserMessage?.content.filter((part) => part.type === "text").map((part) => part.text).join("") || "via chat";
        bridge.commitSpec(spec, prompt);
        const count = Object.keys(spec.elements).length;
        const types = new Set(Object.values(spec.elements).map((element: any) => element.type));
        summary = `${count} elements · ${types.size} types\n${Array.from(types).slice(0, 5).join(", ")}${types.size > 5 ? " …" : ""}\nTheme: ${spec.theme || "default"}`;
      } else {
        bridge.showJsonError(summary);
      }
    } catch (value) {
      bridge.showJsonError(value instanceof Error ? value.message : String(value));
    }
    yield { content: [{ type: "text", text: summary }] };
  },
};
