import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const output = dirname(fileURLToPath(import.meta.url));
const root = resolve(output, '../..');
const read = async name => JSON.parse(await readFile(resolve(output, name), 'utf8'));
const { results, circuit } = await read('results.json');
const manifest = await read('manifest.json');
let interactions = [];
try { interactions = await read('interactions.json'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const rows = [];
for (const r of results) {
  const spec = r.hasSpec ? await read(`${r.id}/spec.json`) : null;
  const nodes = Object.entries(spec?.elements || {});
  const refs = node => {
    const children = [...(node.children || node.props?.children || [])];
    if (node.type === 'Button' && typeof node.props?.trigger === 'string') children.push(node.props.trigger);
    const slots = node.type === 'Frame' ? ['header', 'footer'] : node.type === 'PreviewCard' ? ['trigger', 'media'] : ['Card', 'Modal', 'AlertDialog'].includes(node.type) ? ['footer'] : [];
    for (const slot of slots) if (Array.isArray(node.props?.[slot])) children.push(...node.props[slot]);
    if (node.type === 'Accordion') for (const item of node.props?.items || []) children.push(...(item.children || []));
    return children;
  };
  const reachable = new Set(), cycles = [], dangling = [];
  const visit = (id, ancestors = new Set()) => {
    if (ancestors.has(id)) { cycles.push(id); return; }
    if (reachable.has(id) || !spec?.elements[id]) return;
    reachable.add(id);
    for (const child of refs(spec.elements[id])) visit(child, new Set([...ancestors, id]));
  };
  if (spec) visit(spec.root);
  for (const [id, node] of nodes) for (const child of refs(node)) if (!spec.elements[child]) dangling.push({ parent: id, child });
  const interaction = interactions.find(x => x.id === r.id);
  const views = Object.fromEntries([1200, 390].map(width => {
    const view = interaction?.views?.[width];
    const checks = view?.checks || [];
    const required = checks.filter(c => !c.optional);
    const errors = [...(view?.errors || []), ...(view?.after?.exportRuntime?.errors || [])];
    return [width, { checks, errors, verdict: !required.length || view?.harnessError || view?.captureError ? 'unverified' : required.some(c => c.pass === false) ? 'fail' : required.some(c => c.pass !== true) ? 'unverified' : 'pass' }];
  }));
  rows.push({ id: r.id, mode: r.mode, prompt: r.prompt, seconds: r.ms / 1000,
    hasSpec: !!spec, elements: nodes.length, htmlBytes: r.htmlBytes || 0,
    structure: { rootValid: !!spec?.elements?.[spec.root], cycles, dangling, unreachable: nodes.map(([id]) => id).filter(id => !reachable.has(id)) },
    models: [...new Set(r.requests.map(x => x.model).filter(Boolean))], requests: r.requests.length,
    recordedCost: r.requests.reduce((sum, x) => sum + (x.usage?.cost || 0), 0),
    missingCost: r.requests.filter(x => typeof x.usage?.cost !== 'number').length,
    tokens: r.requests.reduce((sum, x) => sum + (x.usage?.total_tokens || (x.usage?.input_tokens || 0) + (x.usage?.output_tokens || 0)), 0),
    overflow: Object.fromEntries(Object.entries(r.views || {}).map(([width, view]) => [width, view.horizontalOverflow])),
    renderErrors: Object.entries(r.views || {}).flatMap(([width, view]) => [...(view.errors || []), ...(view.renderErrors || [])].map(error => ({ width, error }))),
    brokenImages: Object.entries(r.views || {}).flatMap(([width, view]) => (view.brokenImages || []).map(image => ({ width, image }))),
    status: r.status, error: r.error, stopped: !!r.stopped, harnessError: r.harnessError,
    hybrid: r.hybrid ? { reason: r.hybrid.reason, error: r.hybrid.error, finishRejection: r.hybrid.finishRejection } : null,
    views, taskVerdict: Object.values(views).some(v => v.verdict === 'fail') ? 'fail' : Object.values(views).every(v => v.verdict === 'pass') ? 'pass' : 'unverified',
    outputApiPresent: !!spec?.hybrid?.program?.output,
    outputApiVerified: !!spec?.hybrid?.program?.output && Object.values(views).every(view => view.checks.some(check => check.optional && /output/i.test(check.name) && check.pass === true)),
  });
}
const median = values => { const a = [...values].sort((x, y) => x - y); return a.length ? (a[Math.floor((a.length - 1) / 2)] + a[Math.ceil((a.length - 1) / 2)]) / 2 : null; };
const groups = Object.fromEntries(['direct', 'hybrid'].map(mode => {
  const runs = rows.filter(r => r.mode === mode);
  return [mode, { runs: runs.length, exports: runs.filter(r => r.hasSpec && r.htmlBytes).length,
    taskPass: runs.filter(r => r.taskVerdict === 'pass').length, taskFail: runs.filter(r => r.taskVerdict === 'fail').length, taskUnverified: runs.filter(r => r.taskVerdict === 'unverified').length,
    medianSeconds: median(runs.map(r => r.seconds)), requests: runs.reduce((n, r) => n + r.requests, 0),
    recordedCost: runs.reduce((n, r) => n + r.recordedCost, 0), missingCost: runs.reduce((n, r) => n + r.missingCost, 0),
    tokens: runs.reduce((n, r) => n + r.tokens, 0),
    overflowRuns: runs.filter(r => Object.values(r.overflow).some(Boolean)).length,
    runtimeErrorRuns: runs.filter(r => r.renderErrors.length || Object.values(r.views).some(v => v.errors.length)).length,
    outputPrograms: runs.filter(r => r.outputApiPresent).length, verifiedOutputRuns: runs.filter(r => r.outputApiVerified).length }];
}));
const hashesMatch = {};
for (const [file, hash] of Object.entries(manifest.hashes)) hashesMatch[file] = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex') === hash;
const environment = await read('environment.json');
for (const [file, hash] of Object.entries(environment.hashes)) hashesMatch[file] = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex') === hash;
await writeFile(resolve(output, 'summary.json'), JSON.stringify({ groups, circuit, hashesMatch, rows }, null, 2));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sections = manifest.prompts.map((prompt, i) => {
  const n = String(i + 1).padStart(2, '0');
  return `<section id="pair-${n}"><h2>${n}. ${esc(prompt)}</h2><div class="pair">${['direct', 'hybrid'].map(mode => {
    const r = rows.find(row => row.id === `${n}-${mode}`);
    if (!r) return `<article><h3>${mode}</h3><p>Pending</p></article>`;
    return `<article><h3>${mode === 'direct' ? 'Direct' : 'Hybrid'} <small>${r.seconds.toFixed(1)}s / ${r.elements} elements / ${r.requests} requests</small></h3><p><strong>Task: ${r.taskVerdict}</strong> | Overflow: ${Object.entries(r.overflow).filter(([,v]) => v).map(([w]) => w).join(', ') || 'none'}</p><p>${esc(r.hybrid?.error || r.status?.slice(1).join(' / ') || r.error || 'Generation ended')}</p><nav><a href="${r.id}/spec.json">JSON</a><a href="${r.id}/generated.html">HTML</a><a href="${r.id}/result.json">Generation evidence</a><a href="${r.id}/interaction.json">Interaction evidence</a></nav><details><summary>Independent checks</summary>${Object.entries(r.views).map(([width,v]) => `<h4>${width}px: ${v.verdict}</h4><ul>${v.checks.map(c => `<li>${c.pass === true ? 'PASS' : c.pass === false ? 'FAIL' : 'UNVERIFIED'}: ${esc(c.name)} ${esc(c.reason || '')}</li>`).join('')}</ul>`).join('')}</details>${r.hasSpec ? `<div class="previews"><a href="${r.id}/render-1200.png"><img alt="${mode} desktop export" src="${r.id}/render-1200.png"></a><a href="${r.id}/render-390.png"><img alt="${mode} mobile export" src="${r.id}/render-390.png"></a></div>` : '<p>No export</p>'}</article>`;
  }).join('')}</div></section>`;
}).join('');
await writeFile(resolve(output, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Direct vs Hybrid benchmark</title><style>*{box-sizing:border-box;letter-spacing:0}body{margin:0;padding:24px;font:14px/1.5 system-ui;color:#202328;background:#f7f8fa}h1{font-size:26px}h2{font-size:18px}h3{font-size:16px}h4{margin-bottom:4px}small{font-size:12px;font-weight:400;color:#5b616d}section{border-top:1px solid #d5d9df;padding:16px 0 32px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{min-width:0}nav{display:flex;gap:16px;flex-wrap:wrap}a{color:#215d9d}p{margin:8px 0;overflow-wrap:anywhere}.previews{display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-top:16px}.previews img{width:100%;height:480px;object-fit:contain;object-position:top;background:white}details{margin:12px 0}td,th{text-align:left;padding:6px 16px 6px 0}@media(max-width:800px){.pair{grid-template-columns:1fr}.previews img{height:360px}}</style><h1>Direct vs Hybrid</h1><p>Ten paired one-line prompts. Local checkout, October 8, 2026. One sample per mode and prompt; alternating mode order. Desktop 1200px and mobile 390px.</p><p><a href="README.md">Analysis</a> / <a href="summary.json">Measured summary</a> / <a href="manifest.json">Protocol and source hashes</a></p><table><tr><th>Mode</th><th>Exports</th><th>Task pass</th><th>Median</th><th>Requests</th><th>Recorded cost*</th></tr>${Object.entries(groups).map(([mode,g]) => `<tr><td>${mode}</td><td>${g.exports}/${g.runs}</td><td>${g.taskPass}/${g.runs}</td><td>${g.medianSeconds?.toFixed(1)}s</td><td>${g.requests}</td><td>$${g.recordedCost.toFixed(4)}</td></tr>`).join('')}</table><p>*Missing usage records exclude some costs. Task pass requires independent checks at both widths; pipeline self-assessments do not count as independent evidence. The modes use different stage budgets and routed models.</p>${sections}</html>`);
console.log(JSON.stringify({ groups, hashesMatch }, null, 2));
