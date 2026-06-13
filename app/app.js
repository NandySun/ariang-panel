// app.js — AriaNg 重建 前端逻辑 v4
(function(){
"use strict";

var URL = window.__AR2_URL__ || "http://localhost:6800/jsonrpc";
var SECRET = window.__AR2_SECRET__ || "";
var _rid = 0;
var _pollTimer = null;
var _pollFast = true;
var _connected = false;
var _expanded = {};

// ===== 工具函数 =====

function $(id){return document.getElementById(id);}
function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

function fmtSize(bytes){
  if(!bytes||bytes<=0)return "0 B";
  var u=["B","KB","MB","GB","TB"];
  var i=0;
  while(bytes>=1024&&i<u.length-1){bytes/=1024;i++}
  return bytes.toFixed(i===0?0:1)+" "+u[i];
}

function fmtSpeed(bytes){
  if(!bytes||bytes<=0)return "0 B/s";
  return fmtSize(bytes)+"/s";
}

function fmtETA(secs){
  if(!secs||secs<=0||!isFinite(secs))return "--";
  if(secs<60)return Math.ceil(secs)+"s";
  if(secs<3600)return Math.floor(secs/60)+"min "+Math.floor(secs%60)+"s";
  var h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60);
  return h+"h "+m+"min";
}

// ===== SVG 图标 =====

var I = {
  pause:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="3" x2="5" y2="13"/><line x1="11" y1="3" x2="11" y2="13"/></svg>',
  play:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5,3 13,8 5,13"/></svg>',
  remove:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>',
  refresh:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 8a6 6 0 0 1 10.5-4M14 8a6 6 0 0 1-10.5 4"/><polyline points="14,2 14,5 11,5"/><polyline points="2,14 2,11 5,11"/></svg>',
  download:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 2v9M4 8l4 4 4-4"/><line x1="2" y1="14" x2="14" y2="14"/></svg>',
  upload:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 14V5M4 9l4-4 4 4"/><line x1="2" y1="2" x2="14" y2="2"/></svg>',
  check:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3,8 6,12 13,4"/></svg>',
  xmark:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>'
};

// ===== JSON-RPC =====

function rpc(method,params){
  return new Promise(function(resolve,reject){
    var id="q"+(_rid++);
    var body={jsonrpc:"2.0",id:id,method:"aria2."+method,params:params||[]};
    if(SECRET) body.params.unshift("token:"+SECRET);
    fetch(URL,{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(body)})
    .then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
    .then(function(d){if(d.error)reject(new Error(d.error.message||"RPC error"));else resolve(d.result);})
    .catch(function(e){reject(e);});
  });
}

function rpcBatch(calls){
  return Promise.all(calls.map(function(c){return rpc(c.method,c.params).catch(function(e){return {_err:e.message};});}));
}

// ===== 数据获取 =====

function fetchAll(){
  return rpcBatch([
    {method:"getVersion",params:[]},
    {method:"getGlobalStat",params:[]},
    {method:"tellActive",params:[]},
    {method:"tellWaiting",params:[0,100]},
    {method:"tellStopped",params:[0,100]}
  ]).then(function(res){
    return {
      version:res[0]._err?null:res[0],
      stat:res[1]._err?null:res[1],
      active:res[2]._err?[]:(Array.isArray(res[2])?res[2]:[]),
      waiting:res[3]._err?[]:(Array.isArray(res[3])?res[3]:[]),
      stopped:res[4]._err?[]:(Array.isArray(res[4])?res[4]:[])
    };
  });
}

// ===== 操作 =====

function doPause(gid){rpc("pause",[gid]).then(fetchAndRender).catch(function(e){showError(e.message);});}
function doUnpause(gid){rpc("unpause",[gid]).then(fetchAndRender).catch(function(e){showError(e.message);});}

function doRemove(gid,cardEl){
  if(cardEl)cardEl.classList.add("removing");
  rpc("remove",[gid]).then(function(){rpc("removeDownloadResult",[gid]).catch(function(){});})
  .catch(function(){rpc("removeDownloadResult",[gid]).catch(function(){});})
  .then(function(){setTimeout(fetchAndRender,300);})
  .catch(function(e){if(cardEl)cardEl.classList.remove("removing");showError(e.message);});
}

var _confirmGid=null;
function confirmRemove(gid,btn){
  if(_confirmGid===gid){
    _confirmGid=null;
    btn.classList.remove("btn-danger-confirm");
    btn.innerHTML=I.xmark;
    btn.disabled=true;
    doRemove(gid,btn.closest(".task-card"));
  }else{
    _confirmGid=gid;
    btn.classList.add("btn-danger-confirm");
    btn.innerHTML=I.check;
    setTimeout(function(){if(_confirmGid===gid){_confirmGid=null;btn.classList.remove("btn-danger-confirm");btn.innerHTML=I.remove;}},3000);
  }
}

// ===== 批量操作 =====

function batchPauseAll(){
  rpc("pauseAll",[]).then(fetchAndRender).catch(function(e){showError(e.message);});
}

function batchUnpauseAll(){
  rpc("unpauseAll",[]).then(fetchAndRender).catch(function(e){showError(e.message);});
}

var _clockTimer=null;
function startClock(){stopClock();updateTime();_clockTimer=setInterval(updateTime,1000);}
function stopClock(){if(_clockTimer){clearInterval(_clockTimer);_clockTimer=null;}}

var _confirmClear=false;
function batchClearCompleted(){
  if(!_confirmClear){
    _confirmClear=true;
    var btn=$("clear-btn");
    if(btn){btn.textContent="确认清除";btn.classList.add("batch-btn-danger-confirm");}
    setTimeout(function(){_confirmClear=false;var b=$("clear-btn");if(b){b.textContent="清除已完成";b.classList.remove("batch-btn-danger-confirm");}},3000);
    return;
  }
  _confirmClear=false;
  var btn=$("clear-btn");
  if(btn){btn.textContent="清除中..";btn.disabled=true;}
  rpc("tellStopped",[0,200]).then(function(tasks){
    var p=Promise.resolve();
    (tasks||[]).forEach(function(t){
      if(t.status==="complete"||t.status==="error"||t.status==="removed"){
        p=p.then(function(){return rpc("remove",[t.gid]).catch(function(){});})
          .then(function(){return rpc("removeDownloadResult",[t.gid]).catch(function(){});});
      }
    });
    return p;
  }).then(function(){
    setTimeout(fetchAndRender,300);
    if(btn){btn.textContent="清除已完成";btn.disabled=false;}
  }).catch(function(e){
    showError(e.message);
    if(btn){btn.textContent="清除已完成";btn.disabled=false;}
  });
}

// ===== 快捷添加 =====

function showAddDialog(){
  var ov=$("add-overlay");if(ov)ov.style.display="flex";
  var inp=$("add-input");if(inp){inp.value="";setTimeout(function(){inp.focus();},100);}
}

function hideAddDialog(){
  var ov=$("add-overlay");if(ov)ov.style.display="none";
}

function doAddUri(){
  var inp=$("add-input");
  var uri=(inp.value||"").trim();
  if(!uri)return;
  rpc("addUri",[[uri]]).then(function(){
    hideAddDialog();
    fetchAndRender();
  }).catch(function(e){
    showError("添加失败: "+e.message);
  });
}

// ===== 渲染 =====

function buildUI(){
  $("app").innerHTML=
    '<div class="hdr">'+
      '<div class="hdr-left"><span class="hdr-title">下载</span><span class="hdr-ver" id="ver">--</span></div>'+
      '<div class="hdr-right"><span class="hdr-updated" id="updated">--</span></div>'+
    '</div>'+
    '<div id="error-msg" class="error-bar" style="display:none"></div>'+
    '<div class="batch-bar" id="batch-bar">'+
      '<button class="btn batch-btn" id="pause-all-btn" title="暂停所有活动任务">⏸ 全部暂停</button>'+
      '<button class="btn batch-btn" id="unpause-all-btn" title="继续所有暂停任务">▶ 全部继续</button>'+
      '<button class="btn batch-btn" id="clear-btn" title="清除已完成/错误任务">🗑 清除已完成</button>'+
    '</div>'+
    '<div class="stats-row" id="stats"></div>'+
    '<div id="task-area"></div>'+
    '<div class="footer-bar">'+
      '<div class="footer-left"><span class="footer-dot offline" id="status-dot"></span><span id="status-text">等待连接</span></div>'+
      '<span>aria2 JSON-RPC</span>'+
    '</div>'+
    '<div id="add-overlay" class="add-overlay" style="display:none">'+
      '<div class="add-dialog">'+
        '<div class="add-dialog-title">添加下载任务</div>'+
        '<textarea id="add-input" class="add-input" placeholder="粘贴 URL 或磁力链接" rows="3"></textarea>'+
        '<div class="add-dialog-actions">'+
          '<button class="btn" id="add-cancel-btn">取消</button>'+
          '<button class="btn add-submit-btn" id="add-submit-btn">添加</button>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<button id="add-btn" class="add-btn" title="新建下载">+</button>';

  // 事件绑定
  $("pause-all-btn").onclick=batchPauseAll;
  $("unpause-all-btn").onclick=batchUnpauseAll;
  $("clear-btn").onclick=batchClearCompleted;
  $("add-btn").onclick=showAddDialog;
  $("add-cancel-btn").onclick=hideAddDialog;
  $("add-submit-btn").onclick=doAddUri;
  $("add-overlay").onclick=function(e){
    if(e.target===this)hideAddDialog();
  };
  $("add-input").onkeydown=function(e){
    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();doAddUri();}
  };
  document.addEventListener("keydown",function(e){
    if(e.key==="Escape"){hideAddDialog();}
  });
}

