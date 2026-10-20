// Page-side shell only; media controls run in an isolated extension frame.
(() => {
  let host, panel, frame, bubble; let side="right"; let quick,progress,hoverTimer,enterTimer;let prefs={size:48,opacity:35,delay:300,disabledSites:[]};
  function collapse(){panel.hidden=true;bubble.hidden=false;frame.src="about:blank";dock();}
  function expand(){if(quick)quick.hidden=true;frame.src=chrome.runtime.getURL("popup.html");panel.hidden=false;bubble.hidden=true;host.style.setProperty("left",side==="left"?"8px":"auto","important");host.style.setProperty("right",side==="right"?"8px":"auto","important");clamp();}
  function dock(){const y=host.getBoundingClientRect().top;host.style.setProperty("left",side==="left"?"0px":"auto","important");host.style.setProperty("right",side==="right"?"0px":"auto","important");bubble.style.borderRadius=side==="left"?"0 24px 24px 0":"24px 0 0 24px";host.style.setProperty("top",Math.max(8,Math.min(y,innerHeight-prefs.size-8))+"px","important");}
  function open(expanded=false) {
    if (host) { if(expanded)expand(); return; }
    host=document.createElement('div');
    host.style.cssText='all:initial!important;position:fixed!important;right:0px!important;top:40vh!important;z-index:2147483647!important;';
    const shadow=host.attachShadow({mode:'closed'});
    const style=document.createElement('style');
    style.textContent='*{box-sizing:border-box}section{width:min(300px,calc(100vw - 24px));background:#f4f6fa;border:1px solid #ced7e5;border-radius:12px;box-shadow:0 8px 28px #0003;overflow:hidden}header{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#142741;color:white;font:12px system-ui;cursor:move;touch-action:none}span{flex:1}button{font:14px system-ui;border:0;border-radius:6px;padding:4px 8px;cursor:pointer;background:#e4eaf3;color:#17243b}iframe{display:block;border:0;width:100%;height:min(380px,calc(100vh - 150px))}#bubble{display:grid;place-items:center;width:var(--bubble-size,48px);height:var(--bubble-size,48px);border-radius:24px 0 0 24px;background:#fff;padding:4px;box-shadow:0 2px 10px #0001;touch-action:none;cursor:grab;opacity:var(--idle-opacity,.35);transition:opacity .2s ease,box-shadow .2s ease}#bubble:hover,#bubble:focus-visible,#bubble:active{opacity:1;box-shadow:0 2px 12px #0002}#bubble img{width:calc(var(--bubble-size,48px) - 8px);height:calc(var(--bubble-size,48px) - 8px);pointer-events:none}button:focus-visible{outline:3px solid #2563eb;outline-offset:2px} [hidden]{display:none!important}';
    quick=document.createElement('iframe');quick.title='当前视频快捷下载';quick.hidden=true;quick.style.cssText='position:absolute;right:52px;top:0;width:230px;height:240px;border:1px solid #ced7e5;border-radius:12px;box-shadow:0 6px 22px #0002;background:#f4f6fa';
    host.onpointerenter=()=>{clearTimeout(hoverTimer);clearTimeout(enterTimer);enterTimer=setTimeout(()=>{if(panel.hidden){quick.style.right=side==='right'?(prefs.size+4)+'px':'auto';quick.style.left=side==='left'?(prefs.size+4)+'px':'auto';quick.style.top=Math.min(0,innerHeight-host.getBoundingClientRect().top-248)+'px';quick.src=chrome.runtime.getURL('quick.html');quick.hidden=false;}},prefs.delay);};
    host.onpointerleave=()=>{clearTimeout(enterTimer);hoverTimer=setTimeout(()=>{quick.hidden=true;quick.src='about:blank';},350);};
    panel=document.createElement('section');
    const header=document.createElement('header'),title=document.createElement('span');title.textContent='视频下载 · 拖动移动';
    const minimize=document.createElement('button');minimize.textContent='−';minimize.title='收起悬浮窗';minimize.setAttribute('aria-label',minimize.title);
    const close=document.createElement('button');close.textContent='×';close.title='关闭悬浮窗';close.setAttribute('aria-label',close.title);
    frame=document.createElement('iframe');frame.src='about:blank';frame.title='社媒视频下载悬浮窗';
    bubble=document.createElement('button');bubble.id='bubble';bubble.title='展开视频下载（可拖动）';bubble.setAttribute('aria-label','展开视频下载');const icon=document.createElement('img');icon.src=chrome.runtime.getURL('icons/icon48.png');icon.alt='';bubble.append(icon);progress=document.createElement('small');progress.style.cssText='position:absolute;bottom:-10px;font:10px system-ui;background:#fff;border-radius:4px;padding:1px 3px;color:#142741';bubble.append(progress);panel.hidden=true;
    minimize.onclick=collapse;
    close.title='收起到图标';close.setAttribute('aria-label',close.title);close.onclick=collapse;
    let moved=false,start;
    bubble.onpointerdown=e=>{if(e.button!==undefined&&e.button!==0)return;moved=false;quick.hidden=true;const r=host.getBoundingClientRect();start={x:e.clientX,y:e.clientY,left:r.left,top:r.top};bubble.setPointerCapture(e.pointerId);bubble.style.opacity='1';};
    bubble.onpointermove=e=>{if(!start)return;if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>4)moved=true;if(moved){host.style.setProperty('right','auto','important');host.style.setProperty('left',Math.max(0,Math.min(start.left+e.clientX-start.x,innerWidth-prefs.size))+'px','important');host.style.setProperty('top',Math.max(8,Math.min(start.top+e.clientY-start.y,innerHeight-prefs.size-8))+'px','important');}};
    bubble.onpointerup=bubble.onpointercancel=()=>{if(start&&moved)side=host.getBoundingClientRect().left+prefs.size/2<innerWidth/2?'left':'right';start=null;bubble.style.opacity='';dock();};
    bubble.onclick=e=>{if(moved&&e?.detail!==0){moved=false;return;}expand();};
    shadow.addEventListener('keydown',e=>{if(e.key==='Escape'){collapse();bubble.focus();}});
    header.append(title,minimize,close);panel.append(header,frame);shadow.append(style,panel,bubble,quick);document.documentElement.append(host);
    let drag;
    header.onpointerdown=e=>{if(e.target.closest('button'))return;const r=host.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top};header.setPointerCapture(e.pointerId);e.preventDefault();};
    header.onpointermove=e=>{if(!drag)return;host.style.setProperty('right','auto','important');host.style.setProperty('left',drag.left+e.clientX-drag.x+'px','important');host.style.setProperty('top',drag.top+e.clientY-drag.y+'px','important');clamp();};
    header.onpointerup=header.onpointercancel=()=>{drag=null;};
    window.addEventListener('resize',()=>{if(panel.hidden)dock();else clamp();});if(expanded)expand();else dock();
  }
  function clamp(){if(!host)return;const r=host.getBoundingClientRect();host.style.setProperty('right','auto','important');host.style.setProperty('left',Math.max(8,Math.min(r.left,innerWidth-r.width-8))+'px','important');host.style.setProperty('top',Math.max(8,Math.min(r.top,innerHeight-r.height-8))+'px','important');}
  chrome.runtime.onMessage.addListener((m,s,reply)=>{if(m.type==='show-float'){open(true);reply({ok:true});}});
  open();
  function applyPreferences(p={}){
   prefs={size:Math.max(36,Math.min(64,Number(p.size)||48)),opacity:Math.max(15,Math.min(100,Number(p.opacity)||35)),delay:Math.max(0,Math.min(1000,Number(p.delay??300))),disabledSites:Array.isArray(p.disabledSites)?p.disabledSites:[]};
   host.style.setProperty('--bubble-size',prefs.size+'px');host.style.setProperty('--idle-opacity',String(prefs.opacity/100));
   const disabled=prefs.disabledSites.some(s=>location.hostname.split('.').includes(s));host.style.setProperty('display',disabled?'none':'block','important');
   if(disabled)collapse();else if(panel.hidden)dock();
  }
  chrome.storage.local.get('preferences').then(r=>applyPreferences(r.preferences)).catch(()=>{});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.preferences)applyPreferences(changes.preferences.newValue);});
  let checking=false;
  setInterval(async()=>{if(checking||document.hidden)return;checking=true;try{
   const r=await chrome.runtime.sendMessage({type:'activity'});if(!r?.ok)return;
   const active=r.jobs.filter(j=>j.state==='in_progress'),last=r.jobs.at(-1),j=active[0]||last;
   progress.textContent=!j?'':active.length?(j.totalBytes>0?Math.round(j.bytesReceived/j.totalBytes*100)+'%':'下载中'):j.state==='interrupted'?'失败':j.state==='complete'?'✓':'';
   const percent=active.length&&j.totalBytes>0?Math.min(100,j.bytesReceived/j.totalBytes*100):0;
   bubble.style.background=active.length?'conic-gradient(#2563eb '+percent+'%,#fff 0)':'#fff';
  }catch{}finally{checking=false;}},1500);
})();
