// Module: layers/field-manager.js - Fields kiểu ArcGIS: Add/Delete field, alias, visible, editable.
// Nạp SAU layers/layer-manager.js (ghi đè configureFields).
CORE_MESSAGES_VI.fields={
  help:'Alias, Hiện, Sửa được lưu khi bấm Lưu. Thêm/Xóa field áp dụng ngay (có thể Undo).',
  addField:'Thêm field',add:'Thêm',deleteField:'Xóa field',colDef:'Định nghĩa',allVisible:'Hiện/ẩn tất cả',
  name:'Tên field',length:'Độ dài',decimals:'Số lẻ',alias:'Alias (tùy chọn)',
  types:{String:'Text',Integer:'Số nguyên',Double:'Số thực',Date:'Ngày',Boolean:'Đúng/Sai'},
  invalidName:'Tên field chỉ gồm chữ, số, dấu _; bắt đầu bằng chữ hoặc _; tối đa 10 ký tự (giới hạn Shapefile).',
  duplicate:'Field “{name}” đã tồn tại (không phân biệt hoa/thường).',
  added:'Đã thêm field {name}.',deleted:'Đã xóa field {name}.',
  confirmDelete:'Xóa field “{name}” và toàn bộ dữ liệu của field này trong {count} đối tượng?',
  usedBy:'Field đang được dùng bởi: {refs}. Các cấu hình này sẽ bị gỡ.',
  refLabel:'nhãn',refStyle:'symbology',refEpanet:'EPANET mapping'
};

