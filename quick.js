const $=id=>document.getElementById(id);let item,busy=false;
async function request(type,more={}){const r=await chrome.runtime.sendMessage({type,...more});if(!r?.ok)throw Error(r?.error||'未连接');return r;}
async function update(){if(busy)return;busy=true;try{
 const {items}=await request('list');const videos=items.filter(i=>['mp4','webm'].includes(i.kind));const groups=new Set(videos.map(i=>i.group||i.url));
 item=groups.size===1?videos.sort((a,b)=>b.width*b.height-a.width*a.height||Number(b.quality==='HD')-Number(a.quality==='HD'))[0]:null;
 $('title').textContent=item?'当前视频':groups.size>1?'多个视频，请点击牛图标选择':'等待当前视频加载';
 $('download').disabled=!item;$('download').textContent=item?.downloaded?'已下载 · 再次下载':'下载最高可用分辨率';
 $('quality').textContent=item?(item.width?item.width+' × '+item.height:'分辨率未知'):'';
 $('poster').hidden=!item?.poster;if(item?.poster&&$('poster').src!==item.poster)$('poster').src=item.poster;
 const {jobs}=await request('activity');$('jobs').replaceChildren();for(const j of jobs.slice(-3)){const p=document.createElement('p');p.textContent=j.state==='complete'?'✓ 下载完成':j.state==='interrupted'?'下载失败：'+j.error:'下载中 '+(j.totalBytes>0?Math.round(j.bytesReceived/j.totalBytes*100)+'%':(j.bytesReceived/1048576).toFixed(1)+' MB');if(j.state==='interrupted'){const b=document.createElement('button');b.textContent='重试';b.onclick=async()=>{try{await request('retry',{downloadId:j.id});await update();}catch(e){$('status').textContent=e.message;}};p.append(b);}$('jobs').append(p);}
 }catch(e){$('status').textContent=e.message;}finally{busy=false;}}
$('download').onclick=async()=>{if(!item)return;if(item.downloaded&&!confirm('该视频已下载，仍要再次下载吗？'))return;$('download').disabled=true;try{await request('download',{id:item.id});$('status').textContent='下载已开始，收起后仍可查看进度';}catch(e){$('status').textContent=e.message;}await update();};
update();setInterval(update,1200);