function updateStats(data){
  var s=data.stat,el=$("stats");if(!el)return;
  var ds=s?fmtSpeed(s.downloadSpeed):"--",us=s?fmtSpeed(s.uploadSpeed):"--";
  el.innerHTML=
    '<span class="stat-item">下载 <span class="stat-val">'+ds+'</span></span>'+
    '<span class="stat-item">上传 <span class="stat-val">'+us+'</span></span>'+
    '<span class="stat-item"><span class="stat-dot active"></span> 活动 <span class="stat-val">'+data.active.length+'</span></span>'+
    '<span class="stat-item"><span class="stat-dot waiting"></span> 等待 <span class="stat-val">'+data.waiting.length+'</span></span>'+
    '<span class="stat-item"><span class="stat-dot stopped"></span> 停止 <span class="stat-val">'+data.stopped.length+'</span></span>';
}

function renderTasks(data){
  var area=$("task-area");if(!area)return;
  var all=data.active.concat(data.waiting).concat(data.stopped);
  if(!all.length){
    area.innerHTML='<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">没有下载任务</div></div>';
    return;
  }
  var h='<div class="task-list">';
  if(data.active.length){
    h+='<div class="task-section"><div class="task-section-title"><span class="task-dot-breath"></span>活动任务 &middot; '+data.active.length+'</div>';
    data.active.forEach(function(t){h+=taskCard(t,"active");});
    h+='</div>';
  }
  if(data.waiting.length){
    h+='<div class="task-section"><div class="task-section-title">等待中 &middot; '+data.waiting.length+'</div>';
    data.waiting.forEach(function(t){h+=taskCard(t,"waiting");});
    h+='</div>';
  }
  if(data.stopped.length){
    h+='<div class="task-section"><div class="task-section-title">已停止 &middot; '+data.stopped.length+'</div>';
    data.stopped.forEach(function(t){h+=taskCard(t,"stopped");});
    h+='</div>';
  }
  h+='</div>';
  area.innerHTML=h;
  bindActions();
  applyExpanded();
}

