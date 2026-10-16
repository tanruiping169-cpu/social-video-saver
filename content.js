(() => {
  const C=MediaCore; let timer; let lastPage=location.href; const sent=new Map();
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
  async function scan(force=false) {
    if(lastPage!==location.href){sent.clear();lastPage=location.href;}
    const items=[];let blobs=0;
    for(const v of document.querySelectorAll('video')) {
      const rect=v.getBoundingClientRect();
      if(C.target(location.href) && (rect.width<30||rect.height<30||rect.bottom<0||rect.top>innerHeight))continue;
      const urls=new Set([v.currentSrc,v.src,...[...v.querySelectorAll('source')].map(s=>s.src)]);
      for(const url of urls) {
        if(url.startsWith('blob:')) {blobs++;continue;}
        if(!C.classify(url,'',true)) continue;
        const item={url,source:'page',group:C.target(location.href)||C.asset(url),adId:adId(v),width:v.videoWidth,height:v.videoHeight,duration:Number.isFinite(v.duration)?v.duration:0};
        const signature=JSON.stringify(item);
        if(force||sent.get(url)!==signature){items.push(item);sent.set(url,signature);}
      }
    }
    // Public page metadata can provide a progressive file while the player uses blob/HLS.
    const metadata=[];
    const current=C.target(location.href);
    for(const el of document.querySelectorAll('meta[property^="og:video"],meta[name="twitter:player:stream"]')) {
      if(C.media(el.content))metadata.push({url:el.content,source:'metadata',group:current});
    }
    for(const el of document.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]')) {
      if(el.textContent.length>3000000)continue;
      try {metadata.push(...C.variants(JSON.parse(el.textContent),location.href));}catch{}
    }
    if(location.hostname==='www.xiaohongshu.com'||location.hostname==='xiaohongshu.com'){
      for(const el of document.querySelectorAll('script:not([src])')){if(el.textContent.length>3000000)continue;const data=C.initialState(el.textContent);if(data)metadata.push(...C.variants(data,location.href));}
    }
    for(const item of metadata) {
      if(!['mp4','webm'].includes(C.classify(item.url,'',true)))continue;
      const signature=JSON.stringify(item);
      if(force||sent.get(item.url)!==signature){items.push(item);sent.set(item.url,signature);}
    }
    if(sent.size>300) sent.clear();
    if(items.length) await chrome.runtime.sendMessage({type:'found',items,page:location.href}).catch(()=>{});
    return {videos:document.querySelectorAll('video').length,blobs};
  }
  function schedule(){if(timer)return;timer=setTimeout(()=>{timer=null;scan();},600);}
  new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
  for(const name of ['loadedmetadata','play','durationchange']) document.addEventListener(name,schedule,true);
  chrome.runtime.onMessage.addListener((m,s,reply)=>{if(m.type==='scan'){scan(true).then(reply);return true;}});
  scan();
})();
