// Module: style/symbology.js - Symbology kiểu ArcGIS: Single symbol / Unique values / Graduated colors / Graduated symbols.
// Nạp SAU layers/layer-manager.js (ghi đè configureStyle, _showFieldStyleChooser, showLayerLegend).
CORE_MESSAGES_VI.symbology={
  menu:'Symbology (ký hiệu hóa)',title:'Symbology — {name}',show:'Hiển thị',
  modeSingle:'Features — Single symbol',modeUnique:'Categories — Unique values',modeGraduated:'Quantities — Graduated colors',modeGsize:'Quantities — Graduated symbols (kích thước)',
  field:'Field giá trị',ramp:'Dải màu',method:'Phương pháp phân lớp',classes:'Số lớp',step:'Khoảng cách lớp',
  methods:{natural:'Natural Breaks (Jenks)',equal:'Equal Interval',quantile:'Quantile',interval:'Defined Interval',manual:'Manual'},
  classify:'Phân lớp lại',addAll:'Thêm tất cả giá trị',remove:'Xóa mục chọn',removeAll:'Xóa tất cả',
  symbolCol:'Ký hiệu',value:'Giá trị',label:'Nhãn',count:'Số lượng',from:'Từ',to:'Đến',size:'Kích thước',
  other:'<tất cả giá trị khác>',unclassified:'Không thuộc lớp nào (ẩn)',
  color:'Màu',outline:'Màu viền',fill:'Màu tô',width:'Độ dày',pointSize:'Kích thước điểm',shape:'Hình dạng',opacity:'Độ trong suốt',fillOpacity:'Độ trong suốt màu tô',
  labelField:'Field nhãn (hover)',noLabel:'-- không nhãn --',minSize:'Kích thước nhỏ nhất',maxSize:'Kích thước lớn nhất',
  apply:'Áp dụng',ok:'OK',
  noNumeric:'Field này không có giá trị số để phân lớp.',noClasses:'Chưa có lớp nào để áp dụng.',
  badBreak:'Giá trị không hợp lệ: phải lớn hơn cận dưới và nhỏ hơn cận trên của lớp kế tiếp.',
  tooMany:'Field có {n} giá trị duy nhất; chỉ lấy 500 giá trị đầu. Cân nhắc dùng Graduated.',
  ramps:{cat:'Màu rời rạc',ylrd:'Vàng → Đỏ',blues:'Xanh dương',greens:'Xanh lá',spectral:'Phổ (xanh → đỏ)',rdylgn:'Đỏ → Xanh lá'}
};

