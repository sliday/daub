# daub-react

Typed React components for [DAUB UI](https://daub.dev) — the considered CSS component library.

Typed wrappers around DAUB's CSS classes, with React state and keyboard behavior for interactive components.

## Install

```bash
npm install daub-react daub-ui
```

Use React 19 or later. The message scroller depends on `@shadcn/react@0.3.1`, which requires React 19. DAUB bundles the headless engine in both ESM and CommonJS output; it retains the dependency for its exported types. See `THIRD_PARTY_NOTICES.md` for the upstream MIT license.

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

## Components (83)

### Layout
`Stack` `Grid` `Surface` `Container` `Separator` `ScrollArea` `AspectRatio` `Frame` `Group` `Fieldset` `Toolbar`

### Controls
`Button` `ButtonGroup` `Input` `Textarea` `Field` `InputGroup` `InputIcon` `Search` `Select` `Label` `Kbd` `Checkbox` `CheckboxGroup` `Radio` `RadioGroup` `Switch` `Slider` `Toggle` `ToggleGroup` `InputOTP` `CustomSelect` `NumberField`

### Data Display
`Card` `Badge` `Avatar` `AvatarGroup` `Alert` `Progress` `Meter` `Skeleton` `EmptyState` `Spinner` `StatCard` `ChartCard` `Chart` `Image` `List` `Table` `DataTable` `Chip` `Prose` `Calendar` `Carousel`

### Navigation
`Breadcrumbs` `Pagination` `NavMenu` `BottomNav` `Stepper` `Navbar` `Tabs` `HoverCard`

### Overlays
`Modal` `AlertDialog` `Sheet` `Drawer` `Tooltip` `Popover` `DropdownMenu` `ContextMenu` `CommandPalette` `PreviewCard` `Toast`

### Compound
`Accordion` `Collapsible` `DatePicker`

### Chat
`MessageScroller` `Message` `Bubble` `Attachment` `Marker`

### Provider
`ThemeProvider` `ToastProvider` `MessageScrollerProvider`

### Hooks
`useControllable` `useMessageScroller` `useMessageScrollerScrollable` `useMessageScrollerVisibility`

## Chat Composition

DAUB wraps the [headless message scroller](https://ui.shadcn.com/docs/react/message-scroller) from `@shadcn/react/message-scroller`. The engine handles streaming anchors, following output, history prepend preservation, visibility, and imperative scroll commands. DAUB adds CSS classes and native refs; you supply messages and application state.

```tsx
import {
  MessageScrollerProvider, MessageScroller, MessageScrollerViewport,
  MessageScrollerContent, MessageScrollerItem, MessageScrollerButton,
  Message, MessageContent, MessageHeader, MessageFooter,
  Bubble, BubbleContent,
} from "daub-react";

type ChatRow = { id: string; sender: string; text: string; outgoing: boolean };

function Transcript({ messages, streaming }: { messages: ChatRow[]; streaming: boolean }) {
  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <MessageScroller aria-label="Conversation">
        <MessageScrollerViewport>
          <MessageScrollerContent aria-busy={streaming}>
            {messages.map(message => (
              <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.outgoing}>
                <Message align={message.outgoing ? "end" : "start"}>
                  <MessageContent>
                    <MessageHeader>{message.sender}</MessageHeader>
                    <Bubble variant={message.outgoing ? "primary" : "secondary"}>
                      <BubbleContent>{message.text}</BubbleContent>
                    </Bubble>
                    <MessageFooter>{message.outgoing ? "Sent" : "Received"}</MessageFooter>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
```

Use stable message IDs for both `key` and `messageId`. Index-based IDs change when you prepend history. Make each direct child of `MessageScrollerContent` a `MessageScrollerItem`, including markers and load-more rows. Place the provider around the scroller and any sibling component that calls its hooks.

`MessageScrollerProvider` defaults to `autoScroll={true}`, `defaultScrollPosition="end"`, and `scrollPreviousItemPeek={64}`. The headless engine defaults `autoScroll` to `false`; DAUB enables it. Pass `autoScroll={false}` for app-controlled scrolling. Provider options also include `scrollEdgeThreshold` and `scrollMargin`. Set `defaultScrollPosition="last-anchor"` to restore the last anchored turn; the engine falls back to the end when that turn fits. The viewport preserves prepended history by default; opt out with `preserveScrollOnPrepend={false}`.

The hooks retain the engine API:

- `useMessageScroller()`: `scrollToMessage(id, options?)`, `scrollToStart(options?)`, `scrollToEnd(options?)`. Commands return whether the engine accepted the request. Options include `align`, `behavior`, and `scrollMargin`.
- `useMessageScrollerScrollable()`: `{ start, end }` describes the edges with hidden content.
- `useMessageScrollerVisibility()`: `{ currentAnchorId, visibleMessageIds }` tracks mounted rows. An anchor becomes current once it reaches the reading line, which uses the provider margin and peek.

`MessageScrollerButton` supports `direction="start" | "end"`, `behavior`, `render`, and native button props. DAUB uses its existing `Button`, supplies an accessible label, and hides inactive or disabled controls. Consumer handlers can call `event.preventDefault()` to cancel a scroll command. Root and viewport retain `data-scrollable`, `data-autoscrolling`, and `data-pending-scroll` from the engine. DAUB mirrors `messageId` and `scrollAnchor` as `data-db-message-id` and `data-db-scroll-anchor` on items. React-owned parts carry `data-db-react` so native DAUB initialization leaves them alone.

Server rendering and hydration work without `window.DAUB`. For `end` and `last-anchor`, the engine sets `data-pending-scroll` until it applies the opening position. You can scope `visibility: hidden` to `.db-message-scroller__viewport[data-pending-scroll]` to prevent a first-paint jump; preserve layout so the engine can measure it.

### Chat Parts

| Family | Parts | Props |
| --- | --- | --- |
| Message | `MessageAvatar`, `MessageContent`, `MessageHeader`, `MessageFooter`, `MessageGroup` | `align="start" | "end"` |
| Bubble | `BubbleContent`, `BubbleReactions`, `BubbleGroup`, `BubbleCollapsible` | `variant="primary" | "default" | "secondary" | "muted" | "tinted" | "outline" | "ghost" | "destructive"`, `align` |
| Attachment | `AttachmentMedia`, `AttachmentContent`, `AttachmentTitle`, `AttachmentDescription`, `AttachmentActions`, `AttachmentAction`, `AttachmentTrigger`, `AttachmentGroup`, `AttachmentProgress` | `state="idle" | "uploading" | "processing" | "error" | "done"`, `orientation="horizontal" | "vertical"`, `size="default" | "sm" | "xs"` |
| Marker | `MarkerIcon`, `MarkerContent` | `variant="default" | "border" | "separator"`, `busy` |

`Bubble` maps `variant="default"` to `primary`. Place reactions after content. `BubbleCollapsible` composes the existing `Collapsible` and accepts `trigger`, `open`, `defaultOpen`, and `onChange`; it retains mounted child state while closed.

Attachment states describe your application's upload or processing state. DAUB does not send files or persist them. Place the overlay trigger alongside the media, content, and actions, so you do not nest buttons:

```tsx
<Attachment state="uploading" size="sm">
  <AttachmentMedia>PDF</AttachmentMedia>
  <AttachmentContent>
    <AttachmentTitle>notes.pdf</AttachmentTitle>
    <AttachmentDescription>42 KB</AttachmentDescription>
    <AttachmentProgress value={42} aria-label="Upload progress" />
  </AttachmentContent>
  <AttachmentActions>
    <AttachmentAction aria-label="Remove notes.pdf" onClick={removeFile}>x</AttachmentAction>
  </AttachmentActions>
  <AttachmentTrigger aria-label="Open notes.pdf" onClick={openFile} />
</Attachment>
```

`AttachmentMedia variant="image"` frames an image you supply. `AttachmentProgress` composes `Progress`, clamps `value` to 0-100, and supports `indeterminate` without announcing a numeric value. Give icon-only actions and triggers an accessible name; their default type is `button`. `Marker busy` defaults to `role="status"` and `aria-busy="true"`. Its icon remains decorative. Use `MarkerContent` for the text announcement and add `className="db-shimmer"` there when you want the CSS shimmer utility.

## Design Principles

- **Thin wrappers** — props map to `db-*` CSS classes. No runtime styling.
- **Native HTML** — element wrappers extend their underlying HTML element's props.
- **Native refs** — wrappers expose refs where their public API supports them.
- **Controlled & uncontrolled** — form components support both `value`+`onChange` and `defaultValue`.
- **className merge** — your additional classes join the component's DAUB classes.
- **Headless scroll engine**: `@shadcn/react` supplies message-scroll behavior; React 19 and React DOM 19 are peer dependencies. DAUB imports no shadcn visual components or Tailwind styles.
- **Tree-shakeable** — ESM + CJS with splitting.

## Themes

DAUB ships 21 theme families (42 light/dark variants). Apply via `ThemeProvider` or `data-theme`:

```tsx
<ThemeProvider theme="dracula">
  <App />
</ThemeProvider>
```

Available: `light` `dark` `bone` `bone-dark` `ink` `ink-light` `ember` `ember-light` `grunge-light` `grunge-dark` `solarized` `solarized-dark` `dracula` `dracula-light` `nord` `nord-light` `one-dark` `one-dark-light` `monokai` `monokai-light` `gruvbox` `gruvbox-light` `night-owl` `night-owl-light` `github` `github-dark` `catppuccin` `catppuccin-dark` `tokyo-night` `tokyo-night-light` `material` `material-light` `monospace` `monospace-light` `synthwave` `synthwave-light` `shades-of-purple` `shades-of-purple-light` `ayu` `ayu-dark` `horizon` `horizon-light`

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
