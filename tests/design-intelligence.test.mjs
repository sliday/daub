// Tests for design intelligence features (industry detection, UX validation, prompt enhancements)
// Uses Node.js built-in test runner: node --test tests/design-intelligence.test.mjs

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectIndustryIntent,
  detectMobileIntent,
  detectLandingIntent,
  INDUSTRY_INTENTS,
  MOBILE_DESIGN_RULES,
  PAGE_FORMULAS,
} from '../mcp/lib/design-knowledge.js';
import { buildSystemPrompt } from '../mcp/lib/prompt.js';
import { validateSpec } from '../mcp/lib/validate.js';

// ============================================================
// Industry Intent Detection
// ============================================================
describe('detectIndustryIntent', () => {
  it('returns null for empty/null input', () => {
    assert.equal(detectIndustryIntent(null), null);
    assert.equal(detectIndustryIntent(''), null);
    assert.equal(detectIndustryIntent(undefined), null);
  });

  it('returns null for generic prompts', () => {
    assert.equal(detectIndustryIntent('Build a todo app'), null);
    assert.equal(detectIndustryIntent('Create a simple form'), null);
  });

  it('detects SaaS intent', () => {
    const result = detectIndustryIntent('Build a SaaS pricing page');
    assert.ok(result);
    assert.equal(result.theme, 'github');
    assert.ok(result.rules.length > 0);
  });

  it('detects e-commerce intent', () => {
    const result = detectIndustryIntent('Create an e-commerce product page');
    assert.ok(result);
    assert.equal(result.theme, 'light');
  });

  it('detects fintech intent', () => {
    const result = detectIndustryIntent('Build a fintech dashboard');
    assert.ok(result);
    assert.equal(result.theme, 'material-light');
  });

  it('detects healthcare intent', () => {
    const result = detectIndustryIntent('Design a healthcare patient portal');
    assert.ok(result);
    assert.equal(result.theme, 'nord-light');
  });

  it('detects education intent', () => {
    const result = detectIndustryIntent('Create an LMS course page');
    assert.ok(result);
    assert.equal(result.theme, 'catppuccin');
  });

  it('detects creative/portfolio intent', () => {
    const result = detectIndustryIntent('Design a creative portfolio site');
    assert.ok(result);
    assert.equal(result.theme, 'grunge-dark');
  });

  it('detects dashboard intent', () => {
    const result = detectIndustryIntent('Build an analytics dashboard');
    assert.ok(result);
    assert.equal(result.theme, 'github');
  });

  it('detects dev tools intent', () => {
    const result = detectIndustryIntent('Create a developer API console');
    assert.ok(result);
    assert.equal(result.theme, 'dracula');
  });

  it('detects music/audio intent', () => {
    const result = detectIndustryIntent('Build a podcast streaming app');
    assert.ok(result);
    assert.equal(result.theme, 'synthwave');
  });

  it('detects gaming intent', () => {
    const result = detectIndustryIntent('Design a gaming leaderboard');
    assert.ok(result);
    assert.equal(result.theme, 'tokyo-night');
  });

  it('is case-insensitive', () => {
    const result = detectIndustryIntent('FINTECH DASHBOARD');
    assert.ok(result);
    assert.equal(result.theme, 'material-light');
  });

  it('returns rules string with anti-patterns', () => {
    const result = detectIndustryIntent('Build a healthcare app');
    assert.ok(result.rules.includes('Anti:'));
  });

  it('all 20 intents have required fields', () => {
    assert.equal(INDUSTRY_INTENTS.length, 20);
    for (const intent of INDUSTRY_INTENTS) {
      assert.ok(intent.pattern instanceof RegExp, 'pattern must be RegExp');
      assert.ok(typeof intent.theme === 'string', 'theme must be string');
      assert.ok(typeof intent.rules === 'string', 'rules must be string');
      assert.ok(intent.rules.length > 10, 'rules must be substantive');
    }
  });
});

// ============================================================
// Mobile Intent Detection
// ============================================================
describe('detectMobileIntent', () => {
  it('detects mobile app prompts', () => {
    assert.ok(detectMobileIntent('Create a mobile app'));
    assert.ok(detectMobileIntent('Build an iOS app'));
    assert.ok(detectMobileIntent('Design an Android app'));
    assert.ok(detectMobileIntent('mobile UI for food delivery'));
    assert.ok(detectMobileIntent('app shell with bottom nav'));
  });

  it('returns false for desktop prompts', () => {
    assert.ok(!detectMobileIntent('Build a dashboard'));
    assert.ok(!detectMobileIntent('Create a landing page'));
    assert.ok(!detectMobileIntent(null));
    assert.ok(!detectMobileIntent(''));
  });
});

