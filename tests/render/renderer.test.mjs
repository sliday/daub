import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../../', import.meta.url);
const source = await readFile(new URL('daub-render.js', root), 'utf8');
const runtime = await readFile(new URL('daub.js', root), 'utf8');
const css = await readFile(new URL('daub.css', root), 'utf8');
const types = [...source.matchAll(/RENDERERS\.(\w+)\s*=/g)].map(match => match[1]);
const fixtures = {
  Stack: { direction: 'horizontal', gap: 2 }, Grid: { columns: 2 }, Layout: { columns: 2 }, Surface: { variant: 'raised' },
  Text: { content: 'Project Aurora', tag: 'h2' }, Prose: { content: '<h2>Release notes</h2><p>Three tasks are ready.</p>' },
  Separator: { label: 'Project activity' }, Divider: {}, ButtonGroup: {}, InputGroup: { addonBefore: 'https://' }, InputIcon: { icon: 'search' },
  Button: { label: 'Save', icon: 'save' }, Field: { label: 'Email', helper: 'Work address' },
  Input: { label: 'Name', value: 'Ada' }, Textarea: { label: 'Message', value: 'Review ready' },
  Search: { label: 'Search projects' }, Checkbox: { label: 'Include archived' },
  RadioGroup: { label: 'Plan', options: [{ label: 'Free', value: 'free' }] },
  Switch: { label: 'Notifications' }, Slider: { label: 'Volume' }, Toggle: { label: 'Bold' },
  ToggleGroup: { options: [{ label: 'Left', value: 'left' }] },
  Kbd: { keys: ['Ctrl', 'K'] }, Label: { text: 'Email' }, Spinner: { label: 'Loading project' },
  Select: { label: 'Framework', options: [{ label: 'React', value: 'react' }] },
  CustomSelect: { label: 'Framework', searchable: true, options: [{ label: 'React', value: 'react' }] },
  InputOTP: { length: 4 }, Tabs: { tabs: [{ id: 'overview', label: 'Overview' }, { id: 'activity', label: 'Activity' }] },
  Pagination: { total: 90, current: 9, perPage: 10 },
  Menubar: { items: [{ label: 'File', dropdown: [{ label: 'New' }] }] },
  Breadcrumbs: { items: [{ label: 'Home', href: '/' }, { label: 'Projects' }] },
  Stepper: { steps: [{ label: 'Profile', status: 'completed' }, { label: 'Billing', status: 'active' }] },
  NavMenu: { items: [{ label: 'Home', href: '/', active: true }, { label: 'Docs', href: '/docs.html' }] },
  Navbar: { brand: 'Aurora', brandHref: '/' }, Sidebar: { sections: [{ title: 'Workspace', items: [{ label: 'Projects', icon: 'folder', href: '/projects', active: true }] }] },
  BottomNav: { items: [{ label: 'Home', href: '/', active: true }] },
  Card: { title: 'Project Aurora', description: 'Fall release', footer: ['action'] },
  Table: { columns: [{ key: 'name', label: 'Name' }], rows: [{ name: 'Ada' }, { name: 'Grace' }] },
  DataTable: { selectable: true, columns: [{ key: 'name', label: 'Name' }], rows: [{ name: 'Ada' }] },
  List: { items: [{ title: 'Release notes', secondary: 'Updated today' }] }, Badge: { text: 'Active', variant: 'success' },
  Avatar: { initials: 'AL' }, AvatarGroup: { avatars: [{ initials: 'AL' }, { initials: 'GH' }] },
  Chip: { label: 'Design', closable: true }, Progress: { label: 'Upload', value: 40 },
  Carousel: { slides: [{ content: 'Project Aurora' }, { content: 'Project Birch' }] }, AspectRatio: { ratio: '16-9' },
  ScrollArea: { direction: 'vertical' }, Alert: { title: 'Review ready', message: 'Three tasks need review', type: 'info' },
  Skeleton: { variant: 'text', lines: 3 }, EmptyState: { title: 'No projects', message: 'Create your first project', icon: 'folder' },
  Tooltip: { text: 'Save project', position: 'bottom' }, Modal: { id: 'project-modal', title: 'Project details' },
  AlertDialog: { id: 'delete-project', title: 'Delete draft?', description: 'You cannot undo this action' },
  Sheet: { id: 'project-sheet', title: 'Project settings', position: 'right' }, Drawer: { id: 'project-drawer', title: 'Order summary' },
  Popover: { label: 'Project details' }, HoverCard: { label: 'Ada Lovelace' }, ContextMenu: { items: [{ label: 'Copy' }] },
  Collapsible: { label: 'Project history' }, Resizable: { direction: 'horizontal' },
  StatCard: { label: 'Open tasks', value: 3, trend: 'down', trendValue: '2 this week' }, ChartCard: { title: 'Monthly revenue' },
  CustomHTML: { html: '<p>Project notes</p>' }, Link: { label: 'Documentation', href: '/docs.html' }, Icon: { name: 'folder' },
  Image: { src: '/og-image.png', alt: 'DAUB UI component library' },
  Calendar: { selected: '2026-02-01' }, DatePicker: { label: 'Due date', selected: '2026-02-01' },
  DropdownMenu: { items: [{ label: 'Edit' }] }, CommandPalette: { groups: [{ label: 'Navigation', items: [{ label: 'Home' }] }] },
  Accordion: { items: [{ title: 'Shipping', content: 'Ships tomorrow' }] },
  Chart: { bars: [{ label: 'Jan', value: 0 }, { label: 'Feb', value: 40 }] },
  CheckboxGroup: { label: 'Topics', helper: 'Choose topics for your digest.', inline: true },
  Fieldset: { legend: 'Profile', helper: 'Visible to teammates.' },
  Frame: { header: 'Project preview', footer: 'Updated today', flush: true },
  Group: { attached: true, vertical: true, 'aria-label': 'Project actions' },
  Meter: { value: 72, min: 0, max: 100, status: 'warning', 'aria-label': 'Storage used' },
  NumberField: { defaultValue: 3, min: 0, max: 5, step: 1, 'aria-label': 'Quantity' },
  PreviewCard: { trigger: 'Account', title: 'Ada Lovelace', description: 'Workspace owner', media: '/og-image.png' },
  Toolbar: { vertical: true, 'aria-label': 'Editor tools' },
  MessageScroller: { height: 360, autoScroll: true, defaultScrollPosition: 'end', peek: 24 },
  Message: { align: 'end', avatar: 'AL', name: 'Ada', timestamp: '10:42', messageId: 'm1', scrollAnchor: true },
  Bubble: { content: 'Review ready.', variant: 'secondary', reactions: [{ label: 'Helpful', count: 2 }] },
  Attachment: { name: 'Review.pdf', description: 'PDF document', href: '/review.pdf', state: 'uploading', progress: 25 },
  Marker: { content: 'Generating response', icon: 'loader', variant: 'border', busy: true },
  ChatComposer: { models: [{ id: 'demo', label: 'Demo model (simulated)' }], placeholder: 'Write a message' },
  ChangeSummary: { files: [{ path: 'src/app.ts', additions: 48, deletions: 4 }], title: 'Prepared 1 demo file', description: 'Demo changes' },
};
const childFixtures = {
  Stack: ['body', 'body2'], Grid: ['body', 'body2'], Layout: ['body', 'body2'], Surface: ['body'],
  ButtonGroup: ['action'], InputGroup: ['child'], InputIcon: ['child'], Navbar: ['navigation'],
  Card: ['body'], AspectRatio: ['image'], ScrollArea: ['body', 'body2'], Tooltip: ['action'],
  Modal: ['body'], Sheet: ['body'], Drawer: ['body'], Popover: ['body'], HoverCard: ['body'],
  Collapsible: ['body'], Resizable: ['body'], ChartCard: ['chart'],
  CheckboxGroup: ['checkbox'], Fieldset: ['child'], Frame: ['body'], Group: ['action'],
  PreviewCard: ['body'], Toolbar: ['toggle', 'action'],
  MessageScroller: ['body', 'body2'], Message: ['body'], Bubble: ['body'], Attachment: ['action'], Marker: ['body'],
  ChangeSummary: ['action'],
};
let browser;
let page;
before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  page = await browser.newPage({ timezoneId: 'America/Los_Angeles' });
  page.setDefaultTimeout(3000);
  const image = await readFile(new URL('og-image.png', root));
  await page.route('http://daub.test/**', route => route.fulfill(route.request().url().endsWith('/og-image.png') ? { contentType: 'image/png', body: image } : { contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }));
  await page.goto('http://daub.test/');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: source });
});
after(async () => { await browser?.close(); });

