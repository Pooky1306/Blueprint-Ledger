import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const code=html.match(/<script>([\s\S]*)<\/script>/)[1];
function storage(){const memory=new Map();return {getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)}}
function flagCount(store,flag){const p=store.getItem('blueprint-ledger.profile.v2');return Object.values(p?JSON.parse(p).selections:JSON.parse(store.getItem('blueprint-ledger.selections.v1')||'{}')).filter(s=>s[flag]).length}
function database(){const values=new Map();const db={transaction(){const tx={objectStore:()=>({get(key){const r={result:values.get(key)};setTimeout(()=>tx.oncomplete(),0);return r},put(value,key){values.set(key,structuredClone(value));const r={};setTimeout(()=>tx.oncomplete(),0);return r}})};return tx}};return {open(){const r={result:db};setTimeout(()=>r.onsuccess(),0);return r}}}
async function open(localStorage,indexedDB){
 const nodes=new Map(),downloads=[];
 function element(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',disabled:false,files:[],handlers:{},addEventListener(type,handler){this.handlers[type]=handler},setAttribute(key,value){this[key]=value},scrollIntoView(){},click(){}});return nodes.get(id)}
 for(const id of [...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]))element(id);
 const context={crypto:webcrypto,document:{getElementById:element,querySelectorAll:()=>[...nodes.values()],createElement:()=>({click(){downloads.push(this.download)}})},location:{protocol:'file:'},localStorage,indexedDB,structuredClone,Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout,clearTimeout,confirm:()=>true,navigator:{clipboard:{writeText:async()=>{}}},console};
 await vm.runInNewContext(code,context);
 return {get:element,downloads,async flag(flag){const button={dataset:{flag},disabled:false,hasAttribute:()=>false};await element('list').handlers.click({target:{closest:selector=>selector==='button'?button:{dataset:{index:'0'}}}})}};
}
test('standalone HTML embeds all assets and catalogue; no module or external asset dependency',()=>{assert(!html.includes('src="/app.js"'));assert(!html.includes('href="/style.css"'));assert(!html.includes('type="module"'));assert(html.includes('const BUNDLED_CATALOGUE='));assert(html.includes('<style>'))});
test('direct-file app loads, searches, marks, reloads, imports catalogue and restores backup',async()=>{
 const localStorage=storage(),indexedDB=database();let app=await open(localStorage,indexedDB);
 assert.equal(app.get('results').textContent.split(' ')[0].replace(/\D/g,''),'1625');assert.equal(app.get('search').disabled,false);
 app.get('search').value='FS-9 Magazine';app.get('search').handlers.input();assert(app.get('results').textContent.startsWith('1 blueprints'));
 await app.flag('owned');await app.flag('wanted');assert.equal(flagCount(localStorage,'owned'),1);assert.equal(flagCount(localStorage,'wanted'),1);
 app=await open(localStorage,indexedDB);assert.equal(flagCount(localStorage,'owned'),1);assert.equal(flagCount(localStorage,'wanted'),1);
 await app.get('backup').onclick();assert.equal(app.downloads.length,1);
 // Import a changed catalogue, retaining selections under their stable IDs.
 app.get('importCatalogue').onclick();const seed=JSON.parse(await readFile(new URL('../data/catalogue.json',import.meta.url),'utf8'));seed.version='Test update';seed.blueprints.reverse();app.get('file').files=[{text:async()=>JSON.stringify(seed)}];await app.get('file').onchange();assert.equal(flagCount(localStorage,'owned'),1);
 app=await open(localStorage,indexedDB);assert(app.get('syncInfo').textContent.includes('Test update'));assert.equal(flagCount(localStorage,'owned'),1);
 app.get('restore').onclick();app.get('file').files=[{text:async()=>JSON.stringify({format:'blueprint-ledger',version:1,selections:{}})}];await app.get('file').onchange();assert.equal(flagCount(localStorage,'owned'),0);
 app.get('search').value='FS-9 Magazine';app.get('search').handlers.input();await app.flag('owned');await app.flag('owned');assert.equal(flagCount(localStorage,'owned'),0);
});
test('standalone resource view supports alias search, loot entries and independent resource imports',async()=>{
 const localStorage=storage(),indexedDB=database();let app=await open(localStorage,indexedDB);
 app.get('viewResources').onclick();assert.equal(app.get('resourceView').hidden,false);assert(app.get('resourceCount').textContent.includes('37 SCMiner minerals'));
 app.get('resourceSearch').value='Quantanium';app.get('resourceSearch').handlers.input();assert(app.get('resourceList').innerHTML.includes('Quantainium'));assert(!app.get('resourceList').innerHTML.includes('server-base value'));
 assert(app.get('resourceList').innerHTML.replaceAll('&#39;',"'").includes((3170*10).toLocaleString()));
 app.get('resourceList').handlers.click({target:{closest:()=>({dataset:{selectResource:'quantainium'}})}});assert(app.get('resourceDetail').innerHTML.includes('source: Quantanium'));assert.equal(app.get('resourceList').hidden,true);
 app.get('resourceSearch').value='';app.get('resourceType').value='loot';app.get('resourceType').handlers.change();assert(app.get('resourceList').innerHTML.includes('Lootable creature item'));
 const source=JSON.parse(await readFile(new URL('../data/resources.json',import.meta.url)));source.version='resource-test';app.get('resourceFile').files=[{text:async()=>JSON.stringify(source)}];await app.get('resourceFile').onchange();
 app=await open(localStorage,indexedDB);assert(app.get('resourceMeta').textContent.includes('resource-test'));assert.equal(app.get('results').textContent.split(' ')[0].replace(/\D/g,''),'1625');
});
test('clicking a location opens its resources and links back to blueprint requirements',async()=>{
 const app=await open(storage(),database());app.get('viewResources').onclick();
 app.get('resourceList').handlers.click({target:{closest:()=>({dataset:{location:JSON.stringify(['stanton','Aberdeen'])}})}});
 assert.equal(app.get('locationView').hidden,false);assert.equal(app.get('resourceView').hidden,true);assert(app.get('locationDetail').innerHTML.includes('Aberdeen'));assert(app.get('locationDetail').innerHTML.includes('Agricium'));
 app.get('locationDetail').handlers.click({target:{closest:()=>({dataset:{locationResource:'agricium'}})}});assert.equal(app.get('resourceView').hidden,false);assert(app.get('resourceDetail').innerHTML.includes('Required by 201 blueprints'));
 app.get('viewLocations').onclick();app.get('locationSearch').value='does-not-exist';app.get('locationSearch').handlers.input();assert(app.get('locationList').innerHTML.includes('No matching locations'));
});
test('owned-resource form persists, stacks, splits, moves, undoes, and keeps legacy BP flags',async()=>{
 const store=storage(),db=database();store.setItem('blueprint-ledger.selections.v1',JSON.stringify({'CraftingBlueprintRecord.legacy':{owned:true,wanted:false}}));let app=await open(store,db);app.get('viewStock').onclick();assert.equal(app.get('stockView').hidden,false);
 app.get('stockResource').value='gold';app.get('stockQuality').value='553';app.get('stockMain').value='Pyro';app.get('stockMain').onchange();app.get('stockRef').value='Ruin Station';
 for(const qty of ['40','60']){app.get('stockQuantity').value=qty;await app.get('stockAdd').onsubmit({preventDefault(){}})}
 let p=JSON.parse(store.getItem('blueprint-ledger.profile.v2'));assert.equal(p.inventory.stacks.length,1);assert.equal(p.inventory.stacks[0].units,10000);assert(p.selections['CraftingBlueprintRecord.legacy'].owned);
 app=await open(store,db);assert(app.get('stockList').innerHTML.includes('Gold'));const id=p.inventory.stacks[0].id;
 app.get('stockList').handlers.click({target:{closest:()=>({dataset:{stockId:id,stockOp:'move'}})}});app.get('editQuantity').value='25';app.get('editMain').value='Stanton';app.get('editMain').onchange();app.get('editRef').value='ARC-L1 (Wide Forest)';await app.get('stockEditForm').onsubmit({preventDefault(){}});
 p=JSON.parse(store.getItem('blueprint-ledger.profile.v2'));assert.equal(p.inventory.stacks.length,2);assert.equal(p.inventory.stacks.reduce((n,s)=>n+s.units,0),10000);
 await app.get('undoStock').onclick();p=JSON.parse(store.getItem('blueprint-ledger.profile.v2'));assert.equal(p.inventory.stacks.length,1);assert.equal(p.inventory.stacks[0].units,10000);
});
test('settings reset requires validation and config import preserves stock',async()=>{
 const store=storage(),db=database();store.setItem('blueprint-ledger.selections.v1',JSON.stringify({'CraftingBlueprintRecord.keep':{owned:true,wanted:false}}));const app=await open(store,db);
 app.get('viewSettings').onclick();assert.equal(app.get('settingsView').hidden,false);await app.get('resetData').onclick();assert.equal(flagCount(store,'owned'),1);
 app.get('configFile').files=[{text:async()=>JSON.stringify({format:'blueprint-ledger-config',version:1,preferences:{stockSort:'quality',stockDirection:-1},locations:[{mainLocation:'Pyro',refinery:'Custom store'}]})}];await app.get('configFile').onchange();const p=JSON.parse(store.getItem('blueprint-ledger.profile.v2'));assert.equal(p.inventory.preferences.stockSort,'quality');assert.equal(flagCount(store,'owned'),1);
 app.get('resourceRarity').value='legendary';app.get('resourceRarity').handlers.change();assert(app.get('resourceList').innerHTML.includes('Quantainium'));assert(!app.get('resourceList').innerHTML.includes('Agricium'));
 app.get('resetValidation').value='RESET';app.get('resetValidation').handlers.input();assert.equal(app.get('resetData').disabled,false);await app.get('resetData').onclick();assert.equal(flagCount(store,'owned'),0);assert.equal(JSON.parse(store.getItem('blueprint-ledger.profile.v2')).inventory.locations.length,0);
});
test('To craft tag, planning page, automatic allocation and reload persist without consuming stock',async()=>{
 const store=storage(),db=database();let app=await open(store,db);app.get('search').value='FS-9 Magazine';app.get('search').handlers.input();await app.flag('craft');app.get('status').value='craft';app.get('status').handlers.change();assert(app.get('list').innerHTML.includes('FS-9 Magazine'));
 for(const resource of ['iron','hephaestanite']){app.get('stockResource').value=resource;app.get('stockQuantity').value='3';app.get('stockQuality').value='800';app.get('stockMain').value='Pyro';app.get('stockMain').onchange();app.get('stockRef').value='Ruin Station';await app.get('stockAdd').onsubmit({preventDefault(){}})}
 app.get('viewCrafting').onclick();assert(app.get('craftList').innerHTML.includes('FS-9 Magazine'));await app.get('autoCraft').onclick();assert(app.get('craftTodo').innerHTML.includes('All selected requirements are assigned'));let p=JSON.parse(store.getItem('blueprint-ledger.profile.v2'));assert.equal(p.inventory.stacks.reduce((n,s)=>n+s.units,0),600);assert.equal(Object.keys(p.inventory.craftPlans).length,1);
 app=await open(store,db);app.get('viewCrafting').onclick();assert(app.get('craftTodo').innerHTML.includes('All selected requirements are assigned'));assert.equal(app.get('craftingView').hidden,false);
 const id=Object.keys(p.inventory.craftPlans)[0],button={hasAttribute:name=>name==='data-craft-expand'};
 assert(app.get('craftList').innerHTML.includes('aria-expanded="false"'));
 await app.get('craftList').handlers.click({target:{closest:selector=>selector==='button'?button:{dataset:{plan:id}}}});
 assert(app.get('craftList').innerHTML.includes('aria-expanded="true"'));
 await app.get('craftList').handlers.click({target:{closest:selector=>selector==='button'?button:{dataset:{plan:id}}}});
 assert(app.get('craftList').innerHTML.includes('aria-expanded="false"'));
});
test('blueprint type filter and component class/grade badges work together',async()=>{const app=await open(storage(),database());app.get('search').value='XL-1';app.get('bpType').value='cooler';app.get('bpType').handlers.change();assert(app.get('list').innerHTML.includes('No matching blueprints'));app.get('bpType').value='quantumdrive';app.get('bpType').handlers.change();assert(app.get('list').innerHTML.includes('XL-1'));assert(app.get('list').innerHTML.includes('Military · Grade A'));assert(app.get('list').innerHTML.includes('Quantum drive'))});

