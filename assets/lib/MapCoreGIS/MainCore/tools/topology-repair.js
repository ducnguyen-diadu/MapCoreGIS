// Module: tools/topology-repair.js
// Unified topology QA + safe auto repair for Meter -> Service -> Main connectivity.
// Scan NEVER mutates geometry. Only Apply commits fixes classified as safe.
Object.assign(WaterMapCore.prototype, {
  _ensureTopologyRepairStyles(){
    if(document.getElementById('ddc_meko_topology_repair_css'))return;
    const s=document.createElement('style');s.id='ddc_meko_topology_repair_css';s.textContent=`
.ddc_meko-repair-summary{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.ddc_meko-repair-row{cursor:pointer}.ddc_meko-repair-row:hover{background:#eef8fa}
.ddc_meko-repair-safe{color:#067647;font-weight:700}.ddc_meko-repair-review{color:#b54708;font-weight:700}.ddc_meko-repair-ok{color:#475467;font-weight:700}
.ddc_meko-repair-actions{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.ddc_meko-repair-note{font-size:12px;color:#667085;margin-top:5px}
`;
    document.head.appendChild(s);
  },

  showTopologyRepairTool(){
    if(this.layers.length<2){this.toast(this.t('topologyRepair.needLayers'));return;}
    this._ensureTopologyRepairStyles();
    const pointLayers=this.layers.filter(l=>geomKind(l.geometryType)==='point');
    const lineLayers=this.layers.filter(l=>geomKind(l.geometryType)==='line');
    if(!pointLayers.length||lineLayers.length<2){this.toast(this.t('topologyRepair.needLayers'));return;}
    const opt=(arr,guess)=>arr.map(l=>'<option value="'+esc(l.id)+'" '+(guess&&guess(l)?'selected':'')+'>'+esc(l.name)+'</option>').join('');
    const meterGuess=l=>/(meter|dhkh|dong.?ho|đồng.?hồ)/i.test(l.name||'');
    const serviceGuess=l=>/(service|dich.?vu|nhanh|đấu.?hộ|dau.?ho)/i.test(l.name||'');
    const mainGuess=l=>/(main|distribution|cap.?nuoc|cấp.?nước|do\b|ống.?chính)/i.test(l.name||'')&&!serviceGuess(l);
    const h=''
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologyRepair.meterLayer'))+'</span><select id="ddcRepairMeter">'+opt(pointLayers,meterGuess)+'</select></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologyRepair.serviceLayer'))+'</span><select id="ddcRepairService">'+opt(lineLayers,serviceGuess)+'</select></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologyRepair.mainLayer'))+'</span><select id="ddcRepairMain">'+opt(lineLayers,mainGuess)+'</select></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologyRepair.meterServiceTol'))+'</span><input id="ddcRepairMeterTol" type="number" min="0" step="0.05" value="1.00"></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologyRepair.serviceMainTol'))+'</span><input id="ddcRepairServiceTol" type="number" min="0" step="0.05" value="1.00"></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologyRepair.mainMainTol'))+'</span><input id="ddcRepairMainTol" type="number" min="0" step="0.05" value="0.50"></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologyRepair.reviewTol'))+'</span><input id="ddcRepairReviewTol" type="number" min="0" step="0.5" value="10"></label>'
      +'<div class="ddc_meko-warning">'+esc(this.t('topologyRepair.help'))+'</div>';
    this._modal(this.t('topologyRepair.title'),h,[
      {text:this.t('topologyRepair.scan'),primary:true,fn:()=>{
        const q=s=>this.modalWrap.querySelector(s),cfg={
          meterLayerId:q('#ddcRepairMeter').value,serviceLayerId:q('#ddcRepairService').value,mainLayerId:q('#ddcRepairMain').value,
          meterServiceTol:Math.max(0,Number(q('#ddcRepairMeterTol').value)||0),serviceMainTol:Math.max(0,Number(q('#ddcRepairServiceTol').value)||0),
          mainMainTol:Math.max(0,Number(q('#ddcRepairMainTol').value)||0),reviewTol:Math.max(0,Number(q('#ddcRepairReviewTol').value)||0)
        };
        if(cfg.serviceLayerId===cfg.mainLayerId){this.toast(this.t('topologyRepair.serviceMainDifferent'));return;}
        this._closeModal();this.runTopologyRepairScan(cfg);
      }},
      {text:this.t('common.cancel'),fn:()=>this._closeModal()}
    ]);
    // Ensure guesses do not accidentally point both line selects to the same layer.
    const a=this.modalWrap.querySelector('#ddcRepairService'),b=this.modalWrap.querySelector('#ddcRepairMain');
    if(a&&b&&a.value===b.value&&b.options.length>1)b.selectedIndex=(a.selectedIndex===0?1:0);
  },

  runTopologyRepairScan(cfg){
    const meter=this.getLayer(cfg.meterLayerId),service=this.getLayer(cfg.serviceLayerId),main=this.getLayer(cfg.mainLayerId);
    if(!meter||!service||!main)return null;
    const report={id:uuid(),cfg:{...cfg},meterLayer:meter,serviceLayer:service,mainLayer:main,issues:[],stats:{meterTotal:meter.fc.features.length,serviceTotal:service.fc.features.length,mainTotal:main.fc.features.length,safe:0,review:0,ok:0}};
    const serviceIndex=this._repairBuildLineIndex(service,Math.max(25,cfg.reviewTol*2));
    const mainIndex=this._repairBuildLineIndex(main,Math.max(25,cfg.reviewTol*2));
    const eps=0.01; // 1 cm: already connected for practical GIS topology.

    // 1) Meter -> Service. Preserve the physical meter point; repair a nearby service endpoint to the meter.
    for(const mf of meter.fc.features||[]){
      const p=mf.geometry?.type==='Point'?mf.geometry.coordinates:null;if(!p)continue;
      const nearest=this._repairNearestLineEndpointIndexed(p,service,serviceIndex,cfg.reviewTol,null);
      if(nearest&&nearest.distance<=eps){report.stats.ok++;continue;}
      if(nearest&&nearest.distance<=cfg.meterServiceTol){
        report.issues.push(this._repairIssue('meter_service','safe',meter,mf,service,nearest.feature,p,nearest.point,nearest.distance,{action:'move_line_endpoint',layerId:service.id,featureId:nearest.feature.id,partIndex:nearest.partIndex,endpoint:nearest.endpoint,to:p.slice()}));report.stats.safe++;
      }else{
        // For review, also accept nearest geometry because the meter may be close to the middle of a malformed line.
        const geomNear=this._repairNearestGeometryIndexed(p,service,serviceIndex,cfg.reviewTol,null);
        report.issues.push(this._repairIssue('meter_service','review',meter,mf,service,geomNear?.feature||nearest?.feature,p,geomNear?.point||nearest?.point||null,geomNear?.distance??nearest?.distance??Infinity,null));report.stats.review++;
      }
    }

    // 2) Service -> Main. Exactly one service endpoint should reach the hydraulic main network.
    for(const sf of service.fc.features||[]){
      const ends=this._repairFeatureEndpoints(sf);if(!ends.length)continue;
      let best=null;
      for(const e of ends){const n=this._repairNearestGeometryIndexed(e.point,main,mainIndex,cfg.reviewTol,null);if(n&&(!best||n.distance<best.distance))best={...n,source:e};}
      if(best&&best.distance<=eps){report.stats.ok++;continue;}
      if(best&&best.distance<=cfg.serviceMainTol){
        report.issues.push(this._repairIssue('service_main','safe',service,sf,main,best.feature,best.source.point,best.point,best.distance,{action:'move_line_endpoint',layerId:service.id,featureId:sf.id,partIndex:best.source.partIndex,endpoint:best.source.endpoint,to:best.point.slice()}));report.stats.safe++;
      }else{
        report.issues.push(this._repairIssue('service_main','review',service,sf,main,best?.feature,best?.source?.point||ends[0].point,best?.point||null,best?.distance??Infinity,null));report.stats.review++;
      }
    }

    // 3) Main -> Main near-miss endpoints. Legitimate dead ends are NOT errors: only report when another pipe is actually nearby.
    for(const sf of main.fc.features||[]){
      for(const e of this._repairFeatureEndpoints(sf)){
        const n=this._repairNearestGeometryIndexed(e.point,main,mainIndex,cfg.reviewTol,sf.id);
        if(!n)continue;
        if(n.distance<=eps){report.stats.ok++;continue;}
        if(n.distance<=cfg.mainMainTol){
          report.issues.push(this._repairIssue('main_main','safe',main,sf,main,n.feature,e.point,n.point,n.distance,{action:'move_line_endpoint',layerId:main.id,featureId:sf.id,partIndex:e.partIndex,endpoint:e.endpoint,to:n.point.slice()}));report.stats.safe++;
        }else if(n.distance<=cfg.reviewTol){
          report.issues.push(this._repairIssue('main_main','review',main,sf,main,n.feature,e.point,n.point,n.distance,null));report.stats.review++;
        }
      }
    }

    // Stabilize safe fixes before exposing them to Apply.
    // A repair must be idempotent: the same endpoint must never be pulled toward
    // competing targets, and reciprocal Main->Main fixes must not swap back and forth.
    this._repairStabilizeSafeIssues(report);

    this._topologyRepairReport=report;this._renderTopologyRepairReport(report);this.emit('topologyRepair:scanned',report);return report;
  },

  _repairStabilizeSafeIssues(report){
    if(!report?.issues?.length)return report;
    const eps=0.01;
    const vertexKey=fx=>fx&&fx.action==='move_line_endpoint'
      ? [fx.layerId,fx.featureId,fx.partIndex,fx.endpoint].map(v=>String(v??'')).join('|')
      : '';
    const setReview=item=>{
      if(!item||item.status!=='safe')return;
      item.status='review';
      item.fix=null;
      item.stabilizedReason='ambiguous_or_conflicting_fix';
    };

    // 1) One source vertex may only have one authoritative destination.
    // Meter->Service and Service->Main can otherwise select the same service endpoint
    // and alternately pull it toward the meter and the main pipe on repeated Auto Fix runs.
    const byVertex=new Map();
    for(const item of report.issues){
      if(item.status!=='safe'||!item.fix)continue;
      const k=vertexKey(item.fix);if(!k)continue;
      const a=byVertex.get(k)||[];a.push(item);byVertex.set(k,a);
    }
    for(const items of byVertex.values()){
      if(items.length<2)continue;
      let conflict=false;
      for(let i=0;i<items.length&&!conflict;i++)for(let j=i+1;j<items.length;j++){
        const a=items[i].fix?.to,b=items[j].fix?.to;
        if(!a||!b||this._geoDistanceMeters(a,b)>eps){conflict=true;break;}
      }
      if(conflict)for(const item of items)setReview(item);
    }

    // 2) Reciprocal Main->Main candidates (A snaps to B while B snaps to A) are
    // inherently ambiguous. Never auto-fix either direction; send both to Review.
    const mm=new Map();
    for(const item of report.issues){
      if(item.status!=='safe'||item.kind!=='main_main'||!item.fix)continue;
      const a=String(item.sourceFeatureId??''),b=String(item.targetFeatureId??'');
      if(!a||!b)continue;
      const pair=a<b?a+'|'+b:b+'|'+a;
      const arr=mm.get(pair)||[];arr.push(item);mm.set(pair,arr);
    }
    for(const items of mm.values()){
      const dirs=new Set(items.map(x=>String(x.sourceFeatureId)+'>'+String(x.targetFeatureId)));
      if(dirs.size>1)for(const item of items)setReview(item);
    }

    // Recalculate visible counters after stabilization. OK remains the count of
    // relationships already connected during the scan.
    report.stats.safe=0;report.stats.review=0;
    for(const item of report.issues){
      if(item.status==='safe')report.stats.safe++;
      else if(item.status==='review')report.stats.review++;
    }
    return report;
  },

  _repairIssue(kind,status,srcLayer,srcFeature,dstLayer,dstFeature,sourcePoint,nearestPoint,distance,fix){
    const labels={meter_service:this.t('topologyRepair.ruleMeterService'),service_main:this.t('topologyRepair.ruleServiceMain'),main_main:this.t('topologyRepair.ruleMainMain')};
    return{id:uuid(),kind,status,ruleLabel:labels[kind]||kind,sourceLayerId:srcLayer.id,sourceLayer:srcLayer.name,sourceFeatureId:srcFeature?.id,sourceObjectId:this._topologyFeatureDisplayId?.(srcFeature)??srcFeature?.id,targetLayerId:dstLayer.id,targetLayer:dstLayer.name,targetFeatureId:dstFeature?.id??'',targetObjectId:this._topologyFeatureDisplayId?.(dstFeature)??dstFeature?.id??'',sourcePoint,nearestPoint,distance,fix};
  },

  _repairBuildLineIndex(layer,cellMeters=50){
    const cells=new Map(),R=6371008.8,rad=Math.PI/180;
    const toXY=p=>({x:p[0]*rad*R,y:Math.log(Math.tan(Math.PI/4+(p[1]*rad)/2))*R});
    const add=(key,f)=>{const a=cells.get(key)||[];a.push(f);cells.set(key,a);};
    for(const f of layer.fc.features||[]){
      const pts=[];for(const line of this._geometryLineParts(f.geometry))for(const p of line||[])if(p?.length>=2)pts.push(p);if(!pts.length)continue;
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of pts){const q=toXY(p);minX=Math.min(minX,q.x);maxX=Math.max(maxX,q.x);minY=Math.min(minY,q.y);maxY=Math.max(maxY,q.y);}
      const x0=Math.floor(minX/cellMeters),x1=Math.floor(maxX/cellMeters),y0=Math.floor(minY/cellMeters),y1=Math.floor(maxY/cellMeters);
      for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)add(x+','+y,f);
    }
    return{cells,cellMeters,toXY};
  },

  _repairIndexCandidates(point,index,radiusMeters){
    if(!index)return[];const q=index.toXY(point),c=index.cellMeters,r=Math.max(1,Math.ceil(radiusMeters/c)),cx=Math.floor(q.x/c),cy=Math.floor(q.y/c),set=new Set();
    for(let x=cx-r;x<=cx+r;x++)for(let y=cy-r;y<=cy+r;y++)for(const f of index.cells.get(x+','+y)||[])set.add(f);
    return[...set];
  },

  _repairNearestGeometryIndexed(point,layer,index,maxDistance,excludeFeatureId){
    let best=null;const candidates=this._repairIndexCandidates(point,index,maxDistance);
    for(const f of candidates){if(excludeFeatureId!=null&&String(f.id)===String(excludeFeatureId))continue;const n=this._nearestPointOnGeometryMeters(point,f.geometry,'nearest_geometry');if(n&&n.distance<=maxDistance&&(!best||n.distance<best.distance))best={...n,feature:f};}
    return best;
  },

  _repairNearestLineEndpointIndexed(point,layer,index,maxDistance,excludeFeatureId){
    let best=null;for(const f of this._repairIndexCandidates(point,index,maxDistance)){if(excludeFeatureId!=null&&String(f.id)===String(excludeFeatureId))continue;for(const e of this._repairFeatureEndpoints(f)){const d=this._geoDistanceMeters(point,e.point);if(d<=maxDistance&&(!best||d<best.distance))best={feature:f,distance:d,point:e.point,partIndex:e.partIndex,endpoint:e.endpoint};}}
    return best;
  },

  _repairFeatureEndpoints(feature){
    const g=feature?.geometry;if(!g)return[];const out=[];
    if(g.type==='LineString'&&g.coordinates?.length){out.push({partIndex:0,endpoint:'start',point:g.coordinates[0]},{partIndex:0,endpoint:'end',point:g.coordinates[g.coordinates.length-1]});}
    else if(g.type==='MultiLineString')for(let i=0;i<(g.coordinates||[]).length;i++){const a=g.coordinates[i];if(a?.length)out.push({partIndex:i,endpoint:'start',point:a[0]},{partIndex:i,endpoint:'end',point:a[a.length-1]});}
    return out;
  },

  _repairSetLineEndpoint(feature,partIndex,endpoint,to){
    const g=feature?.geometry;if(!g||!to)return false;let a=null;
    if(g.type==='LineString')a=g.coordinates;
    else if(g.type==='MultiLineString')a=g.coordinates?.[partIndex];
    if(!a?.length)return false;const idx=endpoint==='start'?0:a.length-1;a[idx]=to.slice();return true;
  },

  _renderTopologyRepairReport(report){
    const p=this.panels.topology;p.classList.remove('hidden');this._bringPanelToFront?.(p);p.querySelector('.ddc_meko-panel-head span').textContent=this.t('topologyRepair.resultsTitle');
    const body=p.querySelector('.ddc_meko-panel-body'),dist=v=>Number.isFinite(v)?v.toFixed(3):'—';
    let h='<div class="ddc_meko-repair-summary">'
      +'<span class="ddc_meko-badge">'+esc(this.t('topologyRepair.safeCount'))+': '+report.stats.safe+'</span>'
      +'<span class="ddc_meko-badge">'+esc(this.t('topologyRepair.reviewCount'))+': '+report.stats.review+'</span>'
      +'<span class="ddc_meko-badge">'+esc(this.t('topologyRepair.okCount'))+': '+report.stats.ok+'</span></div>'
      +'<div class="ddc_meko-repair-actions"><button class="ddc_meko-btn primary" data-a="apply" '+(report.stats.safe?'':'disabled')+'>'+esc(this.t('topologyRepair.applySafe'))+'</button><button class="ddc_meko-btn" data-a="rescan">'+esc(this.t('topologyRepair.rescan'))+'</button></div>'
      +'<div class="ddc_meko-repair-note">'+esc(this.t('topologyRepair.reviewNote'))+'</div>';
    if(!report.issues.length){body.innerHTML=h+'<div class="ddc_meko-repair-safe">'+esc(this.t('topologyRepair.clean'))+'</div>';body.querySelector('[data-a=rescan]').onclick=()=>this.showTopologyRepairTool();return;}
    h+='<div class="ddc_meko-table-wrap"><table class="ddc_meko-table"><thead><tr><th>#</th><th>'+esc(this.t('topologyRepair.relation'))+'</th><th>'+esc(this.t('topologyRepair.source'))+'</th><th>'+esc(this.t('topologyRepair.target'))+'</th><th>'+esc(this.t('topology.distance'))+'</th><th>'+esc(this.t('topology.status'))+'</th></tr></thead><tbody>';
    report.issues.forEach((r,i)=>{const cls=r.status==='safe'?'ddc_meko-repair-safe':'ddc_meko-repair-review',st=r.status==='safe'?this.t('topologyRepair.safeFix'):this.t('topologyRepair.review');h+='<tr class="ddc_meko-repair-row" data-i="'+i+'"><td>'+(i+1)+'</td><td>'+esc(r.ruleLabel)+'</td><td>'+esc(r.sourceLayer)+' #'+esc(r.sourceObjectId??'')+'</td><td>'+esc(r.targetLayer)+' #'+esc(r.targetObjectId??'')+'</td><td>'+dist(r.distance)+'</td><td class="'+cls+'">'+esc(st)+'</td></tr>';});
    h+='</tbody></table></div>';body.innerHTML=h;
    body.querySelector('[data-a=apply]').onclick=()=>this.applyTopologyRepair(report);
    body.querySelector('[data-a=rescan]').onclick=()=>this.showTopologyRepairTool();
    body.querySelectorAll('tr[data-i]').forEach(row=>row.onclick=()=>this._showTopologyResultOnMap(report.issues[Number(row.dataset.i)]));
  },

  applyTopologyRepair(report=this._topologyRepairReport){
    if(!report)return;const fixes=report.issues.filter(x=>x.status==='safe'&&x.fix);if(!fixes.length){this.toast(this.t('topologyRepair.noSafeFix'));return;}
    this._pushUndo();const touched=new Set();let applied=0;
    for(const item of fixes){const fx=item.fix,l=this.getLayer(fx.layerId),f=l?.fc.features.find(x=>String(x.id)===String(fx.featureId));if(!l||!f)continue;if(fx.action==='move_line_endpoint'&&this._repairSetLineEndpoint(f,fx.partIndex,fx.endpoint,fx.to)){touched.add(l.id);applied++;}}
    for(const id of touched){const l=this.getLayer(id);if(l)this._renderLayer(l);}this._syncProject();this._setDirty?.('topology-repair');this.emit('topologyRepair:applied',{report,applied,touched:[...touched]});this.toast(this.t('topologyRepair.applied',{count:applied}),3500);
    // Immediately re-scan so the user sees what remains for manual review.
    setTimeout(()=>this.runTopologyRepairScan(report.cfg),0);
  }
});
