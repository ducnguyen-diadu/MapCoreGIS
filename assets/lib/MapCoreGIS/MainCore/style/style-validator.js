// Module: style/style-validator.js
Object.assign(WaterMapCore.prototype, {
  _validateStyleRuleSet(rule){
    if(!rule||!Array.isArray(rule.groups))return{ok:true};
    if(rule.fieldType==='numeric'){
      const arr=rule.groups.map((g,i)=>({i,min:g.min===''||g.min==null?null:Number(g.min),max:g.max===''||g.max==null?null:Number(g.max)}));
      for(const x of arr){if((x.min!=null&&!Number.isFinite(x.min))||(x.max!=null&&!Number.isFinite(x.max)))return{ok:false,message:this.t('style.invalidNumber')};if(x.min!=null&&x.max!=null&&x.min>x.max)return{ok:false,message:this.t('style.invalidRange')};}
      for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){
        const a=arr[i],b=arr[j];const aMin=a.min==null?-Infinity:a.min,aMax=a.max==null?Infinity:a.max,bMin=b.min==null?-Infinity:b.min,bMax=b.max==null?Infinity:b.max;
        if(Math.max(aMin,bMin)<=Math.min(aMax,bMax))return{ok:false,message:this.t('style.rangeOverlap',{a:i+1,b:j+1})};
      }
      return{ok:true};
    }
    const used=new Map();
    for(let i=0;i<rule.groups.length;i++){
      for(const raw of rule.groups[i].values||[]){const v=String(raw).trim();if(!v)continue;const k=v.toLowerCase();if(used.has(k))return{ok:false,message:this.t('style.valueDuplicate',{value:v,a:used.get(k)+1,b:i+1})};used.set(k,i);}
    }
    return{ok:true};
  },
  _matchStyleGroup(rule,raw){
    if(raw===null||raw===undefined||raw==='')return null;
    if(!rule||!Array.isArray(rule.groups))return null;
    if(rule.fieldType==='numeric'){
      const n=Number(raw);if(!Number.isFinite(n))return null;
      return rule.groups.find(g=>{const mn=g.min===''||g.min==null?-Infinity:Number(g.min),mx=g.max===''||g.max==null?Infinity:Number(g.max);return n>=mn&&n<=mx;})||null;
    }
    const k=String(raw??'').trim().toLowerCase();
    return rule.groups.find(g=>(g.values||[]).some(v=>String(v).trim().toLowerCase()===k))||null;
  }
});