// ============================================================
// UX Validation Warnings
// ============================================================
describe('validateSpec — UX warnings', () => {
  it('warns on BottomNav with >5 items', () => {
    const spec = {
      root: 'root',
      elements: {
        root: { type: 'BottomNav', props: { items: [{}, {}, {}, {}, {}, {}] } },
      },
    };
    const result = validateSpec(spec);
    assert.ok(result.valid);
    assert.ok(result.warnings.some(w => w.includes('BottomNav') && w.includes('6 items')));
  });

  it('warns on empty Text content', () => {
    const spec = {
      root: 'root',
      elements: {
        root: { type: 'Text', props: { content: '' } },
      },
    };
    const result = validateSpec(spec);
    assert.ok(result.warnings.some(w => w.includes('Text') && w.includes('empty content')));
  });

  it('warns on Card with no title and no children', () => {
    const spec = {
      root: 'root',
      elements: {
        root: { type: 'Card', props: {} },
      },
    };
    const result = validateSpec(spec);
    assert.ok(result.warnings.some(w => w.includes('Card') && w.includes('no title')));
  });

  it('warns on multiple primary Buttons in same parent', () => {
    const spec = {
      root: 'root',
      elements: {
        root: { type: 'Stack', props: {}, children: ['b1', 'b2'] },
        b1: { type: 'Button', props: { variant: 'primary', label: 'Go' } },
        b2: { type: 'Button', props: { variant: 'primary', label: 'Submit' } },
      },
    };
    const result = validateSpec(spec);
    assert.ok(result.warnings.some(w => w.includes('Multiple primary Buttons')));
  });

  it('warns on Input without Label or Field wrapper', () => {
    const spec = {
      root: 'root',
      elements: {
        root: { type: 'Stack', props: {}, children: ['inp'] },
        inp: { type: 'Input', props: { placeholder: 'Type...' } },
      },
    };
    const result = validateSpec(spec);
    assert.ok(result.warnings.some(w => w.includes('Input') && w.includes('no associated Label')));
  });

  it('no warning when Input is inside Field', () => {
    const spec = {
      root: 'root',
      elements: {
        root: { type: 'Field', props: { label: 'Email' }, children: ['inp'] },
        inp: { type: 'Input', props: { placeholder: 'Email...' } },
      },
    };
    const result = validateSpec(spec);
    assert.ok(!result.warnings.some(w => w.includes('Input')));
  });

  it('no warning on single primary Button', () => {
    const spec = {
      root: 'root',
      elements: {
        root: { type: 'Stack', props: {}, children: ['b1', 'b2'] },
        b1: { type: 'Button', props: { variant: 'primary', label: 'Go' } },
        b2: { type: 'Button', props: { variant: 'ghost', label: 'Cancel' } },
      },
    };
    const result = validateSpec(spec);
    assert.ok(!result.warnings.some(w => w.includes('Multiple primary')));
  });

  it('no warning on BottomNav with 5 or fewer items', () => {
    const spec = {
      root: 'root',
      elements: {
        root: { type: 'BottomNav', props: { items: [{}, {}, {}, {}, {}] } },
      },
    };
    const result = validateSpec(spec);
    assert.ok(!result.warnings.some(w => w.includes('BottomNav')));
  });

  it('returns empty warnings array when spec is clean', () => {
    const spec = {
      root: 'root',
      elements: {
        root: { type: 'Text', props: { content: 'Hello' } },
      },
    };
    const result = validateSpec(spec);
    assert.ok(Array.isArray(result.warnings));
    assert.equal(result.warnings.length, 0);
  });
});

// ============================================================
// System Prompt Integration
// ============================================================
describe('buildSystemPrompt — design intelligence', () => {
  it('includes industry context for fintech prompt', () => {
    const prompt = buildSystemPrompt([], 'Build a fintech dashboard');
    assert.ok(prompt.includes('DETECTED INDUSTRY CONTEXT'));
    assert.ok(prompt.includes('material-light'));
  });

  it('does not include industry context for generic prompt', () => {
    const prompt = buildSystemPrompt([], 'Build a todo app');
    assert.ok(!prompt.includes('DETECTED INDUSTRY CONTEXT'));
  });

  it('includes mobile rules for mobile prompt', () => {
    const prompt = buildSystemPrompt([], 'Create a mobile app');
    assert.ok(prompt.includes('MOBILE APP DESIGN PATTERNS'));
  });

  it('does not include mobile rules for desktop prompt', () => {
    const prompt = buildSystemPrompt([], 'Build a dashboard');
    assert.ok(!prompt.includes('MOBILE APP DESIGN PATTERNS'));
  });

  it('includes landing page rules when landing intent detected', () => {
    const prompt = buildSystemPrompt([], 'Create a landing page');
    assert.ok(prompt.includes('LANDING PAGE PATTERNS'));
  });

  it('always includes page formulas', () => {
    const prompt = buildSystemPrompt([], 'Build anything');
    assert.ok(prompt.includes('PAGE FORMULAS'));
  });

  it('always includes expanded theme heuristics', () => {
    const prompt = buildSystemPrompt([], 'Build anything');
    assert.ok(prompt.includes('SaaS/B2B/CRM'));
    assert.ok(prompt.includes('E-commerce/shop'));
    assert.ok(prompt.includes('Dev tools/code'));
  });

  it('includes component UX hints', () => {
    const prompt = buildSystemPrompt([], 'Build a form');
    assert.ok(prompt.includes('UX: one primary per view'));
    assert.ok(prompt.includes('UX: always include label'));
    assert.ok(prompt.includes('UX: max 5 items'));
  });
});

// ============================================================
// Constants sanity
// ============================================================
describe('design knowledge constants', () => {
  it('MOBILE_DESIGN_RULES is a non-empty string', () => {
    assert.ok(typeof MOBILE_DESIGN_RULES === 'string');
    assert.ok(MOBILE_DESIGN_RULES.length > 100);
  });

  it('PAGE_FORMULAS is a non-empty string', () => {
    assert.ok(typeof PAGE_FORMULAS === 'string');
    assert.ok(PAGE_FORMULAS.includes('Dashboard'));
    assert.ok(PAGE_FORMULAS.includes('Settings'));
    assert.ok(PAGE_FORMULAS.includes('Onboarding'));
  });
});
