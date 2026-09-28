// playground.html DESIGN_PLAYBOOK: the pack list passes /api/choose validation, and the system-message section
// has the shape the design eval used ("\n\nDESIGN PLAYBOOK\n\n" + core + picked packs in playbook order + "\n").
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const html = readFileSync('playground.html', 'utf8');
const start = html.indexOf('var DESIGN_PLAYBOOK = {');
const end = html.indexOf('\n}\n', html.indexOf('function designPlaybookSection(')) + 3;
assert.ok(start > 0 && end > start, 'DESIGN_PLAYBOOK block not found');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(html.slice(start, end) + '\nthis.PB = DESIGN_PLAYBOOK; this.section = designPlaybookSection;', ctx);
const { PB, section } = ctx;
const { packQuestions } = await import(pathToFileURL(path.resolve('functions/api/choose.js')).href);

describe('DESIGN_PLAYBOOK', () => {
  it('has core rules and 14 packs that /api/choose accepts', () => {
    assert.ok(PB.core.startsWith('DESIGN RULES:'));
    assert.equal(PB.packs.length, 14);
    const q = packQuestions(PB.packs.map(p => ({ id: p.id, purpose: p.purpose })));
    assert.equal(Object.keys(q).length, 14);
    for (const p of PB.packs) assert.ok(p.text.trim().length > 0, p.id + ' has text');
  });
  it('the flag is a top-level let outside the playground IIFE, so page.evaluate can flip it', () => {
    assert.match(html, /<script>\n(\/\/[^\n]*\n)*let DESIGN_PACKS_ON = true;\n<\/script>/);
  });
});

describe('designPlaybookSection', () => {
  it('core only when nothing was picked or the pick failed', () => {
    const want = '\n\nDESIGN PLAYBOOK\n\n' + PB.core + '\n';
    assert.equal(section([]), want);
    assert.equal(section(null), want);
    assert.equal(section(undefined), want);
  });
  it('core plus picked pack texts in playbook order; unknown ids are ignored', () => {
    const [a, b] = [PB.packs[0], PB.packs[5]];
    assert.equal(section([b.id, 'no-such-pack', a.id]), '\n\nDESIGN PLAYBOOK\n\n' + PB.core + '\n\n' + a.text + '\n\n' + b.text + '\n');
  });
});
