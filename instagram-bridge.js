// Observe Instagram's own responses; never issue requests or expose response bodies.
(() => {
  const cache=new Map();
  const valid=u=>{try{const x=new URL(u);return x.protocol==='https:'&& !x.username&&!x.password&& /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(x.hostname);}catch{return false;}};
  function media(o,depth=0){
    if(!o||typeof o!=='object'||depth>2)return null;
    const r={}; if(typeof o.user?.username==='string'||typeof o.owner?.username==='string')r.author=o.user?.username||o.owner.username;
    const poster=o.image_versions2?.candidates?.[0]?.url||o.display_url;if(valid(poster))r.poster=poster;
    if(valid(o.video_url))r.video_url=o.video_url;
    if(Array.isArray(o.video_versions))r.video_versions=o.video_versions.slice(0,20).filter(v=>valid(v.url)).map(v=>({url:v.url,width:Number(v.width)||0,height:Number(v.height)||0}));
    if(o.dimensions)r.dimensions={width:Number(o.dimensions.width)||0,height:Number(o.dimensions.height)||0};
    const children=o.carousel_media||o.edge_sidecar_to_children?.edges?.map(e=>e.node);
    if(Array.isArray(children))r.carousel_media=children.slice(0,30).map(v=>media(v,depth+1)||{});
    return Object.keys(r).length?r:null;
  }
  function publish(){
    const code=location.pathname.match(/\/(?:p|reel|reels)\/([^/]+)/)?.[1];
    if(code&&cache.has(code))window.postMessage({type:'SVS_INSTAGRAM_MEDIA',page:location.href,item:cache.get(code)},location.origin);
  }
  function collect(root){
    const stack=[root];let n=0;
    while(stack.length&&n++<40000){const o=stack.pop();if(!o||typeof o!=='object')continue;
      const code=o.code||o.shortcode;
      if(typeof code==='string'&&/^[\w-]{1,80}$/.test(code)){const r=media(o);if(r){cache.delete(code);cache.set(code,{code,...r});}}
      for(const v of Object.values(o))if(v&&typeof v==='object')stack.push(v);
    }
    while(cache.size>60)cache.delete(cache.keys().next().value);
    publish();
  }
  function parse(text){if(typeof text!=='string'||text.length>6000000)return;
    text=text.replace(/^for\s*\(;;\);\s*/,'');
    try{collect(JSON.parse(text));}catch{for(const line of text.split('\n')){try{collect(JSON.parse(line));}catch{}}}
  }
  function allowed(value){try{const u=new URL(value,location.href);return u.origin===location.origin&&/\/graphql|\/api\//.test(u.pathname);}catch{return false;}}
  const originalFetch=window.fetch;
  window.fetch=function(...args){const promise=Reflect.apply(originalFetch,this,args);promise.then(r=>{
    if(allowed(r.url)){try{r.clone().text().then(parse).catch(()=>{});}catch{}}
  },()=>{});return promise;};
  const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send,urls=new WeakMap();
  XMLHttpRequest.prototype.open=function(...args){urls.set(this,args[1]);return Reflect.apply(open,this,args);};
  XMLHttpRequest.prototype.send=function(...args){
    this.addEventListener('load',()=>{try{if(!allowed(this.responseURL||urls.get(this)))return;if(this.responseType==='json')collect(this.response);else if(!this.responseType||this.responseType==='text')parse(this.responseText);}catch{}},{once:true});
    return Reflect.apply(send,this,args);
  };
  window.addEventListener('message',e=>{if(e.source===window&&e.origin===location.origin&&e.data?.type==='SVS_INSTAGRAM_SCAN')publish();});
})();
