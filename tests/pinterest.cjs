const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const page='https://www.pinterest.com/pin/797770521539651833/',id='797770521539651833',url='https://v1.pinimg.com/videos/test_720w.mp4';
const pin={entityId:id,id:'UGluOmV4YW1wbGU=',storyPinData:{pages:[{blocks:[{video:{videoList:{v720P:{url,width:720,height:1280}}}}]}]}},root={data:{v3GetPinQueryv2:{data:pin}}};
const ctx={URL,atob};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../core.js'),'utf8'),ctx);const C=ctx.MediaCore;
const script='window.__PWS_RELAY_REGISTER_COMPLETED_REQUEST__("encoded-key", '+JSON.stringify(root)+');';
assert.equal(C.variants(C.pinterestState(script),page)[0].url,url);assert.equal(C.variants(root,page.replace(id,'999999999')).length,0);
assert.equal(C.pinterestState('window.__PWS_RELAY_REGISTER_COMPLETED_REQUEST__("x", alert(1));'),null);
assert.equal(C.pinterestState(script+'evil()'),null);
let listener,response,sent=[];const loc=new URL(page);const promise=()=>Promise.resolve(response);class XHR{open(){}send(){}addEventListener(){}}
Object.assign(ctx,{location:loc,window:{fetch:promise,postMessage:m=>sent.push(m),addEventListener:(n,f)=>listener=f},XMLHttpRequest:XHR});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../pinterest-bridge.js'),'utf8'),ctx);
(async()=>{response={url:'https://www.pinterest.com/_/graphql/',clone:()=>({text:async()=>JSON.stringify(root)})};await ctx.window.fetch('/_/graphql/');await new Promise(r=>setImmediate(r));assert.equal(sent.at(-1).item.videos[0].url,url);assert(!JSON.stringify(sent).includes('UGlu'));
loc.pathname='/pin/999999999/';sent=[];listener({source:ctx.window,origin:loc.origin,data:{type:'SVS_PINTEREST_SCAN'}});assert.equal(sent.length,0);
loc.pathname='/pin/'+id+'/';listener({source:ctx.window,origin:loc.origin,data:{type:'SVS_PINTEREST_SCAN'}});assert.equal(sent.length,1);
sent=[];response.url='https://untrusted.example/_/graphql/';await ctx.window.fetch('x');await new Promise(r=>setImmediate(r));assert.equal(sent.length,0);
console.log('Pinterest tests passed: Relay JSON, entityId, current pin isolation, no script execution, fetch observation and cached navigation');})();
