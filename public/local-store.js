// Browser-only storage for double-clicked HTML. Server mode keeps using data/ files.
function createLocalApi(seed, validateCatalogue, validateSelections) {
 const selectionsKey='blueprint-ledger.selections.v1';
 const profileKey='blueprint-ledger.profile.v2';
 function profile(){const raw=localStorage.getItem(profileKey);return raw?JSON.parse(raw):{selections:JSON.parse(localStorage.getItem(selectionsKey)||'{}'),inventory:emptyInventory()}}
 let dbPromise;
 function db(){return dbPromise??=new Promise((resolve,reject)=>{
  const r=indexedDB.open('blueprint-ledger',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('catalogue');
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
 });}
 async function cached(value,key='current'){const database=await db();return new Promise((resolve,reject)=>{
  const tx=database.transaction('catalogue',value===undefined?'readonly':'readwrite');
  const store=tx.objectStore('catalogue');const request=value===undefined?store.get(key):store.put(value,key);
  tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Storage write aborted'));
 });}
 return async function(url,value){
  if(url==='components'){try{return (await cached(undefined,'components'))||BUNDLED_COMPONENTS}catch{return BUNDLED_COMPONENTS}}
  if(url==='sync-components'){const components=await syncComponents();await cached(components,'components');return components}
  if(url==='backup')return {format:'blueprint-ledger',version:2,exportedAt:new Date().toISOString(),...profile()};
  if(url==='inventory'&&value===undefined)return validateInventory(profile().inventory);
  if(url==='inventory'){const p=profile();if(value.revision!==p.inventory.revision)throw Error('Stock changed in another tab. Reload inventory.');p.inventory=applyInventory(p.inventory,value.action);localStorage.setItem(profileKey,JSON.stringify(p));return p.inventory}
  if(url==='restore'){const p=profile(),selections=validateSelections(value.selections),inventory=value.inventory?{...validateInventory(value.inventory),revision:p.inventory.revision+1}:p.inventory;localStorage.setItem(profileKey,JSON.stringify({selections,inventory}));return {selections,inventory}}
  if(url==='ocr')throw Error('Screenshot OCR needs the local Windows server. Open Start.cmd, then import the screenshot there.');
  if(url==='resources'&&value===undefined){try{return (await cached(undefined,'resources'))||BUNDLED_RESOURCES}catch{return BUNDLED_RESOURCES}}
  if(url==='sync-resources'){try{value=await syncResources()}catch(e){throw Error(e.message+' In direct-file mode, use Start.cmd for sync, then Export resources JSON and import it here.')}await cached(value,'resources');return value}
  if(url==='resources'){validateResources(value);await cached(value,'resources');return value}
  if(url==='state'){
   let stored;try{stored=await cached()}catch{/* Bundled catalogue remains available if IndexedDB is blocked. */}
   let selections;try{selections=validateSelections(profile().selections)}catch(e){throw Error('Browser selections could not be read: '+e.message)}
   return {catalogue:stored?.catalogue||seed,selections,meta:stored?.meta||{}};
  }
  if(url==='selections'){const p=profile();p.selections=validateSelections(value);localStorage.setItem(profileKey,JSON.stringify(p));return {ok:true};}
  if(url==='sync'){
   let response;try{response=await fetch('https://sccrafter.com/Blueprints.json',{signal:AbortSignal.timeout(30000)})}catch{throw Error('The browser could not download SCCrafter JSON. Use Start.cmd for server sync, or download Blueprints.json and use Import catalogue JSON.');}
   if(!response.ok)throw Error('SCCrafter returned '+response.status);
   value=await response.json();
  }
  if(url==='sync'||url==='catalogue'){
   const catalogue=validateCatalogue(value),meta={syncedAt:new Date().toISOString(),imported:url==='catalogue'};
   await cached({catalogue,meta});return {catalogue,meta};
  }
  throw Error('Unknown local action');
 };
}
