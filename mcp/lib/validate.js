import { RENDERER_TYPES as VALID_TYPES, THEMES } from './renderers.js';

const validTypeSet = new Set(VALID_TYPES);

export function validateSpec(spec) {
  const issues = [];
  if (!spec || typeof spec !== 'object') return { valid: false, issues: ['Spec is not an object'], element_count: 0, components_used: [] };
  if (Array.isArray(spec)) return { valid: false, issues: ['Spec is not an object'], element_count: 0, components_used: [] };
  if (!spec.elements || typeof spec.elements !== 'object' || Array.isArray(spec.elements)) issues.push('Missing "elements" object');
  if (spec.theme != null && !THEMES.light.concat(THEMES.dark).includes(spec.theme)) issues.push(`Unknown theme "${spec.theme}"`);
  if (!spec.root) issues.push('Missing "root"');
  if (spec.root && spec.elements && !Object.hasOwn(spec.elements, spec.root)) issues.push(`Root "${spec.root}" not found in elements`);

  const componentsUsed = new Set();

  if (spec.elements) {
    for (const [id, def] of Object.entries(spec.elements)) {
      if (!def || typeof def !== 'object' || Array.isArray(def)) { issues.push(`Element "${id}" is not an object`); continue; }
      if (!def.type) {
        issues.push(`Element "${id}" missing "type"`);
      } else {
        componentsUsed.add(def.type);
        if (!validTypeSet.has(def.type)) {
          issues.push(`Unknown type "${def.type}" on element "${id}"`);
        }
      }
      const children = def.children || def.props?.children || [];
      if (!Array.isArray(children)) { issues.push(`Element "${id}" children must be an array`); continue; }
      for (const cid of children) {
        if (!Object.hasOwn(spec.elements, cid)) {
          issues.push(`Element "${id}" references missing child "${cid}"`);
        }
      }
      for (const slot of ['header', 'footer', 'trigger', 'media']) {
        const refs = def.props?.[slot];
        const isSlot = (slot === 'footer' && ['Card','Modal','AlertDialog','Frame'].includes(def.type)) || (slot === 'header' && def.type === 'Frame') || (['trigger','media'].includes(slot) && def.type === 'PreviewCard');
        if (isSlot && Array.isArray(refs)) for (const cid of refs) if (!Object.hasOwn(spec.elements, cid)) issues.push(`Element "${id}" ${slot} references missing child "${cid}"`);
      }
    }
  }

  const warnings = [];
  if (spec.elements) {
    const parentPrimaryButtons = Object.create(null);
    for (const [id, def] of Object.entries(spec.elements)) {
      if (!def || typeof def !== 'object') continue;
      if (def.type === 'BottomNav' && def.props?.items?.length > 5) {
        warnings.push(`BottomNav "${id}" has ${def.props.items.length} items (max 5 recommended)`);
      }
      if (def.type === 'Text' && (def.props?.content == null || def.props.content === '')) {
        warnings.push(`Text "${id}" has empty content`);
      }
      if (def.type === 'Card' && !def.props?.title && (!def.children || def.children.length === 0)) {
        warnings.push(`Card "${id}" has no title and no children`);
      }
      if (def.type === 'Card' && def.props?.footer === true) {
        warnings.push(`Card "${id}" has footer:true (boolean) — footer should be an array of child element IDs`);
      }
      if (def.type === 'Card' && Array.isArray(def.props?.media)) {
        warnings.push(`Card "${id}" has media as array — media should be a URL string, use footer for child element IDs`);
      }
      if (def.type === 'Button' && def.props?.variant === 'primary') {
        const parentId = Object.entries(spec.elements).find(([, p]) => Array.isArray(p?.children) && p.children.includes(id))?.[0] || 'root';
        (parentPrimaryButtons[parentId] = parentPrimaryButtons[parentId] || []).push(id);
      }
      if (def.type === 'Input' && !def.props?.label) {
        const hasLabelParent = Object.values(spec.elements).some(
          p => p?.type === 'Field' && Array.isArray(p.children) && p.children.includes(id)
        );
        const hasAdjacentLabel = Object.values(spec.elements).some(
          p => Array.isArray(p?.children) && p.children.includes(id) && p.children.some(
            cid => spec.elements[cid]?.type === 'Label' || spec.elements[cid]?.type === 'Field'
          )
        );
        if (!hasLabelParent && !hasAdjacentLabel) {
          warnings.push(`Input "${id}" has no associated Label or Field wrapper`);
        }
      }
    }
    for (const [parentId, btns] of Object.entries(parentPrimaryButtons)) {
      if (btns.length > 1) {
        warnings.push(`Multiple primary Buttons (${btns.join(', ')}) in same parent "${parentId}"`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    element_count: spec.elements ? Object.keys(spec.elements).length : 0,
    components_used: [...componentsUsed],
  };
}

export function autoFixSpec(spec) {
  if (!spec || !spec.elements) return spec;
  for (const def of Object.values(spec.elements)) {
    if (def && Array.isArray(def.children)) {
      def.children = def.children.filter(cid => !!spec.elements[cid]);
    }
  }
  if (!spec.root || !spec.elements[spec.root]) {
    const ids = Object.keys(spec.elements);
    if (ids.length) spec.root = ids[0];
  }
  return spec;
}
