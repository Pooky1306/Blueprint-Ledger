import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateCatalogue,validateSelections} from '../validation.mjs';
test('real SCCrafter catalogue validates with unique stable record IDs',async()=>{const d=validateCatalogue(JSON.parse(await readFile(new URL('../data/catalogue.json',import.meta.url))));assert.equal(d.blueprints.length,1625);assert.equal(new Set(d.blueprints.map(b=>b.recordName)).size,1625)});
test('malformed catalogue and duplicate IDs rejected',()=>{assert.throws(()=>validateCatalogue({blueprints:[]}));const b={recordName:'x',blueprintName:'A',categoryName:'C',slots:[]};assert.throws(()=>validateCatalogue({version:'x',blueprints:[b,b]}))});
test('selection roundtrip retains flags for absent records',()=>{const s={'CraftingBlueprintRecord.absent':{owned:true,wanted:true}};assert.deepEqual(validateSelections(JSON.parse(JSON.stringify(s))),s);assert.throws(()=>validateSelections({'CraftingBlueprintRecord.x':{owned:'yes',wanted:false}}))});
