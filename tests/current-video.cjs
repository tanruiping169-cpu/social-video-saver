const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
let handler,found=[];
const loc=new URL('https://www.instagram.com/reels/FIRST/');
const video=(url,top,paused)=>({currentSrc:url,src:url,paused,videoWidth:720,videoHeight:1280,poster:'',duration:10,querySelectorAll:()=>[],getBoundingClientRect:()=>({width:300,height:500,left:0,right:300,top,bottom:top+500})});
let videos=[video('https://s.cdninstagram.com/first.mp4',10,false),video('https://s.cdninstagram.com/next.mp4',750,true)];
const ctx={URL,atob,location:loc,innerHeight:800,innerWidth:1000,window:{postMessage(){},addEventListener(){}},document:{hidden:false,documentElement:{},querySelectorAll:q=>q==='video'?videos:[],addEventListener(){}},MutationObserver:class{observe(){}},setInterval(){},setTimeout(){},chrome:{runtime:{sendMessage:async m=>found.push(m),onMessage:{addListener:f=>handler=f}}}};
vm.createContext(ctx);for(const f of ['core.js','content.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx);
const scan=()=>new Promise(resolve=>handler({type:'scan'},{},resolve));
(async()=>{await scan();assert.equal(found.at(-1).items.length,1);assert(found.at(-1).items[0].url.includes('first'));loc.pathname='/reels/SECOND/';await scan();assert.equal(found.at(-1).items.length,0);videos=[video('https://s.cdninstagram.com/second.mp4',10,false)];await scan();assert(found.at(-1).items[0].url.includes('second'));videos=[];await scan();assert.equal(found.at(-1).items.length,0);assert(found.at(-1).replace);console.log('Current video tests passed: visible playing target, stale route rejection, replacement and empty clearing');})();
