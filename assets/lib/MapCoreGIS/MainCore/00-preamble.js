// WaterMapCore v0.3.0 - shared constants/helpers
const VERSION='0.6.7.2';
const FORMAT='DDC-MEKO-MKS';
const MKS_VERSION=1;
const DEFAULTS={
  locale:'vi',
  fallbackLocale:'vi',
  plugins:[],
  ui:{toolbar:'left',layerPanel:'left',attributePanel:'right'},
  storage:{guestRetentionDays:7,isAuthenticated:()=>false},
  map:{center:[16.4637,107.5909],zoom:13,osm:true,zoomControl:true,minZoom:2,maxZoom:24,maxNativeZoom:19},
  attributeTable:{pageSize:50,mode:'modal'},
  epanet:{autoDetectRole:true}
};
const EPANET_SCHEMAS={
  junction:[['id','String'],['elevation','Double'],['baseDemand','Double'],['pattern','String']],
  reservoir:[['id','String'],['head','Double']],
  tank:[['id','String'],['elevation','Double'],['initLevel','Double'],['minLevel','Double'],['maxLevel','Double'],['diameter','Double']],
  pipe:[['id','String'],['node1','String'],['node2','String'],['length','Double'],['diameter','Double'],['roughness','Double'],['status','String']],
  pump:[['id','String'],['node1','String'],['node2','String'],['power','Double']],
  valve:[['id','String'],['node1','String'],['node2','String'],['diameter','Double'],['type','String'],['setting','Double']]
};
const CORE_MESSAGES_VI={
  common:{save:'Lưu',cancel:'Hủy',close:'Đóng',delete:'Xóa',edit:'Sửa',open:'Mở',back:'Quay lại',yes:'Có',no:'Không'},
  toolbar:{recent:'Gần đây',import:'Nhập dữ liệu',save:'Lưu project',export:'Xuất Shapefile',layers:'Lớp dữ liệu',table:'Bảng thuộc tính',select:'Chọn đối tượng','draw-point':'Vẽ điểm','draw-line':'Vẽ đường','draw-polygon':'Vẽ vùng',edit:'Chỉnh sửa',delete:'Xóa đối tượng',measure:'Đo khoảng cách','clear-measure':'Xóa kết quả đo',home:'Về vị trí ban đầu',undo:'Hoàn tác',redo:'Làm lại'},
  panel:{layers:'Lớp dữ liệu',properties:'Thuộc tính',attributeTable:'Bảng thuộc tính'},
  select:{mode:'Chế độ chọn: click đối tượng trên bản đồ để chọn',noLayer:'Chọn một layer trước',wrongGeometry:'Geometry của layer không phù hợp công cụ vẽ',needGeoman:'Cần Leaflet-Geoman để vẽ/chỉnh sửa',noFeature:'Chưa chọn đối tượng'},
  feature:{previewCreate:'Đối tượng đang PREVIEW. Chỉ ghi thật khi bấm Lưu.',previewEdit:'Đang chỉnh sửa bản preview. Dữ liệu gốc chưa thay đổi.',confirmDelete:'Xóa đối tượng đã chọn?'},
  measure:{cancelled:'Đã hủy đo',confirmDelete:'Xóa kết quả đo này?',done:'Đo xong. Click đường đo để xóa hoặc dùng nút ×↔ để xóa tất cả.',cleared:'Đã xóa kết quả đo'},
  context:{zoomTo:'Zoom to',panTo:'Pan to',flash:'Nhấp nháy',editAttributes:'Sửa thuộc tính',duplicate:'Nhân bản',delete:'Xóa',exportFeature:'Xuất đối tượng',zoomLayer:'Zoom tới layer',panLayer:'Di chuyển tới layer',flashLayer:'Nhấp nháy layer',attributeTable:'Bảng thuộc tính',style:'Style',fields:'Fields',epanet:'EPANET',exportGeoJSON:'Xuất GeoJSON',removeLayer:'Xóa layer'},
  layer:{removeConfirm:'Xóa layer {name} khỏi project?',styleTitle:'Style: {name}',color:'Màu',lineWidth:'Độ dày line',labelField:'Field label',noLabel:'-- không label --',fieldsTitle:'Fields: {name}',field:'Field',alias:'Alias',type:'Type',visible:'Hiện',editable:'Sửa'},
  epanet:{notUsed:'Layer này không tham gia EPANET.',mappingHelp:'Chọn field hiện có cho từng trường EPANET. Nếu chọn “Tạo field mới”, Core sẽ bổ sung field đúng cho role này khi lưu.',createField:'Tạo field mới: {name}',role:'EPANET role',none:'Không dùng EPANET',title:'EPANET: {name}'},
  table:{noLayer:'Không có layer',title:'Attribute Table — {name}',page:'Trang {page}/{max} · {count} đối tượng'},
  import:{title:'Import Shapefile',choose:'Chọn cách nhập Shapefile',files:'Chọn nhiều file',folder:'Chọn folder',zip:'Chọn ZIP',success:'Import thành công {count} layer',partial:'Import hoàn tất: {ok} layer OK, {errors} layer lỗi. Xem Console.'},
  recent:{startup:'Chọn project để bắt đầu',title:'Recent Projects',openMks:'Mở .mks',importShape:'Import Shapefile',empty:'Chưa có project gần đây.',layer:'layer',removeConfirm:'Xóa khỏi Recent?'},
  project:{namePrompt:'Tên project',saved:'Đã lưu project'},
  export:{success:'Đã export {count} layer Shapefile'}
};
function merge(a,b){const out=Array.isArray(a)?a.slice():Object.assign({},a||{});Object.keys(b||{}).forEach(k=>{if(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])) out[k]=merge(out[k]||{},b[k]); else out[k]=b[k];});return out;}
function uuid(){return (global.crypto&&crypto.randomUUID)?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16);});}
function nowIso(){return new Date().toISOString();}
function esc(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
function downloadBlob(name,blob){const a=document.createElement('a');const u=URL.createObjectURL(blob);a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);}
function geomKind(g){const t=(g||'').toLowerCase();if(t.includes('point'))return'point';if(t.includes('line'))return'line';if(t.includes('polygon'))return'polygon';return'unknown';}
function detectRole(name){const n=(name||'').toLowerCase();if(/junction|node|nut/.test(n))return'junction';if(/reservoir|nguon/.test(n))return'reservoir';if(/tank|be_chua|bechua/.test(n))return'tank';if(/pipe|ong/.test(n))return'pipe';if(/pump|bom/.test(n))return'pump';if(/valve|van/.test(n))return'valve';return null;}
function parseDbfSchema(buf){if(!buf)return[];try{const v=new DataView(buf);const header=v.getUint16(8,true);const out=[];for(let p=32;p<header-1&&v.getUint8(p)!==0x0D;p+=32){let n='';for(let i=0;i<11;i++){const b=v.getUint8(p+i);if(!b)break;n+=String.fromCharCode(b);}const t=String.fromCharCode(v.getUint8(p+11));const len=v.getUint8(p+16),dec=v.getUint8(p+17);const map={C:'String',N:dec?'Double':'Integer',F:'Double',D:'Date',L:'Boolean',M:'String'};out.push({name:n,type:map[t]||'String',dbfType:t,length:len,decimals:dec,visible:true,editable:true,required:false,alias:n});}return out;}catch(e){return[];}}
function inferSchema(fc){const sample=(fc.features||[]).find(f=>f&&f.properties)||{properties:{}};return Object.keys(sample.properties||{}).map(k=>{const v=sample.properties[k];let type='String';if(typeof v==='number')type=Number.isInteger(v)?'Integer':'Double';else if(typeof v==='boolean')type='Boolean';return{name:k,type,dbfType:type==='String'?'C':type==='Date'?'D':type==='Boolean'?'L':'N',length:type==='String'?254:18,decimals:type==='Double'?6:0,visible:true,editable:true,required:false,alias:k};});}
function normalizeFC(fc,name){if(Array.isArray(fc))fc=fc[0];if(!fc||fc.type!=='FeatureCollection')throw new Error('Dữ liệu không phải FeatureCollection');fc.name=fc.name||fc.fileName||name;fc.features=(fc.features||[]).map((f,i)=>({type:'Feature',id:f.id??i,properties:Object.assign({},f.properties||{}),geometry:f.geometry}));return fc;}
function bboxFC(fc){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;function scan(c){if(typeof c[0]==='number'){minX=Math.min(minX,c[0]);maxX=Math.max(maxX,c[0]);minY=Math.min(minY,c[1]);maxY=Math.max(maxY,c[1]);}else c.forEach(scan);} (fc.features||[]).forEach(f=>f.geometry&&scan(f.geometry.coordinates));return isFinite(minX)?[[minY,minX],[maxY,maxX]]:null;}

class RecentStore{
  constructor(name='ddc_meko_watermap'){this.name=name;this.dbp=null;}
  async db(){if(this.dbp)return this.dbp;this.dbp=new Promise((res,rej)=>{const r=indexedDB.open(this.name,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects',{keyPath:'projectId'});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});return this.dbp;}
  async put(rec){const db=await this.db();return new Promise((res,rej)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(rec);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
  async get(id){const db=await this.db();return new Promise((res,rej)=>{const q=db.transaction('projects').objectStore('projects').get(id);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});}
  async list(){const db=await this.db();return new Promise((res,rej)=>{const q=db.transaction('projects').objectStore('projects').getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error);});}
  async del(id){const db=await this.db();return new Promise((res,rej)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').delete(id);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
}

