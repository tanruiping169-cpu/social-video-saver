importScripts('core.js');
const C=MediaCore;
let queue=Promise.resolve();
function serial(fn) { const next=queue.then(fn); queue=next.catch(console.error); return next; }
const tabKey=id=>'tab:'+id;
async function state(id) { return (await chrome.storage.session.get(tabKey(id)))[tabKey(id)] || {items:[],page:''}; }
async function save(id,s) {
  await chrome.storage.session.set({[tabKey(id)]:s});
  await chrome.action.setBadgeText({tabId:id,text:s.items.length ? String(s.items.length):''}).catch(()=>{});
  await chrome.action.setBadgeBackgroundColor({tabId:id,color:'#2563eb'}).catch(()=>{});
}
async function add(id, entries, page, replace=false) {
  if (!C.site(page)) return;
  let s=await state(id);
  if (s.page !== page) s={items:[],page};
  for (const raw of entries.slice(0,150)) {
    if(!raw||typeof raw!=='object')continue;
    const kind=C.classify(raw.url,raw.mime||'',['page','metadata'].includes(raw.source));
    if (!kind || typeof raw.url!=='string' || raw.url.length>12000) continue;
    const key=C.key(raw.url), old=s.items.find(i=>i.url===key);
    const hostname=new URL(page).hostname;const platform=['instagram','facebook','pinterest','tiktok','xiaohongshu'].find(name=>hostname.split('.').includes(name))||'social';
    const item={platform,author:typeof raw.author==='string'?raw.author.slice(0,80):'',id:old?.id||crypto.randomUUID(),url:key,kind,source:['page','metadata'].includes(raw.source)?raw.source:'network',
      group:typeof raw.group==='string'?raw.group.slice(0,120):C.asset(raw.url),quality:typeof raw.quality==='string'?raw.quality.slice(0,24):'',caption:typeof raw.caption==='string'?raw.caption.slice(0,100):'',
      adId:/^\d{5,30}$/.test(raw.adId||'')?raw.adId:'',
      width:Math.max(0,Number(raw.width)||0),height:Math.max(0,Number(raw.height)||0),
      poster:C.media(raw.poster)?raw.poster:'',
      duration:Math.max(0,Number(raw.duration)||0),seen:Date.now()};
    if (old) { if(old.source==='page'||old.source==='metadata') item.source=old.source; for(const k of ['adId','width','height','duration','group','quality','caption','poster','author']) if(!item[k]) item[k]=old[k]; Object.assign(old,item); }
    else s.items.push(item);
  }
  if(replace){const keys=new Set(entries.map(i=>C.key(i.url)));s.items=s.items.filter(i=>keys.has(i.url));}
  s.items=s.items.slice(-150); await save(id,s);
}
chrome.webRequest.onHeadersReceived.addListener(d=>{
  if(d.tabId<0 || d.statusCode<200 || d.statusCode>=300) return;
  const mime=d.responseHeaders?.find(h=>h.name.toLowerCase()==='content-type')?.value || '';
  if(!C.classify(d.url,mime)) return;
  serial(async()=>{const t=await chrome.tabs.get(d.tabId).catch(()=>null); if(t?.active) await add(d.tabId,[{url:d.url,mime,source:'network'}],t.url);});
},{urls:chrome.runtime.getManifest().host_permissions},['responseHeaders']);
chrome.tabs.onRemoved.addListener(id=>serial(()=>chrome.storage.session.remove(tabKey(id))));
chrome.tabs.onUpdated.addListener((id,info)=>{if(info.url) serial(async()=>{const s=await state(id);if(s.page!==info.url) await save(id,{page:info.url,items:[]});});});
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(sender.id!==chrome.runtime.id) return;
  const fromPopup=['popup.html','quick.html'].some(p=>sender.url===chrome.runtime.getURL(p));
  const job=async()=>{
    if(m.type==='found' && sender.tab && C.site(sender.url)) {
      const tab=await chrome.tabs.get(sender.tab.id);
      if(tab.active && (m.page||sender.url)===tab.url) await add(tab.id,Array.isArray(m.items)?m.items:[],tab.url,m.replace===true);
      return {ok:true};
    }
    if(m.type==='activity' && sender.tab && C.site(sender.url))return activity(sender.tab.id);
    if(sender.url===chrome.runtime.getURL('manager.html')){
      if(m.type==='allJobs')return activity();
      if(m.type==='clearFinishedJobs'){
        await activity();const jobs=await getJobs();
        await chrome.storage.local.set({jobs:jobs.filter(j=>j.state==='in_progress')});
        return {ok:true};
      }
      if(m.type==='jobAction'){
        const j=(await getJobs()).find(j=>j.id===m.downloadId);if(!j)throw Error('任务不存在');
        if(m.action==='cancel')await chrome.downloads.cancel(j.id);
        else if(m.action==='show')await chrome.downloads.show(j.id);
        else if(m.action==='retry')return recover(j,false);
        else throw Error('未知操作');return {ok:true};
      }
    }
    if(!fromPopup) throw Error('不允许的请求');
    const tab=await chrome.tabs.get(sender.tab?.id ?? m.tabId); if(!C.site(tab.url)) throw Error('请在支持的网站标签页打开插件');
    if(m.type==='downloadStatus'){const key='download:'+m.downloadId;const owner=(await chrome.storage.session.get(key))[key];if(owner!==tab.id)throw Error('不允许的下载记录');const [d]=await chrome.downloads.search({id:m.downloadId});return {ok:true,download:d?{state:d.state,error:d.error,bytesReceived:d.bytesReceived,totalBytes:d.totalBytes,canResume:d.canResume}:null};}
    if(m.type==='activity')return activity(tab.id);
    if(m.type==='retry'){const jobs=await getJobs();const old=jobs.find(j=>j.id===m.downloadId&&j.tabId===tab.id);if(!old||old.state!=='interrupted')throw Error('没有可重试的下载');return recover(old,false);}
    if(m.type==='list') {const history=(await chrome.storage.local.get('history')).history||{};const s=await state(tab.id);return {ok:true,items:s.page===tab.url?s.items.filter(i=>!C.target(tab.url)||i.group===C.target(tab.url)).map(i=>({...i,downloaded:!!history[C.identity(i)]})):[]};}
    if(m.type==='clear') {await save(tab.id,{page:tab.url,items:[]});return {ok:true};}
    if(m.type==='download') {
      const s=await state(tab.id);const item=s.page===tab.url?s.items.find(i=>i.id===m.id):null;
      if(!item || !['mp4','webm'].includes(item.kind)) throw Error('这个条目不是可直接保存的视频文件');
      return startDownload(tab.id,item);
    }
    throw Error('未知请求');
  };
  serial(job).then(reply,e=>reply({ok:false,error:e.message}));return true;
});

