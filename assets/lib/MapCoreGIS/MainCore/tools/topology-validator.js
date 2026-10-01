// Module: tools/topology-validator.js - cross-layer topology inspection only. No geometry mutation.
Object.assign(WaterMapCore.prototype, {
  _ensureTopologyStyles(){
    if(document.getElementById('ddc_meko_topology_css'))return;
    const s=document.createElement('style');s.id='ddc_meko_topology_css';s.textContent=`
.ddc_meko-topology-summary{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.ddc_meko-topology-row{cursor:pointer}.ddc_meko-topology-row:hover{background:#eef8fa}
.ddc_meko-status-error{color:#b42318;font-weight:700}.ddc_meko-status-ok{color:#067647;font-weight:700}
.ddc_meko-topology-rulehint{font-size:12px;color:#667085;margin-top:4px}
.ddc_meko-topology-guide-label{background:#fff;border:1px solid #d0d5dd;border-radius:4px;padding:2px 5px;color:#344054;font-size:11px;box-shadow:none}
`;
    document.head.appendChild(s);
  },

  showTopologyCheck(){
    if(this.layers.length<2){this.toast(this.t('topology.needLayers'));return;}
    this._ensureTopologyStyles();
    const opts=this.layers.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+' ('+esc(geomKind(l.geometryType))+')</option>').join('');
    const h=''
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topology.sourceLayer'))+'</span><select id="ddcTopoSource">'+opts+'</select></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topology.targetLayer'))+'</span><select id="ddcTopoTarget">'+opts+'</select></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topology.rule'))+'</span><select id="ddcTopoRule"></select><div id="ddcTopoRuleHint" class="ddc_meko-topology-rulehint"></div></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topology.tolerance'))+'</span><input id="ddcTopoTolerance" type="number" min="0" step="0.01" value="0.50"></label>'
      +'<div class="ddc_meko-warning">'+esc(this.t('topology.help'))+'</div>';
    this._modal(this.t('topology.title'),h,[
      {text:this.t('topology.run'),primary:true,fn:()=>{
        const a=this.modalWrap.querySelector('#ddcTopoSource').value;
        const b=this.modalWrap.querySelector('#ddcTopoTarget').value;
        const rule=this.modalWrap.querySelector('#ddcTopoRule').value;
        const t=Number(this.modalWrap.querySelector('#ddcTopoTolerance').value)||0;
        if(a===b){this.toast(this.t('topology.sameLayer'));return;}
        this._closeModal();this.runTopologyCheck(a,b,t,rule);
      }},
      {text:this.t('common.cancel'),fn:()=>this._closeModal()}
    ]);
    const a=this.modalWrap.querySelector('#ddcTopoSource'),b=this.modalWrap.querySelector('#ddcTopoTarget');
    if(a&&b&&a.options.length>1)b.selectedIndex=1;
    const refresh=()=>this._refreshTopologyRuleOptions(a?.value,b?.value);
    a?.addEventListener('change',refresh);b?.addEventListener('change',refresh);refresh();
  },

  _refreshTopologyRuleOptions(sourceLayerId,targetLayerId){
    const ruleEl=this.modalWrap?.querySelector('#ddcTopoRule'),hintEl=this.modalWrap?.querySelector('#ddcTopoRuleHint');if(!ruleEl)return;
    const src=this.getLayer(sourceLayerId),dst=this.getLayer(targetLayerId),sk=geomKind(src?.geometryType),dk=geomKind(dst?.geometryType);
    const rules=[];
    if(sk==='line'&&dk==='line'){
      rules.push(['any_endpoint_to_segment',this.t('topology.anyEndpointToSegment')]);
      rules.push(['each_endpoint_to_segment',this.t('topology.eachEndpointToSegment')]);
      rules.push(['any_endpoint_to_endpoint',this.t('topology.anyEndpointToEndpoint')]);
      rules.push(['each_endpoint_to_endpoint',this.t('topology.eachEndpointToEndpoint')]);
      rules.push(['intersection',this.t('topology.intersection')]);
    }else if(sk==='point'&&dk==='line')rules.push(['point_to_segment',this.t('topology.pointToSegment')]);
    else if(sk==='point'&&dk==='point')rules.push(['point_to_point',this.t('topology.pointToPoint')]);
    else if(sk==='line'&&dk==='point'){
      rules.push(['any_endpoint_to_point',this.t('topology.anyEndpointToPoint')]);
      rules.push(['each_endpoint_to_point',this.t('topology.eachEndpointToPoint')]);
    }else rules.push(['nearest_geometry',this.t('topology.nearestGeometry')]);
    ruleEl.innerHTML=rules.map(r=>'<option value="'+r[0]+'">'+esc(r[1])+'</option>').join('');
    if(hintEl)hintEl.textContent=(sk==='line'&&dk==='line')?this.t('topology.sourceTargetHint'):'';
  },

  runTopologyCheck(sourceLayerId,targetLayerId,toleranceMeters=0.5,rule){
    const src=this.getLayer(sourceLayerId),dst=this.getLayer(targetLayerId);if(!src||!dst)return[];
    const sk=geomKind(src.geometryType),dk=geomKind(dst.geometryType);
    rule=rule||this._defaultTopologyRule(sk,dk);
    const results=[];
    for(const f of src.fc.features||[]){
      const checks=this._evaluateTopologyFeature(f,src,dst,sk,dk,rule,toleranceMeters);
      checks.forEach(r=>{if(r.status==='Error')results.push(r);});
    }
    this._topologyResults=results;
    this._renderTopologyResults(src,dst,toleranceMeters,results,rule);
    this.emit('topology:checked',{sourceLayer:src,targetLayer:dst,toleranceMeters,rule,results});
    return results;
  },

  _defaultTopologyRule(sk,dk){
    if(sk==='line'&&dk==='line')return'any_endpoint_to_segment';
    if(sk==='point'&&dk==='line')return'point_to_segment';
    if(sk==='point'&&dk==='point')return'point_to_point';
    if(sk==='line'&&dk==='point')return'any_endpoint_to_point';
    return'nearest_geometry';
  },

  _evaluateTopologyFeature(feature,src,dst,sk,dk,rule,toleranceMeters){
    const displayId=this._topologyFeatureDisplayId(feature);
    const base={sourceLayerId:src.id,sourceLayer:src.name,sourceFeatureId:feature.id,sourceObjectId:displayId,targetLayerId:dst.id,targetLayer:dst.name,rule};
    const tol=Math.max(0,Number(toleranceMeters)||0);
    const eps=0.001; // 1 mm numerical tolerance for WGS84 round-trip / SHP serialization noise.

    if(rule==='intersection'){
      const hit=this._findGeometryIntersection(feature.geometry,dst);
      if(hit)return[{...base,id:uuid(),targetFeatureId:hit.feature?.id??'',targetObjectId:this._topologyFeatureDisplayId(hit.feature),probe:'intersection',sourcePoint:hit.point,nearestPoint:hit.point,distance:0,status:'OK',message:this.t('topology.snapped')}];
      return[{...base,id:uuid(),targetFeatureId:'',targetObjectId:'',probe:'intersection',sourcePoint:this._representativePoint(feature.geometry),nearestPoint:null,distance:Infinity,status:'Error',message:this.t('topology.noIntersection')}];
    }

    const probes=this._topologyProbePoints(feature,sk,rule);
    if(!probes.length)return[];

    const nearestRule=(rule.includes('endpoint')&&rule.endsWith('_endpoint'))?'endpoint_to_endpoint':
      (rule.endsWith('_point')?'endpoint_to_point':rule);

    // IMPORTANT: evaluate each source probe against the ENTIRE target layer first.
    // For "any endpoint" rules, only the minimum distance among all source endpoints matters.
    const evaluated=probes.map((probe,idx)=>{
      const nearest=this._nearestTargetForTopology(probe.point,dst,nearestRule);
      const distance=nearest?.distance??Infinity;
      return{probe,idx,nearest,distance};
    });

    if(rule.startsWith('any_endpoint_')){
      const best=evaluated.reduce((a,b)=>!a||b.distance<a.distance?b:a,null);
      // One endpoint attached is enough. Do NOT emit an error for the other endpoint.
      if(best&&best.distance<=tol+eps)return[];
      return[{...base,id:uuid(),targetFeatureId:best?.nearest?.feature?.id??'',targetObjectId:this._topologyFeatureDisplayId(best?.nearest?.feature),probe:best?.probe?.name||'endpoint',sourcePoint:best?.probe?.point||null,nearestPoint:best?.nearest?.point||null,distance:best?.distance??Infinity,status:'Error',message:this.t('topology.notSnapped'),endpointDistances:evaluated.map(x=>({name:x.probe?.name,distance:x.distance}))}];
    }

    // Point rules and "each endpoint" rules: every probe must satisfy tolerance.
    const out=[];
    evaluated.forEach(({probe,idx,nearest,distance})=>{
      if(distance>tol+eps){
        out.push({...base,id:uuid(),targetFeatureId:nearest?.feature?.id??'',targetObjectId:this._topologyFeatureDisplayId(nearest?.feature),probe:probe.name||((probes.length>1)?(idx===0?'start':'end'):'point'),sourcePoint:probe.point,nearestPoint:nearest?.point||null,distance,status:'Error',message:this.t('topology.notSnapped')});
      }
    });
    return out;
  },

  _topologyFeatureDisplayId(feature){
    if(!feature)return'';
    const p=feature.properties||{};
    for(const k of ['Id','ID','id','asset_id','AssetId','ASSET_ID']){
      if(p[k]!==undefined&&p[k]!==null&&String(p[k])!=='')return p[k];
    }
    return feature.id??'';
  },

  _topologyProbePoints(feature,kind,rule){
    const g=feature?.geometry;if(!g)return[];
    if(kind==='point'){
      if(g.type==='Point')return[{name:'point',point:g.coordinates}];
      if(g.type==='MultiPoint')return(g.coordinates||[]).map((p,i)=>({name:'point '+(i+1),point:p}));
    }
    if(kind==='line'){
      if(g.type==='LineString'&&g.coordinates?.length)return[{name:'start',point:g.coordinates[0]},{name:'end',point:g.coordinates[g.coordinates.length-1]}];
      if(g.type==='MultiLineString'){
        const out=[];(g.coordinates||[]).forEach((a,i)=>{if(a?.length)out.push({name:'part '+(i+1)+' start',point:a[0]},{name:'part '+(i+1)+' end',point:a[a.length-1]});});return out;
      }
    }
    return[];
  },

  _representativePoint(g){
    if(!g)return null;const c=g.coordinates;
    if(g.type==='Point')return c;
    if(g.type==='LineString'&&c?.length)return c[0];
    if(g.type==='MultiLineString'&&c?.[0]?.length)return c[0][0];
    return null;
  },

  _findGeometryIntersection(sourceGeometry,targetLayer){
    const srcLines=this._geometryLineParts(sourceGeometry);
    for(const f of targetLayer.fc.features||[]){
      const dstLines=this._geometryLineParts(f.geometry);
      for(const a of srcLines)for(const b of dstLines){
        for(let i=1;i<a.length;i++)for(let j=1;j<b.length;j++){
          const p=this._segmentIntersectionLngLat(a[i-1],a[i],b[j-1],b[j]);
          if(p)return{feature:f,point:p};
        }
      }
    }
    return null;
  },

  _geometryLineParts(g){
    if(!g)return[];const c=g.coordinates||[];
    if(g.type==='LineString')return[c];
    if(g.type==='MultiLineString')return c;
    if(g.type==='Polygon')return c;
    if(g.type==='MultiPolygon')return c.flat();
    return[];
  },

  _segmentIntersectionLngLat(a,b,c,d){
    // Intersection is evaluated in current map projection so visual geometry and validation agree.
    const z=Math.min(this.map.getMaxZoom?.()??24,24),A=this.map.project(L.latLng(a[1],a[0]),z),B=this.map.project(L.latLng(b[1],b[0]),z),C=this.map.project(L.latLng(c[1],c[0]),z),D=this.map.project(L.latLng(d[1],d[0]),z);
    const r={x:B.x-A.x,y:B.y-A.y},s={x:D.x-C.x,y:D.y-C.y};
    const cross=(u,v)=>u.x*v.y-u.y*v.x,qp={x:C.x-A.x,y:C.y-A.y},den=cross(r,s);
    if(Math.abs(den)<1e-12)return null;
    const t=cross(qp,s)/den,u=cross(qp,r)/den;
    if(t<-1e-9||t>1+1e-9||u<-1e-9||u>1+1e-9)return null;
    const P=L.point(A.x+t*r.x,A.y+t*r.y),ll=this.map.unproject(P,z);return[ll.lng,ll.lat];
  },

  _nearestTargetForTopology(point,targetLayer,rule){
    let best=null;
    for(const f of targetLayer.fc.features||[]){
      const n=this._nearestPointOnGeometryMeters(point,f.geometry,rule);
      if(n&&Number.isFinite(n.distance)&&(!best||n.distance<best.distance))best={feature:f,distance:n.distance,point:n.point,partIndex:n.partIndex,segmentIndex:n.segmentIndex};
    }
    return best;
  },

  _nearestPointOnGeometryMeters(p,g,rule){
    if(!g)return null;const type=g.type,c=g.coordinates;
    const wantEndpoint=rule==='endpoint_to_endpoint'||rule==='endpoint_to_point'||rule==='point_to_point'||rule==='any_endpoint_to_endpoint'||rule==='each_endpoint_to_endpoint'||rule==='any_endpoint_to_point'||rule==='each_endpoint_to_point';
    if(type==='Point')return{distance:this._geoDistanceMeters(p,c),point:c};
    if(type==='MultiPoint'){
      let best=null;(c||[]).forEach((x,i)=>{const d=this._geoDistanceMeters(p,x);if(!best||d<best.distance)best={distance:d,point:x,partIndex:i};});return best;
    }
    const lines=[];
    if(type==='LineString')lines.push(c);
    else if(type==='MultiLineString')(c||[]).forEach(x=>lines.push(x));
    else if(type==='Polygon')(c||[]).forEach(x=>lines.push(x));
    else if(type==='MultiPolygon')(c||[]).forEach(poly=>(poly||[]).forEach(x=>lines.push(x)));
    let best=null;
    lines.forEach((line,pi)=>{
      if(!line?.length)return;
      if(wantEndpoint){
        const candidates=[line[0],line[line.length-1]];
        candidates.forEach((x,ei)=>{const d=this._geoDistanceMeters(p,x);if(!best||d<best.distance)best={distance:d,point:x,partIndex:pi,segmentIndex:ei===0?0:Math.max(0,line.length-2)};});
      }else{
        for(let i=1;i<line.length;i++){
          const n=this._nearestPointOnSegmentMeters(p,line[i-1],line[i]);
          if(!best||n.distance<best.distance)best={distance:n.distance,point:n.point,partIndex:pi,segmentIndex:i-1};
        }
      }
    });
    return best;
  },

  _geoDistanceMeters(a,b){
    if(!a||!b)return Infinity;
    const R=6371008.8;
    const rad=Math.PI/180;
    const lat1=a[1]*rad,lat2=b[1]*rad;
    const dLat=(b[1]-a[1])*rad,dLon=(b[0]-a[0])*rad;
    const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  },

  _nearestPointOnSegmentMeters(p,a,b){
    // All working GeoJSON coordinates in WaterMapCore are WGS84 [lng,lat].
    // Project locally to a metric tangent plane around the source probe. This is
    // independent from Leaflet zoom / basemap CRS and is stable at sub-meter scale.
    if(!p||!a||!b)return{distance:Infinity,point:null,t:0};
    const R=6371008.8,rad=Math.PI/180;
    const lat0=p[1]*rad,cos0=Math.max(1e-12,Math.cos(lat0));
    const toXY=(q)=>({x:(q[0]-p[0])*rad*R*cos0,y:(q[1]-p[1])*rad*R});
    const A=toXY(a),B=toXY(b);
    const dx=B.x-A.x,dy=B.y-A.y,l2=dx*dx+dy*dy;
    let t=0;
    if(l2>0)t=Math.max(0,Math.min(1,-(A.x*dx+A.y*dy)/l2));
    const qx=A.x+t*dx,qy=A.y+t*dy;
    const q=[p[0]+(qx/(R*cos0))/rad,p[1]+(qy/R)/rad];
    return{distance:Math.hypot(qx,qy),point:q,t};
  },

  _pointToGeometryDistanceMeters(p,g){const n=this._nearestPointOnGeometryMeters(p,g,'nearest_geometry');return n?.distance??Infinity;},

  _renderTopologyResults(src,dst,tol,results,rule){
    const p=this.panels.topology;p.classList.remove('hidden');p.querySelector('.ddc_meko-panel-head span').textContent=this.t('topology.resultsTitle');
    const body=p.querySelector('.ddc_meko-panel-body'),dist=v=>Number.isFinite(v)?v.toFixed(3):'—';
    let h='<div class="ddc_meko-topology-summary"><span class="ddc_meko-badge">'+esc(src.name)+' → '+esc(dst.name)+'</span><span class="ddc_meko-badge">'+esc(this._topologyRuleLabel(rule))+'</span><span class="ddc_meko-badge">Tolerance: '+esc(tol)+' m</span><span class="ddc_meko-badge">Errors: '+results.length+'</span></div>';
    if(!results.length){body.innerHTML=h+'<div class="ddc_meko-status-ok">'+esc(this.t('topology.noErrors'))+'</div>';return;}
    h+='<div class="ddc_meko-table-wrap"><table class="ddc_meko-table"><thead><tr><th>#</th><th>'+esc(this.t('topology.sourceLayer'))+'</th><th>ID</th><th>'+esc(this.t('topology.targetLayer'))+'</th><th>'+esc(this.t('topology.rule'))+'</th><th>'+esc(this.t('topology.distance'))+'</th><th>'+esc(this.t('topology.status'))+'</th></tr></thead><tbody>';
    results.forEach((r,i)=>{h+='<tr class="ddc_meko-topology-row" data-i="'+i+'"><td>'+(i+1)+'</td><td>'+esc(r.sourceLayer)+'</td><td>'+esc(r.sourceObjectId??r.sourceFeatureId)+'</td><td>'+esc(r.targetLayer)+'</td><td>'+esc(r.probe)+' - '+esc(r.message)+'</td><td>'+dist(r.distance)+'</td><td class="ddc_meko-status-error">Error</td></tr>';});
    h+='</tbody></table></div>';body.innerHTML=h;
    body.querySelectorAll('tr[data-i]').forEach(row=>row.onclick=()=>this._showTopologyResultOnMap(results[Number(row.dataset.i)]));
  },

  _topologyRuleLabel(rule){const map={any_endpoint_to_segment:'1 endpoint bất kỳ → segment',each_endpoint_to_segment:'mọi endpoint → segment',any_endpoint_to_endpoint:'1 endpoint bất kỳ → endpoint',each_endpoint_to_endpoint:'mọi endpoint → endpoint',intersection:'giao cắt geometry',point_to_segment:'point → segment',point_to_point:'point → point',any_endpoint_to_point:'1 endpoint bất kỳ → point',each_endpoint_to_point:'mọi endpoint → point',nearest_geometry:'nearest geometry'};return map[rule]||rule;},

  _showTopologyResultOnMap(r){
    if(!r)return;
    this.flashFeature(r.sourceLayerId,r.sourceFeatureId);
    if(r.targetFeatureId!==''&&r.targetFeatureId!=null)setTimeout(()=>this.flashFeature(r.targetLayerId,r.targetFeatureId),260);
    if(this._topologyGuideLayer){try{this.map.removeLayer(this._topologyGuideLayer);}catch(_){}this._topologyGuideLayer=null;}
    if(!r.sourcePoint||!r.nearestPoint)return;
    const a=[r.sourcePoint[1],r.sourcePoint[0]],b=[r.nearestPoint[1],r.nearestPoint[0]];
    const group=L.layerGroup().addTo(this.map);this._topologyGuideLayer=group;
    L.circleMarker(a,{radius:6,color:'#d92d20',weight:2,fillColor:'#fff',fillOpacity:1,interactive:false}).addTo(group);
    L.circleMarker(b,{radius:6,color:'#0396a6',weight:2,fillColor:'#fff',fillOpacity:1,interactive:false}).addTo(group);
    const line=L.polyline([a,b],{color:'#d92d20',weight:2,dashArray:'6,5',interactive:false}).addTo(group);
    line.bindTooltip((Number.isFinite(r.distance)?r.distance.toFixed(3):'—')+' m',{permanent:true,direction:'center',className:'ddc_meko-topology-guide-label'}).openTooltip();
    const bounds=L.latLngBounds([a,b]);if(bounds.isValid())this.map.fitBounds(bounds.pad(.8),{maxZoom:this.map.getMaxZoom?.()??24,animate:false});
  }
});
