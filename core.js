/* Shared pure helpers. No remote code or analytics. */
globalThis.MediaCore = (() => {
  const sites = ["facebook.com", "instagram.com", "pinterest.com", "pinterest.co.uk", "pinterest.ca", "pinterest.de", "pinterest.fr", "pinterest.jp", "tiktok.com", "xiaohongshu.com"];
  const cdns = ["fbcdn.net", "cdninstagram.com", "pinimg.com", "tiktokcdn.com", "tiktokcdn-us.com", "tiktokv.com", "tiktokv.us", "byteoversea.com", "ibytedtos.com", "ibyteimg.com", "muscdn.com", "xhscdn.com"];
  const match = (h, list) => list.some(d => h === d || h.endsWith('.' + d));
  function url(value) { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u : null; } catch { return null; } }
  function site(value) { const u=url(value); return !!u && match(u.hostname, sites); }
  function media(value) { const u=url(value); return !!u && match(u.hostname, [...sites, ...cdns]); }
  function classify(value, mime='', fromVideo=false) {
    const u=url(value); if (!u || !media(value)) return null;
    const path=u.pathname.toLowerCase(); mime=mime.toLowerCase();
    if (/\.(m3u8|mpd)$/.test(path) || /mpegurl|dash\+xml/.test(mime)) return 'stream';
    if (/\.(m4s|ts|cmfv|cmfa)$/.test(path) || u.searchParams.has('bytestart') || u.searchParams.has('byteend')) return 'fragment';
    if (/mp2t/.test(mime)) return 'fragment';
    if (mime.startsWith('audio/')) return null;
    if (/\.(mp4|webm|mov)$/.test(path) || mime.startsWith('video/') || fromVideo) return path.endsWith('.webm') || mime.includes('webm') ? 'webm' : 'mp4';
    return null;
  }
  function key(value) { const u=url(value); return u ? u.href : ''; }
  function identity(item) {return [item.platform||'social',item.group||'',asset(item.url)||new URL(item.url).pathname,item.width+'x'+item.height].join(':');}
  function filename(item) {
    const clean=v=>String(v||'').normalize('NFKC').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/^[. ]+|[. ]+$/g,'').slice(0,70);
    return 'SocialVideos/'+[item.platform||'social',item.author||'unknown',item.group||item.adId||item.id,item.width&&item.height?item.width+'x'+item.height:'original'].map(clean).join('_')+'.'+item.kind;
  }

  function target(page) {
    const u=url(page);if(!u)return '';
    const pin=u.pathname.match(/^\/pin\/(\d+)/),tt=u.pathname.match(/\/video\/(\d+)/),ig=u.pathname.match(/\/(?:reel|reels|p)\/([^/]+)/);
    if(u.hostname.includes('pinterest.')&&pin)return 'pin:'+pin[1];
    if(match(u.hostname,['tiktok.com'])&&tt)return 'tt:'+tt[1];
    if(match(u.hostname,['instagram.com'])&&ig)return 'ig:'+ig[1];
    const xhs=u.pathname.match(/^\/(?:explore|discovery\/item)\/([a-f0-9]{24})(?:\/|$)/i);
    if(match(u.hostname,['xiaohongshu.com'])&&xhs)return 'xhs:'+xhs[1];
    return '';
  }
  function asset(value) {
    const u=url(value);if(!u)return '';
    try {const encoded=u.searchParams.get('efg');if(encoded){const d=JSON.parse(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')));const id=d.xpv_asset_id||d.video_id;if(id)return 'meta:'+id;}}catch{}
    return '';
  }
  function variants(root,page) {
    const current=target(page), wanted=current.split(':')[1], roots=[], stack=[root];let visited=0;
    if(current.startsWith('xhs:')){const note=root?.note?.noteDetailMap?.[wanted]?.note;if(note){roots.push(note);stack.length=0;}}
    while(stack.length&&visited++<40000) {
      const o=stack.pop();if(!o||typeof o!=='object')continue;
      if(current && [o.id,o.pin_id,o.entityId,o.code,o.shortcode,o.noteId].some(v=>String(v)===wanted)){roots.push(o);continue;}
      if(!current && (o.video_sd_url||o.video_hd_url)){roots.push(o);continue;}
      for(const value of Object.values(o))if(value&&typeof value==='object')stack.push(value);
    }
    const result=[];
    for(const original of roots){
      let r=original;
      if(current.startsWith('ig:')) {
        const carousel=original.carousel_media || original.edge_sidecar_to_children?.edges?.map(e=>e.node);
        if(Array.isArray(carousel)) {
          const selected=Math.max(0,(Number(new URL(page).searchParams.get('img_index'))||1)-1);
          if(selected>=carousel.length)continue;
          r=carousel[selected];
        }
      }
      const group=current||asset(r.video_sd_url||r.video_hd_url)||('meta:'+String(r.video_id||r.id||''));
      const walk=[{o:r,path:''}];let n=0;
      while(walk.length&&n++<5000){const {o,path}=walk.pop();if(!o||typeof o!=='object')continue;
        for(const [k,v] of Object.entries(o)){
          if(/related|recommend|carousel|comment|author|owner/i.test(k))continue;
          const here=path+'.'+k;
          if(typeof v==='string' && media(v) && (/\.(mp4|webm)(?:[?#]|$)/i.test(v)||/video_(sd|hd)_url|playAddr|downloadAddr|contentUrl/i.test(k)||current.startsWith('xhs:')&&/\.video\.media\.stream\./.test(here)&&(/masterUrl$/.test(here)||/backupUrls\.\d+$/.test(here))) && /video|play|download|contentUrl/i.test(here)) {
            const quality=current.startsWith('xhs:')?String(o.qualityType||''):/video_hd_url/i.test(k)?'HD':/video_sd_url/i.test(k)?'SD':(/V_(\d+)P/i.exec(here)?.[1]||'');
            result.push({poster:media(r.poster||r.display_url||r.image_versions2?.candidates?.[0]?.url)?(r.poster||r.display_url||r.image_versions2.candidates[0].url):'',author:String((typeof original.author==='string'?original.author:original.author?.uniqueId)||original.user?.username||original.user?.nickname||original.owner?.username||original.pinner?.username||'').slice(0,80),url:v,source:'metadata',group,width:Number(o.width||o.dimensions?.width||r.dimensions?.width)||0,height:Number(o.height||o.dimensions?.height||r.dimensions?.height)||0,quality,caption:String(r.title||r.desc||'').slice(0,100)});
          }else if(v&&typeof v==='object')walk.push({o:v,path:here});
        }
      }
    }return result;
  }
  function pinterestState(text) {
    const match=text.match(/^\s*window\.__PWS_RELAY_REGISTER_COMPLETED_REQUEST__\s*\(([\s\S]*)\)\s*;?\s*$/);
    if(!match)return null;
    try{const args=JSON.parse('['+match[1]+']');return args[1]&&typeof args[1]==='object'?args[1]:null;}catch{return null;}
  }
  function initialState(text) {
    // Accept a JSON object assignment only; never execute page scripts.
    const match=text.match(/^\s*(?:window\.)?__INITIAL_STATE__\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if(!match)return null;
    try {return JSON.parse(match[1].replace(/"(?:\\.|[^"\\])*"|\bundefined\b/g,token=>token==='undefined'?'null':token));}catch{return null;}
  }
  function errorMessage(code=''){
    if(/^NETWORK_/.test(code))return '网络连接中断，请检查网络后重试或续传。';
    if(/SERVER_UNAUTHORIZED|SERVER_FORBIDDEN/.test(code))return '视频地址已失效或需要登录，请回到原网页确认能播放，再重试。';
    if(/SERVER_BAD_CONTENT|SERVER_FAILED|SERVER_UNREACHABLE/.test(code))return '视频服务器暂时无法提供文件，请稍后重试。';
    if(code==='FILE_NO_SPACE')return '磁盘空间不足，请释放空间后重试。';
    if(code==='USER_CANCELED')return '下载已取消。';
    if(/^FILE_/.test(code))return '文件无法保存，请检查下载目录和磁盘权限。';
    return code?'操作未完成：'+code:'下载中断，请在任务列表中重试。';
  }
  return {pinterestState,errorMessage,identity,initialState,site, media, classify, key, filename,target,asset,variants};
})();
