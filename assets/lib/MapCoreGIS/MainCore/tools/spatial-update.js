// Module: tools/spatial-update.js
// ArcGIS Desktop-inspired Spatial Update mouse mode with multi-layer vertex groups.
// Behaviour:
//   - click/drag a Point                -> move that point
//   - click/drag a Line segment         -> move the two vertices forming that segment
//   - a 2-vertex Line has one segment   -> moving that segment moves the whole feature
//   - drag a rectangle on empty map     -> select vertices across MANY visible layers
//   - drag any selected vertex/segment  -> move all selected vertices as one group
//   - if the box contains all vertices  -> the whole feature moves
//   - Space temporarily pans without leaving Spatial Update mode
Object.assign(WaterMapCore.prototype, {
  _ensureSpatialUpdateStyles(){
    if(document.getElementById('ddc_meko_spatial_update_css'))return;
    const s=document.createElement('style');s.id='ddc_meko_spatial_update_css';
    s.textContent=`
.ddc_meko-spatial-handle{background:#fff;border:2px solid #1677ff;border-radius:50%;box-sizing:border-box;box-shadow:0 0 0 2px rgba(255,255,255,.88);cursor:move}
.ddc_meko-spatial-handle.endpoint{border-color:#e5484d}.ddc_meko-spatial-handle.selected{background:#dff4f7;box-shadow:0 0 0 3px rgba(22,119,255,.18)}
.ddc_meko-spatial-box{position:absolute;z-index:925;border:1px dashed #1677ff;background:rgba(22,119,255,.10);pointer-events:none}
.ddc_meko-spatial-preview{pointer-events:none}.ddc_meko-spatial-active{cursor:crosshair!important}.ddc_meko-space-pan,.ddc_meko-space-pan .ddc_meko-map{cursor:grab!important}.ddc_meko-space-pan:active,.ddc_meko-space-pan .ddc_meko-map:active{cursor:grabbing!important}
`;
    document.head.appendChild(s);
  },

  showSpatialUpdateTool(){
    return this.enableSpatialUpdate();
  },

  enableSpatialUpdate(){
    if(!this.editSessionActive){this.toast(this.t('editToolbar.beginFirst'));return;}
    this.disableSelectMode?.();
    this.stopSpatialUpdate(false);
    this._ensureSpatialUpdateStyles();
    this._spatialUpdate={active:true,selection:[],handles:[],drag:null};
    this.mode='spatial-update';
    this._setToolActive?.('spatial-update');
    this.root?.classList.add('ddc_meko-spatial-active');
    try{this.map?.dragging.disable();}catch(_){ }
    this._installSpatialBoxHandlers();
    this._spatialEscHandler=e=>{if(e.key==='Escape'){this._clearSpatialSelection();}};
    document.addEventListener('keydown',this._spatialEscHandler,true);
    this.toast(this.t('spatial.arcMode')||'Cập nhật không gian: kéo segment/point hoặc quét vertex để chỉnh.',3500);
    this.emit?.('spatial:mode',{mode:'spatial-update'});
    this._updateEditToolbarState?.();
  },

  stopSpatialUpdate(showToast=true){
    this._clearSpatialSelection();
    this._removeSpatialBox();
    this._removeSpatialPreview();
    if(this._spatialBoxHandlers){
      const h=this._spatialBoxHandlers;
      h.el.removeEventListener('mousedown',h.down,true);
      document.removeEventListener('mousemove',h.move,true);
      document.removeEventListener('mouseup',h.up,true);
      this._spatialBoxHandlers=null;
    }
    if(this._spatialEscHandler){document.removeEventListener('keydown',this._spatialEscHandler,true);this._spatialEscHandler=null;}
    this.root?.classList.remove('ddc_meko-spatial-active');
    this._spatialUpdate=null;
    if(this.mode==='spatial-update')this.mode='pan';
    try{this.map?.dragging.enable();}catch(_){ }
    this._setToolActive?.('pan');
    this._updateEditToolbarState?.();
    if(showToast)this.toast(this.t('spatial.stopped'));
    this.emit?.('spatial:mode',{mode:null});
  },

  enablePanMode(){
    this._cancelSelectionDrag?.();
    if(this.mode==='spatial-update')this.stopSpatialUpdate(false);
    if(this.map?.pm){try{this.map.pm.disableDraw();}catch(_){ }}
    this.mode='pan';
    try{this.map?.dragging.enable();}catch(_){ }
    this._setToolActive?.('pan');
    this.emit?.('pan:mode',{enabled:true});
  },

  _spatialSnapshotPush(snapshot){
    if(!snapshot)return;
    this.undoStack.push(snapshot);if(this.undoStack.length>30)this.undoStack.shift();
    this.redoStack=[];this._setDirty?.('spatial-update');this._updateEditToolbarState?.();
  },

  _geometryVertexEntries(layer,feature){
    const g=feature?.geometry;if(!g)return[];const out=[];
    const addLine=(coords,prefix,closed=false)=>{const n=coords.length-(closed&&coords.length>1?1:0);for(let i=0;i<n;i++)out.push({layer,feature,path:[...prefix,i],coord:coords[i],endpoint:!closed&&(i===0||i===n-1)});};
    switch(g.type){
      case'Point':out.push({layer,feature,path:[],coord:g.coordinates,endpoint:true});break;
      case'MultiPoint':g.coordinates.forEach((c,i)=>out.push({layer,feature,path:[i],coord:c,endpoint:true}));break;
      case'LineString':addLine(g.coordinates,[],false);break;
      case'MultiLineString':g.coordinates.forEach((c,i)=>addLine(c,[i],false));break;
      case'Polygon':g.coordinates.forEach((c,i)=>addLine(c,[i],true));break;
      case'MultiPolygon':g.coordinates.forEach((poly,i)=>poly.forEach((c,j)=>addLine(c,[i,j],true)));break;
    }
    return out;
  },

  _geometrySegmentEntries(layer,feature){
    const g=feature?.geometry;if(!g)return[];const out=[];
    const add=(coords,prefix,closed=false)=>{
      const n=coords.length-(closed&&coords.length>1?1:0);if(n<2)return;
      for(let i=0;i<n-1;i++)out.push({layer,feature,a:{path:[...prefix,i],coord:coords[i]},b:{path:[...prefix,i+1],coord:coords[i+1]}});
      if(closed&&n>2)out.push({layer,feature,a:{path:[...prefix,n-1],coord:coords[n-1]},b:{path:[...prefix,0],coord:coords[0]}});
    };
    switch(g.type){
      case'LineString':add(g.coordinates,[],false);break;
      case'MultiLineString':g.coordinates.forEach((c,i)=>add(c,[i],false));break;
      case'Polygon':g.coordinates.forEach((c,i)=>add(c,[i],true));break;
      case'MultiPolygon':g.coordinates.forEach((poly,i)=>poly.forEach((c,j)=>add(c,[i,j],true)));break;
    }
    return out;
  },

  _spatialEntryKey(ent){return String(ent.layer.id)+'::'+String(ent.feature.id)+'::'+ent.path.join('.');},
  _dedupeSpatialEntries(entries){const m=new Map();for(const e of entries||[])m.set(this._spatialEntryKey(e),e);return[...m.values()];},

  _pointSegmentDistancePx(p,a,b){
    const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,den=vx*vx+vy*vy;
    let t=den?((wx*vx+wy*vy)/den):0;t=Math.max(0,Math.min(1,t));
    const q=L.point(a.x+t*vx,a.y+t*vy),dx=p.x-q.x,dy=p.y-q.y;
    return{distance:Math.sqrt(dx*dx+dy*dy),point:q,t};
  },

  _pickSpatialPart(layer,feature,oe){
    const mapEl=this.map.getContainer(),r=mapEl.getBoundingClientRect(),p=L.point(oe.clientX-r.left,oe.clientY-r.top);
    const vertices=this._geometryVertexEntries(layer,feature);
    if(!vertices.length)return[];
    // Point geometries always move as a whole point.
    if(feature.geometry?.type==='Point'||feature.geometry?.type==='MultiPoint')return[vertices[0]];
    // Clicking very close to a vertex moves only that vertex (Arc-style vertex priority).
    let bestV=null,bestVD=Infinity;
    for(const v of vertices){const vp=this.map.latLngToContainerPoint([v.coord[1],v.coord[0]]),d=p.distanceTo(vp);if(d<bestVD){bestVD=d;bestV=v;}}
    if(bestV&&bestVD<=7)return[bestV];
    // Otherwise choose the nearest segment and move the two vertices forming that segment.
    let bestS=null,bestSD=Infinity;
    for(const s of this._geometrySegmentEntries(layer,feature)){
      const a=this.map.latLngToContainerPoint([s.a.coord[1],s.a.coord[0]]),b=this.map.latLngToContainerPoint([s.b.coord[1],s.b.coord[0]]),d=this._pointSegmentDistancePx(p,a,b).distance;
      if(d<bestSD){bestSD=d;bestS=s;}
    }
    if(bestS){
      const byPath=new Map(vertices.map(v=>[v.path.join('.'),v]));
      return this._dedupeSpatialEntries([byPath.get(bestS.a.path.join('.')),byPath.get(bestS.b.path.join('.'))].filter(Boolean));
    }
    return vertices;
  },

  // Hook called by layer-renderer on mousedown while Spatial Update is active.
  _beginSpatialFeatureDrag(layer,feature,leafletLayer,e){
    if(this.mode!=='spatial-update'||!this.editSessionActive||this._temporaryPan)return false;
    const oe=e?.originalEvent||e;if(!oe||oe.button!==0)return false;
    L.DomEvent.stopPropagation(e);L.DomEvent.preventDefault(e);
    const picked=this._pickSpatialPart(layer,feature,oe);if(!picked.length)return false;
    // If the clicked vertex/segment is already part of a rectangle/multi-layer selection,
    // keep the whole current selection and drag it as one group. Otherwise replace it.
    const current=this._spatialUpdate?.selection||[];
    const currentKeys=new Set(current.map(x=>this._spatialEntryKey(x)));
    const touchesCurrent=picked.some(x=>currentKeys.has(this._spatialEntryKey(x)));
    const dragEntries=touchesCurrent&&current.length?current:picked;
    if(!touchesCurrent)this._setSpatialSelection(picked);
    this._beginSpatialEntriesDrag(dragEntries,oe);
    return true;
  },

  _setSpatialSelection(entries){
    if(!this._spatialUpdate)return;
    this._spatialUpdate.selection=this._dedupeSpatialEntries(entries);
    this._createSpatialHandles(this._spatialUpdate.selection);
    this.emit?.('spatial:selection',{entries:this._spatialUpdate.selection.slice()});
  },

  _clearSpatialSelection(){
    this._clearSpatialHandles();
    if(this._spatialUpdate)this._spatialUpdate.selection=[];
  },

  _createSpatialHandles(entries){
    this._clearSpatialHandles();if(!this._spatialUpdate)return;this._spatialUpdate.handles=[];
    for(const ent of entries||[]){
      const ll=L.latLng(ent.coord[1],ent.coord[0]),size=ent.endpoint?11:9;
      const icon=L.divIcon({className:'',html:'<div class="ddc_meko-spatial-handle selected '+(ent.endpoint?'endpoint':'')+'" style="width:'+size+'px;height:'+size+'px"></div>',iconSize:[size,size],iconAnchor:[size/2,size/2]});
      const m=L.marker(ll,{icon,zIndexOffset:1800,keyboard:false}).addTo(this.map);m._ddcSpatialEntry=ent;
      m.on('mousedown',ev=>{const oe=ev.originalEvent||ev;if(oe.button!==0)return;L.DomEvent.stopPropagation(ev);L.DomEvent.preventDefault(ev);this._beginSpatialEntriesDrag(this._spatialUpdate.selection,oe);});
      this._spatialUpdate.handles.push(m);
    }
  },
  _clearSpatialHandles(){if(!this._spatialUpdate?.handles)return;for(const m of this._spatialUpdate.handles){try{this.map.removeLayer(m);}catch(_){ }}this._spatialUpdate.handles=[];},

  _getSpatialCoordinate(geometry,path){
    if(!geometry)return null;if(geometry.type==='Point')return geometry.coordinates;
    let arr=geometry.coordinates;for(const i of path||[])arr=arr?.[i];return arr;
  },
  _setSpatialCoordinate(geometry,path,coord){
    if(!geometry)return;if(geometry.type==='Point'){geometry.coordinates=[...coord];return;}
    let arr=geometry.coordinates;for(let i=0;i<path.length-1;i++)arr=arr[path[i]];const idx=path[path.length-1];if(idx==null)return;
    const old=arr[idx],next=[coord[0],coord[1],...(Array.isArray(old)?old.slice(2):[])];arr[idx]=next;
    if((geometry.type==='Polygon'||geometry.type==='MultiPolygon')&&idx===0&&Array.isArray(arr)&&arr.length>1){const last=arr.length-1;if(Array.isArray(arr[last]))arr[last]=[...next];}
  },

  _shiftSpatialCoord(coord,dx,dy){
    const p=this.map.latLngToLayerPoint(L.latLng(coord[1],coord[0]));
    const ll=this.map.layerPointToLatLng(L.point(p.x+dx,p.y+dy));
    return[ll.lng,ll.lat,...coord.slice(2)];
  },

  _beginSpatialEntriesDrag(entries,oe){
    entries=this._dedupeSpatialEntries(entries);if(!entries.length)return;
    const mapEl=this.map.getContainer(),mr=mapEl.getBoundingClientRect(),startPt=L.point(oe.clientX-mr.left,oe.clientY-mr.top),snapshot=this._snapshot();
    const groups=new Map();
    for(const ent of entries){
      const key=String(ent.layer.id)+'::'+String(ent.feature.id);
      if(!groups.has(key))groups.set(key,{layer:ent.layer,feature:ent.feature,startGeometry:JSON.parse(JSON.stringify(ent.feature.geometry)),entries:[]});
      groups.get(key).entries.push(ent);
    }
    let moved=false,lastDx=0,lastDy=0;
    try{this.map.dragging.disable();}catch(_){ }
    const move=ev=>{
      const pt=L.point(ev.clientX-mr.left,ev.clientY-mr.top),dx=pt.x-startPt.x,dy=pt.y-startPt.y;if(Math.abs(dx)+Math.abs(dy)<2)return;
      moved=true;lastDx=dx;lastDy=dy;
      const previews=[];
      for(const g of groups.values()){
        const geom=JSON.parse(JSON.stringify(g.startGeometry));
        for(const ent of g.entries){const base=this._getSpatialCoordinate(g.startGeometry,ent.path);if(base)this._setSpatialCoordinate(geom,ent.path,this._shiftSpatialCoord(base,dx,dy));}
        previews.push({layer:g.layer,feature:g.feature,geometry:geom});
      }
      this._renderSpatialSelectionPreview(previews);
      this._updateSpatialHandlePositions(entries,dx,dy,groups);
      ev.preventDefault();ev.stopPropagation();
    };
    const up=ev=>{
      document.removeEventListener('mousemove',move,true);document.removeEventListener('mouseup',up,true);this._removeSpatialPreview();
      if(moved){
        this._spatialSnapshotPush(snapshot);
        const touched=new Map();
        for(const g of groups.values()){
          const geom=JSON.parse(JSON.stringify(g.startGeometry));
          for(const ent of g.entries){const base=this._getSpatialCoordinate(g.startGeometry,ent.path);if(base)this._setSpatialCoordinate(geom,ent.path,this._shiftSpatialCoord(base,lastDx,lastDy));}
          g.feature.geometry=geom;touched.set(g.layer.id,g.layer);
        }
        for(const l of touched.values())this._renderLayer(l);
        this._syncProject();this._setDirty?.('spatial-update');
        this.emit?.('feature:geometry-updated',{entries:entries.slice(),mode:'spatial-update'});
      }
      // Keep Spatial Update mode active and rebuild handles from the committed geometry.
      const refreshed=[];
      for(const ent of entries){const all=this._geometryVertexEntries(ent.layer,ent.feature),match=all.find(x=>x.path.join('.')===ent.path.join('.'));if(match)refreshed.push(match);}
      this._setSpatialSelection(refreshed);
      ev?.preventDefault?.();ev?.stopPropagation?.();
    };
    document.addEventListener('mousemove',move,true);document.addEventListener('mouseup',up,true);
  },

  _updateSpatialHandlePositions(entries,dx,dy,groups){
    if(!this._spatialUpdate?.handles)return;
    const byKey=new Map();
    for(const g of groups.values())for(const ent of g.entries){const base=this._getSpatialCoordinate(g.startGeometry,ent.path);if(base)byKey.set(this._spatialEntryKey(ent),this._shiftSpatialCoord(base,dx,dy));}
    for(const m of this._spatialUpdate.handles){const ent=m._ddcSpatialEntry,c=byKey.get(this._spatialEntryKey(ent));if(c)m.setLatLng([c[1],c[0]]);}
  },

  _renderSpatialSelectionPreview(items){
    this._removeSpatialPreview();const group=L.layerGroup().addTo(this.map);
    for(const it of items){
      const f={type:'Feature',id:it.feature.id,properties:it.feature.properties||{},geometry:it.geometry};
      const gj=L.geoJSON(f,{interactive:false,style:x=>Object.assign({},this._featureLeafStyle(it.layer,x),{dashArray:'6 4',opacity:.82}),pointToLayer:(x,ll)=>this._pointToLayerStyled(it.layer,x,ll)}).addTo(group);
      gj.eachLayer?.(x=>{x.options.interactive=false;if(x._path)x._path.style.pointerEvents='none';});
    }
    this._spatialPreview=group;
  },
  _removeSpatialPreview(){if(this._spatialPreview){try{this.map.removeLayer(this._spatialPreview);}catch(_){}this._spatialPreview=null;}},

  _installSpatialBoxHandlers(){
    if(this._spatialBoxHandlers||!this.map)return;const el=this.map.getContainer();
    const down=e=>{
      if(this.mode!=='spatial-update'||this._temporaryPan||e.button!==0)return;
      if(e.target.closest?.('.leaflet-marker-icon,.leaflet-interactive,.leaflet-control,.ddc_meko-panel,.ddc_meko-toolbar,.ddc_meko-edit-toolbar,.ddc_meko-modal'))return;
      const r=el.getBoundingClientRect();this._spatialDrag={sx:e.clientX-r.left,sy:e.clientY-r.top,x:e.clientX-r.left,y:e.clientY-r.top,moved:false};
      try{this.map.dragging.disable();}catch(_){ }e.preventDefault();e.stopPropagation();
    };
    const move=e=>{const d=this._spatialDrag;if(!d)return;const r=el.getBoundingClientRect();d.x=Math.max(0,Math.min(r.width,e.clientX-r.left));d.y=Math.max(0,Math.min(r.height,e.clientY-r.top));if(Math.abs(d.x-d.sx)+Math.abs(d.y-d.sy)>4)d.moved=true;if(d.moved)this._drawSpatialBox(d);e.preventDefault();e.stopPropagation();};
    const up=e=>{
      const d=this._spatialDrag;if(!d)return;this._spatialDrag=null;this._removeSpatialBox();if(!d.moved)return;
      const left=Math.min(d.sx,d.x),right=Math.max(d.sx,d.x),top=Math.min(d.sy,d.y),bottom=Math.max(d.sy,d.y),hits=[];
      // Intentionally scan every visible layer. One rectangle may select vertices from
      // main pipes, service pipes, junctions, polygons... and move them together.
      for(const l of this.layers.filter(x=>x.visible!==false))for(const f of l.fc.features||[])for(const ent of this._geometryVertexEntries(l,f)){
        const p=this.map.latLngToContainerPoint([ent.coord[1],ent.coord[0]]);if(p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom)hits.push(ent);
      }
      const op=(e.shiftKey?'add':(e.ctrlKey||e.metaKey?'toggle':'replace'));
      let next=hits;
      if(op!=='replace'){
        const m=new Map((this._spatialUpdate?.selection||[]).map(x=>[this._spatialEntryKey(x),x]));
        for(const h of hits){const k=this._spatialEntryKey(h);if(op==='toggle'&&m.has(k))m.delete(k);else m.set(k,h);}
        next=[...m.values()];
      }
      this._setSpatialSelection(next);
      this.toast(next.length?this.t('spatial.verticesSelected',{count:next.length}):this.t('spatial.noVertices'),2500);
      e.preventDefault();e.stopPropagation();
    };
    el.addEventListener('mousedown',down,true);document.addEventListener('mousemove',move,true);document.addEventListener('mouseup',up,true);this._spatialBoxHandlers={el,down,move,up};
  },
  _drawSpatialBox(d){if(!this._spatialBoxEl){this._spatialBoxEl=document.createElement('div');this._spatialBoxEl.className='ddc_meko-spatial-box';this.root.appendChild(this._spatialBoxEl);}Object.assign(this._spatialBoxEl.style,{left:Math.min(d.sx,d.x)+'px',top:Math.min(d.sy,d.y)+'px',width:Math.abs(d.x-d.sx)+'px',height:Math.abs(d.y-d.sy)+'px'});},
  _removeSpatialBox(){if(this._spatialBoxEl){this._spatialBoxEl.remove();this._spatialBoxEl=null;}}
});
