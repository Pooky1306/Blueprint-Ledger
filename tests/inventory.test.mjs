import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyInventory,inventoryUnits,applyInventory,validateInventory,parseRefineryOCR,qualityTier,sortStock} from '../inventory.mjs';
const stack=(extra={})=>({resource:'gold',resourceName:'Gold',quality:553,units:inventoryUnits('10.25'),mainLocation:'Pyro',refinery:'Ruin Station',...extra});
test('stock merges only equal resource, quality and storage, using exact decimal cSCU',()=>{
 let d=applyInventory(emptyInventory(),{type:'add',stack:stack()});d=applyInventory(d,{type:'add',stack:stack({mainLocation:' pyro ',refinery:'RUIN STATION',units:25})});assert.equal(d.stacks.length,1);assert.equal(d.stacks[0].units,1050);
 d=applyInventory(d,{type:'add',stack:stack({quality:554})});d=applyInventory(d,{type:'add',stack:stack({refinery:'Checkmate Station'})});assert.equal(d.stacks.length,3);assert.equal(d.revision,4);
 assert.throws(()=>inventoryUnits('0.001'));assert.throws(()=>inventoryUnits('-1'));assert.throws(()=>applyInventory(d,{type:'add',stack:stack({quality:1001})}));
});
test('partial and full moves conserve stock and merge the destination',()=>{
 let d=applyInventory(emptyInventory(),{type:'add',stack:stack({units:10000})});const id=d.stacks[0].id;
 d=applyInventory(d,{type:'move',id,units:2500,mainLocation:'Stanton',refinery:'ARC-L1 (Wide Forest)'});assert.equal(d.stacks.length,2);assert.equal(d.stacks.find(s=>s.id===id).units,7500);
 d=applyInventory(d,{type:'move',id,units:7500,mainLocation:'Stanton',refinery:'ARC-L1 (Wide Forest)'});assert.equal(d.stacks.length,1);assert.equal(d.stacks[0].units,10000);
 assert.throws(()=>applyInventory(d,{type:'adjust',id:d.stacks[0].id,delta:-10001}));d=applyInventory(d,{type:'adjust',id:d.stacks[0].id,delta:-10000});assert.equal(d.stacks.length,0);
});
test('reviewed screenshot import is atomic, deduplicated and undoable',()=>{
 const original=emptyInventory();let d=applyInventory(original,{type:'batch',hash:'image-hash',stacks:[stack({units:200}),stack({units:200}),stack({quality:359,units:100})]});assert.equal(d.stacks.length,2);assert.equal(d.stacks[0].units,400);
 assert.throws(()=>applyInventory(d,{type:'batch',hash:'image-hash',stacks:[stack()]}));assert.throws(()=>applyInventory(d,{type:'batch',stacks:[stack(),stack({quality:null})]}));assert.equal(d.stacks.length,2);
 d=applyInventory(d,{type:'restore',inventory:original});assert.equal(d.stacks.length,0);assert.equal(d.imports.length,0);assert.equal(validateInventory(d).revision,2);
});
test('completed screenshot parser reads Quality + Quantity in either column order',()=>{
 const word=(text,x,y)=>({text,x,y,width:50,height:14});
 for(const reverse of [false,true]){const ocr={width:600,words:[word('MATERIALS',20,100),word('QUALITY',reverse?400:300,100),word('QUANTITY',reverse?300:400,100),word('GOLD',50,140),word('553',reverse?400:300,140),word('12.5',reverse?300:400,140)]};const r=parseRefineryOCR(ocr,['Gold']);assert.equal(r.length,1);assert.equal(r[0].quality,553);assert.equal(r[0].quantityQty,12.5);assert.equal(r[0].doneQty,null);assert(r[0].finishedLayout)}
});
test('quality bands, ascending/descending stock sorting, configuration and deletion',()=>{
 assert.deepEqual([499,500,699,700,849,850,949,950,1000].map(qualityTier),['common','uncommon','uncommon','rare','rare','epic','epic','legendary','legendary']);
 let d=applyInventory(emptyInventory(),{type:'batch',stacks:[stack({id:'a',units:100,quality:500}),stack({id:'b',units:200,quality:950,refinery:'Checkmate Station'})]});
 assert.equal(sortStock(d.stacks,'units',-1)[0].id,'b');assert.equal(sortStock(d.stacks,'quality',1)[0].id,'a');
 d=applyInventory(d,{type:'configure',preferences:{stockSort:'quality',stockDirection:-1}});assert.equal(d.stacks.length,2);assert.equal(d.preferences.stockDirection,-1);
 const previous=d;d=applyInventory(d,{type:'delete',id:'a'});assert.equal(d.stacks.length,1);d=applyInventory(d,{type:'restore',inventory:previous});assert.equal(d.stacks.length,2);
});
