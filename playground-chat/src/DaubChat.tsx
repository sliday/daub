import { useEffect } from "react";
import { AssistantRuntimeProvider, useLocalRuntime } from "@assistant-ui/react";
import { DaubThread } from "./components/DaubThread";
import { daubAdapter } from "./runtime/daub-adapter";

export function DaubChat() {
  const runtime = useLocalRuntime(daubAdapter);

  useEffect(() => {
    const bridge = {
      clearChat: () => {
        runtime.thread.cancelRun();
        runtime.switchToNewThread();
      },
    };
    (window as any).__chatBridge = bridge;
    return () => {
      runtime.thread.cancelRun();
      if ((window as any).__chatBridge === bridge) delete (window as any).__chatBridge;
    };
  }, [runtime]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <DaubThread />
    </AssistantRuntimeProvider>
  );
}
