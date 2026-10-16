/* Shared pure helpers. No remote code or analytics. */
globalThis.MediaCore = (() => {
  const sites = ["facebook.com", "instagram.com", "pinterest.com", "pinterest.co.uk", "pinterest.ca", "pinterest.de", "pinterest.fr", "pinterest.jp", "tiktok.com"];
  const cdns = ["fbcdn.net", "cdninstagram.com", "pinimg.com", "tiktokcdn.com", "tiktokcdn-us.com", "tiktokv.com", "tiktokv.us", "byteoversea.com", "ibytedtos.com", "ibyteimg.com", "muscdn.com"];
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
  function filename(item) { return 'SocialVideos/' + (item.adId ? 'ad-'+item.adId : 'video') + '-' + (item.width&&item.height?item.width+'x'+item.height+'-':'') + item.id + '.' + item.kind; }

  function target(page) {
    const u=url(page);if(!u)return '';
    const pin=u.pathname.match(/^\/pin\/(\d+)/),tt=u.pathname.match(/\/video\/(\d+)/),ig=u.pathname.match(/\/(?:reel|reels|p)\/([^/]+)/);
    if(u.hostname.includes('pinterest.')&&pin)return 'pin:'+pin[1];
    if(match(u.hostname,['tiktok.com'])&&tt)return 'tt:'+tt[1];
    if(match(u.hostname,['instagram.com'])&&ig)return 'ig:'+ig[1];
    return '';
  }
  function asset(value) {
    const u=url(value);if(!u)return '';
    try {const encoded=u.searchParams.get('efg');if(encoded){const d=JSON.parse(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')));const id=d.xpv_asset_id||d.video_id;if(id)return 'meta:'+id;}}catch{}
    return '';
  }
  function variants(root,page) {
    const current=target(page), wanted=current.split(':')[1], roots=[], stack=[root];let visited=0;
    while(stack.length&&visited++<40000) {
      const o=stack.pop();if(!o||typeof o!=='object')continue;
      if(current && [o.id,o.pin_id,o.code,o.shortcode].some(v=>String(v)===wanted)){roots.push(o);continue;}
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
          if(typeof v==='string' && media(v) && (/\.(mp4|webm)(?:[?#]|$)/i.test(v)||/video_(sd|hd)_url|playAddr|downloadAddr|contentUrl/i.test(k)) && /video|play|download|contentUrl/i.test(here)) {
            const quality=/video_hd_url/i.test(k)?'HD':/video_sd_url/i.test(k)?'SD':(/V_(\d+)P/i.exec(here)?.[1]||'');
            result.push({url:v,source:'metadata',group,width:Number(o.width||o.dimensions?.width||r.dimensions?.width)||0,height:Number(o.height||o.dimensions?.height||r.dimensions?.height)||0,quality,caption:String(r.title||r.desc||'').slice(0,100)});
          }else if(v&&typeof v==='object')walk.push({o:v,path:here});
        }
      }
    }return result;
  }
  return {site, media, classify, key, filename,target,asset,variants};
})();
