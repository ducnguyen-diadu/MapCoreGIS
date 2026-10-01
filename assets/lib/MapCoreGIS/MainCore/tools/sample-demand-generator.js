// Module: tools/sample-demand-generator.js
// Synthetic EPANET base-demand generator for customer meter layers.
// Generates realistic-looking average demand from monthly consumption assumptions.
(function(){
  function hash32(str){
    str=String(str??'');let h=2166136261>>>0;
    for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
    h+=h<<13;h^=h>>>7;h+=h<<3;h^=h>>>17;h+=h<<5;
    return h>>>0;
  }
  function rng(seed){
    let a=seed>>>0;
    return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
  }
  function normal01(r){
    const u=Math.max(1e-12,r()),v=Math.max(1e-12,r());
    return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
  }
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function n(v,def=0){const x=Number(v);return Number.isFinite(x)?x:def;}
  function tier(d){
    // Assumptions for synthetic monthly customer use (m3/month).
    // Diameter is only a proxy because the current layer has no customer_type field.
    d=n(d,15);
    if(d<=15)return{median:14,min:5,max:28};
    if(d<=20)return{median:22,min:7,max:45};
    if(d<=25)return{median:38,min:12,max:85};
    if(d<=32)return{median:70,min:20,max:160};
    if(d<=40)return{median:120,min:35,max:300};
    if(d<=50)return{median:210,min:60,max:520};
    return{median:360,min:100,max:1000};
  }
  function monthlySample(diameter,seedKey,spread){
    const t=tier(diameter),r=rng(hash32(seedKey));
    // Log-normal around median; spread is sigma in ln-space.
    const sigma=clamp(n(spread,.42),.05,1.2);
    const value=t.median*Math.exp(sigma*normal01(r));
    return clamp(value,t.min,t.max);
  }
  function m3MonthToLps(v,days){return (v*1000)/(Math.max(1,days)*24*3600);}
  function percentile(arr,p){if(!arr.length)return 0;const a=arr.slice().sort((x,y)=>x-y);const i=(a.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(i-lo);}
  function featureKey(f,i){return f?.properties?.asset_id??f?.properties?.cus_id??f?.properties?.serial??f?.id??i;}
  function isDisabled(f,field){if(!field)return false;const v=f?.properties?.[field];return v===0||v===false||String(v).toLowerCase()==='false'||String(v).toLowerCase()==='disabled';}

  Object.assign(WaterMapCore.prototype,{
    _sampleDemandCandidateLayers(){
      return (this.layers||[]).filter(l=>Array.isArray(l.fc?.features)&&l.fc.features.length>0&&
        (l.schema||[]).some(f=>String(f.name).toLowerCase()==='demand'));
    },
    showSampleDemandTool(){
      const layers=this._sampleDemandCandidateLayers();
      if(!layers.length){this.toast(this.t('sampleDemand.noLayer'),4200);return;}
      const active=(this.getActiveLayer?.()&&layers.find(x=>x.id===this.activeLayerId))||layers[0];
      const layerOpts=layers.map(l=>'<option value="'+esc(l.id)+'"'+(l.id===active.id?' selected':'')+'>'+esc(l.name)+' ('+l.fc.features.length+')</option>').join('');
      const html='\
<div style="display:grid;grid-template-columns:180px 1fr;gap:10px 12px;align-items:center">\
<label>'+esc(this.t('sampleDemand.layer'))+'</label><select id="ddcDemandLayer">'+layerOpts+'</select>\
<label>'+esc(this.t('sampleDemand.demandField'))+'</label><select id="ddcDemandField"></select>\
<label>'+esc(this.t('sampleDemand.diameterField'))+'</label><select id="ddcDemandDiameter"></select>\
<label>'+esc(this.t('sampleDemand.enabledField'))+'</label><select id="ddcDemandEnabled"></select>\
<label>'+esc(this.t('sampleDemand.seed'))+'</label><input id="ddcDemandSeed" value="2026">\
<label>'+esc(this.t('sampleDemand.days'))+'</label><input id="ddcDemandDays" type="number" min="1" max="31" step="1" value="30">\
<label>'+esc(this.t('sampleDemand.variation'))+'</label><input id="ddcDemandSpread" type="number" min="0.05" max="1.2" step="0.05" value="0.42">\
<label>'+esc(this.t('sampleDemand.overwrite'))+'</label><input id="ddcDemandOverwrite" type="checkbox" checked>\
<label>'+esc(this.t('sampleDemand.zeroDisabled'))+'</label><input id="ddcDemandZeroDisabled" type="checkbox" checked>\
</div>\
<div style="margin-top:12px;padding:10px;border:1px solid #d8e0e5;border-radius:6px;background:#f8fafb">'+esc(this.t('sampleDemand.help'))+'</div>\
<div id="ddcDemandPreview" style="margin-top:12px"></div>';
      const refreshFields=()=>{
        const lid=this.modalWrap.querySelector('#ddcDemandLayer')?.value;
        const l=this.getLayer(lid)||layers[0];if(!l)return;
        const schema=l.schema||[];
        const demandSel=this.modalWrap.querySelector('#ddcDemandField');
        const diaSel=this.modalWrap.querySelector('#ddcDemandDiameter');
        const enaSel=this.modalWrap.querySelector('#ddcDemandEnabled');
        const numeric=schema.filter(f=>/double|integer|number|float|decimal/i.test(String(f.type||'')));
        demandSel.innerHTML=numeric.map(f=>'<option value="'+esc(f.name)+'"'+(String(f.name).toLowerCase()==='demand'?' selected':'')+'>'+esc(f.alias||f.name)+'</option>').join('');
        diaSel.innerHTML='<option value="">'+esc(this.t('sampleDemand.none'))+'</option>'+numeric.map(f=>'<option value="'+esc(f.name)+'"'+(String(f.name).toLowerCase()==='diameter'?' selected':'')+'>'+esc(f.alias||f.name)+'</option>').join('');
        enaSel.innerHTML='<option value="">'+esc(this.t('sampleDemand.none'))+'</option>'+schema.map(f=>'<option value="'+esc(f.name)+'"'+(String(f.name).toLowerCase()==='enabled'?' selected':'')+'>'+esc(f.alias||f.name)+'</option>').join('');
        const pv=this.modalWrap.querySelector('#ddcDemandPreview');if(pv)pv.innerHTML='';
      };
      const readCfg=()=>({
        layerId:this.modalWrap.querySelector('#ddcDemandLayer')?.value,
        demandField:this.modalWrap.querySelector('#ddcDemandField')?.value||'demand',
        diameterField:this.modalWrap.querySelector('#ddcDemandDiameter')?.value||'',
        enabledField:this.modalWrap.querySelector('#ddcDemandEnabled')?.value||'',
        seed:this.modalWrap.querySelector('#ddcDemandSeed')?.value||'2026',
        days:clamp(n(this.modalWrap.querySelector('#ddcDemandDays')?.value,30),1,31),
        spread:clamp(n(this.modalWrap.querySelector('#ddcDemandSpread')?.value,.42),.05,1.2),
        overwrite:!!this.modalWrap.querySelector('#ddcDemandOverwrite')?.checked,
        zeroDisabled:!!this.modalWrap.querySelector('#ddcDemandZeroDisabled')?.checked
      });
      const preview=()=>{
        const cfg=readCfg(),res=this._generateSampleDemandValues(cfg);
        this._sampleDemandPreview={cfg,values:res.values};
        const host=this.modalWrap.querySelector('#ddcDemandPreview');if(!host)return;
        host.innerHTML='<div style="font-weight:700;margin-bottom:6px">'+esc(this.t('sampleDemand.previewTitle'))+'</div>'+this._sampleDemandStatsHtml(res.stats);
      };
      const apply=()=>{
        const cfg=readCfg();
        let values=this._sampleDemandPreview&&JSON.stringify(this._sampleDemandPreview.cfg)===JSON.stringify(cfg)?this._sampleDemandPreview.values:null;
        if(!values)values=this._generateSampleDemandValues(cfg).values;
        const count=this._applySampleDemandValues(cfg,values);
        this._sampleDemandPreview=null;this._closeModal();this.toast(this.t('sampleDemand.applied',{count}),4200);
      };
      this._modal(this.t('sampleDemand.title'),html,[
        {text:this.t('sampleDemand.preview'),fn:preview},
        {text:this.t('sampleDemand.apply'),primary:true,fn:apply},
        {text:this.t('common.cancel'),fn:()=>{this._sampleDemandPreview=null;this._closeModal();}}
      ],{wide:true});
      this.modalWrap.querySelector('#ddcDemandLayer').onchange=refreshFields;
      refreshFields();
    },
    _generateSampleDemandValues(cfg){
      const l=this.getLayer(cfg.layerId);if(!l)throw new Error(this.t('sampleDemand.noLayer'));
      const values=[];const demands=[];const monthly=[];let skipped=0,disabled=0;
      l.fc.features.forEach((f,i)=>{
        f.properties=f.properties||{};
        const old=f.properties[cfg.demandField];
        if(!cfg.overwrite&&old!==null&&old!==undefined&&old!==''&&Number(old)!==0){values.push({i,skip:true});skipped++;return;}
        let month=0,demand=0;
        if(cfg.zeroDisabled&&isDisabled(f,cfg.enabledField)){disabled++;}
        else{
          const dia=cfg.diameterField?f.properties[cfg.diameterField]:15;
          month=monthlySample(dia,cfg.seed+'|'+featureKey(f,i),cfg.spread);
          demand=m3MonthToLps(month,cfg.days);
        }
        demand=Number(demand.toFixed(6));month=Number(month.toFixed(2));
        values.push({i,demand,month});demands.push(demand);monthly.push(month);
      });
      const sum=demands.reduce((a,b)=>a+b,0),sumMonth=monthly.reduce((a,b)=>a+b,0);
      const stats={count:demands.length,skipped,disabled,min:demands.length?Math.min(...demands):0,max:demands.length?Math.max(...demands):0,avg:demands.length?sum/demands.length:0,p50:percentile(demands,.5),p90:percentile(demands,.9),sum,sumMonth};
      return{values,stats};
    },
    _sampleDemandStatsHtml(s){
      const row=(a,b)=>'<tr><td style="padding:3px 12px 3px 0">'+esc(a)+'</td><td style="padding:3px 0;font-weight:600">'+esc(b)+'</td></tr>';
      return '<table>'+row(this.t('sampleDemand.count'),s.count)+row(this.t('sampleDemand.skipped'),s.skipped)+row(this.t('sampleDemand.disabledCount'),s.disabled)+row('Min demand',s.min.toFixed(6)+' L/s')+row('Median (P50)',s.p50.toFixed(6)+' L/s')+row('P90',s.p90.toFixed(6)+' L/s')+row('Average',s.avg.toFixed(6)+' L/s')+row('Max demand',s.max.toFixed(6)+' L/s')+row(this.t('sampleDemand.totalDemand'),s.sum.toFixed(4)+' L/s')+row(this.t('sampleDemand.totalMonthly'),s.sumMonth.toFixed(1)+' m³/tháng')+'</table>';
    },
    _applySampleDemandValues(cfg,values){
      const l=this.getLayer(cfg.layerId);if(!l)return 0;
      this._pushUndo?.();let count=0;
      values.forEach(v=>{if(v.skip)return;const f=l.fc.features[v.i];if(!f)return;f.properties=f.properties||{};f.properties[cfg.demandField]=v.demand;count++;});
      this._renderLayer?.(l);this._syncProject?.();this._setDirty?.('sample-demand');this.emit?.('sample-demand:applied',{layer:l,count,config:cfg});
      return count;
    }
  });
})();
