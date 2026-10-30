import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
const children=new Set(),uploads=new Set();let stopping=false;
export async function stopOCR(){stopping=true;for(const child of children)child.kill();await Promise.allSettled([...uploads])}
export async function recognizeImage(imagePath){
 if(process.platform!=='win32')throw Error('Local screenshot OCR currently requires Windows.');
 const code=await readFile(new URL('./ocr.ps1',import.meta.url),'utf8');
 if(stopping)throw Error('The application is closing.');
 const request=run('powershell.exe',['-NoProfile','-NonInteractive','-Command',`& {${code}} -ImagePath $env:LEDGER_OCR_IMAGE`],{env:{...process.env,LEDGER_OCR_IMAGE:path.win32.normalize(imagePath)},windowsHide:true,timeout:45000,maxBuffer:4000000});children.add(request.child);
 try{const {stdout}=await request;return JSON.parse(stdout.trim())}
 catch(e){const detail=e.stderr?.split(/\r?\n/).find(l=>/^(StorageFile:|BitmapDecoder:|OcrResult:|Windows OCR|Image is too large)/.test(l));throw Error(detail||'Windows OCR could not read this image. Use a clear PNG/JPEG screenshot or enter the rows manually.')}
 finally{children.delete(request.child)}
}
export function recognizeUpload(data){const task=upload(data);uploads.add(task);task.then(()=>uploads.delete(task),()=>uploads.delete(task));return task}
async function upload(data){
 if(typeof data.image!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(data.image)||data.image.length>16000000)throw Error('Choose a PNG, JPEG or WebP image smaller than 12 MB.');
 const base=path.resolve(tmpdir()),dir=await mkdtemp(path.join(base,'blueprint-ledger-ocr-'));
 try{const file=path.join(dir,'screenshot.'+(data.image.startsWith('data:image/png')?'png':data.image.startsWith('data:image/webp')?'webp':'jpg'));await writeFile(file,Buffer.from(data.image.split(',')[1],'base64'));return await recognizeImage(file)}finally{if(path.dirname(path.resolve(dir))!==base||!path.basename(dir).startsWith('blueprint-ledger-ocr-'))throw Error('Unexpected temporary OCR path.');await rm(dir,{recursive:true,force:true})}
}
