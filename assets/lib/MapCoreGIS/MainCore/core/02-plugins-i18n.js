// Module: core/02-plugins-i18n.js
Object.assign(WaterMapCore.prototype, {
  _installConfiguredPlugins(){(this.config.plugins||[]).forEach(p=>this.use(p));},
  use(plugin){if(!plugin)return this;let p=plugin;if(typeof p==='function'&&!p.install)p=p(this.config||{});if(!p||typeof p.install!=='function')throw new Error('WaterMapCore plugin phải có hàm install(core)');if(this.plugins.some(x=>x===p||((x.name&&p.name)&&x.name===p.name)))return this;p.install(this);this.plugins.push(p);this.emit('plugin:installed',{plugin:p});return this;},
  registerLocale(locale,messages){if(!locale||!messages)return this;this.translations[locale]=merge(this.translations[locale]||{},messages);return this;},
  t(key,params={}){const read=(obj,path)=>String(path||'').split('.').reduce((v,k)=>v&&Object.prototype.hasOwnProperty.call(v,k)?v[k]:undefined,obj);let val=read(this.translations[this.locale],key);if(val==null)val=read(this.translations[this.fallbackLocale],key);if(val==null)val=key;if(typeof val!=='string')return val;return val.replace(/\{(\w+)\}/g,(m,k)=>params[k]??m);},
  setLocale(locale,opt={}){if(!locale)return this;this.locale=locale;this.config.locale=locale;if(this.project){this.project.ui=this.project.ui||{};this.project.ui.locale=locale;}if(!opt.silent)this._refreshI18nUI();this.emit('locale:changed',{locale});return this;},
  getLocale(){return this.locale;},
  _refreshI18nUI(){if(this.toolbar){this.toolbar.querySelectorAll('[data-cmd]').forEach(b=>b.title=this.t('toolbar.'+b.dataset.cmd));}if(this.panels){const titles={layers:'panel.layers',attrs:'panel.properties',table:'panel.attributeTable',topology:'topology.resultsTitle'};Object.keys(titles).forEach(k=>{const el=this.panels[k]?.querySelector('.ddc_meko-panel-head span');if(el)el.textContent=this.t(titles[k]);});}if(this.panels?.layers&&!this.panels.layers.classList.contains('hidden'))this.showLayerPanel();}
});
