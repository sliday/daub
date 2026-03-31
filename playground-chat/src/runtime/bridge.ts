export interface PlaygroundBridge {
  getSystemPrompt: () => string;
  getCurrentSpec: () => any;
  getSpecVersions: () => any[];
  getOutputFormat: () => string;
  isDefaultMode: () => boolean;
  getProviderConfig: () => {
    provider: string;
    model: string | null;
    apiKey: string | null;
    fastMode: boolean;
  };
  renderSpec: (spec: any, prevSpec?: any) => void;
  postToPreview: (msg: any) => void;
  cleanJSON: (text: string) => string;
  repairJSON: (s: string) => any;
  pushVersion: (spec: any, prompt: string) => void;
  revertToVersion: (idx: number) => void;
  setLoading: (on: boolean) => void;
  showJsonError: (msg: string) => void;
  hideJsonError: () => void;
  updatePreviewToolbar: () => void;
  refreshJsonTree: () => void;
  setJsonValue: (v: string) => void;
  openByokModal: () => void;
  capturePreview: () => Promise<string>;
  saveChatState: (history: any[]) => void;
  streamFetch: (url: string, opts: any, onChunk: (s: string) => void, onDone: () => void, onError: (e: any) => void, signal?: AbortSignal) => void;
  streamDefault: (messages: any[], onChunk: (s: string) => void, onDone: () => void, onError: (e: any) => void, model?: string, signal?: AbortSignal) => void;
  streamOpenAI: (messages: any[], onChunk: (s: string) => void, onDone: () => void, onError: (e: any) => void, signal?: AbortSignal) => void;
  streamAnthropic: (messages: any[], onChunk: (s: string) => void, onDone: () => void, onError: (e: any) => void, signal?: AbortSignal) => void;
  streamOpenRouter: (messages: any[], onChunk: (s: string) => void, onDone: () => void, onError: (e: any) => void, signal?: AbortSignal) => void;
  getExamples: () => string[];
  on: (event: string, fn: (data: any) => void) => void;
  emit: (event: string, data: any) => void;
}

export function getBridge(): PlaygroundBridge {
  return (window as any).__playgroundBridge;
}
