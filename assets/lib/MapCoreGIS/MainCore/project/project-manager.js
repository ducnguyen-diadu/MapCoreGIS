// Module: project/project-manager.js
Object.assign(WaterMapCore.prototype, {
  _syncProject(){this.project.updatedAt=nowIso();this.project.lastUsedAt=nowIso();this.project.ui=this.project.ui||{};this.project.ui.locale=this.locale;this.project.layers=this.layers.map(l=>({id:l.id,name:l.name,geometryType:l.geometryType,fc:l.fc,schema:l.schema,style:l.style,visible:l.visible,sourceCRS:l.sourceCRS,workingCRS:l.workingCRS,epanetRole:l.epanetRole,epanetMapping:l.epanetMapping,direction:l.direction,clustering:l.clustering,originalFiles:l.originalFiles}));this._refreshLayerPanelIfOpen?.();},
  async _projectBlob(){if(!global.JSZip)throw new Error('Save .mks cần JSZip');this._syncProject();this.project.thumbnail=await this._makeThumbnail();const zip=new JSZip();zip.file('manifest.json',JSON.stringify({format:FORMAT,version:MKS_VERSION,projectId:this.project.projectId,name:this.project.name,createdAt:this.project.createdAt,updatedAt:this.project.updatedAt},null,2));zip.file('project.json',JSON.stringify(this.project,null,2));if(this.project.thumbnail){const b64=this.project.thumbnail.split(',')[1];zip.file('thumbnail.png',b64,{base64:true});}return zip.generateAsync({type:'blob',compression:'DEFLATE'});},
  async _makeThumbnail(){
      try{
        const W=320,H=180,pad=10,all={type:'FeatureCollection',features:this.layers.flatMap(l=>l.fc.features||[])};const b=bboxFC(all);if(!b)return null;
        const minY=b[0][0],minX=b[0][1],maxY=b[1][0],maxX=b[1][1],dx=Math.max(maxX-minX,1e-9),dy=Math.max(maxY-minY,1e-9);
        const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#eef4f6';x.fillRect(0,0,W,H);
        const pt=(co)=>[pad+(co[0]-minX)/dx*(W-pad*2),H-pad-(co[1]-minY)/dy*(H-pad*2)];
        const drawCoords=(coords,kind,color)=>{x.strokeStyle=color;x.fillStyle=color;x.lineWidth=2;const line=arr=>{x.beginPath();arr.forEach((q,i)=>{const p=pt(q);i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]);});if(kind==='polygon'){x.closePath();x.globalAlpha=.22;x.fill();x.globalAlpha=1;}x.stroke();};if(kind==='point'){const p=pt(coords);x.beginPath();x.arc(p[0],p[1],3,0,Math.PI*2);x.fill();}else if(typeof coords[0][0]==='number')line(coords);else coords.forEach(a=>typeof a[0][0]==='number'?line(a):a.forEach(line));};
        this.layers.forEach(l=>{const color=l.style?.color||'#0b8ea6';(l.fc.features||[]).slice(0,12000).forEach(f=>{if(f.geometry)drawCoords(f.geometry.coordinates,geomKind(f.geometry.type),color);});});
        return c.toDataURL('image/png',.72);
      }catch(e){return null;}
    },
  async saveProject(name){
      if(name)this.project.name=name;if(this.project.name==='Untitled'){const n=prompt(this.t('project.namePrompt'),this.project.name);if(n)this.project.name=n;}
      const blob=await this._projectBlob();this.project.lastUsedAt=nowIso();const auth=!!this.config.storage.isAuthenticated?.();
      const rec={projectId:this.project.projectId,name:this.project.name,updatedAt:this.project.updatedAt,lastUsedAt:this.project.lastUsedAt,layerCount:this.layers.length,thumbnail:this.project.thumbnail,blob,persistent:auth};
      await this.store.put(rec);
      if(auth&&typeof this.config.storage.saveProject==='function')await this.config.storage.saveProject({project:this.project,blob,metadata:rec});
      if(this._fileHandle){const w=await this._fileHandle.createWritable();await w.write(blob);await w.close();}
      else if(global.showSaveFilePicker){try{const handle=await showSaveFilePicker({suggestedName:this.project.name+'.mks',types:[{description:'WaterMapCore project',accept:{'application/octet-stream':['.mks']}}]});const w=await handle.createWritable();await w.write(blob);await w.close();this._fileHandle=handle;}catch(e){if(e.name!=='AbortError')throw e;}}
      else downloadBlob(this.project.name+'.mks',blob);
      this._markClean?.();this.emit('project:saved',{project:this.project});this.toast(this.t('project.saved'));
    },
  async saveAs(){this._fileHandle=null;return this.saveProject();},
  async openMksFile(file,opt={}){
      if(!global.JSZip)throw new Error('Open .mks cần JSZip');
      if(!opt.skipConfirm){const choice=await this._confirmProjectSwitch?.();if(choice==='cancel')return false;}
      this._activateWorkspace();const zip=await JSZip.loadAsync(await file.arrayBuffer());const text=await zip.file('project.json').async('text');const p=JSON.parse(text);
      if(p.format!==FORMAT)throw new Error('Không đúng định dạng MKS');if(p.version>MKS_VERSION)throw new Error('File MKS mới hơn phiên bản Core hiện tại');
      this._resetWorkspaceForProjectSwitch?.();this.loadProjectObject(p,{alreadyReset:true});
      await this.store.put({projectId:p.projectId,name:p.name,updatedAt:p.updatedAt,lastUsedAt:nowIso(),layerCount:p.layers.length,thumbnail:p.thumbnail,blob:file,persistent:!!this.config.storage.isAuthenticated?.()});return true;
    },
  loadProjectObject(p,opt={}){this._activateWorkspace();if(!opt.alreadyReset)this.clearLayers(false);this.project=p;if(!this._localeExplicit&&p.ui?.locale)this.setLocale(p.ui.locale,{silent:true});p.lastUsedAt=nowIso();(p.layers||[]).forEach(x=>this._addLayerRecord(x));this.undoStack=[];this.redoStack=[];this.selection=[];this.selected=null;this.editSessionActive=false;this._markClean?.();this._scheduleFocusLoadedData(p.map);this.emit('project:opened',{project:p});},
  async _startNewProjectFromShape(startup=false){
      const choice=await this._confirmProjectSwitch?.();if(choice==='cancel')return;
      this._resetWorkspaceForProjectSwitch?.();this.project=this._newProject();this._markClean?.();this._activateWorkspace();this.showImport(startup,{append:false});
    },
  async showRecent(startup=false){
      await this._purgeGuest();
      const auth=!!this.config.storage.isAuthenticated?.();
      let rows=(await this.store.list()).map(r=>Object.assign({source:'local'},r));
      if(auth&&typeof this.config.storage.listProjects==='function'){
        try{const serverRows=await this.config.storage.listProjects();(serverRows||[]).forEach(r=>{const idx=rows.findIndex(x=>x.projectId===r.projectId);const sr=Object.assign({source:'server',persistent:true},r);if(idx>=0){const local=rows[idx];rows[idx]=new Date(sr.lastUsedAt||sr.updatedAt||0)>new Date(local.lastUsedAt||local.updatedAt||0)?Object.assign({},local,sr):local;rows[idx].source=local.source==='local'?'local+server':'server';}else rows.push(sr);});}catch(e){console.warn('WaterMapCore listProjects(server):',e);}
      }
      rows.sort((a,b)=>String(b.lastUsedAt||b.updatedAt||'').localeCompare(String(a.lastUsedAt||a.updatedAt||'')));
      let h='<div class="ddc_meko-start-title">'+esc(startup?this.t('recent.startup'):this.t('recent.title'))+'</div><div class="ddc_meko-import-actions" style="justify-content:flex-start;margin:0 0 12px"><button class="ddc_meko-btn primary" data-openmks>'+esc(this.t('recent.openMks'))+'</button><button class="ddc_meko-btn" data-newshape>'+esc(this.t('recent.importShape'))+'</button><input type="file" accept=".mks" hidden data-mksfile></div>';
      if(!rows.length)h+='<div class="ddc_meko-empty">'+esc(this.t('recent.empty'))+'</div>';
      else h+='<div class="ddc_meko-recent-grid">'+rows.map(r=>'<div class="ddc_meko-card" data-id="'+r.projectId+'" data-source="'+esc(r.source||'local')+'"><div class="ddc_meko-card-thumb" '+(r.thumbnail?'style="background-image:url('+r.thumbnail+')"':'')+'></div><div class="ddc_meko-card-body"><div class="ddc_meko-card-title">'+esc(r.name)+'</div><div class="ddc_meko-card-meta">'+(r.layerCount??'?')+' '+esc(this.t('recent.layer'))+' · '+esc(r.source||'local')+'<br>'+new Date(r.lastUsedAt||r.updatedAt).toLocaleString(this.locale==='en'?'en-US':'vi-VN')+'</div></div><button class="ddc_meko-card-menu" data-del="'+r.projectId+'">⋮</button></div>').join('')+'</div>';
      this._modal(startup?'WaterMapCore':this.t('recent.title'),h,startup?[]:[{text:this.t('common.close'),fn:()=>this._closeModal()}],{wide:true,closable:!startup});
      this.modalWrap.querySelector('[data-openmks]').onclick=()=>this.modalWrap.querySelector('[data-mksfile]').click();
      this.modalWrap.querySelector('[data-newshape]').onclick=()=>this._startNewProjectFromShape(startup);
      this.modalWrap.querySelector('[data-mksfile]').onchange=async e=>{if(e.target.files[0]){await this.openMksFile(e.target.files[0]);this._closeModal();}};
      this.modalWrap.querySelectorAll('.ddc_meko-card').forEach(c=>c.onclick=async e=>{if(e.target.dataset.del)return;let r=await this.store.get(c.dataset.id);if(r?.blob){const f=new File([r.blob],(r.name||'project')+'.mks');await this.openMksFile(f);this._closeModal();return;}if(auth&&typeof this.config.storage.loadProject==='function'){const sv=await this.config.storage.loadProject(c.dataset.id);if(sv instanceof Blob){await this.openMksFile(new File([sv],(c.dataset.id)+'.mks'));}else if(sv?.blob instanceof Blob){await this.openMksFile(new File([sv.blob],(sv.name||c.dataset.id)+'.mks'));}else if(sv?.project||sv?.format===FORMAT){const choice=await this._confirmProjectSwitch?.();if(choice==='cancel')return;this._resetWorkspaceForProjectSwitch?.();this.loadProjectObject(sv.project||sv,{alreadyReset:true});}this._closeModal();}});
      this.modalWrap.querySelectorAll('[data-del]').forEach(b=>b.onclick=async e=>{e.stopPropagation();if(!confirm(this.t('recent.removeConfirm')))return;await this.store.del(b.dataset.del);if(auth&&typeof this.config.storage.deleteProject==='function'){try{await this.config.storage.deleteProject(b.dataset.del);}catch(err){console.warn(err);}}this.showRecent();});
    },
  async _purgeGuest(){try{const rows=await this.store.list();const auth=!!this.config.storage.isAuthenticated?.();if(auth)return;const limit=(this.config.storage.guestRetentionDays||7)*86400000,now=Date.now();for(const r of rows){if(!r.persistent&&now-new Date(r.lastUsedAt).getTime()>limit)await this.store.del(r.projectId);}}catch(e){}}
});
