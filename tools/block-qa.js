#!/usr/bin/env node
/**
 * Block Visual QA — Send screenshot + spec to Claude for quality review
 *
 * Usage:
 *   OPENROUTER_API_KEY=... node tools/block-qa.js [--category CATEGORY] [--id BLOCK_ID] [--force] [--model MODEL]
 *
 * Examples:
 *   node tools/block-qa.js                          # QA all blocks with screenshots but no QA status
 *   node tools/block-qa.js --category dashboard     # Only dashboard blocks
 *   node tools/block-qa.js --id hero-01             # Specific block
 *   node tools/block-qa.js --force                  # Re-QA all blocks (even already reviewed)
 *
 * Outputs accept/reject/flag status and stores results in blocks/qa-results.json.
 * Only accepted blocks should proceed to embedding.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BLOCKS_DIR = path.join(ROOT, 'blocks');
const INDEX_PATH = path.join(BLOCKS_DIR, 'index.json');
const QA_RESULTS_PATH = path.join(BLOCKS_DIR, 'qa-results.json');

// ---- CLI Args ----
const args = process.argv.slice(2);
function getFlag(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}
const filterCategory = getFlag('category', '');
const filterId = getFlag('id', '');
const force = args.includes('--force');

const qaModel = getFlag('model', 'anthropic/claude-haiku-4-5');
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('Error: OPENROUTER_API_KEY env var required');
  process.exit(1);
}

// ---- Load existing QA results ----

function loadQAResults() {
  try {
    return JSON.parse(fs.readFileSync(QA_RESULTS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveQAResults(results) {
  fs.writeFileSync(QA_RESULTS_PATH, JSON.stringify(results, null, 2) + '\n');
}

// ---- Claude API call with vision ----

async function reviewBlock(screenshotPath, spec, blockId, description) {
  const imageData = fs.readFileSync(screenshotPath);
  const base64Image = imageData.toString('base64');
  const mediaType = 'image/png';

  const specSummary = spec.elements
    ? `${Object.keys(spec.elements).length} elements, types: ${[...new Set(Object.values(spec.elements).map(e => e.type))].join(', ')}`
    : 'No elements';

  const prompt = `You are a UI quality reviewer for DAUB component blocks. Review this screenshot of a rendered UI block.

Block ID: ${blockId}
Description: ${description}
Spec summary: ${specSummary}

Evaluate on these criteria (score 1-5 each):
1. **Layout correctness**: Elements properly aligned, no overlapping, consistent spacing, proper hierarchy
2. **Realistic data**: Sample data looks real (names, numbers, dates), no lorem ipsum or "..." placeholders
3. **Visual quality**: Proper styling, readable text, appropriate colors, no visual glitches
4. **Completeness**: All expected elements present, no empty/blank areas that should have content
5. **Component usage**: Proper use of DAUB components (not misusing types, appropriate nesting)

Respond in this exact JSON format:
{
  "status": "accept" | "reject" | "flag",
  "overall_score": <1-5>,
  "scores": {
    "layout": <1-5>,
    "data": <1-5>,
    "visual": <1-5>,
    "completeness": <1-5>,
    "components": <1-5>
  },
  "issues": ["issue1", "issue2"],
  "notes": "brief summary"
}

Rules:
- "accept": overall_score >= 3 and no score below 2
- "reject": overall_score < 3 or any score is 1
- "flag": borderline cases worth manual review

Return ONLY the JSON object.`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://daub.dev',
      'X-Title': 'DAUB Block QA',
    },
    body: JSON.stringify({
      model: qaModel,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mediaType};base64,${base64Image}` },
          },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content in response');

  // Parse JSON from response
  let cleaned = content.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleaned);
}

// ---- Main ----

async function main() {
  // Load index
  let index;
  try {
    index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  } catch {
    console.error('Error: blocks/index.json not found');
    process.exit(1);
  }

  const qaResults = loadQAResults();

  // Filter blocks
  let blocks = index;
  if (filterCategory) blocks = blocks.filter(b => b.category === filterCategory);
  if (filterId) blocks = blocks.filter(b => b.id === filterId);

  // Only blocks with screenshots
  blocks = blocks.filter(b => {
    const pngPath = path.join(BLOCKS_DIR, b.category, `${b.id}.png`);
    return fs.existsSync(pngPath);
  });

  // Skip already reviewed (unless --force)
  if (!force) {
    blocks = blocks.filter(b => !qaResults[b.id]);
  }

  if (blocks.length === 0) {
    console.log('No blocks to review. Ensure screenshots exist (run block-screenshot.js) or use --force.');

    // Print summary of existing results
    const total = Object.keys(qaResults).length;
    if (total > 0) {
      const accepted = Object.values(qaResults).filter(r => r.status === 'accept').length;
      const rejected = Object.values(qaResults).filter(r => r.status === 'reject').length;
      const flagged = Object.values(qaResults).filter(r => r.status === 'flag').length;
      console.log(`\nExisting QA results: ${accepted} accepted, ${rejected} rejected, ${flagged} flagged (${total} total)`);
    }
    return;
  }

  console.log(`Reviewing ${blocks.length} blocks via Claude Vision\n`);

  let accepted = 0, rejected = 0, flagged = 0, errors = 0;

  for (const block of blocks) {
    const pngPath = path.join(BLOCKS_DIR, block.category, `${block.id}.png`);
    const specPath = path.join(BLOCKS_DIR, block.file);

    try {
      const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
      const result = await reviewBlock(pngPath, spec, block.id, block.description || '');

      qaResults[block.id] = {
        ...result,
        reviewed_at: new Date().toISOString(),
      };

      const icon = result.status === 'accept' ? '+' : result.status === 'reject' ? 'x' : '?';
      const scoreStr = result.scores
        ? `L:${result.scores.layout} D:${result.scores.data} V:${result.scores.visual} C:${result.scores.completeness} U:${result.scores.components}`
        : '';
      console.log(`  ${icon} [${block.id}] ${result.status} (${result.overall_score}/5) ${scoreStr}`);

      if (result.issues?.length > 0) {
        console.log(`    Issues: ${result.issues.join('; ')}`);
      }

      if (result.status === 'accept') accepted++;
      else if (result.status === 'reject') rejected++;
      else flagged++;

      // Rate limiting - small delay between calls
      await new Promise(r => setTimeout(r, 500));

    } catch (e) {
      console.log(`  x [${block.id}] Error: ${e.message}`);
      errors++;
    }
  }

  saveQAResults(qaResults);

  console.log(`\nDone: ${accepted} accepted, ${rejected} rejected, ${flagged} flagged, ${errors} errors`);
  console.log(`Results: ${QA_RESULTS_PATH}`);
}

main().catch(e => { console.error(e); process.exit(1); });
