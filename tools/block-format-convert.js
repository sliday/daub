#!/usr/bin/env node
/**
 * Convert DAUB block specs from flat format to props format.
 *
 * Flat:  { "type": "Text", "tag": "h2", "content": "Hello" }
 * Props: { "type": "Text", "props": { "tag": "h2", "content": "Hello" } }
 *
 * The renderer expects the props wrapper. Blocks without it render as blank.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const BLOCKS_DIR = join(import.meta.dirname, '..', 'blocks');
const RESERVED_KEYS = new Set(['type', 'props', 'children']);

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

function needsConversion(element) {
  // Already has props wrapper
  if (element.props) return false;
  // Check if there are any non-reserved keys that should be in props
  return Object.keys(element).some(k => !RESERVED_KEYS.has(k));
}

function convertElement(element) {
  if (!needsConversion(element)) return element;

  const converted = { type: element.type };
  const props = {};

  for (const [key, value] of Object.entries(element)) {
    if (RESERVED_KEYS.has(key)) {
      converted[key] = value;
    } else {
      props[key] = value;
    }
  }

  if (Object.keys(props).length > 0) {
    // Insert props right after type
    const result = { type: converted.type };
    result.props = props;
    if (converted.children) result.children = converted.children;
    return result;
  }

  return converted;
}

function convertSpec(spec) {
  const converted = { root: spec.root, elements: {} };
  let changed = false;

  for (const [id, element] of Object.entries(spec.elements)) {
    const before = JSON.stringify(element);
    converted.elements[id] = convertElement(element);
    if (JSON.stringify(converted.elements[id]) !== before) changed = true;
  }

  return { spec: converted, changed };
}

// Main
const files = findBlockFiles(BLOCKS_DIR);
let convertedCount = 0;
let skippedCount = 0;

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const spec = JSON.parse(raw);

  const { spec: converted, changed } = convertSpec(spec);

  if (changed) {
    writeFileSync(file, JSON.stringify(converted, null, 2) + '\n');
    convertedCount++;
    console.log(`✓ ${relative(BLOCKS_DIR, file)}`);
  } else {
    skippedCount++;
  }
}

console.log(`\nDone: ${convertedCount} converted, ${skippedCount} already in props format`);
