// WaterMapCore event bus
WaterMapCore.prototype.on=function(name,fn){
  if(!name||typeof fn!=='function')return()=>{};
  (this.events[name]=this.events[name]||[]).push(fn);
  return()=>this.off(name,fn);
};
WaterMapCore.prototype.off=function(name,fn){
  if(!name)return this;
  if(!fn){delete this.events[name];return this;}
  this.events[name]=(this.events[name]||[]).filter(x=>x!==fn);
  return this;
};
WaterMapCore.prototype.emit=function(name,data){
  (this.events[name]||[]).slice().forEach(fn=>{
    try{fn(data);}catch(e){console.error('[WaterMapCore event]',name,e);}
  });
  return this;
};