function taskCard(t,section){
  var name=taskName(t),status=taskStatus(t,section);
  var total=parseInt(t.totalLength)||0,done=parseInt(t.completedLength)||0;
  var pct=total>0?(done/total*100):0;
  var speed=parseInt(t.downloadSpeed)||0,upspeed=parseInt(t.uploadSpeed)||0;
  var eta=speed>0&&total>0?(total-done)/speed:null;
  var gid=t.gid||"";
  var dsCls=speed>1048576?"speed-fast":(speed===0?"speed-idle":"");
  var isComplete=t.status==="complete";
  var isPaused=t.status==="paused";

  var metaSpans='<span>'+fmtSize(done)+(total?' / '+fmtSize(total):'')+'</span>';
  if(section==="active"){
    metaSpans+='<span class="'+dsCls+'">'+fmtSpeed(speed)+'</span>';
    metaSpans+='<span>剩余 '+fmtETA(eta)+'</span>';
  }else if(isPaused){
    metaSpans+='<span>已暂停</span>';
  }else if(isComplete){
    metaSpans+='<span>已完成</span>';
  }else{
    metaSpans+='<span>'+status.text+'</span>';
  }

  var actBtns='';
  if(section==="active"){
    actBtns='<button data-action="pause" data-gid="'+gid+'" title="暂停">'+I.pause+'</button>';
  }else if(section==="waiting"||section==="stopped"){
    if(!isComplete) actBtns='<button data-action="unpause" data-gid="'+gid+'" title="'+(isPaused?'继续':'开始')+'">'+I.play+'</button>';
  }
  actBtns+='<button data-action="remove" data-gid="'+gid+'" title="删除">'+I.remove+'</button>';

  var detailHtml=!isComplete?(
    '<div class="card-detail">'+
      '<span class="detail-item">连接: '+(t.connections||'--')+'</span>'+
      '<span class="detail-item">做种: '+(t.numSeeders!==undefined?t.numSeeders:'--')+'</span>'+
      '<span class="detail-item">上传: '+fmtSpeed(upspeed)+'</span>'+
    '</div>'
  ):'';
  return '<div class="task-card status-'+status.cls+'" data-gid="'+gid+'">'+
    '<div class="card-row">'+
      '<div class="card-info">'+
        '<div class="card-name">'+esc(name)+'</div>'+
        '<div class="card-meta">'+metaSpans+'</div>'+
      '</div>'+
      '<div class="card-actions">'+actBtns+'</div>'+
    '</div>'+
    (total>0?'<div class="progress-wrap"><div class="progress-bar"><div class="progress-fill'+(isComplete?' complete':'')+'" style="width:'+pct+'%"></div></div><div class="progress-pct">'+pct.toFixed(1)+'%</div></div>':'')+
    detailHtml+
  '</div>';
}

