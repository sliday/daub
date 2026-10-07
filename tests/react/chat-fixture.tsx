import { useEffect, useState, type ComponentProps } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import {
  MessageScroller, MessageScrollerProvider, MessageScrollerViewport, MessageScrollerContent,
  MessageScrollerItem, MessageScrollerButton, useMessageScroller,
  useMessageScrollerScrollable, useMessageScrollerVisibility,
  Message, MessageAvatar, MessageContent, MessageHeader, MessageFooter, MessageGroup,
  Bubble, BubbleContent, BubbleReactions, BubbleGroup, BubbleCollapsible,
  Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle, AttachmentDescription,
  AttachmentActions, AttachmentAction, AttachmentTrigger, AttachmentGroup, AttachmentProgress,
  Marker, MarkerIcon, MarkerContent,
} from '../../react/src/index';

const events: unknown[] = [];
const refs: Record<string, HTMLElement | null> = {};
const recordRef = (name: string) => (element: HTMLElement | null) => { refs[name] = element; };
let root: Root | undefined;
type ScrollerProps = ComponentProps<typeof MessageScrollerProvider> & {
  count?: number;
  cancel?: boolean;
  disabled?: boolean;
  anchorLast?: boolean;
  anchorIndex?: number;
  preserveScrollOnPrepend?: boolean;
  customRender?: boolean;
};

function Controls() {
  const api = useMessageScroller();
  const scrollable = useMessageScrollerScrollable();
  const visibility = useMessageScrollerVisibility();
  useEffect(() => { Object.assign(window, { chatApi: api }); }, [api]);
  return <output id="scroll-state">{JSON.stringify({ ...scrollable, ...visibility })}</output>;
}

function Scroller({ count = 20, cancel, disabled, anchorLast, anchorIndex, preserveScrollOnPrepend, customRender, ...options }: ScrollerProps) {
  const [rows, setRows] = useState(() => Array.from({ length: count }, (_, i) => ({ id: `m${i}`, height: 56, anchor: (anchorLast && i === count - 1) || i === anchorIndex })));
  useEffect(() => {
    Object.assign(window, {
      streamChat: () => setRows(rows => rows.map((row, i) => i === rows.length - 1 ? { ...row, height: row.height + 100 } : row)),
      prependChat: () => setRows(rows => [{ id: 'history-a', height: 70, anchor: false }, { id: 'history-b', height: 90, anchor: false }, ...rows]),
      appendChat: (anchor = false) => setRows(rows => [...rows, { id: `new-${rows.length}`, height: 56, anchor }]),
      replaceChat: () => setRows([{ id: 'replacement', height: 56, anchor: false }]),
    });
  }, []);
  return <MessageScrollerProvider {...options}>
    <MessageScroller ref={recordRef('root')} id="thread" style={{ display: 'flex', flexDirection: 'column', height: 240, position: 'relative' }}>
      <MessageScrollerViewport ref={recordRef('viewport')} preserveScrollOnPrepend={preserveScrollOnPrepend}
        onScroll={() => events.push('scroll')} onWheel={() => events.push('wheel')}
        onKeyDown={event => events.push(event.key)} onTouchMove={() => events.push('touch')}
        style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
        <MessageScrollerContent ref={recordRef('content')} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
          {rows.map(row => <MessageScrollerItem key={row.id} messageId={row.id} scrollAnchor={row.anchor}
            ref={recordRef(row.id)} style={{ minHeight: row.height, flex: 'none' }}>
            <Message><MessageContent><Bubble variant="secondary"><BubbleContent>{row.id}</BubbleContent></Bubble></MessageContent></Message>
          </MessageScrollerItem>)}
        </MessageScrollerContent>
      </MessageScrollerViewport>
      <MessageScrollerButton ref={recordRef('button')} disabled={disabled} behavior="auto"
        render={customRender ? <button data-custom="true" onClick={() => events.push('render')} /> : undefined}
        onClick={event => { events.push('jump'); if (cancel) event.preventDefault(); }} />
    </MessageScroller>
    <Controls />
  </MessageScrollerProvider>;
}

function Families(props: Record<string, unknown>) {
  return <form onSubmit={event => { event.preventDefault(); events.push('submit'); }}>
    <MessageGroup ref={recordRef('message-group')}><Message ref={recordRef('message')} align="end" title="Native title">
      <MessageAvatar ref={recordRef('avatar')}>A</MessageAvatar>
      <MessageContent ref={recordRef('message-content')}><MessageHeader ref={recordRef('header')}>Ada</MessageHeader>
        <BubbleGroup ref={recordRef('bubble-group')}><Bubble ref={recordRef('bubble')} variant="outline" align="end">
          <BubbleContent ref={recordRef('bubble-content')}>Reply</BubbleContent>
          <BubbleCollapsible ref={recordRef('collapsible')} trigger="Details" open={props.open as boolean | undefined}
            onChange={open => events.push(['collapse', open])}>
            <input aria-label="Notes" defaultValue="Preserve" />
          </BubbleCollapsible>
          <BubbleReactions ref={recordRef('reactions')}><button type="button">Like</button></BubbleReactions>
        </Bubble></BubbleGroup>
        <MessageFooter ref={recordRef('footer')}>Sent</MessageFooter>
      </MessageContent>
    </Message></MessageGroup>
    <AttachmentGroup ref={recordRef('attachment-group')}>
      <Attachment ref={recordRef('attachment')} state={(props.state as 'uploading') ?? 'uploading'} size="sm">
        <AttachmentMedia ref={recordRef('media')}>PDF</AttachmentMedia>
        <AttachmentContent ref={recordRef('attachment-content')}>
          <AttachmentTitle ref={recordRef('title')}>notes.pdf</AttachmentTitle>
          <AttachmentDescription ref={recordRef('description')}>42 KB</AttachmentDescription>
          <AttachmentProgress ref={recordRef('progress')} value={42} aria-label="Upload progress" />
        </AttachmentContent>
        <AttachmentActions ref={recordRef('actions')}>
          <AttachmentAction ref={recordRef('action')} aria-label="Remove notes.pdf" onClick={() => events.push('remove')}>x</AttachmentAction>
        </AttachmentActions>
        <AttachmentTrigger ref={recordRef('trigger')} aria-label="Open notes.pdf" onClick={() => events.push('open')} />
      </Attachment>
    </AttachmentGroup>
    <Marker ref={recordRef('marker')} busy variant="border"><MarkerIcon ref={recordRef('icon')}>*</MarkerIcon><MarkerContent ref={recordRef('marker-content')}>Processing</MarkerContent></Marker>
  </form>;
}

Object.assign(window, {
  chatEvents: events, chatRefs: refs,
  mountChat(kind: string, props: Record<string, unknown> = {}, container = document.getElementById('root')!) {
    root?.unmount();
    events.length = 0;
    root = createRoot(container);
    root.render(kind === 'scroller' ? <Scroller {...props} /> : <Families {...props} />);
  },
  hydrateChat() {
    root = hydrateRoot(document.getElementById('root')!, <MessageScrollerProvider>
      <MessageScroller id="hydrated"><MessageScrollerViewport><MessageScrollerContent>
        <MessageScrollerItem messageId="hydrated-row">Hello</MessageScrollerItem>
      </MessageScrollerContent></MessageScrollerViewport><MessageScrollerButton /></MessageScroller>
    </MessageScrollerProvider>);
  },
  unmountChat() { root?.unmount(); root = undefined; },
});
