// Observe only Pinterest's own JSON responses. Do not request endpoints or publish response bodies.
(() => {
 const cache=new Map();
 const valid=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&/(^|\.)pinimg\.com$/.test(u.hostname)&&/\.(mp4|webm)(?:$)/i.test(u.pathname);}catch{return false;}};
 function publish(){const id=location.pathname.match(/^\/pin\/(\d+)/)?.[1];if(id&&cache.has(id))window.postMessage({type:'SVS_PINTEREST_MEDIA',page:location.href,item:cache.get(id)},location.origin);}
 function collect(root){
  const stack=[root];let n=0;
  while(stack.length&&n++<40000){const o=stack.pop();if(!o||typeof o!=='object')continue;
   const id=String(o.entityId||o.pin_id||o.id||'');
   if(/^\d{5,30}$/.test(id)){
    const walk=[{o,path:''}],videos=[];let count=0;
    while(walk.length&&count++<5000&&videos.length<30){const {o:r,path}=walk.pop();if(!r||typeof r!=='object')continue;
     for(const [k,v] of Object.entries(r)){if(/related|recommend|comment|owner|author|pinner/i.test(k))continue;
      const here=path+'.'+k;
      if(typeof v==='string'&&valid(v)&&/video|play|download/i.test(here))videos.push({url:v,width:Number(r.width)||0,height:Number(r.height)||0});
      else if(v&&typeof v==='object')walk.push({o:v,path:here});
     }
    }
    if(videos.length){cache.delete(id);cache.set(id,{id,videos});}
   }
   for(const v of Object.values(o))if(v&&typeof v==='object')stack.push(v);
  }
  while(cache.size>60)cache.delete(cache.keys().next().value);publish();
 }
 function parse(text){if(typeof text!=='string'||text.length>6000000)return;try{collect(JSON.parse(text));}catch{for(const line of text.split('\n')){try{collect(JSON.parse(line));}catch{}}}}
 function allowed(value){try{const u=new URL(value,location.href);return u.origin===location.origin&&/^\/(?:resource\/|_\/graphql(?:\/|$)|graphql(?:\/|$)|api\/)/.test(u.pathname);}catch{return false;}}
 const original=window.fetch;
 window.fetch=function(...args){const promise=Reflect.apply(original,this,args);promise.then(r=>{if(allowed(r.url)){try{r.clone().text().then(parse).catch(()=>{});}catch{}}},()=>{});return promise;};
 const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send,urls=new WeakMap();
 XMLHttpRequest.prototype.open=function(...args){urls.set(this,args[1]);return Reflect.apply(open,this,args);};
 XMLHttpRequest.prototype.send=function(...args){this.addEventListener('load',()=>{try{if(!allowed(this.responseURL||urls.get(this)))return;if(this.responseType==='json')collect(this.response);else if(!this.responseType||this.responseType==='text')parse(this.responseText);}catch{}},{once:true});return Reflect.apply(send,this,args);};
 window.addEventListener('message',e=>{if(e.source===window&&e.origin===location.origin&&e.data?.type==='SVS_PINTEREST_SCAN')publish();});
})();
