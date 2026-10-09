import { createServer } from 'node:http';
import { readFile, writeFile, readdir, mkdir, rename } from 'node:fs/promises';
import { resolve, dirname, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

// BENCH_CASES=1,4 accepts case numbers or exact IDs such as 01-hybrid.
// Evidence is append-only under BENCH_OUTPUT/inspections/<run>/.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = resolve(root, process.env.BENCH_OUTPUT || 'reports/direct-vs-hybrid-2026-10-08');
const selection = process.env.BENCH_CASES?.split(',').map(value => value.trim()).filter(Boolean);
const fixture = { name: 'Benchmark Person', email: 'benchmark@example.invalid', password: 'Synthetic-password-42!', task: 'Benchmark synthetic task 4821', noRecipe: 'zzzxq-no-recipe-4821' };
const widths = [1200, 390];
const prompts = [
  '10-step personality test, mobile-optimized.',
  'Email and password sign-in form with a forgot-password link.',
  'Three-plan pricing page with a monthly/annual toggle.',
  'Simple to-do list with add, complete, and delete actions.',
  'Profile settings form with name, email, and a save button.',
  'Recipe search page with a search field and six recipe cards.',
  'Weekly habit tracker with seven daily checkboxes per habit.',
  'Support inbox with a message list and a reading pane.',
  'Shopping cart with item quantities and an order total.',
  'Event registration form with name, email, and ticket quantity.'
];

class Untestable extends Error {
  constructor(reason, evidence = {}) { super(reason); this.evidence = evidence; }
}
const unavailable = (reason, evidence) => { throw new Untestable(reason, evidence); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const money = text => [...text.matchAll(/(?:\$|USD\s*|EUR\s*|GBP\s*|\u20ac|\u00a3)\s*(\d[\d,]*(?:\.\d{1,2})?)/g)].map(match => Math.round(Number(match[1].replaceAll(',', '')) * 100));

async function pick(locator, description, optional = false) {
  const found = [];
  for (let i = 0; i < await locator.count(); i++) if (await locator.nth(i).isVisible()) found.push(locator.nth(i));
  if (found.length === 1) return found[0];
  if (optional && found.length === 0) return null;
  unavailable(`${description}: ${found.length ? 'ambiguous (' + found.length + ')' : 'no visible selector'}`);
}

async function action(scope, name, optional = false) {
  return pick(scope.getByRole('button', { name }).or(scope.getByRole('link', { name })).or(scope.getByRole('tab', { name })), String(name), optional);
}

async function field(page, name, fallback) {
  const semantic = page.getByRole('textbox', { name }).or(page.getByLabel(name)).and(page.locator('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),textarea,select'));
  const named = await pick(semantic, String(name), true);
  return named || pick(page.locator(fallback), fallback);
}

async function choices(scope, role) {
  const locator = scope.locator(`input[type=${role}],[role=${role}]`);
  const result = [];
  for (let i = 0; i < await locator.count(); i++) {
    const item = locator.nth(i);
    const available = await item.evaluate(el => {
      const visible = node => !!node && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
      return visible(el) || [...(el.labels || [])].some(visible);
    });
    if (available) result.push(item);
  }
  return result;
}

async function toggle(control, desired) {
  const before = await control.isChecked();
  if (desired === before) return;
  if (await control.isVisible()) await control.click();
  else {
    const label = control.locator('xpath=ancestor::label[1]');
    if (await label.count()) await label.click();
    else {
      const selector = await control.evaluate(el => el.id ? 'label[for="' + CSS.escape(el.id) + '"]' : null);
      if (!selector) unavailable('Checkbox/radio has no visible control or associated label');
      await (await pick(control.page().locator(selector), 'Associated checkbox/radio label')).click();
    }
  }
}

async function observe(page) {
  return page.evaluate(() => {
    const visible = el => !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
    const text = el => (el.innerText || el.textContent || '').trim();
    let prototype = { available: typeof window.DaubPrototype?.getOutput === 'function' };
    if (prototype.available) {
      try { prototype.output = window.DaubPrototype.getOutput(); } catch (error) { prototype.error = error.message; }
    }
    return {
      url: location.href, text: document.body.innerText,
      headings: [...document.querySelectorAll('h1,h2,h3,h4,legend')].filter(visible).map(text),
      controls: [...document.querySelectorAll('input,textarea,select,button,a,[role=radio],[role=checkbox],[role=switch],[role=tab]')].map(el => ({
        tag: el.tagName, type: el.type, id: el.id, specId: el.closest('[data-spec-id]')?.dataset.specId,
        text: text(el), label: el.getAttribute('aria-label'), labels: [...(el.labels || [])].map(text), placeholder: el.getAttribute('placeholder'),
        value: el.value, checked: el.checked ?? el.getAttribute('aria-checked'), selected: el.getAttribute('aria-selected'), disabled: el.disabled,
        visible: visible(el), href: el.getAttribute('href'), required: el.required, valid: el.validity?.valid, validationMessage: el.validationMessage
      })),
      feedback: [...document.querySelectorAll('[role=alert],[role=status],[aria-live],.db-toast')].filter(visible).map(text),
      resultRegions: [...document.querySelectorAll('[role=dialog],[aria-modal=true],[data-spec-id*="result" i]')].filter(el => visible(el) && !el.matches('button,a,input')).map(text).filter(value => value.length > 12),
      overlayTargets: [...document.querySelectorAll('[data-db-trigger],[data-db-modal-trigger]')].map(el => {
        const target = el.getAttribute('data-db-trigger') || el.getAttribute('data-db-modal-trigger');
        const specNode = [...document.querySelectorAll('[data-spec-id]')].find(node => node.dataset.specId === target);
        return { label: text(el), target, targetExists: !!document.getElementById(target), specNodeId: specNode?.id || null };
      }),
      prototype, safety: window.__benchSafety || [], validationEvents: window.__benchValidationEvents || [],
      exportRuntime: { rootPresent: !!document.getElementById('pg-iframe-root'), mounted: !!document.querySelector('#pg-iframe-root [data-spec-id]'), errors: window.__pgRuntimeErrors || [], messages: window.__benchRuntimeMessages || [], outgoingMessages: window.__benchOutgoingMessages || [] },
      layout: { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2 },
      brokenImages: [...document.images].filter(el => visible(el) && (!el.complete || !el.naturalWidth)).map(el => el.src)
    };
  });
}

function installGuards() {
  window.__benchSafety = [];
  window.__benchValidationEvents = [];
  document.addEventListener('invalid', event => window.__benchValidationEvents.push({ id: event.target.id, type: event.target.type, message: event.target.validationMessage }), true);
  window.__benchRuntimeMessages = [];
  window.__benchOutgoingMessages = [];
  const originalPostMessage = window.postMessage;
  window.postMessage = function(...args) {
    const data = args[0];
    if (data && ['render', 'runtime-error', 'html'].includes(data.type)) window.__benchOutgoingMessages.push({ type: data.type, error: data.error == null ? null : String(data.error?.message || data.error), targetOrigin: typeof args[1] === 'object' ? args[1]?.targetOrigin : args[1], customScriptCount: data.js?.length ?? null });
    return Reflect.apply(originalPostMessage, this, args);
  };
  window.addEventListener('message', event => {
    if (event.source === window && ['render', 'runtime-error', 'html'].includes(event.data?.type)) window.__benchRuntimeMessages.push({ type: event.data.type, error: event.data.error || null, customScriptCount: event.data.js?.length ?? null });
  });
  const record = (kind, target) => window.__benchSafety.push({ kind, target: String(target || ''), at: Date.now() });
  document.addEventListener('submit', event => { event.preventDefault(); record('submit', event.target.action); }, true);
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('a[href]');
    if (anchor && !anchor.getAttribute('href').startsWith('#')) { event.preventDefault(); record('navigation', anchor.href); }
  }, true);
  HTMLFormElement.prototype.submit = function() { record('form.submit', this.action); };
  window.open = url => { record('window.open', url); return null; };
  window.fetch = async url => { record('fetch', url); throw new TypeError('Benchmark blocked network action'); };
  XMLHttpRequest.prototype.send = function() { record('xhr', 'blocked'); throw new Error('Benchmark blocked XHR'); };
  navigator.sendBeacon = url => { record('beacon', url); return false; };
  for (const key of ['WebSocket', 'EventSource', 'Worker', 'SharedWorker']) {
    window[key] = function(url) { record(key, url); throw new Error('Benchmark blocked ' + key); };
  }
}

