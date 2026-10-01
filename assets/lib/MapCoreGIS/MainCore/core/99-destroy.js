// Module: core/99-destroy.js
Object.assign(WaterMapCore.prototype, {
  destroy(){try{if(this._directionTimer)clearInterval(this._directionTimer);clearTimeout(this._dynamicRenderTimer);this.ro?.disconnect();if(this._keyHandler)document.removeEventListener('keydown',this._keyHandler);if(this._keyUpHandler)document.removeEventListener('keyup',this._keyUpHandler);this._panelFocusObservers?.forEach(x=>x.disconnect?.());this.map?.remove();}catch(e){}this.container.innerHTML='';this.container.classList.remove('ddc_meko-host');this.events={};}
});
