#!/usr/bin/env node
/**
 * Visual QA — Analyze rendered screenshots via Gemini Pro (vision)
 * Reads report.csv + screenshots + specs, produces analysis.csv with scores.
 *
 * Usage: GEMINI_API_KEY=... node analyze.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, 'results');
const REPORT_CSV = path.join(RESULTS_DIR, 'report.csv');
const ANALYSIS_CSV = path.join(RESULTS_DIR, 'analysis.csv');
const SPECS_DIR = path.join(RESULTS_DIR, 'specs');
const SCREENSHOTS_DIR = path.join(RESULTS_DIR, 'screenshots');
const HTML_DIR = path.join(RESULTS_DIR, 'html');

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('Error: GEMINI_API_KEY environment variable required');
  process.exit(1);
}

const MODEL = 'gemini-3.1-pro-preview';

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    // QA scores (1-5)
    intent_score:    { type: 'INTEGER', description: '1-5: Does the screenshot match what the prompt asked for? 1=completely wrong output, 5=exactly what was requested' },
    layout_score:    { type: 'INTEGER', description: '1-5: Visual quality — spacing, alignment, hierarchy, nothing overlapping or clipped. 1=broken layout, 5=polished' },
    component_score: { type: 'INTEGER', description: '1-5: Were the right DAUB components chosen? e.g. StatCard for KPIs, Table for tabular data. 1=wrong components, 5=ideal' },
    data_score:      { type: 'INTEGER', description: '1-5: Is sample data realistic? Real names, plausible numbers, proper dates. 1=lorem/empty/placeholder, 5=convincing' },
    // Dev-actionable: who is at fault?
    fault:           { type: 'STRING', enum: ['spec', 'render', 'both', 'none'], description: 'Where is the root cause? spec=LLM generated a bad spec, render=rendering engine bug (correct spec but wrong output), both=issues on both sides, none=looks good' },
    issue_category:  { type: 'STRING', enum: ['layout', 'components', 'data', 'theme', 'empty', 'overflow', 'missing-content', 'perfect'] },
    // Dev feedback
    spec_issues:     { type: 'STRING', description: 'Problems in the LLM-generated spec: wrong component choices, missing elements, bad nesting, unrealistic data. Empty if spec is fine.' },
    render_issues:   { type: 'STRING', description: 'Rendering engine bugs: components not rendering, styling broken, layout collapsed, elements overlapping despite correct spec. Empty if rendering is fine.' },
    improvements:    { type: 'STRING', description: 'Top 1-3 concrete changes that would most improve this output. Be specific: name components, props, or CSS issues.' },
  },
  required: ['intent_score', 'layout_score', 'component_score', 'data_score', 'fault', 'issue_category', 'spec_issues', 'render_issues', 'improvements'],
};

// ---- CSV parsing ----

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function escapeCSV(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function parseReport() {
  const content = fs.readFileSync(REPORT_CSV, 'utf-8');
  const lines = content.trim().split('\n');
  const header = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const row = {};
    header.forEach((h, idx) => row[h] = fields[idx] ?? '');
    rows.push(row);
  }
  return rows;
}

// ---- Gemini API ----

async function callGeminiVision(base64Screenshot, analysisPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'image/png', data: base64Screenshot } },
        { text: analysisPrompt },
      ],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate?.content?.parts?.length) {
    throw new Error('No parts in Gemini response');
  }

  // Debug: log raw parts structure
  if (process.env.DEBUG) {
    console.log('  [debug] parts:', JSON.stringify(candidate.content.parts.map(p => ({
      hasText: !!p.text,
      thought: !!p.thought,
      textLen: p.text?.length,
      preview: p.text?.slice(0, 100),
    }))));
  }

  // With thinking enabled, skip thought parts
  const textParts = candidate.content.parts.filter(p => p.text && !p.thought);
  const textPart = textParts.length ? textParts[textParts.length - 1] : candidate.content.parts.find(p => p.text);
  if (!textPart) throw new Error('No text in Gemini response');

  return JSON.parse(textPart.text);
}

function summarizeSpec(specJson) {
  try {
    const spec = JSON.parse(specJson);
    const els = spec.elements || {};
    const summary = Object.entries(els).map(([id, el]) => {
      const kids = el.children ? ` → [${el.children.join(', ')}]` : '';
      return `  ${id}: ${el.type}${kids}`;
    }).join('\n');
    return `root: ${spec.root}, theme: ${spec.theme || 'default'}\n${summary}`;
  } catch {
    return specJson.slice(0, 2000);
  }
}

function buildAnalysisPrompt(row, specJson, html) {
  const flags = [];
  if (row.has_duplicates === 'true') flags.push('DUPLICATE IDs detected');
  if (row.has_orphans === 'true') flags.push('ORPHAN elements detected');
  if (row.has_empty_containers === 'true') flags.push('EMPTY containers detected');
  if (row.render_errors) flags.push(`Render errors: ${row.render_errors}`);

  const specSummary = summarizeSpec(specJson);

  return `You are a QA engineer reviewing a DAUB UI component library render. Your analysis helps two teams:
1. The SPEC TEAM that improves the LLM prompt/system-prompt for generating specs
2. The RENDER TEAM that maintains the DAUB rendering engine (CSS + JS)

ORIGINAL USER PROMPT: "${row.prompt}"
THEME: ${row.theme}
COMPONENT COUNT: ${row.component_count}

AUTOMATED FLAGS:
${flags.length ? flags.map(f => '- ' + f).join('\n') : '- None'}

SPEC STRUCTURE (component tree):
${specSummary}

RENDERED HTML:
${html}

ANALYSIS INSTRUCTIONS:
1. Score the VISUAL OUTPUT (the screenshot) on 4 quality dimensions (1-5).
2. Determine FAULT — is the problem in the spec (LLM chose wrong components/data) or the render engine (correct spec but broken output)?
   - "spec" fault examples: chose Layout instead of Card, missing components the prompt asked for, lorem ipsum data, wrong theme
   - "render" fault examples: component renders as empty div, styles not applied, layout collapses despite correct spec structure, overlapping elements
   - "both" if there are issues on both sides
   - "none" if output looks good
3. Write separate feedback for each team: spec_issues for the spec team, render_issues for the render team.
4. Give 1-3 specific improvements (name components, props, or CSS).`;
}

// ---- Main ----

async function main() {
  const rows = parseReport();
  console.log(`Loaded ${rows.length} rows from report.csv\n`);

  // Load existing analysis for resumability
  const analyzed = new Map();
  const ANALYSIS_HEADER = 'id,prompt,theme,component_count,spec_file,screenshot_file,html_file,has_duplicates,has_orphans,has_empty_containers,render_errors,intent_score,layout_score,component_score,data_score,fault,issue_category,spec_issues,render_issues,improvements\n';

  try {
    const existing = fs.readFileSync(ANALYSIS_CSV, 'utf-8');
    const lines = existing.trim().split('\n').slice(1);
    for (const line of lines) {
      const id = parseCSVLine(line)[0];
      if (id) analyzed.set(id, line);
    }
    console.log(`Resuming: ${analyzed.size} rows already analyzed\n`);
  } catch {
    fs.writeFileSync(ANALYSIS_CSV, ANALYSIS_HEADER);
  }

  const stats = { total: 0, skipped: 0, success: 0, failed: 0 };
  const scores = { intent: [], layout: [], component: [], data: [] };
  const faults = {};
  const categories = {};

  for (const row of rows) {
    stats.total++;
    const id = row.id;
    const num = String(id).padStart(3, '0');

    // Skip already analyzed
    if (analyzed.has(id)) {
      stats.skipped++;
      // Collect stats from existing row
      const fields = parseCSVLine(analyzed.get(id));
      if (fields.length >= 20) {
        scores.intent.push(Number(fields[11]));
        scores.layout.push(Number(fields[12]));
        scores.component.push(Number(fields[13]));
        scores.data.push(Number(fields[14]));
        faults[fields[15]] = (faults[fields[15]] || 0) + 1;
        categories[fields[16]] = (categories[fields[16]] || 0) + 1;
      }
      continue;
    }

    // Read screenshot
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${num}.png`);
    if (!fs.existsSync(screenshotPath)) {
      console.log(`[${id}] ✗ Screenshot not found, skipping`);
      stats.failed++;
      continue;
    }
    const base64Screenshot = fs.readFileSync(screenshotPath).toString('base64');

    // Read spec
    let specJson = '{}';
    const specPath = path.join(SPECS_DIR, `${num}.json`);
    try {
      specJson = fs.readFileSync(specPath, 'utf-8');
    } catch {}

    // Read HTML (truncated to 8KB)
    let html = '';
    const htmlPath = path.join(HTML_DIR, `${num}.html`);
    try {
      html = fs.readFileSync(htmlPath, 'utf-8');
      if (html.length > 8192) html = html.slice(0, 8192) + '\n... [truncated]';
    } catch {}

    const prompt = buildAnalysisPrompt(row, specJson, html);

    console.log(`[${id}/${rows.length}] ${(row.prompt || '').slice(0, 60)}...`);

    let retries = 0;
    let result = null;

    while (retries < 3 && !result) {
      try {
        result = await callGeminiVision(base64Screenshot, prompt);
      } catch (e) {
        retries++;
        console.log(`  Error: ${e.message.slice(0, 100)}, retry ${retries}`);
        if (e.message.includes('429') || e.message.includes('rate')) {
          console.log('  Rate limited, waiting 30s...');
          await new Promise(r => setTimeout(r, 30000));
        } else {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    if (result) {
      const analysisRow = [
        row.id,
        escapeCSV(row.prompt),
        row.theme,
        row.component_count,
        row.spec_file,
        row.screenshot_file,
        row.html_file,
        row.has_duplicates,
        row.has_orphans,
        row.has_empty_containers,
        escapeCSV(row.render_errors),
        result.intent_score,
        result.layout_score,
        result.component_score,
        result.data_score,
        result.fault,
        result.issue_category,
        escapeCSV(result.spec_issues),
        escapeCSV(result.render_issues),
        escapeCSV(result.improvements),
      ].join(',');

      fs.appendFileSync(ANALYSIS_CSV, analysisRow + '\n');
      analyzed.set(id, analysisRow);

      scores.intent.push(result.intent_score);
      scores.layout.push(result.layout_score);
      scores.component.push(result.component_score);
      scores.data.push(result.data_score);
      faults[result.fault] = (faults[result.fault] || 0) + 1;
      categories[result.issue_category] = (categories[result.issue_category] || 0) + 1;

      console.log(`  ✓ intent:${result.intent_score} layout:${result.layout_score} comp:${result.component_score} data:${result.data_score} | fault:${result.fault} → ${result.issue_category}`);
      stats.success++;
    } else {
      console.log(`  ✗ Failed after ${retries} retries`);
      stats.failed++;
    }

    // 1s delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  // Print summary
  const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 'N/A';

  console.log('\n' + '='.repeat(50));
  console.log('ANALYSIS SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total: ${stats.total} | Analyzed: ${stats.success} | Skipped: ${stats.skipped} | Failed: ${stats.failed}`);
  console.log(`\nAverage Scores:`);
  console.log(`  Intent:    ${avg(scores.intent)} / 5`);
  console.log(`  Layout:    ${avg(scores.layout)} / 5`);
  console.log(`  Component: ${avg(scores.component)} / 5`);
  console.log(`  Data:      ${avg(scores.data)} / 5`);
  console.log(`\nFault Attribution:`);
  for (const [f, count] of Object.entries(faults).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${f}: ${count}`);
  }
  console.log(`\nIssue Categories:`);
  for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log(`\nOutput: ${ANALYSIS_CSV}`);
}

main().catch(e => { console.error(e); process.exit(1); });
