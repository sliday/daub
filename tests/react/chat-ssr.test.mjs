import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../react/package.json', import.meta.url));
const { build } = require('esbuild');
const result = await build({
  entryPoints: [fileURLToPath(new URL('../../react/src/index.ts', import.meta.url))],
  bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
const chat = module.exports;
const { createElement: h } = require('react');
const { renderToString } = require('react-dom/server');

test('public entry point exports composable chat families and headless hooks', () => {
  for (const name of [
    'MessageScroller', 'MessageScrollerProvider', 'MessageScrollerViewport',
    'MessageScrollerContent', 'MessageScrollerItem', 'MessageScrollerButton',
    'useMessageScroller', 'useMessageScrollerScrollable', 'useMessageScrollerVisibility',
    'Message', 'MessageAvatar', 'MessageContent', 'MessageHeader', 'MessageFooter', 'MessageGroup',
    'Bubble', 'BubbleContent', 'BubbleReactions', 'BubbleGroup', 'BubbleCollapsible',
    'Attachment', 'AttachmentMedia', 'AttachmentContent', 'AttachmentTitle',
    'AttachmentDescription', 'AttachmentActions', 'AttachmentAction', 'AttachmentTrigger',
    'AttachmentGroup', 'AttachmentProgress', 'Marker', 'MarkerIcon', 'MarkerContent',
  ]) assert.ok(chat[name], `Missing public export: ${name}`);
});

test('SSR renders all families without a window, document, or DAUB runtime', () => {
  assert.equal(typeof window, 'undefined');
  assert.equal(typeof document, 'undefined');
  const html = renderToString(h(chat.MessageGroup, null,
    h(chat.Message, { align: 'end', id: 'message', className: 'custom', title: 'Native title' },
      h(chat.MessageAvatar, null, 'A'),
      h(chat.MessageContent, null,
        h(chat.MessageHeader, null, 'Ada'),
        h(chat.BubbleGroup, null, h(chat.Bubble, { variant: 'default', align: 'end' },
          h(chat.BubbleContent, null, 'Reply'), h(chat.BubbleReactions, null, 'Liked'))),
        h(chat.MessageFooter, null, 'Sent'))),
    h(chat.AttachmentGroup, null, h(chat.Attachment, { state: 'uploading', orientation: 'vertical', size: 'sm' },
      h(chat.AttachmentMedia, { variant: 'image' }, h('img', { alt: 'Preview', src: 'data:image/png;base64,AA==' })),
      h(chat.AttachmentContent, null, h(chat.AttachmentTitle, null, 'notes.pdf'), h(chat.AttachmentDescription, null, 'PDF')),
      h(chat.AttachmentProgress, { value: 42, 'aria-label': 'Upload progress' }),
      h(chat.AttachmentActions, null, h(chat.AttachmentAction, null, 'Remove')),
      h(chat.AttachmentTrigger, { 'aria-label': 'Open notes.pdf' }))),
    h(chat.Marker, { busy: true, variant: 'border' }, h(chat.MarkerIcon, null, 'x'), h(chat.MarkerContent, null, 'Processing')),
  ));
  assert.match(html, /db-message db-message--end custom/);
  assert.match(html, /title="Native title"/);
  assert.match(html, /db-bubble db-bubble--primary db-bubble--end/);
  assert.match(html, /db-attachment--vertical db-attachment--sm/);
  assert.match(html, /aria-valuenow="42"/);
  assert.match(html, /data-state="uploading"/);
  assert.match(html, /role="status" aria-busy="true"/);
  assert.match(html, /aria-hidden="true" class="db-marker__icon"/);
  assert.equal((html.match(/type="button"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /<button[^>]*>(?:(?!<\/button>)[^])*<button/);
});

test('SSR scroller keeps engine markup, DAUB attributes, and inactive hidden button', () => {
  const html = renderToString(h(chat.MessageScrollerProvider, { defaultScrollPosition: 'last-anchor', scrollPreviousItemPeek: 24 },
    h(chat.MessageScroller, { id: 'thread' }, h(chat.MessageScrollerViewport, null,
      h(chat.MessageScrollerContent, { 'aria-busy': true },
        h(chat.MessageScrollerItem, { messageId: 'stable-id', scrollAnchor: true }, 'A reply'))),
      h(chat.MessageScrollerButton, null))));
  assert.match(html, /data-db-auto-scroll="true"/);
  assert.match(html, /data-db-scroll-position="last-anchor"/);
  assert.match(html, /data-db-scroll-peek="24"/);
  assert.match(html, /data-db-message-id="stable-id"/);
  assert.match(html, /data-message-id="stable-id"/);
  assert.match(html, /data-db-scroll-anchor="true"/);
  assert.match(html, /data-message-scroller-spacer/);
  assert.match(html, /data-pending-scroll/);
  assert.match(html, /role="region" aria-label="Messages" tabindex="0"/);
  assert.match(html, /role="log" aria-relevant="additions"/);
  assert.match(html, /data-active="false"/);
  assert.match(html, /hidden=""/);
  assert.match(html, /aria-label="Scroll to end"/);
});

test('SSR attachment progress clamps values and supports indeterminate app state', () => {
  assert.match(renderToString(h(chat.AttachmentProgress, { value: 120 })), /aria-valuenow="100"/);
  assert.match(renderToString(h(chat.AttachmentProgress, { value: -20 })), /aria-valuenow="0"/);
  const html = renderToString(h(chat.AttachmentProgress, { indeterminate: true, 'aria-label': 'Processing' }));
  assert.doesNotMatch(html, /aria-valuenow/);
  assert.match(html, /db-progress--indeterminate/);
});

test('SSR BubbleCollapsible uses existing Collapsible with stable native relationships', () => {
  const html = renderToString(h(chat.BubbleCollapsible, { trigger: 'Details', defaultOpen: true }, 'Reasoning'));
  assert.match(html, /db-collapsible db-collapsible--open db-bubble__content/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /aria-controls=/);
  assert.match(html, /role="region" aria-labelledby=/);
});
