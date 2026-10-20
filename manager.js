const $=id=>document.getElementById(id),sites=['facebook','instagram','pinterest','tiktok','xiaohongshu'];
for(const site of sites){const l=document.createElement('label'),i=document.createElement('input');i.type='checkbox';i.id='site-'+site;i.checked=true;l.append(i,document.createTextNode(' 在 '+site+' 显示'));$('sites').append(l);}
function labels(){$('sizeValue').textContent=$('size').value+' px';$('opacityValue').textContent=$('opacity').value+'%';}
$('size').oninput=$('opacity').oninput=labels;
(async()=>{const {preferences:p={}}=await chrome.storage.local.get('preferences');$('size').value=p.size||48;$('opacity').value=p.opacity||35;$('delay').value=p.delay??300;for(const s of sites)$('site-'+s).checked=!p.disabledSites?.includes(s);labels();})();
$('save').onclick=async()=>{await chrome.storage.local.set({preferences:{size:Number($('size').value),opacity:Number($('opacity').value),delay:Number($('delay').value),disabledSites:sites.filter(s=>!$('site-'+s).checked)}});$('status').textContent='设置已保存，已打开网页会自动应用。';};
let busy=false,lastRender='',jobs=[];
function render(){
 const query=$('search').value.trim().toLocaleLowerCase(),filter=$('filter').value;
 const selected=jobs.filter(j=>(filter==='all'||j.state===filter)&&j.name.toLocaleLowerCase().includes(query));
 const signature=JSON.stringify([selected,query,filter]);if(signature===lastRender)return;lastRender=signature;
 $('jobs').replaceChildren();if(!selected.length)$('jobs').textContent=jobs.length?'没有符合条件的任务':'暂无下载任务';
 for(const j of [...selected].reverse()){
  const a=document.createElement('article'),name=document.createElement('small'),state=document.createElement('p');
  name.textContent=j.name;state.textContent=j.state==='complete'?'✓ 下载完成':j.state==='interrupted'?MediaCore.errorMessage(j.error):'下载中 '+(j.totalBytes>0?Math.min(100,Math.round(j.bytesReceived/j.totalBytes*100))+'%':(j.bytesReceived/1048576).toFixed(1)+' MB');a.append(name,state);
  const action=j.state==='complete'?'show':j.state==='interrupted'?'retry':'cancel',b=document.createElement('button');
  b.textContent={show:'打开所在文件夹',retry:'重试 / 续传',cancel:'取消下载'}[action];
  b.onclick=async()=>{busy=true;b.disabled=true;try{const r=await chrome.runtime.sendMessage({type:'jobAction',action,downloadId:j.id});if(!r?.ok)throw Error(r?.error);$('status').textContent='操作已完成';}catch(e){$('status').textContent=MediaCore.errorMessage(e.message);}finally{busy=false;b.disabled=false;await refresh();}};
  a.append(b);$('jobs').append(a);
 }
}
async function refresh(){if(busy||document.hidden)return;busy=true;try{const r=await chrome.runtime.sendMessage({type:'allJobs'});if(!r?.ok)throw Error(r?.error||'未连接');jobs=r.jobs;render();}catch(e){$('status').textContent=MediaCore.errorMessage(e.message);}finally{busy=false;}}
$('search').oninput=render;$('filter').onchange=render;
$('clearJobs').onclick=async()=>{if(busy)return;busy=true;try{const r=await chrome.runtime.sendMessage({type:'clearFinishedJobs'});if(!r?.ok)throw Error(r?.error);$('status').textContent='已清除已结束记录，已下载文件保留。';}catch(e){$('status').textContent=MediaCore.errorMessage(e.message);}finally{busy=false;await refresh();}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
refresh();setInterval(refresh,2000);
