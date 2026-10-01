// Module: ui/edit-toolbar.js
Object.assign(WaterMapCore.prototype, {
  _ensureEditToolbarStyles(){
    if(document.getElementById('ddc_meko_edit_toolbar_css'))return;
    const s=document.createElement('style');s.id='ddc_meko_edit_toolbar_css';
    s.textContent=`
.ddc_meko-edit-toolbar{position:absolute;z-index:850;left:90px;top:12px;display:flex;align-items:center;gap:4px;padding:5px;background:rgba(255,255,255,.96);border:1px solid #cfd8df;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.16);max-width:calc(100% - 16px);user-select:none}
.ddc_meko-edit-toolbar.hidden{display:none}.ddc_meko-edit-toolbar.vertical{flex-direction:column;left:auto}.ddc_meko-edit-drag{cursor:move;padding:4px 7px;border-right:1px solid #e4e9ed;font-weight:700;color:#60717f}.ddc_meko-edit-toolbar.vertical .ddc_meko-edit-drag{border-right:0;border-bottom:1px solid #e4e9ed;width:100%;text-align:center}
.ddc_meko-edit-tool{width:34px;height:32px;border:1px solid #d8e0e5;background:#fff;border-radius:5px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center}.ddc_meko-edit-tool:hover:not(:disabled){background:#edf7f9}.ddc_meko-edit-tool:disabled{opacity:.38;cursor:not-allowed}.ddc_meko-edit-tool.active{background:#dff4f7;border-color:#65b7c3}.ddc_meko-edit-tool.danger:not(:disabled){color:#b42318}
.ddc_meko-draw-wrap{position:relative}.ddc_meko-draw-menu{position:absolute;left:0;top:38px;display:flex;gap:3px;padding:4px;background:#fff;border:1px solid #d8e0e5;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.16);z-index:20}.ddc_meko-draw-menu.hidden{display:none}.ddc_meko-edit-toolbar.vertical .ddc_meko-draw-menu{left:40px;top:0;flex-direction:column}
`;
    document.head.appendChild(s);
  },
  _buildEditToolbar(){
    this._ensureEditToolbarStyles();
    this.editToolbar=document.createElement('div');this.editToolbar.className='ddc_meko-edit-toolbar hidden';
    const btn=(cmd,icon,title,danger=false)=>'<button class="ddc_meko-edit-tool'+(danger?' danger':'')+'" data-ecmd="'+cmd+'" title="'+esc(title)+'">'+icon+'</button>';
    this.editToolbar.innerHTML='<div class="ddc_meko-edit-drag" title="'+esc(this.t('editToolbar.drag'))+'">⋮⋮</div>'+
      btn('import','⇧',this.t('toolbar.import'))+
      btn('begin','✎',this.t('editToolbar.begin'))+
      btn('edit','✐',this.t('toolbar.edit'))+btn('delete','⌫',this.t('toolbar.delete'),true)+
      btn('save','💾',this.t('editToolbar.save'))+btn('cancel','✕',this.t('editToolbar.cancel'))+
      btn('undo','↶',this.t('toolbar.undo'))+btn('redo','↷',this.t('toolbar.redo'));
    this.root.appendChild(this.editToolbar);
    this.editToolbar.addEventListener('pointerdown',()=>this._bringPanelToFront?.(this.editToolbar),true);
    this.editToolbar.querySelectorAll('[data-ecmd]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();this._editToolbarCommand(b.dataset.ecmd);}));
    this._makeEditToolbarDraggable();
    this._restoreEditToolbarPosition();
    this._updateEditToolbarOrientation();
    this._updateEditToolbarState();
  },
  toggleEditToolbar(){if(!this.editToolbar)return;this.editToolbar.classList.toggle('hidden');if(!this.editToolbar.classList.contains('hidden')){this._bringPanelToFront?.(this.editToolbar);this._clampEditToolbar();this._updateEditToolbarState();}},
  _editToolbarCommand(cmd){
    const map={
      import:()=>this.showImport(false,{append:true}),begin:()=>this.beginEditSession(),
      edit:()=>this.editSelected(),delete:()=>this.deleteSelected(),save:()=>this.saveEditSession(),cancel:()=>this.cancelEditSession(),undo:()=>this.undo(),redo:()=>this.redo()
    };
    try{const r=map[cmd]?.();if(r&&typeof r.then==='function')r.catch(e=>{console.error(e);this.toast(e?.message||String(e),5000);});}catch(e){console.error(e);this.toast(e?.message||String(e),5000);}
    this._updateEditToolbarState();
  },
  beginEditSession(){
    if(this.editSessionActive)return;
    this._editSessionDirtyBefore=this.isDirty?.()||false;
    this.editSessionActive=true;
    this._editSessionSnapshot=this._snapshot();
    this._editSessionUndoStart=this.undoStack.length;
    this.emit('edit:begin',{});this.toast(this.t('editToolbar.started'));this._updateEditToolbarState();
  },
  async saveEditSession(){
    if(!this.editSessionActive||!this.isDirty())return;
    if(this.pending){this.toast(this.t('editToolbar.finishPending'));return;}
    await this.saveProject();
    this.stopSpatialUpdate?.(false);
    this.editSessionActive=false;this._editSessionSnapshot=null;this._editSessionUndoStart=0;this._editSessionDirtyBefore=false;
    this.emit('edit:saved',{});this._updateEditToolbarState();
  },
  cancelEditSession(){
    if(!this.editSessionActive)return;
    if(this.isDirty()&&!confirm(this.t('editToolbar.cancelConfirm')))return;
    this.stopSpatialUpdate?.(false);
    if(this._editSessionSnapshot)this._restore(this._editSessionSnapshot);
    this.undoStack=[];this.redoStack=[];this.editSessionActive=false;this._editSessionSnapshot=null;if(this._editSessionDirtyBefore)this._setDirty?.('pre-session');else this._markClean();this._editSessionDirtyBefore=false;
    this.emit('edit:cancelled',{});this._updateEditToolbarState();
  },
  _updateEditToolbarState(){
    if(!this.editToolbar)return;
    const active=!!this.editSessionActive,dirty=this.isDirty?.()||false,hasSel=(this.selection?.length||0)>0;
    const set=(c,en)=>{const b=this.editToolbar.querySelector('[data-ecmd="'+c+'"]');if(b)b.disabled=!en;};
    set('begin',!active);set('import',active);
    set('edit',active&&hasSel);set('delete',active&&hasSel);
    set('save',active&&dirty);set('cancel',active);set('undo',active&&this.undoStack.length>0);set('redo',active&&this.redoStack.length>0);
    const begin=this.editToolbar.querySelector('[data-ecmd="begin"]');if(begin)begin.classList.toggle('active',active);
  },
  _makeEditToolbarDraggable(){
    const drag=this.editToolbar.querySelector('.ddc_meko-edit-drag');let st=null;
    const move=e=>{if(!st)return;const rr=this.root.getBoundingClientRect();let left=e.clientX-st.dx-rr.left,top=e.clientY-st.dy-rr.top;this.editToolbar.style.left=left+'px';this.editToolbar.style.top=top+'px';this.editToolbar.style.right='auto';this._clampEditToolbar();};
    const up=()=>{if(!st)return;st=null;document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);this._saveEditToolbarPosition();};
    drag.addEventListener('mousedown',e=>{const br=this.editToolbar.getBoundingClientRect();st={dx:e.clientX-br.left,dy:e.clientY-br.top};document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);e.preventDefault();});
  },
  _updateEditToolbarOrientation(){
    if(!this.editToolbar||!this.root)return;const vertical=this.root.clientWidth<560;this.editToolbar.classList.toggle('vertical',vertical);this._clampEditToolbar();
  },
  _clampEditToolbar(){
    if(!this.editToolbar||this.editToolbar.classList.contains('hidden'))return;const rr=this.root.getBoundingClientRect(),br=this.editToolbar.getBoundingClientRect();let left=parseFloat(this.editToolbar.style.left)||8,top=parseFloat(this.editToolbar.style.top)||8;left=Math.max(4,Math.min(left,Math.max(4,rr.width-br.width-4)));top=Math.max(4,Math.min(top,Math.max(4,rr.height-br.height-4)));this.editToolbar.style.left=left+'px';this.editToolbar.style.top=top+'px';
  },
  _saveEditToolbarPosition(){try{localStorage.setItem('ddc_meko_edit_toolbar_pos',JSON.stringify({left:parseFloat(this.editToolbar.style.left)||8,top:parseFloat(this.editToolbar.style.top)||8}));}catch(e){}},
  _restoreEditToolbarPosition(){try{const p=JSON.parse(localStorage.getItem('ddc_meko_edit_toolbar_pos')||'null');if(p){this.editToolbar.style.left=p.left+'px';this.editToolbar.style.top=p.top+'px';}}catch(e){}}
});
