// Module: adapters/shapefile-import.js
Object.assign(WaterMapCore.prototype, {
  async showImport(startup=false){const h='<div class="ddc_meko-drop">'+esc(this.t('import.choose'))+'<div class="ddc_meko-import-actions"><button class="ddc_meko-btn primary" data-i="files">'+esc(this.t('import.files'))+'</button><button class="ddc_meko-btn" data-i="zip">'+esc(this.t('import.zip'))+'</button></div><input data-f="files" type="file" multiple accept=".shp" hidden><input data-f="zip" type="file" accept=".zip,application/zip" hidden></div><div id="ddcImportResult" style="margin-top:10px"></div>';this._modal(this.t('import.title'),h,[{text:startup?this.t('common.back'):this.t('common.close'),fn:()=>{this._closeModal();if(startup&&!this.workspaceVisible)this.showRecent(true);}}]);['files','zip'].forEach(k=>{this.modalWrap.querySelector('[data-i='+k+']').onclick=()=>this.modalWrap.querySelector('[data-f='+k+']').click();this.modalWrap.querySelector('[data-f='+k+']').onchange=async e=>{try{const fs=[...e.target.files];await this.importFiles(fs,k==='zip');this._closeModal();}catch(err){this.toast(err.message,4000);}};});},
  async importFiles(files,isZip=false){
      if(!global.JSZip||!global.shp)throw new Error('Import cần JSZip và shpjs');
      this._activateWorkspace();
      this._pushUndo();
  
      const errors=[];
      let successCount=0;
  
      const importGroups=async(groups)=>{
        console.log('[WaterMapCore] Found groups:',groups.length,groups.map(g=>g.name));
  
        for(const g of groups){
          try{
            console.log('[WaterMapCore] Importing:',g.name,Object.keys(g.files||{}));
            await this._importGroup(g);
            successCount++;
            console.log('[WaterMapCore] Imported OK:',g.name);
          }catch(err){
            console.error('[WaterMapCore] Import FAILED:',g.name,err);
            errors.push({layer:g.name,error:err?.message||String(err)});
          }
        }
      };
  
      if(isZip){
        for(const file of files){
          try{
            const ab=await file.arrayBuffer();
            const zip=await JSZip.loadAsync(ab);
            const groups=await this._groupsFromZip(zip);
            await importGroups(groups);
          }catch(err){
            console.error('[WaterMapCore] ZIP FAILED:',file?.name||'(zip)',err);
            errors.push({layer:file?.name||'(zip)',error:err?.message||String(err)});
          }
        }
      }else{
        const groups=this._groupFiles(files);
        await importGroups(groups);
      }
  
      this._syncProject();
      this._scheduleFocusLoadedData();
  
      if(errors.length){
        console.table(errors);
        this.toast(this.t('import.partial',{ok:successCount,errors:errors.length}),7000);
        this.emit('import:completed',{successCount,errors,layers:this.getLayers()});
      }else{
        this.toast(this.t('import.success',{count:successCount}));
        this.emit('import:completed',{successCount,errors:[],layers:this.getLayers()});
      }
  
      return{successCount,errors,layers:this.getLayers()};
    },
  _groupFiles(files){const m=new Map();files.forEach(f=>{const n=f.webkitRelativePath||f.name;const file=n.split('/').pop();const idx=file.toLowerCase().lastIndexOf('.shp.xml');let base,ext;if(idx>0){base=file.slice(0,idx);ext='shp.xml';}else{const p=file.lastIndexOf('.');if(p<0)return;base=file.slice(0,p);ext=file.slice(p+1).toLowerCase();}const key=(n.includes('/')?n.slice(0,n.lastIndexOf('/')+1):'')+base;const g=m.get(key)||{name:base,files:{}};g.files[ext]=f;m.set(key,g);});return[...m.values()].filter(g=>g.files.shp);},
  async _groupsFromZip(zip){const tmp=[];for(const [path,zf] of Object.entries(zip.files)){if(zf.dir)continue;const file=path.split('/').pop();const p=file.lastIndexOf('.');if(p<0)continue;tmp.push(new File([await zf.async('blob')],file));}return this._groupFiles(tmp);},
  async _importGroup(g){
      const z=new JSZip();
      let shpBuffer=null;
      for(const [ext,f] of Object.entries(g.files)){
        const buf=await f.arrayBuffer();
        z.file(g.name+'.'+ext,buf);
        if(ext==='shp')shpBuffer=buf;
      }
      let fc;
      if(g.files.dbf||g.files.prj||g.files.shx){
        const ab=await z.generateAsync({type:'arraybuffer'});
        let parsed=await global.shp(ab);
        if(Array.isArray(parsed))parsed=parsed.find(x=>(x.fileName||'').toLowerCase()===g.name.toLowerCase())||parsed[0];
        fc=normalizeFC(parsed,g.name);
      }else if(global.shp.parseShp&&shpBuffer){
        const geoms=global.shp.parseShp(shpBuffer)||[];
        fc={type:'FeatureCollection',features:geoms.map((geometry,i)=>({type:'Feature',id:String(i+1),properties:{},geometry}))};
      }else{
        let parsed=await global.shp(shpBuffer);
        fc=normalizeFC(parsed,g.name);
      }
      let schema=[];
      if(g.files.dbf)schema=parseDbfSchema(await g.files.dbf.arrayBuffer());
      if(!schema.length)schema=inferSchema(fc);
      let prj='';
      if(g.files.prj)prj=await g.files.prj.text();
      const sourceCRS=/4326|WGS_?1984|WGS ?84/i.test(prj)?'EPSG:4326':(prj||'unknown');
      const originals={};
      for(const [ext,f] of Object.entries(g.files))originals[ext]={name:f.name,size:f.size,lastModified:f.lastModified};
      const geometryType=this._detectGeometryTypeFromShp(shpBuffer)||fc.features?.find(f=>f.geometry)?.geometry?.type||'Unknown';
      this._addLayerRecord({name:g.name,fc,schema,sourceCRS,geometryType,originalFiles:originals});
    },
  _detectGeometryTypeFromShp(buf){
      if(!buf||buf.byteLength<36)return null;
      try{
        const t=new DataView(buf).getInt32(32,true);
        if([1,8,11,18,21,28].includes(t))return t===8||t===18||t===28?'MultiPoint':'Point';
        if([3,13,23].includes(t))return'LineString';
        if([5,15,25,31].includes(t))return'Polygon';
      }catch(e){}
      return null;
    }
});