async function render(type, props = {}, children = []) {
  await page.evaluate(({ type, props, children }) => {
    const elements = {
      root: { type, props, children },
      child: type === 'DropdownMenu' ? { type: 'Button', props: { label: 'Options' } } : { type: 'Input', props: { label: 'Name' } },
      body: { type: 'Text', props: { content: 'Three tasks are ready for review.' } },
      body2: { type: 'Text', props: { content: 'Ada updated the project today.' } },
      action: { type: 'Button', props: { label: 'Save project' } },
      checkbox: { type: 'Checkbox', props: { label: 'Design', checked: true } },
      toggle: { type: 'Toggle', props: { label: 'Bold' } },
      chart: { type: 'Chart', props: { bars: [{ label: 'Jan', value: 40 }, { label: 'Feb', value: 60 }] } },
      image: { type: 'Image', props: { src: '/og-image.png', alt: 'DAUB UI component library' } },
      navigation: { type: 'NavMenu', props: { items: [{ label: 'Docs', href: '/docs.html' }] } },
    };
    document.body.replaceChildren(renderElement(elements, 'root', 0));
  }, { type, props, children });
}

for (const type of types) {
  test(`renderer: ${type} returns an element with named controls`, async () => {
    assert.ok(Object.hasOwn(fixtures, type), `Missing ${type} fixture`);
    await render(type, fixtures[type], childFixtures[type] || []);
    const issues = await page.evaluate(() => {
      const issues = [];
      if (!document.querySelector('[data-spec-id="root"]')) issues.push('Missing root');
      document.querySelectorAll('button,input,select,textarea,[role="switch"],[role="progressbar"],[role="meter"]').forEach(el => {
        const label = el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join('').trim() || [...(el.labels || [])].map(label => label.textContent).join('').trim() || (el.matches('input,select,textarea') ? '' : el.textContent.trim());
        if (!label) issues.push(`Unnamed ${el.outerHTML}`);
      });
      if (document.querySelector('button button')) issues.push('Nested buttons');
      return issues;
    });
    assert.deepEqual(issues, []);
  });
}

