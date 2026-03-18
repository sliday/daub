import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Extract chip color HSL values from daub.css
function extractChipColors(css) {
  const re = /\.db-chip--(\w+)\s*\{\s*--db-chip-h:\s*([\d.]+);\s*--db-chip-s:\s*([\d.]+)%;\s*--db-chip-l:\s*([\d.]+)%/g;
  const colors = {};
  let m;
  while ((m = re.exec(css)) !== null) {
    colors[m[1]] = { h: parseFloat(m[2]), s: parseFloat(m[3]), l: parseFloat(m[4]) };
  }
  return colors;
}

// Convert HSL to RGB (0-1 range)
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

// WCAG relative luminance
function luminance(r, g, b) {
  const lin = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

describe('Chip colors — perceptual balance', () => {
  const css = readFileSync('daub.css', 'utf8');
  const colors = extractChipColors(css);
  const names = Object.keys(colors);

  it('should have all 6 chip color variants', () => {
    assert.deepStrictEqual(names.sort(), ['amber', 'blue', 'green', 'pink', 'purple', 'red']);
  });

  it('should have luminance ratio <= 1.5x across all chips', () => {
    const lums = {};
    for (const [name, { h, s, l }] of Object.entries(colors)) {
      const [r, g, b] = hslToRgb(h, s, l);
      lums[name] = luminance(r, g, b);
    }
    const vals = Object.values(lums);
    const ratio = Math.max(...vals) / Math.min(...vals);
    assert.ok(ratio <= 1.5, `Luminance ratio ${ratio.toFixed(2)}x exceeds 1.5x threshold. Values: ${JSON.stringify(lums, null, 2)}`);
  });

  it('each chip luminance should be in 0.10–0.25 range', () => {
    for (const [name, { h, s, l }] of Object.entries(colors)) {
      const [r, g, b] = hslToRgb(h, s, l);
      const lum = luminance(r, g, b);
      assert.ok(lum >= 0.10 && lum <= 0.25,
        `${name} chip luminance ${lum.toFixed(4)} outside 0.10–0.25 range`);
    }
  });
});