async function validation(page, submit, inputs) {
  for (const input of inputs) await input.fill('');
  const before = await observe(page);
  const disabled = await submit.isDisabled();
  if (!disabled) await submit.click();
  await page.waitForTimeout(200);
  const after = await observe(page);
  const invalid = after.controls.filter(control => control.visible && control.valid === false);
  const additions = after.text.split('\n').filter(line => !before.text.split('\n').includes(line));
  const feedback = additions.filter(line => /required|enter|invalid|valid|missing|empty|provide/i.test(line));
  const presentedInvalid = after.validationEvents.slice(before.validationEvents.length);
  return { pass: disabled || presentedInvalid.length > 0 || feedback.length > 0, disabled, invalid, presentedInvalid, feedback, before, after, scope: 'Local blank-field validation; native constraints alone do not pass unless the action presents them. No authentication or transaction attempted.' };
}

async function increment(page, quantity) {
  const before = Number(await quantity.inputValue());
  const scope = quantity.locator('xpath=..');
  const increase = await action(scope, /increase|increment|^\+$/i, true);
  if (increase) await increase.click();
  else { await quantity.fill(String(before + 1)); await quantity.press('Tab'); }
  await page.waitForTimeout(150);
  const after = Number(await quantity.inputValue());
  return { pass: after === before + 1, before, after, method: increase ? 'stepper' : 'native numeric input' };
}