(function(){
  const FIELD_TYPES={
    String:{dbfType:'C',length:80,decimals:0},
    Integer:{dbfType:'N',length:10,decimals:0},
    Double:{dbfType:'N',length:18,decimals:6},
    Date:{dbfType:'D',length:8,decimals:0},
    Boolean:{dbfType:'L',length:1,decimals:0}
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  Object.assign(WaterMapCore.prototype,{
    configureFields(layerId){
      const l=this.getLayer(layerId)||this.getActiveLayer();if(!l)return;this.activeLayerId=l.id;l.schema=l.schema||[];
      const T=(k,p)=>this.t('fields.'+k,p);
      const def=f=>f.type==='String'?'String ('+(f.length||80)+')':f.type==='Double'?'Double ('+(f.length||18)+','+(f.decimals??6)+')':(f.type||'String');
      const collect=()=>{
        this.modalWrap.querySelectorAll('tr[data-i]').forEach(r=>{
          const f=l.schema[Number(r.dataset.i)];if(!f)return;
          f.alias=r.querySelector('[data-k=alias]').value.trim()||f.name;
          f.visible=r.querySelector('[data-k=visible]').checked;
          f.editable=r.querySelector('[data-k=editable]').checked;
        });
        this._syncProject();this._setDirty?.('fields');
      };
      const reopen=()=>this.configureFields(l.id);
      let h='<div class="ddc_meko-warning" style="margin-bottom:8px">'+esc(T('help'))+'</div>'
        +'<div class="ddc_meko-btnrow"><button class="ddc_meko-btn" data-add>＋ '+esc(T('addField'))+'</button></div>'
        +'<div class="ddc_meko-table-wrap"><table class="ddc_meko-table"><thead><tr><th>'+esc(this.t('layer.field'))+'</th><th>'+esc(this.t('layer.alias'))+'</th><th>'+esc(T('colDef'))+'</th>'
        +'<th><label title="'+esc(T('allVisible'))+'"><input type="checkbox" data-all-visible> '+esc(this.t('layer.visible'))+'</label></th><th>'+esc(this.t('layer.editable'))+'</th><th>Style</th><th></th></tr></thead><tbody>';
      l.schema.forEach((f,i)=>{h+='<tr data-i="'+i+'"><td><b>'+esc(f.name)+'</b></td><td><input data-k="alias" value="'+esc(f.alias||f.name)+'"></td><td>'+esc(def(f))+'</td>'
        +'<td><input data-k="visible" type="checkbox" '+(f.visible!==false?'checked':'')+'></td><td><input data-k="editable" type="checkbox" '+(f.editable!==false?'checked':'')+'></td>'
        +'<td><button class="ddc_meko-btn" data-style="'+esc(f.name)+'">⚙</button></td>'
        +'<td><button class="ddc_meko-btn danger" data-del="'+i+'" title="'+esc(T('deleteField'))+'">🗑</button></td></tr>';});
      h+='</tbody></table></div>';
      this._modal(this.t('layer.fieldsTitle',{name:l.name}),h,[
        {text:this.t('common.save'),primary:true,fn:()=>{collect();this._closeModal();}},
        {text:this.t('common.cancel'),fn:()=>this._closeModal()}
      ],{wide:true});
      const q=s=>this.modalWrap.querySelector(s),qa=s=>[...this.modalWrap.querySelectorAll(s)];
      const allV=q('[data-all-visible]');
      if(allV){allV.checked=l.schema.length>0&&l.schema.every(f=>f.visible!==false);allV.onchange=()=>qa('[data-k=visible]').forEach(c=>c.checked=allV.checked);}
      q('[data-add]').onclick=()=>{collect();this._showAddFieldDialog(l,reopen);};
      qa('[data-style]').forEach(b=>b.onclick=e=>{e.stopPropagation();collect();this._showFieldStyleChooser(l,b.dataset.style,reopen);});
      qa('[data-del]').forEach(b=>b.onclick=()=>{collect();this._deleteField(l,Number(b.dataset.del),reopen);});
    },

    _showAddFieldDialog(l,back){
      const T=(k,p)=>this.t('fields.'+k,p);
      const opts=Object.keys(FIELD_TYPES).map(k=>'<option value="'+k+'">'+esc(T('types.'+k))+'</option>').join('');
      const h='<label class="ddc_meko-field"><span>'+esc(T('name'))+'</span><input id="ddcFldName" maxlength="10" autocomplete="off"></label>'
        +'<label class="ddc_meko-field"><span>'+esc(this.t('layer.type'))+'</span><select id="ddcFldType">'+opts+'</select></label>'
        +'<label class="ddc_meko-field"><span>'+esc(T('length'))+'</span><input id="ddcFldLen" type="number" min="1" max="254"></label>'
        +'<label class="ddc_meko-field"><span>'+esc(T('decimals'))+'</span><input id="ddcFldDec" type="number" min="0" max="15"></label>'
        +'<label class="ddc_meko-field"><span>'+esc(T('alias'))+'</span><input id="ddcFldAlias"></label>';
      const submit=()=>{
        const q=s=>this.modalWrap.querySelector(s);
        const name=q('#ddcFldName').value.trim(),type=q('#ddcFldType').value,td=FIELD_TYPES[type];
        if(!/^[A-Za-z_][A-Za-z0-9_]{0,9}$/.test(name)){this.toast(T('invalidName'),5000);return;}
        if((l.schema||[]).some(f=>String(f.name).toLowerCase()===name.toLowerCase())){this.toast(T('duplicate',{name}),4000);return;}
        let length=td.length,decimals=td.decimals;
        if(type==='String')length=clamp(Math.round(Number(q('#ddcFldLen').value))||td.length,1,254);
        if(type==='Double'){length=clamp(Math.round(Number(q('#ddcFldLen').value))||td.length,3,20);decimals=clamp(Math.round(Number(q('#ddcFldDec').value))||0,0,Math.min(15,length-2));}
        const alias=q('#ddcFldAlias').value.trim()||name;
        this._pushUndo();
        l.schema.push({name,type,dbfType:td.dbfType,length,decimals,visible:true,editable:true,required:false,alias});
        (l.fc.features||[]).forEach(x=>{x.properties=x.properties||{};x.properties[name]=null;});
        this._syncProject();this._setDirty?.('fields');this.toast(T('added',{name}));back();
      };
      this._modal(T('addField'),h,[{text:T('add'),primary:true,fn:submit},{text:this.t('common.back'),fn:()=>back()}]);
      const q=s=>this.modalWrap.querySelector(s);
      const sync=()=>{const t=q('#ddcFldType').value,d=FIELD_TYPES[t];q('#ddcFldLen').value=d.length;q('#ddcFldDec').value=d.decimals;q('#ddcFldLen').disabled=!(t==='String'||t==='Double');q('#ddcFldDec').disabled=t!=='Double';};
      q('#ddcFldType').onchange=sync;sync();q('#ddcFldName').focus();
    },

    _fieldReferences(l,name){
      const refs=[],S=l.style||{};
      if(S.labelField===name)refs.push(this.t('fields.refLabel'));
      if(S.renderer?.field===name||Object.values(S.rules||{}).some(r=>r?.field===name))refs.push(this.t('fields.refStyle'));
      if(Object.values(l.epanetMapping||{}).includes(name))refs.push(this.t('fields.refEpanet'));
      return refs;
    },

    _deleteField(l,idx,back){
      const f=l.schema[idx];if(!f)return;const name=f.name,refs=this._fieldReferences(l,name);
      let msg=this.t('fields.confirmDelete',{name,count:(l.fc.features||[]).length});
      if(refs.length)msg+='\n\n'+this.t('fields.usedBy',{refs:refs.join(', ')});
      if(!confirm(msg))return;
      this._pushUndo();
      l.schema.splice(idx,1);
      (l.fc.features||[]).forEach(x=>{if(x.properties)delete x.properties[name];});
      const S=l.style=l.style||{};
      if(S.labelField===name)S.labelField=null;
      if(S.renderer?.field===name)delete S.renderer;
      Object.keys(S.rules||{}).forEach(p=>{if(S.rules[p]?.field===name)delete S.rules[p];});
      Object.keys(l.epanetMapping||{}).forEach(k=>{if(l.epanetMapping[k]===name)delete l.epanetMapping[k];});
      this._renderLayer(l);this._syncProject();this._setDirty?.('fields');
      this.toast(this.t('fields.deleted',{name}));back();
    },

    // Dùng cho panel Thuộc tính: tôn trọng alias + visible của Fields.
    _featureAttrRowsHtml(layer,f){
      const props=f.properties||{},sch=layer.schema||[];
      const list=sch.length?sch.filter(s=>s.visible!==false):Object.keys(props).map(k=>({name:k}));
      return list.map(s=>'<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #edf1f3"><span style="color:#6a7a8b;min-width:90px">'+esc(s.alias||s.name)+'</span><span>'+esc(props[s.name])+'</span></div>').join('');
    }
  });
})();