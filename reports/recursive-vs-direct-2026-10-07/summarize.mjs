import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const output = dirname(fileURLToPath(import.meta.url));
const root = resolve(output, '../..');
const { results, circuit } = JSON.parse(await readFile(resolve(output, 'results.json')));
const manifest = JSON.parse(await readFile(resolve(output, 'manifest.json')));
const rows = [];
for (const r of results) {
  const spec = r.hasSpec ? JSON.parse(await readFile(resolve(output, r.id, 'spec.json'))) : null;
  const nodes = Object.entries(spec?.elements || {});
  const ids = new Set(nodes.map(([id]) => id));
  const children = node => {
    const refs = [...(node.children || node.props?.children || [])];
    const slots = node.type === 'Frame' ? ['header','footer'] : node.type === 'PreviewCard' ? ['trigger','media'] : ['Card','Modal','AlertDialog'].includes(node.type) ? ['footer'] : [];
    for (const slot of slots) if (Array.isArray(node.props?.[slot])) refs.push(...node.props[slot]);
    if (node.type === 'Accordion') for (const item of node.props?.items || []) refs.push(...(item.children || []));
    return refs;
  };
  const reachable = new Set();
  const visit = id => { if (reachable.has(id) || !ids.has(id)) return; reachable.add(id); for (const child of children(spec.elements[id])) visit(child); };
  if (spec) visit(spec.root);
  rows.push({ id: r.id, seconds: r.ms / 1000, elements: r.elements || 0, requests: r.requests.length,
    recordedCost: r.requests.reduce((sum, x) => sum + (x.usage?.cost || 0), 0), missingCost: r.requests.filter(x => typeof x.usage?.cost !== 'number').length,
    models: [...new Set(r.requests.map(x => x.model).filter(Boolean))], theme: spec?.theme || '(default)', topLevelKeys: Object.keys(spec || {}),
    emptyContainers: nodes.filter(([,n]) => ['Stack','Grid'].includes(n.type) && !n.children?.length).map(([id]) => id),
    dangling: nodes.flatMap(([id,n]) => children(n).filter(child => !ids.has(child)).map(child => ({ parent: id, child }))),
    outsideRootTree: [...ids].filter(id => !reachable.has(id)),
    scriptNodes: nodes.filter(([,n]) => n.props?.js).length,
    stateOrEvents: nodes.filter(([,n]) => n.on || n.props?.on || n.props?.bind || n.props?.$bind).map(([id]) => id),
    overflow: Object.fromEntries(Object.entries(r.views || {}).map(([width,v]) => [width, v.horizontalOverflow])),
    status: r.status, branchErrors: r.branchErrors, stopped: r.stopped, harnessError: r.harnessError });
}
const groups = {};
for (const mode of ['direct','recursive']) {
  const runs = rows.filter(r => r.id.endsWith(mode));
  const median = key => { const nums = runs.map(r => r[key]).sort((a,b) => a-b); return (nums[Math.floor((nums.length-1)/2)] + nums[Math.ceil((nums.length-1)/2)]) / 2; };
  groups[mode] = { runs: runs.length, medianSeconds: median('seconds'), totalSeconds: runs.reduce((a,r) => a+r.seconds,0), requests: runs.reduce((a,r) => a+r.requests,0), recordedCost: runs.reduce((a,r) => a+r.recordedCost,0), missingCost: runs.reduce((a,r) => a+r.missingCost,0), partialRuns: runs.filter(r => r.branchErrors.length).length, emptyContainerRuns: runs.filter(r => r.emptyContainers.length).length, overflowRuns: runs.filter(r => Object.values(r.overflow).some(Boolean)).length };
}
const hashesMatch = {};
for (const [file, hash] of Object.entries(manifest.hashes)) hashesMatch[file] = createHash('sha256').update(await readFile(resolve(root,file))).digest('hex') === hash;
await writeFile(resolve(output,'summary.json'), JSON.stringify({ groups, circuit, hashesMatch, rows },null,2));
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const sections = manifest.prompts.map((prompt,index) => {
  const number = String(index+1).padStart(2,'0');
  return `<section id="pair-${number}"><h2>${number}. ${escape(prompt)}</h2><div class="pair">${['direct','recursive'].map(mode => {
    const row = rows.find(r => r.id === number + '-' + mode);
    if (!row) return `<article><h3>${mode}</h3><p>Run unavailable</p></article>`;
    return `<article><h3>${mode === 'direct' ? 'Direct' : 'Recursive'} <small>${row.seconds.toFixed(1)}s / ${row.elements} elements / ${row.requests} requests</small></h3><p>${escape(row.status?.slice(1).join(' / ') || 'Run ended')}</p><nav><a href="${row.id}/spec.json">JSON</a><a href="${row.id}/generated.html">HTML</a><a href="${row.id}/result.json">Diagnostics</a><a href="${row.id}/interaction.json">Interaction checks</a></nav><div class="previews"><a href="${row.id}/render-1200.png"><img alt="${mode} desktop export" src="${row.id}/render-1200.png"></a><a href="${row.id}/render-390.png"><img alt="${mode} phone export" src="${row.id}/render-390.png"></a></div></article>`;
  }).join('')}</div></section>`;
}).join('');
await writeFile(resolve(output,'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recursive vs Direct comparison</title><style>body{margin:0;padding:24px;font:14px/1.5 system-ui;background:#f7f8fa;color:#202328}h1{font-size:26px}h2{font-size:18px}h3{font-size:16px}small{font-size:12px;font-weight:400;color:#5b616d}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}section{padding:16px 0 32px;border-top:1px solid #d5d9df}article{min-width:0}nav{display:flex;gap:16px}a{color:#215d9d}p{min-height:21px;margin:8px 0}.previews{display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-top:16px}.previews img{width:100%;height:460px;object-fit:contain;object-position:top;background:white}@media(max-width:800px){.pair{grid-template-columns:1fr}.previews img{height:360px}}*{box-sizing:border-box;letter-spacing:0}</style><h1>Recursive vs Direct</h1><p>Ten paired local prompts, October 7, 2026. <a href="README.md">Analysis</a> / <a href="summary.json">Measured summary</a></p>${sections}</html>`);
const browser = await chromium.launch({ channel:'chrome',headless:true });
try {
  const page = await browser.newPage({ viewport:{width:1600,height:1000} });
  await page.goto('file://' + resolve(output,'index.html'));
  for (let index = 0; index < manifest.prompts.length; index++) {
    const id = 'pair-' + String(index+1).padStart(2,'0');
    await page.locator('#'+id).screenshot({path:resolve(output,id+'.png')});
  }
} finally { await browser.close(); }
console.log(JSON.stringify({groups,hashesMatch},null,2));
