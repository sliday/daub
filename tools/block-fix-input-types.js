#!/usr/bin/env node
/**
 * Fix blocks where duplicate "type" keys caused the HTML input type
 * to overwrite the component type during JSON parsing.
 *
 * Before: { "type": "email", "props": { "placeholder": "..." } }
 * After:  { "type": "Input", "props": { "type": "email", "placeholder": "..." } }
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const BLOCKS_DIR = join(import.meta.dirname, '..', 'blocks');
const HTML_INPUT_TYPES = new Set(['email', 'password', 'text', 'number', 'tel', 'url', 'search', 'date', 'time', 'datetime-local', 'month', 'week', 'color', 'range', 'file', 'hidden']);

function findBlockFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findBlockFiles(full));
    } else if (entry.endsWith('.json') && !['index.json', 'taxonomy.json', 'embeddings.json', 'qa-results.json'].includes(entry)) {
      results.push(full);
    }
  }
  return results;
}

const files = findBlockFiles(BLOCKS_DIR);
let fixedFiles = 0;
let fixedElements = 0;

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const spec = JSON.parse(raw);
  let changed = false;

  for (const [id, element] of Object.entries(spec.elements)) {
    if (HTML_INPUT_TYPES.has(element.type)) {
      const inputType = element.type;
      element.type = 'Input';
      if (element.props) {
        element.props.type = inputType;
      } else {
        element.props = { type: inputType };
      }
      changed = true;
      fixedElements++;
      console.log(`  ${id}: "${inputType}" → Input`);
    }
  }

  if (changed) {
    writeFileSync(file, JSON.stringify(spec, null, 2) + '\n');
    fixedFiles++;
    console.log(`✓ ${relative(BLOCKS_DIR, file)}`);
  }
}

console.log(`\nDone: ${fixedElements} elements fixed in ${fixedFiles} files`);