function taskName(t){
  if(t.bittorrent&&t.bittorrent.info&&t.bittorrent.info.name)return t.bittorrent.info.name;
  if(t.files&&t.files.length>0){var p=t.files[0].path||"";var i=Math.max(p.lastIndexOf("/"),p.lastIndexOf("\\"));return i>=0?p.slice(i+1):p;}
  return t.gid||"未知任务";
}

function taskStatus(t,section){
  var s=t.status;
  if(s==="complete")return{cls:"complete",text:"已完成"};
  if(s==="error")return{cls:"error",text:"错误"};
  if(s==="removed")return{cls:"error",text:"已移除"};
  if(s==="paused")return{cls:"paused",text:"已暂停"};
  if(section==="active")return{cls:"active",text:"下载中"};
  if(section==="waiting")return{cls:"waiting",text:"等待中"};
  return{cls:"paused",text:s||"已停止"};
}

// ===== 展开状态管理 =====

function applyExpanded(){
  document.querySelectorAll(".task-card").forEach(function(card){
    var gid=card.dataset.gid;
    if(gid&&_expanded[gid]) card.classList.add("expanded");
    else card.classList.remove("expanded");
  });
}

function bindActions(){
  document.querySelectorAll("[data-action]").forEach(function(btn){
    btn.onclick=function(e){
      e.stopPropagation();
      var a=this.dataset.action,gid=this.dataset.gid;
      if(a==="pause")doPause(gid);
      else if(a==="unpause")doUnpause(gid);
      else if(a==="remove")confirmRemove(gid,this);
    };
  });
}

var _boundClick=false;
function ensureClickBound(){
  if(_boundClick)return;_boundClick=true;
  document.addEventListener("click",function(e){
    var card=e.target.closest(".task-card");
    if(card){
      var gid=card.dataset.gid;
      if(gid){
        if(_expanded[gid]) delete _expanded[gid];
        else _expanded[gid]=true;
        applyExpanded();
      }
    } else {
      if(Object.keys(_expanded).length){
        _expanded={};
        applyExpanded();
      }
    }
  });
}

function showError(msg){
  var el=$("error-msg");if(!el)return;
  el.style.display="";el.innerHTML='<span>⚠ '+esc(msg)+'</span><button class="btn" onclick="this.parentElement.style.display=\'none\'">关闭</button>';
  setTimeout(function(){if(el)el.style.display="none";},8000);
}

function updateFooter(ok,ver){
  var d=$("status-dot"),t=$("status-text");
  if(d)d.className="footer-dot "+(ok?"online":"offline");
  if(t)t.textContent=ok?"已连接":"连接失败";
  if(ver){var ve=$("ver");if(ve)ve.textContent="v"+ver;}
}

function updateTime(){
  var u=$("updated");if(u)u.textContent="更新于 "+new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
}

// ===== 主循环 =====

function fetchAndRender(){
  return fetchAll().then(function(data){
    _connected=!!(data.version||data.stat);
    updateTime();updateFooter(true,data.version?data.version.version:null);
    updateStats(data);renderTasks(data);
    clearError();
  }).catch(function(e){
    _connected=false;updateTime();updateFooter(false);
    showError(e.message||"无法连接到 Aria2 RPC");
    var a=$("task-area");if(a)a.innerHTML='<div class="empty"><div class="empty-icon">🔌</div><div class="empty-text">无法连接 Aria2</div></div>';
    var s=$("stats");if(s)s.innerHTML='<span class="stat-item">离线</span>';
    var v=$("ver");if(v)v.textContent="--";
  });
}

function startPolling(){_pollFast=true;fetchAndRender();scheduleNext();startClock();}

function scheduleNext(){
  if(_pollTimer)clearTimeout(_pollTimer);
  _pollTimer=setTimeout(function(){fetchAndRender().then(scheduleNext).catch(scheduleNext);},_pollFast?2000:5000);
}

function stopPolling(){if(_pollTimer){clearTimeout(_pollTimer);_pollTimer=null;}stopClock();}

document.addEventListener("visibilitychange",function(){
  if(document.hidden){stopPolling();_pollFast=false;}
  else{_pollFast=true;fetchAndRender();scheduleNext();}
});

function clearError(){var el=$("error-msg");if(el)el.style.display="none";}

buildUI();ensureClickBound();startPolling();
})();
