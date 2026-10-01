// Module: tools/topology-snap-editor.js
// Manual topology snap editor (no Geoman vertex-drag persistence).
// Source geometry is stored as GeoJSON/WGS84 [lng,lat].
// Snapping is evaluated in current map screen pixels for stable UX.
Object.assign(WaterMapCore.prototype, {
  _ensureTopologySnapStyles(){
    if(document.getElementById('ddc_meko_topology_snap_css'))return;
    const s=document.createElement('style');s.id='ddc_meko_topology_snap_css';s.textContent=`
.ddc_meko-snap-active{box-shadow:inset 0 0 0 2px rgba(11,142,166,.25)}
.ddc_meko-snap-hint{position:absolute;left:50%;top:10px;transform:translateX(-50%);z-index:960;background:rgba(17,24,39,.9);color:#fff;padding:6px 10px;border-radius:6px;font-size:12px;pointer-events:none}
.ddc_meko-topology-vertex{width:12px;height:12px;border:2px solid #0aa6b8;border-radius:50%;background:#fff;box-sizing:border-box;box-shadow:0 1px 3px rgba(0,0,0,.28);cursor:grab}
.ddc_meko-topology-vertex.dragging{cursor:grabbing;border-color:#ff9800;box-shadow:0 0 0 4px rgba(255,152,0,.18)}
.ddc_meko-topology-snap-target{width:14px;height:14px;border:2px solid #00b894;border-radius:50%;background:rgba(255,255,255,.9);box-sizing:border-box;box-shadow:0 0 0 5px rgba(0,184,148,.18);pointer-events:none}
`;
    document.head.appendChild(s);
  },

  debugCRS(){
    const rows=this.layers.map(l=>({layer:l.name,sourceCRS:l.sourceCRS||'unknown',workingCRS:l.workingCRS||'EPSG:4326',sample:this._firstGeometryCoordinate?.(l.fc?.features?.[0]?.geometry)||null}));
    const result={mapCRS:this.map?.options?.crs?.code||'EPSG:3857 (Leaflet default)',workingCRS:'EPSG:4326',layers:rows};
    console.table(rows);console.log('[WaterMapCore CRS]',result);return result;
  },

  _firstGeometryCoordinate(g){
    let c=g?.coordinates;while(Array.isArray(c)&&Array.isArray(c[0]))c=c[0];
    return Array.isArray(c)&&typeof c[0]==='number'?[c[0],c[1]]:null;
  },
  _validateTopologySnapCRS(layer){
    if(!layer)return false;
    if((layer.workingCRS||'EPSG:4326')!=='EPSG:4326'){this.toast('Topology Snap yêu cầu working CRS EPSG:4326.',5000);return false;}
    const sample=this._firstGeometryCoordinate(layer.fc?.features?.find(f=>f.geometry)?.geometry);
    if(sample&&(!Number.isFinite(sample[0])||!Number.isFinite(sample[1])||Math.abs(sample[0])>180||Math.abs(sample[1])>90)){
      this.toast('Tọa độ layer không phải WGS84 hợp lệ. Hãy kiểm tra CRS import.',6000);return false;
    }
    return true;
  },

  showTopologySnapTool(){
    if(this._topologySnapMode){this.disableTopologySnapTool();return;}
    const lineOrPoint=this.layers.filter(l=>['line','point'].includes(geomKind(l.geometryType)));
    if(!lineOrPoint.length||this.layers.length<2){this.toast(this.t('topologySnap.needLayers'));return;}
    this._ensureTopologySnapStyles();
    const sourceOpts=lineOrPoint.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+' ('+esc(geomKind(l.geometryType))+')</option>').join('');
    const targetOpts=this.layers.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+' ('+esc(geomKind(l.geometryType))+')</option>').join('');
    const h=''
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologySnap.editLayer'))+'</span><select id="ddcSnapEditSource">'+sourceOpts+'</select></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologySnap.targetLayer'))+'</span><select id="ddcSnapEditTarget">'+targetOpts+'</select></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologySnap.tolerancePx'))+'</span><input id="ddcSnapEditTolerance" type="number" min="3" max="50" step="1" value="12"></label>'
      +'<div class="ddc_meko-warning">'+esc(this.t('topologySnap.help'))+'</div>';
    this._modal(this.t('topologySnap.title'),h,[
      {text:this.t('topologySnap.start'),primary:true,fn:()=>{
        const source=this.modalWrap.querySelector('#ddcSnapEditSource').value;
        const target=this.modalWrap.querySelector('#ddcSnapEditTarget').value;
        const px=Number(this.modalWrap.querySelector('#ddcSnapEditTolerance').value)||12;
        this._closeModal();this.enableTopologySnapTool(source,target,px);
      }},
      {text:this.t('common.cancel'),fn:()=>this._closeModal()}
    ]);
    // Same-layer snapping is allowed. The currently edited feature is excluded from targets,
    // so a main pipe can snap to another main pipe without snapping to itself.
  },

  enableTopologySnapTool(sourceLayerId,targetLayerId,snapDistance=12){
    this.disableTopologySnapTool(true);
    const src=this.getLayer(sourceLayerId),dst=this.getLayer(targetLayerId);if(!src||!dst)return;
    if(!this._validateTopologySnapCRS(src)||!this._validateTopologySnapCRS(dst))return;
    this._topologySnapMode={sourceLayerId,targetLayerId,snapDistance:Number(snapDistance)||12,editing:null,drag:null,snapIndicator:null};
    this.mode='topology-snap';this.root.classList.add('ddc_meko-snap-active');this._setToolActive?.('snap-edit');this._showTopologySnapHint();
    this.toast(this.t('topologySnap.active',{source:src.name,target:dst.name}));
    this.emit('topology:snap-start',{sourceLayer:src,targetLayer:dst,snapDistance:this._topologySnapMode.snapDistance});
  },

  disableTopologySnapTool(silent=false){
    if(!this._topologySnapMode)return;
    this._finishTopologySnapFeature(true);
    const old=this._topologySnapMode;this._topologySnapMode=null;this.mode='select';this.root.classList.remove('ddc_meko-snap-active');this._removeTopologySnapHint();this._setToolActive?.('select');
    if(!silent)this.toast(this.t('topologySnap.stopped'));this.emit('topology:snap-stop',{state:old});
  },
  _showTopologySnapHint(){this._removeTopologySnapHint();const d=document.createElement('div');d.className='ddc_meko-snap-hint';d.textContent=this.t('topologySnap.hint');this.root.appendChild(d);this._topologySnapHint=d;},
  _removeTopologySnapHint(){if(this._topologySnapHint){this._topologySnapHint.remove();this._topologySnapHint=null;}},

  _findLeafletFeatureLayer(layer,fid){let found=null;layer?.leaflet?.eachLayer?.(x=>{if(found)return;if(String(x.feature?.id)===String(fid))found=x;});return found;},
  _walkGeoVertices(coords,path=[],out=[]){
    if(!Array.isArray(coords))return out;
    if(coords.length>=2&&typeof coords[0]==='number'&&typeof coords[1]==='number'){out.push({path:path.slice(),coord:coords});return out;}
    coords.forEach((x,i)=>this._walkGeoVertices(x,path.concat(i),out));return out;
  },
  _getGeoCoordinateAtPath(feature,path){
    let cur=feature?.geometry?.coordinates;if(!cur)return null;
    for(const idx of path){if(!Array.isArray(cur)||cur[idx]==null)return null;cur=cur[idx];}
    return Array.isArray(cur)&&typeof cur[0]==='number'?[cur[0],cur[1]]:null;
  },
  _setGeoCoordinateAtPath(feature,path,ll){
    if(!feature?.geometry||!Array.isArray(path)||!ll)return false;
    if(feature.geometry.type==='Point'&&path.length===0){const old=feature.geometry.coordinates||[];feature.geometry.coordinates=[ll.lng,ll.lat].concat(old.slice(2));return true;}
    let cur=feature.geometry.coordinates;
    for(let i=0;i<path.length-1;i++){if(!Array.isArray(cur)||cur[path[i]]==null)return false;cur=cur[path[i]];}
    const idx=path[path.length-1];if(!Array.isArray(cur)||cur[idx]==null)return false;
    const old=Array.isArray(cur[idx])?cur[idx]:[];cur[idx]=[ll.lng,ll.lat].concat(old.slice(2));return true;
  },
  _cloneGeometry(g){return g?JSON.parse(JSON.stringify(g)):null;},
  _leafLatLngsFromGeoCoords(coords){
    if(!Array.isArray(coords))return coords;
    if(coords.length>=2&&typeof coords[0]==='number'&&typeof coords[1]==='number')return L.latLng(coords[1],coords[0]);
    return coords.map(x=>this._leafLatLngsFromGeoCoords(x));
  },
  _applyGeometryToLeafGeometry(g,leaf){
    if(!g||!leaf)return;
    if(g.type==='Point'&&leaf.setLatLng){leaf.setLatLng(L.latLng(g.coordinates[1],g.coordinates[0]));return;}
    if(leaf.setLatLngs)leaf.setLatLngs(this._leafLatLngsFromGeoCoords(g.coordinates));leaf.redraw?.();
  },
  _applyFeatureGeometryToLeaf(feature,leaf){this._applyGeometryToLeafGeometry(feature?.geometry,leaf);},

  _closestPointOnLayerSegment(p,a,b){
    const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,len2=vx*vx+vy*vy;
    if(!len2)return{point:L.point(a.x,a.y),distance:p.distanceTo(a),t:0};
    let t=(wx*vx+wy*vy)/len2;t=Math.max(0,Math.min(1,t));
    const q=L.point(a.x+t*vx,a.y+t*vy);return{point:q,distance:p.distanceTo(q),t};
  },
  _nearestTopologySnapCandidate(targetLayerId,rawLL,maxPx,excludeFeatureId=null){
    const target=this.getLayer(targetLayerId);if(!target||!rawLL)return null;
    const p=this.map.latLngToLayerPoint(rawLL),limit=Math.max(0,Number(maxPx)||0);let best=null;
    const consider=(ll,feature,type,path)=>{
      const q=this.map.latLngToLayerPoint(ll),d=p.distanceTo(q);
      if(d<=limit&&(!best||d<best.distancePx))best={latlng:L.latLng(ll.lat,ll.lng),distancePx:d,feature,type,path:path?.slice?.()||[]};
    };
    const scan=(coords,feature,pathPrefix=[])=>{
      if(!Array.isArray(coords)||!coords.length)return;
      if(typeof coords[0]?.[0]==='number'){
        for(let i=0;i<coords.length;i++){
          const aLL=L.latLng(coords[i][1],coords[i][0]);consider(aLL,feature,'vertex',pathPrefix.concat(i));
          if(i<coords.length-1){
            const bLL=L.latLng(coords[i+1][1],coords[i+1][0]),a=this.map.latLngToLayerPoint(aLL),b=this.map.latLngToLayerPoint(bLL),c=this._closestPointOnLayerSegment(p,a,b);
            if(c.distance<=limit&&(!best||c.distance<best.distancePx))best={latlng:this.map.layerPointToLatLng(c.point),distancePx:c.distance,feature,type:'segment',path:pathPrefix.concat(i)};
          }
        }
      }else coords.forEach((x,i)=>scan(x,feature,pathPrefix.concat(i)));
    };
    for(const f of target.fc?.features||[]){
      if(excludeFeatureId!=null&&String(f.id)===String(excludeFeatureId))continue;
      const g=f.geometry;if(!g)continue;
      if(g.type==='Point')consider(L.latLng(g.coordinates[1],g.coordinates[0]),f,'point',[]);
      else if(g.type==='MultiPoint')(g.coordinates||[]).forEach((c,i)=>consider(L.latLng(c[1],c[0]),f,'point',[i]));
      else scan(g.coordinates,f,[]);
    }
    return best;
  },

  _makeTopologyVertexIcon(){return L.divIcon({className:'',html:'<div class="ddc_meko-topology-vertex"></div>',iconSize:[12,12],iconAnchor:[6,6]});},
  _makeTopologySnapTargetIcon(){return L.divIcon({className:'',html:'<div class="ddc_meko-topology-snap-target"></div>',iconSize:[14,14],iconAnchor:[7,7]});},
  _eventContainerPoint(ev){
    const oe=ev?.touches?.[0]||ev?.changedTouches?.[0]||ev; if(!oe)return null;
    const r=this.map.getContainer().getBoundingClientRect();return L.point(oe.clientX-r.left,oe.clientY-r.top);
  },
  _installVertexPointerDrag(marker,path){
    marker.on('add',()=>{
      const el=marker.getElement?.();if(!el)return;
      const down=(ev)=>{ev.preventDefault();ev.stopPropagation();this._beginManualTopologyVertexDrag(marker,path,ev);};
      el.__ddcPointerDown=down;el.addEventListener('pointerdown',down,{passive:false});
    });
    marker.on('remove',()=>{const el=marker.getElement?.();if(el?.__ddcPointerDown)el.removeEventListener('pointerdown',el.__ddcPointerDown);});
  },
  _beginManualTopologyVertexDrag(marker,path,ev){
    const st=this._topologySnapMode,ed=st?.editing;if(!st||!ed)return;
    if(st.drag)this._endManualTopologyVertexDrag(null,true);
    this.map.dragging?.disable();
    const el=marker.getElement?.();el?.querySelector?.('.ddc_meko-topology-vertex')?.classList.add('dragging');
    const previewFeature={type:'Feature',properties:ed.feature.properties||{},geometry:this._cloneGeometry(ed.feature.geometry)};
    st.drag={marker,path:path.slice(),previewFeature,lastCandidate:null,committed:false};
    const move=e=>this._moveManualTopologyVertexDrag(e),up=e=>this._endManualTopologyVertexDrag(e,false),cancel=e=>this._endManualTopologyVertexDrag(e,true);
    st.drag.move=move;st.drag.up=up;st.drag.cancel=cancel;
    window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up,{passive:false});window.addEventListener('pointercancel',cancel,{passive:false});
    try{el?.setPointerCapture?.(ev.pointerId);}catch(_){}
  },
  _moveManualTopologyVertexDrag(ev){
    const st=this._topologySnapMode,d=st?.drag,ed=st?.editing;if(!d||!ed)return;
    ev.preventDefault();
    const cp=this._eventContainerPoint(ev);if(!cp)return;
    const rawLL=this.map.containerPointToLatLng(cp),candidate=this._nearestTopologySnapCandidate(st.targetLayerId,rawLL,st.snapDistance,ed.feature?.id),displayLL=candidate?.latlng||rawLL;
    d.lastCandidate=candidate||null;d.marker.setLatLng(displayLL);
    this._setGeoCoordinateAtPath(d.previewFeature,d.path,displayLL);this._applyGeometryToLeafGeometry(d.previewFeature.geometry,ed.leaf);
    this._showManualSnapIndicator(candidate?.latlng||null);
  },
  _showManualSnapIndicator(ll){
    const st=this._topologySnapMode;if(!st)return;
    if(!ll){if(st.snapIndicator){this.map.removeLayer(st.snapIndicator);st.snapIndicator=null;}return;}
    if(!st.snapIndicator)st.snapIndicator=L.marker(ll,{icon:this._makeTopologySnapTargetIcon(),interactive:false,zIndexOffset:20000}).addTo(this.map);
    else st.snapIndicator.setLatLng(ll);
  },
  _endManualTopologyVertexDrag(ev,cancel=false){
    const st=this._topologySnapMode,d=st?.drag,ed=st?.editing;if(!d||!ed)return;
    if(ev)ev.preventDefault();
    window.removeEventListener('pointermove',d.move);window.removeEventListener('pointerup',d.up);window.removeEventListener('pointercancel',d.cancel);
    this.map.dragging?.enable();
    const el=d.marker.getElement?.();el?.querySelector?.('.ddc_meko-topology-vertex')?.classList.remove('dragging');
    this._showManualSnapIndicator(null);
    if(cancel){
      const old=this._getGeoCoordinateAtPath(ed.feature,d.path);if(old)d.marker.setLatLng(L.latLng(old[1],old[0]));this._applyFeatureGeometryToLeaf(ed.feature,ed.leaf);st.drag=null;return;
    }
    const finalLL=d.marker.getLatLng();
    if(!finalLL){st.drag=null;return;}
    // If a snap candidate exists, it is the only authoritative final coordinate.
    const authoritativeLL=d.lastCandidate?.latlng||finalLL;
    d.marker.setLatLng(authoritativeLL);
    this._pushUndo();
    if(this._setGeoCoordinateAtPath(ed.feature,d.path,authoritativeLL)){
      this._applyFeatureGeometryToLeaf(ed.feature,ed.leaf);
      this._setDirty?.('topology-snap');this._syncProject?.();
      this.emit('feature:updated',{layer:ed.layer,feature:ed.feature,reason:'topology-snap-manual'});
      this.emit('topology:snap-committed',{layer:ed.layer,feature:ed.feature,path:d.path.slice(),latlng:{lat:authoritativeLL.lat,lng:authoritativeLL.lng},targetType:d.lastCandidate?.type||null,distancePx:d.lastCandidate?.distancePx??null});
    }
    st.drag=null;
  },

  _startTopologySnapEdit(layer,feature){
    const st=this._topologySnapMode;if(!st||layer.id!==st.sourceLayerId)return;
    if(st.editing&&String(st.editing.feature.id)===String(feature.id))return;
    this._finishTopologySnapFeature(true);
    const leaf=this._findLeafletFeatureLayer(layer,feature.id);if(!leaf){this.toast(this.t('topologySnap.noEditableGeometry'));return;}
    this._ensureEditSessionForFeatureAction?.();
    const handles=L.layerGroup().addTo(this.map),verts=this._walkGeoVertices(feature.geometry?.coordinates||[]);
    verts.forEach(v=>{
      const ll=L.latLng(v.coord[1],v.coord[0]),m=L.marker(ll,{icon:this._makeTopologyVertexIcon(),interactive:true,keyboard:false,zIndexOffset:15000});
      m.__ddcVertexPath=v.path.slice();this._installVertexPointerDrag(m,m.__ddcVertexPath);m.addTo(handles);
    });
    st.editing={layer,feature,leaf,handles};this.activeLayerId=layer.id;this.toast(this.t('topologySnap.editing',{id:feature.id}));
  },

  _finishTopologySnapFeature(keepMode=true){
    const st=this._topologySnapMode,ed=st?.editing;if(!ed)return;
    if(st.drag)this._endManualTopologyVertexDrag(null,true);
    this._showManualSnapIndicator(null);
    try{if(ed.handles)this.map.removeLayer(ed.handles);this._applyFeatureGeometryToLeaf(ed.feature,ed.leaf);this._syncProject?.();}catch(err){console.error(err);}
    st.editing=null;if(ed.layer)this._renderLayer(ed.layer);
  },

  _handleTopologySnapFeatureClick(layer,feature){
    const st=this._topologySnapMode;if(!st)return false;
    if(layer.id!==st.sourceLayerId){this.toast(this.t('topologySnap.pickSource'));return true;}
    this._startTopologySnapEdit(layer,feature);return true;
  }
});
