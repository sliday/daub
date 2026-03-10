#!/usr/bin/env node
/**
 * Block Index Builder — Scan blocks/ directory and rebuild blocks/index.json
 *
 * Usage:
 *   node tools/block-index-builder.js [--embed] [--clean]
 *
 * Options:
 *   --clean    Remove index entries for blocks whose JSON files no longer exist
 *   --embed    After rebuilding index, run block-embed.js to regenerate embeddings
 *   --stats    Print detailed statistics about the block library
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BLOCKS_DIR = path.join(ROOT, 'blocks');
const INDEX_PATH = path.join(BLOCKS_DIR, 'index.json');

const args = process.argv.slice(2);
const doClean = args.includes('--clean');
const doEmbed = args.includes('--embed');
const doStats = args.includes('--stats');

// ---- Validation ----

const VALID_TYPES = new Set([
  'Stack', 'Grid', 'Surface', 'Text', 'Prose', 'Separator',
  'Button', 'ButtonGroup', 'Field', 'Input', 'InputGroup', 'InputIcon', 'Search', 'Textarea',
  'Checkbox', 'RadioGroup', 'Switch', 'Slider', 'Toggle', 'ToggleGroup', 'Select', 'CustomSelect',
  'Kbd', 'Label', 'Spinner', 'InputOTP',
  'Tabs', 'Breadcrumbs', 'Pagination', 'Stepper', 'NavMenu', 'Navbar', 'Menubar', 'Sidebar', 'BottomNav',
  'Card', 'Table', 'DataTable', 'List', 'Badge', 'Avatar', 'AvatarGroup', 'Calendar', 'Chart', 'Carousel',
  'AspectRatio', 'Chip', 'ScrollArea', 'Image',
  'Alert', 'Progress', 'Skeleton', 'EmptyState', 'Tooltip',
  'Modal', 'AlertDialog', 'Sheet', 'Drawer', 'Popover', 'HoverCard', 'DropdownMenu', 'ContextMenu', 'CommandPalette',
  'Accordion', 'Collapsible', 'Resizable', 'DatePicker',
  'StatCard', 'ChartCard', 'CustomHTML',
]);

function analyzeSpec(spec) {
  const componentsUsed = new Set();
  let elementCount = 0;
  if (spec.elements) {
    elementCount = Object.keys(spec.elements).length;
    for (const def of Object.values(spec.elements)) {
      if (def.type) componentsUsed.add(def.type);
    }
  }
  return { element_count: elementCount, components_used: [...componentsUsed] };
}

// ---- Scan disk for block JSON files ----

function scanBlocks() {
  const blocks = [];
  const categories = fs.readdirSync(BLOCKS_DIR).filter(f => {
    const stat = fs.statSync(path.join(BLOCKS_DIR, f));
    return stat.isDirectory() && f !== 'node_modules';
  });

  for (const category of categories) {
    const catDir = path.join(BLOCKS_DIR, category);
    const files = fs.readdirSync(catDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(catDir, file);
      try {
        const spec = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const id = file.replace('.json', '');
        const analysis = analyzeSpec(spec);
        const pngExists = fs.existsSync(path.join(catDir, `${id}.png`));

        // Parse subcategory from id (e.g. "sidebar-layout-01" -> "sidebar-layout")
        const parts = id.split('-');
        const variantNum = parts[parts.length - 1];
        const subcategory = parts.slice(0, -1).join('-');

        blocks.push({
          id,
          category,
          subcategory: subcategory || id,
          file: `${category}/${file}`,
          screenshot: pngExists ? `${category}/${id}.png` : undefined,
          element_count: analysis.element_count,
          components_used: analysis.components_used,
        });
      } catch (e) {
        console.warn(`  ! Skipping ${category}/${file}: ${e.message}`);
      }
    }
  }

  return blocks;
}

// ---- Merge with existing index (preserve descriptions, tags, etc.) ----

function mergeIndex(diskBlocks, existingIndex) {
  const existingMap = new Map(existingIndex.map(e => [e.id, e]));
  const merged = [];

  for (const block of diskBlocks) {
    const existing = existingMap.get(block.id);
    if (existing) {
      merged.push({
        ...existing,
        file: block.file,
        screenshot: block.screenshot || existing.screenshot,
        element_count: block.element_count,
        components_used: block.components_used,
      });
    } else {
      const name = block.subcategory.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      merged.push({
        ...block,
        name,
        description: `${name} block for ${block.category}`,
        tags: [block.category, ...block.subcategory.split('-')],
      });
    }
  }

  return merged;
}

// ---- Stats ----

function printStats(index) {
  const byCategory = {};
  const allComponents = new Set();
  let totalElements = 0;
  let withScreenshots = 0;

  for (const block of index) {
    (byCategory[block.category] = byCategory[block.category] || []).push(block);
    totalElements += block.element_count || 0;
    if (block.screenshot) withScreenshots++;
    for (const c of (block.components_used || [])) allComponents.add(c);
  }

  console.log('\n--- Block Library Statistics ---');
  console.log(`Total blocks: ${index.length}`);
  console.log(`Total elements: ${totalElements}`);
  console.log(`With screenshots: ${withScreenshots}`);
  console.log(`Unique components used: ${allComponents.size}`);
  console.log(`\nBy category:`);
  for (const [cat, blocks] of Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length)) {
    const subcats = new Set(blocks.map(b => b.subcategory));
    console.log(`  ${cat}: ${blocks.length} blocks (${subcats.size} subcategories)`);
  }

  const embeddingsPath = path.join(BLOCKS_DIR, 'embeddings.json');
  if (fs.existsSync(embeddingsPath)) {
    try {
      const embeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf-8'));
      const embeddedCount = Object.keys(embeddings).length;
      console.log(`\nEmbeddings: ${embeddedCount}/${index.length} blocks embedded`);
      const missing = index.filter(b => !embeddings[b.id]);
      if (missing.length > 0) {
        console.log(`Missing embeddings: ${missing.map(b => b.id).join(', ')}`);
      }
    } catch {}
  } else {
    console.log('\nEmbeddings: none (run block-embed.js)');
  }
}

// ---- Main ----

async function main() {
  console.log('Scanning blocks/ directory...');

  const diskBlocks = scanBlocks();
  console.log(`Found ${diskBlocks.length} block files on disk`);

  let existingIndex = [];
  try {
    existingIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  } catch {}

  let newIndex;
  if (doClean) {
    newIndex = mergeIndex(diskBlocks, existingIndex);
    const removed = existingIndex.length - newIndex.length;
    if (removed > 0) console.log(`Cleaned ${removed} stale entries`);
  } else {
    newIndex = mergeIndex(diskBlocks, existingIndex);
  }

  newIndex.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));

  fs.writeFileSync(INDEX_PATH, JSON.stringify(newIndex, null, 2) + '\n');
  console.log(`Index written: ${INDEX_PATH} (${newIndex.length} blocks)`);

  if (doStats) printStats(newIndex);

  if (doEmbed) {
    console.log('\nRunning embedding generation...');
    try {
      execFileSync('node', ['tools/block-embed.js'], { cwd: ROOT, stdio: 'inherit' });
    } catch (e) {
      console.error('Embedding failed:', e.message);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
