const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const listeners={},messages=[],loc=new URL('https://www.instagram.com/reels/FIRST/');
class XHR{open(method,url){this.responseURL=url;}send(){}addEventListener(n,fn){this.loaded=fn;}}
let response;
const win={fetch:()=>Promise.resolve(response),addEventListener:(n,f)=>listeners[n]=f,postMessage:m=>messages.push(m)};
const ctx={window:win,location:loc,URL,XMLHttpRequest:XHR,atob};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../core.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../instagram-bridge.js'),'utf8'),ctx);
const video=(code,url)=>({code,video_versions:[{url,width:720,height:1280}],private_field:'must not cross bridge'});
const a=video('FIRST','https://a.cdninstagram.com/first.mp4'),b=video('SECOND','https://a.cdninstagram.com/second.mp4');
(async()=>{
response={url:'https://www.instagram.com/graphql/query',clone:()=>({text:async()=>JSON.stringify({data:[a,b]})})};
const original=await win.fetch('/graphql/query');assert.equal(original,response);
await new Promise(setImmediate);
assert.equal(messages.at(-1).item.code,'FIRST');assert(!JSON.stringify(messages).includes('private_field'));
loc.pathname='/reels/SECOND/';listeners.message({source:win,origin:loc.origin,data:{type:'SVS_INSTAGRAM_SCAN'}});
assert.equal(messages.at(-1).item.code,'SECOND');
assert.equal(ctx.MediaCore.variants(messages.at(-1).item,loc.href)[0].url,b.video_versions[0].url);
const count=messages.length;loc.pathname='/reels/UNKNOWN/';listeners.message({source:win,origin:loc.origin,data:{type:'SVS_INSTAGRAM_SCAN'}});assert.equal(messages.length,count);
loc.pathname='/p/CAROUSEL/';loc.search='?img_index=2';const xhr=new XHR();xhr.open('GET','https://www.instagram.com/api/v1/feed/');xhr.send();xhr.responseText=JSON.stringify({code:'CAROUSEL',carousel_media:[a,b]});xhr.loaded();
assert.equal(ctx.MediaCore.variants(messages.at(-1).item,loc.href)[0].url,b.video_versions[0].url);
const bad=new XHR();bad.open('GET','https://evil.test/api/');bad.send();bad.responseText=JSON.stringify(video('CAROUSEL','https://a.cdninstagram.com/evil.mp4'));bad.loaded();assert(!JSON.stringify(messages).includes('evil.mp4'));
console.log('Instagram SPA checks passed: fetch identity, navigation without reload, cached prefetch, current post filtering, carousel selection, XHR, data minimization, origin filtering');
})();
