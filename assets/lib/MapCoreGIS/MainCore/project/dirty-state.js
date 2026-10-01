// Module: project/dirty-state.js
Object.assign(WaterMapCore.prototype, {
  _setDirty(reason='change'){
    this._dirty=true;
    this._dirtyReason=reason;
    this._updateEditToolbarState?.();
    this.emit('project:dirty',{dirty:true,reason});
    return this;
  },
  _markClean(){
    this._dirty=false;
    this._dirtyReason=null;
    this._updateEditToolbarState?.();
    this.emit('project:dirty',{dirty:false});
    return this;
  },
  isDirty(){return !!this._dirty;},
  _confirmProjectSwitch(){
    if(!this.isDirty())return Promise.resolve('discard');
    return new Promise(resolve=>{
      let settled=false;
      const finish=v=>{if(settled)return;settled=true;this._closeModal();resolve(v);};
      const html='<div class="ddc_meko-warning">'+esc(this.t('project.unsavedSwitch'))+'</div>';
      this._modal(this.t('project.unsavedTitle'),html,[
        {text:this.t('project.saveAndContinue'),primary:true,fn:async()=>{try{await this.saveProject();finish('save');}catch(e){console.error(e);this.toast(e?.message||String(e),5000);}}},
        {text:this.t('project.discardAndContinue'),fn:()=>finish('discard')},
        {text:this.t('common.cancel'),fn:()=>finish('cancel')}
      ],{closable:false});
    });
  },
  _resetWorkspaceForProjectSwitch(){
    try{this._cancelPending?.();}catch(e){}
    try{this._stopBoxSelect?.();}catch(e){}
    try{this._clearSelection?.();}catch(e){}
    try{this._clearMeasurements?.();}catch(e){}
    if(this.map?.pm){try{this.map.pm.disableDraw();}catch(e){}try{this.map.pm.disableGlobalEditMode?.();}catch(e){}}
    this.editSessionActive=false;
    this._editSessionSnapshot=null;
    this.undoStack=[];
    this.redoStack=[];
    if(this.panels?.table)this.panels.table.classList.add('hidden');
    if(this.panels?.attrs)this.panels.attrs.classList.add('hidden');
    this.clearLayers(false);
    this._homeBounds=null;
    this.pending=null;
    this.selected=null;
    this.selection=[];
    this._updateEditToolbarState?.();
  }
});
