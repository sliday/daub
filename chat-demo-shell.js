(function () {
  'use strict';
  window.createChatDemoShell = function ({ composer, messages, scroller, getFiles, reset, setStatus, copyText }) {
    const shell = document.querySelector('.chat-demo-shell');
    const sidebar = document.getElementById('chat-sidebar');
    const main = document.querySelector('main.chat-demo');
    const header = document.querySelector('.chat-demo-header');
    const toggle = document.getElementById('chat-nav-toggle');
    const backdrop = document.getElementById('chat-nav-backdrop');
    const panel = document.getElementById('chat-view-panel');
    const title = document.getElementById('chat-title');
    const sources = new Map();
    let view = 'conversation', pinned = false, lastViewKey = '';
    const strokes = [], canvas = document.getElementById('chat-sketch-canvas');
    const context = canvas.getContext('2d');
    let stroke = null;

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
    function setTitle(text) {
      title.textContent = text;
      title.title = text;
      const label = document.getElementById('chat-nav-title');
      label.textContent = text;
      label.title = text;
    }
    function setPinned(value) {
      pinned = value;
      document.getElementById('chat-pin-indicator').toggleAttribute('hidden', !pinned);
      document.getElementById('chat-pin-label').textContent = pinned ? 'Unpin conversation' : 'Pin conversation';
    }
    function setNav(open) {
      const modal = open && innerWidth <= 900;
      shell.toggleAttribute('data-nav-open', modal);
      backdrop.hidden = !modal;
      toggle.setAttribute('aria-expanded', String(modal));
      main.inert = modal;
      header.inert = modal;
      if (modal) {
        sidebar.setAttribute('role', 'dialog');
        sidebar.setAttribute('aria-modal', 'true');
        sidebar.querySelector('button').focus();
      } else {
        sidebar.removeAttribute('role');
        sidebar.removeAttribute('aria-modal');
      }
    }
    const close = node('button', 'db-btn db-btn--ghost db-btn--sm db-btn--icon chat-demo-nav-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close workspace navigation');
    close.title = 'Close navigation';
    close.append(icon('x'));
    sidebar.querySelector('.chat-demo-sidebar-heading').append(close);
    toggle.addEventListener('click', () => setNav(!shell.hasAttribute('data-nav-open')));
    for (const button of [close, backdrop]) button.addEventListener('click', () => { setNav(false); toggle.focus(); });
    function navigationKey(event) {
      if (!shell.hasAttribute('data-nav-open')) return;
      if (event.key === 'Escape') { event.preventDefault(); setNav(false); toggle.focus(); }
      if (event.key === 'Tab') {
        const controls = [...sidebar.querySelectorAll('button, a[href]')].filter(element => element.getClientRects().length && !element.disabled);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', navigationKey);
    const resize = () => { if (innerWidth > 900) setNav(false); };
    window.addEventListener('resize', resize);

    function transcript() {
      return [...messages.querySelectorAll('.db-message')].map(message => {
        const sender = message.classList.contains('db-message--end') ? 'You' : 'Assistant';
        const body = message.querySelector('.db-bubble__content')?.textContent || '';
        const files = [...message.querySelectorAll('.db-attachment__title')].map(element => element.textContent);
        return sender + ': ' + body + (files.length ? '\nAttachments: ' + files.join(', ') : '');
      }).join('\n\n');
    }
    function downloadable(file) {
      if (!sources.has(file)) sources.set(file, URL.createObjectURL(file));
      return sources.get(file);
    }
    function setView(next) {
      view = next;
      document.getElementById('chat-scroller').hidden = view !== 'conversation';
      panel.hidden = view === 'conversation';
      for (const item of sidebar.querySelectorAll('[data-chat-view]')) {
        if (item.dataset.chatView === view) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
      }
      setNav(false);
      lastViewKey = '';
      refresh();
    }
    function refresh() {
      const activities = [...messages.querySelectorAll('.chat-demo-thinking')];
      const files = getFiles();
      const retained = new Set(files);
      for (const [file, url] of sources) if (!retained.has(file)) { URL.revokeObjectURL(url); sources.delete(file); }
      const queued = composer.getQueue();
      document.getElementById('chat-activity-count').textContent = String(activities.reduce((sum, activity) => sum + activity.querySelectorAll('li').length, 0));
      document.getElementById('chat-files-count').textContent = String(files.length);
      document.getElementById('chat-queue-count').textContent = String(queued.length);
      if (view === 'conversation') return;
      const key = view + ':' + activities.map(activity => activity.dataset.state + activity.querySelectorAll('li').length).join('|') + ':' + files.map(file => file.name).join('|') + ':' + queued.map(item => item.id + item.text).join('|');
      if (lastViewKey === key) return;
      lastViewKey = key;
      panel.replaceChildren(node('h2', '', view === 'activity' ? 'Activity' : view === 'files' ? 'Files' : 'Queued messages'));
      const list = node('div', 'chat-demo-view-list');
      if (view === 'activity') {
        for (const activity of activities) {
          const button = node('button', 'chat-demo-view-row');
          button.type = 'button';
          const label = node('span', '', 'Assistant activity');
          label.append(node('small', '', activity.querySelectorAll('li').length + ' steps - ' + activity.dataset.state));
          button.append(icon('list-checks'), label, icon('arrow-up-right'));
          button.addEventListener('click', () => {
            setView('conversation');
            activity.open = true;
            scroller.scrollToMessage(activity.closest('[data-db-message-id]').dataset.dbMessageId, { block: 'start', behavior: 'instant' });
          });
          list.append(button);
        }
      } else if (view === 'files') {
        for (const file of files) {
          const link = node('a', 'chat-demo-view-row');
          link.href = downloadable(file);
          link.download = file.name;
          const label = node('span', '', file.name);
          label.append(node('small', '', Math.max(1, Math.round(file.size / 1024)) + ' KB'));
          link.append(icon('file-text'), label, icon('download'));
          list.append(link);
        }
      } else {
        for (const request of queued) {
          const item = node('div', 'chat-demo-view-row');
          const label = node('span', '', request.text || 'Attached files');
          label.append(node('small', '', request.model + ' - ' + (request.files || []).length + ' files'));
          item.append(icon('list-start'), label);
          list.append(item);
        }
      }
      if (!list.children.length) list.append(node('p', 'chat-demo-status', view === 'files' ? 'No files attached.' : view === 'queue' ? 'No queued messages.' : 'No activity yet.'));
      panel.append(list);
      icons();
    }
    for (const button of sidebar.querySelectorAll('[data-chat-view]')) button.addEventListener('click', () => setView(button.dataset.chatView));

    function command(action, request) {
      setNav(false);
      if (action === 'rename') {
        document.getElementById('chat-rename-input').value = title.textContent;
        DAUB.openModal('chat-rename-modal');
      } else if (action === 'pin') {
        setPinned(!pinned);
      } else if (action === 'new' || action === 'clear') {
        reset({ empty: true });
        setTitle(action === 'new' ? 'New conversation' : title.textContent);
        if (action === 'new') setPinned(false);
        setView('conversation');
      } else if (action === 'fork' || action === 'side-chat') {
        const text = action === 'side-chat' && request ? null : transcript();
        const name = title.textContent + ' copy';
        reset({ empty: true });
        setTitle(name);
        setPinned(false);
        if (text) composer.attachFiles([new File([text], 'Conversation context.txt', { type: 'text/plain' })]);
        if (request) {
          composer.setDraft(request.text);
          composer.attachFiles(request.files || []);
          composer.setModel(request.model);
          composer.setEffort(request.effort);
        }
        setView('conversation');
      } else if (action === 'copy') {
        copyText(transcript(), 'Transcript copied');
      } else if (action === 'export') {
        const link = node('a');
        const file = new File([transcript()], 'Transcript.md', { type: 'text/markdown' });
        const url = URL.createObjectURL(file);
        link.href = url;
        link.download = title.textContent.replace(/[^a-z0-9]+/gi, '-').slice(0, 60) + '.md';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (action === 'context') DAUB.openModal('chat-context-modal');
      else if (action === 'goal') {
        document.getElementById('chat-goal-text').value = composer.getState().goal || '';
        DAUB.openModal('chat-goal-modal');
      } else if (action === 'plan') composer.setMode(composer.getState().mode === 'plan' ? 'chat' : 'plan');
      else if (action === 'sketch') { draw(); DAUB.openModal('chat-sketch-modal'); }
      else if (['document', 'pdf', 'spreadsheet'].includes(action)) {
        const input = document.getElementById('chat-extra-file');
        input.accept = action === 'pdf' ? '.pdf' : action === 'spreadsheet' ? '.csv,.tsv,.xlsx,.xls' : '.txt,.md,.doc,.docx,.rtf';
        input.click();
      }
    }
    document.addEventListener('click', event => {
      const target = event.target.closest('[data-demo-action]');
      if (target) command(target.dataset.demoAction);
    });
    document.getElementById('chat-rename-form').addEventListener('submit', event => {
      event.preventDefault();
      const text = document.getElementById('chat-rename-input').value.trim();
      if (!text) return;
      setTitle(text);
      DAUB.closeModal('chat-rename-modal');
    });
    document.getElementById('chat-context-form').addEventListener('submit', event => {
      event.preventDefault();
      const text = document.getElementById('chat-context-text').value.trim();
      if (!text) return;
      const url = document.getElementById('chat-context-url').value.trim();
      composer.attachFiles([new File([text + (url ? '\nSource: ' + url : '')], 'Context.txt', { type: 'text/plain' })]);
      DAUB.closeModal('chat-context-modal');
      refresh();
    });
    document.getElementById('chat-goal-form').addEventListener('submit', event => {
      event.preventDefault();
      const text = document.getElementById('chat-goal-text').value.trim();
      if (!text) return;
      composer.setGoal(text);
      DAUB.closeModal('chat-goal-modal');
    });
    document.getElementById('chat-extra-file').addEventListener('change', event => {
      composer.attachFiles([...event.target.files]);
      event.target.value = '';
      refresh();
    });

    function draw() {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      for (const item of strokes) {
        context.strokeStyle = item.color;
        context.lineWidth = item.width;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.beginPath();
        item.points.forEach((point, index) => { if (index) context.lineTo(point.x, point.y); else context.moveTo(point.x, point.y); });
        if (item.points.length === 1) context.lineTo(item.points[0].x + 0.1, item.points[0].y + 0.1);
        context.stroke();
      }
      document.getElementById('chat-sketch-undo').disabled = !strokes.length;
      document.getElementById('chat-sketch-clear').disabled = !strokes.length;
      document.getElementById('chat-sketch-attach').disabled = !strokes.length;
    }
    function point(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
    }
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      canvas.setPointerCapture(event.pointerId);
      stroke = { color: document.getElementById('chat-sketch-color').value, width: Number(document.getElementById('chat-sketch-width').value), points: [point(event)] };
      strokes.push(stroke);
      if (strokes.length > 100) strokes.shift();
      draw();
    });
    canvas.addEventListener('pointermove', event => { if (stroke) { stroke.points.push(point(event)); draw(); } });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, () => { stroke = null; });
    document.getElementById('chat-sketch-undo').addEventListener('click', () => { strokes.pop(); draw(); });
    document.getElementById('chat-sketch-clear').addEventListener('click', () => { strokes.length = 0; draw(); });
    document.getElementById('chat-sketch-attach').addEventListener('click', () => {
      if (!strokes.length) return;
      canvas.toBlob(blob => {
        if (!blob) return;
        composer.attachFiles([new File([blob], 'Sketch.png', { type: 'image/png' })]);
        DAUB.closeModal('chat-sketch-modal');
        refresh();
      }, 'image/png');
    });
    draw();
    const fileDrag = event => event.dataTransfer && [...event.dataTransfer.types].includes('Files');
    shell.addEventListener('dragover', event => {
      if (!fileDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      document.getElementById('chat-form').classList.add('db-chat-composer--dragover');
      document.querySelector('.db-chat-composer__dropzone').hidden = false;
    });
    shell.addEventListener('drop', event => {
      if (!fileDrag(event)) return;
      event.preventDefault();
      document.getElementById('chat-form').classList.remove('db-chat-composer--dragover');
      document.querySelector('.db-chat-composer__dropzone').hidden = true;
      composer.attachFiles([...event.dataTransfer.files]);
    });
    shell.addEventListener('dragleave', event => {
      if (shell.contains(event.relatedTarget)) return;
      document.getElementById('chat-form').classList.remove('db-chat-composer--dragover');
      document.querySelector('.db-chat-composer__dropzone').hidden = true;
    });
    icons();
    refresh();
    return { refresh, setView, command, setTitle, destroy() {
      document.removeEventListener('keydown', navigationKey);
      window.removeEventListener('resize', resize);
      for (const url of sources.values()) URL.revokeObjectURL(url);
      sources.clear();
    } };
  };
})();