test('Field connects its label and helper to a child input', async () => {
  await render('Field', { label: 'Name', helper: 'Public name', error: true }, ['child']);
  assert.equal(await page.locator('label').getAttribute('for'), await page.locator('input').getAttribute('id'));
  assert.equal(await page.locator('input').getAttribute('aria-invalid'), 'true');
  const helper = await page.locator('input').getAttribute('aria-describedby');
  assert.ok(helper);
  assert.equal(await page.locator(`[id="${helper}"]`).textContent(), 'Public name');
});

test('inputs preserve zero values, disabled state, and explicit zero spacing', async () => {
  await render('Input', { value: 0, disabled: true, label: 'Quantity' });
  assert.equal(await page.locator('input').inputValue(), '0');
  assert.equal(await page.locator('input').isDisabled(), true);
  await render('Button', { label: 'Save', disabled: true });
  assert.equal(await page.locator('button').isDisabled(), true);
  assert.equal(await page.locator('button').getAttribute('type'), 'button');
  await render('Stack', { gap: 0 });
  assert.equal(await page.locator('[data-spec-id="root"]').evaluate(el => el.style.gap), 'var(--db-space-0)');
  await render('Grid', { gap: 0 });
  assert.equal(await page.locator('[data-spec-id="root"]').evaluate(el => el.style.gap), 'var(--db-space-0)');
  await render('Grid', { gap: 4 });
  assert.equal(await page.locator('.db-grid.db-gap-4').count(), 1);
  await render('CustomHTML', { html: '<form><button>Submit</button></form>' });
  assert.equal(await page.locator('button').evaluate(button => button.type), 'submit');
});

