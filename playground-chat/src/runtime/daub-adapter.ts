import type { ChatModelAdapter } from "@assistant-ui/react";
import { getBridge } from "./bridge";

export const daubAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal }) {
    const bridge = getBridge();
    const config = bridge.getProviderConfig();
    const systemPrompt = bridge.getSystemPrompt();
    const currentSpec = bridge.getCurrentSpec();

    const apiMessages: any[] = [
      { role: "system", content: systemPrompt },
    ];

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

    const streamPromise = new Promise<void>((resolve, reject) => {
      selectStream(
        apiMessages,
        (chunk: string) => { accumulated += chunk; },
        () => { done = true; resolve(); },
        (err: any) => { error = new Error(String(err)); reject(error); },
        abortSignal
      );
    });

    while (!done && !error) {
      await new Promise((r) => setTimeout(r, 150));
      if (accumulated) {
        yield { content: [{ type: "text" as const, text: accumulated }] };
      }
    }

    if (error) throw error;
    await streamPromise;

    yield { content: [{ type: "text" as const, text: accumulated }] };

    bridge.hideJsonError();
    try {
      const clean = bridge.cleanJSON(accumulated);
      let spec: any;
      try {
        spec = JSON.parse(clean);
      } catch {
        spec = bridge.repairJSON(clean);
      }

      if (spec?.root && spec?.elements) {
        bridge.setJsonValue(JSON.stringify(spec, null, 2));
        const prevSpec = bridge.getCurrentSpec();
        bridge.pushVersion(spec, "via chat");
        bridge.renderSpec(spec, prevSpec);
        bridge.refreshJsonTree();
        bridge.updatePreviewToolbar();
      }
    } catch {
      // Non-JSON response — just show text, no spec rendering
    }
  },
};
