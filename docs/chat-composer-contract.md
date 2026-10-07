# Rich Chat Composer

The reusable composer manages drafts, local attachments, queue controls, configuration,
and dictation. The host owns model calls, steering semantics, approval enforcement,
conversation history, and storage. Demo engines must identify themselves as simulated.

## Native Interface

`DAUB.createChatComposer(root, options)` initializes an empty `.db-chat-composer`
form and returns an idempotent controller. `DAUB.init()` enhances native roots;
React-owned roots require an explicit controller call. No external requests occur
until the user starts browser dictation or the host handles an event.

Options: `models: [{id, label, efforts?: string[]}]`, `model`, `effort`,
`approval: 'ask' | 'auto'`, `mode: 'chat' | 'plan'`,
`actions: [{id, label, icon?, disabled?}]`,
`capabilities: {queue?, steer?, attachments?, folders?, dictation?, approval?}`.
Queue, steer, attachments, approval, and browser-supported dictation default on.
Folders require browser support. The default models are explicitly simulated.

A request contains `id`, `text`, `files: File[]`, `model`, `effort`, `approval`,
`mode`, and optional `goal`. Configuration describes intent, not access rights.
Preserve File objects locally; do not upload or read file content without host action.

Cancelable bubbling events:
- `db:chat-send`, `db:chat-steer`: `detail.request`.
- `db:chat-stop`: no request.
- `db:chat-action`: `detail.action` for configured extended Add actions.

Informational bubbling events:
- `db:chat-queue`: `detail.request` and queue updates.
- `db:chat-config`: selected model, effort, approval, mode, goal.
- `db:chat-dictation`: `detail.state` and optional error.

Preventing a send or steer event retains the draft or queued item. Steer removes
an item only after the host accepts it. The host calls `setBusy(true)` during a
response and `setBusy(false)` afterward; it explicitly drains queued messages.

Controller methods: `getState()`, `updateOptions(options)`, `setBusy(boolean)`, `setStatus(string)`,
`setDraft(string)`, `clearDraft()`, `attachFiles(File[])`, `getQueue()`, `takeNext()`,
`removeQueued(id)`, `editQueued(id, text)`, `steerQueued(id)`,
`setModel(id)`, `setEffort(value)`, `setMode(value)`, `setApproval(value)`,
`setGoal(string|null)`, `startDictation()`, `stopDictation()`, `destroy()`.

`getState()` returns `text`, `files`, `queue`, `busy`, `model`, `effort`,
`approval`, `mode`, `goal`, and dictation state. Controller disposal cancels
recognition, removes listeners, and revokes owned preview URLs.

Pasting into the message input attaches clipboard images, standalone base64 image
data URLs, and base64 images embedded in clipboard HTML. Data URLs support PNG,
JPEG, GIF, WebP, and AVIF. The composer converts them to local `File` objects and
uses the same removable previews and send/queue payloads as selected files. It
does not fetch remote image URLs or insert clipboard HTML. Mixed text stays in the
draft at the cursor. Ordinary text and unsupported data keep normal paste behavior.
The attachments capability also controls image pasting.

The default toolbar keeps Add and approval on the left, with model/effort summary,
dictation, and send on the right. Chat settings contains effort, mode, and goal.
At narrow widths approval uses its shield icon and the model summary omits effort.
Status remains available to assistive technology without taking toolbar space.

## DOM Slots

The root is an unframed queue plus a framed composer, not nested cards.
- `.db-chat-composer__queue`, `__queued-item`, `__queued-text`, `__queued-actions`.
- `.db-chat-composer__panel`, `__attachments`, `__input`, `__toolbar`, `__status`.
- `.db-chat-composer__add`, `__add-menu`, `__file-input`, `__folder-input`.
- `.db-chat-composer__model`, `__effort`, `__approval`, `__mode`, `__goal`.
- `.db-chat-composer__choice`, `__choice-trigger`, `__choice-label`, `__choice-menu`, `__choice-option`.
- `.db-chat-composer__dictation`, `__dictation-bar`, `__dictation-cancel`.
- `.db-chat-composer__send`, `__stop`, `__dropzone`.

Controls have accessible names, native form semantics, visible focus rings,
32px desktop targets and 44px touch targets. Menus follow DAUB Dropdown patterns.
Queue items expose Steer, Remove, and an Edit menu with a bounded inline editor.
While busy, Send becomes Queue message; Stop remains a separate control.
Model and effort selection lock during an active response. Dropping files cannot
navigate the document. Dictation starts only on a user command, supports interim
and final text, and exposes unsupported, listening, stopped, and error states.
The model, effort, approval, and mode fields use themed combobox/listbox pickers.
Their hidden selects retain form values; use controller setters to change them.
Sibling composer popups close when another opens. A nested picker keeps its
containing settings panel open. Arrow keys, typeahead, Enter, and Escape work.
You get a disabled mic when page policy blocks microphone access. Permission
refusals preserve your draft and display a readable error, without an automatic retry.

## Declarative Component

`ChatComposer` accepts the native options plus `busy`, `placeholder`, and `id`.
The canonical renderer emits a composer root with escaped JSON configuration.
The React wrapper owns only that root, initializes the same native controller,
forwards props and host event callbacks, and destroys its controller on unmount.
It requires `daub.js` alongside `daub.css`. Do not duplicate its queue state engine.

## Demo Shell

The demo provides conversation/activity/files/queue sidebar views and a top menu
for rename, pin, new conversation, copying/exporting, and clearing local state.
Extended Add actions provide local context text and sketch attachments. They
remain host-provided actions, not ambient browser or filesystem access.
The existing Thinking disclosure, horizontal shimmer, Copy/Retry controls,
and scroller behavior remain intact.

Completed replies show one completion state in Thinking. The demo has no
delivery-acknowledgement reaction or raw model/effort metadata in message headers.
The ChangeSummary fixture names its data as demo changes. View changes previews
the supplied patch text; Undo restores only the fixture's browser state.
The host supplies real changes, undo confirmation, diff viewers, and persistence.
