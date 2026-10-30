import {resourceKey} from './resources.mjs';
const craftWeaponStats={items:{}};
export function setCraftWeaponStats(data){craftWeaponStats.items=data.items||{}}
export function craftWeaponModes(weapon){
 const result=[],used=new Set();for(const group of weapon.modes||[]){const entries=group.sequenceEntries?.length?group.sequenceEntries:[group],unique=[...new Map(entries.map(m=>[JSON.stringify(m),m])).values()];for(const [index,mode]of unique.entries()){
  let name=group.name||mode.name||mode.type||'Weapon';if(unique.length>1)name+=' / '+(mode.name||'Step')+' '+(index+1);
  const duplicate=(weapon.modes||[]).filter(m=>(m.name||m.type)===(group.name||group.type)).length>1;
  if(duplicate&&mode.shotCount>1)name+=' ('+mode.shotCount+'-shot)';const stem=name;let n=2;while(used.has(name))name=stem+' '+n++;used.add(name);result.push({name,mode,steps:group.sequenceEntries?.length||0});
 }}return result;
}
export function validateCraftPlans(plans={}){
 if(!plans||typeof plans!=='object'||Array.isArray(plans))throw Error('Invalid crafting plans.');const result={};
 for(const [id,p]of Object.entries(plans)){if(!id.startsWith('CraftingBlueprintRecord.')||!p||!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>999||!p.slots||typeof p.slots!=='object'||Array.isArray(p.slots))throw Error('Invalid blueprint plan.');const slots={};for(const [key,s]of Object.entries(p.slots)){if(!s||typeof s.option!=='string'||!Array.isArray(s.allocations)||s.allocations.some(a=>!a||typeof a.stackId!=='string'||!Number.isSafeInteger(a.units)||a.units<=0)||!Number.isInteger(s.itemHave??0)||(s.itemHave??0)<0||!Number.isInteger(s.itemQuality??0)||(s.itemQuality??0)<0||(s.itemQuality??0)>1000)throw Error('Invalid plan allocation.');slots[key]={option:s.option,allocations:s.allocations.map(a=>({stackId:a.stackId,units:a.units})),itemHave:s.itemHave??0,itemQuality:s.itemQuality??0}}result[id]={quantity:p.quantity,slots};}return result;
}
export function craftSlotKey(slot,index){return slot.slotDebugName||String(index)}
export function craftOptionKey(option){return JSON.stringify([option.type,resourceKey(option.resourceName||option.entityName)])}
export function evaluateCrafting(catalogue,selections,inventory){
 const free=new Map(inventory.stacks.map(s=>[s.id,s.units])),plans=inventory.craftPlans||{},items=[],todo=new Map();
 for(const b of catalogue.blueprints.filter(b=>selections[b.recordName]?.craft).sort((a,b)=>a.blueprintName.localeCompare(b.blueprintName))){const p=plans[b.recordName]||{quantity:1,slots:{}},slots=[];
  for(const [index,slot]of b.slots.entries()){const key=craftSlotKey(slot,index),saved=p.slots[key],option=slot.options.find(o=>craftOptionKey(o)===saved?.option)||slot.options[0];if(!option){slots.push({key,slot,option:null,missing:1,allocations:[],warning:'No requirement options supplied.'});continue}
   const changed=!!saved&&craftOptionKey(option)!==saved.option,name=option.resourceName||option.entityName,resource=resourceKey(name),unit=option.type==='resource'?'cSCU':'items';
   const raw=(option.type==='resource'?option.standardCargoUnits*10000:option.quantity)*(slot.requiredCount||1)*p.quantity;
   const required=option.type==='resource'?Math.ceil(raw-1e-8):Math.ceil(raw);let remaining=required,weighted=0,assigned=0;const allocations=[];let warning=changed?'Saved option is no longer available; choose materials again.':'';
   const mixed=option.type==='resource'&&new Set((saved?.allocations||[]).map(a=>inventory.stacks.find(s=>s.id===a.stackId)?.quality).filter(q=>q!==undefined)).size>1;
   if(mixed)warning='Previous assignment mixes qualities. Reassign the full ingredient at one quality.';
   if(option.type==='resource'&&!changed&&!mixed){for(const a of saved?.allocations||[]){const s=inventory.stacks.find(s=>s.id===a.stackId);if(!s||s.resource!==resource||s.quality<option.minQuality){warning='An assigned stack is missing, changed, or below minimum quality.';continue}const units=Math.min(a.units,free.get(s.id)||0,remaining);if(units<a.units&&remaining>0)warning='An assignment exceeds available stock or the required amount.';if(units>0){free.set(s.id,free.get(s.id)-units);remaining-=units;assigned+=units;weighted+=units*s.quality;allocations.push({...a,units,stack:s})}}}
   if(option.type==='item'&&!changed&&(saved?.itemQuality??0)>=option.minQuality){assigned=Math.min(required,saved?.itemHave||0);remaining-=assigned;weighted=assigned*(saved?.itemQuality||0)}
   const entry={key,slot,option,name,resource,unit,required,assigned,missing:remaining,quality:assigned?weighted/assigned:null,allocations,warning};slots.push(entry);
   if(remaining>0){const todoKey=JSON.stringify([resource,unit,option.minQuality]);if(!todo.has(todoKey))todo.set(todoKey,{name,resource,unit,minQuality:option.minQuality,required:0,assigned:0,missing:0,blueprints:new Set()});const t=todo.get(todoKey);t.required+=required;t.assigned+=assigned;t.missing+=remaining;t.blueprints.add(b.blueprintName)}
  }
  items.push({blueprint:b,quantity:p.quantity,slots,ready:slots.every(s=>s.missing===0),stats:estimateCraftStats(b,slots)});
 }
 return {items,free,todo:[...todo.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.minQuality-b.minQuality),missingBlueprints:Object.keys(selections).filter(id=>selections[id].craft&&!catalogue.blueprints.some(b=>b.recordName===id))};
}
export function autoAssignCrafting(catalogue,selections,inventory){
 const plans=structuredClone(inventory.craftPlans||{}),available=new Map(inventory.stacks.map(s=>[s.id,s.units]));
 for(const item of evaluateCrafting(catalogue,selections,{...inventory,craftPlans:{...plans}}).items){const p=plans[item.blueprint.recordName]||{quantity:item.quantity,slots:{}};
  for(const s of item.slots){if(!s.option)continue;const old=p.slots[s.key];if(s.option.type==='item')continue;const groups=new Map();for(const stack of inventory.stacks.filter(x=>x.resource===s.resource&&x.quality>=s.option.minQuality)){const group=groups.get(stack.quality)||[];group.push(stack);groups.set(stack.quality,group)}const quality=[...groups.keys()].sort((a,b)=>a-b).find(q=>groups.get(q).reduce((n,x)=>n+(available.get(x.id)||0),0)>=s.required);let need=s.required;const allocations=[];for(const stack of groups.get(quality)||[]){const units=Math.min(available.get(stack.id)||0,need);if(units){allocations.push({stackId:stack.id,units});available.set(stack.id,available.get(stack.id)-units);need-=units}if(!need)break}p.slots[s.key]={option:craftOptionKey(s.option),allocations,itemHave:old?.itemHave||0,itemQuality:old?.itemQuality||0};}plans[item.blueprint.recordName]=p;
 }return validateCraftPlans(plans);
}
// Use source quality bands; repair curves whose declared midpoint is not neutral.
function qualityModifier(list,quality,start,end,neutral){
 const valid=list.filter(m=>Number.isFinite(m[start])&&Number.isFinite(m[end]));if(!valid.length)return neutral;
 const sample=q=>{const m=valid.find(m=>q>=m.startQuality&&q<=m.endQuality)||valid.reduce((a,b)=>Math.min(Math.abs(q-a.startQuality),Math.abs(q-a.endQuality))<=Math.min(Math.abs(q-b.startQuality),Math.abs(q-b.endQuality))?a:b);const f=m.endQuality===m.startQuality?0:Math.max(0,Math.min(1,(q-m.startQuality)/(m.endQuality-m.startQuality)));return m[start]+(m[end]-m[start])*f};
 if(Math.abs(sample(500)-neutral)<1e-10)return sample(quality);
 return quality<=500?sample(0)+(neutral-sample(0))*quality/500:neutral+(sample(1000)-neutral)*(quality-500)/500;
}
export function estimateCraftStats(b,slots){
 const base={...b.weaponBaseStats,...b.armorBaseStats,...b.vehicleBaseStats},mods={};
 const product=craftWeaponStats.items[b.blueprintName?.toLowerCase()],fields={health_maxhealth:'health',shield_maxhealth:'shieldHealth',itemresource_coolantgeneration:'coolingRate',quantum_fuelrequirement:'quantumFuelRequirement',quantum_speed:'driveSpeed',radar_minaimassistdistance:'minAimAssistRange',radar_maxaimassistdistance:'maxAimAssistRange',weapon_hullscraping_speed:'salvageSpeedMultiplier',weapon_hullscraping_radius:'radiusMultiplier',weapon_hullscraping_efficiency:'extractionEfficiency',weapon_tractor_force:'maxForce',weapon_tractor_fullstrengthdist:'fullStrengthDistance',weapon_tractor_maxdist:'maxDistance',weapon_tractor_maxvolume:'maxVolume',itemresource_powergeneration:'powerOutput'};
 const properties=new Set(slots.flatMap(s=>(s.option?.modifiers||[]).map(m=>m.gameplayProperty)));
 for(const property of properties){const key=Object.keys(base).find(k=>k.toLowerCase()===property.toLowerCase())||property;if(Number.isFinite(base[key]))continue;const name=property.toLowerCase(),value=product?.[fields[name]];if(Number.isFinite(value))base[key]=value;else if(name==='armor_temperaturemin'&&Number.isFinite(product?.temperatureResistance?.min))base[key]=product.temperatureResistance.min;else if(name==='armor_temperaturemax'&&Number.isFinite(product?.temperatureResistance?.max))base[key]=product.temperatureResistance.max;else if(name==='armor_radiationdissipation'&&Number.isFinite(product?.radiationResistance?.dissipationRate))base[key]=product.radiationResistance.dissipationRate}
 for(const s of slots){if(s.quality===null||s.missing||!s.option)continue;const groups={};for(const m of s.option.modifiers||[]){const key=m.gameplayProperty;(groups[key]||=([])).push(m)}
  for(const [property,list]of Object.entries(groups)){const pct=qualityModifier(list,s.quality,'modifierAtStart','modifierAtEnd',1)-1,add=qualityModifier(list,s.quality,'additiveModifierAtStart','additiveModifierAtEnd',0);const key=Object.keys(base).find(k=>k.toLowerCase()===property.toLowerCase())||property;mods[key]||={pct:0,add:0};mods[key].pct+=pct;mods[key].add+=add;}
 }
 const complete=slots.every(s=>s.missing===0),weapon=craftWeaponStats.items[b.blueprintName?.toLowerCase()];
 const fallback=covered=>[...properties].filter(p=>!covered.has(p.toLowerCase())).map(property=>{const m=Object.entries(mods).find(([key])=>key.toLowerCase()===property.toLowerCase())?.[1]||{pct:0,add:0};const additive=slots.some(s=>(s.option?.modifiers||[]).some(x=>x.gameplayProperty.toLowerCase()===property.toLowerCase()&&Number.isFinite(x.additiveModifierAtStart)));return {key:property+' modifier'+(additive?' (additive)':''),base:additive?0:100,final:complete?(additive?m.add:100*(1+m.pct)):null,unit:additive?'':'%',digits:2,property:property.toLowerCase()}});
 if(/Weapons/.test(b.categoryName)&&weapon?.modes&&weapon.ammo){
  const modifier=key=>Object.entries(mods).find(([name])=>name.toLowerCase()===key)?.[1]||{pct:0,add:0},factor=key=>1+modifier(key).pct,rows=[];
  const add=(mode,label,value,final,unit='',digits=3)=>{if(Number.isFinite(value))rows.push({key:mode+' · '+label,base:value,final:complete?final:null,unit,digits})};
  for(const {name,mode,steps}of craftWeaponModes(weapon)){
   const rpm=mode.fireRate||(mode.delayUnit==='RPM'?mode.delay:undefined),damage=weapon.ammo.damage||weapon.ammo.detonationDamage||{},multiplier=mode.damageMultiplier??1,pellets=mode.pelletCount||1;
   add(name,'Fire rate',rpm,rpm*factor('weapon_firerate'),'RPM',0);
   for(const [type,value]of Object.entries(damage))if(value>0)add(name,type[0].toUpperCase()+type.slice(1)+(pellets>1?' damage / pellet':mode.type==='beam'?' damage (source)':' damage / shot'),value*multiplier,value*multiplier*factor('weapon_damage'),'',1);
   const total=Object.values(damage).reduce((sum,n)=>sum+(Number.isFinite(n)?n:0),0)*multiplier;
   if(total&&rpm)add(name,mode.shotCount>1?'DPS (within burst)':'DPS',total*pellets*rpm/60,total*pellets*rpm/60*factor('weapon_damage')*factor('weapon_firerate'),'',1);
   if(pellets>1){add(name,'Pellets / shot',pellets,pellets,'',0);add(name,'All pellets damage',total*pellets,total*pellets*factor('weapon_damage'),'',1)}
   for(const [field,label]of [['chargeTime','Charge time'],['overchargeTime','Overcharge time'],['cooldownTime','Cooldown']])if(mode[field]>0)add(name,label,mode[field],mode[field],'s');
   if(mode.shotCount>1)add(name,'Shots / burst',mode.shotCount,mode.shotCount,'',0);
   if(steps>1)add(name,'Sequence steps',steps,steps,'',0);
   if(mode.delayUnit==='Seconds'&&mode.delay>0)add(name,'Sequence delay',mode.delay,mode.delay,'s');
   const recoil=mode.recoil;if(recoil){const f=factor('weapon_recoil_smoothness');add(name,'Recoil pitch',recoil.pitchMaxDeg,recoil.pitchMaxDeg*f,'°');add(name,'Recoil yaw',recoil.yawMaxDeg,recoil.yawMaxDeg*f,'°');add(name,'Recoil smooth',recoil.smoothTime,recoil.smoothTime*f,'s')}
   if(mode.spread){add(name,'Spread min',mode.spread.min,mode.spread.min,'°',2);add(name,'Spread max',mode.spread.max,mode.spread.max,'°',2)}
   add(name,'Ammo speed',weapon.ammo.speed,weapon.ammo.speed,'m/s',0);
  }if(rows.length){const extra=Object.entries(base).filter(([key,value])=>Number.isFinite(value)&&!/^weapon_/i.test(key)).map(([key,value])=>({key,base:value,final:complete?(value+(mods[key]?.add||0))*(1+(mods[key]?.pct||0)):null}));return [...rows,...extra,...fallback(new Set(['weapon_firerate','weapon_damage','weapon_recoil_smoothness',...extra.map(r=>r.key.toLowerCase())]))]}
 }
 const rows=Object.entries(base).filter(([,value])=>Number.isFinite(value)).map(([key,value])=>({key,base:value,final:complete?(value+(mods[key]?.add||0))*(1+(mods[key]?.pct||0)):null}));
 return [...rows,...fallback(new Set(rows.map(s=>s.key.toLowerCase())))];
}
