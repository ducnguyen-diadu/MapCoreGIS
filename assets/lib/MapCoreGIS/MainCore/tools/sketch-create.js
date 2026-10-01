// Module: tools/sketch-create.js - Arc-style sketch tool cho Add New (thay Geoman draw).
// Nạp SAU layer-create.js và snap-engine.js.
Object.assign(WaterMapCore.prototype,{
  _ensureSketchCss(){
    if(document.getElementById('ddc_meko_sketch_css'))return;
    const s=document.createElement('style');s.id='ddc_meko_sketch_css';s.textContent=
'.ddc_meko-drawing,.ddc_meko-drawing .leaflet-interactive,.ddc_meko-drawing .leaflet-grab,.ddc_meko-drawing .leaflet-dragging .leaflet-grab{cursor:crosshair!important}'+
'.ddc_meko-draw-hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:960;background:rgba(17,24,39,.88);color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;pointer-events:none;white-space:nowrap;max-width:94%;overflow:hidden;text-overflow:ellipsis}';
    document.head.appendChild(s);
  },

  _beginLayerCreate(layer,opt){
    if(!layer||this.pending)return;
    if(this.mode==='spatial-update')this.stopSpatialUpdate?.(false);
    try{this.map.pm?.disableDraw();}catch(_){}
    this._ensureSketchCss();this._ensureSnapEngineCss?.();
    const map=this.map,box=map.getContainer(),kind=geomKind(layer.geometryType);
    this.mode='draw';
    const ses=this._layerCreateSession={layerId:layer.id,opt:Object.assign({},opt),allowed:new Set(opt.snapLayerIds||[]),activeSnapPoint:null,isSnapped:false,activeCandidate:null,sketch:[]};
    const v=this._resolveFeatureVisualStyle?.(layer,{properties:{}})||{};
    const base={color:v.color||'#0b8ea6',weight:Number(v.weight)||3,opacity:.95,interactive:false};
    const group=L.layerGroup().addTo(map);
    const hint=document.createElement('div');hint.className='ddc_meko-draw-hint';
    hint.textContent=this.t(kind==='point'?'create.hintPoint':'create.hintShape');this.root.appendChild(hint);
    box.classList.add('ddc_meko-drawing');
    try{map.doubleClickZoom.disable();}catch(_){}
    let lastCursor=null,downPt=null;

    const redraw=cursor=>{
      group.clearLayers();
      if(kind==='point'){
        if(cursor){const m=this._pointToLayerStyled(layer,{properties:{}},cursor);m.options.interactive=false;group.addLayer(m);}
        return;
      }
      const pts=ses.sketch.slice(),withCursor=cursor?pts.concat([cursor]):pts;
      if(kind==='polygon'&&withCursor.length>=3)group.addLayer(L.polygon(withCursor,{stroke:false,fillColor:v.fillColor||base.color,fillOpacity:.2,interactive:false}));
      if(pts.length>=2)group.addLayer(L.polyline(pts,base));
      if(cursor&&pts.length){
        group.addLayer(L.polyline([pts[pts.length-1],cursor],Object.assign({},base,{dashArray:'6 5',opacity:.8})));
        if(kind==='polygon'&&pts.length>=2)group.addLayer(L.polyline([cursor,pts[0]],Object.assign({},base,{dashArray:'3 6',opacity:.5,weight:2})));
      }
      pts.forEach(p=>group.addLayer(L.circleMarker(p,{radius:4,color:'#fff',weight:1.5,fillColor:'#0b8ea6',fillOpacity:1,interactive:false})));
    };

    // Một điểm duy nhất cho cả indicator lẫn dữ liệu ghi.
    const resolve=e=>{
      const raw=map.mouseEventToLatLng(e);
      const c=ses.opt.snappable?this._nearestCreateSnapCandidate(raw,ses):null;
      if(c?.latlng){ses.activeCandidate=c;ses.activeSnapPoint=c.latlng;ses.isSnapped=true;return c.latlng;}
      ses.activeCandidate=null;ses.activeSnapPoint=null;ses.isSnapped=false;return L.latLng(raw.lat,raw.lng);
    };

    const cleanup=()=>{
      if(this._layerCreateCleanup===cleanup)this._layerCreateCleanup=null;
      box.removeEventListener('mousedown',onDown,true);box.removeEventListener('mousemove',onMove,true);
      box.removeEventListener('mouseleave',onLeave,true);box.removeEventListener('click',onClick,true);box.removeEventListener('dblclick',onDbl,true);
      document.removeEventListener('keydown',onKey,true);
      try{map.removeLayer(group);}catch(_){}
      this._snapIndicatorHide?.();hint.remove();box.classList.remove('ddc_meko-drawing');
      setTimeout(()=>{try{map.doubleClickZoom.enable();}catch(_){}},450);
      if(this._layerCreateSession===ses)this._layerCreateSession=null;
      if(this.mode==='draw')this.mode='select';
    };
    this._layerCreateCleanup=cleanup;

    const stage=geometry=>{cleanup();this._stageCreate(layer,{type:'Feature',properties:{},geometry});};
    const clearSketch=()=>{ses.sketch.length=0;redraw(lastCursor);};
    const finish=()=>{
      if(kind==='point')return;
      const pts=ses.sketch.map(p=>[p.lng,p.lat]);
      if(kind==='polygon'&&pts.length>3){const a=pts[0],b=pts[pts.length-1];if(a[0]===b[0]&&a[1]===b[1])pts.pop();}
      const need=kind==='line'?2:3;
      if(pts.length<need){this.toast(this.t('create.tooFew',{n:need}));clearSketch();return;}
      stage(kind==='line'?{type:'LineString',coordinates:pts}:{type:'Polygon',coordinates:[pts.concat([pts[0].slice()])]});
    };

    const onDown=e=>{downPt={x:e.clientX,y:e.clientY};};
    const onMove=e=>{
      if(this._layerCreateSession!==ses)return;
      lastCursor=resolve(e);this._snapIndicatorUpdate?.(ses);redraw(lastCursor);
    };
    const onLeave=()=>{this._snapIndicatorHide?.();redraw(null);};
    const onClick=e=>{
      if(this._layerCreateSession!==ses||this._temporaryPan||e.button!==0)return;
      if(e.target.closest?.('.leaflet-control'))return;
      e.stopPropagation();e.preventDefault();
      if(downPt&&Math.hypot(e.clientX-downPt.x,e.clientY-downPt.y)>4)return; // vừa kéo pan
      const ll=resolve(e);
      if(kind==='point'){stage({type:'Point',coordinates:[ll.lng,ll.lat]});return;}
      const last=ses.sketch[ses.sketch.length-1];
      if(last&&map.latLngToContainerPoint(last).distanceTo(map.latLngToContainerPoint(ll))<3)return; // click thứ 2 của double-click
      ses.sketch.push(ll);lastCursor=ll;redraw(ll);
    };
    const onDbl=e=>{
      if(this._layerCreateSession!==ses||e.target.closest?.('.leaflet-control'))return;
      e.stopPropagation();e.preventDefault();finish();
    };
    const onKey=e=>{
      if(this._layerCreateSession!==ses)return;
      const t=e.target;if(t&&(t.matches?.('input,textarea,select')||t.isContentEditable))return;
      const k=String(e.key||'').toLowerCase(),stop=()=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();};
      if(k==='escape'&&ses.sketch.length){stop();clearSketch();}          // Esc lần 1: hủy sketch
      else if(k==='enter'&&kind!=='point'){stop();finish();}
      else if((k==='backspace'||(k==='z'&&(e.ctrlKey||e.metaKey)))&&ses.sketch.length){stop();ses.sketch.pop();redraw(lastCursor);}
      else if((k==='m'||k==='v')&&!e.ctrlKey&&!e.metaKey&&!e.altKey)this._endLayerCreateSeries?.(true); // đổi tool
    };
    box.addEventListener('mousedown',onDown,true);box.addEventListener('mousemove',onMove,true);
    box.addEventListener('mouseleave',onLeave,true);box.addEventListener('click',onClick,true);box.addEventListener('dblclick',onDbl,true);
    document.addEventListener('keydown',onKey,true);
  }
});