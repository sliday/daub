# daub-react

Typed React components for [DAUB UI](https://daub.dev) — the considered CSS component library.

Thin JSX wrappers around DAUB's CSS classes. Full TypeScript, IDE autocomplete, zero runtime overhead.

## Install

```bash
npm install daub-react daub-ui
```

Include DAUB CSS in your app (layout, `_app.tsx`, or `index.html`):

```tsx
import "daub-ui/daub.css";
```

## Usage

```tsx
import { Button, Card, Stack, Badge, ThemeProvider } from "daub-react";

function App() {
  return (
    <ThemeProvider theme="bone">
      <Stack direction="vertical" gap={4}>
        <Card title="Welcome" description="Get started with DAUB React">
          <Stack direction="horizontal" gap={2}>
            <Button variant="primary">Get Started</Button>
            <Button variant="ghost">Learn More</Button>
          </Stack>
        </Card>
        <Badge variant="success">Live</Badge>
      </Stack>
    </ThemeProvider>
  );
}
```

## Components (59)

### Layout
`Stack` `Grid` `Surface` `Container` `Separator` `ScrollArea` `AspectRatio`

### Controls
`Button` `ButtonGroup` `Input` `Textarea` `Field` `InputGroup` `InputIcon` `Search` `Select` `Label` `Kbd` `Checkbox` `Radio` `RadioGroup` `Switch` `Slider` `Toggle` `ToggleGroup` `InputOTP` `CustomSelect`

### Data Display
`Card` `Badge` `Avatar` `AvatarGroup` `Alert` `Progress` `Skeleton` `EmptyState` `Spinner` `StatCard` `ChartCard` `Chart` `Image` `List` `Table` `DataTable` `Chip` `Prose` `Calendar` `Carousel`

### Navigation
`Breadcrumbs` `Pagination` `NavMenu` `BottomNav` `Stepper` `Navbar` `Tabs` `HoverCard`

### Overlays (coming soon)
Modal, Sheet, Drawer, Tooltip, Popover, DropdownMenu, Toast

### Compound
`Accordion` `Collapsible` `DatePicker`

### Provider
`ThemeProvider`

### Hooks
`useControllable`

## Design Principles

- **Thin wrappers** — props map to `db-*` CSS classes. No runtime styling.
- **Native HTML** — every component extends its native element's props via `ComponentProps<"div">`.
- **Refs forwarded** — `forwardRef` on all components.
- **Controlled & uncontrolled** — form components support both `value`+`onChange` and `defaultValue`.
- **className merge** — your `className` always wins (applied last).
- **Zero dependencies** — only `react` and `react-dom` as peer deps.
- **Tree-shakeable** — ESM + CJS with splitting.

## Themes

DAUB ships 20 theme families (40 light/dark variants). Apply via `ThemeProvider` or `data-theme`:

```tsx
<ThemeProvider theme="dracula">
  <App />
</ThemeProvider>
```

Available: `default` `dark` `bone` `bone-dark` `ink` `ink-light` `ember` `ember-light` `grunge-light` `grunge-dark` `solarized` `solarized-dark` `dracula` `dracula-light` `nord` `nord-light` `one-dark` `one-dark-light` `monokai` `monokai-light` `gruvbox` `gruvbox-light` `night-owl` `night-owl-light` `github` `github-dark` `catppuccin` `catppuccin-dark` `tokyo-night` `tokyo-night-light` `material` `material-light` `synthwave` `synthwave-light` `shades-of-purple` `shades-of-purple-light` `ayu` `ayu-dark` `horizon` `horizon-light`

## TypeScript

All props are fully typed. Import types directly:

```tsx
import type { ButtonVariant, Size, ChipColor, GapToken } from "daub-react";
```

## Links

- [DAUB Documentation](https://daub.dev/docs.html)
- [Component Playground](https://daub.dev/playground.html)
- [Theme Gallery](https://daub.dev/themes.html)
- [GitHub](https://github.com/sliday/daub)
- [CSS Package (daub-ui)](https://www.npmjs.com/package/daub-ui)

## License

MIT
