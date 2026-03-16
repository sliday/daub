#!/usr/bin/env node
/**
 * Fixes WCAG contrast failures in daub.css by adjusting --db-warm-gray
 * (and other failing colors) to meet AA ratios.
 * No shell execution — pure CSS parsing and color math.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(__dirname, '../daub.css');
let css = readFileSync(cssPath, 'utf8');

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
}

function rgbToHex([r,g,b]) {
  return '#' + [r,g,b].map(c => c.toString(16).padStart(2,'0')).join('').toUpperCase();
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
  return (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
}

function hslToRgb(h, s, l) {
  h = h / 360; s = s / 100; l = l / 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function adjustForContrast(fgHex, bgHex, targetRatio) {
  const bg = hexToRgb(bgHex);
  const fg = hexToRgb(fgHex);
  const bgLum = luminance(bg);
  const [h, s, l] = rgbToHsl(fg);
  const isDarkBg = bgLum < 0.18;

  let lo, hi;
  if (isDarkBg) { lo = l; hi = 95; }
  else { lo = 5; hi = l; }

  let bestHex = fgHex;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const rgb = hslToRgb(h, s, mid);
    const ratio = contrastRatio(rgb, bg);
    if (ratio >= targetRatio) {
      bestHex = rgbToHex(rgb);
      if (isDarkBg) { hi = mid; }
      else { lo = mid; }
    } else {
      if (isDarkBg) { lo = mid; }
      else { hi = mid; }
    }
  }
  return bestHex;
}

const themeBlockRe = /(\[data-theme="([^"]+)"\]\s*\{)([\s\S]*?)(\})/g;
const rootBlockRe = /(:root\s*\{)([\s\S]*?)(\})/;

const rootBlock = css.match(rootBlockRe);
const rootVars = {};
if (rootBlock) {
  const re = /--db-([\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(rootBlock[2]))) rootVars[m[1]] = m[2].trim();
}

let fixes = 0;

function fixBlock(block, themeName) {
  const vars = { ...rootVars };
  const re2 = /--db-([\w-]+)\s*:\s*([^;]+);/g;
  let m2;
  while ((m2 = re2.exec(block))) vars[m2[1]] = m2[2].trim();

  let newBlock = block;
  const cream = vars['cream'];
  const creamDark = vars['cream-dark'];
  const warmGray = vars['warm-gray'];

  if (!cream || !warmGray || !cream.startsWith('#') || !warmGray.startsWith('#')) return block;

  const ratio1 = contrastRatio(hexToRgb(warmGray), hexToRgb(cream));
  if (ratio1 < 4.5) {
    // Find value that meets 4.7:1 against the harder background (cream or cream-dark)
    let targetBg = cream;
    if (creamDark && creamDark.startsWith('#')) {
      const bgLum1 = luminance(hexToRgb(cream));
      const bgLum2 = luminance(hexToRgb(creamDark));
      const fgLum = luminance(hexToRgb(warmGray));
      // Pick the bg closer to fg luminance (harder to contrast against)
      if (Math.abs(fgLum - bgLum2) < Math.abs(fgLum - bgLum1)) {
        targetBg = creamDark;
      }
    }
    const fixed = adjustForContrast(warmGray, targetBg, 4.7);
    const escaped = warmGray.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    newBlock = newBlock.replace(
      new RegExp(`(--db-warm-gray\\s*:\\s*)${escaped}(\\s*;)`),
      `$1${fixed}$2`
    );
    console.log(`  ${themeName}: --db-warm-gray ${warmGray} -> ${fixed}`);
    fixes++;
  }

  // Fix terracotta on cream (need 3:1)
  const terracotta = vars['terracotta'];
  if (terracotta && terracotta.startsWith('#') && cream.startsWith('#')) {
    const ratioT = contrastRatio(hexToRgb(terracotta), hexToRgb(cream));
    if (ratioT < 3.0) {
      const fixedT = adjustForContrast(terracotta, cream, 3.2);
      const escaped = terracotta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      newBlock = newBlock.replace(
        new RegExp(`(--db-terracotta\\s*:\\s*)${escaped}(\\s*;)`),
        `$1${fixedT}$2`
      );
      console.log(`  ${themeName}: --db-terracotta ${terracotta} -> ${fixedT}`);
      fixes++;
    }
  }

  // Fix charcoal on cream (need 4.5:1)
  const charcoal = vars['charcoal'];
  if (charcoal && charcoal.startsWith('#') && cream.startsWith('#')) {
    const ratioC = contrastRatio(hexToRgb(charcoal), hexToRgb(cream));
    if (ratioC < 4.5) {
      const fixedC = adjustForContrast(charcoal, cream, 4.7);
      const escaped = charcoal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      newBlock = newBlock.replace(
        new RegExp(`(--db-charcoal\\s*:\\s*)${escaped}(\\s*;)`),
        `$1${fixedC}$2`
      );
      console.log(`  ${themeName}: --db-charcoal ${charcoal} -> ${fixedC}`);
      fixes++;
    }
  }

  return newBlock;
}

// Fix :root block
if (rootBlock) {
  const fixedRoot = fixBlock(rootBlock[2], ':root');
  css = css.replace(rootBlock[2], fixedRoot);
}

// Fix theme blocks
css = css.replace(themeBlockRe, (full, prefix, name, body, suffix) => {
  const fixedBody = fixBlock(body, name);
  return prefix + fixedBody + suffix;
});

writeFileSync(cssPath, css, 'utf8');
console.log(`\nApplied ${fixes} fixes.`);
