import {validateCraftPlans} from './crafting.mjs';
export function emptyInventory(){return {version:1,revision:0,stacks:[],imports:[],locations:[]}}
export function validatePreferences(p={}){const sort=p.stockSort||'resourceName',direction=p.stockDirection??1;if(!['resourceName','units','quality','storage'].includes(sort)||![1,-1].includes(direction))throw Error('Invalid table sorting configuration.');return {stockSort:sort,stockDirection:direction}}
export function qualityTier(q){return q<500?'common':q<700?'uncommon':q<850?'rare':q<950?'epic':'legendary'}
export function sortStock(rows,key,direction){return [...rows].sort((a,b)=>{const value=key==='units'||key==='quality'?a[key]-b[key]:key==='storage'?(a.mainLocation+' / '+a.refinery).localeCompare(b.mainLocation+' / '+b.refinery):a.resourceName.localeCompare(b.resourceName);return direction*value||a.id.localeCompare(b.id)})}
export function inventoryUnits(value){const n=Number(value);if(value===''||!Number.isFinite(n)||n<=0||!Number.isSafeInteger(Math.round(n*100))||Math.abs(n*100-Math.round(n*100))>0.000001)throw Error('Quantity must be positive cSCU, with at most two decimal places.');return Math.round(n*100)}
function clean(value,label){if(typeof value!=='string'||!value.trim()||value.length>200)throw Error('Choose '+label+'.');return value.trim().replace(/\s+/g,' ')}
function stackKey(s){return JSON.stringify([s.resource,s.quality,s.mainLocation.toLowerCase(),s.refinery.toLowerCase()])}
function validateStack(s){if(!s||typeof s.id!=='string'||!s.id||!Number.isSafeInteger(s.units)||s.units<=0||!Number.isInteger(s.quality)||s.quality<0||s.quality>1000)throw Error('Invalid stack quantity or quality (0–1000).');return {...s,resource:clean(s.resource,'a resource'),resourceName:clean(s.resourceName,'a resource name'),mainLocation:clean(s.mainLocation,'a main location'),refinery:clean(s.refinery,'a refinery or storage site')}}
export function validateInventory(d){if(!d||d.version!==1||!Number.isSafeInteger(d.revision)||d.revision<0||!Array.isArray(d.stacks)||!Array.isArray(d.imports)||!Array.isArray(d.locations))throw Error('Invalid owned-resource database.');const ids=new Set(),keys=new Set();const stacks=d.stacks.map(s=>{const v=validateStack(s);if(ids.has(v.id)||keys.has(stackKey(v)))throw Error('Duplicate owned-resource stack.');ids.add(v.id);keys.add(stackKey(v));return v});if(d.imports.some(i=>!i||typeof i.hash!=='string'||typeof i.at!=='string'))throw Error('Invalid screenshot import history.');const locations=d.locations.map(l=>({mainLocation:clean(l.mainLocation,'a main location'),refinery:clean(l.refinery,'a refinery')}));return {version:1,revision:d.revision,stacks,imports:d.imports,locations,preferences:validatePreferences(d.preferences),craftPlans:validateCraftPlans(d.craftPlans)}}
export function applyInventory(current,action){
 const d=structuredClone(validateInventory(current));
 const add=row=>{const stack=validateStack({...row,id:row.id||crypto.randomUUID()});const existing=d.stacks.find(s=>stackKey(s)===stackKey(stack));if(existing){if(!Number.isSafeInteger(existing.units+stack.units))throw Error('Quantity is too large.');existing.units+=stack.units}else d.stacks.push(stack);if(!d.locations.some(l=>l.mainLocation.toLowerCase()===stack.mainLocation.toLowerCase()&&l.refinery.toLowerCase()===stack.refinery.toLowerCase()))d.locations.push({mainLocation:stack.mainLocation,refinery:stack.refinery})};
 if(action.type==='add')add(action.stack);
 else if(action.type==='batch'){
  if(!Array.isArray(action.stacks)||!action.stacks.length)throw Error('Select at least one import row.');
  if(action.hash&&d.imports.some(i=>i.hash===action.hash))throw Error('This screenshot has already been imported.');
  for(const stack of action.stacks)add(stack);if(action.hash)d.imports.push({hash:action.hash,at:new Date().toISOString()});
 }else if(action.type==='adjust'||action.type==='move'){
  const s=d.stacks.find(s=>s.id===action.id);if(!s)throw Error('This stack no longer exists. Refresh and try again.');
  if(action.type==='adjust'){if(!Number.isSafeInteger(action.delta)||!action.delta||s.units+action.delta<0||!Number.isSafeInteger(s.units+action.delta))throw Error('Invalid adjustment or insufficient stock.');s.units+=action.delta}
  else{if(!Number.isSafeInteger(action.units)||action.units<=0||action.units>s.units)throw Error('Move quantity exceeds this stack.');const moved={...s,id:crypto.randomUUID(),units:action.units,mainLocation:action.mainLocation,refinery:action.refinery};const valid=validateStack(moved);if(stackKey(valid)===stackKey(s))throw Error('Choose a different destination.');s.units-=action.units;add(valid)}
  d.stacks=d.stacks.filter(s=>s.units>0);
 }else if(action.type==='delete'){if(!d.stacks.some(s=>s.id===action.id))throw Error('Stack no longer exists.');d.stacks=d.stacks.filter(s=>s.id!==action.id)}
 else if(action.type==='plan'){d.craftPlans=validateCraftPlans(action.plans)}
 else if(action.type==='configure'){d.preferences=validatePreferences(action.preferences);if(action.locations)d.locations=action.locations}
 else if(action.type==='restore'){const restored=validateInventory(action.inventory);return {...restored,revision:d.revision+1}}
 else throw Error('Unknown stock operation.');
 d.revision++;return validateInventory(d);
}
export function parseRefineryOCR(ocr,resourceNames){
 const words=ocr.words||[],upper=s=>s.toUpperCase().replace(/[^A-Z]/g,'');
 const qualityHeaders=words.filter(w=>['QUALITY','OUALITY'].includes(upper(w.text))).sort((a,b)=>a.x-b.x);
 const rows=[];const number=(word)=>{if(!word)return null;const v=word.text.replace(/[Ss]/g,'5').replace(/[Oo]/g,'0').replace(/[Bb]/g,'8');return /^\d+(?:[.,]\d+)?$/.test(v)?Number(v.replace(',','.')):null};
 for(const [job,h]of qualityHeaders.entries()){
  const headerWords=words.filter(w=>Math.abs(w.y-h.y)<h.height);
  const material=headerWords.filter(w=>upper(w.text)==='MATERIALS'&&w.x<h.x).sort((a,b)=>b.x-a.x)[0];if(!material)continue;
  const start=material.x,end=qualityHeaders[job+1]?qualityHeaders[job+1].x-(h.x-start):ocr.width;
  const headings=['YIELD','DONE','QUANTITY'].map(name=>headerWords.filter(w=>(upper(w.text)===name||(name==='QUANTITY'&&upper(w.text)==='QTY'))&&w.x>(name==='QUANTITY'?start:h.x)&&w.x<end).sort((a,b)=>a.x-b.x)[0]);
  const names=words.filter(w=>w.x>=start&&w.x<h.x&&w.y>h.y+h.height&&resourceNames.some(name=>upper(name)===upper(w.text)));
  for(const w of names){const name=resourceNames.find(name=>upper(name)===upper(w.text));const rowWords=words.filter(v=>v.x>=Math.min(h.x,headings[2]?.x??h.x)&&v.x<end&&Math.abs((v.y+v.height/2)-(w.y+w.height/2))<Math.max(w.height,v.height)*0.7);
   const at=anchor=>{if(!anchor)return null;const center=anchor.x+anchor.width/2;const near=rowWords.filter(v=>Math.abs(v.x+v.width/2-center)<Math.max(25,anchor.width*0.65)).sort((a,b)=>Math.abs(a.x+a.width/2-center)-Math.abs(b.x+b.width/2-center));return number(near[0])};
   const quality=at(h),yieldQty=at(headings[0]),doneQty=at(headings[1]),quantityQty=at(headings[2]);rows.push({job:job+1,name,quality,yieldQty,doneQty,quantityQty,finishedLayout:!!headings[2]&&!headings[1],raw:rowWords.sort((a,b)=>a.x-b.x).map(v=>v.text).join(' ')});
  }
 }
 return rows;
}
