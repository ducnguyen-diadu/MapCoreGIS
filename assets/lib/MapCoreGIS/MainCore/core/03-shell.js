// Module: core/03-shell.js
Object.assign(WaterMapCore.prototype, {
  _newProject(){return{format:FORMAT,version:MKS_VERSION,projectId:uuid(),name:'Untitled',createdAt:nowIso(),updatedAt:nowIso(),lastUsedAt:nowIso(),layers:[],map:{center:this.config?.map?.center||DEFAULTS.map.center,zoom:this.config?.map?.zoom||DEFAULTS.map.zoom},ui:{locale:this.locale},thumbnail:null};},
  _buildRoot(){this._panelZCounter=650;this._panelFocusObservers=[];this.container.innerHTML='';this.container.classList.add('ddc_meko-host');this.root=document.createElement('div');this.root.className='ddc_meko-root';this.root.innerHTML='<div class="ddc_meko-map"></div><div class="ddc_meko-context hidden"></div><div class="ddc_meko-toast hidden"></div><div class="ddc_meko-modal-wrap hidden"></div>';this.container.appendChild(this.root);this.mapEl=this.root.querySelector('.ddc_meko-map');this.contextEl=this.root.querySelector('.ddc_meko-context');this.toastEl=this.root.querySelector('.ddc_meko-toast');this.modalWrap=this.root.querySelector('.ddc_meko-modal-wrap');this.root.addEventListener('click',()=>this._hideContext());},
  _buildMap(){const mc=this.config.map||{};const minZoom=Number.isFinite(Number(mc.minZoom))?Number(mc.minZoom):2;const maxZoom=Number.isFinite(Number(mc.maxZoom))?Number(mc.maxZoom):24;const maxNativeZoom=Number.isFinite(Number(mc.maxNativeZoom))?Number(mc.maxNativeZoom):19;this.map=L.map(this.mapEl,{zoomControl:mc.zoomControl!==false,preferCanvas:true,minZoom,maxZoom}).setView(mc.center||DEFAULTS.map.center,Number.isFinite(Number(mc.zoom))?Number(mc.zoom):DEFAULTS.map.zoom);if(mc.osm!==false)L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{minZoom,maxZoom,maxNativeZoom,attribution:'&copy; OpenStreetMap'}).addTo(this.map);this.measureGroup=L.layerGroup().addTo(this.map);this.map.on('moveend zoomend',()=>{const c=this.map.getCenter();this.project.map={center:[c.lat,c.lng],zoom:this.map.getZoom()};clearTimeout(this._dynamicRenderTimer);this._dynamicRenderTimer=setTimeout(()=>this._refreshDynamicRenderers?.(),80);});},
  _setWorkspaceVisible(visible){this.workspaceVisible=!!visible;this.root.classList.toggle('ddc_meko-startup',!visible);if(visible)setTimeout(()=>this.map&&this.map.invalidateSize(false),0);},
  _activateWorkspace(){if(!this.workspaceVisible)this._setWorkspaceVisible(true);},
  _buildUI(){this.toolbar=document.createElement('div');this.toolbar.className='ddc_meko-toolbar';this.toolbar.dataset.pos=this.config.ui.toolbar;this.root.appendChild(this.toolbar);this._syncToolbarOffset();const tools=[['recent','◫'],['export','⇩'],['layers','☷'],['table','▦'],['pan','✋'],['select','⌖'],['spatial-update','⤧'],['unselect','⊘'],['topology-repair','🧰'],['sample-demand','Σ'],['aggregate-junction','JΣ'],['measure','↔'],['clear-measure','×↔'],['home','⌂'],['edit-tools','🛠']];tools.forEach(t=>{const b=document.createElement('button');b.className='ddc_meko-tool';b.dataset.cmd=t[0];b.title=this.t('toolbar.'+t[0]);b.textContent=t[1];b.onclick=e=>{e.stopPropagation();this._command(t[0]);};this.toolbar.appendChild(b);});this._makePanel('layers',this.t('panel.layers'),this.config.ui.layerPanel);this._makePanel('attrs',this.t('panel.properties'),this.config.ui.attributePanel);this._makePanel('table',this.t('panel.attributeTable'),'bottom');this._makePanel('topology',this.t('topology.resultsTitle'),'bottom');this.panels.layers.classList.add('hidden');this.panels.attrs.classList.add('hidden');this.panels.table.classList.add('hidden');this.panels.topology.classList.add('hidden');this._buildEditToolbar?.();},
  _syncToolbarOffset(){
      if(!this.toolbar)return;
      const pos=this.config?.ui?.toolbar||'left';
      if(pos!=='left'){
        this.toolbar.style.top='';
        return;
      }
      // Leaflet zoom control mặc định nằm góc trên-trái. Khi giữ zoom +/-
      // thì đẩy toolbar xuống dưới control; khi tắt zoom, toolbar giữ vị trí gốc.
      this.toolbar.style.top=this.config?.map?.zoomControl===false?'8px':'82px';
    },
  _makePanel(key,title,pos){this.panels=this.panels||{};const p=document.createElement('div');p.className='ddc_meko-panel';p.dataset.pos=pos||'right';p.innerHTML='<div class="ddc_meko-panel-head"><span>'+esc(title)+'</span><button class="ddc_meko-panel-close">×</button></div><div class="ddc_meko-panel-body"></div>';p.querySelector('button').onclick=()=>p.classList.add('hidden');p.addEventListener('pointerdown',()=>this._bringPanelToFront?.(p),true);this.root.appendChild(p);this.panels[key]=p;const mo=new MutationObserver(()=>{if(!p.classList.contains('hidden'))this._bringPanelToFront?.(p);});mo.observe(p,{attributes:true,attributeFilter:['class']});this._panelFocusObservers.push(mo);},
  _floatingWindows(){return [...Object.values(this.panels||{}).filter(Boolean),this.editToolbar].filter(Boolean);},
  _bringPanelToFront(panel){if(!panel)return;const list=this._floatingWindows();if((this._panelZCounter||650)>=1140){list.sort((a,b)=>(Number(a.style.zIndex)||650)-(Number(b.style.zIndex)||650)).forEach((x,i)=>x.style.zIndex=String(650+i));this._panelZCounter=650+list.length;}panel.style.zIndex=String(++this._panelZCounter);},
  _bindResize(){
    this.ro=new ResizeObserver(()=>{requestAnimationFrame(()=>{if(this.map)this.map.invalidateSize(false);this._syncToolbarOffset?.();this._updateEditToolbarOrientation?.();this._clampEditToolbar?.();});});this.ro.observe(this.container);
    const isTypingTarget=e=>{const t=e.target;return !!(t&&(t.matches?.('input,textarea,select')||t.isContentEditable));};
    this._keyHandler=e=>{
      if(isTypingTarget(e))return;
      const k=String(e.key||'').toLowerCase();
      if(e.code==='Space'||e.key===' '){
        if(!this._temporaryPan){this._temporaryPan={mode:this.mode};this.root?.classList.add('ddc_meko-space-pan');try{this.map?.dragging.enable();}catch(_){}}
        e.preventDefault();return;
      }
      if(k==='m'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){this.enableSelectMode?.();e.preventDefault();return;}
      if(k==='v'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){this.enableSpatialUpdate?.();e.preventDefault();return;}
      if(e.key==='Escape'){if(this._createSeries?.active){this._endLayerCreateSeries?.(true);}else if(this.mode==='measure'){this._measure();}else if(this.mode==='select'){this.unselect?.();}else if(this.mode==='spatial-update'){this._clearSpatialSelection?.();}else{this._stopBoxSelect?.();if(this.map?.pm)this.map.pm.disableDraw();}}
    };
    this._keyUpHandler=e=>{
      if((e.code==='Space'||e.key===' ')&&this._temporaryPan){
        const returnMode=this._temporaryPan.mode;this._temporaryPan=null;this.root?.classList.remove('ddc_meko-space-pan');
        // Spatial Update owns the mouse and normally keeps Leaflet dragging disabled.
        if(returnMode==='spatial-update'&&this.mode==='spatial-update'){try{this.map?.dragging.disable();}catch(_){}}
        else{try{this.map?.dragging.enable();}catch(_){}}
        e.preventDefault();
      }
    };
    document.addEventListener('keydown',this._keyHandler);document.addEventListener('keyup',this._keyUpHandler);
  },
  on(n,fn){(this.events[n]=this.events[n]||[]).push(fn);return()=>this.off(n,fn);},
  toast(msg,ms=2200){this.toastEl.textContent=msg;this.toastEl.classList.remove('hidden');clearTimeout(this._toastT);this._toastT=setTimeout(()=>this.toastEl.classList.add('hidden'),ms);},
  _command(c){const f={recent:()=>this.showRecent(),export:()=>this.exportShapefile(),layers:()=>this.showLayerPanel(),table:()=>this.showAttributeTable(),pan:()=>this.enablePanMode?.(),select:()=>this.enableSelectMode?.(),['spatial-update']:()=>this.enableSpatialUpdate?.(),unselect:()=>this.unselect?.(),['topology-repair']:()=>this.showTopologyRepairTool?.(),['sample-demand']:()=>this.showSampleDemandTool?.(),['aggregate-junction']:()=>this.showAggregateJunctionTool?.(),measure:()=>this._measure(),['clear-measure']:()=>this._clearMeasurements(),home:()=>this.goHome(),['edit-tools']:()=>this.toggleEditToolbar()}[c];if(!f)return;try{const r=f();if(r&&typeof r.then==='function')r.catch(err=>{console.error(err);this.toast(err?.message||String(err),5000);});}catch(err){console.error(err);this.toast(err?.message||String(err),5000);}},
  _setToolActive(cmd){if(!this.toolbar)return;this.toolbar.querySelectorAll('.ddc_meko-tool').forEach(b=>b.classList.toggle('active',b.dataset.cmd===cmd));}
});
