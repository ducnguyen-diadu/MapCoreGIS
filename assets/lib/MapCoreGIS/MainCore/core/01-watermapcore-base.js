// Base class: constructor only. Features are attached by modules.
class WaterMapCore {
  constructor(containerId,options={}){
      const el=typeof containerId==='string'?document.getElementById(containerId):containerId;if(!el)throw new Error('WaterMapCore: không tìm thấy container');
      if(!global.L)throw new Error('WaterMapCore cần Leaflet');
      this.container=el;this.config=merge(DEFAULTS,options);this._localeExplicit=Object.prototype.hasOwnProperty.call(options,'locale');this.events={};this.plugins=[];this.translations={vi:merge({},CORE_MESSAGES_VI)};this.locale=this.config.locale||'vi';this.fallbackLocale=this.config.fallbackLocale||'vi';this.layers=[];this.layerIndex=new Map();this.selected=null;this.selection=[];this.pending=null;this.mode='select';this.undoStack=[];this.redoStack=[];this._dirty=false;this._dirtyReason=null;this.editSessionActive=false;this._editSessionSnapshot=null;this.store=new RecentStore(this.config.storage.indexedDbName);this.project=this._newProject();this._homeBounds=null;this._homeView={center:(this.config.map.center||DEFAULTS.map.center).slice(),zoom:this.config.map.zoom||DEFAULTS.map.zoom};
      this._installConfiguredPlugins();this._buildRoot();this._buildMap();this._buildUI();this._bindResize();this._setWorkspaceVisible(false);this._purgeGuest().finally(()=>{this.showRecent(true);setTimeout(()=>this.emit('ready',{core:this}),0);});
    }
}
