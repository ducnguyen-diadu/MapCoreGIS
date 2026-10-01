// Module: tools/snap-engine.js - Arc-style snapping: Point > End > Vertex > Edge, indexed lookup, indicator + tip.
Object.assign(WaterMapCore.prototype,{
  _ensureSnapEngineCss(){
    if(document.getElementById('ddc_meko_snap_engine_css'))return;
    const s=document.createElement('style');s.id='ddc_meko_snap_engine_css';s.textContent=
'.ddc_meko-snap-wrap{position:relative;width:14px;height:14px}'+
'.ddc_meko-snap-ind{position:absolute;left:1px;top:1px;width:12px;height:12px;box-sizing:border-box;border:2px solid;background:rgba(255,255,255,.25);pointer-events:none}'+
'.ddc_meko-snap-ind.point{border-color:#f59e0b;border-radius:50%}.ddc_meko-snap-ind.end{border-color:#16a34a}.ddc_meko-snap-ind.vertex{border-color:#e11d48}.ddc_meko-snap-ind.edge{border-color:#0ea5e9;transform:rotate(45deg)}'+
'.ddc_meko-snap-tip{position:absolute;left:18px;top:-6px;background:#fffbe6;border:1px solid #d6b656;color:#333;padding:1px 5px;font:11px Arial,sans-serif;white-space:nowrap;pointer-events:none}';
    document.head.appendChild(s);
  },

  _snapIndexKey(ses){
    const o=this.map.getPixelOrigin();let n=0;
    for(const l of this.layers||[])if(ses.allowed?.has(l.id)&&l.visible!==false)n+=(l.fc?.features?.length||0)+1;
    const op=ses.opt;
    return this.map.getZoom()+'|'+o.x+','+o.y+'|'+n+'|'+(op.snapVertex!==false)+(op.snapSegment!==false)+(op.snapEnd!==false)+'|'+(Number(op.snapDistance)||10);
  },

  _snapBuildIndex(ses,key){
    const map=this.map,size=map.getSize(),tl=map.containerPointToLayerPoint([0,0]);
    const bounds=L.bounds([tl.x-size.x,tl.y-size.y],[tl.x+size.x*2,tl.y+size.y*2]);
    const lim=Math.max(1,Number(ses.opt.snapDistance)||10),cell=Math.max(32,lim*3),cells=new Map();
    const useV=ses.opt.snapVertex!==false,useE=ses.opt.snapSegment!==false,useEnd=ses.opt.snapEnd!==false;
    const put=(cx,cy,it)=>{const k=cx+':'+cy;let a=cells.get(k);if(!a){a=[];cells.set(k,a);}a.push(it);};
    const pt=c=>map.latLngToLayerPoint([c[1],c[0]]);
    const addPoint=(c,type,layer,feature)=>{const p=pt(c);if(!bounds.contains(p))return;put(Math.floor(p.x/cell),Math.floor(p.y/cell),{k:0,x:p.x,y:p.y,c,type,layer,feature});};
    const addSeg=(a,b,ca,cb,layer,feature)=>{
      const x0=Math.min(a.x,b.x)-lim,x1=Math.max(a.x,b.x)+lim,y0=Math.min(a.y,b.y)-lim,y1=Math.max(a.y,b.y)+lim;
      if(x1<bounds.min.x||x0>bounds.max.x||y1<bounds.min.y||y0>bounds.max.y)return;
      const it={k:1,a,b,ca,cb,layer,feature};
      const cx0=Math.floor(Math.max(x0,bounds.min.x)/cell),cx1=Math.floor(Math.min(x1,bounds.max.x)/cell),cy0=Math.floor(Math.max(y0,bounds.min.y)/cell),cy1=Math.floor(Math.min(y1,bounds.max.y)/cell);
      for(let cx=cx0;cx<=cx1;cx++)for(let cy=cy0;cy<=cy1;cy++)put(cx,cy,it);
    };
    const visitLine=(coords,closed,layer,feature)=>{
      const n=coords?.length||0;if(!n)return;const P=coords.map(pt);
      for(let i=0;i<n;i++){
        if(closed&&i===n-1)break;
        const isEnd=!closed&&(i===0||i===n-1);
        const t=isEnd?(useEnd?'end':(useV?'vertex':null)):(useV?'vertex':null);
        if(t)addPoint(coords[i],t,layer,feature);
      }
      if(useE)for(let i=1;i<n;i++)addSeg(P[i-1],P[i],coords[i-1],coords[i],layer,feature);
    };
    for(const l of this.layers||[]){
      if(!ses.allowed?.has(l.id)||l.visible===false)continue;
      for(const f of l.fc?.features||[]){
        const g=f.geometry;if(!g)continue;
        switch(g.type){
          case'Point':addPoint(g.coordinates,'point',l,f);break;
          case'MultiPoint':(g.coordinates||[]).forEach(c=>addPoint(c,'point',l,f));break;
          case'LineString':visitLine(g.coordinates,false,l,f);break;
          case'MultiLineString':(g.coordinates||[]).forEach(a=>visitLine(a,false,l,f));break;
          case'Polygon':(g.coordinates||[]).forEach(a=>visitLine(a,true,l,f));break;
          case'MultiPolygon':(g.coordinates||[]).forEach(poly=>(poly||[]).forEach(a=>visitLine(a,true,l,f)));break;
        }
      }
    }
    return{key,bounds,cell,cells};
  },

  // Thay thế hàm cùng tên trong layer-create.js (nạp SAU layer-create.js).
  _nearestCreateSnapCandidate(rawLL,ses){
    if(!ses?.opt?.snappable||!rawLL)return null;
    const p=this.map.latLngToLayerPoint(rawLL),lim=Math.max(1,Number(ses.opt.snapDistance)||10),rank={point:0,end:1,vertex:2,edge:3};
    const key=this._snapIndexKey(ses);let idx=ses._snapIdx;
    if(!idx||idx.key!==key||!idx.bounds.contains(p))idx=ses._snapIdx=this._snapBuildIndex(ses,key);
    let best=null;const better=(rk,d)=>!best||rk<best.rk||(rk===best.rk&&d<best.distancePx);
    // 1) đỉnh đã đặt của sketch (bỏ đỉnh vừa đặt cuối); đỉnh đầu = End để đóng polygon
    const sk=ses.sketch||[],skLayer={name:this.t('create.sketch')};
    for(let i=0;i<sk.length-1;i++){
      const d=p.distanceTo(this.map.latLngToLayerPoint(sk[i]));
      if(d<=lim){const type=i===0?'end':'vertex',rk=rank[type];if(better(rk,d))best={rk,distancePx:d,type,layer:skLayer,feature:null,latlng:L.latLng(sk[i].lat,sk[i].lng)};}
    }
    // 2) dữ liệu các layer
    const c=idx.cell;
    for(let cx=Math.floor((p.x-lim)/c);cx<=Math.floor((p.x+lim)/c);cx++)for(let cy=Math.floor((p.y-lim)/c);cy<=Math.floor((p.y+lim)/c);cy++){
      for(const it of idx.cells.get(cx+':'+cy)||[]){
        if(it.k===0){
          const d=Math.hypot(it.x-p.x,it.y-p.y);
          if(d<=lim){const rk=rank[it.type];if(better(rk,d))best={rk,distancePx:d,type:it.type,layer:it.layer,feature:it.feature,latlng:L.latLng(it.c[1],it.c[0])};}
        }else{
          const dx=it.b.x-it.a.x,dy=it.b.y-it.a.y,l2=dx*dx+dy*dy;let t=0;
          if(l2>0)t=Math.max(0,Math.min(1,((p.x-it.a.x)*dx+(p.y-it.a.y)*dy)/l2));
          const q=L.point(it.a.x+t*dx,it.a.y+t*dy),d=p.distanceTo(q);
          if(d<=lim&&better(3,d))best={rk:3,distancePx:d,type:'edge',layer:it.layer,feature:it.feature,latlng:L.latLng(it.ca[1]+t*(it.cb[1]-it.ca[1]),it.ca[0]+t*(it.cb[0]-it.ca[0]))};
        }
      }
    }
    return best;
  },

  _snapIndicatorUpdate(ses){
    const c=ses?.isSnapped?ses.activeCandidate:null,ll=ses?.activeSnapPoint;
    if(!c||!ll){this._snapIndicatorHide();return;}
    this._ensureSnapEngineCss();
    const tip=(c.layer?.name||'')+': '+this.t('create.tip'+c.type.charAt(0).toUpperCase()+c.type.slice(1));
    const sig=c.type+'|'+tip;
    if(this._snapInd&&this._snapInd.sig===sig){this._snapInd.marker.setLatLng(ll);return;}
    this._snapIndicatorHide();
    const marker=L.marker(ll,{interactive:false,keyboard:false,zIndexOffset:30000,icon:L.divIcon({className:'',iconSize:[14,14],iconAnchor:[7,7],html:'<div class="ddc_meko-snap-wrap"><div class="ddc_meko-snap-ind '+c.type+'"></div><div class="ddc_meko-snap-tip">'+esc(tip)+'</div></div>'})}).addTo(this.map);
    this._snapInd={marker,sig};
  },
  _snapIndicatorHide(){if(this._snapInd){try{this.map.removeLayer(this._snapInd.marker);}catch(_){}this._snapInd=null;}}
});