// Module: render/clustering.js - lightweight per-layer point clustering without external plugin.
Object.assign(WaterMapCore.prototype, {
  _ensureClusterCss(){
    if(document.getElementById('ddc_meko_cluster_css'))return;const s=document.createElement('style');s.id='ddc_meko_cluster_css';s.textContent='.ddc_meko-cluster{display:flex;align-items:center;justify-content:center;border-radius:50%;background:#0b8ea6;color:#fff;border:3px solid rgba(255,255,255,.9);box-shadow:0 1px 6px rgba(0,0,0,.28);font-weight:700}.ddc_meko-cluster:hover{transform:scale(1.06)}';document.head.appendChild(s);
  },
  _renderPointLayerClustered(layer){
    this._ensureClusterCss();const group=L.layerGroup();layer.leaflet=group;if(layer.visible!==false)group.addTo(this.map);
    const radius=Math.max(25,Number(layer.clustering?.radius)||60),buckets=new Map();
    (layer.fc.features||[]).forEach(f=>{if(f.geometry?.type!=='Point')return;const ll=L.latLng(f.geometry.coordinates[1],f.geometry.coordinates[0]);const p=this.map.latLngToLayerPoint(ll),k=Math.floor(p.x/radius)+':'+Math.floor(p.y/radius);const a=buckets.get(k)||[];a.push({f,ll});buckets.set(k,a);});
    const maxZoom=Number.isFinite(this.map.getMaxZoom?.())?this.map.getMaxZoom():20;
    buckets.forEach(items=>{
      if(items.length===1){const it=items[0],m=this._pointToLayerStyled(layer,it.f,it.ll);this._bindFeatureLayerEvents(layer,it.f,m);group.addLayer(m);return;}
      const lat=items.reduce((s,x)=>s+x.ll.lat,0)/items.length,lng=items.reduce((s,x)=>s+x.ll.lng,0)/items.length,size=items.length>99?44:items.length>9?38:34;
      if(this.map.getZoom()>=maxZoom-0.01){this._renderSpiderBucketInto(group,layer,items,[lat,lng]);return;}
      const marker=L.marker([lat,lng],{icon:L.divIcon({className:'',html:'<div class="ddc_meko-cluster" style="width:'+size+'px;height:'+size+'px">'+items.length+'</div>',iconSize:[size,size],iconAnchor:[size/2,size/2]})});
      marker.on('click',e=>{L.DomEvent.stopPropagation(e);this._zoomOrSpiderCluster(layer,items,[lat,lng]);});group.addLayer(marker);
    });
  },

  _renderSpiderBucketInto(group,layer,items,center){
    const cp=this.map.latLngToLayerPoint(L.latLng(center)),r=Math.max(28,Math.min(90,26+items.length*3));
    items.forEach((it,i)=>{const a=(Math.PI*2*i/items.length),pt=L.point(cp.x+Math.cos(a)*r,cp.y+Math.sin(a)*r),ll=this.map.layerPointToLatLng(pt);group.addLayer(L.polyline([center,ll],{color:'#8494a2',weight:1,opacity:.55,interactive:false}));const m=this._pointToLayerStyled(layer,it.f,ll);this._bindFeatureLayerEvents(layer,it.f,m);group.addLayer(m);});
  },
  _zoomOrSpiderCluster(layer,items,center){
    const features=items.map(x=>x.f),b=bboxFC({type:'FeatureCollection',features});if(!b)return;
    const same=b[0][0]===b[1][0]&&b[0][1]===b[1][1],maxZoom=Number.isFinite(this.map.getMaxZoom?.())?this.map.getMaxZoom():20;if(this.map.getZoom()<maxZoom-1&&!same){this.map.fitBounds(b,{padding:[40,40],maxZoom:maxZoom-1});return;}
    if(this._clusterSpiderGroup)this.map.removeLayer(this._clusterSpiderGroup);this._clusterSpiderGroup=L.layerGroup().addTo(this.map);const cp=this.map.latLngToLayerPoint(L.latLng(center)),r=Math.max(35,Math.min(90,items.length*5));
    items.forEach((it,i)=>{const a=(Math.PI*2*i/items.length),pt=L.point(cp.x+Math.cos(a)*r,cp.y+Math.sin(a)*r),ll=this.map.layerPointToLatLng(pt);const line=L.polyline([center,ll],{color:'#8494a2',weight:1,opacity:.7});const m=this._pointToLayerStyled(layer,it.f,ll);this._bindFeatureLayerEvents(layer,it.f,m);this._clusterSpiderGroup.addLayer(line);this._clusterSpiderGroup.addLayer(m);});
  },
  configureClustering(layerId){
    const l=this.getLayer(layerId)||this.getActiveLayer();if(!l||geomKind(l.geometryType)!=='point')return;const c=l.clustering||{enabled:false,radius:60,showCount:true};
    const h='<label class="ddc_meko-field"><span>'+esc(this.t('cluster.enabled'))+'</span><input id="ddcClusterEnabled" type="checkbox" '+(c.enabled?'checked':'')+'></label><label class="ddc_meko-field"><span>'+esc(this.t('cluster.radius'))+'</span><input id="ddcClusterRadius" type="number" min="25" max="150" value="'+esc(c.radius||60)+'"></label>';
    this._modal(this.t('cluster.title',{name:l.name}),h,[{text:this.t('common.save'),primary:true,fn:()=>{l.clustering={enabled:this.modalWrap.querySelector('#ddcClusterEnabled').checked,radius:Number(this.modalWrap.querySelector('#ddcClusterRadius').value)||60,showCount:true};this._renderLayer(l);this._syncProject();this._setDirty?.('clustering');this._closeModal();}},{text:this.t('common.cancel'),fn:()=>this._closeModal()}]);
  },
  _refreshClusteredLayers(){if(this._clusterSpiderGroup){this.map.removeLayer(this._clusterSpiderGroup);this._clusterSpiderGroup=null;}this.layers.filter(l=>geomKind(l.geometryType)==='point'&&l.clustering?.enabled).forEach(l=>this._renderLayer(l));}
});
