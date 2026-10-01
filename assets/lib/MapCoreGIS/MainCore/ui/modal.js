// Module: ui/modal.js
Object.assign(WaterMapCore.prototype, {
  _modal(title,html,buttons,opt={}){this.modalWrap.classList.remove('hidden');this.modalWrap.innerHTML='<div class="ddc_meko-modal" '+(opt.wide?'style="width:min(1100px,100%)"':'')+'><div class="ddc_meko-modal-head"><span>'+esc(title)+'</span>'+(opt.closable===false?'':'<button class="ddc_meko-panel-close">×</button>')+'</div><div class="ddc_meko-modal-body">'+html+'</div><div class="ddc_meko-modal-foot"></div></div>';const close=this.modalWrap.querySelector('.ddc_meko-panel-close');if(close)close.onclick=()=>this._closeModal();const foot=this.modalWrap.querySelector('.ddc_meko-modal-foot');(buttons||[]).forEach(x=>{const b=document.createElement('button');b.className='ddc_meko-btn'+(x.primary?' primary':'');b.textContent=x.text;b.onclick=x.fn;foot.appendChild(b);});},
  _closeModal(){this.modalWrap.classList.add('hidden');this.modalWrap.innerHTML='';}
});
