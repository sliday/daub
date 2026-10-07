(function () {
  'use strict';
  const root = document.getElementById('chat-scroller');
  const messages = document.getElementById('chat-messages');
  const initial = messages.innerHTML;
  const controller = DAUB.createMessageScroller(root);
  const form = document.getElementById('chat-form');
  const composer = DAUB.createChatComposer(form);
  function slot(className, id) {
    const element = form.querySelector('.db-chat-composer__' + className);
    const oldId = element.id;
    element.id = id;
    for (const label of form.querySelectorAll('label')) if (label.htmlFor === oldId) label.htmlFor = id;
    return element;
  }
  const input = slot('input', 'chat-prompt');
  slot('send', 'chat-send');
  slot('stop', 'chat-stop');
  slot('status', 'chat-status');
  slot('file-input', 'chat-file');
  slot('attachments', 'pending-attachments');
  DAUB.init(form);
  const history = document.getElementById('load-history');
  let stream = null, sequence = 0, historyCount = 0, statusRevision = 0, queueTimer = null, workspace = null;
  const attachedFiles = new Set();
  const demoFiles = [
    { path: 'review-checklist.md', additions: 3, deletions: 1, before: '# Release review\n- Desktop smoke test\n- Export a report', patch: '@@ -1,3 +1,5 @@\n # Release review\n-- Desktop smoke test\n+- Desktop and mobile smoke tests\n+- Keyboard and focus checks\n+- Record release decision\n - Export a report' },
    { path: 'release-notes.md', additions: 2, deletions: 0, before: '# Release notes\n- Selected date range included in exports', patch: '@@ -1,2 +1,4 @@\n # Release notes\n - Selected date range included in exports\n+- Queued follow-up messages\n+- Keyboard-accessible chat actions' },
  ];

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function icon(name) {
    const element = node('i');
    element.dataset.lucide = name;
    element.setAttribute('aria-hidden', 'true');
    return element;
  }
  function icons() { if (window.lucide) lucide.createIcons(); }
  function initialChangeSummary() {
    const content = messages.querySelector('[data-db-message-id="initial-answer"] .db-message__content');
    if (!content) return;
    const card = node('section', 'db-change-summary');
    card.setAttribute('aria-label', 'Demo file changes');
    const header = node('div', 'db-change-summary__header');
    const glyph = node('span', 'db-change-summary__icon');
    glyph.append(icon('files'));
    const heading = node('div', 'db-change-summary__heading');
    const title = node('span', 'db-change-summary__title', 'Prepared 2 demo files');
    const description = node('span', 'db-change-summary__description', 'Demo changes');
    const totals = node('span', 'db-change-summary__totals');
    const added = node('span', 'db-change-summary__additions', '+5');
    const removed = node('span', 'db-change-summary__deletions', '-1');
    added.setAttribute('aria-label', '5 added lines');
    removed.setAttribute('aria-label', '1 deleted line');
    totals.append(added, removed);
    heading.append(title, description, totals);
    const actions = node('div', 'db-change-summary__actions');
    const undo = node('button', 'db-btn db-btn--ghost db-btn--sm');
    undo.type = 'button'; undo.setAttribute('aria-label', 'Undo demo changes'); undo.title = 'Undo demo changes';
    undo.append(icon('undo-2'), node('span', '', 'Undo'));
    const view = node('button', 'db-btn db-btn--secondary db-btn--sm', 'View changes');
    view.type = 'button'; view.setAttribute('aria-label', 'View demo changes'); view.title = 'View demo changes';
    actions.append(undo, view);
    header.append(glyph, heading, actions);
    const list = node('ul', 'db-change-summary__files');
    for (const file of demoFiles) {
      const row = node('li', 'db-change-summary__file');
      const path = node('span', 'db-change-summary__path', file.path); path.title = file.path;
      const counts = node('span', 'db-change-summary__counts');
      const additions = node('span', 'db-change-summary__additions', '+' + file.additions);
      const deletions = node('span', 'db-change-summary__deletions', '-' + file.deletions);
      additions.setAttribute('aria-label', file.additions + ' added lines');
      deletions.setAttribute('aria-label', file.deletions + ' deleted lines');
      counts.append(additions, deletions); row.append(path, counts); list.append(row);
    }
    card.append(header, list);
    const batch = { applied: true };
    undo.addEventListener('click', () => {
      if (!batch.applied) return;
      batch.applied = false; title.textContent = 'Reverted 2 demo files'; description.textContent = 'Demo changes reverted';
      totals.replaceChildren(node('span', '', 'No pending changes'));
      for (const counts of list.querySelectorAll('.db-change-summary__counts')) counts.textContent = 'Reverted';
      undo.disabled = true;
      setStatus('Demo changes reverted');
    });
    view.addEventListener('click', () => {
      const body = document.getElementById('chat-changes-body');
      body.replaceChildren();
      for (const file of demoFiles) {
        const section = node('section', 'chat-demo-changes-file');
        section.append(node('h3', '', file.path), node('pre', '', batch.applied ? file.patch : file.before));
        body.append(section);
      }
      DAUB.openModal('chat-changes-modal');
    });
    content.insertBefore(card, content.querySelector('.db-message__footer--hover'));
  }
  function thinking(content, completed = false, context = {}) {
    const element = node('details', 'chat-demo-thinking');
    const summary = node('summary');
    const chevron = icon('chevron-right');
    chevron.className = 'chat-demo-thinking__chevron';
    const copy = node('span', 'chat-demo-thinking__copy db-shimmer');
    const status = node('span', 'chat-demo-thinking__state');
    status.setAttribute('role', 'status');
    copy.append(node('span', '', 'Thinking'), status);
    const count = node('span', 'chat-demo-thinking__count');
    summary.append(chevron, copy, count);
    const list = node('ol', 'chat-demo-thinking__stages');
    list.setAttribute('aria-busy', 'true');
    element.append(summary, list, node('span', 'chat-demo-thinking__demo', 'Simulated activity'));
    content.insertBefore(element, content.querySelector('.db-bubble'));
    const labels = ['Reviewing the request', 'Preparing the reply', 'Writing the response'];
    const steps = [
      { kind: 'read', icon: 'file-text', detail: 'Message: ' + (context.prompt || 'Release review') + '\nAttachments: ' + ((context.attachmentNames || []).join(', ') || 'None') },
      { kind: 'prepare', icon: 'list-checks', detail: 'Prepared a scripted response. No model or tool calls.' },
      { kind: 'write', icon: 'pencil', detail: 'The demo streams the prepared reply into this conversation.' },
    ];
    let active = null;
    function settle(state) {
      if (!active) return;
      active.dataset.state = state;
      const indicator = active.querySelector('.chat-demo-step__state');
      indicator.replaceChildren(icon(state === 'complete' ? 'circle-check' : 'square'));
      indicator.setAttribute('aria-label', state === 'complete' ? 'Done' : 'Stopped');
    }
    function advance(index) {
      settle('complete');
      active = node('li');
      active.dataset.state = 'active';
      const detail = node('details', 'chat-demo-step');
      detail.dataset.kind = steps[index].kind;
      const heading = node('summary', 'db-marker');
      const indicator = node('span', 'db-marker__icon');
      indicator.append(icon(steps[index].icon));
      const state = node('span', 'chat-demo-step__state');
      state.setAttribute('aria-label', 'Working');
      state.append(icon('loader-circle'));
      const arrow = icon('chevron-right');
      arrow.className = 'chat-demo-step__chevron';
      heading.append(indicator, node('span', 'db-marker__content', labels[index]), state, arrow);
      const output = node('pre', 'chat-demo-step__detail', steps[index].detail);
      output.tabIndex = 0;
      output.setAttribute('role', 'region');
      output.setAttribute('aria-label', labels[index] + ' details');
      heading.addEventListener('keydown', event => {
        if (event.key === 'Tab' && !event.shiftKey && detail.open) {
          event.preventDefault();
          output.focus();
        }
      });
      output.addEventListener('keydown', event => {
        if (event.key === 'Tab' && event.shiftKey) {
          event.preventDefault();
          heading.focus();
        }
      });
      detail.append(heading, output);
      active.append(detail);
      list.append(active);
      count.textContent = list.children.length + (list.children.length === 1 ? ' step' : ' steps');
      element.dataset.state = 'active';
      status.textContent = labels[index];
      icons();
    }
    function finish(state) {
      settle(state);
      element.dataset.state = state;
      list.setAttribute('aria-busy', 'false');
      copy.classList.remove('db-shimmer');
      status.textContent = state === 'complete' ? 'Complete' : state === 'steered' ? 'Steered' : 'Stopped';
      icons();
    }
    if (completed) {
      labels.forEach((_, index) => advance(index));
      finish('complete');
    }
    return { advance, finish };
  }
  function initialThinking() {
    thinking(messages.querySelector('[data-db-message-id="initial-answer"] .db-message__content'), true, { prompt: messages.querySelector('[data-db-message-id="initial-question"] .db-bubble__content').textContent });
  }
  function setStatus(text) {
    statusRevision++;
    composer.setStatus(text);
    form.querySelector('.db-chat-composer__status').title = text;
    document.querySelector('.chat-demo-caption').textContent = text === 'Ready' ? 'Demo conversation' : text;
  }
  function updateSend() {
    composer.setBusy(Boolean(stream));
    messages.querySelectorAll('.chat-demo-retry').forEach(button => { button.disabled = Boolean(stream) || button.dataset.retried === 'true'; });
    icons();
  }
  function attachmentView(file) {
    const card = node('div', 'db-attachment db-attachment--sm');
    card.dataset.state = 'done';
    const media = node('div', 'db-attachment__media');
    if (file.url) {
      media.classList.add('db-attachment__media--image');
      const image = node('img');
      image.src = file.url;
      image.alt = file.name;
      media.append(image);
    } else media.append(icon('file-text'));
    const content = node('div', 'db-attachment__content');
    const title = node('span', 'db-attachment__title', file.name);
    title.title = file.name;
    content.append(title, node('span', 'db-attachment__description', Math.max(1, Math.round(file.size / 1024)) + ' KB'));
    card.append(media, content);
    return card;
  }
  const usedURLs = new Set();
  function messageMeta(content, role) {
    const header = content.querySelector('.db-message__header');
    const time = header.querySelector('time') || node('time');
    if (!time.dateTime) {
      const date = new Date();
      time.dateTime = date.toISOString();
      time.textContent = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    time.title = new Date(time.dateTime).toLocaleString();
    const footer = node('div', 'db-message__footer db-message__footer--hover');
    const actions = node('div', 'db-message__actions');
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', 'Message actions');
    const copy = content.querySelector('#copy-reply') || node('button', 'db-message__action chat-demo-copy');
    copy.className = 'db-message__action chat-demo-copy';
    copy.type = 'button';
    copy.tabIndex = 0;
    if (!copy.hasAttribute('aria-label')) {
      const label = role === 'user' ? 'Copy message' : 'Copy response';
      copy.setAttribute('aria-label', label);
      copy.title = label;
      copy.append(icon('copy'));
    }
    copy.disabled = !content.querySelector('.db-bubble__content').textContent;
    actions.append(copy);
    footer.append(time, actions);
    content.append(footer);
  }
  function initialMessageMeta() {
    for (const message of messages.querySelectorAll('.db-message')) {
      messageMeta(message.querySelector('.db-message__content'), message.classList.contains('db-message--end') ? 'user' : 'assistant');
    }
  }
  function row(text, role, id, target = messages) {
    const item = node('div', 'db-message-scroller__item');
    item.dataset.dbMessageId = id;
    if (role === 'user') item.setAttribute('data-db-scroll-anchor', '');
    const message = node('div', 'db-message' + (role === 'user' ? ' db-message--end' : ''));
    const content = node('div', 'db-message__content');
    content.append(node('div', 'db-message__header', role === 'user' ? 'You' : 'DAUB Assistant'));
    const bubble = node('div', 'db-bubble' + (role === 'assistant' ? ' db-bubble--ghost' : ''));
    const body = node('div', 'db-bubble__content', text);
    bubble.append(body);
    content.append(bubble);
    messageMeta(content, role);
    if (role === 'assistant') {
      const avatar = node('div', 'db-message__avatar');
      const fallback = node('span', 'db-avatar', 'D');
      fallback.setAttribute('aria-label', 'DAUB Assistant');
      avatar.append(fallback);
      message.append(avatar);
    }
    message.append(content);
    item.append(message);
    target.append(item);
    return { item, content, body };
  }
  function stop(reason = 'stopped') {
    clearTimeout(queueTimer);
    queueTimer = null;
    if (!stream) return;
    clearTimeout(stream.timer);
    stream.thinking.finish(reason);
    responseFooter(stream, reason);
    stream = null;
    messages.setAttribute('aria-busy', 'false');
    setStatus(reason === 'steered' ? 'Steered' : 'Stopped');
    updateSend();
    workspace?.refresh();
  }
  function reply(prompt, request = {}) {
    if (request.mode === 'plan') return '1. Review the main workflow and its release criteria.\n2. Compare desktop and mobile behavior, including empty and error states.\n3. Check keyboard access and file attachments.\n4. Record findings and confirm the release decision.';
    if (request.model === 'demo-brief') return 'Review the main workflow, keyboard access, and mobile layout. Check empty and error states, then record the release decision.';
    if (request.model === 'demo-code') return 'Check the message state transitions, pending-file cleanup, and queue ordering. Cover send, stop, steer, and retry in focused tests. Confirm that model configuration travels with each request and that user-provided text stays plain text.';
    if (/mobile|phone|responsive/i.test(prompt)) return 'Check the conversation at 320px and 375px. Keep attachments within the message column, give action buttons room, and verify that opening the keyboard leaves the composer reachable. Scroll up while a reply grows; the transcript should preserve your place until you return to the latest message.';
    if (/file|attach|upload/i.test(prompt)) return 'Separate the attachment preview from its actions. The file title, metadata, and progress belong in the content slot; remove and retry controls belong in the actions slot. In this demo, selected files stay in your browser. Your application supplies uploading, storage, and the upload lifecycle.';
    return 'Review the main flow first, then its failure states. Try a long message, a narrow viewport, and a reply that grows while you read earlier messages. Confirm that loading history preserves your place and that the latest-message button resumes following. Keep model calls and storage in your application; these conversation components handle presentation and scrolling.';
  }
  function responseFooter(current, state) {
    current.answer.content.querySelector('.chat-demo-copy').disabled = !current.answer.body.textContent;
    if (state === 'complete') { icons(); return; }
    const footer = node('div', 'db-message__footer chat-demo-run-footer');
    footer.append(node('span', '', state === 'steered' ? 'Steered' : 'Stopped'));
    if (state === 'stopped') {
      const retry = node('button', 'db-btn db-btn--ghost db-btn--sm chat-demo-retry');
      retry.type = 'button';
      retry.setAttribute('aria-label', 'Retry response');
      retry.title = 'Retry response';
      retry.append(icon('rotate-ccw'), node('span', '', 'Retry'));
      retry.addEventListener('click', () => {
        if (stream || retry.disabled) return;
        retry.dataset.retried = 'true';
        startResponse(current.request, current.turn, current.attempt + 1);
      });
      footer.append(retry);
    }
    current.answer.content.append(footer);
    icons();
  }
  function startResponse(request, turn, attempt = 1) {
    messages.setAttribute('aria-busy', 'true');
    const answer = row('', 'assistant', 'assistant-' + turn + (attempt > 1 ? '-retry-' + attempt : ''));
    if (attempt > 1) answer.content.querySelector('.db-message__header').append(node('span', 'chat-demo-run-label', 'Attempt ' + attempt + ' (demo)'));
    answer.body.parentElement.hidden = true;
    const activity = thinking(answer.content, false, request);
    const chunks = reply(request.prompt, request).split(/(?<=\s)/);
    const current = { timer: null, thinking: activity, answer, request, turn, attempt };
    stream = current;
    setStatus('Simulated response');
    updateSend();
    let index = 0;
    function tick() {
      if (stream !== current) return;
      answer.body.append(document.createTextNode(chunks[index++]));
      if (index < chunks.length) stream.timer = setTimeout(tick, 32);
      else {
        activity.finish('complete');
        responseFooter(current, 'complete');
        stream = null;
        messages.setAttribute('aria-busy', 'false');
        setStatus('Ready');
        updateSend();
        workspace?.refresh();
        queueTimer = setTimeout(() => {
          queueTimer = null;
          if (stream) return;
          const next = composer.takeNext();
          if (next) consume(next);
        }, 30);
      }
    }
    function stage(index) {
      if (stream !== current) return;
      activity.advance(index);
      if (index < 2) current.timer = setTimeout(() => stage(index + 1), 400);
      else {
        answer.body.parentElement.hidden = false;
        current.timer = setTimeout(tick, 120);
      }
    }
    stage(0);
    workspace?.refresh();
  }
  function consume(value, steered = false) {
    const prompt = value.text || '';
    const request = { ...value, prompt, attachmentNames: (value.files || []).map(file => file.name) };
    const user = row(prompt || 'Attached files', 'user', 'user-' + ++sequence);
    if (steered) user.content.querySelector('.db-message__header').append(node('span', 'chat-demo-run-label', 'Steered mid-run'));
    if (value.goal) user.content.querySelector('.db-message__header').append(node('span', 'chat-demo-run-label', 'Goal'));
    if (value.files?.length) {
      const group = node('div', 'db-attachment-group');
      for (const file of value.files) {
        attachedFiles.add(file);
        const image = /^image\/(png|jpeg|gif|webp|avif)$/.test(file.type);
        const url = image ? URL.createObjectURL(file) : null;
        if (url) usedURLs.add(url);
        group.append(attachmentView({ name: file.name, size: file.size, url }));
      }
      user.content.insertBefore(group, user.content.querySelector('.db-message__footer--hover'));
    }
    workspace?.setView('conversation');
    startResponse(request, sequence);
  }
  form.addEventListener('db:chat-send', event => consume(event.detail.request));
  form.addEventListener('db:chat-stop', () => stop());
  form.addEventListener('db:chat-steer', event => {
    const running = Boolean(stream);
    if (running) stop('steered');
    consume(event.detail.request, running);
  });
  form.addEventListener('db:chat-action', event => workspace?.command(event.detail.action?.id || event.detail.action, event.detail.request));
  for (const type of ['db:chat-queue', 'db:chat-change', 'db:chat-config', 'db:chat-dictation']) form.addEventListener(type, () => { statusRevision++; workspace?.refresh(); });
  input.addEventListener('input', () => { statusRevision++; });
  history.addEventListener('click', () => {
    const fragment = document.createDocumentFragment();
    const count = ++historyCount;
    row('Release review ' + count + ': the report export now includes the selected date range.', 'user', 'history-user-' + count, fragment);
    const answer = row('Add that change to the review checklist. Compare one exported report with the matching dashboard filters, then check the empty date range.', 'assistant', 'history-assistant-' + count, fragment);
    thinking(answer.content, true);
    messages.prepend(fragment);
    icons();
    workspace?.refresh();
    if (historyCount >= 3) history.disabled = true;
  });
  function reset({ empty = false } = {}) {
    stop();
    for (const url of usedURLs) URL.revokeObjectURL(url);
    usedURLs.clear();
    attachedFiles.clear();
    composer.clearDraft();
    for (const request of composer.getQueue()) composer.removeQueued(request.id);
    messages.innerHTML = empty ? '' : initial;
    DAUB.closeModal('chat-changes-modal');
    if (!empty) { initialThinking(); initialMessageMeta(); initialChangeSummary(); }
    historyCount = 0;
    history.disabled = false;
    input.value = '';
    setStatus('Ready');
    icons();
    requestAnimationFrame(() => controller.scrollToEnd());
    updateSend();
    workspace?.refresh();
  }
  document.getElementById('reset-chat').addEventListener('click', () => reset());
  async function copyText(text, result = 'Copied') {
    const revision = ++statusRevision;
    try {
      await navigator.clipboard.writeText(text);
      if (revision === statusRevision) setStatus(result);
    } catch (_) { if (revision === statusRevision) setStatus('Clipboard unavailable'); }
  }
  messages.addEventListener('click', async event => {
    const button = event.target.closest('#copy-reply, .chat-demo-copy');
    if (!button) return;
    copyText(button.closest('.db-message__content').querySelector('.db-bubble__content').textContent);
  });
  window.addEventListener('pagehide', event => {
    composer.stopDictation();
    stop();
    if (event.persisted) return;
    controller.destroy();
    composer.destroy();
    workspace?.destroy();
    for (const url of usedURLs) URL.revokeObjectURL(url);
  });
  initialThinking();
  initialMessageMeta();
  initialChangeSummary();
  workspace = createChatDemoShell({ composer, messages, scroller: controller, getFiles: () => [...new Set([...attachedFiles, ...composer.getState().files, ...composer.getQueue().flatMap(request => request.files || [])])], reset, setStatus, copyText });
  icons();
})();
