// Module: tools/aggregate-junction-generator.js
// v0.6.6: Demand Allocation + Hydraulic Junction generation.
// Goal: create a hydraulic skeleton for EPANET. Customer meters are NOT one-to-one
// with Junctions. Demand is projected onto the connected branch-pipe topology,
// grouped along the same hydraulic corridor, and each group becomes one Junction.
(function(){
  const GEN_TAG='demand_allocation_junction';
  const OLD_GEN_TAG='aggregate_junction';

  function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d;}
  function isPointLayer(l){return geomKind(l?.geometryType)==='point';}
  function isLineLayer(l){return geomKind(l?.geometryType)==='line';}
  function hasField(l,name){return (l?.schema||[]).some(f=>String(f.name).toLowerCase()===String(name).toLowerCase());}
  function lineParts(g){if(!g)return[];if(g.type==='LineString')return[g.coordinates||[]];if(g.type==='MultiLineString')return g.coordinates||[];return[];}
  function pointCoord(f){const g=f?.geometry;if(!g||g.type!=='Point'||!Array.isArray(g.coordinates))return null;return g.coordinates;}
  function metersPerDegLon(lat){return Math.max(1,111320*Math.cos((lat||0)*Math.PI/180));}
  function localXY(c,ref){return[(c[0]-ref[0])*metersPerDegLon(ref[1]),(c[1]-ref[1])*110540];}
  function distM(a,b){if(!a||!b)return Infinity;const lat=(a[1]+b[1])/2*Math.PI/180;const dx=(a[0]-b[0])*111320*Math.cos(lat),dy=(a[1]-b[1])*110540;return Math.hypot(dx,dy);}
  function nearestOnSegment(p,a,b){const A=localXY(a,p),B=localXY(b,p),vx=B[0]-A[0],vy=B[1]-A[1],den=vx*vx+vy*vy;let t=den?-(A[0]*vx+A[1]*vy)/den:0;t=Math.max(0,Math.min(1,t));const q=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];return{coord:q,distance:distM(p,q),t};}
  function featureKey(f,i){return f?.properties?.asset_id??f?.properties?.cus_id??f?.properties?.serial??f?.properties?.id??f?.id??i;}
  function safeName(v){return String(v||'').trim();}
  function generatedLayer(l){if(!l)return false;const fs=l.fc?.features||[];return fs.length>0&&fs.every(f=>f?.properties?.generated_by===GEN_TAG||f?.properties?.generated_by===OLD_GEN_TAG||f?.properties?.is_auto===1);}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

  function schema(){return[
    {name:'id',type:'String',dbfType:'C',length:40,decimals:0,visible:true,editable:false,required:true,alias:'id'},
    {name:'elevation',type:'Double',dbfType:'N',length:18,decimals:3,visible:true,editable:true,required:false,alias:'elevation'},
    {name:'demand',type:'Double',dbfType:'N',length:18,decimals:6,visible:true,editable:true,required:false,alias:'demand'},
    {name:'baseDemand',type:'Double',dbfType:'N',length:18,decimals:6,visible:true,editable:true,required:false,alias:'baseDemand'},
    {name:'pattern',type:'String',dbfType:'C',length:40,decimals:0,visible:true,editable:true,required:false,alias:'pattern'},
    {name:'source_count',type:'Integer',dbfType:'N',length:10,decimals:0,visible:true,editable:false,required:false,alias:'source_count'},
    {name:'pipe_id',type:'String',dbfType:'C',length:80,decimals:0,visible:true,editable:false,required:false,alias:'pipe_id'},
    {name:'branch_id',type:'String',dbfType:'C',length:50,decimals:0,visible:true,editable:false,required:false,alias:'branch_id'},
    {name:'cluster_no',type:'Integer',dbfType:'N',length:10,decimals:0,visible:true,editable:false,required:false,alias:'cluster_no'},
    {name:'chainage_m',type:'Double',dbfType:'N',length:18,decimals:3,visible:true,editable:false,required:false,alias:'chainage_m'},
    {name:'root_main',type:'String',dbfType:'C',length:80,decimals:0,visible:true,editable:false,required:false,alias:'root_main'},
    {name:'generated_by',type:'String',dbfType:'C',length:40,decimals:0,visible:true,editable:false,required:false,alias:'generated_by'},
    {name:'is_auto',type:'Integer',dbfType:'N',length:1,decimals:0,visible:true,editable:false,required:false,alias:'is_auto'}
  ];}

  // ---------- spatial index ----------
  function makeGrid(cellM,refLat){
    const lonDeg=cellM/metersPerDegLon(refLat),latDeg=cellM/110540,map=new Map();
    const key=(x,y)=>x+','+y;
    const cell=c=>[Math.floor(c[0]/lonDeg),Math.floor(c[1]/latDeg)];
    function insertBBox(minX,minY,maxX,maxY,id){
      const a=cell([minX,minY]),b=cell([maxX,maxY]);
      for(let x=a[0];x<=b[0];x++)for(let y=a[1];y<=b[1];y++){const k=key(x,y);if(!map.has(k))map.set(k,[]);map.get(k).push(id);}
    }
    function nearby(c,rCells=1){const p=cell(c),out=new Set();for(let dx=-rCells;dx<=rCells;dx++)for(let dy=-rCells;dy<=rCells;dy++){for(const id of map.get(key(p[0]+dx,p[1]+dy))||[])out.add(id);}return [...out];}
    return{insertBBox,nearby,lonDeg,latDeg};
  }

  function flattenSegments(features){
    const segments=[];
    features.forEach((f,fi)=>lineParts(f?.geometry).forEach((coords,pi)=>{
      for(let si=1;si<coords.length;si++){
        const a=coords[si-1],b=coords[si];if(!a||!b||distM(a,b)<1e-5)continue;
        segments.push({id:segments.length,featureIndex:fi,partIndex:pi,segmentIndex:si-1,a:a.slice(),b:b.slice(),len:distM(a,b),splits:[{t:0,coord:a.slice(),kind:'vertex'},{t:1,coord:b.slice(),kind:'vertex'}]});
      }
    }));
    return segments;
  }

  function buildMainIndex(mainFeatures,cellM=50){
    const segs=flattenSegments(mainFeatures);let lat=0,n=0;for(const s of segs){lat+=(s.a[1]+s.b[1])/2;n++;}lat=n?lat/n:0;
    const grid=makeGrid(Math.max(10,cellM),lat);
    segs.forEach(s=>{const padLat=cellM/110540,padLon=cellM/metersPerDegLon((s.a[1]+s.b[1])/2);grid.insertBBox(Math.min(s.a[0],s.b[0])-padLon,Math.min(s.a[1],s.b[1])-padLat,Math.max(s.a[0],s.b[0])+padLon,Math.max(s.a[1],s.b[1])+padLat,s.id);});
    function nearest(p,maxDist=Infinity){let best=null;const ids=grid.nearby(p,2);const use=ids.length?ids:segs.map(s=>s.id);for(const id of use){const s=segs[id],q=nearestOnSegment(p,s.a,s.b);if(q.distance<=maxDist&&(!best||q.distance<best.distance))best={segment:s,coord:q.coord,distance:q.distance,t:q.t,featureIndex:s.featureIndex};}return best;}
    return{segs,nearest};
  }

  // Build a noded service/branch graph. Important: an endpoint landing on the
  // middle of another pipe creates a T-node. Pure line crossings are NOT joined
  // automatically because crossing pipes are not necessarily hydraulically connected.
  function buildHydraulicGraph(features,tolM){
    const segs=flattenSegments(features);let lat=0,n=0;for(const s of segs){lat+=(s.a[1]+s.b[1])/2;n++;}lat=n?lat/n:0;
    const cellM=Math.max(2,tolM*3),grid=makeGrid(cellM,lat);
    segs.forEach(s=>{const padLat=tolM/110540,padLon=tolM/metersPerDegLon((s.a[1]+s.b[1])/2);grid.insertBBox(Math.min(s.a[0],s.b[0])-padLon,Math.min(s.a[1],s.b[1])-padLat,Math.max(s.a[0],s.b[0])+padLon,Math.max(s.a[1],s.b[1])+padLat,s.id);});

    // Endpoint -> segment noding (T-junction support).
    const endpoints=[];
    features.forEach((f,fi)=>lineParts(f?.geometry).forEach((coords,pi)=>{if(coords.length>=2){endpoints.push({coord:coords[0],featureIndex:fi,partIndex:pi,side:0});endpoints.push({coord:coords[coords.length-1],featureIndex:fi,partIndex:pi,side:1});}}));
    for(const ep of endpoints){
      for(const sid of grid.nearby(ep.coord,2)){
        const s=segs[sid];if(s.featureIndex===ep.featureIndex&&s.partIndex===ep.partIndex)continue;
        const q=nearestOnSegment(ep.coord,s.a,s.b);if(q.distance<=tolM&&q.t>1e-6&&q.t<1-1e-6)s.splits.push({t:q.t,coord:q.coord.slice(),kind:'t-junction'});
      }
    }

    const nodes=[],nodeGrid=makeGrid(Math.max(.25,tolM),lat),edges=[],featureEdges=new Map();
    function nodeFor(coord,meta){
      let best=-1,bestD=Infinity;for(const ni of nodeGrid.nearby(coord,1)){const d=distM(coord,nodes[ni].coord);if(d<=tolM&&d<bestD){best=ni;bestD=d;}}
      if(best>=0){if(meta?.kind==='endpoint')nodes[best].hasEndpoint=true;if(meta?.kind==='t-junction')nodes[best].hasTJunction=true;return best;}
      const id=nodes.length;nodes.push({id,coord:coord.slice(),edges:[],component:-1,hasEndpoint:meta?.kind==='endpoint',hasTJunction:meta?.kind==='t-junction',rootIds:[]});nodeGrid.insertBBox(coord[0],coord[1],coord[0],coord[1],id);return id;
    }
    segs.forEach(s=>{
      s.splits.sort((a,b)=>a.t-b.t);const clean=[];for(const x of s.splits){if(!clean.length||Math.abs(x.t-clean[clean.length-1].t)>1e-7)clean.push(x);}
      for(let i=1;i<clean.length;i++){
        const p0=clean[i-1],p1=clean[i],len=distM(p0.coord,p1.coord);if(len<1e-4)continue;
        const a=nodeFor(p0.coord,{kind:p0.t<=1e-7||p0.t>=1-1e-7?'endpoint':p0.kind}),b=nodeFor(p1.coord,{kind:p1.t<=1e-7||p1.t>=1-1e-7?'endpoint':p1.kind});
        if(a===b)continue;const id=edges.length,e={id,a,b,length:len,featureIndex:s.featureIndex,partIndex:s.partIndex,segmentIndex:s.segmentIndex,sourceSegmentId:s.id,coordA:p0.coord.slice(),coordB:p1.coord.slice()};edges.push(e);nodes[a].edges.push(id);nodes[b].edges.push(id);if(!featureEdges.has(s.featureIndex))featureEdges.set(s.featureIndex,[]);featureEdges.get(s.featureIndex).push(id);
      }
    });
    let comp=0;for(const node of nodes){if(node.component>=0)continue;node.component=comp;const st=[node.id];while(st.length){const u=st.pop();for(const ei of nodes[u].edges){const e=edges[ei],v=e.a===u?e.b:e.a;if(nodes[v].component<0){nodes[v].component=comp;st.push(v);}}}comp++;}
    return{nodes,edges,featureEdges,componentCount:comp};
  }

  function heapDijkstra(graph,seeds){
    const dist=new Array(graph.nodes.length).fill(Infinity),root=new Array(graph.nodes.length).fill(-1),heap=[];
    const push=it=>{heap.push(it);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p][0]<=it[0])break;heap[i]=heap[p];i=p;}heap[i]=it;};
    const pop=()=>{if(!heap.length)return null;const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let l=i*2+1,r=l+1,b=l;if(r<heap.length&&heap[r][0]<heap[l][0])b=r;if(b>=heap.length||heap[b][0]>=last[0])break;heap[i]=heap[b];i=b;}heap[i]=last;}return top;};
    seeds.forEach(s=>{if(0<dist[s.nodeId]){dist[s.nodeId]=0;root[s.nodeId]=s.rootId;push([0,s.nodeId,s.rootId]);}});
    while(heap.length){const [du,u,rid]=pop();if(Math.abs(du-dist[u])>1e-9||root[u]!==rid)continue;for(const ei of graph.nodes[u].edges){const e=graph.edges[ei],v=e.a===u?e.b:e.a,nd=du+e.length;if(nd+1e-9<dist[v]){dist[v]=nd;root[v]=rid;push([nd,v,rid]);}}}
    return{dist,root};
  }

  function detectRoots(graph,mains,mainTol){
    const mainIndex=buildMainIndex(mains,Math.max(30,mainTol*5));const raw=[];
    // Prefer endpoints/branch nodes. This avoids creating many roots when a branch pipe
    // happens to run parallel and close to the main.
    for(const node of graph.nodes){
      if(!(node.hasEndpoint||node.edges.length!==2))continue;
      const q=mainIndex.nearest(node.coord,mainTol);if(!q)continue;
      raw.push({nodeId:node.id,component:node.component,coord:q.coord.slice(),mainKey:String(featureKey(mains[q.featureIndex],q.featureIndex)),distance:q.distance});
    }
    // Same hydraulic point may be discovered multiple times due to tiny GIS offsets.
    const roots=[];
    for(const r of raw){let g=roots.find(x=>x.component===r.component&&x.mainKey===r.mainKey&&distM(x.coord,r.coord)<=mainTol);if(!g){g={id:roots.length,component:r.component,mainKey:r.mainKey,coord:r.coord.slice(),nodeIds:[]};roots.push(g);}g.nodeIds.push(r.nodeId);}
    roots.forEach(r=>r.nodeIds.forEach(n=>graph.nodes[n].rootIds.push(r.id)));
    return roots;
  }

  // A corridor is a continuous pipe path between hydraulic anchors (root, branch,
  // or dead-end). Shape vertices with degree 2 stay inside the corridor and do not
  // become standalone Junctions.
  function buildCorridors(graph,roots,labels,features){
    const rootNodes=new Set(roots.flatMap(r=>r.nodeIds));const anchor=n=>rootNodes.has(n.id)||n.edges.length!==2;const used=new Set(),corridors=[];
    function trace(startNode,firstEdge){
      const refs=[];let u=startNode,ei=firstEdge,length=0;
      while(true){if(used.has(ei))break;used.add(ei);const e=graph.edges[ei],v=e.a===u?e.b:e.a;refs.push({edgeId:ei,from:u,to:v,offset:length,length:e.length});length+=e.length;if(anchor(graph.nodes[v]))return{endNode:v,refs,length};const next=graph.nodes[v].edges.find(x=>x!==ei&&!used.has(x));if(next==null)return{endNode:v,refs,length};u=v;ei=next;}
      return{endNode:u,refs,length};
    }
    for(const n of graph.nodes){if(!anchor(n))continue;for(const ei of n.edges){if(used.has(ei))continue;const t=trace(n.id,ei),id=corridors.length;const rootA=labels.root[n.id],rootB=labels.root[t.endNode],rootId=rootA>=0?rootA:rootB;const sourceFeatures=new Set(t.refs.map(r=>graph.edges[r.edgeId].featureIndex));corridors.push({id,startNode:n.id,endNode:t.endNode,refs:t.refs,length:t.length,rootId,component:n.component,sourceFeatures,meters:[]});}}
    // Closed loops with no anchor: consume remaining edges as one corridor.
    for(const e of graph.edges){if(used.has(e.id))continue;const t=trace(e.a,e.id),id=corridors.length;const sourceFeatures=new Set(t.refs.map(r=>graph.edges[r.edgeId].featureIndex));corridors.push({id,startNode:e.a,endNode:t.endNode,refs:t.refs,length:t.length,rootId:labels.root[e.a],component:graph.nodes[e.a].component,sourceFeatures,meters:[]});}
    const edgeToCorridor=new Map();corridors.forEach(c=>c.refs.forEach((r,i)=>edgeToCorridor.set(r.edgeId,{corridorId:c.id,refIndex:i})));
    corridors.forEach(c=>{c.pipeKey=[...c.sourceFeatures].map(fi=>String(featureKey(features[fi],fi))).join('+');c.rootMain=c.rootId>=0?roots[c.rootId]?.mainKey||'':'';});
    return{corridors,edgeToCorridor};
  }

  function nearestGraphEdge(p,graph,maxDist){let best=null;for(const e of graph.edges){const q=nearestOnSegment(p,e.coordA,e.coordB);if(q.distance<=maxDist&&(!best||q.distance<best.distance))best={edge:e,coord:q.coord,distance:q.distance,t:q.t};}return best;}

  function corridorPointAt(c,graph,chainage){let x=clamp(chainage,0,c.length);for(const r of c.refs){if(x<=r.offset+r.length+1e-9){const e=graph.edges[r.edgeId],fromCoord=graph.nodes[r.from].coord,toCoord=graph.nodes[r.to].coord,t=r.length?clamp((x-r.offset)/r.length,0,1):0;return[fromCoord[0]+(toCoord[0]-fromCoord[0])*t,fromCoord[1]+(toCoord[1]-fromCoord[1])*t];}}return graph.nodes[c.endNode].coord.slice();}

  function chainageOnCorridor(c,graph,edgeId,q){const ref=c.refs.find(r=>r.edgeId===edgeId);if(!ref)return 0;const from=graph.nodes[ref.from].coord,to=graph.nodes[ref.to].coord;const nq=nearestOnSegment(q,from,to);return ref.offset+nq.t*ref.length;}

  function parentCorridorAtNode(c,corridors,graph,labels){
    // rootward endpoint is the endpoint with lower Dijkstra distance.
    const ds=labels.dist[c.startNode],de=labels.dist[c.endNode],nodeId=ds<=de?c.startNode:c.endNode;
    const candidates=[];for(const ei of graph.nodes[nodeId].edges){for(const x of corridors){if(x.id===c.id)continue;if(x.refs.some(r=>r.edgeId===ei)){candidates.push(x);break;}}}
    if(!candidates.length)return null;return candidates.sort((a,b)=>Math.min(labels.dist[a.startNode],labels.dist[a.endNode])-Math.min(labels.dist[b.startNode],labels.dist[b.endNode]))[0]||null;
  }

  function mapMeterToCorridor(meter,mi,graph,corridorData,roots,labels,features,cfg){
    const p=pointCoord(meter);if(!p)return null;const hit=nearestGraphEdge(p,graph,cfg.meterTolerance);if(!hit)return null;let info=corridorData.edgeToCorridor.get(hit.edge.id);if(!info)return null;let corridor=corridorData.corridors[info.corridorId],point=hit.coord.slice(),chain=chainageOnCorridor(corridor,graph,hit.edge.id,point),collapsedSpur=false;
    // Collapse only very short dead-end customer spurs. Distribution branches such as
    // E/D/B-C are normally longer than this threshold and remain independent corridors.
    const startDeg=graph.nodes[corridor.startNode].edges.length,endDeg=graph.nodes[corridor.endNode].edges.length,isDeadEnd=startDeg===1||endDeg===1;
    if(isDeadEnd&&corridor.length<=cfg.spurMaxLength){const parent=parentCorridorAtNode(corridor,corridorData.corridors,graph,labels);if(parent){const joinNode=(graph.nodes[corridor.startNode].edges.length===1)?corridor.endNode:corridor.startNode;point=graph.nodes[joinNode].coord.slice();corridor=parent; // place demand on the distribution corridor feeding the house spur
        // chainage on parent via nearest parent edge to join point
        let best=null;for(const r of parent.refs){const e=graph.edges[r.edgeId],q=nearestOnSegment(point,e.coordA,e.coordB);if(!best||q.distance<best.distance)best={edgeId:e.id,coord:q.coord,distance:q.distance};}if(best){point=best.coord;chain=chainageOnCorridor(parent,graph,best.edgeId,point);}collapsedSpur=true;}}
    const demand=num(meter?.properties?.[cfg.demandField],0);return{meterIndex:mi,meterId:String(featureKey(meter,mi)),demand,corridorId:corridor.id,coord:point,chainage:chain,collapsedSpur,rootId:corridor.rootId};
  }

  function splitSpatialRuns(items,cfg){
    if(!items.length)return[];const sorted=items.slice().sort((a,b)=>a.chainage-b.chainage),runs=[];let run=[sorted[0]],start=sorted[0].chainage;
    for(let i=1;i<sorted.length;i++){const gap=sorted[i].chainage-sorted[i-1].chainage,span=sorted[i].chainage-start;if(gap>cfg.clusterGap||span>cfg.maxClusterLength){runs.push(run);run=[sorted[i]];start=sorted[i].chainage;}else run.push(sorted[i]);}runs.push(run);return runs;
  }

  // Keep groups balanced. Example: 4 meters with max=3 -> 2+2, not 3+1.
  function balanceByCount(run,maxMeters){if(run.length<=maxMeters)return[run];const groups=Math.ceil(run.length/maxMeters),base=Math.floor(run.length/groups),extra=run.length%groups,out=[];let p=0;for(let g=0;g<groups;g++){const size=base+(g<extra?1:0);out.push(run.slice(p,p+size));p+=size;}return out;}

  function clusterMeters(assignments,corridors,graph,cfg){
    const by=new Map();for(const a of assignments){if(!by.has(a.corridorId))by.set(a.corridorId,[]);by.get(a.corridorId).push(a);}const clusters=[];
    for(const [cid,items] of by){const corridor=corridors[cid];let no=0;for(const run of splitSpatialRuns(items,cfg)){for(const group of balanceByCount(run,cfg.maxMetersPerJunction)){no++;const total=group.reduce((s,x)=>s+x.demand,0),chain=total>0?group.reduce((s,x)=>s+x.chainage*x.demand,0)/total:group.reduce((s,x)=>s+x.chainage,0)/group.length;clusters.push({corridorId:cid,clusterNo:no,items:group,demand:total,chainage:chain,coord:corridorPointAt(corridor,graph,chain),corridor});}}}
    return clusters;
  }

  Object.assign(WaterMapCore.prototype,{
    _aggregateJunctionCandidates(){const points=(this.layers||[]).filter(l=>isPointLayer(l)&&(l.fc?.features||[]).length),meters=points.filter(l=>hasField(l,'demand')||hasField(l,'baseDemand')),lines=(this.layers||[]).filter(l=>isLineLayer(l)&&(l.fc?.features||[]).length);return{meters,lines};},

    showAggregateJunctionTool(){
      const c=this._aggregateJunctionCandidates();if(!c.meters.length||c.lines.length<2){this.toast(this.t('aggregateJunction.needLayers'),4500);return;}
      const active=this.getActiveLayer?.(),meterDefault=c.meters.find(x=>x.id===active?.id)||c.meters[0],meterOpts=c.meters.map(l=>'<option value="'+esc(l.id)+'"'+(l.id===meterDefault.id?' selected':'')+'>'+esc(l.name)+' ('+(l.fc?.features?.length||0)+')</option>').join(''),lineOpts=c.lines.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+' ('+(l.fc?.features?.length||0)+')</option>').join('');
      const html='\
<div style="display:grid;grid-template-columns:225px 1fr;gap:10px 12px;align-items:center">\
<label>'+esc(this.t('aggregateJunction.meterLayer'))+'</label><select id="ddcAggMeter">'+meterOpts+'</select>\
<label>'+esc(this.t('aggregateJunction.demandField'))+'</label><select id="ddcAggDemand"></select>\
<label>'+esc(this.t('aggregateJunction.serviceLayer'))+'</label><select id="ddcAggService">'+lineOpts+'</select>\
<label>'+esc(this.t('aggregateJunction.mainLayer'))+'</label><select id="ddcAggMain">'+lineOpts+'</select>\
<label>'+esc(this.t('aggregateJunction.outputName'))+'</label><input id="ddcAggName" value="w_junctions_auto">\
<label>'+esc(this.t('aggregateJunction.meterTolerance'))+'</label><input id="ddcAggMeterTol" type="number" min="0.1" step="0.5" value="5">\
<label>'+esc(this.t('aggregateJunction.mainTolerance'))+'</label><input id="ddcAggMainTol" type="number" min="0.1" step="0.5" value="3">\
<label>'+esc(this.t('aggregateJunction.groupTolerance'))+'</label><input id="ddcAggGroupTol" type="number" min="0.05" step="0.1" value="0.75">\
<label>'+esc(this.t('aggregateJunction.spurMaxLength'))+'</label><input id="ddcAggSpur" type="number" min="0" step="1" value="20">\
<label>'+esc(this.t('aggregateJunction.clusterGap'))+'</label><input id="ddcAggGap" type="number" min="1" step="1" value="30">\
<label>'+esc(this.t('aggregateJunction.maxClusterLength'))+'</label><input id="ddcAggLen" type="number" min="1" step="5" value="50">\
<label>'+esc(this.t('aggregateJunction.maxMeters'))+'</label><input id="ddcAggMax" type="number" min="1" step="1" value="3">\
</div>\
<div style="margin-top:12px;padding:10px;border:1px solid #d8e0e5;border-radius:6px;background:#f8fafb">'+esc(this.t('aggregateJunction.help'))+'</div>\
<div id="ddcAggPreview" style="margin-top:12px"></div>';
      const score=(l,k)=>{const n=String(l.name||'').toLowerCase();return k==='service'?(/service|nhanh|phanphoi|distribution/.test(n)?10:0):(/main|chinh|trunk/.test(n)?10:0);};
      const setSmartDefaults=()=>{const service=this.modalWrap.querySelector('#ddcAggService'),main=this.modalWrap.querySelector('#ddcAggMain');const s=c.lines.slice().sort((a,b)=>score(b,'service')-score(a,'service'))[0],m=c.lines.filter(x=>x.id!==s?.id).sort((a,b)=>score(b,'main')-score(a,'main'))[0]||c.lines[1];if(s)service.value=s.id;if(m)main.value=m.id;};
      const refreshDemand=()=>{const l=this.getLayer(this.modalWrap.querySelector('#ddcAggMeter')?.value)||meterDefault,sel=this.modalWrap.querySelector('#ddcAggDemand'),numeric=(l.schema||[]).filter(f=>/double|integer|number|float|decimal/i.test(String(f.type||'')));sel.innerHTML=numeric.map(f=>'<option value="'+esc(f.name)+'"'+(/^(demand|basedemand)$/i.test(String(f.name))?' selected':'')+'>'+esc(f.alias||f.name)+'</option>').join('');};
      const readCfg=()=>({meterLayerId:this.modalWrap.querySelector('#ddcAggMeter')?.value,demandField:this.modalWrap.querySelector('#ddcAggDemand')?.value||'demand',serviceLayerId:this.modalWrap.querySelector('#ddcAggService')?.value,mainLayerId:this.modalWrap.querySelector('#ddcAggMain')?.value,outputName:safeName(this.modalWrap.querySelector('#ddcAggName')?.value)||'w_junctions_auto',meterTolerance:Math.max(.1,num(this.modalWrap.querySelector('#ddcAggMeterTol')?.value,5)),mainTolerance:Math.max(.1,num(this.modalWrap.querySelector('#ddcAggMainTol')?.value,3)),groupTolerance:Math.max(.05,num(this.modalWrap.querySelector('#ddcAggGroupTol')?.value,.75)),spurMaxLength:Math.max(0,num(this.modalWrap.querySelector('#ddcAggSpur')?.value,20)),clusterGap:Math.max(1,num(this.modalWrap.querySelector('#ddcAggGap')?.value,30)),maxClusterLength:Math.max(1,num(this.modalWrap.querySelector('#ddcAggLen')?.value,50)),maxMetersPerJunction:Math.max(1,Math.round(num(this.modalWrap.querySelector('#ddcAggMax')?.value,3)))});
      const preview=()=>{try{const cfg=readCfg(),res=this._buildAggregateJunctionData(cfg);this._aggregateJunctionPreview={cfg,res};const host=this.modalWrap.querySelector('#ddcAggPreview');if(host)host.innerHTML=this._aggregateJunctionStatsHtml(res.stats);}catch(e){console.error(e);this.toast(e.message||String(e),5000);}};
      const apply=()=>{try{const cfg=readCfg(),existing=(this.layers||[]).find(l=>String(l.name).toLowerCase()===cfg.outputName.toLowerCase());if(existing){if(!generatedLayer(existing)){this.toast(this.t('aggregateJunction.nameConflict',{name:cfg.outputName}),5200);return;}if(!confirm(this.t('aggregateJunction.rebuildConfirm',{name:existing.name,count:existing.fc?.features?.length||0})))return;}let res=this._aggregateJunctionPreview&&JSON.stringify(this._aggregateJunctionPreview.cfg)===JSON.stringify(cfg)?this._aggregateJunctionPreview.res:null;if(!res)res=this._buildAggregateJunctionData(cfg);this._applyAggregateJunctionData(cfg,res,existing);this._aggregateJunctionPreview=null;this._closeModal();this.toast(this.t('aggregateJunction.created',{count:res.fc.features.length,name:cfg.outputName}),5000);}catch(e){console.error(e);this.toast(e.message||String(e),6000);}};
      this._modal(this.t('aggregateJunction.title'),html,[{text:this.t('aggregateJunction.preview'),fn:preview},{text:this.t('aggregateJunction.generate'),primary:true,fn:apply},{text:this.t('common.cancel'),fn:()=>{this._aggregateJunctionPreview=null;this._closeModal();}}],{wide:true});this.modalWrap.querySelector('#ddcAggMeter').onchange=refreshDemand;setSmartDefaults();refreshDemand();
    },

    _buildAggregateJunctionData(cfg){
      const meterLayer=this.getLayer(cfg.meterLayerId),serviceLayer=this.getLayer(cfg.serviceLayerId),mainLayer=this.getLayer(cfg.mainLayerId);if(!meterLayer||!serviceLayer||!mainLayer)throw new Error(this.t('aggregateJunction.needLayers'));if(serviceLayer.id===mainLayer.id)throw new Error(this.t('aggregateJunction.serviceMainDifferent'));if(!isPointLayer(meterLayer)||!isLineLayer(serviceLayer)||!isLineLayer(mainLayer))throw new Error(this.t('aggregateJunction.geometryMismatch'));
      const meters=meterLayer.fc?.features||[],services=serviceLayer.fc?.features||[],mains=mainLayer.fc?.features||[];
      const graph=buildHydraulicGraph(services,cfg.groupTolerance),roots=detectRoots(graph,mains,cfg.mainTolerance),seeds=[];roots.forEach(r=>r.nodeIds.forEach(nodeId=>seeds.push({nodeId,rootId:r.id})));const labels=heapDijkstra(graph,seeds),corridorData=buildCorridors(graph,roots,labels,services);
      const assignments=[];let unmatchedMeter=0,unmatchedRoot=0,zeroDemand=0,collapsedSpurs=0;
      meters.forEach((m,mi)=>{const a=mapMeterToCorridor(m,mi,graph,corridorData,roots,labels,services,cfg);if(!a){unmatchedMeter++;return;}if(a.rootId<0){unmatchedRoot++;return;}if(a.demand===0)zeroDemand++;if(a.collapsedSpur)collapsedSpurs++;assignments.push(a);});
      const clusters=clusterMeters(assignments,corridorData.corridors,graph,cfg);let idx=0;const features=[];
      for(const cl of clusters){const c=cl.corridor;if(cl.items.length===0)continue;idx++;const id='AUTO_JUNC_'+String(idx).padStart(6,'0'),branchId='BRANCH_'+String((c.rootId>=0?c.rootId:c.component)+1).padStart(5,'0');features.push({type:'Feature',id,properties:{id,elevation:0,demand:Number(cl.demand.toFixed(6)),baseDemand:Number(cl.demand.toFixed(6)),pattern:'',source_count:cl.items.length,pipe_id:c.pipeKey||String(c.id),branch_id:branchId,cluster_no:cl.clusterNo,chainage_m:Number(cl.chainage.toFixed(3)),root_main:c.rootMain||'',generated_by:GEN_TAG,is_auto:1},geometry:{type:'Point',coordinates:cl.coord.slice()}});}
      const totalInputDemand=assignments.reduce((s,a)=>s+a.demand,0),totalOutputDemand=features.reduce((s,f)=>s+num(f.properties.demand,0),0),corridorsWithDemand=new Set(assignments.map(a=>a.corridorId)).size;
      return{fc:{type:'FeatureCollection',name:cfg.outputName,features},schema:schema(),stats:{meters:meters.length,services:services.length,serviceComponents:graph.componentCount,roots:roots.length,corridors:corridorData.corridors.length,corridorsWithDemand,matched:assignments.length,unmatchedMeter,unmatchedRoot,zeroDemand,collapsedSpurs,junctions:features.length,totalInputDemand,totalOutputDemand,demandBalance:Math.abs(totalInputDemand-totalOutputDemand)}};
    },

    _aggregateJunctionStatsHtml(s){const row=(a,b)=>'<tr><td style="padding:3px 14px 3px 0">'+esc(a)+'</td><td style="font-weight:600">'+esc(b)+'</td></tr>';return '<div style="font-weight:700;margin-bottom:6px">'+esc(this.t('aggregateJunction.previewTitle'))+'</div><table>'+row(this.t('aggregateJunction.meters'),s.meters)+row(this.t('aggregateJunction.services'),s.services)+row(this.t('aggregateJunction.serviceComponents'),s.serviceComponents)+row(this.t('aggregateJunction.roots'),s.roots)+row(this.t('aggregateJunction.corridors'),s.corridors)+row(this.t('aggregateJunction.corridorsWithDemand'),s.corridorsWithDemand)+row(this.t('aggregateJunction.matched'),s.matched)+row(this.t('aggregateJunction.unmatchedMeter'),s.unmatchedMeter)+row(this.t('aggregateJunction.unmatchedMain'),s.unmatchedRoot)+row(this.t('aggregateJunction.collapsedSpurs'),s.collapsedSpurs)+row(this.t('aggregateJunction.junctions'),s.junctions)+row(this.t('aggregateJunction.totalDemand'),s.totalOutputDemand.toFixed(6)+' L/s')+row(this.t('aggregateJunction.demandBalance'),s.demandBalance.toFixed(9)+' L/s')+'</table>';},
    _removeGeneratedLayerNoUndo(layer){if(!layer)return;try{if(layer.leaflet)this.map.removeLayer(layer.leaflet);if(layer._hitLayer)this.map.removeLayer(layer._hitLayer);if(layer._directionLayer)this.map.removeLayer(layer._directionLayer);}catch(_){}this.layers=this.layers.filter(x=>x.id!==layer.id);this.layerIndex.delete(layer.id);if(this.activeLayerId===layer.id)this.activeLayerId=null;this.emit?.('layer:removed',{layer});},
    _applyAggregateJunctionData(cfg,res,existing){this._pushUndo?.();if(existing)this._removeGeneratedLayerNoUndo(existing);const l=this._addLayerRecord({name:cfg.outputName,fc:res.fc,geometryType:'Point',schema:res.schema,style:{color:'#7a3db8',stroke:'#ffffff',radius:7,opacity:.95,symbol:'junction'},visible:true,sourceCRS:'EPSG:4326',epanetRole:'junction',epanetMapping:{id:'id',elevation:'elevation',baseDemand:'baseDemand',pattern:'pattern'},clustering:{enabled:false,radius:60,showCount:true}});this.activeLayerId=l.id;this._applyLayerOrder?.();this._syncProject?.();this._setDirty?.('demand-allocation-junction');this.showLayerPanel?.();this.emit?.('aggregate-junction:generated',{layer:l,stats:res.stats,config:cfg});return l;}
  });
})();