test('table cells preserve zero and false values', async () => {
  for (const type of ['Table', 'DataTable']) {
    await render(type, { columns: [{ key: 'count', label: 'Count' }, { key: 'active', label: 'Active' }], rows: [{ count: 0, active: false }] });
    assert.deepEqual(await page.locator('tbody td').allTextContents(), ['0', 'false']);
  }
});

test('default tabs select the first tab, pagination includes the current page', async () => {
  await render('Tabs', fixtures.Tabs, ['body', 'body2']);
  assert.equal(await page.locator('[aria-selected="true"]').textContent(), 'Overview');
  assert.equal(await page.locator('.db-tabs__panel:not([hidden])').count(), 1);
  const selected = page.getByRole('tab', { selected: true });
  const visiblePanel = page.getByRole('tabpanel');
  assert.equal(await selected.getAttribute('aria-controls'), await visiblePanel.getAttribute('id'));
  assert.equal(await visiblePanel.getAttribute('aria-labelledby'), await selected.getAttribute('id'));
  assert.equal(await visiblePanel.textContent(), 'Three tasks are ready for review.');
  await render('Tabs', fixtures.Tabs);
  assert.equal(await page.locator('.db-tabs__panel').count(), 0);
  assert.equal(await page.locator('[aria-controls]').count(), 0);
  await render('Pagination', fixtures.Pagination);
  assert.equal(await page.locator('[aria-current="page"]').textContent(), '9');
});

test('calendar preserves date-only values in a negative UTC offset', async () => {
  await render('Calendar', fixtures.Calendar);
  assert.equal(await page.locator('.db-calendar__title').textContent(), 'February 2026');
  assert.equal(await page.locator('.db-calendar__day--selected').textContent(), '1');
});

test('chart computes its maximum from values that include zero', async () => {
  await render('Chart', fixtures.Chart);
  assert.deepEqual(await page.locator('.db-chart__bar').evaluateAll(bars => bars.map(bar => bar.style.height)), ['0%', '100%']);
});

test('overlays expose named dialogs', async () => {
  for (const type of ['Modal', 'AlertDialog', 'Sheet', 'Drawer']) {
    await render(type, { title: 'Project details', label: 'Project details' });
    const dialog = page.locator('[role="dialog"],[role="alertdialog"]');
    assert.equal(await dialog.count(), 1);
    assert.equal(await dialog.getAttribute('aria-modal'), 'true');
    assert.ok(await dialog.getAttribute('aria-labelledby') || await dialog.getAttribute('aria-label'));
  }
});

test('popover, hover card, and custom dropdown triggers work with DAUB.init', async () => {
  for (const [type, selector, openClass] of [['Popover', '.db-popover__trigger', 'db-popover--open'], ['DropdownMenu', '.db-dropdown__trigger', 'db-dropdown--open']]) {
    await render(type, { label: 'Options' }, type === 'DropdownMenu' ? ['child'] : []);
    await page.addScriptTag({ content: runtime });
    assert.equal(await page.locator(selector).count(), 1);
    await page.locator(selector).click();
    assert.ok(await page.locator('[data-spec-id="root"]').evaluate((el, cls) => el.classList.contains(cls), openClass));
  }
  await render('HoverCard', { label: 'Ada' });
  assert.equal(await page.locator('.db-hover-card > button').textContent(), 'Ada');
});

