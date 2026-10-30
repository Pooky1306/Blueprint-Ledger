import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../public/desktop-ui.js',import.meta.url),'utf8');
function page(){const nodes=new Map();return {nodes,document:{getElementById(id){if(!nodes.has(id))nodes.set(id,{hidden:true,setAttribute(key,value){this[key]=value}});return nodes.get(id)},documentElement:{classList:{add(){}}}}}}
test('browser mode never exposes native window controls',()=>{const p=page();vm.runInNewContext(code,{document:p.document});assert.equal(p.nodes.size,0)});
test('desktop buttons send window commands and maximize updates the restore label',()=>{
 const p=page(),messages=[],listeners={};vm.runInNewContext(code,{document:p.document,chrome:{webview:{postMessage:m=>messages.push(m),addEventListener:(name,handler)=>listeners[name]=handler}}});
 assert.equal(p.nodes.get('windowControls').hidden,false);assert.deepEqual(messages,['ledger:ready']);
 for(const action of ['minimize','maximize','close'])p.nodes.get('window'+action).onclick();assert.deepEqual(messages.slice(1),['ledger:minimize','ledger:maximize','ledger:close']);
 listeners.message({data:{type:'ledger-window-state',maximized:true}});assert.equal(p.nodes.get('windowmaximize')['aria-label'],'Restore window');
 listeners.message({data:{type:'ledger-window-state',maximized:false}});assert.equal(p.nodes.get('windowmaximize')['aria-label'],'Maximize window');
});
