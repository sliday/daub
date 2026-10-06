(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const categories = { controls: 'Controls', navigation: 'Navigation', 'data-display': 'Data display', feedback: 'Feedback', overlays: 'Overlays', conversation: 'Conversation', 'layout-utility': 'Layout', foundations: 'Foundations' };
  const setup = '<link rel="stylesheet" href="https://daub.dev/daub.css">\n<script src="https://daub.dev/daub.js"></script>';
  let components = [], selected = null, frameReady = false, copyTimer;
  const iframe = $('component-preview');

  function announce(message) {
    clearTimeout(copyTimer);
    $('copy-status').textContent = message;
    copyTimer = setTimeout(() => { $('copy-status').textContent = ''; }, 2500);
  }

  async function copy(value) {
    try {
      await navigator.clipboard.writeText(value);
      announce('Copied to clipboard');
    } catch (_) {
      announce('Clipboard unavailable. Select the code to copy.');
      showPanel('html');
    }
  }

  function slug(component) { return component.class.slice(3); }

  function markup() {
    if (!selected) return '';
    const modifier = $('preview-variant').value;
    if (!modifier) return selected.html || '';
    const template = document.createElement('template');
    template.innerHTML = selected.html || '';
    if (modifier) {
      const root = template.content.querySelector('.' + selected.class) || template.content.querySelector('[class*="' + selected.class + '-"]');
      if (root) {
        const buttonSizes = ['--sm', '--lg', '--icon'];
        const buttonStates = ['--loading', '--disabled', '--pressed'];
        const remove = selected.class === 'db-btn' ? buttonSizes.includes(modifier) ? buttonSizes : buttonStates.includes(modifier) ? buttonStates : (selected.modifiers || []).filter(mod => !buttonSizes.includes(mod) && !buttonStates.includes(mod)) : selected.modifiers || [];
        for (const mod of remove) root.classList.remove(selected.class + mod);
        root.classList.add(selected.class + modifier);
        if (root.tagName === 'BUTTON' && ['--disabled', '--loading'].includes(modifier)) root.disabled = true;
        if (modifier === '--loading') root.setAttribute('aria-busy', 'true');
        if (modifier === '--pressed') root.setAttribute('aria-pressed', 'true');
      }
    }
    return template.innerHTML;
  }

  function updatePreview() {
    if (!selected) return;
    const html = markup();
    $('component-source').textContent = html;
    if (frameReady) iframe.contentWindow.postMessage({ type: 'daub:preview', html, component: selected.class, theme: $('preview-theme').value }, '*');
  }

  function refreshPreview() {
    const reload = frameReady;
    frameReady = false;
    iframe.setAttribute('aria-busy', 'true');
    iframe.inert = true;
    if (reload) iframe.contentWindow.postMessage({ type: 'daub:preview-reset' }, '*');
    updatePreview();
  }

  function showPanel(name) {
    for (const tab of document.querySelectorAll('[data-panel]')) {
      const active = tab.dataset.panel === name;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      $('panel-' + tab.dataset.panel).hidden = !active;
    }
  }

  function setSidebar(open, restoreFocus = true) {
    document.body.dataset.sidebar = open ? 'open' : 'closed';
    $('open-sidebar').setAttribute('aria-expanded', String(open));
    $('sidebar-backdrop').hidden = !open;
    $('library-main').inert = open;
    if (open) $('component-search').focus();
    else if (restoreFocus) $('open-sidebar').focus();
  }

  function renderNav() {
    const query = $('component-search').value.trim().toLowerCase();
    const matches = components.filter((item) => (item.name + ' ' + item.class + ' ' + categories[item.category]).toLowerCase().includes(query));
    $('component-count').textContent = query ? matches.length + '/' + components.length : String(components.length);
    $('search-empty').hidden = matches.length > 0;
    $('component-nav').replaceChildren();
    for (const [category, name] of Object.entries(categories)) {
      const group = matches.filter((item) => item.category === category);
      if (!group.length) continue;
      const section = document.createElement('section');
      const heading = document.createElement('h2');
      heading.textContent = name;
      section.appendChild(heading);
      for (const item of group) {
        const link = document.createElement('a');
        link.href = '#' + slug(item);
        link.textContent = item.name;
        if (selected === item) link.setAttribute('aria-current', 'page');
        section.appendChild(link);
      }
      $('component-nav').appendChild(section);
    }
  }

  function selectComponent() {
    const key = location.hash.slice(1);
    if (key === 'component-title') return;
    selected = components.find((item) => slug(item) === key) || components[0];
    if (!selected) return;
    const index = components.indexOf(selected);
    document.title = selected.name + ' | DAUB Components';
    $('component-title').textContent = selected.name;
    $('breadcrumb-name').textContent = selected.name;
    $('component-category').textContent = categories[selected.category] || selected.category;
    $('component-description').textContent = selected.notes || '';
    $('component-class').textContent = '.' + selected.class;
    $('component-behavior').textContent = selected.js ? 'JavaScript interaction' : 'CSS component';
    iframe.title = selected.name + ' interactive preview';
    iframe.style.height = (['controls', 'foundations'].includes(selected.category) ? 280 : 440) + 'px';
    const options = [new Option('Default', '')];
    for (const mod of selected.modifiers || []) options.push(new Option(mod.replace(/^--?/, '').replaceAll('-', ' '), mod));
    $('preview-variant').replaceChildren(...options);
    $('preview-variant').disabled = options.length === 1;
    $('component-anatomy').replaceChildren();
    const anatomy = [{ class: selected.class, element: selected.element, required: true }, ...(selected.children || [])];
    for (const child of anatomy) {
      const row = document.createElement('tr');
      for (const value of ['.' + child.class, child.element, child.required ? 'Required' : 'Optional']) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      }
      $('component-anatomy').appendChild(row);
    }
    for (const [id, offset] of [['previous-component', -1], ['next-component', 1]]) {
      const item = components[index + offset];
      $(id).hidden = !item;
      if (item) {
        $(id).href = '#' + slug(item);
        $(id).querySelector('span').textContent = item.name;
      }
    }
    showPanel('preview');
    renderNav();
    refreshPreview();
    if (document.body.dataset.sidebar === 'open') {
      setSidebar(false, false);
      $('component-title').focus();
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== iframe.contentWindow || event.data?.type !== 'daub:preview-ready') return;
    frameReady = true;
    iframe.setAttribute('aria-busy', 'false');
    iframe.inert = false;
    updatePreview();
  });
  window.addEventListener('hashchange', selectComponent);
  $('component-search').addEventListener('input', renderNav);
  $('component-search').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const link = $('component-nav').querySelector('a');
      if (link) { event.preventDefault(); link.click(); if (document.body.dataset.sidebar === 'open') setSidebar(false, false); $('component-title').focus(); }
    }
  });
  $('preview-variant').addEventListener('change', refreshPreview);
  $('preview-theme').addEventListener('change', refreshPreview);
  $('reset-preview').addEventListener('click', refreshPreview);
  $('copy-html').addEventListener('click', () => copy(markup()));
  $('copy-install').addEventListener('click', () => copy('npm install daub-ui'));
  $('copy-setup').addEventListener('click', () => copy(setup));
  $('copy-agent').addEventListener('click', () => { if (selected) copy('# DAUB ' + selected.name + '\n\n' + selected.notes + '\n\n' + setup + '\n\n' + markup() + '\n\nReference: https://daub.dev/llms.txt'); });
  for (const tab of document.querySelectorAll('[data-panel]')) {
    tab.addEventListener('click', () => showPanel(tab.dataset.panel));
    tab.addEventListener('keydown', (event) => {
      const tabs = [...document.querySelectorAll('[data-panel]')];
      const index = tabs.indexOf(tab);
      const next = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
      if (next !== undefined) { event.preventDefault(); showPanel(tabs[next].dataset.panel); tabs[next].focus(); }
    });
  }
  for (const device of ['desktop', 'mobile']) $('device-' + device).addEventListener('click', () => {
    $('preview-stage').dataset.device = device;
    for (const item of ['desktop', 'mobile']) $('device-' + item).setAttribute('aria-pressed', String(item === device));
  });
  $('open-sidebar').addEventListener('click', () => setSidebar(true));
  $('close-sidebar').addEventListener('click', () => setSidebar(false));
  $('sidebar-backdrop').addEventListener('click', () => setSidebar(false));
  document.addEventListener('keydown', (event) => {
    if (document.body.dataset.sidebar !== 'open') return;
    if (event.key === 'Escape') { event.preventDefault(); setSidebar(false); }
    if (event.key === 'Tab') {
      const focusable = [...$('library-sidebar').querySelectorAll('a, button, input')].filter((element) => element.getClientRects().length && !element.hidden);
      const index = focusable.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1).focus(); }
      else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0].focus(); }
    }
  });
  const mobileQuery = matchMedia('(max-width: 760px)');
  mobileQuery.addEventListener('change', () => { if (!mobileQuery.matches) setSidebar(false, false); });

  async function load() {
    try {
      const response = await fetch('components.json');
      if (!response.ok) throw new Error('Catalog request failed');
      const catalog = await response.json();
      components = catalog.components;
      $('library-version').textContent = 'v' + catalog.version + ' / MIT';
      const themes = window.DAUB?.THEMES || ['light', 'dark'];
      for (const theme of themes) $('preview-theme').add(new Option(theme.replaceAll('-', ' '), theme));
      $('preview-theme').value = 'light';
      selectComponent();
      if (window.lucide) window.lucide.createIcons();
    } catch (_) {
      $('library-error').textContent = 'Could not load the component library. Reload the page to retry.';
      $('library-error').hidden = false;
      $('component-title').textContent = 'Component library unavailable';
    }
  }
  load();
})();
