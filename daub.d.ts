/**
 * DAUB UI Kit — TypeScript Declarations
 * Version 3.20.5
 * https://daub.dev
 */

interface DAUBToastOptions {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  duration?: number;
}

interface DAUBModalOptions {
  title?: string;
  body?: string;
  footer?: string;
}

interface DAUBStatic {
  /** Re-initialize all components (or scoped to a root element) */
  init(root?: Element | Document): void;

  /** Bind a connected native root once, retaining its initial options. Returns null for invalid or React-owned markup. */
  createMessageScroller(root: Element, options?: DAUBMessageScrollerOptions): DAUBMessageScrollerHandle | null;

  /** Bind once; explicit calls also support React-owned composer roots. */
  createChatComposer(root: Element, options?: DAUBChatComposerOptions): DAUBChatComposerHandle | null;

  /** Show a toast notification. Pass a string for quick info toast, or options object for full control. */
  toast(opts: string | DAUBToastOptions): void;

  // --- Theme API ---

  /** Get current theme variant name (e.g. 'light', 'dark', 'ink') */
  getTheme(): string;
  /** Set theme by variant name */
  setTheme(theme: string): void;
  /** Cycle to the next theme family */
  cycleTheme(): string;
  /** Get current theme family name (e.g. 'default', 'ink', 'dracula') */
  getFamily(): string;
  /** Set theme family by name */
  setFamily(family: string): void;
  /** Get current color scheme ('auto', 'light', or 'dark') */
  getScheme(): string;
  /** Set color scheme */
  setScheme(scheme: 'auto' | 'light' | 'dark'): void;
  /** Override accent color with a hex value */
  setAccent(color: string): void;
  /** Restore theme default accent color */
  resetAccent(): void;
  /** Get current accent color hex */
  getAccent(): string;
  /** Get computed value of any --db-* CSS variable (e.g. 'terracotta' → value of --db-terracotta) */
  getColor(token: string): string;
  /** Get category name for a theme family */
  getCategory(family: string): string | undefined;

  /** Array of all theme variant names */
  readonly THEMES: string[];
  /** Map of family name → { light, dark } variant names */
  readonly THEME_FAMILIES: Record<string, { light: string; dark: string }>;
  /** Array of all family names */
  readonly FAMILY_NAMES: string[];
  /** Map of category name → family name array */
  readonly THEME_CATEGORIES: Record<string, string[]>;
  /** Array of category names */
  readonly CATEGORY_NAMES: string[];

  // --- Overlay API ---

  /** Open a modal by id or element. Optionally pass a trigger element (focus returns to it) and/or content overrides. */
  openModal(id: string | Element, triggerOrOpts?: Element | DAUBModalOptions, opts?: DAUBModalOptions): void;
  /** Close a modal by id or element */
  closeModal(id: string | Element): void;
  /** Open an alert dialog by id */
  openAlertDialog(id: string): void;
  /** Close an alert dialog by id */
  closeAlertDialog(id: string): void;
  /** Open a sheet panel by id */
  openSheet(id: string): void;
  /** Close a sheet panel by id */
  closeSheet(id: string): void;
  /** Open a drawer by id */
  openDrawer(id: string): void;
  /** Close a drawer by id */
  closeDrawer(id: string): void;
  /** Open a command palette by id */
  openCommand(id: string): void;
  /** Close a command palette by id */
  closeCommand(id: string): void;

  // --- Layout API ---

  /** Toggle sidebar collapsed state */
  toggleSidebar(id: string | Element): void;
  /** Toggle the mobile navbar menu, or set it with open; keeps the toggle's aria-expanded in step */
  toggleNavbar(id: string | Element, open?: boolean): void;
  /** Fix nested border-radius for inner elements */
  fixNestedRadius(el?: Element): void;

  // --- Texture API ---

  /** Set background texture type */
  setTexture(type: string): void;
  /** Get current background texture type */
  getTexture(): string;
  /** Array of available texture types */
  readonly TEXTURES: string[];

  // --- Temperature API ---

  /** Set color temperature (-1 cool to 1 warm), or 'auto' to follow time of day */
  setTemperature(value: number | 'auto'): void;
  /** Get current color temperature, or 'auto' */
  getTemperature(): number | 'auto';

  // --- Icons ---

  /** Re-initialize Lucide icons (call after adding dynamic content) */
  refreshIcons(): void;
}

interface DAUBMessageScrollerOptions {
  /** Follow new content while the reader follows the live edge. Defaults to true. */
  autoScroll?: boolean;
  /** Opening position on the first non-empty layout. Defaults to end. */
  scrollPosition?: 'start' | 'end' | 'last-anchor';
  /** Pixels of the previous row visible above a new turn anchor. Defaults to 0. */
  scrollPeek?: number;
}

