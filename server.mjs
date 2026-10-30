import http from 'node:http';
import {readFile,writeFile,rename,mkdir,open,unlink} from 'node:fs/promises';
import {unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {validateCatalogue,validateSelections} from './validation.mjs';
import {syncResources,validateResources} from './resources.mjs';
import {emptyInventory,validateInventory,applyInventory} from './inventory.mjs';
import {syncComponents} from './components.mjs';
import {syncWeaponStats} from './weapon-stats.mjs';
import {recognizeUpload,stopOCR} from './ocr.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const data=process.env.LEDGER_DATA_DIR||path.join(root,'data');
let port=Number(process.env.LEDGER_PORT||8765),activeWrites=0,shuttingDown=false;
await mkdir(data,{recursive:true});
const lockPath=path.join(data,'backend.lock'),lockToken=crypto.randomUUID();
async function acquireLock(){
 try{const file=await open(lockPath,'wx');await file.writeFile(JSON.stringify({pid:process.pid,token:lockToken}));await file.close()}
 catch(e){if(e.code!=='EEXIST')throw e;const previous=JSON.parse(await readFile(lockPath,'utf8'));let alive=true;try{process.kill(previous.pid,0)}catch(error){if(error.code==='ESRCH')alive=false;else throw error}if(alive)throw Error('This data folder is already open. Close the previous Blueprint Ledger app or Start.cmd window first.');await unlink(lockPath);return acquireLock()}
}
await acquireLock();
process.on('exit',()=>{try{unlinkSync(lockPath)}catch{}});
async function load(name,fallback){try{return JSON.parse(await readFile(path.join(data,name),'utf8'))}catch(e){if(e.code==='ENOENT'&&fallback!==undefined)return fallback;throw e}}
async function save(name,value){activeWrites++;try{const p=path.join(data,name);await writeFile(p+'.tmp',JSON.stringify(value));await rename(p+'.tmp',p)}finally{activeWrites--}}
async function profile(){return await load('profile.json',null)||{selections:await load('selections.json',{}),inventory:emptyInventory()}}
let busy=false;
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>20000000)throw Error('File too large')}return JSON.parse(s)}
const server=http.createServer(async(req,res)=>{
 const send=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value))};
 try{
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))return send(403,{error:'Local access only'});
  if(req.method==='POST'&&![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(req.headers.origin))return send(403,{error:'Local origin required'});
  if(req.url==='/api/desktop/shutdown'&&req.method==='POST'){
   if(!process.env.LEDGER_DESKTOP_TOKEN||req.headers['x-ledger-control']!==process.env.LEDGER_DESKTOP_TOKEN)return send(403,{error:'Desktop control required'});
   shuttingDown=true;await stopOCR();while(activeWrites)await new Promise(resolve=>setTimeout(resolve,20));send(200,{ok:true});server.close();setTimeout(()=>process.exit(0),75);return;
  }
  if(shuttingDown)return send(503,{error:'Application is closing.'});
  if(req.url==='/api/state'&&req.method==='GET')return send(200,{catalogue:await load('catalogue.json'),selections:(await profile()).selections,meta:await load('meta.json',{})});
  if(req.url==='/api/inventory'&&req.method==='GET')return send(200,(await profile()).inventory);
  if(req.url==='/api/backup'&&req.method==='GET')return send(200,{format:'blueprint-ledger',version:2,exportedAt:new Date().toISOString(),...await profile()});
  if(req.url==='/api/resources'&&req.method==='GET')return send(200,await load('resources.json'));
  if(req.url==='/api/product-stats'&&req.method==='GET')return send(200,await load('weapon-stats.json'));
  if(req.url==='/api/components'&&req.method==='GET')return send(200,await load('components.json'));
  if(req.url.startsWith('/api/')&&req.method==='POST'){
   if(busy)return send(409,{error:'Another save is in progress. Try again.'});busy=true;
   try{
    if(req.url==='/api/ocr')return send(200,await recognizeUpload(await body(req)));
    if(req.url==='/api/inventory'){const request=await body(req),p=await profile();if(request.revision!==p.inventory.revision)return send(409,{error:'Stock changed in another tab. Reload inventory and try again.'});p.inventory=applyInventory(p.inventory,request.action);await save('profile.json',p);return send(200,p.inventory)}
    if(req.url==='/api/restore'){const request=await body(req),p=await profile();const selections=validateSelections(request.selections);const inventory=request.inventory?{...validateInventory(request.inventory),revision:p.inventory.revision+1}:p.inventory;await save('profile.json',{selections,inventory});return send(200,{selections,inventory})}
    if(req.url==='/api/sync-resources'){const resources=await syncResources();await save('resources.json',resources);return send(200,resources)}
    if(req.url==='/api/sync-product-stats'){const stats=await syncWeaponStats();await save('weapon-stats.json',stats);return send(200,stats)}
    if(req.url==='/api/sync-components'){const components=await syncComponents();await save('components.json',components);return send(200,components)}
    if(req.url==='/api/resources'){const resources=validateResources(await body(req));await save('resources.json',resources);return send(200,resources)}
    if(req.url==='/api/selections'){const value=validateSelections(await body(req)),p=await profile();p.selections=value;await save('profile.json',p);return send(200,{ok:true})}
    if(req.url==='/api/sync'){
     const response=await fetch('https://sccrafter.com/Blueprints.json',{signal:AbortSignal.timeout(30000)});
     if(!response.ok)throw Error('SCCrafter returned '+response.status);
     const catalogue=validateCatalogue(await response.json());await save('catalogue.json',catalogue);
     const meta={syncedAt:new Date().toISOString()};await save('meta.json',meta);return send(200,{catalogue,meta});
    }
    if(req.url==='/api/catalogue'){const catalogue=validateCatalogue(await body(req));await save('catalogue.json',catalogue);const meta={syncedAt:new Date().toISOString(),imported:true};await save('meta.json',meta);return send(200,{catalogue,meta})}
    return send(404,{error:'Unknown endpoint'});
   }finally{busy=false}
  }
  const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
  if(req.method!=='GET'||!files[req.url])return send(404,{error:'Not found'});
  res.writeHead(200,{'Content-Type':req.url.endsWith('.js')?'text/javascript':req.url.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store'});res.end(await readFile(path.join(root,'public',files[req.url])));
 }catch(e){send(400,{error:e.message})}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port 8765 is already in use. Close the previous Blueprint Ledger server and try again.':e.message);process.exitCode=1});
server.listen(port,'127.0.0.1',()=>{port=server.address().port;const url=`http://127.0.0.1:${port}`;console.log('Blueprint inventory: '+url);if(process.argv.includes('--open')&&process.platform==='win32')spawn('explorer.exe',[url],{windowsHide:true,stdio:'ignore'}).on('error',()=>console.log('Open '+url+' in your browser.'))});
