const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let listener,host;
class El {
 constructor(tag){this.tag=tag;this.children=[];this.hidden=false;this.style={setProperty:(k,v)=>this.style[k]=v};}
 append(...els){this.children.push(...els);}
 attachShadow(){return this.shadow=new El('shadow');}
 setAttribute(){} addEventListener(){} focus(){} setPointerCapture(){} remove(){this.removed=true;}
 getBoundingClientRect(){return {left:parseFloat(this.style.left)||600,top:parseFloat(this.style.top)||96,width:300,height:420};}
}
const ctx={innerWidth:1000,innerHeight:800,window:{addEventListener(){},removeEventListener(){}},document:{createElement:t=>new El(t),documentElement:{append:e=>host=e}},chrome:{runtime:{getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:f=>listener=f}}}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../floating.js'),'utf8'),ctx);
const [style,panel,bubble]=host.shadow.children, [header,frame]=panel.children, [title,minimize,close]=header.children;
assert(panel.hidden);assert(!bubble.hidden);assert.equal(frame.src,'about:blank');
assert.equal(bubble.children[0].src,'chrome-extension://test/icons/icon48.png');
bubble.onclick();assert.equal(frame.src,'chrome-extension://test/popup.html');
minimize.onclick();assert(panel.hidden);assert(!bubble.hidden);assert.equal(frame.src,'about:blank');
bubble.onclick();assert(!panel.hidden);assert(bubble.hidden);assert.equal(frame.src,'chrome-extension://test/popup.html');
header.onpointerdown({target:{closest:()=>null},clientX:610,clientY:100,pointerId:1,preventDefault(){}});
header.onpointermove({clientX:-300,clientY:-300});assert.equal(host.style.left,'8px');assert.equal(host.style.top,'8px');
header.onpointerup();close.onclick();assert(panel.hidden);assert(!bubble.hidden);
listener({type:'show-float'},{},()=>{});assert(!panel.hidden);assert(bubble.hidden);
console.log('Floating default icon, expand, collapse, drag bounds and reopen checks passed');
minimize.onclick();
bubble.onpointerdown({clientX:610,clientY:100,pointerId:2,button:0});
bubble.onpointermove({clientX:100,clientY:250});
assert.equal(host.style.left,'90px');
bubble.onpointerup();assert.equal(host.style.left,'0px');assert.equal(host.style.right,'auto');
bubble.onclick({detail:1});assert(panel.hidden); // Drag must not open the panel.
bubble.onclick({detail:1});assert(!panel.hidden);
console.log('Free drag, left-edge snap and drag-click suppression passed');