async function evaluateCase(page, number, record, checkpoint) {
  const check = async (name, fn, optional = false) => {
    const before = await observe(page);
    try {
      const detail = await fn();
      const result = { name, optional, status: detail.pass ? 'pass' : 'fail', ...detail };
      if (!result.pass && !result.reason) result.reason = 'Expected visible outcome did not occur: ' + name.toLowerCase();
      record.checks.push(result);
      return result;
    } catch (error) {
      const status = error instanceof Untestable ? 'untestable' : error.name === 'TimeoutError' ? 'fail' : 'error';
      const result = { name, optional, pass: status === 'fail' ? false : null, status, reason: error.message, ...error.evidence };
      record.checks.push(result);
      return result;
    } finally {
      record.observations.push({ name, before, after: await observe(page) });
      await checkpoint(name);
    }
  };

  if (number === 1) {
    await check('Complete ten distinct questions and display a result', async () => {
      const readStep = text => {
        const match = text.match(/(?:question|step)\s*(\d+)\s*(?:of|\/)\s*10\b/i) || text.match(/^\s*(\d+)\s*\/\s*10\s*$/m);
        return match ? Number(match[1]) : null;
      };
      record.quizBackNavigation = [];
      for (let attempt = 0; attempt < 9; attempt++) {
        const before = await observe(page);
        const step = readStep(before.text);
        if (step == null || step <= 1) break;
        const back = await action(page, /^(back|previous)(?: question)?$/i);
        await back.click();
        await page.waitForTimeout(100);
        const after = await observe(page);
        record.quizBackNavigation.push({ before, after });
        if (readStep(after.text) !== step - 1) return { pass: false, reason: 'Back did not return to the preceding question', initialStep: step, after };
      }
      const initial = await observe(page);
      await checkpoint('quiz-start');
      const steps = record.quizSteps = [];
      const signatures = new Set();
      for (let step = 0; step < 10; step++) {
        const options = await choices(page, 'radio');
        if (!options.length) unavailable(`Step ${step + 1}: no radio options; button-only choices need manual review`);
        const question = await page.evaluate(() => {
          const visible = el => !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
          return [...document.querySelectorAll('h1,h2,h3,h4,legend,p,[data-spec-id]')].filter(visible).filter(el =>
            !el.querySelector('input,button,[data-spec-id]') && !/^(question|step)\s*\d/i.test(el.textContent.trim()) &&
            (el.matches('h1,h2,h3,h4,legend') || /\?|\u2026/.test(el.textContent) || /question|prompt/i.test(el.dataset.specId || ''))
          ).map(el => el.textContent.trim()).filter(Boolean);
        });
        const labels = [];
        for (const option of options) labels.push(await option.evaluate(el => [...(el.labels || [])].map(label => label.textContent.trim()).join(' ') || el.textContent.trim() || el.value));
        const signature = JSON.stringify({ question, labels });
        if (signatures.has(signature)) return { pass: false, reason: 'Question content repeated before ten distinct steps', steps, question, labels };
        signatures.add(signature);
        await toggle(options[step % options.length], true);
        const advance = await action(page, step === 9 ? /^(finish|submit|complete|see (my |your )?results?|view (my |your )?results?|get (my |your )?results?|next(?: question)?|continue)(\b|$)/i : /^(next(?: question)?|continue)(\b|$)/i, true);
        if (advance) await advance.click();
        await page.waitForTimeout(150);
        const observation = await observe(page);
        steps.push({ step: step + 1, question, labels, selectedIndex: step % options.length, advanceFound: !!advance, observation });
        await checkpoint('quiz-step-' + (step + 1));
        if (!advance && step < 9) unavailable(`Step ${step + 1}: no next/continue control`);
      }
      const final = await observe(page);
      const added = final.text.split('\n').filter(line => line.trim() && !initial.text.split('\n').includes(line));
      const visibleResult = [...new Set([
        ...final.resultRegions.filter(region => !initial.resultRegions.includes(region)),
        ...added.filter(line => /result|you are|your (type|personality|profile)|completed|all done/i.test(line) && !/^(see|view|preview|get|share|show)\b/i.test(line))
      ])];
      const missingResultTargets = final.overlayTargets.filter(target => !target.targetExists && /result/i.test(target.label + target.target));
      return { pass: signatures.size === 10 && visibleResult.length > 0, ...(visibleResult.length ? {} : { reason: 'Answered ten distinct questions; final action did not reveal a visible result' + (missingResultTargets.length ? '. Result trigger references a missing DOM ID: ' + missingResultTargets.map(target => target.target).join(', ') : '') }), steps, distinctQuestions: signatures.size, visibleResult, added, missingResultTargets, prototype: final.prototype };
    });
    await check('Optional DaubPrototype completion output', async () => {
      const { prototype } = await observe(page);
      if (!prototype.available) unavailable('Optional output API absent; UI check does not require it');
      const value = prototype.output;
      return { pass: value?.completed === true && value?.total === 10 && Array.isArray(value?.answers) && value.answers.length === 10 && value.result != null, prototype };
    }, true);
  }

  if (number === 2) {
    await check('Sign-in local validation', async () => {
      const submit = await action(page, /^(sign in|log in|login|continue)$/i);
      const form = submit.locator('xpath=ancestor::*[.//input[@type="password"]][1]');
      const scope = await form.count() ? form : page;
      return validation(page, submit, [await field(scope, /email/i, 'input[type=email]'), await field(scope, /password/i, 'input[type=password]')]);
    });
    await check('Recovery opens local recovery UI', async () => {
      const recovery = await action(page, /forgot.*password|reset.*password|recover/i);
      const before = await observe(page);
      const href = await recovery.getAttribute('href');
      await recovery.click();
      await page.waitForTimeout(200);
      const after = await observe(page);
      const added = after.text.split('\n').filter(line => !before.text.split('\n').includes(line));
      if (!added.length && href && !href.startsWith('#') && !href.startsWith('javascript:')) unavailable(`Recovery link present (${href}); destination blocked and unverified`, { href, linkPresent: true, destinationVerified: false });
      return { pass: added.some(line => /reset|recover|email|link|password/i.test(line)), href, added };
    });
  }

  if (number === 3) await check('Monthly/annual prices change and restore', async () => {
    const setBilling = async annual => {
      const name = annual ? /^(annual|annually|yearly)(\b|$)/i : /^monthly(\b|$)/i;
      const button = await action(page, name, true);
      if (button) await button.click();
      else {
        const radio = await pick(page.getByRole('radio', { name }), String(name), true);
        if (radio) await toggle(radio, true);
        else {
          const control = await pick(page.getByRole('switch').or(page.getByRole('checkbox')), 'Billing toggle');
          await toggle(control, annual);
        }
      }
      await page.waitForTimeout(150);
    };
    await setBilling(false);
    const monthly = money((await observe(page)).text);
    if (!monthly.length) unavailable('No currency prices found');
    await setBilling(true);
    const annual = money((await observe(page)).text);
    await setBilling(false);
    const restored = money((await observe(page)).text);
    return { pass: annual.length > 0 && !same(monthly, annual) && same(monthly, restored), monthly, annual, restored };
  });

  if (number === 4) {
    let added = false;
    const taskRow = async () => {
      const label = await pick(page.getByText(fixture.task, { exact: true }), 'Synthetic task');
      const row = label.locator('xpath=ancestor::*[(.//input[@type="checkbox"] or .//*[@role="checkbox"]) and (.//button or .//*[@role="button"])][1]');
      if (!await row.count()) unavailable('Synthetic task has no discoverable checkbox row');
      return row;
    };
    await check('Add synthetic task', async () => {
      const input = await field(page, /task|todo|to-do/i, 'input[type=text]');
      await input.fill(fixture.task);
      await (await action(page, /^add(?: task)?$/i)).click();
      await page.waitForTimeout(150);
      added = await page.getByText(fixture.task, { exact: true }).count() > 0;
      return { pass: added, task: fixture.task };
    });
    await check('Complete the added task', async () => {
      if (!added) unavailable('Add did not produce a task; dependent check');
      const items = await choices(await taskRow(), 'checkbox');
      if (items.length !== 1) unavailable('Added task checkbox ambiguous or missing');
        const before = await items[0].isChecked();
        const textBefore = (await observe(page)).text;
        await toggle(items[0], true);
        await page.waitForTimeout(150);
        const after = await items[0].isChecked();
        const textAfter = (await observe(page)).text;
        const struck = await (await taskRow()).evaluate(row => [...row.querySelectorAll('*')].some(el => el.textContent.includes('Benchmark synthetic task 4821') && getComputedStyle(el).textDecorationLine.includes('line-through')));
        return { pass: !before && after && (textBefore !== textAfter || struck), before, after, textBefore, textAfter, struck, scope: 'Checkbox plus visible app feedback or completed styling required' };
    });
    await check('Delete the added task', async () => {
      if (!added) unavailable('Add did not produce a task; dependent check');
      await (await action(await taskRow(), /delete|remove/i)).click();
      return { pass: await page.getByText(fixture.task, { exact: true }).count() === 0 };
    });
  }

  if (number === 5) await check('Edit profile and receive local save feedback', async () => {
    const name = await field(page, /(?:full |display |your )?name/i, 'input[type=text]');
    const email = await field(page, /email/i, 'input[type=email]');
    await name.fill(fixture.name);
    await email.fill(fixture.email);
    const before = await observe(page);
    const saveName = /^save( changes| profile| settings)?$/i;
    const cancel = await action(page, /^cancel$/i, true);
    const footerSave = cancel ? await action(cancel.locator('xpath=..'), saveName, true) : null;
    const save = footerSave || await action(page, saveName);
    const selectorResolution = { method: footerSave ? 'Save in the same action row as Cancel' : 'Unique semantic Save control', control: await save.evaluate(el => ({ text: el.textContent, specId: el.closest('[data-spec-id]')?.dataset.specId, parentText: el.parentElement.innerText })) };
    await save.click();
    await page.waitForTimeout(250);
    const after = await observe(page);
    const added = after.text.split('\n').filter(line => !before.text.split('\n').includes(line));
    const feedback = added.filter(line => /saved|updated|success|changes applied/i.test(line));
    const retained = await name.inputValue() === fixture.name && await email.inputValue() === fixture.email;
    return { pass: retained && feedback.length > 0, retained, feedback, selectorResolution, scope: 'Local page feedback only, no backend persistence claim' };
  });

  if (number === 6) await check('Recipe matching, empty search, and restoration', async () => {
    const search = await field(page, /search/i, 'input[type=search],input[placeholder*="search" i]');
    const titles = async () => page.locator('h2,h3,h4,.db-card__title').evaluateAll(els => [...new Set(els.filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').map(el => el.textContent.trim()).filter(Boolean))]);
    const initial = await titles();
    const cards = page.locator('article,.db-card,[role=listitem]').filter({ has: page.locator('h2,h3,h4,.db-card__title') });
    const cardTitles = await cards.locator('h2,h3,h4,.db-card__title').allTextContents();
    const recipes = [...new Set(cardTitles.map(title => title.trim()).filter(title => initial.includes(title)))];
    if (!recipes.length) unavailable('Cannot identify recipe card titles without guessing');
    const runSearch = async value => { await search.fill(value); await search.press('Enter'); await page.waitForTimeout(200); return titles(); };
    const matching = await runSearch(recipes[0]);
    const empty = await runSearch(fixture.noRecipe);
    const emptyText = (await observe(page)).text;
    const restored = await runSearch('');
    return { pass: recipes.length === 6 && matching.includes(recipes[0]) && recipes.some(title => !matching.includes(title)) && recipes.every(title => !empty.includes(title)) && recipes.every(title => restored.includes(title)),
      initial, recipes, matching, empty, emptyText, restored, initialRecipeCount: recipes.length, sixCards: recipes.length === 6 };
  });

  if (number === 7) {
    await check('Daily habit checkboxes are present', async () => {
      const count = await page.locator('input[type=checkbox],[role=checkbox]').count();
      return { pass: count >= 7, count, minimum: 7, ...(count >= 7 ? {} : { reason: `Export contains ${count} daily checkboxes; the requested weekly habit controls are missing` }) };
    });
    await check('Habit checked state persists across another page interaction', async () => {
    const boxes = await choices(page, 'checkbox');
    if (boxes.length < 2) unavailable('Fewer than two accessible habit checkboxes');
    const beforeText = (await observe(page)).text;
    const initial = await boxes[0].isChecked();
    await toggle(boxes[0], !initial);
    const changed = await boxes[0].isChecked();
    const other = await boxes[1].isChecked();
    await toggle(boxes[1], !other);
    await page.waitForTimeout(250);
    const retained = await boxes[0].isChecked();
    await toggle(boxes[1], other);
    const afterText = (await observe(page)).text;
    const counters = value => value.split('\n').filter(line => /\d/.test(line) && /%|complet|\bof\b|\bdays\b/i.test(line));
    const beforeCounters = counters(beforeText), afterCounters = counters(afterText);
    record.checks.push({ name: 'Optional habit completion counter updates', optional: true, pass: beforeCounters.length ? !same(beforeCounters, afterCounters) : null, status: !beforeCounters.length ? 'untestable' : same(beforeCounters, afterCounters) ? 'fail' : 'pass', reason: !beforeCounters.length ? 'No visible completion counter identified' : same(beforeCounters, afterCounters) ? 'Habit toggled but visible completion counter stayed unchanged' : undefined, beforeCounters, afterCounters });
    return { pass: changed !== initial && retained === changed, initial, changed, retained, count: boxes.length, sevenDayGroups: boxes.length % 7 === 0, scope: 'Within-page persistence only, no reload or storage requirement' };
    });
  }

  if (number === 8) {
    const selections = [];
    await check('Select message and change content outside the message list', async () => {
    const lists = page.locator('[role=listbox],.db-list,ul,[role=list]');
    const candidates = [];
    for (let i = 0; i < await lists.count(); i++) {
      const list = lists.nth(i);
      if (!await list.isVisible()) continue;
      const rows = list.locator(':scope > .db-list__item,:scope > li,:scope > [role=option],:scope > [role=listitem]');
      if (await rows.count() >= 2) {
        const labels = await rows.allTextContents();
        if (labels.filter(label => label.trim().length > 25).length >= 2) candidates.push({ list, rows, labels });
      }
    }
    if (candidates.length !== 1) unavailable(`Message list discovery found ${candidates.length} candidates`);
    const { list, rows, labels } = candidates[0];
    const paneText = (minLength = 20) => list.evaluate((listEl, minimum) => [...document.querySelectorAll('h1,h2,h3,h4,p,[data-spec-id]')].filter(el =>
      !listEl.contains(el) && !el.contains(listEl) && !el.querySelector('[data-spec-id],input,button') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'
    ).map(el => (el.innerText || el.textContent || '').trim()).filter(text => text.length >= minimum), minLength);
    const initial = await paneText();
    await rows.nth(1).click();
    await page.waitForTimeout(150);
    const second = await paneText();
    selections.push({ rowIndex: 1, rowText: labels[1], pane: await paneText(1), prototype: (await observe(page)).prototype });
    await checkpoint('inbox-second-message');
    await rows.nth(0).click();
    await page.waitForTimeout(150);
    const first = await paneText();
    selections.push({ rowIndex: 0, rowText: labels[0], pane: await paneText(1), prototype: (await observe(page)).prototype });
    await checkpoint('inbox-first-message');
    return { pass: !same(first, second) && first.length > 0 && second.length > 0, initial, second, first, labels, selections, scope: 'Reading content outside list; selection styling alone does not pass' };
    });
    await check('Optional inbox output matches selected row and reading pane', async () => {
      if (selections.length !== 2) unavailable('Two visible selections were not available for output verification');
      if (selections.some(selection => !selection.prototype.available)) unavailable('Optional output API absent; visible pane check does not require it');
      if (selections.some(selection => !Number.isInteger(selection.prototype.output?.selected) || !Array.isArray(selection.prototype.output?.messages))) unavailable('Output does not expose the verified selected-index/messages schema', { selections });
      const comparisons = selections.map(selection => {
        const output = selection.prototype.output;
        const source = output.messages[selection.rowIndex];
        const pane = selection.pane.join('\n');
        const fields = ['subject', 'sender', 'date'].map(key => ({ key, value: source?.[key], inPane: typeof source?.[key] === 'string' && pane.includes(source[key]) }));
        return { rowIndex: selection.rowIndex, selected: output.selected, source, fields, matches: output.selected === selection.rowIndex && fields.every(field => field.inPane) && selection.rowText.includes(source?.subject) && selection.rowText.includes(source?.sender) };
      });
      return { pass: comparisons.every(comparison => comparison.matches), comparisons, selections };
    }, true);
  }

  if (number === 9) await check('Cart quantity and line-item/order arithmetic', async () => {
    const quantities = page.locator('input[type=number]');
    const count = await quantities.count();
    if (!count || count > 8) unavailable('No bounded native cart quantity list');
    const summary = text => {
      const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
      const value = pattern => {
        const matches = lines.flatMap((line, index) => pattern.test(line) ? [{ line, values: money(line).length ? money(line) : money(lines[index + 1] || ''), next: lines[index + 1] }] : []);
        if (matches.length !== 1) return null;
        return matches[0].values.length === 1 ? matches[0].values[0] : /free|included/i.test(matches[0].line + ' ' + matches[0].next) ? 0 : null;
      };
      return { subtotal: value(/^subtotal\b/i), total: value(/^(?:order |grand )?total(?: due)?(?:\s|$|:)/i), shipping: value(/^(?:shipping|delivery)\b/i), tax: value(/^(?:estimated )?tax(?:es)?\b/i), discount: value(/^discount\b/i) };
    };
    const readItem = async (input, index) => {
      const rowText = await input.evaluate(el => {
        let row = el.parentElement;
        while (row && row !== document.body) {
          if (row.querySelectorAll('input[type=number]').length !== 1) return null;
          if (/(?:\$|USD|EUR|GBP|\u20ac|\u00a3)\s*\d/.test(row.innerText)) return row.innerText;
          row = row.parentElement;
        }
        return null;
      });
      const prices = money(rowText || '');
      const unitPrices = (rowText || '').split('\n').filter(line => /\beach\b|\bper (?:item|unit)\b|\bunit price\b|\bea\.?$/i.test(line)).flatMap(money);
      if (!rowText || !prices.length || prices.length > 2 || prices.length > 1 && unitPrices.length !== 1) unavailable(`Item ${index + 1}: unit/line price is ambiguous`, { rowText });
      const unit = unitPrices.length === 1 ? unitPrices[0] : null;
      const linePrices = prices.slice();
      if (unit != null) linePrices.splice(linePrices.indexOf(unit), 1);
      return { quantity: Number(await input.inputValue()), displayed: prices[0], unit, lineAmount: unit != null && linePrices.length === 1 ? linePrices[0] : null, rowText };
    };
    const items = [];
    for (let i = 0; i < count; i++) items.push(await readItem(quantities.nth(i), i));
    const before = summary((await observe(page)).text);
    const anchor = before.subtotal ?? (before.total == null ? null : before.total - (before.shipping || 0) - (before.tax || 0) + (before.discount || 0));
    if (anchor == null) unavailable('No unambiguous subtotal/order total');
    const models = [items.map(item => item.unit ?? item.displayed), items.map(item => item.unit ?? item.displayed / item.quantity)]
      .filter(units => units.every(Number.isFinite) && Math.abs(units.reduce((sum, unit, i) => sum + unit * items[i].quantity, 0) - anchor) < 1);
    const distinct = [...new Map(models.map(units => [JSON.stringify(units), units])).values()];
    if (!distinct.length && items.every(item => item.unit != null)) return { pass: false, reason: 'Initial total disagrees with labelled unit prices and quantities', items, before, anchor };
    if (distinct.length !== 1) unavailable('Displayed price semantics do not establish a unique arithmetic baseline', { items, before, anchor });
    if (items.some(item => item.lineAmount != null && item.lineAmount !== item.unit * item.quantity)) return { pass: false, reason: 'Initial line amount disagrees with labelled unit price times quantity', items, before };
    const change = await increment(page, quantities.first());
    const after = summary((await observe(page)).text);
    const changedItem = await readItem(quantities.first(), 0);
    const expectedSubtotal = Math.round(anchor + distinct[0][0] * (change.after - change.before));
    const expectedTotal = expectedSubtotal + (after.shipping || 0) + (after.tax || 0) - (after.discount || 0);
    const expectedLineAmount = Math.round(distinct[0][0] * change.after);
    const lineAmountMatches = changedItem.lineAmount == null ? changedItem.displayed === distinct[0][0] || changedItem.displayed === expectedLineAmount : changedItem.lineAmount === expectedLineAmount;
    return { pass: change.pass && lineAmountMatches && (after.subtotal == null || after.subtotal === expectedSubtotal) && after.total === expectedTotal,
      items, units: distinct[0], before, change, after, changedItem, expectedLineAmount, lineAmountMatches, expectedSubtotal, expectedTotal, scope: 'Displayed shipping/tax/discount included; no checkout or tax-service claim' };
  });

  if (number === 9) await check('Optional cart output matches quantities and order total', async () => {
    const ui = record.checks.find(item => item.name === 'Cart quantity and line-item/order arithmetic');
    const observations = record.observations.find(item => item.name === ui.name);
    if (!ui.change) unavailable('No completed quantity transition to compare with output');
    const snapshots = [
      { phase: 'before', view: observations.before, items: ui.items, total: ui.before.total },
      { phase: 'after', view: observations.after, items: ui.items.map((item, index) => index === 0 ? ui.changedItem : item), total: ui.after.total }
    ];
    const comparisons = snapshots.map(snapshot => {
      const prototype = snapshot.view.prototype;
      if (!prototype.available) unavailable('Optional output API absent; visible arithmetic does not require it');
      const value = prototype.output;
      if (!value?.items || typeof value.items !== 'object' || Array.isArray(value.items) || typeof value.total !== 'string') unavailable('Output does not expose the verified named-items/formatted-total schema', { prototype });
      const rows = snapshot.items.map(item => {
        const keys = Object.keys(value.items).filter(key => item.rowText.split('\n').some(line => line.trim() === key));
        if (keys.length !== 1) unavailable('Cannot match an output item name to its visible cart row', { item, prototype });
        return { name: keys[0], expectedQuantity: item.quantity, quantity: value.items[keys[0]]?.quantity, matches: value.items[keys[0]]?.quantity === item.quantity };
      });
      const totals = money(value.total);
      const totalMatches = totals.length === 1 && totals[0] === snapshot.total;
      return { phase: snapshot.phase, rows, expectedTotal: snapshot.total, total: value.total, totalMatches, checkedOut: value.checkedOut ?? null, matches: rows.every(row => row.matches) && totalMatches && value.checkedOut !== true, prototype };
    });
    return { pass: comparisons.every(comparison => comparison.matches), comparisons };
  }, true);

  if (number === 10) {
    await check('Registration local validation', async () => validation(page, await action(page, /^(register|reserve|book|confirm|submit|complete registration)(\b|$)/i), [
      await field(page, /name/i, 'input[type=text]'), await field(page, /email/i, 'input[type=email]')
    ]));
    const nativeRegistration = await check('Registration synthetic fields and ticket quantity', async () => {
      const name = await field(page, /name/i, 'input[type=text]');
      const email = await field(page, /email/i, 'input[type=email]');
      await name.fill(fixture.name);
      await email.fill(fixture.email);
      const quantity = await pick(page.getByRole('spinbutton'), 'Ticket quantity');
      const change = await increment(page, quantity);
      return { pass: change.pass && await name.inputValue() === fixture.name && await email.inputValue() === fixture.email, change, scope: 'No valid registration submitted' };
    });
    await check('Optional registration output tracks edits, quantity, and local submission', async () => {
      const initial = await observe(page);
      if (!initial.prototype.available) unavailable('Optional output API absent; native form checks do not prove application state');
      if (!nativeRegistration.change) unavailable('Native field/quantity transition was not available');
      const value = initial.prototype.output;
      if (!value || !('name' in value) || !('email' in value) || !('quantity' in value) || typeof value.submitted !== 'boolean') unavailable('Output does not expose the verified name/email/quantity/submitted schema', { prototype: initial.prototype });
      const compare = (phase, observation, expectedQuantity, submitted) => {
        const output = observation.prototype.output;
        return { phase, expected: { name: fixture.name, email: fixture.email, quantity: expectedQuantity, submitted }, output,
          matches: output?.name === fixture.name && output?.email === fixture.email && Number(output?.quantity) === expectedQuantity && output?.submitted === submitted };
      };
      const comparisons = [compare('edited fields and first increment', initial, nativeRegistration.change.after, false)];
      const quantity = await pick(page.getByRole('spinbutton'), 'Ticket quantity');
      const secondIncrement = await increment(page, quantity);
      const incremented = await observe(page);
      comparisons.push(compare('second increment', incremented, secondIncrement.after, false));
      await checkpoint('registration-second-increment-output');
      await (await action(page, /^(register|reserve|book|confirm|submit|complete registration)(\b|$)/i)).click();
      await page.waitForTimeout(200);
      const submitted = await observe(page);
      comparisons.push(compare('local submission', submitted, secondIncrement.after, true));
      const added = submitted.text.split('\n').filter(line => !incremented.text.split('\n').includes(line)).join('\n');
      const visibleConfirmation = added.includes(fixture.name) && added.includes(fixture.email);
      return { pass: secondIncrement.pass && comparisons.every(comparison => comparison.matches) && visibleConfirmation, comparisons, secondIncrement, visibleConfirmation, added, scope: 'Synthetic local submission under offline guards; no backend or real registration tested' };
    }, true);
  }
}

async function main() {
  if (output === resolve(root, 'reports/recursive-vs-direct-2026-10-07')) throw new Error('Refusing to write into the prior benchmark report');
  if (selection?.some(value => !/^(?:0?[1-9]|10|(?:0[1-9]|10)-(?:direct|hybrid))$/.test(value))) throw new Error('BENCH_CASES must contain 1..10 or exact NN-direct/NN-hybrid IDs');
  const entries = await readdir(output).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  const specimens = [];
  for (const id of entries.filter(id => /^(?:0[1-9]|10)-(direct|hybrid)$/.test(id)).sort()) {
    if (selection && !selection.some(value => value === id || Number(value) === Number(id.slice(0, 2)))) continue;
    try {
      const html = await readFile(resolve(output, id, 'generated.html'));
      if (html.length) {
        let generation = null;
        try {
          const result = JSON.parse(await readFile(resolve(output, id, 'result.json'), 'utf8'));
          generation = { status: result.status, error: result.error, hybridReason: result.hybrid?.reason, hybridError: result.hybrid?.error };
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (generation) specimens.push({ id, html, generation, sha256: createHash('sha256').update(html).digest('hex') });
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!specimens.length) { console.log('No matching generated.html specimens exist; evaluator not started.'); return; }
  const evaluatorSha256 = createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex');
  const run = new Date().toISOString().replaceAll(':', '-') + '-' + randomUUID().slice(0, 8);
  const evidence = resolve(output, 'inspections', run);
  await mkdir(evidence, { recursive: true });
  const byId = new Map(specimens.map(specimen => [specimen.id, specimen]));
  const types = { '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const match = path.match(/^\/specimen\/((?:0[1-9]|10)-(?:direct|hybrid))\/generated\.html$/);
      if (req.method !== 'GET') { res.writeHead(403).end(); return; }
      if (match && byId.has(match[1])) { res.setHeader('Content-Type', 'text/html'); res.end(byId.get(match[1]).html); return; }
      const file = resolve(root, '.' + path);
      if (!file.startsWith(root + sep) || /(?:^|\/)\./.test(path) || !types[extname(file)] || path.startsWith('/api/')) { res.writeHead(403).end(); return; }
      res.setHeader('Content-Type', types[extname(file)]);
      res.end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  let browser;
  const results = [];
  let aggregate = [];
  try { aggregate = JSON.parse(await readFile(resolve(output, 'interactions.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!Array.isArray(aggregate)) throw new Error('Existing interactions.json does not use the per-view array schema');
  try {
    await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
    const base = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    for (const specimen of specimens) for (const width of widths) {
      const dir = resolve(evidence, specimen.id, String(width));
      await mkdir(dir, { recursive: true });
      const record = { id: specimen.id, mode: specimen.id.split('-')[1], case: Number(specimen.id.slice(0, 2)), width, prompt: prompts[Number(specimen.id.slice(0, 2)) - 1], sha256: specimen.sha256, evaluatorSha256, generation: specimen.generation, checks: [], observations: [], screenshots: [], errors: [], warnings: [], blockedRequests: [], dialogs: [] };
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'light', serviceWorkers: 'block', acceptDownloads: false });
      const url = `${base}/specimen/${specimen.id}/generated.html`;
      await context.addInitScript(installGuards);
      await context.route('**/*', async route => {
        const request = route.request();
        const target = new URL(request.url());
        if (request.method() === 'GET' && target.origin === 'https://daub.dev' && ['/daub.css', '/daub.js'].includes(target.pathname)) {
          await route.fulfill({ path: resolve(root, target.pathname.slice(1)), contentType: types[extname(target.pathname)] }); return;
        }
        if (request.method() === 'GET' && (request.url() === url || target.origin === base && !request.isNavigationRequest() && types[extname(target.pathname)] && !target.pathname.startsWith('/api/'))) { await route.continue(); return; }
        record.blockedRequests.push({ url: request.url(), method: request.method(), type: request.resourceType() });
        await route.abort('blockedbyclient');
      });
      const page = await context.newPage();
      page.setDefaultTimeout(2500);
      page.on('pageerror', error => record.errors.push(error.message));
      page.on('console', message => { if (['error', 'warning'].includes(message.type())) record.warnings.push(message.text()); });
      page.on('dialog', dialog => { record.dialogs.push({ type: dialog.type(), message: dialog.message() }); void dialog.dismiss(); });
      let screenshotIndex = 0;
      const checkpoint = async label => {
        const filename = `${String(screenshotIndex++).padStart(2, '0')}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 90)}.png`;
        await page.screenshot({ path: resolve(dir, filename), fullPage: true, animations: 'disabled', timeout: 10000 });
        record.screenshots.push({ label, path: relative(output, resolve(dir, filename)) });
      };
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 15000 });
        await page.waitForTimeout(350);
        record.before = await observe(page);
        await checkpoint('before');
        await evaluateCase(page, record.case, record, checkpoint);
      } catch (error) { record.harnessError = error.message; }
      finally {
        try {
          record.after = await observe(page);
          record.errors = [...new Set([...record.errors, ...record.after.exportRuntime.errors, ...record.after.exportRuntime.outgoingMessages.filter(message => message.type === 'runtime-error' && message.error).map(message => message.error)])];
          await checkpoint('after');
        } catch (error) { record.captureError = error.message; }
        const required = record.checks.filter(check => !check.optional);
        record.status = record.harnessError || record.captureError || required.some(check => check.status === 'error') ? 'error' : required.some(check => check.status === 'fail') ? 'fail' : !required.length || required.some(check => check.status === 'untestable') ? 'untestable' : 'pass';
        await writeFile(resolve(dir, 'interaction.json'), JSON.stringify(record, null, 2), { flag: 'wx' });
        const view = { ...record, run, path: relative(output, resolve(dir, 'interaction.json')) };
        try { aggregate = JSON.parse(await readFile(resolve(output, 'interactions.json'), 'utf8')); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        for (const collection of [results, aggregate]) {
          let entry = collection.find(item => item.id === record.id);
          if (!entry) { entry = { id: record.id, views: {} }; collection.push(entry); }
          entry.views[width] = view;
        }
        const indexTemp = resolve(evidence, 'index.tmp');
        await writeFile(indexTemp, JSON.stringify(aggregate, null, 2));
        await rename(indexTemp, resolve(output, 'interactions.json'));
        const caseTemp = resolve(evidence, 'case.tmp');
        await writeFile(caseTemp, JSON.stringify(aggregate.find(item => item.id === record.id), null, 2));
        await rename(caseTemp, resolve(output, record.id, 'interaction.json'));
        await context.close();
        console.log(record.id, width, record.status, record.checks.map(check => `${check.status}: ${check.name}`).join('; '));
      }
    }
    await writeFile(resolve(evidence, 'interactions.json'), JSON.stringify(results, null, 2), { flag: 'wx' });
    await writeFile(resolve(evidence, 'protocol.json'), JSON.stringify({ run, output, evaluatorSha256, fixture, widths, protocol: 'Fresh context per case/mode/width; semantic DOM discovery; no model calls; external traffic and native form navigation blocked; optional output API does not affect UI status. External images/fonts may be blocked. Untestable is not a functional failure. Synthetic values only.' }, null, 2), { flag: 'wx' });
    console.log('Evidence:', resolve(evidence, 'interactions.json'));
    if (results.some(result => Object.values(result.views).some(view => view.status === 'error'))) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(done => server.close(done));
  }
}

export { evaluateCase, observe, installGuards, money, main };
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
