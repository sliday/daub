(function () {
  'use strict';
  const root = document.getElementById('chat-scroller');
  const messages = document.getElementById('chat-messages');
  const initial = messages.innerHTML;
  const controller = DAUB.createMessageScroller(root);
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-prompt');
  const send = document.getElementById('chat-send');
  const status = document.getElementById('chat-status');
  const history = document.getElementById('load-history');
  const files = document.getElementById('chat-file');
  const pending = document.getElementById('pending-attachments');
  let stream = null, sequence = 0, historyCount = 0, statusRevision = 0;
  let attachments = [];

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
  function setStatus(text) { statusRevision++; status.textContent = text; }
  function updateSend() {
    send.disabled = !stream && !input.value.trim() && !attachments.length;
    const label = stream ? 'Stop response' : 'Send message';
    send.setAttribute('aria-label', label);
    send.title = label;
    send.replaceChildren(icon(stream ? 'square' : 'arrow-up'));
    icons();
  }
  function attachmentView(file, removable) {
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
    if (removable) {
      const actions = node('div', 'db-attachment__actions');
      const remove = node('button', 'db-attachment__action');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove ' + file.name);
      remove.title = 'Remove attachment';
      remove.append(icon('x'));
      remove.addEventListener('click', () => {
        attachments = attachments.filter(item => item !== file);
        if (file.url) URL.revokeObjectURL(file.url);
        card.remove();
        pending.hidden = !attachments.length;
        updateSend();
        input.focus();
      });
      actions.append(remove);
      card.append(actions);
    }
    return card;
  }
  const usedURLs = new Set();
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
  function stop() {
    if (!stream) return;
    clearTimeout(stream.timer);
    stream.marker.remove();
    stream = null;
    messages.setAttribute('aria-busy', 'false');
    setStatus('Stopped');
    updateSend();
  }
  function reply(prompt) {
    if (/mobile|phone|responsive/i.test(prompt)) return 'Check the conversation at 320px and 375px. Keep attachments within the message column, give action buttons room, and verify that opening the keyboard leaves the composer reachable. Scroll up while a reply grows; the transcript should preserve your place until you return to the latest message.';
    if (/file|attach|upload/i.test(prompt)) return 'Separate the attachment preview from its actions. The file title, metadata, and progress belong in the content slot; remove and retry controls belong in the actions slot. In this demo, selected files stay in your browser. Your application supplies uploading, storage, and the upload lifecycle.';
    return 'Review the main flow first, then its failure states. Try a long message, a narrow viewport, and a reply that grows while you read earlier messages. Confirm that loading history preserves your place and that the latest-message button resumes following. Keep model calls and storage in your application; these conversation components handle presentation and scrolling.';
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (stream) { stop(); return; }
    const prompt = input.value.trim();
    if (!prompt && !attachments.length) return;
    const user = row(prompt || 'Attached files', 'user', 'user-' + ++sequence);
    if (attachments.length) {
      const group = node('div', 'db-attachment-group');
      for (const file of attachments) {
        group.append(attachmentView(file, false));
        if (file.url) usedURLs.add(file.url);
      }
      user.content.append(group);
    }
    attachments = [];
    pending.replaceChildren();
    pending.hidden = true;
    input.value = '';
    messages.setAttribute('aria-busy', 'true');
    const answer = row('', 'assistant', 'assistant-' + sequence);
    const marker = node('div', 'db-marker');
    marker.setAttribute('role', 'status');
    marker.append(node('span', 'db-marker__content db-shimmer', 'Generating response...'));
    answer.content.append(marker);
    const chunks = reply(prompt).split(/(?<=\s)/);
    stream = { timer: null, marker };
    setStatus('Simulated response');
    updateSend();
    let index = 0;
    function tick() {
      if (!stream) return;
      answer.body.append(document.createTextNode(chunks[index++]));
      if (index < chunks.length) stream.timer = setTimeout(tick, 32);
      else {
        marker.remove();
        stream = null;
        messages.setAttribute('aria-busy', 'false');
        setStatus('Ready');
        const reactions = node('div', 'db-bubble__reactions');
        const received = node('button', '', 'Received');
        received.type = 'button';
        received.setAttribute('aria-pressed', 'false');
        received.addEventListener('click', () => received.setAttribute('aria-pressed', String(received.getAttribute('aria-pressed') !== 'true')));
        reactions.append(received);
        answer.content.append(reactions);
        updateSend();
      }
    }
    stream.timer = setTimeout(tick, 120);
  });
  input.addEventListener('input', () => { statusRevision++; updateSend(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !stream) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  document.getElementById('attach-file').addEventListener('click', () => files.click());
  files.addEventListener('change', () => {
    for (const file of Array.from(files.files).slice(0, 6 - attachments.length)) {
      const image = /^image\/(png|jpeg|gif|webp|avif)$/.test(file.type);
      const entry = { name: file.name, size: file.size, url: image ? URL.createObjectURL(file) : null };
      attachments.push(entry);
      pending.append(attachmentView(entry, true));
    }
    pending.hidden = !attachments.length;
    files.value = '';
    updateSend();
  });
  history.addEventListener('click', () => {
    const fragment = document.createDocumentFragment();
    const count = ++historyCount;
    row('Release review ' + count + ': the report export now includes the selected date range.', 'user', 'history-user-' + count, fragment);
    row('Add that change to the review checklist. Compare one exported report with the matching dashboard filters, then check the empty date range.', 'assistant', 'history-assistant-' + count, fragment);
    messages.prepend(fragment);
    if (historyCount >= 3) history.disabled = true;
  });
  document.getElementById('reset-chat').addEventListener('click', () => {
    stop();
    for (const file of attachments) if (file.url) URL.revokeObjectURL(file.url);
    for (const url of usedURLs) URL.revokeObjectURL(url);
    usedURLs.clear();
    attachments = [];
    pending.replaceChildren();
    pending.hidden = true;
    messages.innerHTML = initial;
    historyCount = 0;
    history.disabled = false;
    input.value = '';
    setStatus('Ready');
    icons();
    requestAnimationFrame(() => controller.scrollToEnd());
    updateSend();
  });
  messages.addEventListener('click', async event => {
    if (!event.target.closest('#copy-reply')) return;
    const revision = ++statusRevision;
    try {
      await navigator.clipboard.writeText(messages.querySelector('[data-db-message-id="initial-answer"] .db-bubble__content').textContent);
      if (revision === statusRevision) setStatus('Copied');
    } catch (_) { if (revision === statusRevision) setStatus('Clipboard unavailable'); }
  });
  window.addEventListener('pagehide', event => {
    stop();
    if (event.persisted) return;
    controller.destroy();
    for (const file of attachments) if (file.url) URL.revokeObjectURL(file.url);
    for (const url of usedURLs) URL.revokeObjectURL(url);
  });
  icons();
})();