(function(){
  const CAT=['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'];
  const RAMPS={
    cat:{cat:true},
    ylrd:{stops:['#ffffb2','#fecc5c','#fd8d3c','#e31a1c','#800026']},
    blues:{stops:['#eff3ff','#bdd7e7','#6baed6','#3182bd','#08519c']},
    greens:{stops:['#edf8e9','#bae4b3','#74c476','#31a354','#006d2c']},
    spectral:{stops:['#2b83ba','#abdda4','#ffffbf','#fdae61','#d7191c']},
    rdylgn:{stops:['#d7191c','#fdae61','#ffffbf','#a6d96a','#1a9641']}
  };
  const SYMBOLS=['circle','square','diamond','triangle','star','junction','valve','pump','meter','tank'];
  const h2r=h=>[1,3,5].map(i=>parseInt(h.substr(i,2),16));
  const r2h=a=>'#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
  const hsl2hex=(h,s,l)=>{s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return r2h([f(0),f(8),f(4)].map(x=>x*255));};
  const rampAt=(stops,t)=>{const x=Math.max(0,Math.min(1,t))*(stops.length-1),i=Math.min(stops.length-2,Math.floor(x)),f=x-i,a=h2r(stops[i]),b=h2r(stops[i+1]);return r2h(a.map((v,k)=>v+(b[k]-v)*f));};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  Object.assign(WaterMapCore.prototype,{
    // ---------- renderer (được _resolveFeatureVisualStyle gọi) ----------
    _rendererClass(r,raw){
      if(raw===null||raw===undefined||raw==='')return null;
      this._rendererCache=this._rendererCache||new WeakMap();
      if(r.type==='unique'){
        let m=this._rendererCache.get(r);
        if(!m){m=new Map();(r.classes||[]).forEach(c=>(c.values||[]).forEach(v=>{const k=String(v).trim().toLowerCase();if(!m.has(k))m.set(k,c);}));this._rendererCache.set(r,m);}
        return m.get(String(raw).trim().toLowerCase())||null;
      }
      const n=Number(raw);if(!Number.isFinite(n))return null;
      const cs=r.classes||[];
      for(let i=0;i<cs.length;i++){const c=cs[i];if(i===0?(n>=c.min&&n<=c.max):(n>c.min&&n<=c.max))return c;}
      return null;
    },
    _applyRenderer(layer,feature,r,out){
      const kind=geomKind(layer.geometryType),c=r.common||{};
      ['weight','radius','symbol','opacity'].forEach(k=>{if(c[k]!==undefined&&c[k]!==null&&c[k]!=='')out[k]=c[k];});
      if(kind==='polygon')out.fillOpacity=c.opacity!=null?Number(c.opacity):0.6;
      const raw=feature.properties?.[r.field];let hit=this._rendererClass(r,raw),color=null,size=null,hidden=false;
      if(hit){color=hit.color;size=hit.size;}
      else if(r.type==='unique'&&r.other&&r.other.enabled!==false)color=r.other.color;
      else hidden=true;
      if(hidden){out.opacity=0;out.fillOpacity=0;out.color=out.fillColor=out.stroke='rgba(0,0,0,0)';return out;}
      if(color){if(kind==='polygon')out.fillColor=color;else out.color=color;}
      if(Number.isFinite(size)){if(kind==='point')out.radius=size;else if(kind==='line')out.weight=size;}
      return out;
    },
    _symCounts(l,r){
      const cs=r.classes||[],idx=new Map(cs.map((c,i)=>[c,i])),cnt=new Array(cs.length).fill(0);let other=0;
      for(const f of l.fc?.features||[]){const c=this._rendererClass(r,f.properties?.[r.field]);if(c)cnt[idx.get(c)]++;else other++;}
      return{cnt,other};
    },

    // ---------- dữ liệu / phân lớp ----------
    _symNumericField(l,f){const d=(l.schema||[]).find(x=>x.name===f);return['Integer','Double','Float','Number'].includes(d?.type);},
    _symData(l,field){
      const nums=[],uni=new Map();
      for(const f of l.fc?.features||[]){
        const v=f.properties?.[field];if(v===null||v===undefined||v==='')continue;
        const k=String(v).trim().toLowerCase();if(!uni.has(k))uni.set(k,{v,n:0});uni.get(k).n++;
        const n=Number(v);if(Number.isFinite(n))nums.push(n);
      }
      nums.sort((a,b)=>a-b);
      const vals=[...uni.values()].sort((a,b)=>{const x=Number(a.v),y=Number(b.v);return Number.isFinite(x)&&Number.isFinite(y)?x-y:String(a.v).localeCompare(String(b.v));});
      return{nums,vals};
    },
    _symColors(id,n){
      const r=RAMPS[id]||RAMPS.ylrd;
      return Array.from({length:n},(_,i)=>r.cat?(i<CAT.length?CAT[i]:hsl2hex((i*137.508)%360,60,50)):rampAt(r.stops,n===1?.5:i/(n-1)));
    },
    _symJenks(nums,k){
      let d=nums;if(d.length>600){d=[];for(let i=0;i<600;i++)d.push(nums[Math.round(i*(nums.length-1)/599)]);}
      const n=d.length;k=Math.min(k,n);if(k<2)return[d[0],d[n-1]];
      const m1=[],m2=[];for(let i=0;i<=n;i++){m1.push(new Array(k+1).fill(0));m2.push(new Array(k+1).fill(Infinity));}
      for(let i=1;i<=k;i++){m1[1][i]=1;m2[1][i]=0;}
      let v=0;
      for(let l=2;l<=n;l++){
        let s1=0,s2=0,w=0;
        for(let m=1;m<=l;m++){
          const i3=l-m+1,val=d[i3-1];w++;s1+=val;s2+=val*val;v=s2-(s1*s1)/w;const i4=i3-1;
          if(i4!==0)for(let j=2;j<=k;j++)if(m2[l][j]>=v+m2[i4][j-1]){m1[l][j]=i3;m2[l][j]=v+m2[i4][j-1];}
        }
        m1[l][1]=1;m2[l][1]=v;
      }
      const out=new Array(k+1);out[k]=d[n-1];out[0]=d[0];let kk=n,j=k;
      while(j>1){out[j-1]=d[m1[kk][j]-2];kk=m1[kk][j]-1;j--;}
      return out;
    },
    _symBreaks(nums,method,k,step){
      if(!nums.length)return[];const mn=nums[0],mx=nums[nums.length-1];if(mn===mx)return[mn,mx];
      let b;
      if(method==='equal')b=Array.from({length:k+1},(_,i)=>i===k?mx:mn+(mx-mn)*i/k);
      else if(method==='quantile')b=Array.from({length:k+1},(_,i)=>nums[Math.min(nums.length-1,Math.round(i*(nums.length-1)/k))]);
      else if(method==='interval'){const s=Math.max(1e-9,Number(step)||(mx-mn)/k);b=[mn];while(b[b.length-1]+s<mx-1e-12&&b.length<60)b.push(b[b.length-1]+s);b.push(mx);}
      else b=this._symJenks(nums,Math.min(k,new Set(nums).size));
      return b.filter((v,i)=>i===0||v>b[i-1]);
    },
    _symRangeLabel(c,dec){const f=v=>String(+Number(v).toFixed(dec));return f(c.min)+' – '+f(c.max);},
    _symAssignSizes(st){
      const n=st.classes.length;
      st.classes.forEach((c,i)=>{c.size=Math.round((st.minSize+(st.maxSize-st.minSize)*(n>1?i/(n-1):.5))*10)/10;c.color=st.color;});
    },
    _symClassify(l,st){
      const {nums}=this._symData(l,st.field);if(!nums.length){st.classes=[];return false;}
      const b=this._symBreaks(nums,st.method,st.count,st.step),range=nums[nums.length-1]-nums[0];
      st.dec=nums.every(Number.isInteger)?0:(range>=100?1:range>=1?2:4);
      const n=Math.max(0,b.length-1),cols=st.type==='graduated'?this._symColors(st.ramp,n):null;
      st.classes=[];
      for(let i=0;i<n;i++){const c={min:b[i],max:b[i+1]};c.label=this._symRangeLabel(c,st.dec);if(cols)c.color=cols[i];st.classes.push(c);}
      if(st.type==='gsize')this._symAssignSizes(st);
      return true;
    },
    _symFillUnique(l,st,recolor){
      const {vals}=this._symData(l,st.field);
      if(vals.length>500)this.toast(this.t('symbology.tooMany',{n:vals.length}),4500);
      const list=vals.slice(0,500),old=new Map();
      (st.classes||[]).forEach(c=>(c.values||[]).forEach(v=>old.set(String(v).trim().toLowerCase(),c)));
      const cols=this._symColors(st.ramp,list.length);
      st.classes=list.map((x,i)=>{const o=old.get(String(x.v).trim().toLowerCase());return{values:[x.v],label:o?.label??String(x.v),color:(!recolor&&o?.color)||cols[i]};});
    },

    // ---------- UI ----------
    configureStyle(){const l=this.getActiveLayer();if(l)this.configureSymbology(l.id);},
    _showFieldStyleChooser(layer,fieldName,back){this.configureSymbology(layer.id,{field:fieldName,back});},

    configureSymbology(layerId,opt={}){
      const l=this.getLayer(layerId)||this.getActiveLayer();if(!l)return;this.activeLayerId=l.id;
      const kind=geomKind(l.geometryType),S=l.style=l.style||{},T=(k,p)=>this.t('symbology.'+k,p);
      const fields=(l.schema||[]).map(f=>f.name),numericFields=fields.filter(f=>this._symNumericField(l,f));
      const base=Object.assign({color:'#0b8ea6',stroke:'#ffffff',weight:3,radius:6,opacity:.9,fillColor:'#52b5c5',fillOpacity:.25,symbol:'circle'},
        JSON.parse(JSON.stringify({color:S.color,stroke:S.stroke,weight:S.weight,radius:S.radius,opacity:S.opacity,fillColor:S.fillColor,fillOpacity:S.fillOpacity,symbol:S.symbol})));
      let st=S.renderer&&S.renderer.type&&S.renderer.type!=='single'?JSON.parse(JSON.stringify(S.renderer)):{type:'single'};
      let label=S.labelField||'';
      const done=()=>opt.back?opt.back():this._closeModal();

      const fill=()=>{
        if(st.type==='unique')this._symFillUnique(l,st,false);
        else if(st.type==='graduated'||st.type==='gsize'){if(!this._symClassify(l,st))this.toast(T('noNumeric'),4000);}
      };
      const init=(type,field,keep)=>{
        const c=Object.assign({weight:base.weight,radius:base.radius,symbol:base.symbol||'circle',opacity:kind==='polygon'?.6:base.opacity},keep||{});
        st={type,field,ramp:type==='unique'?'cat':'ylrd',method:'natural',count:5,step:null,color:'#d62728',minSize:4,maxSize:16,common:c,other:{enabled:true,color:'#9aa5ad'},classes:[]};
        fill();
      };
      const setMode=type=>{
        if(type==='single'){st={type:'single'};render();return;}
        let field=st.field;const ok=type==='unique'?fields.includes(field):numericFields.includes(field);
        if(!ok)field=type==='unique'?(opt.field||fields[0]):(numericFields.includes(opt.field)?opt.field:numericFields[0]);
        if(!field){this.toast(T('noNumeric'),4000);render();return;}
        init(type,field,st.common);render();
      };
      if(opt.field&&fields.includes(opt.field)&&!(st.type!=='single'&&st.field===opt.field))init(numericFields.includes(opt.field)?'graduated':'unique',opt.field,st.common);

      const esc2=esc,row=(lb,ctl)=>'<label class="ddc_meko-field"><span>'+esc2(lb)+'</span>'+ctl+'</label>';
      const num=(attr,val,min,max,step)=>'<input type="number" '+attr+' value="'+esc2(val??'')+'" min="'+min+'" max="'+max+'" step="'+(step||1)+'">';
      const sel=(attr,opts,val)=>'<select '+attr+'>'+opts.map(o=>'<option value="'+esc2(o[0])+'"'+(String(o[0])===String(val)?' selected':'')+'>'+esc2(o[1])+'</option>').join('')+'</select>';
      const symOpts=SYMBOLS.map(s=>[s,s]);

      const render=()=>{
        if(this._rendererCache)this._rendererCache.delete(st);
        const single=st.type==='single';
        const modes=[['single',T('modeSingle')],['unique',T('modeUnique')],['graduated',T('modeGraduated')]].concat(kind==='polygon'?[]:[['gsize',T('modeGsize')]]);
        let h=row(T('show'),sel('id="symMode"',modes,st.type));
        if(single){
          const b=(p,type,min,max,step)=>'<input data-base="'+p+'" type="'+type+'" value="'+esc2(base[p]??'')+'"'+(type==='number'?' min="'+min+'" max="'+max+'" step="'+(step||1)+'"':'')+'>';
          if(kind==='line')h+=row(T('color'),b('color','color'))+row(T('width'),b('weight','number',1,30))+row(T('opacity'),b('opacity','number',.05,1,.05));
          else if(kind==='point')h+=row(T('color'),b('color','color'))+row(T('outline'),b('stroke','color'))+row(T('pointSize'),b('radius','number',2,40))+row(T('shape'),sel('data-base="symbol"',symOpts,base.symbol||'circle'))+row(T('opacity'),b('opacity','number',.05,1,.05));
          else h+=row(T('fill'),b('fillColor','color'))+row(T('outline'),b('color','color'))+row(T('width'),b('weight','number',1,30))+row(T('fillOpacity'),b('fillOpacity','number',0,1,.05));
        }else{
          const fl=st.type==='unique'?fields:numericFields,c=st.common||(st.common={});
          h+=row(T('field'),sel('id="symField"',fl.map(f=>[f,f]),st.field));
          const rampOpts=Object.keys(RAMPS).map(k=>[k,T('ramps.'+k)]);
          if(st.type==='unique'){
            h+=row(T('ramp'),sel('id="symRamp"',rampOpts,st.ramp));
            h+='<div class="ddc_meko-btnrow"><button class="ddc_meko-btn" id="symAddAll">'+esc2(T('addAll'))+'</button><button class="ddc_meko-btn" id="symRemove">'+esc2(T('remove'))+'</button><button class="ddc_meko-btn danger" id="symRemoveAll">'+esc2(T('removeAll'))+'</button></div>';
          }else{
            const mOpts=['natural','equal','quantile','interval','manual'].map(m=>[m,T('methods.'+m)]);
            h+=row(T('method'),sel('id="symMethod"',mOpts,st.method))+row(T('classes'),num('id="symCount"',st.count,2,12));
            if(st.method==='interval')h+=row(T('step'),num('id="symStep"',st.step??'',0,'',  'any'));
            if(st.type==='graduated')h+=row(T('ramp'),sel('id="symRamp"',rampOpts,st.ramp));
            else h+=row(T('color'),'<input id="symColor" type="color" value="'+esc2(st.color)+'">')+row(T('minSize'),num('id="symMin"',st.minSize,1,60))+row(T('maxSize'),num('id="symMax"',st.maxSize,1,60));
            h+='<div class="ddc_meko-btnrow"><button class="ddc_meko-btn" id="symClassify">'+esc2(T('classify'))+'</button></div>';
          }
          const cm=(p,lb,min,max,step)=>row(lb,'<input data-common="'+p+'" type="number" value="'+esc2(c[p]??'')+'" min="'+min+'" max="'+max+'" step="'+(step||1)+'">');
          if(kind==='point'){if(st.type!=='gsize')h+=cm('radius',T('pointSize'),2,40);h+=row(T('shape'),sel('data-common="symbol"',symOpts,c.symbol||'circle'));}
          if(kind==='line'&&st.type!=='gsize')h+=cm('weight',T('width'),1,30);
          h+=cm('opacity',T('opacity'),.05,1,.05);

          const cnt=this._symCounts(l,st),cls=st.classes||[];let th,rows;
          if(st.type==='unique'){
            th='<th></th><th>'+esc2(T('symbolCol'))+'</th><th>'+esc2(T('value'))+'</th><th>'+esc2(T('label'))+'</th><th>'+esc2(T('count'))+'</th>';
            rows=cls.map((x,i)=>'<tr><td><input type="checkbox" data-sel="'+i+'"></td><td><input type="color" data-ccolor="'+i+'" value="'+esc2(x.color)+'"></td><td>'+esc2((x.values||[]).join(', '))+'</td><td><input data-clabel="'+i+'" value="'+esc2(x.label)+'"></td><td>'+cnt.cnt[i]+'</td></tr>').join('');
            rows+='<tr><td><input type="checkbox" id="symOtherEn" '+(st.other?.enabled!==false?'checked':'')+'></td><td><input type="color" id="symOtherColor" value="'+esc2(st.other?.color||'#9aa5ad')+'"></td><td colspan="2">'+esc2(T('other'))+'</td><td>'+cnt.other+'</td></tr>';
          }else{
            const g=st.type==='gsize',dec=st.dec??2;
            th='<th>'+esc2(g?T('size'):T('symbolCol'))+'</th><th>'+esc2(T('from'))+'</th><th>'+esc2(T('to'))+'</th><th>'+esc2(T('label'))+'</th><th>'+esc2(T('count'))+'</th>';
            rows=cls.map((x,i)=>'<tr><td>'+(g?esc2(x.size):'<input type="color" data-ccolor="'+i+'" value="'+esc2(x.color)+'">')+'</td><td>'+(i===0?'<input type="number" step="any" data-min0 value="'+esc2(x.min)+'" style="width:90px">':esc2(+Number(x.min).toFixed(dec)))+'</td><td><input type="number" step="any" data-max="'+i+'" value="'+esc2(x.max)+'" style="width:90px"></td><td><input data-clabel="'+i+'" value="'+esc2(x.label)+'"></td><td>'+cnt.cnt[i]+'</td></tr>').join('');
            if(cnt.other>0)rows+='<tr><td colspan="4">'+esc2(T('unclassified'))+'</td><td>'+cnt.other+'</td></tr>';
          }
          h+='<div class="ddc_meko-table-wrap" style="max-height:300px;margin-top:8px"><table class="ddc_meko-table"><thead><tr>'+th+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
        }
        h+=row(T('labelField'),sel('id="symLabel"',[['',T('noLabel')]].concat(fields.map(f=>[f,f])),label));

        this._modal(T('title',{name:l.name}),h,[
          {text:T('apply'),fn:()=>save(false)},{text:T('ok'),primary:true,fn:()=>save(true)},{text:this.t('common.cancel'),fn:done}
        ],{wide:true});

        const q=s=>this.modalWrap.querySelector(s),qa=s=>[...this.modalWrap.querySelectorAll(s)];
        q('#symMode').onchange=e=>setMode(e.target.value);
        q('#symLabel').onchange=e=>{label=e.target.value;};
        if(single){
          qa('[data-base]').forEach(el=>el.oninput=()=>{const p=el.dataset.base;base[p]=el.type==='number'?Number(el.value):el.value;});
          return;
        }
        q('#symField').onchange=e=>{st.field=e.target.value;st.classes=[];fill();render();};
        const recolor=()=>{
          if(st.type==='unique')this._symFillUnique(l,st,true);
          else{const cols=this._symColors(st.ramp,st.classes.length);st.classes.forEach((x,i)=>x.color=cols[i]);}
        };
        const ramp=q('#symRamp');if(ramp)ramp.onchange=e=>{st.ramp=e.target.value;recolor();render();};
        qa('[data-common]').forEach(el=>el.onchange=()=>{const p=el.dataset.common;st.common[p]=el.tagName==='SELECT'?el.value:Number(el.value);});
        qa('[data-ccolor]').forEach(el=>el.oninput=()=>{st.classes[Number(el.dataset.ccolor)].color=el.value;});
        qa('[data-clabel]').forEach(el=>el.oninput=()=>{const c=st.classes[Number(el.dataset.clabel)];c.label=el.value;c.labelEdited=true;});
        if(st.type==='unique'){
          q('#symAddAll').onclick=()=>{this._symFillUnique(l,st,false);render();};
          q('#symRemove').onclick=()=>{const del=new Set(qa('[data-sel]:checked').map(x=>Number(x.dataset.sel)));st.classes=st.classes.filter((_,i)=>!del.has(i));render();};
          q('#symRemoveAll').onclick=()=>{st.classes=[];render();};
          q('#symOtherEn').onchange=e=>{st.other.enabled=e.target.checked;};
          q('#symOtherColor').oninput=e=>{st.other.color=e.target.value;};
          return;
        }
        q('#symMethod').onchange=e=>{st.method=e.target.value;if(st.method!=='manual')fill();render();};
        q('#symCount').onchange=e=>{st.count=clamp(Math.round(Number(e.target.value))||5,2,12);if(st.method!=='manual')fill();render();};
        const stepEl=q('#symStep');if(stepEl)stepEl.onchange=e=>{st.step=Number(e.target.value)||null;fill();render();};
        q('#symClassify').onclick=()=>{fill();render();};
        if(st.type==='gsize'){
          q('#symColor').oninput=e=>{st.color=e.target.value;st.classes.forEach(x=>x.color=st.color);};
          q('#symMin').onchange=e=>{st.minSize=clamp(Number(e.target.value)||4,1,60);this._symAssignSizes(st);render();};
          q('#symMax').onchange=e=>{st.maxSize=clamp(Number(e.target.value)||16,1,60);this._symAssignSizes(st);render();};
        }
        const relabel=x=>{if(!x.labelEdited)x.label=this._symRangeLabel(x,st.dec??2);};
        const m0=q('[data-min0]');if(m0)m0.onchange=e=>{const v=Number(e.target.value),c=st.classes[0];if(!Number.isFinite(v)||v>=c.max){this.toast(T('badBreak'),3500);render();return;}c.min=v;st.method='manual';relabel(c);render();};
        qa('[data-max]').forEach(el=>el.onchange=()=>{
          const i=Number(el.dataset.max),c=st.classes[i],n=st.classes[i+1],v=Number(el.value);
          if(!Number.isFinite(v)||v<=c.min||(n&&v>=n.max)){this.toast(T('badBreak'),3500);render();return;}
          c.max=v;if(n)n.min=v;st.method='manual';relabel(c);if(n)relabel(n);render();
        });
      };

      const save=close=>{
        if(st.type==='single'){Object.assign(S,base);delete S.renderer;delete S.rules;}
        else{
          if(!st.field||!(st.classes||[]).length){this.toast(T('noClasses'),4000);return;}
          S.renderer=JSON.parse(JSON.stringify(st));delete S.rules;
        }
        S.labelField=label||null;
        this._renderLayer(l);this._syncProject();this._setDirty?.('symbology');
        if(close)done();
      };
      render();
    },

    showLayerLegend(layerId){
      const l=this.getLayer(layerId)||this.getActiveLayer();if(!l)return;
      const S=l.style||{},r=S.renderer,T=(k,p)=>this.t('symbology.'+k,p);
      const sw=c=>'<span style="display:inline-block;width:26px;height:14px;border:1px solid #888;vertical-align:middle;margin-right:8px;background:'+esc(c)+'"></span>';
      let h='';
      if(r&&r.type&&r.type!=='single'&&r.field){
        const cnt=this._symCounts(l,r);
        h+='<div style="margin-bottom:8px"><b>'+esc(l.name)+'</b> — '+esc(r.field)+'</div>';
        (r.classes||[]).forEach((c,i)=>{h+='<div style="padding:3px 0">'+sw(c.color)+esc(c.label)+' <small style="color:#667085">('+cnt.cnt[i]+')</small></div>';});
        if(r.type==='unique'&&r.other?.enabled!==false)h+='<div style="padding:3px 0">'+sw(r.other.color)+esc(T('other'))+' <small style="color:#667085">('+cnt.other+')</small></div>';
      }else{
        const rules=S.rules||{};
        Object.entries(rules).forEach(([prop,rr])=>{h+='<div style="margin-bottom:12px"><b>'+esc(prop)+' ← '+esc(rr.field)+'</b>';
          if(rr.fieldType==='numeric')rr.groups.forEach(g=>h+='<div style="padding:4px 0">'+esc((g.min??'-∞')+' – '+(g.max??'∞'))+' → '+esc(g.value)+'</div>');
          else rr.groups.forEach(g=>h+='<div style="padding:4px 0">'+esc((g.values||[]).join(', '))+' → '+esc(g.value)+'</div>');h+='</div>';});
      }
      if(!h)h='<div class="ddc_meko-empty">'+esc(this.t('style.noRules'))+'</div>';
      this._modal(this.t('style.legendTitle',{name:l.name}),h,[{text:this.t('common.close'),fn:()=>this._closeModal()}]);
    }
  });
})();