interface DAUBMessageScrollerState {
  atStart: boolean;
  atEnd: boolean;
  currentAnchorId: string | null;
  visibleMessageIds: string[];
}

interface DAUBMessageScrollOptions {
  /** Reduced-motion users receive an instant scroll even for smooth commands. */
  behavior?: ScrollBehavior;
}

interface DAUBMessageScrollerHandle {
  scrollToEnd(options?: DAUBMessageScrollOptions): boolean;
  scrollToStart(options?: DAUBMessageScrollOptions): boolean;
  /** Returns false for an unmounted ID or a destroyed handle. */
  scrollToMessage(id: string, options?: DAUBMessageScrollOptions & { block?: ScrollLogicalPosition }): boolean;
  getState(): DAUBMessageScrollerState;
  destroy(): void;
}

interface DAUBChatComposerModel {
  id: string;
  label: string;
  efforts?: string[];
}

interface DAUBChatComposerAction {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
}

interface DAUBChatComposerOptions {
  models?: DAUBChatComposerModel[];
  model?: string;
  effort?: string;
  approval?: 'ask' | 'auto';
  mode?: 'chat' | 'plan';
  goal?: string | null;
  busy?: boolean;
  placeholder?: string;
  actions?: DAUBChatComposerAction[];
  capabilities?: {
    queue?: boolean;
    steer?: boolean;
    attachments?: boolean;
    folders?: boolean;
    dictation?: boolean;
    approval?: boolean;
  };
}

interface DAUBChatComposerConfig {
  model: string;
  effort: string;
  approval: 'ask' | 'auto';
  mode: 'chat' | 'plan';
  goal: string | null;
}

interface DAUBChatComposerRequest {
  id: string;
  text: string;
  files: File[];
  model: string;
  effort: string;
  approval: 'ask' | 'auto';
  mode: 'chat' | 'plan';
  goal?: string | null;
}

type DAUBChatComposerDictationState = 'unsupported' | 'listening' | 'stopped' | 'error';

interface DAUBChatComposerState extends DAUBChatComposerConfig {
  text: string;
  files: File[];
  queue: DAUBChatComposerRequest[];
  busy: boolean;
  dictation: DAUBChatComposerDictationState;
}

interface DAUBChatComposerHandle {
  getState(): DAUBChatComposerState;
  /** Patch options without clearing requests. Placeholder applies now; other options wait until idle. Busy remains host-controlled via setBusy. */
  updateOptions(options: DAUBChatComposerOptions): boolean;
  setBusy(busy: boolean): void;
  setStatus(status: string): void;
  setDraft(text: string): boolean;
  /** Clear pending text and attachments without removing queued requests. */
  clearDraft(): boolean;
  attachFiles(files: File[]): boolean;
  getQueue(): DAUBChatComposerRequest[];
  takeNext(): DAUBChatComposerRequest | null;
  removeQueued(id: string): boolean;
  editQueued(id: string, text: string): boolean;
  steerQueued(id: string): boolean;
  setModel(id: string): boolean;
  setEffort(value: string): boolean;
  setMode(mode: 'chat' | 'plan'): boolean;
  setApproval(approval: 'ask' | 'auto'): boolean;
  setGoal(goal: string | null): boolean;
  /** Requires a trusted user click; does not request permission on initialization. */
  startDictation(): boolean;
  stopDictation(): boolean;
  destroy(): void;
}

interface HTMLElementEventMap {
  'db:message-scroll': CustomEvent<DAUBMessageScrollerState>;
  'db:chat-send': CustomEvent<{ request: DAUBChatComposerRequest }>;
  'db:chat-steer': CustomEvent<{ request: DAUBChatComposerRequest }>;
  'db:chat-stop': CustomEvent<undefined>;
  'db:chat-action': CustomEvent<{ action: DAUBChatComposerAction } | { action: 'side-chat'; request: DAUBChatComposerRequest }>;
  'db:chat-queue': CustomEvent<{ request: DAUBChatComposerRequest | null; queue: DAUBChatComposerRequest[] }>;
  'db:chat-config': CustomEvent<DAUBChatComposerConfig>;
  'db:chat-change': CustomEvent<{ state: DAUBChatComposerState }>;
  'db:chat-dictation': CustomEvent<{ state: DAUBChatComposerDictationState; error?: string }>;
}

declare const DAUB: DAUBStatic;

interface Window {
  DAUB: DAUBStatic;
}
