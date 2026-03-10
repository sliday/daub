#!/usr/bin/env node
/**
 * Block Embedding — Multimodal embeddings via gemini-embedding-2-preview
 *
 * Embeds each block as: screenshot PNG + description text + tags → ONE aggregated vector.
 * Cross-modal search: text queries find visually similar blocks because all modalities
 * share the same embedding space.
 *
 * Usage:
 *   GEMINI_API_KEY=... node tools/block-embed.js [--force] [--id BLOCK_ID] [--dims 768]
 *
 * Examples:
 *   node tools/block-embed.js                  # Embed all blocks with screenshots
 *   node tools/block-embed.js --force           # Re-embed all
 *   node tools/block-embed.js --id hero-01     # Specific block
 *   node tools/block-embed.js --qa-only         # Only QA-accepted blocks
 *
 * Requires GEMINI_API_KEY (gemini-embedding-2-preview is Google-only, not on OpenRouter).
 * Outputs blocks/embeddings.json: { "block-id": [0.123, ...], ... }
 *
 * Memory budget:
 *   1,000 blocks x 768 dims x 4 bytes = ~3 MB
 *   10,000 blocks x 768 dims x 4 bytes = ~30 MB
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BLOCKS_DIR = path.join(ROOT, 'blocks');
const INDEX_PATH = path.join(BLOCKS_DIR, 'index.json');
const EMBEDDINGS_PATH = path.join(BLOCKS_DIR, 'embeddings.json');

// ---- CLI Args ----
const args = process.argv.slice(2);
function getFlag(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}
const force = args.includes('--force');
const filterId = getFlag('id', '');
const outputDims = parseInt(getFlag('dims', '768'));
const qaOnly = args.includes('--qa-only');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Error: GEMINI_API_KEY env var required (gemini-embedding-2-preview is Google-only)');
  process.exit(1);
}

const MODEL = 'gemini-embedding-2-preview';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent`;

// ---- Build text part for embedding ----

function buildEmbeddingText(block, spec) {
  const parts = [];
  if (block.description) parts.push(block.description);
  parts.push(`Category: ${block.category}`);
  if (block.subcategory) parts.push(`Subcategory: ${block.subcategory}`);
  if (block.tags?.length) parts.push(`Tags: ${block.tags.join(', ')}`);
  if (block.components_used?.length) {
    parts.push(`Components: ${block.components_used.join(', ')}`);
  }
  // Extract key text content from spec
  if (spec?.elements) {
    const textContent = [];
    for (const el of Object.values(spec.elements)) {
      const p = el.props;
      if (p?.content && typeof p.content === 'string') textContent.push(p.content);
      if (p?.title && typeof p.title === 'string') textContent.push(p.title);
      if (p?.label && typeof p.label === 'string') textContent.push(p.label);
      if (p?.description && typeof p.description === 'string') textContent.push(p.description);
    }
    if (textContent.length > 0) {
      const unique = [...new Set(textContent)].slice(0, 20);
      parts.push(`Content: ${unique.join('. ')}`);
    }
  }
  return parts.join('\n');
}

// ---- Multimodal Gemini Embedding ----

async function embedBlock(textDescription, screenshotPath) {
  // Build content parts: text + image (multimodal aggregated embedding)
  const contentParts = [{ text: textDescription }];

  if (screenshotPath && fs.existsSync(screenshotPath)) {
    const imageData = fs.readFileSync(screenshotPath);
    const base64Image = imageData.toString('base64');
    contentParts.push({
      inline_data: {
        mime_type: 'image/png',
        data: base64Image,
      },
    });
  }

  const res = await fetch(`${API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskType: 'RETRIEVAL_DOCUMENT',
      content: { parts: contentParts },
      output_dimensionality: outputDims,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const values = data.embedding?.values;
  if (!values) throw new Error('No embedding values in response');

  return normalizeVector(values);
}

// ---- Vector math ----

function normalizeVector(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map(v => v / norm);
}

function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// ---- Main ----

async function main() {
  let index;
  try {
    index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  } catch {
    console.error('Error: blocks/index.json not found');
    process.exit(1);
  }

  let qaResults = {};
  if (qaOnly) {
    try {
      qaResults = JSON.parse(fs.readFileSync(path.join(BLOCKS_DIR, 'qa-results.json'), 'utf-8'));
    } catch {
      console.error('Error: qa-results.json not found. Run block-qa.js first.');
      process.exit(1);
    }
  }

  let embeddings = {};
  try {
    embeddings = JSON.parse(fs.readFileSync(EMBEDDINGS_PATH, 'utf-8'));
  } catch {}

  let blocks = index;
  if (filterId) blocks = blocks.filter(b => b.id === filterId);
  if (qaOnly) blocks = blocks.filter(b => qaResults[b.id]?.status === 'accept');
  if (!force) blocks = blocks.filter(b => !embeddings[b.id]);

  if (blocks.length === 0) {
    console.log(`No blocks to embed. ${Object.keys(embeddings).length} already embedded.`);
    return;
  }

  console.log(`Embedding ${blocks.length} blocks via ${MODEL} (${outputDims} dims, multimodal)\n`);

  let embedded = 0;
  let failed = 0;
  let withImage = 0;

  for (const block of blocks) {
    try {
      const specPath = path.join(BLOCKS_DIR, block.file);
      let spec = null;
      try { spec = JSON.parse(fs.readFileSync(specPath, 'utf-8')); } catch {}

      const text = buildEmbeddingText(block, spec);
      const screenshotPath = path.join(BLOCKS_DIR, block.category, `${block.id}.png`);
      const hasImage = fs.existsSync(screenshotPath);

      const vector = await embedBlock(text, hasImage ? screenshotPath : null);

      embeddings[block.id] = vector;
      embedded++;
      if (hasImage) withImage++;

      console.log(`  + [${block.id}] ${vector.length}d ${hasImage ? '(image+text)' : '(text-only)'}`);

      // Rate limiting (Gemini embedding API has generous limits but be polite)
      await new Promise(r => setTimeout(r, 300));

    } catch (e) {
      console.log(`  x [${block.id}] Error: ${e.message}`);
      failed++;
    }
  }

  fs.writeFileSync(EMBEDDINGS_PATH, JSON.stringify(embeddings) + '\n');

  const totalSize = Buffer.byteLength(JSON.stringify(embeddings));
  console.log(`\nDone: ${embedded} embedded (${withImage} with image), ${failed} failed`);
  console.log(`Embeddings: ${EMBEDDINGS_PATH} (${Object.keys(embeddings).length} blocks, ${(totalSize / 1024).toFixed(1)} KB)`);
}

main().catch(e => { console.error(e); process.exit(1); });

export { cosineSimilarity, normalizeVector, buildEmbeddingText };
