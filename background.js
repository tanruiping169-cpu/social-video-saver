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
async function add(id, entries, page) {
  if (!C.site(page)) return;
  let s=await state(id);
  if (s.page !== page) s={items:[],page};
  for (const raw of entries.slice(0,150)) {
    if(!raw||typeof raw!=='object')continue;
    const kind=C.classify(raw.url,raw.mime||'',['page','metadata'].includes(raw.source));
    if (!kind || typeof raw.url!=='string' || raw.url.length>12000) continue;
    const key=C.key(raw.url), old=s.items.find(i=>i.url===key);
    const item={id:old?.id||crypto.randomUUID(),url:key,kind,source:['page','metadata'].includes(raw.source)?raw.source:'network',
      group:typeof raw.group==='string'?raw.group.slice(0,120):C.asset(raw.url),quality:typeof raw.quality==='string'?raw.quality.slice(0,24):'',caption:typeof raw.caption==='string'?raw.caption.slice(0,100):'',
      adId:/^\d{5,30}$/.test(raw.adId||'')?raw.adId:'',
      width:Math.max(0,Number(raw.width)||0),height:Math.max(0,Number(raw.height)||0),
      duration:Math.max(0,Number(raw.duration)||0),seen:Date.now()};
    if (old) { if(old.source==='page'||old.source==='metadata') item.source=old.source; for(const k of ['adId','width','height','duration','group','quality','caption']) if(!item[k]) item[k]=old[k]; Object.assign(old,item); }
    else s.items.push(item);
  }
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
  const fromPopup=sender.url===chrome.runtime.getURL('popup.html');
  const job=async()=>{
    if(m.type==='found' && sender.tab && C.site(sender.url)) {
      const tab=await chrome.tabs.get(sender.tab.id);
      if(tab.active && (m.page||sender.url)===tab.url) await add(tab.id,Array.isArray(m.items)?m.items:[],tab.url);
      return {ok:true};
    }
    if(!fromPopup) throw Error('不允许的请求');
    const tab=await chrome.tabs.get(sender.tab?.id ?? m.tabId); if(!C.site(tab.url)) throw Error('请在支持的网站标签页打开插件');
    if(m.type==='list') {const s=await state(tab.id);return {ok:true,items:s.page===tab.url?s.items.filter(i=>!C.target(tab.url)||i.group===C.target(tab.url)):[]};}
    if(m.type==='clear') {await save(tab.id,{page:tab.url,items:[]});return {ok:true};}
    if(m.type==='download') {
      const s=await state(tab.id);const item=s.page===tab.url?s.items.find(i=>i.id===m.id):null;
      if(!item || !['mp4','webm'].includes(item.kind)) throw Error('这个条目不是可直接保存的视频文件');
      const downloadId=await chrome.downloads.download({url:item.url,filename:C.filename(item),saveAs:false,conflictAction:'uniquify'});
      return {ok:true,downloadId};
    }
    throw Error('未知请求');
  };
  serial(job).then(reply,e=>reply({ok:false,error:e.message}));return true;
});
