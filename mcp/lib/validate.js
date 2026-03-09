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

  return {
    valid: issues.length === 0,
    issues,
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
