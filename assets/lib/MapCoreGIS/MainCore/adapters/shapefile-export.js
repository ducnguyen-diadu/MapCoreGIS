// Module: adapters/shapefile-export.js
Object.assign(WaterMapCore.prototype, {
  async exportShapefile(){
      if(!global.shpwrite||!global.JSZip)throw new Error('Export cần shp-write và JSZip');
      const out=new JSZip();
      const exported=[];
  
      for(const l of this.layers){
        const featureCount=Array.isArray(l.fc?.features)?l.fc.features.length:0;
        if(featureCount===0){
          this._writeEmptyShapefile(out,l);
          exported.push(l.name);
          continue;
        }
  
        // shp-write 0.3.x sinh PolyLine SHP không ổn định với một số mạng lớn.
        // Với layer line, WaterMapCore tự ghi SHP/SHX/DBF để bảo đảm import ngược lại được.
        if(geomKind(l.geometryType)==='line'){
          this._writePolylineShapefile(out,l);
          exported.push(l.name);
          continue;
        }
  
        const opt={folder:l.name,types:{point:l.name,polyline:l.name,polygon:l.name}};
        let data;
        try{
          data=await Promise.resolve(global.shpwrite.zip(l.fc,opt));
        }catch(e){
          throw new Error('Không export được layer '+l.name+': '+(e?.message||e));
        }
  
        let z;
        try{
          if(typeof data==='string'){
            const raw=data.trim();
            const b64=raw.indexOf(',')>=0?raw.split(',').pop():raw;
            z=await JSZip.loadAsync(b64,{base64:true});
          }else if(data instanceof Blob){
            z=await JSZip.loadAsync(await data.arrayBuffer());
          }else if(data instanceof ArrayBuffer){
            z=await JSZip.loadAsync(data);
          }else if(ArrayBuffer.isView(data)){
            z=await JSZip.loadAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
          }else{
            throw new Error('shp-write trả về kiểu dữ liệu không hỗ trợ: '+Object.prototype.toString.call(data));
          }
        }catch(e){
          throw new Error('ZIP Shapefile của layer '+l.name+' không hợp lệ: '+(e?.message||e));
        }
  
        const byExt={};
        for(const [path,f] of Object.entries(z.files)){
          if(f.dir)continue;
          const sourceName=path.split('/').pop()||'';
          const m=sourceName.toLowerCase().match(/\.(shp|shx|dbf|prj)$/);
          if(!m)continue;
          const ext=m[1];
          if(byExt[ext])continue;
          byExt[ext]=await f.async('arraybuffer');
        }
  
        for(const ext of ['shp','shx','dbf']){
          if(!byExt[ext]||!byExt[ext].byteLength)throw new Error('Layer '+l.name+': export không tạo được file .'+ext);
          out.file(l.name+'.'+ext,byExt[ext]);
        }
        out.file(l.name+'.prj',byExt.prj||this._wgs84Prj());
        out.file(l.name+'.cpg','UTF-8');
        out.file(l.name+'.shp.xml',this._metadataXml(l));
        exported.push(l.name);
      }
  
      out.file('README_INDEX.txt','WaterMapCore export. Mỗi layer được xuất ở root ZIP. Layer 0 record vẫn có .shp/.shx/.dbf/.prj/.cpg/.shp.xml đầy đủ schema. .sbn/.sbx là spatial index Esri và không được tạo giả; ArcGIS/QGIS có thể rebuild index từ dữ liệu Shapefile.');
      const blob=await out.generateAsync({type:'blob',compression:'DEFLATE'});
      if(!blob||!blob.size)throw new Error('ZIP export rỗng');
      console.log('[WaterMapCore] Exported layers:',exported.length,exported);
      downloadBlob((this.project.name||'watermap')+'_shapefile.zip',blob);
      this.toast(this.t('export.success',{count:exported.length}));
    },
  _writePolylineShapefile(zip,l){
      const built=this._polylineBinary(l.fc?.features||[]);
      zip.file(l.name+'.shp',built.shp);
      zip.file(l.name+'.shx',built.shx);
      zip.file(l.name+'.dbf',this._dbfBinary(l.schema||[],l.fc?.features||[]));
      zip.file(l.name+'.prj',this._wgs84Prj());
      zip.file(l.name+'.cpg','UTF-8');
      zip.file(l.name+'.shp.xml',this._metadataXml(l));
    },
  _polylineBinary(features){
      const records=[];
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      const addPoint=(p)=>{
        if(!Array.isArray(p)||p.length<2)return;
        const x=Number(p[0]),y=Number(p[1]);
        if(!Number.isFinite(x)||!Number.isFinite(y))return;
        minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
      };
      const normalizeParts=(f)=>{
        const g=f?.geometry;
        if(!g)return[];
        if(g.type==='LineString')return [Array.isArray(g.coordinates)?g.coordinates:[]];
        if(g.type==='MultiLineString')return Array.isArray(g.coordinates)?g.coordinates:[];
        return[];
      };
      (features||[]).forEach((f)=>{
        const rawParts=normalizeParts(f);
        const parts=[];
        rawParts.forEach(part=>{
          const clean=(part||[]).filter(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1]))).map(p=>[Number(p[0]),Number(p[1])]);
          if(clean.length>=2){clean.forEach(addPoint);parts.push(clean);}
        });
        if(!parts.length){records.push({nullShape:true,contentBytes:4});return;}
        let rMinX=Infinity,rMinY=Infinity,rMaxX=-Infinity,rMaxY=-Infinity,numPoints=0;
        parts.forEach(part=>part.forEach(p=>{rMinX=Math.min(rMinX,p[0]);rMinY=Math.min(rMinY,p[1]);rMaxX=Math.max(rMaxX,p[0]);rMaxY=Math.max(rMaxY,p[1]);numPoints++;}));
        const numParts=parts.length;
        const contentBytes=4+32+4+4+(4*numParts)+(16*numPoints);
        records.push({nullShape:false,parts,numParts,numPoints,bbox:[rMinX,rMinY,rMaxX,rMaxY],contentBytes});
      });
      if(!Number.isFinite(minX)){minX=minY=maxX=maxY=0;}
      const shpBytes=100+records.reduce((n,r)=>n+8+r.contentBytes,0);
      const shxBytes=100+records.length*8;
      const shp=new ArrayBuffer(shpBytes),shx=new ArrayBuffer(shxBytes);
      const sv=new DataView(shp),xv=new DataView(shx);
      const writeHeader=(v,byteLen)=>{
        v.setInt32(0,9994,false);
        for(let o=4;o<=20;o+=4)v.setInt32(o,0,false);
        v.setInt32(24,byteLen/2,false);
        v.setInt32(28,1000,true);
        v.setInt32(32,3,true);
        v.setFloat64(36,minX,true);v.setFloat64(44,minY,true);v.setFloat64(52,maxX,true);v.setFloat64(60,maxY,true);
        v.setFloat64(68,0,true);v.setFloat64(76,0,true);v.setFloat64(84,0,true);v.setFloat64(92,0,true);
      };
      writeHeader(sv,shpBytes);writeHeader(xv,shxBytes);
      let shpPos=100,shxPos=100,offsetWords=50;
      records.forEach((r,idx)=>{
        const contentWords=r.contentBytes/2;
        // SHX stores the offset to the SHP record header, in 16-bit words.
        xv.setInt32(shxPos,offsetWords,false);xv.setInt32(shxPos+4,contentWords,false);shxPos+=8;
        sv.setInt32(shpPos,idx+1,false);sv.setInt32(shpPos+4,contentWords,false);
        let p=shpPos+8;
        if(r.nullShape){sv.setInt32(p,0,true);}
        else{
          sv.setInt32(p,3,true);p+=4;
          sv.setFloat64(p,r.bbox[0],true);sv.setFloat64(p+8,r.bbox[1],true);sv.setFloat64(p+16,r.bbox[2],true);sv.setFloat64(p+24,r.bbox[3],true);p+=32;
          sv.setInt32(p,r.numParts,true);sv.setInt32(p+4,r.numPoints,true);p+=8;
          let start=0;
          r.parts.forEach(part=>{sv.setInt32(p,start,true);p+=4;start+=part.length;});
          r.parts.forEach(part=>part.forEach(pt=>{sv.setFloat64(p,pt[0],true);sv.setFloat64(p+8,pt[1],true);p+=16;}));
        }
        shpPos+=8+r.contentBytes;
        offsetWords+=(8+r.contentBytes)/2;
      });
      return{shp,shx};
    },
  _dbfBinary(schema,features){
      const used=new Set();
      const fields=(schema||[]).map(f=>this._dbfFieldDef(f,used));
      const headerLen=32+fields.length*32+1;
      const recordLen=1+fields.reduce((s,f)=>s+f.length,0);
      const rows=Array.isArray(features)?features:[];
      const total=headerLen+(recordLen*rows.length)+1;
      const buf=new ArrayBuffer(total),v=new DataView(buf),u=new Uint8Array(buf);
      const d=new Date();u[0]=0x03;u[1]=d.getFullYear()-1900;u[2]=d.getMonth()+1;u[3]=d.getDate();
      v.setUint32(4,rows.length,true);v.setUint16(8,headerLen,true);v.setUint16(10,recordLen,true);
      fields.forEach((f,i)=>{const p=32+i*32;for(let j=0;j<Math.min(11,f.name.length);j++)u[p+j]=f.name.charCodeAt(j)&0x7F;u[p+11]=f.type.charCodeAt(0);u[p+16]=f.length;u[p+17]=f.decimals;});
      u[headerLen-1]=0x0D;
      const encoder=new TextEncoder();
      const srcFields=schema||[];
      const writeText=(pos,len,text,alignRight=false)=>{
        const bytes=encoder.encode(String(text??''));
        const clipped=bytes.subarray(0,len);
        u.fill(0x20,pos,pos+len);
        const start=alignRight?pos+len-clipped.length:pos;
        u.set(clipped,start);
      };
      rows.forEach((feature,ri)=>{
        let pos=headerLen+ri*recordLen;u[pos++]=0x20;
        fields.forEach((f,fi)=>{
          const sourceName=srcFields[fi]?.name||f.name;
          const val=feature?.properties?.[sourceName];
          if(val==null||val===''){u.fill(0x20,pos,pos+f.length);pos+=f.length;return;}
          if(f.type==='N'||f.type==='F'){
            const n=Number(val);
            let txt=Number.isFinite(n)?(f.decimals>0?n.toFixed(f.decimals):String(Math.trunc(n))):'';
            if(txt.length>f.length)txt=txt.slice(0,f.length);
            writeText(pos,f.length,txt,true);
          }else if(f.type==='D'){
            let dt=val instanceof Date?val:new Date(val);let txt='';
            if(!isNaN(dt))txt=String(dt.getFullYear()).padStart(4,'0')+String(dt.getMonth()+1).padStart(2,'0')+String(dt.getDate()).padStart(2,'0');
            writeText(pos,f.length,txt,false);
          }else if(f.type==='L'){
            const b=(val===true||val===1||String(val).toLowerCase()==='true'||String(val).toLowerCase()==='y')?'T':'F';
            writeText(pos,f.length,b,false);
          }else writeText(pos,f.length,val,false);
          pos+=f.length;
        });
      });
      u[total-1]=0x1A;
      return buf;
    },
  _shapeTypeCode(l){
      const g=String(l.geometryType||'').toLowerCase();
      if(g.includes('point'))return g.includes('multi')?8:1;
      if(g.includes('line'))return 3;
      if(g.includes('polygon'))return 5;
      const role=l.epanetRole||detectRole(l.name);
      if(['junction','reservoir','tank'].includes(role))return 1;
      if(['pipe','pump','valve'].includes(role))return 3;
      return 1;
    },
  _writeEmptyShapefile(zip,l){
      const shapeType=this._shapeTypeCode(l);
      zip.file(l.name+'.shp',this._emptyShapeBinary(shapeType,false));
      zip.file(l.name+'.shx',this._emptyShapeBinary(shapeType,true));
      zip.file(l.name+'.dbf',this._emptyDbfBinary(l.schema||[]));
      zip.file(l.name+'.prj',this._wgs84Prj());
      zip.file(l.name+'.cpg','UTF-8');
      zip.file(l.name+'.shp.xml',this._metadataXml(l));
    },
  _emptyShapeBinary(shapeType,isIndex){
      const buf=new ArrayBuffer(100);
      const v=new DataView(buf);
      v.setInt32(0,9994,false);
      for(let o=4;o<=20;o+=4)v.setInt32(o,0,false);
      v.setInt32(24,50,false); // 100 bytes / 2
      v.setInt32(28,1000,true);
      v.setInt32(32,shapeType,true);
      for(let o=36;o<100;o+=8)v.setFloat64(o,0,true);
      return buf;
    },
  _dbfFieldDef(f,used){
      let raw=String(f.name||'FIELD').replace(/[^A-Za-z0-9_]/g,'_');
      if(!raw)raw='FIELD';
      let name=raw.slice(0,10),i=1;
      while(used.has(name.toUpperCase())){const suf=String(i++);name=(raw.slice(0,10-suf.length)+suf).slice(0,10);}
      used.add(name.toUpperCase());
      const t=String(f.dbfType||'').toUpperCase();
      let type=['C','N','F','D','L','M'].includes(t)?t:(f.type==='Date'?'D':f.type==='Boolean'?'L':f.type==='Integer'||f.type==='Double'?'N':'C');
      let length=Number(f.length)||0,decimals=Number(f.decimals)||0;
      if(type==='C'){length=Math.min(254,Math.max(1,length||80));decimals=0;}
      else if(type==='D'){length=8;decimals=0;}
      else if(type==='L'){length=1;decimals=0;}
      else if(type==='M'){length=10;decimals=0;}
      else{length=Math.min(20,Math.max(1,length||18));decimals=Math.min(Math.max(0,decimals||(f.type==='Double'?6:0)),Math.max(0,length-2));}
      return{name,type,length,decimals};
    },
  _emptyDbfBinary(schema){
      const used=new Set();
      const fields=(schema||[]).map(f=>this._dbfFieldDef(f,used));
      const headerLen=32+fields.length*32+1;
      const recordLen=1+fields.reduce((s,f)=>s+f.length,0);
      const buf=new ArrayBuffer(headerLen+1);
      const v=new DataView(buf);
      const u=new Uint8Array(buf);
      const d=new Date();
      u[0]=0x03;u[1]=d.getFullYear()-1900;u[2]=d.getMonth()+1;u[3]=d.getDate();
      v.setUint32(4,0,true);
      v.setUint16(8,headerLen,true);
      v.setUint16(10,recordLen,true);
      fields.forEach((f,i)=>{
        const p=32+i*32;
        for(let j=0;j<Math.min(11,f.name.length);j++)u[p+j]=f.name.charCodeAt(j)&0x7F;
        u[p+11]=f.type.charCodeAt(0);
        u[p+16]=f.length;
        u[p+17]=f.decimals;
      });
      u[headerLen-1]=0x0D;
      u[headerLen]=0x1A;
      return buf;
    },
  _wgs84Prj(){return 'GEOGCS["WGS_1984",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433],AXIS["Latitude",NORTH],AXIS["Longitude",EAST],AUTHORITY["EPSG","4326"]]';},
  _metadataXml(l){return '<?xml version="1.0" encoding="UTF-8"?><metadata><Esri><CreaDate>'+new Date().toISOString().slice(0,10).replaceAll('-','')+'</CreaDate><DataProperties><itemProps><itemName>'+esc(l.name)+'</itemName></itemProps><coordRef><geogcsn>GCS_WGS_1984</geogcsn></coordRef></DataProperties></Esri></metadata>';}
});
