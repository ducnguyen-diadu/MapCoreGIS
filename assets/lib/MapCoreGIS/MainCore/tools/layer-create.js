// Module: tools/layer-create.js - Add New from a concrete layer context, with persistent snapping setup.
Object.assign(WaterMapCore.prototype, {
  addNewFeatureToLayer(layerId){
    const l=this.getLayer(layerId);if(!l)return;this.activeLayerId=l.id;
    if(!this.editSessionActive){this.toast(this.t('editToolbar.beginFirst'));return;}
    if(!this.map.pm){this.toast(this.t('select.needGeoman'));return;}
    const kind=geomKind(l.geometryType);if(!['point','line','polygon'].includes(kind))return;
    // Starting Add New for another layer ends only the previous Add New series; it does not touch other tools/modules.
    if(this._createSeries?.active)this._endLayerCreateSeries?.(false);
    const candidates=this.layers.filter(x=>x.id!==l.id&&x.visible!==false);
    const checks=candidates.map(x=>'<label style="display:block;padding:2px 0"><input type="checkbox" data-snap-layer value="'+esc(x.id)+'" checked> '+esc(x.name)+'</label>').join('');
    const h='<label class="ddc_meko-field"><span>'+esc(this.t('create.snapEnabled'))+'</span><input id="ddcSnapEnabled" type="checkbox" checked></label><div class="ddc_meko-btnrow"><label><input id="ddcSnapVertex" type="checkbox" checked> '+esc(this.t('create.vertex'))+'</label><label><input id="ddcSnapSegment" type="checkbox" checked> '+esc(this.t('create.segment'))+'</label></div><label class="ddc_meko-field"><span>'+esc(this.t('create.tolerance'))+'</span><input id="ddcSnapDistance" type="number" min="3" max="50" value="10"></label><div><b>'+esc(this.t('create.snapLayers'))+'</b><div style="max-height:140px;overflow:auto">'+(checks||'<span class="ddc_meko-empty">'+esc(this.t('create.noSnapLayers'))+'</span>')+'</div></div>';
    this._modal(this.t('create.title',{name:l.name}),h,[{text:this.t('create.start'),primary:true,fn:()=>{
      const opt={snappable:this.modalWrap.querySelector('#ddcSnapEnabled').checked,snapDistance:Number(this.modalWrap.querySelector('#ddcSnapDistance').value)||10,snapVertex:this.modalWrap.querySelector('#ddcSnapVertex').checked,snapSegment:this.modalWrap.querySelector('#ddcSnapSegment').checked,snapLayerIds:[...this.modalWrap.querySelectorAll('[data-snap-layer]:checked')].map(x=>x.value)};
      this._closeModal();
      this._createSeries={active:true,layerId:l.id,opt:Object.assign({},opt)};
      this._beginLayerCreate(l,opt);
    }},{text:this.t('common.cancel'),fn:()=>this._closeModal()}]);
  },

  _beginLayerCreate(layer,opt){
    if(!layer||this.pending)return;
    const kind=geomKind(layer.geometryType),shape=kind==='point'?'Marker':kind==='line'?'Line':'Polygon';this.mode='draw';
    const allChildren=[];this.layers.forEach(l=>l.leaflet?.eachLayer?.(x=>allChildren.push({owner:l,leaf:x,old:x.options?.pmIgnore})));
    const allowed=new Set(opt.snapLayerIds||[]);allChildren.forEach(x=>{if(x.leaf?.options)x.leaf.options.pmIgnore=!(x.owner.id===layer.id||allowed.has(x.owner.id));});
    const ses=this._layerCreateSession={layerId:layer.id,opt:Object.assign({},opt),allowed,activeSnapPoint:null,isSnapped:false,lastCommittedSnapPoint:null};
    const restore=()=>allChildren.forEach(x=>{if(x.leaf?.options){if(x.old===undefined)delete x.leaf.options.pmIgnore;else x.leaf.options.pmIgnore=x.old;}});
    const drawOpt={snappable:!!opt.snappable,snapDistance:opt.snapDistance||10};
    const v=this._resolveFeatureVisualStyle?.(layer,{properties:{}})||{};if(kind!=='point')drawOpt.pathOptions={color:v.color||'#0b8ea6',weight:Number(v.weight)||3,opacity:v.opacity??.9,fillColor:v.fillColor||v.color||'#52b5c5',fillOpacity:v.fillOpacity??.25};
    let preview=null;

    const setActiveSnap=(ll)=>{ses.activeSnapPoint=L.latLng(ll.lat,ll.lng);ses.isSnapped=true;return ses.activeSnapPoint;};
    const clearActiveSnap=()=>{ses.activeSnapPoint=null;ses.isSnapped=false;};
    const snapOrMouse=(rawLL)=>{
      if(!rawLL)return rawLL;
      if(!ses.opt?.snappable){clearActiveSnap();return rawLL;}
      const c=this._nearestCreateSnapCandidate?.(rawLL,ses);
      if(c?.latlng)return setActiveSnap(c.latlng);
      // Snap latch / hysteresis: once the UI visibly snapped, a small cursor drift must not
      // silently fall back to the raw mouse coordinate. Release only after moving clearly away.
      if(ses.isSnapped&&ses.activeSnapPoint){
        const p=this.map.latLngToLayerPoint(rawLL),q=this.map.latLngToLayerPoint(ses.activeSnapPoint);
        const releasePx=Math.max((Number(ses.opt.snapDistance)||10)*1.8,(Number(ses.opt.snapDistance)||10)+6);
        if(p.distanceTo(q)<=releasePx)return ses.activeSnapPoint;
      }
      clearActiveSnap();return rawLL;
    };

    const moveHandler=e=>{
      const current=this._layerCreateSession;if(!current||current!==ses)return;
      const ll=snapOrMouse(e.latlng);
      if(kind==='point'&&ll){if(!preview){preview=this._pointToLayerStyled(layer,{properties:{}},ll);preview.options.interactive=false;preview.addTo(this.map);}else preview.setLatLng?.(ll);}
    };

    // Capture the coordinate that a real draw click is going to commit. This listener is
    // registered before Geoman draw mode, so pm:create can trust lastCommittedSnapPoint.
    const clickCapture=e=>{
      if(this._layerCreateSession!==ses||!e?.latlng)return;
      const ll=snapOrMouse(e.latlng);
      ses.lastCommittedSnapPoint=ses.isSnapped&&ses.activeSnapPoint?L.latLng(ses.activeSnapPoint.lat,ses.activeSnapPoint.lng):null;
      ses.lastCommittedLatLng=ll?L.latLng(ll.lat,ll.lng):null;
    };

    this.map.on('mousemove',moveHandler);
    this.map.on('click',clickCapture);

    const cleanup=()=>{
      this.map.off('pm:create',created);this.map.off('mousemove',moveHandler);this.map.off('click',clickCapture);
      if(preview){try{this.map.removeLayer(preview);}catch(_){}preview=null;}
      restore();
      if(this._layerCreateSession===ses)this._layerCreateSession=null;
      if(this._layerCreateCleanup===cleanup)this._layerCreateCleanup=null;
      try{this.map.pm.disableDraw();}catch(_){}
      this.mode='select';
    };
    this._layerCreateCleanup=cleanup;

    const created=e=>{
      // The coordinate that was visibly snapped at the last click is authoritative.
      // Never re-read the raw cursor coordinate at finish time.
      const sp=ses.lastCommittedSnapPoint||(ses.isSnapped?ses.activeSnapPoint:null);
      if(sp)this._commitLayerCreateSnapPoint?.(e.layer,kind,sp);
      const gj=e.layer.toGeoJSON();try{this.map.removeLayer(e.layer);}catch(_){}cleanup();this._stageCreate(layer,gj);
    };

    this.map.on('pm:create',created);this.map.pm.enableDraw(shape,drawOpt);
  },

  _endLayerCreateSeries(cancelPending=false){
    try{this._layerCreateCleanup?.();}catch(_){}
    this._createSeries=null;
    if(cancelPending&&this.pending?.type==='create'){
      if(this.pending.preview){try{this.map.removeLayer(this.pending.preview);}catch(_){} }
      this.pending=null;this.panels?.attrs?.classList.add('hidden');
    }
    try{this.map?.pm?.disableDraw?.();}catch(_){}
    if(this.mode==='draw')this.mode='select';
  },

  _commitLayerCreateSnapPoint(drawLayer,kind,snapLL){
    if(!drawLayer||!snapLL)return;
    if(kind==='point'){drawLayer.setLatLng?.(snapLL);return;}
    const latlngs=drawLayer.getLatLngs?.();if(!Array.isArray(latlngs)||!latlngs.length)return;
    if(kind==='line'){
      const line=Array.isArray(latlngs[0])?latlngs[0]:latlngs;if(line.length)line[line.length-1]=L.latLng(snapLL.lat,snapLL.lng);drawLayer.setLatLngs(latlngs);return;
    }
    if(kind==='polygon'){
      const ring=Array.isArray(latlngs[0])?latlngs[0]:latlngs;if(ring.length)ring[ring.length-1]=L.latLng(snapLL.lat,snapLL.lng);drawLayer.setLatLngs(latlngs);
    }
  },

  _nearestCreateSnapCandidate(rawLL,session){
    if(!session?.opt?.snappable||!rawLL)return null;
    const limit=Math.max(1,Number(session.opt.snapDistance)||10),p=this.map.latLngToLayerPoint(rawLL);let best=null;
    const useVertex=session.opt.snapVertex!==false,useSegment=session.opt.snapSegment!==false;
    // When targets overlap, prefer a concrete Point/Junction over a line vertex/segment.
    // This is important when a junction lies exactly on a pipe: clicking the junction must
    // commit the junction coordinate, not the underlying line segment coordinate.
    const rank={point:0,vertex:1,endpoint:2,segment:3};
    const better=(type,d)=>!best||(rank[type]??9)<(rank[best.type]??9)||((rank[type]??9)===(rank[best.type]??9)&&d<best.distancePx);
    const consider=(ll,type,layer,feature)=>{const q=this.map.latLngToLayerPoint(ll),d=p.distanceTo(q);if(d<=limit&&better(type,d))best={latlng:L.latLng(ll.lat,ll.lng),distancePx:d,type,layer,feature};};
    const seg=(aLL,bLL,layer,feature)=>{const a=this.map.latLngToLayerPoint(aLL),b=this.map.latLngToLayerPoint(bLL);const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;let t=0;if(l2>0)t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2));const q=L.point(a.x+t*dx,a.y+t*dy),d=p.distanceTo(q);if(d<=limit&&better('segment',d))best={latlng:this.map.layerPointToLatLng(q),distancePx:d,type:'segment',layer,feature};};
    for(const l of this.layers||[]){if(!session.allowed?.has(l.id)||l.visible===false)continue;for(const f of l.fc?.features||[]){const g=f.geometry;if(!g)continue;const visitLine=(coords)=>{if(!coords?.length)return;if(useVertex)for(const c of coords)consider(L.latLng(c[1],c[0]),'vertex',l,f);if(useSegment)for(let i=1;i<coords.length;i++)seg(L.latLng(coords[i-1][1],coords[i-1][0]),L.latLng(coords[i][1],coords[i][0]),l,f);};if(g.type==='Point'){if(useVertex)consider(L.latLng(g.coordinates[1],g.coordinates[0]),'point',l,f);}else if(g.type==='MultiPoint'){if(useVertex)for(const c of g.coordinates||[])consider(L.latLng(c[1],c[0]),'point',l,f);}else if(g.type==='LineString')visitLine(g.coordinates);else if(g.type==='MultiLineString')for(const a of g.coordinates||[])visitLine(a);else if(g.type==='Polygon')for(const a of g.coordinates||[])visitLine(a);else if(g.type==='MultiPolygon')for(const poly of g.coordinates||[])for(const a of poly||[])visitLine(a);}}
    return best;
  },

  _dispatchCreateMapClick(ll){
    if(!ll||!this.map)return;
    const cp=this.map.latLngToContainerPoint(ll),lp=this.map.latLngToLayerPoint(ll),container=this.map.getContainer(),rr=container.getBoundingClientRect();
    const init={bubbles:true,cancelable:true,view:window,clientX:rr.left+cp.x,clientY:rr.top+cp.y,button:0,buttons:0};
    // IMPORTANT: an existing Leaflet feature stops DOM propagation before the map receives the click.
    // Fire the Leaflet map event directly so Geoman gets the same click even when the user clicked
    // a Junction/Point/Line. The authoritative coordinate is the already-resolved snapped point.
    const originalEvent=new MouseEvent('click',init);
    this.map.fire('mousemove',{latlng:ll,containerPoint:cp,layerPoint:lp,originalEvent});
    this.map.fire('click',{latlng:ll,containerPoint:cp,layerPoint:lp,originalEvent});
  },

  _handleCreateTargetClick(layer,feature,e){
    const ses=this._layerCreateSession;if(this.mode!=='draw'||!ses?.opt?.snappable||!ses.allowed?.has(layer.id))return false;
    const raw=e?.latlng;if(!raw)return false;
    const c=this._nearestCreateSnapCandidate(raw,ses),ll=c?.latlng||raw;
    if(c?.latlng){ses.activeSnapPoint=L.latLng(ll.lat,ll.lng);ses.isSnapped=true;ses.lastCommittedSnapPoint=L.latLng(ll.lat,ll.lng);}else{ses.activeSnapPoint=null;ses.isSnapped=false;ses.lastCommittedSnapPoint=null;}
    ses.lastCommittedLatLng=L.latLng(ll.lat,ll.lng);
    this._dispatchCreateMapClick(ll);
    return true;
  },

  reverseSelectedDirection(layerId){
    const items=(this.selection||[]).filter(x=>x.layer?.id===layerId&&geomKind(x.layer.geometryType)==='line');if(items.length!==1){this.toast(this.t('direction.selectOne'));return;}this.reverseFeatureDirection(layerId,items[0].feature.id);
  }
});