test('crafting quality simulation updates real stat estimates without writing personal data',async()=>{
 const store=storage(),app=await open(store,database());app.get('search').value='XL-1';app.get('search').handlers.input();await app.flag('craft');app.get('viewCrafting').onclick();
 const before=store.getItem('blueprint-ledger.profile.v2'),id=Object.keys(JSON.parse(before).selections).find(id=>JSON.parse(before).selections[id].craft),card={dataset:{plan:id}};
 const toggle={checked:true,closest:()=>card,hasAttribute:name=>name==='data-simulate'};
 await app.get('craftList').handlers.change({target:toggle});
 let markup=app.get('craftList').innerHTML;assert(markup.includes('Simulated targets'));assert(markup.includes('craft-ingredient-row'));assert(markup.includes('Military · Grade A'));
 const key=markup.match(/data-preview-quality="([^"]+)"/)[1],output={},stats={};card.querySelector=()=>stats;
 app.get('craftList').handlers.input({target:{value:'1000',dataset:{previewQuality:key},nextElementSibling:output,closest:()=>card,hasAttribute:name=>name==='data-preview-quality'}});
 assert.equal(output.textContent,'1000');assert(stats.innerHTML.includes('Simulated targets'));
 const high=stats.innerHTML;
 app.get('craftList').handlers.input({target:{value:'500',dataset:{previewQuality:key},nextElementSibling:output,closest:()=>card,hasAttribute:name=>name==='data-preview-quality'}});
 assert.notEqual(stats.innerHTML,high);assert.equal(store.getItem('blueprint-ledger.profile.v2'),before);
 toggle.checked=false;await app.get('craftList').handlers.change({target:toggle});assert(!app.get('craftList').innerHTML.includes('Simulated targets'));assert.equal(store.getItem('blueprint-ledger.profile.v2'),before);
});
