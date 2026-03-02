/**
 * DAUB UI Kit — TypeScript Declarations
 * Version 2.3.0
 * https://daub.dev
 */

interface DAUBToastOptions {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  duration?: number;
}

interface DAUBStatic {
  /** Re-initialize all components (or scoped to a root element) */
  init(root?: Element): void;

  /** Show a toast notification. Pass a string for quick info toast, or options object for full control. */
  toast(opts: string | DAUBToastOptions): void;

  // --- Theme API ---

  /** Get current theme variant name (e.g. 'light', 'dark', 'ink') */
  getTheme(): string;
  /** Set theme by variant name */
  setTheme(theme: string): void;
  /** Cycle to the next theme family */
  cycleTheme(): void;
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

  /** Open a modal by id or element */
  openModal(id: string | Element): void;
  /** Close a modal by id or element */
  closeModal(id: string | Element): void;
  /** Open an alert dialog by id */
  openAlertDialog(id: string): void;
  /** Close an alert dialog */
  closeAlertDialog(el: string | Element): void;
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
  /** Toggle mobile navbar menu */
  toggleNavbar(id: string | Element): void;
  /** Fix nested border-radius for inner elements */
  fixNestedRadius(el?: Element): void;

  // --- Texture API ---

  /** Set background texture type */
  setTexture(type: string): void;
  /** Get current background texture type */
  getTexture(): string;
  /** Array of available texture types */
  readonly TEXTURES: string[];

  // --- Icons ---

  /** Re-initialize Lucide icons (call after adding dynamic content) */
  refreshIcons(): void;
}

declare const DAUB: DAUBStatic;

interface Window {
  DAUB: DAUBStatic;
}
