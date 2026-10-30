let activeLocation='';
function openLocation(key){activeLocation=key;$('locationSearch').value='';$('locationSystem').value='';showView('locations');$('locationView').scrollIntoView({block:'start'})}
function renderLocations(){
 const all=indexLocations(resourceIndex),system=$('locationSystem').value,q=$('locationSearch').value.trim().toLowerCase();
 $('locationSystem').innerHTML='<option value="">All systems</option>'+[...new Set(all.map(l=>l.system))].map(s=>`<option value="${esc(s)}">${esc(s[0].toUpperCase()+s.slice(1))}</option>`).join('');$('locationSystem').value=system;
 const list=all.filter(l=>(!system||l.system===system)&&(!q||(l.name+' '+l.system).toLowerCase().includes(q)));
 if(!list.some(l=>l.key===activeLocation))activeLocation=list[0]?.key||'';
 $('locationCount').textContent=`${list.length} locations · SCMiner ${resourceData.version} · abundance values are per resource, not a combined deposit composition`;
 $('locationList').innerHTML=list.map(l=>`<button class="location-choice" data-select-location="${esc(l.key)}" aria-pressed="${l.key===activeLocation}"><span>${esc(l.name)}</span><small>${esc(l.system)} · ${l.resources.length} resources</small></button>`).join('')||'<p class="resource-caption">No matching locations.</p>';
 const l=list.find(l=>l.key===activeLocation);if(!l){$('locationDetail').innerHTML='<p>No location selected.</p>';return}
 $('locationDetail').innerHTML=`<div class="resource-title"><div><h2>${esc(l.name)}</h2><p>${esc(l.system)} · ${l.resources.length} available resources</p></div></div><p class="resource-caption">Resources reported by the synced SCMiner directory. Select a resource to see its properties and linked blueprints.</p><div class="location-table" role="table" aria-label="Resources at ${esc(l.name)}"><div class="location-table-head" role="row"><span role="columnheader">Resource / mining method</span><span role="columnheader">Abundance</span><span role="columnheader">Base RS</span><span role="columnheader">Blueprints</span></div>${l.resources.map(({resource:e,abundance})=>`<div class="location-table-row" role="row"><div role="cell"><button class="resource-link" data-location-resource="${esc(e.key)}">${esc(e.name)} →</button><small>${esc(miningMethod(e))}</small></div><strong role="cell">${esc(abundance)}%</strong><span role="cell">${e.mineral.scanSignature==null?'—':esc(e.mineral.scanSignature.toLocaleString())}</span><span role="cell">${usageBlueprints(e).length}</span></div>`).join('')}</div>`;
}
$('viewLocations').onclick=()=>showView('locations');
for(const id of ['locationSearch','locationSystem'])$(id).addEventListener(id==='locationSearch'?'input':'change',renderLocations);
$('locationList').addEventListener('click',e=>{const button=e.target.closest('button');if(button?.dataset.selectLocation){activeLocation=button.dataset.selectLocation;renderLocations()}});
$('locationDetail').addEventListener('click',e=>{const button=e.target.closest('button');if(button?.dataset.locationResource)openResource(button.dataset.locationResource)});
