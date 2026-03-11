#!/usr/bin/env node
/**
 * Block Batch Generator — Generate ALL blocks from taxonomy.json
 *
 * Reads blocks/taxonomy.json, checks which blocks already exist on disk,
 * and generates missing ones via OpenRouter. Uses each block's description
 * from the taxonomy as the generation prompt.
 *
 * Usage:
 *   OPENROUTER_API_KEY=... node tools/block-batch-generate.js [--category CATEGORY] [--dry-run] [--force] [--model MODEL] [--concurrency N]
 *
 * Examples:
 *   node tools/block-batch-generate.js                           # Generate all missing blocks
 *   node tools/block-batch-generate.js --category hero           # Only hero blocks
 *   node tools/block-batch-generate.js --category landing --force # Regenerate all landing blocks
 *   node tools/block-batch-generate.js --dry-run                 # Preview what would be generated
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BLOCKS_DIR = path.join(ROOT, 'blocks');
const TAXONOMY_PATH = path.join(BLOCKS_DIR, 'taxonomy.json');
const INDEX_PATH = path.join(BLOCKS_DIR, 'index.json');

// ---- CLI Args ----
const args = process.argv.slice(2);
function getFlag(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}
const filterCategory = getFlag('category', '');
const modelOverride = getFlag('model', '');
const concurrency = parseInt(getFlag('concurrency', '1'));
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey && !dryRun) {
  console.error('Error: OPENROUTER_API_KEY env var required');
  process.exit(1);
}

// ---- Validation (same as block-generate.js) ----

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

function validateSpec(spec) {
  const issues = [];
  if (!spec || typeof spec !== 'object') return { valid: false, issues: ['Not an object'], element_count: 0 };
  if (!spec.elements || typeof spec.elements !== 'object') issues.push('Missing "elements"');
  if (!spec.root) issues.push('Missing "root"');
  if (spec.root && spec.elements && !spec.elements[spec.root]) issues.push(`Root "${spec.root}" not in elements`);
  const componentsUsed = new Set();
  if (spec.elements) {
    for (const [id, def] of Object.entries(spec.elements)) {
      if (!def.type) issues.push(`"${id}" missing type`);
      else {
        componentsUsed.add(def.type);
        if (!VALID_TYPES.has(def.type)) issues.push(`Unknown type "${def.type}"`);
      }
      for (const cid of (def.children || [])) {
        if (!spec.elements[cid]) issues.push(`"${id}" references missing child "${cid}"`);
      }
    }
  }
  return { valid: issues.length === 0, issues, element_count: spec.elements ? Object.keys(spec.elements).length : 0, components_used: [...componentsUsed] };
}

function autoFixSpec(spec) {
  if (!spec || !spec.elements) return spec;
  for (const def of Object.values(spec.elements)) {
    if (def.children) def.children = def.children.filter(cid => !!spec.elements[cid]);
  }
  if (!spec.root || !spec.elements[spec.root]) {
    const ids = Object.keys(spec.elements);
    if (ids.length) spec.root = ids[0];
  }
  return spec;
}

function cleanJSON(raw) {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const idx = s.indexOf('{');
  if (idx > 0) s = s.slice(idx);
  const lastIdx = s.lastIndexOf('}');
  if (lastIdx >= 0 && lastIdx < s.length - 1) s = s.slice(0, lastIdx + 1);
  return s;
}

// ---- System Prompt ----

let buildSystemPrompt;
try {
  const promptModule = await import(path.join(ROOT, 'mcp', 'lib', 'prompt.js'));
  buildSystemPrompt = promptModule.buildSystemPrompt;
} catch {
  console.error('Warning: Could not import mcp/lib/prompt.js, using minimal prompt');
  buildSystemPrompt = () => 'You are a UI generator that outputs json-render flat specs using DAUB components. Return ONLY valid JSON.';
}

// ---- Product/context randomization for variety ----

const PRODUCTS = [
  'SaaS analytics platform', 'project management tool', 'e-commerce marketplace',
  'fintech dashboard', 'health & fitness app', 'education platform', 'CRM system',
  'developer tools platform', 'AI/ML platform', 'cloud storage service',
  'HR management system', 'marketing automation tool', 'design collaboration tool',
  'social media management', 'real estate platform',
];

function randomProduct() {
  return PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
}

// ---- Build prompt from taxonomy block ----

function buildBlockPrompt(blockId, blockDef, category) {
  const product = randomProduct();
  const desc = blockDef.description;
  const variants = blockDef.variants || [];
  const variantHint = variants.length > 0
    ? `\nUse the "${variants[0]}" variant style.`
    : '';

  return `Create a ${desc} for a ${product}.${variantHint}

IMPORTANT: Generate a COMPLETE, production-realistic UI section with 15-40 elements.
Fill tables with 5-8 rows of realistic data. Use real names, numbers, dates — no placeholders.
This is a SECTION/BLOCK, not a full page — it should be a self-contained UI section.
Do NOT include a theme in the output — blocks are theme-agnostic.`;
}

// ---- OpenRouter API ----

async function callOpenRouter(prompt, model) {
  const systemPrompt = buildSystemPrompt(null, prompt);

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://daub.dev',
      'X-Title': 'DAUB Block Batch Generator',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 32768,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    const error = new Error(`OpenRouter ${res.status}: ${err.slice(0, 300)}`);
    error.status = res.status;
    error.retryable = [429, 502, 503, 504].includes(res.status);
    throw error;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content;
}

// ---- Flatten taxonomy into a list of blocks to generate ----

function flattenTaxonomy(taxonomy) {
  const blocks = [];
  for (const [category, catDef] of Object.entries(taxonomy.categories)) {
    for (const [blockId, blockDef] of Object.entries(catDef.blocks)) {
      blocks.push({ id: blockId, category, definition: blockDef });
    }
  }
  return blocks;
}

// ---- Index Management ----

function loadIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8')); }
  catch { return []; }
}

function saveIndex(index) {
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');
}

// ---- Main ----

async function main() {
  const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_PATH, 'utf-8'));
  let allBlocks = flattenTaxonomy(taxonomy);

  if (filterCategory) {
    allBlocks = allBlocks.filter(b => b.category === filterCategory);
  }

  // Check which blocks already exist
  const toGenerate = [];
  const existing = [];

  for (const block of allBlocks) {
    const blockFileId = `${block.id}-01`;
    const filePath = path.join(BLOCKS_DIR, block.category, `${blockFileId}.json`);
    if (fs.existsSync(filePath) && !force) {
      existing.push(block);
    } else {
      toGenerate.push(block);
    }
  }

  console.log(`Taxonomy: ${allBlocks.length} blocks total`);
  console.log(`Existing: ${existing.length} blocks`);
  console.log(`To generate: ${toGenerate.length} blocks`);

  if (dryRun) {
    console.log('\n--- Blocks to generate ---');
    for (const block of toGenerate) {
      console.log(`  [${block.category}] ${block.id}: ${block.definition.description}`);
    }
    return;
  }

  if (toGenerate.length === 0) {
    console.log('Nothing to generate. Use --force to regenerate.');
    return;
  }

  const model = modelOverride || 'google/gemini-3-flash-preview-20251217';
  let index = loadIndex();
  let generated = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < toGenerate.length; i++) {
    const block = toGenerate[i];
    const blockFileId = `${block.id}-01`;
    const categoryDir = path.join(BLOCKS_DIR, block.category);
    const filePath = path.join(categoryDir, `${blockFileId}.json`);
    const relPath = `${block.category}/${blockFileId}.json`;

    fs.mkdirSync(categoryDir, { recursive: true });

    const progress = `[${i + 1}/${toGenerate.length}]`;
    const prompt = buildBlockPrompt(block.id, block.definition, block.category);
    console.log(`${progress} [${block.category}/${block.id}] Generating...`);

    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        const rawContent = await callOpenRouter(prompt, model);
        if (!rawContent) throw new Error('Empty response');

        let spec = JSON.parse(cleanJSON(rawContent));
        delete spec.theme; // Blocks are theme-agnostic

        spec = autoFixSpec(spec);
        const validation = validateSpec(spec);

        if (validation.element_count === 0) {
          throw new Error('Generated spec has no elements');
        }

        if (!validation.valid) {
          console.log(`  ! Validation issues: ${validation.issues.slice(0, 3).join(', ')}${validation.issues.length > 3 ? ` (+${validation.issues.length - 3} more)` : ''}`);
        }

        fs.writeFileSync(filePath, JSON.stringify(spec, null, 2) + '\n');

        const name = block.id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
        const description = block.definition.description;
        const tags = [block.category, ...block.id.split('-')];
        if (block.definition.variants) {
          tags.push(...block.definition.variants.slice(0, 3));
        }

        const indexEntry = {
          id: blockFileId,
          name,
          category: block.category,
          file: relPath,
          description,
          tags: [...new Set(tags)],
          element_count: validation.element_count,
          components_used: validation.components_used,
        };

        const existingIdx = index.findIndex(e => e.id === blockFileId);
        if (existingIdx >= 0) index[existingIdx] = indexEntry;
        else index.push(indexEntry);

        generated++;
        console.log(`  + ${validation.element_count} elements → ${relPath}`);
        break;

      } catch (e) {
        retries++;
        if (e.retryable && retries < maxRetries) {
          const delay = 2000 * Math.pow(2, retries - 1);
          console.log(`  ! Retry ${retries}/${maxRetries} after ${delay}ms: ${e.message.slice(0, 80)}`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          console.log(`  x Failed: ${e.message.slice(0, 120)}`);
          failed++;
          break;
        }
      }
    }

    // Save index periodically (every 10 blocks)
    if ((generated + failed) % 10 === 0) {
      saveIndex(index);
    }

    // Rate limit: small delay between calls
    if (i < toGenerate.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  saveIndex(index);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\nDone: ${generated} generated, ${failed} failed in ${elapsed}s`);
  console.log(`Index: ${INDEX_PATH} (${index.length} total blocks)`);
  console.log(`\nNext steps:`);
  console.log(`  node tools/block-screenshot.js   # Capture screenshots`);
  console.log(`  GEMINI_API_KEY=... node tools/block-embed.js   # Generate embeddings`);
  console.log(`  node tools/block-index-builder.js --stats      # Rebuild index + stats`);
}

main().catch(e => { console.error(e); process.exit(1); });
