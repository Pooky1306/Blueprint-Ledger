export const RESOURCE_SOURCE='https://scminer.rocks/data/mineral-directory';
export function resourceKey(name){
 const key=name.trim().toLowerCase().replaceAll('_',' ').replace(/\s+/g,' ');
 return ({aluminum:'aluminium',quantanium:'quantainium','pressurized ice':'ice','saldynium (ore)':'saldynium'})[key]||key;
}
export function validateResources(d){
 if(!d||typeof d.version!=='string'||typeof d.updatedAt!=='string'||!Array.isArray(d.minerals)||!d.minerals.length)throw Error('Expected SCMiner version, updatedAt, and minerals.');
 const keys=new Set();
 for(const m of d.minerals){
  if(!m||typeof m.name!=='string'||!m.name.trim()||typeof m.category!=='string'||typeof m.tier!=='string'||!m.props||!m.locations||typeof m.locations!=='object'||Array.isArray(m.locations)||!Array.isArray(m.values)||m.values.some(v=>!Number.isFinite(v))||!(m.scanSignature==null||Number.isFinite(m.scanSignature)))throw Error('Invalid SCMiner mineral record.');
  const key=resourceKey(m.name);if(keys.has(key))throw Error('Duplicate SCMiner mineral: '+m.name);keys.add(key);
  for(const field of ['value','instability','resistance','density'])if(typeof m.props[field]!=='string')throw Error('Invalid SCMiner properties.');
  for(const locations of Object.values(m.locations)){if(!Array.isArray(locations)||locations.some(l=>!l||typeof l.name!=='string'||!Number.isFinite(l.abundance)))throw Error('Invalid SCMiner locations.');}
 }
 return d;
}
// Decode only string literals passed to JSON.parse; never evaluate remote JavaScript.
export function extractResourceData(script){
 const re=/JSON\.parse\(\s*(['"])/g;let match;
 while((match=re.exec(script))){let text='',end=match.index+match[0].length,closed=false;
  for(;end<script.length;end++){let c=script[end];if(c===match[1]){closed=true;break}if(c==='\\'){c=script[++end];const escapes={'n':'\n','r':'\r','t':'\t','b':'\b','f':'\f','v':'\v','\\':'\\',"'":"'",'"':'"','/':'/'};if(Object.hasOwn(escapes,c))text+=escapes[c];else if(c==='u'||c==='x'){const length=c==='u'?4:2,hex=script.slice(end+1,end+1+length);if(!new RegExp('^[0-9a-fA-F]{'+length+'}$').test(hex))throw Error('Invalid source string escape');text+=String.fromCharCode(parseInt(hex,16));end+=length}else throw Error('Unsupported source string escape');}else text+=c;}
  if(closed){try{const value=JSON.parse(text);if(value?.minerals)return validateResources(value)}catch(e){if(text.includes('"minerals"'))throw e}}
  re.lastIndex=end+1;
 }
 return null;
}
export async function syncResources(fetcher=fetch){
 async function download(url){const r=await fetcher(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('SCMiner returned '+r.status);const text=await r.text();if(text.length>8000000)throw Error('SCMiner response too large');return text}
 const html=await download(RESOURCE_SOURCE);
 const urls=[...new Set([...html.matchAll(/<script\b[^>]*\bsrc="(\/_next\/static\/[^"?]+\.js)"/g)].map(m=>'https://scminer.rocks'+m[1]))];
 for(const url of urls){const result=extractResourceData(await download(url));if(result)return {...result,source:RESOURCE_SOURCE,syncedAt:new Date().toISOString()};}
 throw Error('SCMiner dataset was not found. Its page format may have changed; previous data was kept.');
}
export function indexResources(catalogue,source){
 const map=new Map(source.minerals.map(m=>[resourceKey(m.name),{key:resourceKey(m.name),name:m.name,mineral:m,usages:[],aliases:new Set()}]));
 for(const b of catalogue.blueprints)for(const [slotIndex,slot]of b.slots.entries())for(const [optionIndex,option]of slot.options.entries()){
  const name=option.resourceName||option.entityName,key=resourceKey(name);
  if(!map.has(key))map.set(key,{key,name,mineral:null,usages:[],aliases:new Set()});
  const entry=map.get(key);entry.aliases.add(name);entry.usages.push({blueprint:b,slot,option,slotIndex,optionIndex});
 }
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
export function indexLocations(entries){
 const locations=new Map();
 for(const resource of entries)for(const [system,list]of Object.entries(resource.mineral?.locations||{}))for(const place of list){
  const key=JSON.stringify([system,place.name]);if(!locations.has(key))locations.set(key,{key,system,name:place.name,resources:[]});
  locations.get(key).resources.push({resource,abundance:place.abundance});
 }
 return [...locations.values()].map(l=>({...l,resources:l.resources.sort((a,b)=>b.abundance-a.abundance||a.resource.name.localeCompare(b.resource.name))})).sort((a,b)=>a.system.localeCompare(b.system)||a.name.localeCompare(b.name));
}
