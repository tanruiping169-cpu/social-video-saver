// Page-side shell only; media controls run in an isolated extension frame.
(() => {
  let host, panel, frame, bubble; let side="right";
  function collapse(){panel.hidden=true;bubble.hidden=false;frame.src="about:blank";dock();}
  function expand(){frame.src=chrome.runtime.getURL("popup.html");panel.hidden=false;bubble.hidden=true;host.style.setProperty("left",side==="left"?"8px":"auto","important");host.style.setProperty("right",side==="right"?"8px":"auto","important");clamp();}
  function dock(){const y=host.getBoundingClientRect().top;host.style.setProperty("left",side==="left"?"0px":"auto","important");host.style.setProperty("right",side==="right"?"0px":"auto","important");bubble.style.borderRadius=side==="left"?"0 24px 24px 0":"24px 0 0 24px";host.style.setProperty("top",Math.max(8,Math.min(y,innerHeight-56))+"px","important");}
  function open(expanded=false) {
    if (host) { if(expanded)expand(); return; }
    host=document.createElement('div');
    host.style.cssText='all:initial!important;position:fixed!important;right:0px!important;top:40vh!important;z-index:2147483647!important;';
    const shadow=host.attachShadow({mode:'closed'});
    const style=document.createElement('style');
    style.textContent='*{box-sizing:border-box}section{width:min(300px,calc(100vw - 24px));background:#f4f6fa;border:1px solid #ced7e5;border-radius:12px;box-shadow:0 8px 28px #0003;overflow:hidden}header{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#142741;color:white;font:12px system-ui;cursor:move;touch-action:none}span{flex:1}button{font:14px system-ui;border:0;border-radius:6px;padding:4px 8px;cursor:pointer;background:#e4eaf3;color:#17243b}iframe{display:block;border:0;width:100%;height:min(380px,calc(100vh - 150px))}#bubble{display:grid;place-items:center;width:48px;height:48px;border-radius:24px 0 0 24px;background:#fff;padding:4px;box-shadow:0 2px 10px #0001;touch-action:none;cursor:grab;opacity:.35;transition:opacity .2s ease,box-shadow .2s ease}#bubble:hover,#bubble:focus-visible,#bubble:active{opacity:1;box-shadow:0 2px 12px #0002}#bubble img{width:40px;height:40px;pointer-events:none}button:focus-visible{outline:3px solid #2563eb;outline-offset:2px} [hidden]{display:none!important}';
    panel=document.createElement('section');
    const header=document.createElement('header'),title=document.createElement('span');title.textContent='视频下载 · 拖动移动';
    const minimize=document.createElement('button');minimize.textContent='−';minimize.title='收起悬浮窗';minimize.setAttribute('aria-label',minimize.title);
    const close=document.createElement('button');close.textContent='×';close.title='关闭悬浮窗';close.setAttribute('aria-label',close.title);
    frame=document.createElement('iframe');frame.src='about:blank';frame.title='社媒视频下载悬浮窗';
    bubble=document.createElement('button');bubble.id='bubble';bubble.title='展开视频下载（可拖动）';bubble.setAttribute('aria-label','展开视频下载');const icon=document.createElement('img');icon.src=chrome.runtime.getURL('icons/icon48.png');icon.alt='';bubble.append(icon);panel.hidden=true;
    minimize.onclick=collapse;
    close.title='收起到图标';close.setAttribute('aria-label',close.title);close.onclick=collapse;
    let moved=false,start;
    bubble.onpointerdown=e=>{if(e.button!==undefined&&e.button!==0)return;moved=false;const r=host.getBoundingClientRect();start={x:e.clientX,y:e.clientY,left:r.left,top:r.top};bubble.setPointerCapture(e.pointerId);bubble.style.opacity='1';};
    bubble.onpointermove=e=>{if(!start)return;if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>4)moved=true;if(moved){host.style.setProperty('right','auto','important');host.style.setProperty('left',Math.max(0,Math.min(start.left+e.clientX-start.x,innerWidth-48))+'px','important');host.style.setProperty('top',Math.max(8,Math.min(start.top+e.clientY-start.y,innerHeight-56))+'px','important');}};
    bubble.onpointerup=bubble.onpointercancel=()=>{if(start&&moved)side=host.getBoundingClientRect().left+24<innerWidth/2?'left':'right';start=null;bubble.style.opacity='';dock();};
    bubble.onclick=e=>{if(moved&&e?.detail!==0){moved=false;return;}expand();};
    shadow.addEventListener('keydown',e=>{if(e.key==='Escape'){collapse();bubble.focus();}});
    header.append(title,minimize,close);panel.append(header,frame);shadow.append(style,panel,bubble);document.documentElement.append(host);
    let drag;
    header.onpointerdown=e=>{if(e.target.closest('button'))return;const r=host.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top};header.setPointerCapture(e.pointerId);e.preventDefault();};
    header.onpointermove=e=>{if(!drag)return;host.style.setProperty('right','auto','important');host.style.setProperty('left',drag.left+e.clientX-drag.x+'px','important');host.style.setProperty('top',drag.top+e.clientY-drag.y+'px','important');clamp();};
    header.onpointerup=header.onpointercancel=()=>{drag=null;};
    window.addEventListener('resize',()=>{if(panel.hidden)dock();else clamp();});if(expanded)expand();else dock();
  }
  function clamp(){if(!host)return;const r=host.getBoundingClientRect();host.style.setProperty('right','auto','important');host.style.setProperty('left',Math.max(8,Math.min(r.left,innerWidth-r.width-8))+'px','important');host.style.setProperty('top',Math.max(8,Math.min(r.top,innerHeight-r.height-8))+'px','important');}
  chrome.runtime.onMessage.addListener((m,s,reply)=>{if(m.type==='show-float'){open(true);reply({ok:true});}});
  open();
})();