async function getJobs(){return (await chrome.storage.local.get('jobs')).jobs||[];}
async function startDownload(tabId,item){
 const key=C.identity(item);
 await activity(tabId);
 const jobs=await getJobs();
 const existing=jobs.find(j=>j.tabId===tabId&&j.key===key&&j.state==='in_progress');
 if(existing)return {ok:true,downloadId:existing.id};
 const id=await chrome.downloads.download({url:item.url,filename:C.filename(item),saveAs:false,conflictAction:'uniquify'});
 const tab=await chrome.tabs.get(tabId).catch(()=>null);
 jobs.push({id,tabId,page:tab?.url||'',key,item,state:'in_progress',bytesReceived:0,totalBytes:0,created:Date.now()});
 await chrome.storage.local.set({jobs:jobs.slice(-100)});
 await chrome.storage.session.set({['download:'+id]:tabId});return {ok:true,downloadId:id};
}
async function activity(tabId){
 const jobs=await getJobs(),history=(await chrome.storage.local.get('history')).history||{};
 const before=JSON.stringify({jobs,history});
 for(const j of jobs.filter(j=>tabId===undefined||j.tabId===tabId)){
  const [d]=await chrome.downloads.search({id:j.id});
  if(d){Object.assign(j,{state:d.state,error:d.error||'',bytesReceived:d.bytesReceived,totalBytes:d.totalBytes,canResume:!!d.canResume});if(d.state==='complete')history[j.key] ||= Date.now();}
  else if(j.state==='in_progress'){j.state='interrupted';j.error='下载记录已移除';}
 }
 const entries=Object.entries(history).sort((a,b)=>b[1]-a[1]).slice(0,500);
 const next={jobs,history:Object.fromEntries(entries)};if(JSON.stringify(next)!==before)await chrome.storage.local.set(next);
 return {ok:true,jobs:jobs.filter(j=>tabId===undefined||j.tabId===tabId).slice(-100).map(({item,key,...j})=>({...j,name:C.filename(item)}))};
}
chrome.downloads.onChanged.addListener(delta=>serial(async()=>{
 const jobs=await getJobs(),job=jobs.find(j=>j.id===delta.id);if(job){await activity(job.tabId);
 if(delta.state?.current==='interrupted'){const fresh=(await getJobs()).find(j=>j.id===job.id);if(fresh&&!fresh.recoveryAttempted&&/^(NETWORK_|SERVER_UNAUTHORIZED|SERVER_FORBIDDEN)/.test(fresh.error))await recover(fresh,true).catch(()=>{});}}

}));

async function recover(job,automatic){
 await activity(job.tabId);
 const jobs=await getJobs(),j=jobs.find(x=>x.id===job.id);
 if(!j||j.state!=='interrupted')throw Error('仅失败任务可以重试');
 if(automatic&&j.recoveryAttempted)return {ok:true};
 j.recoveryAttempted=true;await chrome.storage.local.set({jobs});
 if(j.canResume&&/^NETWORK_/.test(j.error)){await chrome.downloads.resume(j.id);return {ok:true,downloadId:j.id};}
 if(automatic&&/^NETWORK_/.test(j.error))return {ok:true};
 const tab=await chrome.tabs.get(j.tabId).catch(()=>null);
 if(!tab||tab.url!==j.page)throw Error('请先打开原视频页面，再重新检测下载');
 const data=await chrome.tabs.sendMessage(j.tabId,{type:'recover'}).catch(()=>null);
 if(!data||data.page!==tab.url)throw Error('未能读取当前视频，请重新检测');
 await add(j.tabId,data.items||[],tab.url,true);
 const current=await state(j.tabId);
 const replacement=current.items.find(i=>C.identity(i)===j.key);
 if(!replacement)throw Error('未找到同一视频与分辨率的新地址，请重新检测');
 if(automatic&&replacement.url===j.item.url)throw Error('链接尚未更新，请稍后手动重试');
 const result=await startDownload(j.tabId,replacement);
 if(automatic){const updated=await getJobs();const next=updated.find(x=>x.id===result.downloadId);if(next)next.recoveryAttempted=true;await chrome.storage.local.set({jobs:updated});}
 return result;
}
