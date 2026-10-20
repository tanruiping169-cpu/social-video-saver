const embedded=window.top!==window;document.documentElement.classList.toggle('embedded',embedded);
const $=id=>document.getElementById(id);let tabId;let fingerprint='',groupCount=0,ready=false;
$('version').textContent='v'+chrome.runtime.getManifest().version+' · 当前网页自动检测';
const status=text=>$('status').textContent=text;
async function request(type,more={}) {const r=await chrome.runtime.sendMessage({type,tabId,...more});if(!r?.ok)throw Error(r?.error||'插件未响应，请重新打开');return r;}
function element(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
function quality(i){return i.width&&i.height?`${i.width} × ${i.height}`:i.quality?`${i.quality}${/^\d+$/.test(i.quality)?'p':''}（平台标记）`:'分辨率待读取';}
async function refresh(){
  const {items}=await request('list');const next=JSON.stringify(items.map(({seen,...i})=>i));if(next===fingerprint)return groupCount;fingerprint=next;$('list').querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load();});$('list').replaceChildren();
  const groups=new Map();let unsupported=0;
  for(const i of items){if(!['mp4','webm'].includes(i.kind)){unsupported++;continue;}const key=i.group||MediaCore.asset(i.url)||i.url;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
  if(!groups.size)$('list').append(element('p','尚未找到当前网页可下载的完整视频。请播放目标视频后重新检测；独立视频详情页通常更准确。','empty'));
  let index=0;
  for(const variants of groups.values()){
    variants.sort((a,b)=>(b.width*b.height-a.width*a.height)||Number(b.quality==='HD')-Number(a.quality==='HD'));
    let item=variants[0];const card=element('article',null,'card');
    if(item.downloaded)card.append(element('div','✓ 已下载此分辨率','meta'));
    card.append(element('h2',item.adId?'广告 '+item.adId:item.caption||'当前页视频 '+(++index)));
    if(item.poster){const img=element('img');img.src=item.poster;img.alt='视频封面';img.className='thumbnail';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();card.append(img);}
    if(item.author)card.append(element('div','作者：'+item.author,'meta'));
    card.append(element('div',item.source==='page'?'来自当前可见播放器':'来自当前页面数据，请预览确认','meta'));
    card.append(element('div',item.duration?Math.round(item.duration)+' 秒':'时长待读取（预览后显示）','meta'));
    const label=element('label','选择分辨率'),select=element('select');select.setAttribute('aria-label','选择视频分辨率');
    variants.forEach((v,n)=>{const option=element('option',`${quality(v)} · ${v.kind.toUpperCase()}${variants.length>1?' · 版本 '+(n+1):''}`);option.value=v.id;select.append(option);});
    label.append(select);card.append(label);
    const info=element('div','网页提供 '+variants.length+' 个版本；不生成或放大画质。','meta');card.append(info);
    const details=element('details');details.append(element('summary','资源地址'));const address=element('textarea');address.readOnly=true;address.value=item.url;address.setAttribute('aria-label','资源地址');details.append(address);card.append(details);
    const actions=element('div',null,'actions'),download=element('button','下载此分辨率'),preview=element('button','预览','secondary');
    function closePreview(){const v=card.querySelector('video');if(v){v.pause();v.removeAttribute('src');v.load();v.remove();}preview.textContent='预览';}
    select.onchange=()=>{closePreview();item=variants.find(v=>v.id===select.value);address.value=item.url;};
    download.onclick=async()=>{if(item.downloaded&&!confirm('这个视频的此分辨率已下载，仍要再次下载吗？'))return;download.disabled=true;try{const r=await request('download',{id:item.id});status('下载已开始');watchDownload(r.downloadId,download);}catch(e){status(MediaCore.errorMessage(e.message));download.disabled=false;}};
    preview.onclick=()=>{if(card.querySelector('video')){closePreview();return;}const v=element('video');v.controls=true;v.preload='metadata';v.src=item.url;
      v.onloadedmetadata=()=>{if(v.videoWidth&&v.videoHeight){item.width=v.videoWidth;item.height=v.videoHeight;select.selectedOptions[0].textContent=quality(item)+' · '+item.kind.toUpperCase();info.textContent=`实际视频尺寸 ${quality(item)} · ${Math.round(v.duration||0)} 秒`;}};
      v.onerror=()=>status('预览失败：请刷新原网页重新检测。若仍失败，请查看下载记录。');card.append(v);preview.textContent='关闭预览';};
    actions.append(download,preview);card.append(actions);
    if(item.source==='network')card.append(element('div','网页网络资源，保存前建议预览确认内容和声音。','notice'));
    $('list').append(card);
  }
  if(unsupported)$('list').append(element('p',`已排除 ${unsupported} 个播放清单或分片，避免保存不完整文件。`,'meta'));
  groupCount=groups.size;return groupCount;
}
$('float').onclick=async()=>{try{await chrome.tabs.sendMessage(tabId,{type:'show-float'});window.close();}catch(e){status('请刷新原网页后再打开悬浮窗。');}};
$('scan').onclick=async()=>{try{const result=await chrome.tabs.sendMessage(tabId,{type:'scan'});const n=await refresh();status(`当前网页发现 ${n} 个视频`+(result?.blobs?'；blob 播放器需等待实际资源加载。':'。'));}catch(e){status('检测失败，请刷新原网页后重试。'+e.message);}};
$('clear').onclick=async()=>{try{await request('clear');await refresh();status('已清空当前网页列表。');}catch(e){status(e.message);}};
$('downloads').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('manager.html')});
async function watchDownload(id,button){
  try{const r=await request('downloadStatus',{downloadId:id}),d=r.download;
    if(!d){status('下载记录已移除，请查看 Chrome 下载记录。');button.disabled=false;return;}
    if(d.state==='complete'){status('下载完成，已保存到 Chrome 下载位置。');button.disabled=false;return;}
    if(d.state==='interrupted'){status(MediaCore.errorMessage(d.error)+' 可在任务与设置中重试 / 续传。');button.disabled=false;button.textContent='重新下载';return;}
    status(d.totalBytes>0?'下载中 '+Math.min(100,Math.round(d.bytesReceived/d.totalBytes*100))+'%':'下载中 '+(d.bytesReceived/1048576).toFixed(1)+' MB');
    setTimeout(()=>watchDownload(id,button),1000);
  }catch(e){status('读取下载状态失败：'+e.message);button.disabled=false;}
}
let polling=false;
setInterval(async()=>{if(!ready||document.hidden||polling)return;polling=true;try{await refresh();}catch{}finally{polling=false;}},1500);
(async()=>{try{const [t]=await chrome.tabs.query({active:true,currentWindow:true});tabId=t?.id;if(!MediaCore.site(t?.url))throw Error('请在 Meta、Instagram、Pinterest 、TikTok 或小红书 网页打开插件。');try{await chrome.tabs.sendMessage(tabId,{type:'scan'});}catch{throw Error('页面检测脚本未连接：请刷新网页；仍无效时，在扩展详情中允许此网站访问。');}ready=true;const n=await refresh();status(n?`当前网页 ${n} 个视频，可选择网页提供的分辨率。`:'等待当前网页加载视频；首次安装后请刷新网页。');}catch(e){status(e.message);$('scan').disabled=true;$('clear').disabled=true;$('float').disabled=true;}})();