test('BottomNav honors href and Link rejects executable URLs', async () => {
  await render('BottomNav', { items: [{ label: 'Docs', href: '/docs.html', active: true }] });
  assert.equal(await page.locator('a').getAttribute('href'), '/docs.html');
  for (const href of ['javascript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,hello']) {
    await render('Link', { label: 'Unsafe', href });
    assert.equal(await page.locator('a').getAttribute('href'), null);
  }
});

test('sanitized prose escapes attribute quotes and rejects executable links', async () => {
  await render('Prose', { content: '<a href="java&#10;script:alert(1)" title="&quot; onclick=&quot;alert(1)">Docs</a>' });
  assert.equal(await page.locator('a').getAttribute('href'), null);
  assert.equal(await page.locator('a').getAttribute('onclick'), null);
  assert.equal(await page.locator('a').getAttribute('title'), '" onclick="alert(1)');
});

test('avatars use initials when their image URLs are unsafe', async () => {
  await render('Avatar', { src: 'javascript:alert(1)', initials: 'AL' });
  assert.equal(await page.locator('.db-avatar').textContent(), 'AL');
  await render('AvatarGroup', { avatars: [{ src: 'javascript:alert(1)', initials: 'GH' }] });
  assert.equal(await page.locator('.db-avatar').textContent(), 'GH');
  assert.equal(await page.locator('img').count(), 0);
});

test('ChartCard renders bars or an explicit empty state', async () => {
  await render('ChartCard', { title: 'Revenue', bars: fixtures.Chart.bars });
  assert.equal(await page.locator('.db-chart__bar').count(), 2);
  await render('ChartCard', { title: 'Revenue' });
  assert.equal(await page.locator('.db-empty__title').textContent(), 'No data');
});

test('collapsed sidebar hides visible text and keeps link names', async () => {
  await render('Sidebar', { ...fixtures.Sidebar, collapsed: true });
  assert.equal(await page.locator('.db-sidebar__item').getAttribute('aria-label'), 'Projects');
  const label = page.locator('.db-sidebar__item > span');
  assert.equal(await label.textContent(), 'Projects');
  assert.equal(await label.isVisible(), true);
  await page.addScriptTag({ content: await readFile(new URL('assets/lucide.min.js', root), 'utf8') });
  await page.evaluate(() => lucide.createIcons());
  assert.equal(await label.isVisible(), false);
  assert.equal(await page.locator('.db-sidebar__item > svg').isVisible(), true);
  assert.equal(await page.getByRole('link', { name: 'Projects' }).count(), 1);
});

test('renderer image fixtures load real repository assets', async () => {
  await render('Image', fixtures.Image);
  await page.waitForFunction(() => document.querySelector('img').complete);
  assert.ok(await page.locator('img').evaluate(image => image.naturalWidth > 0));
});

test('InputIcon uses the CSS positioning hook and numeric text preserves zero', async () => {
  await render('InputIcon', { icon: 'search' }, ['child']);
  assert.equal(await page.locator('.db-input-icon__icon[data-lucide="search"]').count(), 1);
  await render('Text', { content: 0 });
  assert.equal(await page.locator('[data-spec-id="root"]').textContent(), '0');
  await render('StatCard', { label: 'Open tasks', value: 0 });
  assert.equal(await page.locator('.db-stat__value').textContent(), '0');
});

test('new named component types have representative renderers', async () => {
  for (const type of ['CheckboxGroup', 'Fieldset', 'Frame', 'Group', 'Meter', 'NumberField', 'PreviewCard', 'Toolbar']) {
    await render(type, fixtures[type], childFixtures[type] || []);
    assert.doesNotMatch(await page.locator('body').textContent(), /Unknown:/, type);
  }
});

