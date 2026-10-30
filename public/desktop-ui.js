// Desktop-only controls; browser and standalone views keep their normal chrome.
const desktopBridge=globalThis.chrome?.webview;
if(desktopBridge){
 document.getElementById('windowControls').hidden=false;
 document.documentElement.classList.add('desktop-window');
 for(const action of ['minimize','maximize','close'])document.getElementById('window'+action).onclick=()=>desktopBridge.postMessage('ledger:'+action);
 desktopBridge.addEventListener('message',event=>{
  if(event.data?.type!=='ledger-window-state')return;
  const maximized=!!event.data.maximized,button=document.getElementById('windowmaximize');
  button.setAttribute('aria-label',maximized?'Restore window':'Maximize window');
  button.title=maximized?'Restore window':'Maximize window';
  button.setAttribute('data-maximized',String(maximized));
 });
 desktopBridge.postMessage('ledger:ready');
}
