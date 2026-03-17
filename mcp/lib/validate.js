import { VALID_TYPES } from './prompt.js';

const validTypeSet = new Set(VALID_TYPES);

export function validateSpec(spec) {
  const issues = [];
  if (!spec || typeof spec !== 'object') return { valid: false, issues: ['Spec is not an object'], element_count: 0, components_used: [] };
  if (!spec.elements || typeof spec.elements !== 'object') issues.push('Missing "elements" object');
  if (!spec.root) issues.push('Missing "root"');
  if (spec.root && spec.elements && !spec.elements[spec.root]) issues.push(`Root "${spec.root}" not found in elements`);

  const componentsUsed = new Set();

  if (spec.elements) {
    for (const [id, def] of Object.entries(spec.elements)) {
      if (!def.type) {
        issues.push(`Element "${id}" missing "type"`);
      } else {
        componentsUsed.add(def.type);
        if (!validTypeSet.has(def.type)) {
          issues.push(`Unknown type "${def.type}" on element "${id}"`);
        }
      }
      const children = def.children || [];
      for (const cid of children) {
        if (!spec.elements[cid]) {
          issues.push(`Element "${id}" references missing child "${cid}"`);
        }
      }
    }
  }

  const warnings = [];
  if (spec.elements) {
    const parentPrimaryButtons = {};
    for (const [id, def] of Object.entries(spec.elements)) {
      if (def.type === 'BottomNav' && def.props?.items?.length > 5) {
        warnings.push(`BottomNav "${id}" has ${def.props.items.length} items (max 5 recommended)`);
      }
      if (def.type === 'Text' && (!def.props?.content || def.props.content === '')) {
        warnings.push(`Text "${id}" has empty content`);
      }
      if (def.type === 'Card' && !def.props?.title && (!def.children || def.children.length === 0)) {
        warnings.push(`Card "${id}" has no title and no children`);
      }
      if (def.type === 'Button' && def.props?.variant === 'primary') {
        const parentId = Object.entries(spec.elements).find(([, p]) => p.children?.includes(id))?.[0] || 'root';
        (parentPrimaryButtons[parentId] = parentPrimaryButtons[parentId] || []).push(id);
      }
      if (def.type === 'Input' && !def.props?.label) {
        const hasLabelParent = Object.values(spec.elements).some(
          p => p.type === 'Field' && p.children?.includes(id)
        );
        const hasAdjacentLabel = Object.values(spec.elements).some(
          p => p.children?.includes(id) && p.children?.some(
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
    if (def.children) {
      def.children = def.children.filter(cid => !!spec.elements[cid]);
    }
  }
  if (!spec.root || !spec.elements[spec.root]) {
    const ids = Object.keys(spec.elements);
    if (ids.length) spec.root = ids[0];
  }
  return spec;
}