test('new component groups and fieldsets connect their labels and helper text', async () => {
  await render('CheckboxGroup', fixtures.CheckboxGroup, ['checkbox']);
  assert.equal(await page.getByRole('group', { name: 'Topics' }).count(), 1);
  assert.equal(await page.getByRole('checkbox', { name: 'Design' }).isChecked(), true);
  assert.ok(await page.locator('.db-checkbox-group').getAttribute('aria-describedby'));
  await render('Fieldset', { ...fixtures.Fieldset, disabled: true }, ['child']);
  assert.equal(await page.getByRole('group', { name: 'Profile' }).count(), 1);
  assert.equal(await page.locator('input').isDisabled(), true);
  assert.ok(await page.locator('fieldset').getAttribute('aria-describedby'));
});

test('new component NumberField steps, clamps, emits events, and honors readOnly', async () => {
  await render('NumberField', { ...fixtures.NumberField, value: 0 });
  const input = page.getByRole('spinbutton', { name: 'Quantity' });
  assert.equal(await input.inputValue(), '0');
  assert.equal(await page.getByRole('button', { name: 'Decrease quantity', exact: false }).isDisabled(), true);
  await input.evaluate(el => { el.addEventListener('input', () => { window.numberInputEvents = (window.numberInputEvents || 0) + 1; }); });
  await page.getByRole('button', { name: 'Increase quantity', exact: false }).click();
  assert.equal(await input.inputValue(), '1');
  assert.equal(await page.evaluate(() => window.numberInputEvents), 1);
  await input.fill('99');
  assert.equal(await input.inputValue(), '5');
  assert.equal(await page.getByRole('button', { name: 'Increase quantity', exact: false }).isDisabled(), true);
  await render('NumberField', { ...fixtures.NumberField, readOnly: true });
  assert.deepEqual(await page.locator('button').evaluateAll(buttons => buttons.map(button => button.disabled)), [true, true]);
  assert.equal(await page.locator('input').getAttribute('readonly'), '');
});

test('new component Meter bounds its visual and accessible measurement', async () => {
  await render('Meter', { ...fixtures.Meter, min: 50, max: 150, value: 100 });
  const meter = page.getByRole('meter', { name: 'Storage used' });
  assert.equal(await meter.getAttribute('aria-valuenow'), '100');
  assert.equal(await meter.evaluate(el => el.style.getPropertyValue('--db-meter')), '50%');
  await render('Meter', { ...fixtures.Meter, value: 200 });
  assert.equal(await page.locator('[role="meter"]').getAttribute('aria-valuenow'), '100');
});

test('new component Frame slots, Group modifiers, PreviewCard trigger, and Toolbar orientation match their APIs', async () => {
  await render('Frame', { header: ['action'], footer: ['body2'], flush: true }, ['body']);
  assert.equal(await page.locator('.db-frame__header button').textContent(), 'Save project');
  assert.equal(await page.locator('.db-frame__body').textContent(), 'Three tasks are ready for review.');
  assert.equal(await page.locator('.db-frame__footer').textContent(), 'Ada updated the project today.');
  await render('Group', fixtures.Group, ['action']);
  assert.equal(await page.locator('.db-group--attached.db-group--vertical').count(), 1);
  await render('PreviewCard', fixtures.PreviewCard, ['body']);
  await page.getByRole('button', { name: 'Account' }).focus();
  assert.equal(await page.locator('.db-preview-card__content').evaluate(el => getComputedStyle(el).pointerEvents), 'auto');
  assert.equal(await page.locator('.db-preview-card__title').textContent(), 'Ada Lovelace');
  await render('Toolbar', fixtures.Toolbar, ['toggle', 'action']);
  assert.equal(await page.getByRole('toolbar', { name: 'Editor tools' }).getAttribute('aria-orientation'), 'vertical');
});
