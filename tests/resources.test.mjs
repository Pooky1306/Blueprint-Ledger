import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resourceKey,validateResources,extractResourceData,syncResources,indexResources,indexLocations} from '../resources.mjs';
const resources=JSON.parse(await readFile(new URL('../data/resources.json',import.meta.url)));
const catalogue=JSON.parse(await readFile(new URL('../data/catalogue.json',import.meta.url)));
test('SCMiner dataset validates and explicit aliases match blueprint spellings',()=>{
 assert.equal(validateResources(resources).minerals.length,37);
 for(const [a,b]of [['Aluminum','Aluminium'],['Quantanium','Quantainium'],['Pressurized_Ice','Ice'],['Saldynium (Ore)','Saldynium']])assert.equal(resourceKey(a),resourceKey(b));
 const index=indexResources(catalogue,resources);assert.deepEqual(index.filter(e=>!e.mineral).map(e=>e.name),['Yormandi Eye']);
 assert.equal(index.reduce((n,e)=>n+e.usages.length,0),catalogue.blueprints.reduce((n,b)=>n+b.slots.reduce((n,s)=>n+s.options.length,0),0));
 const usage=index.find(e=>e.name==='Hephaestanite').usages.find(u=>u.blueprint.blueprintName==='FS-9 Magazine (75 cap)');assert.equal(usage.option.standardCargoUnits,0.03);assert.equal(usage.option.minQuality,0);assert.equal(usage.slot.requiredCount,1);
});
test('parser reads JSON without executing surrounding JavaScript',()=>{
 const script=`throw Error('must never run');a.exports=JSON.parse('${JSON.stringify(resources).replaceAll('\\','\\\\').replaceAll("'","\\'")}');`;
 assert.deepEqual(extractResourceData(script),resources);assert.equal(extractResourceData('console.log("nothing")'),null);
 assert.throws(()=>extractResourceData(`JSON.parse('{"minerals":[]}')`));
 const invalid=structuredClone(resources);invalid.minerals[0].locations.stanton=[{name:'Broken',abundance:'lots'}];assert.throws(()=>validateResources(invalid));
});
test('sync discovers the current asset name and fails on source format changes',async()=>{
 const mock=async url=>({ok:true,text:async()=>url.endsWith('.js')?`JSON.parse('${JSON.stringify(resources).replaceAll('\\','\\\\').replaceAll("'","\\'")}')`:'<script src="/_next/static/chunks/new-name.js"></script>'});
 const d=await syncResources(mock);assert.equal(d.minerals.length,37);assert(d.syncedAt);assert.equal(d.source,'https://scminer.rocks/data/mineral-directory');
 await assert.rejects(syncResources(async()=>({ok:true,text:async()=>'<html>Source changed</html>'})),/not found/);
});
test('location index preserves source abundance and separates same-name places by system',()=>{
 const entries=indexResources(catalogue,resources),locations=indexLocations(entries);
 const aberdeen=locations.find(l=>l.name==='Aberdeen'&&l.system==='stanton');assert(aberdeen.resources.some(r=>r.resource.name==='Agricium'&&r.abundance===28.5));
 const sourceCount=entries.reduce((n,e)=>n+Object.values(e.mineral?.locations||{}).reduce((n,l)=>n+l.length,0),0);assert.equal(locations.reduce((n,l)=>n+l.resources.length,0),sourceCount);
 const duplicate=indexLocations([{name:'Test',mineral:{locations:{stanton:[{name:'Shared',abundance:1}],pyro:[{name:'Shared',abundance:2}]}}}]);assert.equal(duplicate.length,2);assert.notEqual(duplicate[0].key,duplicate[1].key);
});
