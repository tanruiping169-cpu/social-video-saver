const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
let handler,interval,mutate,parses=0,timers=[],messages=[];
const script={textContent:'{}'},events={},loc=new URL('https://www.instagram.com/reels/FIRST/');
const doc={hidden:false,documentElement:{},querySelectorAll:q=>q.startsWith('script[type=')?[script]:[],addEventListener:(name,fn)=>events[name]=fn};
const ctx={MediaCore:{target:url=>new URL(url).pathname,variants:()=>{parses++;return []},media:()=>false},location:loc,innerHeight:800,innerWidth:1000,window:{postMessage(){},addEventListener(){}},document:doc,MutationObserver:class{constructor(fn){mutate=fn}observe(){}},setInterval:fn=>interval=fn,setTimeout:fn=>{timers.push(fn);return 1},chrome:{runtime:{sendMessage:async m=>messages.push(m),onMessage:{addListener:f=>handler=f}}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../content.js'),'utf8'),ctx);
const scan=()=>new Promise(resolve=>handler({type:'scan'},{},resolve));
(async()=>{await scan();assert.equal(parses,1);script.textContent='{"new":true}';await scan();assert.equal(parses,2);loc.pathname='/reels/SECOND/';await scan();assert.equal(parses,3);doc.hidden=true;mutate();interval();assert.equal(timers.length,0);doc.hidden=false;events.visibilitychange();assert.equal(timers.length,1);timers.shift()();interval();timers.shift()();interval();assert.equal(timers.length,0);console.log('Scan efficiency tests passed: script cache, text and route invalidation, hidden pause, unchanged probe');})();
