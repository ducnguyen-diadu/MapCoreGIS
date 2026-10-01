// Module: render/layer-renderer.js
Object.assign(WaterMapCore.prototype, {
  _leafStyle(layer){const s=layer.style||{};return{color:s.color||'#0b8ea6',weight:s.weight||3,opacity:s.opacity??0.9,fillColor:s.fillColor||'#52b5c5',fillOpacity:s.fillOpacity??0.25};},
  _pointStyle(layer){const s=layer.style||{};return{radius:s.radius||6,color:s.stroke||'#fff',weight:1.5,fillColor:s.color||'#0b8ea6',fillOpacity:s.opacity??0.95};},
  _isFeatureSelected(layer,f){return (this.selection||[]).some(x=>x.layer?.id===layer.id&&String(x.feature?.id)===String(f.id))||(!this.selection?.length&&this.selected?.layer?.id===layer.id&&String(this.selected?.feature?.id)===String(f.id));},
  _featureLeafStyle(layer,f){
    const v=this._resolveFeatureVisualStyle?this._resolveFeatureVisualStyle(layer,f):Object.assign({},this._leafStyle(layer));
    const st={color:v.color||'#0b8ea6',weight:Number(v.weight)||3,opacity:v.opacity??0.9,fillColor:v.fillColor||layer.style?.fillColor||'#52b5c5',fillOpacity:v.fillOpacity??layer.style?.fillOpacity??0.25};
    if(this._isFeatureSelected(layer,f))return Object.assign({},st,{color:'#ffd400',weight:Math.max((st.weight||3)+3,6),opacity:1,fillOpacity:Math.max(st.fillOpacity??0.25,.4)});return st;
  },
  _featurePointStyle(layer,f){
    const v=this._resolveFeatureVisualStyle?this._resolveFeatureVisualStyle(layer,f):Object.assign({},this._pointStyle(layer));
    const st={radius:Number(v.radius)||6,color:v.stroke||layer.style?.stroke||'#fff',weight:1.5,fillColor:v.color||'#0b8ea6',fillOpacity:v.opacity??0.95};
    if(this._isFeatureSelected(layer,f))return Object.assign({},st,{radius:(st.radius||6)+3,color:'#ffd400',weight:3,fillOpacity:1});return st;
  },
  _ensurePointSymbolCss(){
    if(document.getElementById('ddc_meko_symbol_css'))return;const s=document.createElement('style');s.id='ddc_meko_symbol_css';s.textContent='.ddc_meko-symbol{display:flex;align-items:center;justify-content:center;font-weight:700;line-height:1;text-shadow:0 1px 1px rgba(255,255,255,.8)}.ddc_meko-symbol.selected{filter:drop-shadow(0 0 3px #ffd400)}';document.head.appendChild(s);
  },
  _symbolGlyph(symbol){return({circle:'●',square:'■',diamond:'◆',triangle:'▲',star:'★',junction:'●',valve:'◈',pump:'P',meter:'M',tank:'▣'})[symbol]||'●';},
  _pointToLayerStyled(layer,f,ll){
    const v=this._resolveFeatureVisualStyle?this._resolveFeatureVisualStyle(layer,f):{symbol:'circle'};const symbol=v.symbol||'circle';
    if(symbol==='circle')return L.circleMarker(ll,this._featurePointStyle(layer,f));
    this._ensurePointSymbolCss();const size=Math.max(12,(Number(v.radius)||6)*2.6),selected=this._isFeatureSelected(layer,f);const html='<div class="ddc_meko-symbol '+(selected?'selected':'')+'" style="width:'+size+'px;height:'+size+'px;font-size:'+size+'px;color:'+esc(v.color||'#0b8ea6')+'">'+this._symbolGlyph(symbol)+'</div>';
    return L.marker(ll,{icon:L.divIcon({className:'',html,iconSize:[size,size],iconAnchor:[size/2,size/2]})});
  },
  _renderLayer(layer){
    if(layer.leaflet)this.map.removeLayer(layer.leaflet);if(layer._hitLayer){try{this.map.removeLayer(layer._hitLayer);}catch(_){}layer._hitLayer=null;}
    if(geomKind(layer.geometryType)==='point'&&layer.clustering?.enabled&&this._renderPointLayerClustered){this._renderPointLayerClustered(layer);return;}
    layer.leaflet=L.geoJSON(layer.fc,{
      style:f=>this._featureLeafStyle(layer,f),
      pointToLayer:(f,ll)=>this._pointToLayerStyled(layer,f,ll),
      onEachFeature:(f,ll)=>this._bindFeatureLayerEvents(layer,f,ll)
    });
    if(layer.visible!==false)layer.leaflet.addTo(this.map);
    if(geomKind(layer.geometryType)==='line')this._buildLineHitLayer?.(layer);
    this._refreshDirectionLayer?.(layer);
  },

  _buildLineHitLayer(layer){
    if(layer._hitLayer){try{this.map.removeLayer(layer._hitLayer);}catch(_){}layer._hitLayer=null;}
    const hit=L.geoJSON(layer.fc,{style:f=>{const st=this._featureLeafStyle(layer,f);return{color:'#000',weight:Math.max(12,(Number(st.weight)||3)+8),opacity:.001,fill:false};},interactive:true,onEachFeature:(f,ll)=>this._bindFeatureLayerEvents(layer,f,ll)});
    layer._hitLayer=hit;if(layer.visible!==false)hit.addTo(this.map);
  },
  _bindFeatureLayerEvents(layer,f,ll){
    ll.on('mousedown',e=>{if(this.mode==='spatial-update'&&this._beginSpatialFeatureDrag?.(layer,f,ll,e))return;});
    ll.on('click',e=>{L.DomEvent.stopPropagation(e);if(this.mode==='spatial-update')return;if(this.mode==='draw'&&this._handleCreateTargetClick?.(layer,f,e))return;if(this.mode==='topology-snap'){this._handleTopologySnapFeatureClick?.(layer,f);return;}if(this.mode!=='select')return;const oe=e.originalEvent||{};this._selectFeature?.(layer,f,ll,{op:this._selectionOpFromEvent?.(oe)||'replace'});});
    ll.on('contextmenu',e=>{L.DomEvent.preventDefault(e);this._showContext(e.originalEvent.clientX,e.originalEvent.clientY,layer,f,ll);});
    if(layer.style?.labelField&&f.properties?.[layer.style.labelField]!=null)ll.bindTooltip(String(f.properties[layer.style.labelField]),{permanent:false});
  },
  _showSelected(layer,f){
    const body=this.panels.attrs.querySelector('.ddc_meko-panel-body');this.panels.attrs.classList.remove('hidden');let h='<b>'+esc(layer.name)+'</b><div style="height:8px"></div>';
    Object.keys(f.properties||{}).forEach(k=>h+='<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #edf1f3"><span style="color:#6a7a8b;min-width:90px">'+esc(k)+'</span><span>'+esc(f.properties[k])+'</span></div>');
    h+='<div class="ddc_meko-btnrow"><button class="ddc_meko-btn" data-a="edit">'+esc(this.t('common.edit'))+'</button><button class="ddc_meko-btn danger" data-a="del">'+esc(this.t('common.delete'))+'</button></div>';
    body.innerHTML=h;const eb=body.querySelector('[data-a=edit]'),db=body.querySelector('[data-a=del]');if(eb)eb.onclick=()=>{this._ensureEditSessionForFeatureAction?.();this.editSelected();};if(db)db.onclick=()=>{this._ensureEditSessionForFeatureAction?.();this.deleteSelected();};
  },
  _showContext(clientX,clientY,layer,f,ll){
    const rr=this.root.getBoundingClientRect();const x=Math.max(4,Math.min(clientX-rr.left,rr.width-220));const y=Math.max(4,Math.min(clientY-rr.top,rr.height-330));this.contextEl.style.left=x+'px';this.contextEl.style.top=y+'px';this.contextEl.classList.remove('hidden');
    const acts=[[this.t('context.zoomTo'),()=>this.zoomToFeature(layer.id,f.id)],[this.t('context.panTo'),()=>this.panToFeature(layer.id,f.id)],[this.t('context.flash'),()=>this.flashFeature(layer.id,f.id)],[this.t('context.select'),()=>this._selectFeature?.(layer,f,ll,{add:false})]];
    acts.push([this.t('context.editAttributes'),()=>{this._selectFeature?.(layer,f,ll,{add:false});this._ensureEditSessionForFeatureAction?.();this.editSelected();}]);
    if(this.editSessionActive)acts.push([this.t('context.duplicate'),()=>this.duplicateFeature(layer.id,f.id)]);
    if(geomKind(layer.geometryType)==='line'&&layer.direction?.enabled)acts.push([this.t('direction.reverseSelected')||this.t('direction.reverse')||'Đảo chiều đối tượng đang chọn',()=>{this._selectFeature?.(layer,f,ll,{add:false});this._ensureEditSessionForFeatureAction?.();this.reverseFeatureDirection(layer.id,f.id);}]);
    acts.push([this.t('context.delete'),()=>{this._selectFeature?.(layer,f,ll,{add:false});this._ensureEditSessionForFeatureAction?.();this.deleteSelected();}]);
    acts.push([this.t('context.exportFeature'),()=>this.exportFeature(layer.id,f.id)]);
    this.contextEl.innerHTML='';acts.forEach(a=>{const b=document.createElement('button');b.textContent=a[0];b.onclick=e=>{e.stopPropagation();this._hideContext();a[1]();};this.contextEl.appendChild(b);});
  },
  _hideContext(){this.contextEl.classList.add('hidden');}
});
