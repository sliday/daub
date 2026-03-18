import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('Theme Preview page', () => {
  const html = readFileSync('theme-preview.html', 'utf8');

  it('should exist and contain theme preview structure', () => {
    assert.ok(html.includes('Theme Preview'), 'missing title');
    assert.ok(html.includes('id="css-input"'), 'missing CSS input textarea');
    assert.ok(html.includes('id="json-dropzone"'), 'missing JSON dropzone');
    assert.ok(html.includes('id="preview"'), 'missing preview panel');
    assert.ok(html.includes('id="token-inspector"'), 'missing token inspector');
  });

  it('should include all preview component sections', () => {
    const sections = ['Buttons', 'Cards', 'Form Fields', 'Badges', 'Chips', 'Alerts', 'Table', 'Avatar', 'Progress', 'Skeleton', 'Modal Preview', 'Typography'];
    for (const section of sections) {
      assert.ok(html.includes(section), `missing preview section: ${section}`);
    }
  });

  it('should apply CSS vars as inline styles on html element', () => {
    assert.ok(html.includes('document.documentElement.style.setProperty'), 'should use inline style approach for max specificity');
  });

  it('should clean up inline styles on reset', () => {
    assert.ok(html.includes('style.removeProperty'), 'should remove inline custom properties on reset');
  });

  it('should handle HTML wrapper stripping from extension output', () => {
    assert.ok(html.includes('/<\\/?style[^>]*>/gi'), 'should strip <style> tags');
    assert.ok(html.includes('/<link[^>]*>/gi'), 'should strip <link> tags');
    assert.ok(html.includes('/<script[^>]*>'), 'should strip <script> tags');
  });

  it('should convert JSON to CSS with correct token mappings', () => {
    // Check that jsonToCss maps semantic colors
    assert.ok(html.includes("'bg': '--db-color-bg'"), 'should map bg semantic color');
    assert.ok(html.includes("'text': '--db-color-text'"), 'should map text semantic color');
    assert.ok(html.includes("'accent': '--db-color-accent'"), 'should map accent semantic color');
    // Check component mappings
    assert.ok(html.includes("'--db-btn-bg'"), 'should map button bg');
    assert.ok(html.includes("'--db-card-bg'"), 'should map card bg');
    assert.ok(html.includes("'--db-field-bg'"), 'should map field bg');
  });

  it('should support URL hash sharing via lz-string', () => {
    assert.ok(html.includes('lz-string'), 'should include lz-string library');
    assert.ok(html.includes('compressToEncodedURIComponent'), 'should compress to URL');
    assert.ok(html.includes('decompressFromEncodedURIComponent'), 'should decompress from URL');
  });

  it('should skip [object Object] values from broken shadow extraction', () => {
    assert.ok(html.includes("[object Object]"), 'should check for broken shadow values');
  });

  it('should boost CSS specificity with html[data-theme] selector', () => {
    assert.ok(html.includes("html[data-theme]"), 'should use html[data-theme] for specificity');
  });
});
