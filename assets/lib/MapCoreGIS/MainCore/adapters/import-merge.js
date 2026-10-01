// Module: adapters/import-merge.js
// Enhances Shapefile import: one visible layer per .shp and append/merge into existing layers.
Object.assign(WaterMapCore.prototype, {
  _groupFiles(files){
    const m=new Map();
    (files||[]).forEach(f=>{
      const n=f.webkitRelativePath||f.name||'';const file=n.split('/').pop();if(!file)return;
      const low=file.toLowerCase();let base,ext;
      if(low.endsWith('.shp.xml')){base=file.slice(0,-8);ext='shp.xml';}
      else{const p=file.lastIndexOf('.');if(p<0)return;base=file.slice(0,p);ext=file.slice(p+1).toLowerCase();}
      const dir=n.includes('/')?n.slice(0,n.lastIndexOf('/')+1):'';
      const key=(dir+base).toLowerCase();const g=m.get(key)||{name:base,path:dir,files:{}};g.files[ext]=f;m.set(key,g);
    });
    return [...m.values()].filter(g=>g.files.shp);
  },
  async _parseImportGroup(g){
    const z=new JSZip();let shpBuffer=null;
    for(const [ext,f] of Object.entries(g.files||{})){
      const buf=await f.arrayBuffer();z.file(g.name+'.'+ext,buf);if(ext==='shp')shpBuffer=buf;
    }
    const ab=await z.generateAsync({type:'arraybuffer'});let parsed=await global.shp(ab);
    if(Array.isArray(parsed))parsed=parsed.find(x=>(x.fileName||'').toLowerCase()===g.name.toLowerCase())||parsed[0];
    const fc=normalizeFC(parsed,g.name);let schema=[];
    if(g.files.dbf)schema=parseDbfSchema(await g.files.dbf.arrayBuffer());if(!schema.length)schema=inferSchema(fc);
    let prj='';if(g.files.prj)prj=await g.files.prj.text();
    const sourceCRS=/4326|WGS_?1984|WGS ?84/i.test(prj)?'EPSG:4326':(prj||'unknown');
    const originals={};for(const [ext,f] of Object.entries(g.files||{}))originals[ext]={name:f.name,size:f.size,lastModified:f.lastModified};
    const geometryType=this._detectGeometryTypeFromShp(shpBuffer)||fc.features?.find(f=>f.geometry)?.geometry?.type||'Unknown';
    return{name:g.name,fc,schema,sourceCRS,geometryType,originalFiles:originals};
  },
  async _importGroup(g){
    const rec=await this._parseImportGroup(g);
    const existing=this.layers.find(l=>String(l.name).toLowerCase()===String(rec.name).toLowerCase());
    if(!existing){this._addLayerRecord(rec);this._setDirty?.('import');return{action:'add-layer',layer:rec.name};}
    return this._mergeImportedLayer(existing,rec);
  },
  _mergeSchemaIntoLayer(layer,incomingSchema){
    const existing=new Set((layer.schema||[]).map(f=>String(f.name).toLowerCase()));
    (incomingSchema||[]).forEach(f=>{if(!existing.has(String(f.name).toLowerCase())){layer.schema.push(JSON.parse(JSON.stringify(f)));existing.add(String(f.name).toLowerCase());(layer.fc.features||[]).forEach(x=>{if(!(f.name in (x.properties||{}))){x.properties=x.properties||{};x.properties[f.name]=null;}});}});
  },
  _mergeStats(layer,rec,keyField){
    const oldMap=new Map();(layer.fc.features||[]).forEach(f=>{const v=f.properties?.[keyField];if(v!==null&&v!==undefined&&v!=='')oldMap.set(String(v),f);});
    let matched=0,fresh=0,empty=0;(rec.fc.features||[]).forEach(f=>{const v=f.properties?.[keyField];if(v===null||v===undefined||v===''){empty++;fresh++;}else if(oldMap.has(String(v)))matched++;else fresh++;});
    return{matched,fresh,empty,total:rec.fc.features.length,oldMap};
  },
  _askMergeOptions(layer,rec){
    const common=(rec.schema||[]).map(f=>f.name).filter(n=>(layer.schema||[]).some(x=>String(x.name).toLowerCase()===String(n).toLowerCase()));
    const preferred=['id','asset_id','pipe_id','serial','gid','fid'];
    common.sort((a,b)=>{const ai=preferred.indexOf(String(a).toLowerCase()),bi=preferred.indexOf(String(b).toLowerCase());return(ai<0?99:ai)-(bi<0?99:bi);});
    return new Promise(resolve=>{
      if(!common.length){
        const html='<div class="ddc_meko-warning">'+esc(this.t('import.noCommonKey'))+'</div>';
        this._modal(this.t('import.mergeTitle',{name:layer.name}),html,[
          {text:this.t('import.addAllAsNew'),primary:true,fn:()=>{this._closeModal();resolve({action:'all-new',key:null});}},
          {text:this.t('common.cancel'),fn:()=>{this._closeModal();resolve({action:'cancel'});}}
        ]);return;
      }
      const opts=common.map((n,i)=>'<option value="'+esc(n)+'" '+(i===0?'selected':'')+'>'+esc(n)+'</option>').join('');
      const fieldChecks=(rec.schema||[]).map(f=>'<label style="display:inline-flex;align-items:center;gap:5px;margin:3px 10px 3px 0"><input type="checkbox" data-update-field value="'+esc(f.name)+'" checked>'+esc(f.name)+'</label>').join('');
      const html='<label class="ddc_meko-field"><span>'+esc(this.t('import.keyField'))+'</span><select id="ddcMergeKey">'+opts+'</select></label><div id="ddcMergeStats" class="ddc_meko-warning" style="margin:8px 0"></div><label class="ddc_meko-field"><span>'+esc(this.t('import.action'))+'</span><select id="ddcMergeAction"><option value="update-add">'+esc(this.t('import.updateAdd'))+'</option><option value="new-only">'+esc(this.t('import.addNewOnly'))+'</option><option value="all-new">'+esc(this.t('import.addAllAsNew'))+'</option></select></label><details style="margin:8px 0"><summary>'+esc(this.t('import.advancedFields'))+'</summary><div style="padding:8px 0">'+fieldChecks+'</div></details><div class="ddc_meko-warning">'+esc(this.t('import.mergeWholeRecord'))+'</div>';
      this._modal(this.t('import.mergeTitle',{name:layer.name}),html,[
        {text:this.t('common.open'),primary:true,fn:()=>{const key=this.modalWrap.querySelector('#ddcMergeKey').value,action=this.modalWrap.querySelector('#ddcMergeAction').value,fields=[...this.modalWrap.querySelectorAll('[data-update-field]:checked')].map(x=>x.value);this._closeModal();resolve({action,key,fields});}},
        {text:this.t('common.cancel'),fn:()=>{this._closeModal();resolve({action:'cancel'});}}
      ]);
      const update=()=>{const key=this.modalWrap.querySelector('#ddcMergeKey').value,s=this._mergeStats(layer,rec,key);this.modalWrap.querySelector('#ddcMergeStats').innerHTML='<b>'+esc(this.t('import.analysis'))+'</b><br>'+esc(this.t('import.existingMatch',{count:s.matched}))+'<br>'+esc(this.t('import.newRecords',{count:s.fresh}))+(s.empty?'<br>'+esc(this.t('import.emptyKey',{count:s.empty})):'');};
      this.modalWrap.querySelector('#ddcMergeKey').onchange=update;update();
    });
  },
  async _mergeImportedLayer(layer,rec){
    const choice=await this._askMergeOptions(layer,rec);if(!choice||choice.action==='cancel')return{action:'cancel',layer:layer.name};
    this._pushUndo();this._mergeSchemaIntoLayer(layer,rec.schema);
    if(choice.action==='all-new'){
      (rec.fc.features||[]).forEach(f=>{const c=JSON.parse(JSON.stringify(f));c.id=uuid();layer.fc.features.push(c);});
    }else{
      const stats=this._mergeStats(layer,rec,choice.key);const map=stats.oldMap;
      (rec.fc.features||[]).forEach(f=>{
        const val=f.properties?.[choice.key],old=(val===null||val===undefined||val==='')?null:map.get(String(val));
        if(old&&choice.action==='update-add'){
          const idx=layer.fc.features.findIndex(x=>String(x.id)===String(old.id));const c=JSON.parse(JSON.stringify(old));c.geometry=JSON.parse(JSON.stringify(f.geometry));c.properties=Object.assign({},old.properties||{});const fields=choice.fields?.length?choice.fields:Object.keys(f.properties||{});fields.forEach(k=>{c.properties[k]=f.properties?.[k];});c.id=old.id;if(idx>=0)layer.fc.features[idx]=c;
        }else if(!old){const c=JSON.parse(JSON.stringify(f));c.id=uuid();layer.fc.features.push(c);}
      });
    }
    layer.originalFiles=rec.originalFiles||layer.originalFiles;this._renderLayer(layer);this._syncProject();this._setDirty?.('import-merge');this.emit('layer:merged',{layer,choice});return{action:choice.action,layer:layer.name};
  },
  async showImport(startup=false,opt={}){
    const append=!!opt.append;
    const h='<div class="ddc_meko-drop">'+esc(this.t('import.choose'))+'<div class="ddc_meko-import-actions"><button class="ddc_meko-btn primary" data-i="files">'+esc(this.t('import.files'))+'</button><button class="ddc_meko-btn" data-i="folder">'+esc(this.t('import.folder'))+'</button><button class="ddc_meko-btn" data-i="zip">'+esc(this.t('import.zip'))+'</button></div><div class="ddc_meko-warning" style="margin-top:10px">'+esc(this.t('import.layerRepresentative'))+'</div><input data-f="files" type="file" multiple accept=".shp,.shx,.dbf,.prj,.cpg,.sbn,.sbx,.xml" hidden><input data-f="folder" type="file" webkitdirectory multiple accept=".shp" hidden><input data-f="zip" type="file" accept=".zip" hidden></div><div data-import-preview style="margin-top:10px"></div>';
    this._modal(append?this.t('import.appendTitle'):this.t('import.title'),h,[{text:startup?this.t('common.back'):this.t('common.close'),fn:()=>{this._closeModal();if(startup&&!this.workspaceVisible)this.showRecent(true);}}]);
    ['files','folder','zip'].forEach(k=>{
      this.modalWrap.querySelector('[data-i='+k+']').onclick=()=>this.modalWrap.querySelector('[data-f='+k+']').click();
      this.modalWrap.querySelector('[data-f='+k+']').onchange=async e=>{try{
        const fs=[...e.target.files];let names=[];
        if(k==='zip')names=fs.map(f=>f.name);else names=this._groupFiles(fs).map(g=>g.name+'.shp');
        const prev=this.modalWrap.querySelector('[data-import-preview]');if(prev)prev.innerHTML='<b>'+esc(this.t('import.layersDetected',{count:names.length}))+'</b><br>'+names.map(n=>'• '+esc(n)).join('<br>');
        await this.importFiles(fs,k==='zip');this._closeModal();
      }catch(err){console.error(err);this.toast(err.message,5000);}};
    });
  }
});
