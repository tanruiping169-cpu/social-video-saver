(() => {
  const C=MediaCore; let timer; let lastPage=location.href; const sent=new Map(); const sourceOwners=new Map(); const dynamic=new Map(); const initialTarget=C.target(location.href); const scriptCache=new WeakMap(); let lastProbe="";
  function adId(video) {
    if(!location.hostname.endsWith('facebook.com') || !location.pathname.startsWith('/ads/library')) return '';
    for(let el=video.parentElement,n=0;el&&n<22;el=el.parentElement,n++) {
      if(el.querySelectorAll('video').length>1) break;
      const text=el.innerText||'';
      const hits=[...text.matchAll(/(?:Library ID|资料库编号|廣告檔案庫編號)\s*[:：]?\s*(\d{5,30})/gi)];
      if(hits.length===1) return hits[0][1];
      if(hits.length>1) break;
    }return '';
  }
  async function scan(force=false,collectOnly=false) {
    force=true; // Each scan replaces the visible-page snapshot, including unchanged entries.
    if(lastPage!==location.href){sent.clear();lastPage=location.href;}
    const items=[];let blobs=0;
    if(location.hostname.endsWith('instagram.com')) window.postMessage({type:'SVS_INSTAGRAM_SCAN'},location.origin);
    if(C.target(location.href).startsWith('pin:'))window.postMessage({type:'SVS_PINTEREST_SCAN'},location.origin);
    const videos=[...document.querySelectorAll('video')];
    const visible=videos.map(v=>({v,r:v.getBoundingClientRect()})).filter(({r})=>r.width>=30&&r.height>=30&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth);
    visible.sort((a,b)=>{const score=({v,r})=>Math.min(r.bottom,innerHeight)-Math.max(r.top,0)+(v.paused?0:innerHeight);return score(b)-score(a);});
    const selected=C.target(location.href)?visible.slice(0,1).map(x=>x.v):visible.map(x=>x.v);
    for(const v of selected) {
      const rect=v.getBoundingClientRect();
      if(C.target(location.href) && (rect.width<30||rect.height<30||rect.bottom<0||rect.top>innerHeight))continue;
      const urls=new Set([v.currentSrc,v.src,...[...v.querySelectorAll('source')].map(s=>s.src)]);
      for(const url of urls) {
        if(url.startsWith('blob:')) {blobs++;continue;}
        if(!C.classify(url,'',true)) continue;
        const owner=C.target(location.href);if(owner&&sourceOwners.has(url)&&sourceOwners.get(url)!==owner)continue;
        if(owner)sourceOwners.set(url,owner);if(sourceOwners.size>300)sourceOwners.delete(sourceOwners.keys().next().value);
        const item={url,source:'page',group:C.target(location.href)||C.asset(url),adId:adId(v),width:v.videoWidth,height:v.videoHeight,poster:v.poster,duration:Number.isFinite(v.duration)?v.duration:0};
        const signature=JSON.stringify(item);
        if(force||sent.get(url)!==signature){items.push(item);sent.set(url,signature);}
      }
    }
    // Cache parsed script variants by text and route; navigation invalidates the result.
    function scriptVariants(el,initial=false){
      const text=el.textContent;if(text.length>3000000)return [];
      const previous=scriptCache.get(el);
      if(previous?.text===text&&previous.page===location.href)return previous.items;
      let items=[];try{const data=initial==='pin'?C.pinterestState(text):initial?C.initialState(text):JSON.parse(text);if(data)items=C.variants(data,location.href);}catch{}
      scriptCache.set(el,{text,page:location.href,items});return items;
    }
    // Public page metadata can provide a progressive file while the player uses blob/HLS.
    const metadata=[];
    const cached=dynamic.get(C.target(location.href));
    if(cached)metadata.push(...C.variants(cached,location.href));
    const current=C.target(location.href);
    for(const el of document.querySelectorAll('meta[property^="og:video"],meta[name="twitter:player:stream"]')) {
      if(C.target(location.href)===initialTarget&&C.media(el.content))metadata.push({url:el.content,source:'metadata',group:current});
    }
    for(const el of document.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]')) {
      metadata.push(...scriptVariants(el));
    }
    if(current.startsWith('pin:'))for(const el of document.querySelectorAll('script[data-relay-completed-request]'))metadata.push(...scriptVariants(el,'pin'));
    if(location.hostname==='www.xiaohongshu.com'||location.hostname==='xiaohongshu.com'){
      for(const el of document.querySelectorAll('script:not([src])')){metadata.push(...scriptVariants(el,true));}
    }
    for(const item of metadata) {
      if(!['mp4','webm'].includes(C.classify(item.url,'',true)))continue;
      const signature=JSON.stringify(item);
      if(force||sent.get(item.url)!==signature){items.push(item);sent.set(item.url,signature);}
    }
    if(sent.size>300) sent.clear();
    if(!collectOnly) await chrome.runtime.sendMessage({type:'found',items,page:location.href,replace:true}).catch(()=>{});
    return {videos:videos.length,blobs,items,page:location.href};
  }
  window.addEventListener('message',e=>{
    if(e.source!==window||e.origin!==location.origin||e.data?.type!=='SVS_PINTEREST_MEDIA'||e.data.page!==location.href)return;
    const item=e.data.item,target=C.target(location.href);
    if(!target.startsWith('pin:')||item?.id!==target.slice(4))return;
    let signature;try{signature=JSON.stringify(item);}catch{return;}
    if(signature.length>200000||JSON.stringify(dynamic.get(target))===signature)return;
    dynamic.set(target,item);while(dynamic.size>20)dynamic.delete(dynamic.keys().next().value);schedule();
  });
  window.addEventListener('message',e=>{
    if(e.source!==window||e.origin!==location.origin||e.data?.type!=='SVS_INSTAGRAM_MEDIA'||e.data.page!==location.href)return;
    const item=e.data.item,target=C.target(location.href);
    if(!target.startsWith('ig:')||item?.code!==target.slice(3))return;
    let signature;try{signature=JSON.stringify(item);}catch{return;}
    if(signature.length>200000||JSON.stringify(dynamic.get(target))===signature)return;
    dynamic.set(target,item);while(dynamic.size>20)dynamic.delete(dynamic.keys().next().value);schedule();
  });
  function schedule(){if(document.hidden||timer)return;timer=setTimeout(()=>{timer=null;scan();},600);}
  new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src','poster']});
  for(const name of ['loadedmetadata','play','durationchange']) document.addEventListener(name,schedule,true);
  chrome.runtime.onMessage.addListener((m,s,reply)=>{if(m.type==='scan'||m.type==='recover'){scan(true,m.type==='recover').then(reply);return true;}});
  function probe(){
    if(document.hidden)return;
    const signature=JSON.stringify([location.href,...[...document.querySelectorAll('video')].map(v=>{const r=v.getBoundingClientRect();return [v.currentSrc,v.src,v.poster,v.videoWidth,v.videoHeight,v.paused,Math.round(r.top/30),Math.round(r.left/30)];})]);
    if(signature!==lastProbe){lastProbe=signature;schedule();}
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastProbe='';schedule();}});
  document.addEventListener('scroll',schedule,true);
  setInterval(probe,2000);
  scan();
})();
