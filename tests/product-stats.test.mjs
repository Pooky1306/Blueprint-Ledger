import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {estimateCraftStats,setCraftWeaponStats,craftWeaponModes} from '../crafting.mjs';
import {validateWeaponStats,syncWeaponStats} from '../weapon-stats.mjs';
const catalogue=JSON.parse(await readFile(new URL('../data/catalogue.json',import.meta.url))),data=validateWeaponStats(JSON.parse(await readFile(new URL('../data/weapon-stats.json',import.meta.url))));
setCraftWeaponStats(data);
const slots=(b,qualities)=>b.slots.map((slot,i)=>({slot,option:slot.options[0],quality:qualities[i]??1000,missing:0}));
const near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
test('quality 500 produces base stats for every blueprint and material alternative',()=>{for(const b of catalogue.blueprints)for(const [index,slot]of b.slots.entries())for(const option of slot.options){const s=slots(b,b.slots.map(()=>500));s[index].option=option;for(const row of estimateCraftStats(b,s))near(row.final,row.base)}});
test('CQ7 below-base qualities worsen recoil and above-base quality improves damage',()=>{const b=catalogue.blueprints.find(b=>b.blueprintName==='CQ7 Rifle'),rows=estimateCraftStats(b,slots(b,[0,0,1000]));near(rows.find(r=>r.key==='Rapid · Recoil pitch').final,.224);near(rows.find(r=>r.key==='Rapid · Fire rate').final,728);near(rows.find(r=>r.key==='Rapid · Physical damage / shot').final,19.35)});
test('CQ7 matches SCMDB screenshot damage, RPM, DPS and recoil for Rapid and Burst',()=>{
 const b=catalogue.blueprints.find(b=>b.blueprintName==='CQ7 Rifle'),rows=estimateCraftStats(b,slots(b,[787,903,949])),get=label=>rows.find(s=>s.key===label);
 near(get('Rapid · Fire rate').final,720.044);near(get('Rapid · Physical damage / shot').final,19.2123);near(get('Rapid · DPS').final,195*1.06735*1.10776);
 near(get('Rapid · Recoil pitch').final,.16*.724);near(get('Rapid · Recoil yaw').final,.4*.724);near(get('Rapid · Recoil smooth').final,.05*.724);
 near(get('Burst · Fire rate').final,680*1.10776);near(get('Burst · Recoil pitch').final,.5*.724);
 near(estimateCraftStats(b,slots(b,[981,632,719])).find(s=>s.key==='Rapid · Fire rate').final,684.164);
});
test('all catalogue blueprints and material alternatives expose every modifier at minimum, middle and maximum quality',()=>{
 let checked=0;for(const b of catalogue.blueprints){for(const [index,slot]of b.slots.entries())for(const option of slot.options)for(const quality of [option.minQuality,500,1000]){
  const requirements=slots(b,[]);requirements[index]={slot,option,quality,missing:0};const rows=estimateCraftStats(b,requirements);
  for(const row of rows){assert(Number.isFinite(row.base),b.blueprintName+' '+row.key);assert(Number.isFinite(row.final),b.blueprintName+' '+row.key)}
  for(const m of option.modifiers||[]){const property=m.gameplayProperty.toLowerCase(),weapon=/Weapons/.test(b.categoryName)&&data.items[b.blueprintName.toLowerCase()]?.modes;
   assert(rows.some(r=>r.key.toLowerCase()===property||r.property===property)||(weapon&&['weapon_damage','weapon_firerate','weapon_recoil_smoothness'].includes(property)),b.blueprintName+' missing '+property);checked++;
  }
 }}assert(checked>10000);
});
test('component curves and additive power bonuses use their own recipe modifiers',()=>{
 const drive=catalogue.blueprints.find(b=>b.blueprintName==='XL-1'),rows=estimateCraftStats(drive,slots(drive,[1000,1000,1000]));near(rows.find(s=>s.key==='Quantum_Speed').final,264.1526*1.2);near(rows.find(s=>s.key==='Quantum_FuelRequirement').final,23.98*.8);
 const plant=catalogue.blueprints.find(b=>b.blueprintName==='LumaCore'),base=plant.vehicleBaseStats.ItemResource_PowerGeneration,result=estimateCraftStats(plant,slots(plant,[1000,1000,1000]));assert(result.find(s=>s.key==='ItemResource_PowerGeneration').final>base);
});
test('incomplete actual assignments hide all final stats, including supplementary weapon stats',()=>{const b=catalogue.blueprints.find(b=>b.blueprintName==='CQ7 Rifle'),s=slots(b,[1000,1000,1000]);s[0].missing=1;assert(estimateCraftStats(b,s).every(row=>row.final===null))});
test('product statistics sync selects LIVE and validates the downloaded dataset',async()=>{
 const urls=[],result=await syncWeaponStats(async url=>{urls.push(url);return {ok:true,json:async()=>urls.length===1?[{version:'4.10.3-ptu.123'},{version:'4.10.2-live.123'}]:{version:'4.10.2-live.123',items:[{name:'Test',health:42}],fireModesPools:[],ammoPools:[]}}});assert(urls[1].endsWith('crafting_items-4.10.2-live.123.json'));assert.equal(result.items.test.health,42);
});
test('every available FPS and ship weapon mode keeps a distinct column and unique stat keys',()=>{
 let weapons=0;for(const b of catalogue.blueprints.filter(b=>/Weapons/.test(b.categoryName))){const product=data.items[b.blueprintName.toLowerCase()];if(!product?.modes||!product.ammo)continue;const modes=craftWeaponModes(product),rows=estimateCraftStats(b,slots(b,[]));assert.equal(new Set(modes.map(m=>m.name)).size,modes.length);assert.equal(new Set(rows.map(r=>r.key)).size,rows.length,b.blueprintName);for(const mode of modes)assert(rows.some(r=>r.key.startsWith(mode.name+' · ')),b.blueprintName+' missing '+mode.name);weapons++}assert.equal(weapons,catalogue.blueprints.filter(b=>/Weapons/.test(b.categoryName)&&data.items[b.blueprintName.toLowerCase()]?.modes&&data.items[b.blueprintName.toLowerCase()]?.ammo).length);assert(weapons>100);
});
test('Gallant separates three-shot and five-shot bursts; repeated Fresnel steps stay grouped',()=>{
 const gallant=catalogue.blueprints.find(b=>b.blueprintName==='Gallant Rifle'),rows=estimateCraftStats(gallant,slots(gallant,[]));assert(rows.some(r=>r.key==='Burst (3-shot) · Fire rate'&&r.base===900));assert(rows.some(r=>r.key==='Burst (5-shot) · Fire rate'&&r.base===825));
 const fresnel=catalogue.blueprints.find(b=>b.blueprintName==='Fresnel Energy LMG'),modes=craftWeaponModes(data.items[fresnel.blueprintName.toLowerCase()]);assert.equal(modes.length,1);assert.equal(modes[0].steps,3);
});
test('charged shotguns expose charge and pellet details without inventing RPM or DPS',()=>{
 const b=catalogue.blueprints.find(b=>b.blueprintName==='Devastator Shotgun'),rows=estimateCraftStats(b,slots(b,[]));assert(rows.some(r=>r.key==='Charge · Charge time'&&r.base===2.5));assert(rows.some(r=>r.key==='Charge · Pellets / shot'&&r.base===12));assert(!rows.some(r=>/Fire rate|DPS/.test(r.key)));
});
test('sequence delays in seconds never become fire rates',()=>{
 setCraftWeaponStats({items:{test:{modes:[{name:'Sequence',sequenceEntries:[{name:'Single',delay:.1,delayUnit:'Seconds'}]}],ammo:{damage:{energy:5}}}}});
 try{const rows=estimateCraftStats({blueprintName:'Test',categoryName:'FPSWeapons'},[]);assert(!rows.some(r=>/Fire rate|DPS/.test(r.key)));assert(rows.some(r=>r.key==='Sequence · Sequence delay'&&r.base===.1))}finally{setCraftWeaponStats(data)}
});
