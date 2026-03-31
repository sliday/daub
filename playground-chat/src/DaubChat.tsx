import {
  AssistantRuntimeProvider,
  useLocalRuntime,
} from "@assistant-ui/react";
import { daubAdapter } from "./runtime/daub-adapter";
import { DaubThread } from "./components/DaubThread";

export function DaubChat() {
  const runtime = useLocalRuntime(daubAdapter);

  (window as any).__chatBridge = {
    clearChat: () => {
      // Runtime switchToNewThread creates a fresh thread
      runtime.switchToNewThread();
    },
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <DaubThread />
    </AssistantRuntimeProvider>
  );
}
