#!/usr/bin/env node
/**
 * WCAG 2.1 contrast audit for DAUB theme colors.
 * Parses daub.css, extracts theme color pairs, reports failures.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(__dirname, '../daub.css'), 'utf8');

/* ---- Color math ---- */
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
}

function srgbToLinear(c) {
  c = c / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance([r,g,b]) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(c1, c2) {
  const l1 = luminance(c1), l2 = luminance(c2);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/* ---- Parse themes ---- */
const themeRe = /\[data-theme="([^"]+)"\]\s*\{([^}]+)\}/g;
const rootMatch = css.match(/:root\s*\{([^}]+)\}/);

function extractVars(block) {
  const vars = {};
  const re = /--db-([\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block))) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

const rootVars = rootMatch ? extractVars(rootMatch[1]) : {};

const themes = [{ name: 'default (light)', vars: rootVars }];
let tm;
while ((tm = themeRe.exec(css))) {
  themes.push({ name: tm[1], vars: { ...rootVars, ...extractVars(tm[2]) } });
}

/* ---- Audit pairs ---- */
const pairs = [
  { fg: 'ink',        bg: 'cream',      label: 'ink on cream (body text)',           aa: 4.5 },
  { fg: 'charcoal',   bg: 'cream',      label: 'charcoal on cream (headings)',       aa: 4.5 },
  { fg: 'warm-gray',  bg: 'cream',      label: 'warm-gray on cream (secondary)',     aa: 4.5 },
  { fg: 'terracotta', bg: 'cream',      label: 'terracotta on cream (accent)',       aa: 3.0 },
  { fg: 'ink',        bg: 'cream-dark',  label: 'ink on cream-dark (surface)',        aa: 4.5 },
  { fg: 'warm-gray',  bg: 'cream-dark',  label: 'warm-gray on cream-dark (surface secondary)', aa: 4.5 },
];

let failures = 0;
let warnings = 0;

console.log('WCAG 2.1 Contrast Audit — DAUB Themes\n' + '='.repeat(50));

for (const theme of themes) {
  const results = [];
  for (const pair of pairs) {
    const fgHex = theme.vars[pair.fg];
    const bgHex = theme.vars[pair.bg];
    if (!fgHex || !bgHex) continue;
    if (!fgHex.startsWith('#') || !bgHex.startsWith('#')) continue;

    const fg = hexToRgb(fgHex);
    const bg = hexToRgb(bgHex);
    const ratio = contrastRatio(fg, bg);
    const pass = ratio >= pair.aa;

    if (!pass) {
      results.push({ ...pair, ratio, fgHex, bgHex, pass });
      failures++;
    } else if (ratio < pair.aa + 0.5) {
      results.push({ ...pair, ratio, fgHex, bgHex, pass, borderline: true });
      warnings++;
    }
  }

  if (results.length) {
    console.log(`\n[${theme.name}]`);
    for (const r of results) {
      const status = r.pass ? (r.borderline ? 'WARN' : 'PASS') : 'FAIL';
      const icon = r.pass ? (r.borderline ? '!! ' : 'OK') : 'XX';
      console.log(`  ${icon} ${status} ${r.ratio.toFixed(2)}:1 (need ${r.aa}:1) -- ${r.label} [${r.fgHex} on ${r.bgHex}]`);
    }
  }
}

console.log('\n' + '='.repeat(50));
console.log(`Themes: ${themes.length} | Failures: ${failures} | Warnings: ${warnings}`);
if (failures === 0) {
  console.log('All themes pass WCAG AA!');
} else {
  console.log(`\n${failures} failure(s) need fixing.`);
  process.exit(1);
}
