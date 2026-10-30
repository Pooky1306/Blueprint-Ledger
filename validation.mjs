export function validateCatalogue(d){
 if(!d||!Array.isArray(d.blueprints)||!d.blueprints.length||typeof d.version!=='string')throw Error('Expected SCCrafter JSON with version and blueprints.');
 const ids=new Set();
 for(const b of d.blueprints){if(!b||typeof b.recordName!=='string'||!b.recordName||typeof b.blueprintName!=='string'||typeof b.categoryName!=='string'||!Array.isArray(b.slots)||ids.has(b.recordName))throw Error('Invalid or duplicate blueprint record.');ids.add(b.recordName);
 for(const s of b.slots){if(!s||!Array.isArray(s.options)||!Number.isFinite(s.requiredCount))throw Error('Invalid requirement slot.');for(const o of s.options){if(!o||!['resource','item'].includes(o.type)||typeof(o.resourceName??o.entityName)!=='string'||!Number.isFinite(o.minQuality)||!Number.isFinite(o.type==='resource'?o.standardCargoUnits:o.quantity))throw Error('Unsupported material requirement.');}}}
 return d;
}
export function validateSelections(d){if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Invalid selections.');const result={};for(const [id,s]of Object.entries(d)){if(!id.startsWith('CraftingBlueprintRecord.')||!s||typeof s.owned!=='boolean'||typeof s.wanted!=='boolean'||(s.craft!==undefined&&typeof s.craft!=='boolean'))throw Error('Invalid blueprint selection.');Object.defineProperty(result,id,{value:{owned:s.owned,wanted:s.wanted,...(s.craft===undefined?{}:{craft:s.craft})},enumerable:true});}return result}
