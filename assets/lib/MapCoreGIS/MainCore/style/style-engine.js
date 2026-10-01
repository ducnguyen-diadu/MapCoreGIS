// Module: style/style-engine.js
Object.assign(WaterMapCore.prototype, {
  _resolveFeatureVisualStyle(layer,feature){
    const s=layer.style||{},r=s.rules||{};const out={color:s.color||'#0b8ea6',weight:s.weight||3,opacity:s.opacity??0.9,fillColor:s.fillColor||'#52b5c5',fillOpacity:s.fillOpacity??0.25,radius:s.radius||6,stroke:s.stroke||'#fff',symbol:s.symbol||'circle'};
    const apply=(prop)=>{const rule=r[prop];if(!rule?.field)return;const g=this._matchStyleGroup?.(rule,feature.properties?.[rule.field]);if(g&&g.value!==undefined&&g.value!==null&&g.value!=='')out[prop]=prop==='weight'||prop==='opacity'||prop==='radius'?Number(g.value):g.value;};
    ['color','weight','opacity','radius','symbol'].forEach(apply);return out;
  },
  _styleValueControl(prop,value){
    if(prop==='color')return'<input data-style-value type="color" value="'+esc(value||'#0b8ea6')+'">';
    if(prop==='weight')return'<input data-style-value type="number" min="1" max="30" step="1" value="'+esc(value??3)+'">';
    if(prop==='opacity')return'<input data-style-value type="number" min="0.05" max="1" step="0.05" value="'+esc(value??0.9)+'">';
    if(prop==='radius')return'<input data-style-value type="number" min="2" max="40" step="1" value="'+esc(value??6)+'">';
    const symbols=['circle','square','diamond','triangle','star','junction','valve','pump','meter','tank'];return'<select data-style-value>'+symbols.map(x=>'<option value="'+x+'" '+(String(value||'circle')===x?'selected':'')+'>'+x+'</option>').join('')+'</select>';
  },
  configureStyle(){
    const l=this.getActiveLayer();if(!l)return;const kind=geomKind(l.geometryType),rules=l.style?.rules||{};
    const summary=p=>rules[p]?.field?esc(rules[p].field)+' · '+rules[p].groups.length+' '+esc(this.t('style.groups')):esc(this.t('style.notConfigured'));
    let h='<label class="ddc_meko-field"><span>'+esc(this.t('layer.color'))+'</span><input id="ddcStyleColor" type="color" value="'+esc(l.style.color||'#0b8ea6')+'"></label>';
    if(kind==='line'||kind==='polygon')h+='<label class="ddc_meko-field"><span>'+esc(this.t('layer.lineWidth'))+'</span><input id="ddcStyleWeight" type="number" min="1" max="30" value="'+esc(l.style.weight||3)+'"></label>';
    if(kind==='point')h+='<label class="ddc_meko-field"><span>'+esc(this.t('style.pointSize'))+'</span><input id="ddcStyleRadius" type="number" min="2" max="40" value="'+esc(l.style.radius||6)+'"></label>';
    h+='<label class="ddc_meko-field"><span>'+esc(this.t('style.opacity'))+'</span><input id="ddcStyleOpacity" type="number" min="0.05" max="1" step="0.05" value="'+esc(l.style.opacity??0.9)+'"></label><label class="ddc_meko-field"><span>'+esc(this.t('layer.labelField'))+'</span><select id="ddcLabelField"><option value="">'+esc(this.t('layer.noLabel'))+'</option>'+(l.schema||[]).map(f=>'<option value="'+esc(f.name)+'" '+(l.style.labelField===f.name?'selected':'')+'>'+esc(f.name)+'</option>').join('')+'</select></label>';
    const props=[];props.push(['color',this.t('style.colorByField')]);if(kind==='line'||kind==='polygon')props.push(['weight',this.t('style.widthByField')]);props.push(['opacity',this.t('style.opacityByField')]);if(kind==='point'){props.push(['radius',this.t('style.sizeByField')]);props.push(['symbol',this.t('style.symbolByField')]);}
    h+='<div style="margin-top:12px"><b>'+esc(this.t('style.attributeStyle'))+'</b></div>'+props.map(([p,label])=>'<div class="ddc_meko-btnrow" style="justify-content:space-between"><span>'+esc(label)+'<br><small>'+summary(p)+'</small></span><button class="ddc_meko-btn" data-style-prop="'+p+'">'+esc(this.t('style.configure'))+'</button></div>').join('');
    h+='<div class="ddc_meko-btnrow"><button class="ddc_meko-btn" data-show-legend>'+esc(this.t('style.legend'))+'</button></div>';
    this._modal(this.t('layer.styleTitle',{name:l.name}),h,[{text:this.t('common.save'),primary:true,fn:()=>{l.style=l.style||{};l.style.color=this.modalWrap.querySelector('#ddcStyleColor').value;l.style.weight=Number(this.modalWrap.querySelector('#ddcStyleWeight')?.value)||l.style.weight||3;l.style.radius=Number(this.modalWrap.querySelector('#ddcStyleRadius')?.value)||l.style.radius||6;l.style.opacity=Number(this.modalWrap.querySelector('#ddcStyleOpacity').value);l.style.labelField=this.modalWrap.querySelector('#ddcLabelField').value||null;this._renderLayer(l);this._syncProject();this._setDirty?.('style');this._closeModal();}},{text:this.t('common.cancel'),fn:()=>this._closeModal()}],{wide:true});
    this.modalWrap.querySelectorAll('[data-style-prop]').forEach(b=>b.onclick=()=>this._configureStyleProperty(l,b.dataset.styleProp));this.modalWrap.querySelector('[data-show-legend]').onclick=()=>this.showLayerLegend(l.id);
  },
  _configureStyleProperty(layer,prop,forcedField=null,backFn=null){
    const old=JSON.parse(JSON.stringify(layer.style?.rules?.[prop]||{}));const fields=(layer.schema||[]).slice();if(!fields.length){this.toast(this.t('style.noCompatibleField'));return;}
    let selected=forcedField&&fields.some(f=>f.name===forcedField)?forcedField:(old.field&&fields.some(f=>f.name===old.field)?old.field:fields[0].name);
    const fieldType=()=>{const f=fields.find(x=>x.name===selected);return ['Integer','Double','Float','Number'].includes(f?.type)?'numeric':'categorical';};
    const distinct=field=>{const set=new Set();(layer.fc.features||[]).forEach(f=>{const v=f.properties?.[field];if(v!==null&&v!==undefined&&v!=='')set.add(String(v));});return[...set].slice(0,200);};
    const render=()=>{
      const type=fieldType();const cur=(old.field===selected&&old.fieldType===type)?old:{field:selected,fieldType:type,groups:[]};
      const hint=distinct(selected).slice(0,40).join(', ');
      let body='<label class="ddc_meko-field"><span>'+esc(this.t('style.field'))+'</span><select id="ddcRuleField">'+fields.map(f=>'<option value="'+esc(f.name)+'" '+(f.name===selected?'selected':'')+'>'+esc(f.alias||f.name)+'</option>').join('')+'</select></label><div class="ddc_meko-warning">'+esc(this.t(type==='numeric'?'style.numericHelp':'style.categoryHelp'))+'<br><small>'+esc(hint)+'</small></div><div id="ddcRuleRows"></div><div class="ddc_meko-btnrow"><button class="ddc_meko-btn" data-add-rule>＋ '+esc(this.t('style.addGroup'))+'</button><button class="ddc_meko-btn danger" data-clear-rule>'+esc(this.t('style.clearRule'))+'</button></div>';
      this._modal(this.t('style.ruleTitle',{property:prop,name:layer.name}),body,[{text:this.t('common.save'),primary:true,fn:()=>save()},{text:this.t('common.back'),fn:()=>backFn?backFn():this.configureStyle()}],{wide:true});
      const host=this.modalWrap.querySelector('#ddcRuleRows');
      const addRow=g=>{const row=document.createElement('div');row.className='ddc_meko-btnrow';row.style.alignItems='end';if(type==='numeric')row.innerHTML='<label class="ddc_meko-field" style="flex:1"><span>Min</span><input data-min type="number" step="any" value="'+esc(g?.min??'')+'"></label><label class="ddc_meko-field" style="flex:1"><span>Max</span><input data-max type="number" step="any" value="'+esc(g?.max??'')+'"></label><label class="ddc_meko-field" style="flex:1"><span>'+esc(this.t('style.styleValue'))+'</span>'+this._styleValueControl(prop,g?.value)+'</label><button class="ddc_meko-btn danger" data-remove>×</button>';
        else row.innerHTML='<label class="ddc_meko-field" style="flex:2"><span>'+esc(this.t('style.valuesComma'))+'</span><input data-values value="'+esc((g?.values||[]).join(', '))+'"></label><label class="ddc_meko-field" style="flex:1"><span>'+esc(this.t('style.styleValue'))+'</span>'+this._styleValueControl(prop,g?.value)+'</label><button class="ddc_meko-btn danger" data-remove>×</button>';
        row.querySelector('[data-remove]').onclick=()=>row.remove();host.appendChild(row);};
      (cur.groups||[]).forEach(addRow);if(!(cur.groups||[]).length)addRow({});
      this.modalWrap.querySelector('[data-add-rule]').onclick=()=>addRow({});this.modalWrap.querySelector('[data-clear-rule]').onclick=()=>{host.innerHTML='';};
      this.modalWrap.querySelector('#ddcRuleField').disabled=!!forcedField;this.modalWrap.querySelector('#ddcRuleField').onchange=e=>{if(forcedField)return;selected=e.target.value;old.field=null;render();};
      const save=()=>{const rule={field:selected,fieldType:type,groups:[]};host.querySelectorAll('.ddc_meko-btnrow').forEach(row=>{const val=row.querySelector('[data-style-value]')?.value;if(type==='numeric'){const mi=row.querySelector('[data-min]').value,ma=row.querySelector('[data-max]').value;if(mi===''&&ma===''&&val==='')return;rule.groups.push({min:mi===''?null:Number(mi),max:ma===''?null:Number(ma),value:prop==='color'||prop==='symbol'?val:Number(val)});}else{const vals=row.querySelector('[data-values]').value.split(',').map(x=>x.trim()).filter(Boolean);if(!vals.length)return;rule.groups.push({values:vals,value:prop==='color'||prop==='symbol'?val:Number(val)});}});const check=this._validateStyleRuleSet(rule);if(!check.ok){this.toast(check.message,5000);return;}layer.style=layer.style||{};layer.style.rules=layer.style.rules||{};if(rule.groups.length)layer.style.rules[prop]=rule;else delete layer.style.rules[prop];this._renderLayer(layer);this._syncProject();this._setDirty?.('style-rule');if(backFn)backFn();else this.configureStyle();};
    };render();
  },
  showLayerLegend(layerId){
    const l=this.getLayer(layerId)||this.getActiveLayer();if(!l)return;const rules=l.style?.rules||{};let h='';Object.entries(rules).forEach(([prop,r])=>{h+='<div style="margin-bottom:12px"><b>'+esc(prop)+' ← '+esc(r.field)+'</b>';if(r.fieldType==='numeric')r.groups.forEach(g=>h+='<div style="padding:4px 0">'+esc((g.min??'-∞')+' – '+(g.max??'∞'))+' → '+esc(g.value)+'</div>');else r.groups.forEach(g=>h+='<div style="padding:4px 0">'+esc((g.values||[]).join(', '))+' → '+esc(g.value)+'</div>');h+='</div>';});if(!h)h='<div class="ddc_meko-empty">'+esc(this.t('style.noRules'))+'</div>';this._modal(this.t('style.legendTitle',{name:l.name}),h,[{text:this.t('common.back'),fn:()=>this.configureStyle()}]);
  }
});
