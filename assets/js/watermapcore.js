(function(global){
'use strict';

/* ===== src/00-preamble.js ===== */
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


/* ===== src/core/04-messages-v040.js ===== */
// Module: core/04-messages-v040.js - built-in Vietnamese fallback for v0.4 features
Object.assign(CORE_MESSAGES_VI.toolbar,{'edit-tools':'Công cụ hiệu chỉnh'});
Object.assign(CORE_MESSAGES_VI.common||{},{});
Object.assign(CORE_MESSAGES_VI.select,{dragBox:'Kéo chuột tạo vùng để chọn đối tượng',selectedCount:'Đã chọn {count} đối tượng',noneInBox:'Không có đối tượng trong vùng chọn',cleared:'Đã bỏ chọn'});
Object.assign(CORE_MESSAGES_VI.feature,{confirmDeleteMany:'Xóa {count} đối tượng đã chọn?'});
Object.assign(CORE_MESSAGES_VI.context,{select:'Chọn đối tượng'});
Object.assign(CORE_MESSAGES_VI.project,{unsavedTitle:'Có thay đổi chưa lưu',unsavedSwitch:'Project hiện tại có thay đổi chưa lưu. Bạn muốn xử lý trước khi mở project khác?',saveAndContinue:'Lưu và tiếp tục',discardAndContinue:'Không lưu và tiếp tục'});
CORE_MESSAGES_VI.editToolbar={drag:'Kéo để di chuyển thanh công cụ',boxSelect:'Quét vùng chọn',unselect:'Bỏ chọn',begin:'Bắt đầu chỉnh sửa',draw:'Vẽ đối tượng',save:'Lưu phiên chỉnh sửa',cancel:'Hủy phiên chỉnh sửa',started:'Đã bắt đầu phiên chỉnh sửa',finishPending:'Hãy Lưu/Hủy đối tượng đang chỉnh sửa trước',cancelConfirm:'Hủy toàn bộ thay đổi của phiên chỉnh sửa?',beginFirst:'Hãy bấm Bắt đầu chỉnh sửa trước'};
Object.assign(CORE_MESSAGES_VI.import,{appendTitle:'Import / Merge Shapefile',layerRepresentative:'UI coi mỗi .shp là một layer; các file sidecar cùng tên sẽ được Core tự gom khi chúng được trình duyệt cung cấp.',layersDetected:'Phát hiện {count} layer',mergeTitle:'Ghép dữ liệu vào layer {name}',keyField:'Key Field để xác định record trùng',action:'Cách xử lý',analysis:'Phân tích dữ liệu',existingMatch:'Đã tồn tại: {count}',newRecords:'Chưa tồn tại: {count}',emptyKey:'Không có Key: {count}',updateAdd:'Cập nhật record trùng + thêm record mới',addNewOnly:'Chỉ thêm record chưa tồn tại',addAllAsNew:'Thêm tất cả thành record mới',mergeWholeRecord:'Khi cập nhật record trùng, geometry và toàn bộ thuộc tính từ file mới sẽ thay thế dữ liệu cũ.',noCommonKey:'Không tìm thấy field chung để xác định record trùng. Có thể thêm tất cả thành record mới.',advancedFields:'Nâng cao: chọn field được phép cập nhật'});
CORE_MESSAGES_VI.style={groups:'nhóm',notConfigured:'Chưa cấu hình',pointSize:'Kích thước điểm',opacity:'Độ trong suốt',attributeStyle:'Style theo thuộc tính',colorByField:'Màu theo field',widthByField:'Độ dày theo field',opacityByField:'Opacity theo field',sizeByField:'Kích thước theo field',symbolByField:'Symbol theo field',configure:'Cấu hình',legend:'Chú giải',field:'Field',numericHelp:'Field số: tạo các khoảng không được chồng lấn nhau. Mỗi giá trị chỉ thuộc một nhóm.',categoryHelp:'Field text: một giá trị chỉ được thuộc một nhóm trong cùng property.',addGroup:'Thêm nhóm',clearRule:'Xóa rule',styleValue:'Style',valuesComma:'Giá trị (cách nhau bằng dấu phẩy)',ruleTitle:'{property} theo field — {name}',invalidNumber:'Khoảng style có giá trị số không hợp lệ',invalidRange:'Min không được lớn hơn Max',rangeOverlap:'Nhóm {a} và {b} đang chồng khoảng. Không thể lưu.',valueDuplicate:'Giá trị “{value}” đang xuất hiện ở cả nhóm {a} và {b}.',noCompatibleField:'Không có field phù hợp',noRules:'Layer chưa có rule style theo thuộc tính',legendTitle:'Chú giải — {name}'};
CORE_MESSAGES_VI.direction={menu:'Chiều dòng / số hóa',title:'Chiều số hóa — {name}',enabled:'Hiển thị mũi tên chiều số hóa',help:'Mũi tên chỉ hiển thị trong WaterMapCore. Khi zoom xa dưới min zoom sẽ tạm ẩn để giữ hiệu năng. Nếu render quá chậm nhiều lần, Core sẽ tự tắt config.',reverse:'Đảo chiều số hóa',autoDisabled:'Core đã tự tắt hiển thị chiều số hóa vì render quá chậm. Bạn có thể bật lại trong cấu hình layer.'};
CORE_MESSAGES_VI.cluster={menu:'Clustering',title:'Clustering — {name}',enabled:'Bật gom cụm điểm',radius:'Bán kính gom cụm (px)'};

Object.assign(CORE_MESSAGES_VI.layer,{addNew:'Thêm mới đối tượng'});
CORE_MESSAGES_VI.field={clickToStyle:'Chọn một field để xem các giá trị duy nhất và cấu hình Style/Symbol.',noValues:'Không có giá trị',distinctCount:'Giá trị duy nhất: {count}',styleTitle:'Style theo field — {field}'};
CORE_MESSAGES_VI.create={title:'Thêm mới vào layer {name}',snapEnabled:'Bật bắt dính',vertex:'Bắt Vertex',segment:'Bắt Segment',tolerance:'Dung sai bắt dính (px)',snapLayers:'Layer dùng để bắt dính',noSnapLayers:'Không có layer khác đang hiển thị',start:'Bắt đầu vẽ'};
Object.assign(CORE_MESSAGES_VI.direction,{reverseSelected:'Đảo chiều đối tượng đang chọn',selectOne:'Hãy chọn đúng 1 đối tượng Line trong layer này để đảo chiều.'});
Object.assign(CORE_MESSAGES_VI.toolbar,{select:'Chọn đối tượng',unselect:'Bỏ chọn',topology:'Kiểm tra bắt dính','snap-edit':'Chỉnh bắt dính'});
Object.assign(CORE_MESSAGES_VI.select,{mode:'Select mode: click để chọn; kéo chuột để quét vùng. Shift = thêm, Ctrl = toggle, Esc = bỏ chọn.'});
CORE_MESSAGES_VI.topology={title:'Kiểm tra bắt dính / Topology',resultsTitle:'Kết quả kiểm tra bắt dính',sourceLayer:'Lớp cần kiểm tra',targetLayer:'Lớp phải bắt dính vào',tolerance:'Dung sai (m)',run:'Chạy kiểm tra',help:'Công cụ chỉ kiểm tra và liệt kê lỗi. Không tự bắt dính hoặc tự sửa dữ liệu. Ví dụ ống nhánh có bắt vào ống chính hay không: Lớp cần kiểm tra = ống nhánh, Lớp phải bắt dính vào = ống chính.',needLayers:'Cần ít nhất 2 layer để kiểm tra.',sameLayer:'Hãy chọn 2 layer khác nhau.',notSnapped:'Chưa bắt dính trong dung sai',snapped:'Đã bắt dính',noIntersection:'Không giao cắt với layer đích',rule:'Kiểu kiểm tra',distance:'Khoảng cách (m)',status:'Trạng thái',noErrors:'Không phát hiện lỗi bắt dính theo rule hiện tại.',anyEndpointToSegment:'Chỉ cần 1 endpoint → Segment đích',eachEndpointToSegment:'Tất cả endpoint → Segment đích',anyEndpointToEndpoint:'Chỉ cần 1 endpoint → Endpoint đích',eachEndpointToEndpoint:'Tất cả endpoint → Endpoint đích',intersection:'Geometry phải giao cắt',pointToSegment:'Point → Segment đích',pointToPoint:'Point → Point đích',anyEndpointToPoint:'Chỉ cần 1 endpoint → Point đích',eachEndpointToPoint:'Tất cả endpoint → Point đích',nearestGeometry:'Geometry gần nhất',sourceTargetHint:'Ống nhánh → ống chính thường chọn: Chỉ cần 1 endpoint → Segment đích.'};
CORE_MESSAGES_VI.topologySnap={title:'Topology Edit / Snap',editLayer:'Layer cần chỉnh',targetLayer:'Layer dùng để bắt dính',tolerancePx:'Dung sai hút (px)',help:'Công cụ này chỉ chỉnh geometry. Click đối tượng của layer cần chỉnh để hiện vertex, kéo vertex/endpoint đến gần layer đích để tự hút.',start:'Bắt đầu chỉnh',needLayers:'Cần ít nhất 2 layer để chỉnh bắt dính.',sameLayer:'Có thể dùng cùng layer; đối tượng đang chỉnh sẽ tự được loại khỏi mục tiêu snap.',active:'Snap Tool đang bật: {source} → {target}',stopped:'Đã tắt Topology Edit / Snap',hint:'Snap mode: click feature cần chỉnh → kéo vertex/endpoint. Bấm nút nam châm lần nữa để thoát.',editing:'Đang chỉnh feature {id}',noEditableGeometry:'Geometry này không hỗ trợ chỉnh vertex.',pickSource:'Hãy click đối tượng thuộc layer cần chỉnh.'};

Object.assign(CORE_MESSAGES_VI.toolbar,{pan:'Pan / Di chuyển bản đồ','spatial-update':'Cập nhật không gian'});
CORE_MESSAGES_VI.spatial=Object.assign(CORE_MESSAGES_VI.spatial||{},{title:'Cập nhật không gian',arcMode:'Cập nhật không gian (V): quét vertex trên nhiều layer rồi kéo cả nhóm. Giữ Space để Pan.',stopped:'Đã dừng cập nhật không gian',verticesSelected:'Đã chọn {count} vertex',noVertices:'Không có vertex trong vùng quét'});

Object.assign(CORE_MESSAGES_VI.toolbar,{'sample-demand':'Tạo demand mẫu'});
CORE_MESSAGES_VI.sampleDemand={title:'Tạo demand mẫu cho đồng hồ khách hàng',layer:'Layer đồng hồ',demandField:'Field demand',diameterField:'Field đường kính',enabledField:'Field enabled/status',seed:'Seed dữ liệu mẫu',days:'Số ngày/tháng',variation:'Độ biến thiên',overwrite:'Ghi đè demand hiện có',zeroDisabled:'Đối tượng disabled → demand = 0',help:'Sinh demand tổng hợp theo mức tiêu thụ tháng và đường kính đồng hồ, sau đó quy đổi sang lưu lượng trung bình L/s. Đây là dữ liệu mẫu cho mô phỏng, không phải số đọc đồng hồ thực tế. Nếu chưa có loại khách hàng thì diameter chỉ được dùng như một tín hiệu gần đúng.',preview:'Xem trước',apply:'Áp dụng',previewTitle:'Thống kê dữ liệu sẽ sinh',none:'-- không dùng --',noLayer:'Không có layer nào có field demand để sinh dữ liệu.',count:'Số đối tượng cập nhật',skipped:'Bỏ qua do giữ demand cũ',disabledCount:'Disabled = 0',totalDemand:'Tổng demand',totalMonthly:'Tổng tiêu thụ giả lập',applied:'Đã tạo demand mẫu cho {count} đối tượng.'};

Object.assign(CORE_MESSAGES_VI.toolbar,{'aggregate-junction':'Phân bổ Demand & sinh Junction'});
CORE_MESSAGES_VI.aggregateJunction={title:'Phân bổ Demand & sinh Junction thủy lực',meterLayer:'Layer đồng hồ',demandField:'Field demand',serviceLayer:'Layer mạng ống phân phối/nhánh',mainLayer:'Layer ống chính/nguồn cấp',outputName:'Tên layer Junction tạo mới',meterTolerance:'Dung sai ĐH → mạng ống (m)',mainTolerance:'Dung sai root → ống chính (m)',groupTolerance:'Dung sai nối topology (m)',spurMaxLength:'Chiều dài tối đa nhánh đấu hộ bỏ qua (m)',clusterGap:'Khoảng cách tách cụm ĐH (m)',maxClusterLength:'Chiều dài tối đa một cụm (m)',maxMeters:'Số ĐH tối đa / Junction',help:'Tool dựng topology thủy lực của mạng ống nhánh, bỏ qua các nhánh đấu hộ ngắn, phân bổ đồng hồ lên đúng corridor của mạng và gom các ĐH gần nhau dọc theo cùng corridor. Mỗi cụm tạo 1 Junction với demand bằng tổng demand của cụm. Mục tiêu là tạo hydraulic skeleton hợp lý cho EPANET, không phải 1 ĐH = 1 Junction và cũng không gộp cả tuyến dài thành 1 Junction.',preview:'Xem trước',generate:'Tạo Junction',previewTitle:'Kết quả dự kiến',needLayers:'Cần layer đồng hồ có demand và ít nhất 2 layer Line.',serviceMainDifferent:'Layer mạng ống nhánh và ống chính phải khác nhau.',geometryMismatch:'Sai loại geometry.',nameConflict:'Tên layer {name} đã tồn tại nhưng không phải layer do tool sinh. Hãy đặt tên khác.',rebuildConfirm:'Layer {name} đã tồn tại ({count} Junction). Xóa layer cũ và phân bổ lại từ đầu?',created:'Đã tạo {count} Junction thủy lực trong layer {name}.',meters:'Tổng đồng hồ',services:'Tổng đoạn ống nhánh',serviceComponents:'Số mạng ống liên thông',roots:'Số root nối về ống chính',corridors:'Số corridor thủy lực',corridorsWithDemand:'Corridor có demand',matched:'Đồng hồ phân bổ thành công',unmatchedMeter:'Đồng hồ không gắn được vào mạng ống',unmatchedMain:'Đồng hồ không trace được về root',collapsedSpurs:'Nhánh đấu hộ ngắn đã quy về ống phân phối',junctions:'Junction được tạo',totalDemand:'Tổng demand Junction',demandBalance:'Sai lệch cân bằng demand'};


// v0.6.7.1: built-in Vietnamese fallback for Topology Repair.
// This prevents raw keys (topologyRepair.xxx) even if the host page still caches an older vi.js.
CORE_MESSAGES_VI.topologyRepair={
  title:'Kiểm tra & sửa topology',
  meterLayer:'Layer đồng hồ',
  serviceLayer:'Layer ống đấu hộ',
  mainLayer:'Layer mạng thủy lực / ống chính',
  meterServiceTol:'Auto Fix: ĐH ↔ ống đấu hộ (m)',
  serviceMainTol:'Auto Fix: ống đấu hộ ↔ ống chính (m)',
  mainMainTol:'Auto Fix: endpoint ống chính ↔ ống chính (m)',
  reviewTol:'Khoảng tìm lỗi để Review (m)',
  help:'Scan trước, không sửa dữ liệu. Lỗi nhỏ nằm trong dung sai được xếp Auto Fix; lỗi lớn hoặc mơ hồ chỉ đưa vào Review. Meter được giữ nguyên vị trí: nếu meter gần endpoint ống đấu hộ thì tool kéo endpoint ống về meter.',
  scan:'Quét kiểm tra',
  needLayers:'Cần ít nhất 1 layer Point và 2 layer Line.',
  serviceMainDifferent:'Layer ống đấu hộ và mạng ống chính phải khác nhau.',
  resultsTitle:'Topology Repair — Kết quả kiểm tra',
  safeCount:'Có thể tự sửa',
  reviewCount:'Cần kiểm tra',
  okCount:'Đã đúng',
  applySafe:'Áp dụng Auto Fix',
  rescan:'Quét lại',
  reviewNote:'Chỉ Auto Fix được áp dụng tự động. Các dòng Review không bị thay đổi dữ liệu; click dòng để zoom và kiểm tra.',
  clean:'Không phát hiện lỗi cần sửa trong các quan hệ đã quét.',
  relation:'Quan hệ',source:'Nguồn',target:'Đích',safeFix:'Auto Fix',review:'Review',
  ruleMeterService:'Đồng hồ → ống đấu hộ',
  ruleServiceMain:'Ống đấu hộ → ống chính',
  ruleMainMain:'Ống chính → ống chính',
  noSafeFix:'Không có lỗi an toàn để tự sửa.',
  applied:'Đã sửa tự động {count} điểm topology.'
};

/* ===== src/core/01-watermapcore-base.js ===== */
// Base class: constructor only. Features are attached by modules.
class WaterMapCore {
  constructor(containerId,options={}){
      const el=typeof containerId==='string'?document.getElementById(containerId):containerId;if(!el)throw new Error('WaterMapCore: không tìm thấy container');
      if(!global.L)throw new Error('WaterMapCore cần Leaflet');
      this.container=el;this.config=merge(DEFAULTS,options);this._localeExplicit=Object.prototype.hasOwnProperty.call(options,'locale');this.events={};this.plugins=[];this.translations={vi:merge({},CORE_MESSAGES_VI)};this.locale=this.config.locale||'vi';this.fallbackLocale=this.config.fallbackLocale||'vi';this.layers=[];this.layerIndex=new Map();this.selected=null;this.selection=[];this.pending=null;this.mode='select';this.undoStack=[];this.redoStack=[];this._dirty=false;this._dirtyReason=null;this.editSessionActive=false;this._editSessionSnapshot=null;this.store=new RecentStore(this.config.storage.indexedDbName);this.project=this._newProject();this._homeBounds=null;this._homeView={center:(this.config.map.center||DEFAULTS.map.center).slice(),zoom:this.config.map.zoom||DEFAULTS.map.zoom};
      this._installConfiguredPlugins();this._buildRoot();this._buildMap();this._buildUI();this._bindResize();this._setWorkspaceVisible(false);this._purgeGuest().finally(()=>{this.showRecent(true);setTimeout(()=>this.emit('ready',{core:this}),0);});
    }
}

/* ===== src/core/01b-events.js ===== */
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

/* ===== src/core/02-plugins-i18n.js ===== */
// Module: core/02-plugins-i18n.js
Object.assign(WaterMapCore.prototype, {
  _installConfiguredPlugins(){(this.config.plugins||[]).forEach(p=>this.use(p));},
  use(plugin){if(!plugin)return this;let p=plugin;if(typeof p==='function'&&!p.install)p=p(this.config||{});if(!p||typeof p.install!=='function')throw new Error('WaterMapCore plugin phải có hàm install(core)');if(this.plugins.some(x=>x===p||((x.name&&p.name)&&x.name===p.name)))return this;p.install(this);this.plugins.push(p);this.emit('plugin:installed',{plugin:p});return this;},
  registerLocale(locale,messages){if(!locale||!messages)return this;this.translations[locale]=merge(this.translations[locale]||{},messages);return this;},
  t(key,params={}){const read=(obj,path)=>String(path||'').split('.').reduce((v,k)=>v&&Object.prototype.hasOwnProperty.call(v,k)?v[k]:undefined,obj);let val=read(this.translations[this.locale],key);if(val==null)val=read(this.translations[this.fallbackLocale],key);if(val==null)val=key;if(typeof val!=='string')return val;return val.replace(/\{(\w+)\}/g,(m,k)=>params[k]??m);},
  setLocale(locale,opt={}){if(!locale)return this;this.locale=locale;this.config.locale=locale;if(this.project){this.project.ui=this.project.ui||{};this.project.ui.locale=locale;}if(!opt.silent)this._refreshI18nUI();this.emit('locale:changed',{locale});return this;},
  getLocale(){return this.locale;},
  _refreshI18nUI(){if(this.toolbar){this.toolbar.querySelectorAll('[data-cmd]').forEach(b=>b.title=this.t('toolbar.'+b.dataset.cmd));}if(this.panels){const titles={layers:'panel.layers',attrs:'panel.properties',table:'panel.attributeTable',topology:'topology.resultsTitle'};Object.keys(titles).forEach(k=>{const el=this.panels[k]?.querySelector('.ddc_meko-panel-head span');if(el)el.textContent=this.t(titles[k]);});}if(this.panels?.layers&&!this.panels.layers.classList.contains('hidden'))this.showLayerPanel();}
});

/* ===== src/core/03-shell.js ===== */
// Module: core/03-shell.js
Object.assign(WaterMapCore.prototype, {
  _newProject(){return{format:FORMAT,version:MKS_VERSION,projectId:uuid(),name:'Untitled',createdAt:nowIso(),updatedAt:nowIso(),lastUsedAt:nowIso(),layers:[],map:{center:this.config?.map?.center||DEFAULTS.map.center,zoom:this.config?.map?.zoom||DEFAULTS.map.zoom},ui:{locale:this.locale},thumbnail:null};},
  _buildRoot(){this._panelZCounter=650;this._panelFocusObservers=[];this.container.innerHTML='';this.container.classList.add('ddc_meko-host');this.root=document.createElement('div');this.root.className='ddc_meko-root';this.root.innerHTML='<div class="ddc_meko-map"></div><div class="ddc_meko-context hidden"></div><div class="ddc_meko-toast hidden"></div><div class="ddc_meko-modal-wrap hidden"></div>';this.container.appendChild(this.root);this.mapEl=this.root.querySelector('.ddc_meko-map');this.contextEl=this.root.querySelector('.ddc_meko-context');this.toastEl=this.root.querySelector('.ddc_meko-toast');this.modalWrap=this.root.querySelector('.ddc_meko-modal-wrap');this.root.addEventListener('click',()=>this._hideContext());},
  _buildMap(){const mc=this.config.map||{};const minZoom=Number.isFinite(Number(mc.minZoom))?Number(mc.minZoom):2;const maxZoom=Number.isFinite(Number(mc.maxZoom))?Number(mc.maxZoom):24;const maxNativeZoom=Number.isFinite(Number(mc.maxNativeZoom))?Number(mc.maxNativeZoom):19;this.map=L.map(this.mapEl,{zoomControl:mc.zoomControl!==false,preferCanvas:true,minZoom,maxZoom}).setView(mc.center||DEFAULTS.map.center,Number.isFinite(Number(mc.zoom))?Number(mc.zoom):DEFAULTS.map.zoom);if(mc.osm!==false)L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{minZoom,maxZoom,maxNativeZoom,attribution:'&copy; OpenStreetMap'}).addTo(this.map);this.measureGroup=L.layerGroup().addTo(this.map);this.map.on('moveend zoomend',()=>{const c=this.map.getCenter();this.project.map={center:[c.lat,c.lng],zoom:this.map.getZoom()};clearTimeout(this._dynamicRenderTimer);this._dynamicRenderTimer=setTimeout(()=>this._refreshDynamicRenderers?.(),80);});},
  _setWorkspaceVisible(visible){this.workspaceVisible=!!visible;this.root.classList.toggle('ddc_meko-startup',!visible);if(visible)setTimeout(()=>this.map&&this.map.invalidateSize(false),0);},
  _activateWorkspace(){if(!this.workspaceVisible)this._setWorkspaceVisible(true);},
  _buildUI(){this.toolbar=document.createElement('div');this.toolbar.className='ddc_meko-toolbar';this.toolbar.dataset.pos=this.config.ui.toolbar;this.root.appendChild(this.toolbar);this._syncToolbarOffset();const tools=[['recent','◫'],['export','⇩'],['layers','☷'],['table','▦'],['pan','✋'],['select','⌖'],['spatial-update','⤧'],['unselect','⊘'],['topology-repair','🧰'],['sample-demand','Σ'],['aggregate-junction','JΣ'],['measure','↔'],['clear-measure','×↔'],['home','⌂'],['edit-tools','🛠']];tools.forEach(t=>{const b=document.createElement('button');b.className='ddc_meko-tool';b.dataset.cmd=t[0];b.title=this.t('toolbar.'+t[0]);b.textContent=t[1];b.onclick=e=>{e.stopPropagation();this._command(t[0]);};this.toolbar.appendChild(b);});this._makePanel('layers',this.t('panel.layers'),this.config.ui.layerPanel);this._makePanel('attrs',this.t('panel.properties'),this.config.ui.attributePanel);this._makePanel('table',this.t('panel.attributeTable'),'bottom');this._makePanel('topology',this.t('topology.resultsTitle'),'bottom');this.panels.layers.classList.add('hidden');this.panels.attrs.classList.add('hidden');this.panels.table.classList.add('hidden');this.panels.topology.classList.add('hidden');this._buildEditToolbar?.();},
  _syncToolbarOffset(){
      if(!this.toolbar)return;
      const pos=this.config?.ui?.toolbar||'left';
      if(pos!=='left'){
        this.toolbar.style.top='';
        return;
      }
      // Leaflet zoom control mặc định nằm góc trên-trái. Khi giữ zoom +/-
      // thì đẩy toolbar xuống dưới control; khi tắt zoom, toolbar giữ vị trí gốc.
      this.toolbar.style.top=this.config?.map?.zoomControl===false?'8px':'82px';
    },
  _makePanel(key,title,pos){this.panels=this.panels||{};const p=document.createElement('div');p.className='ddc_meko-panel';p.dataset.pos=pos||'right';p.innerHTML='<div class="ddc_meko-panel-head"><span>'+esc(title)+'</span><button class="ddc_meko-panel-close">×</button></div><div class="ddc_meko-panel-body"></div>';p.querySelector('button').onclick=()=>p.classList.add('hidden');p.addEventListener('pointerdown',()=>this._bringPanelToFront?.(p),true);this.root.appendChild(p);this.panels[key]=p;const mo=new MutationObserver(()=>{if(!p.classList.contains('hidden'))this._bringPanelToFront?.(p);});mo.observe(p,{attributes:true,attributeFilter:['class']});this._panelFocusObservers.push(mo);},
  _floatingWindows(){return [...Object.values(this.panels||{}).filter(Boolean),this.editToolbar].filter(Boolean);},
  _bringPanelToFront(panel){if(!panel)return;const list=this._floatingWindows();if((this._panelZCounter||650)>=1140){list.sort((a,b)=>(Number(a.style.zIndex)||650)-(Number(b.style.zIndex)||650)).forEach((x,i)=>x.style.zIndex=String(650+i));this._panelZCounter=650+list.length;}panel.style.zIndex=String(++this._panelZCounter);},
  _bindResize(){
    this.ro=new ResizeObserver(()=>{requestAnimationFrame(()=>{if(this.map)this.map.invalidateSize(false);this._syncToolbarOffset?.();this._updateEditToolbarOrientation?.();this._clampEditToolbar?.();});});this.ro.observe(this.container);
    const isTypingTarget=e=>{const t=e.target;return !!(t&&(t.matches?.('input,textarea,select')||t.isContentEditable));};
    this._keyHandler=e=>{
      if(isTypingTarget(e))return;
      const k=String(e.key||'').toLowerCase();
      if(e.code==='Space'||e.key===' '){
        if(!this._temporaryPan){this._temporaryPan={mode:this.mode};this.root?.classList.add('ddc_meko-space-pan');try{this.map?.dragging.enable();}catch(_){}}
        e.preventDefault();return;
      }
      if(k==='m'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){this.enableSelectMode?.();e.preventDefault();return;}
      if(k==='v'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){this.enableSpatialUpdate?.();e.preventDefault();return;}
      if(e.key==='Escape'){if(this._createSeries?.active){this._endLayerCreateSeries?.(true);}else if(this.mode==='measure'){this._measure();}else if(this.mode==='select'){this.unselect?.();}else if(this.mode==='spatial-update'){this._clearSpatialSelection?.();}else{this._stopBoxSelect?.();if(this.map?.pm)this.map.pm.disableDraw();}}
    };
    this._keyUpHandler=e=>{
      if((e.code==='Space'||e.key===' ')&&this._temporaryPan){
        const returnMode=this._temporaryPan.mode;this._temporaryPan=null;this.root?.classList.remove('ddc_meko-space-pan');
        // Spatial Update owns the mouse and normally keeps Leaflet dragging disabled.
        if(returnMode==='spatial-update'&&this.mode==='spatial-update'){try{this.map?.dragging.disable();}catch(_){}}
        else{try{this.map?.dragging.enable();}catch(_){}}
        e.preventDefault();
      }
    };
    document.addEventListener('keydown',this._keyHandler);document.addEventListener('keyup',this._keyUpHandler);
  },
  on(n,fn){(this.events[n]=this.events[n]||[]).push(fn);return()=>this.off(n,fn);},
  toast(msg,ms=2200){this.toastEl.textContent=msg;this.toastEl.classList.remove('hidden');clearTimeout(this._toastT);this._toastT=setTimeout(()=>this.toastEl.classList.add('hidden'),ms);},
  _command(c){const f={recent:()=>this.showRecent(),export:()=>this.exportShapefile(),layers:()=>this.showLayerPanel(),table:()=>this.showAttributeTable(),pan:()=>this.enablePanMode?.(),select:()=>this.enableSelectMode?.(),['spatial-update']:()=>this.enableSpatialUpdate?.(),unselect:()=>this.unselect?.(),['topology-repair']:()=>this.showTopologyRepairTool?.(),['sample-demand']:()=>this.showSampleDemandTool?.(),['aggregate-junction']:()=>this.showAggregateJunctionTool?.(),measure:()=>this._measure(),['clear-measure']:()=>this._clearMeasurements(),home:()=>this.goHome(),['edit-tools']:()=>this.toggleEditToolbar()}[c];if(!f)return;try{const r=f();if(r&&typeof r.then==='function')r.catch(err=>{console.error(err);this.toast(err?.message||String(err),5000);});}catch(err){console.error(err);this.toast(err?.message||String(err),5000);}},
  _setToolActive(cmd){if(!this.toolbar)return;this.toolbar.querySelectorAll('.ddc_meko-tool').forEach(b=>b.classList.toggle('active',b.dataset.cmd===cmd));}
});

/* ===== src/project/dirty-state.js ===== */
// Module: project/dirty-state.js
Object.assign(WaterMapCore.prototype, {
  _setDirty(reason='change'){
    this._dirty=true;
    this._dirtyReason=reason;
    this._updateEditToolbarState?.();
    this.emit('project:dirty',{dirty:true,reason});
    return this;
  },
  _markClean(){
    this._dirty=false;
    this._dirtyReason=null;
    this._updateEditToolbarState?.();
    this.emit('project:dirty',{dirty:false});
    return this;
  },
  isDirty(){return !!this._dirty;},
  _confirmProjectSwitch(){
    if(!this.isDirty())return Promise.resolve('discard');
    return new Promise(resolve=>{
      let settled=false;
      const finish=v=>{if(settled)return;settled=true;this._closeModal();resolve(v);};
      const html='<div class="ddc_meko-warning">'+esc(this.t('project.unsavedSwitch'))+'</div>';
      this._modal(this.t('project.unsavedTitle'),html,[
        {text:this.t('project.saveAndContinue'),primary:true,fn:async()=>{try{await this.saveProject();finish('save');}catch(e){console.error(e);this.toast(e?.message||String(e),5000);}}},
        {text:this.t('project.discardAndContinue'),fn:()=>finish('discard')},
        {text:this.t('common.cancel'),fn:()=>finish('cancel')}
      ],{closable:false});
    });
  },
  _resetWorkspaceForProjectSwitch(){
    try{this._cancelPending?.();}catch(e){}
    try{this._stopBoxSelect?.();}catch(e){}
    try{this._clearSelection?.();}catch(e){}
    try{this._clearMeasurements?.();}catch(e){}
    if(this.map?.pm){try{this.map.pm.disableDraw();}catch(e){}try{this.map.pm.disableGlobalEditMode?.();}catch(e){}}
    this.editSessionActive=false;
    this._editSessionSnapshot=null;
    this.undoStack=[];
    this.redoStack=[];
    if(this.panels?.table)this.panels.table.classList.add('hidden');
    if(this.panels?.attrs)this.panels.attrs.classList.add('hidden');
    this.clearLayers(false);
    this._homeBounds=null;
    this.pending=null;
    this.selected=null;
    this.selection=[];
    this._updateEditToolbarState?.();
  }
});

/* ===== src/tools/edit-session.js ===== */
// Module: tools/edit-session.js
Object.assign(WaterMapCore.prototype, {
  _ensureEditSessionForFeatureAction(){
    if(this.editSessionActive)return true;
    if(typeof this.beginEditSession==='function')this.beginEditSession();
    else this.editSessionActive=true;
    return true;
  },
  _snapshot(){return JSON.stringify(this.layers.map(l=>({id:l.id,name:l.name,fc:l.fc,schema:l.schema,style:l.style,visible:l.visible,epanetRole:l.epanetRole,epanetMapping:l.epanetMapping,direction:l.direction,clustering:l.clustering})));},
  _pushUndo(){this.undoStack.push(this._snapshot());if(this.undoStack.length>30)this.undoStack.shift();this.redoStack=[];this._setDirty?.('edit');this._updateEditToolbarState?.();},
  _restore(s){const arr=JSON.parse(s);this.clearLayers(false);this.selection=[];this.selected=null;arr.forEach(x=>this._addLayerRecord(x));this._syncProject();this._updateEditToolbarState?.();},
  undo(){if(!this.undoStack.length)return;this.redoStack.push(this._snapshot());this._restore(this.undoStack.pop());this._setDirty?.('undo');this._updateEditToolbarState?.();},
  redo(){if(!this.redoStack.length)return;this.undoStack.push(this._snapshot());this._restore(this.redoStack.pop());this._setDirty?.('redo');this._updateEditToolbarState?.();},
  _setSelect(){if(this.map.pm){this.map.pm.disableDraw();this.map.pm.disableGlobalEditMode?.();}this.mode='select';this._setToolActive('select');this.toast(this.t('select.mode'));},
  _startDraw(shape){if(this.editToolbar&& !this.editSessionActive){this.toast(this.t('editToolbar.beginFirst'));return;}const l=this.getActiveLayer();if(!l){this.toast(this.t('select.noLayer'));return;}const kind=geomKind(l.geometryType);const allowed=(shape==='Marker'&&kind==='point')||(shape==='Line'&&kind==='line')||(shape==='Polygon'&&kind==='polygon');if(!allowed){this.toast(this.t('select.wrongGeometry'));return;}this.mode='draw';this._setToolActive(shape==='Marker'?'draw-point':shape==='Line'?'draw-line':'draw-polygon');if(!this.map.pm){this.toast(this.t('select.needGeoman'));return;}this.map.pm.enableDraw(shape,{snappable:true});const handler=e=>{this.map.off('pm:create',handler);this.map.pm.disableDraw();const gj=e.layer.toGeoJSON();this.map.removeLayer(e.layer);this._stageCreate(l,gj);};this.map.on('pm:create',handler);},
  _stageCreate(layer,feature){const schema=layer.schema||[];const props={};schema.forEach(f=>props[f.name]=null);feature.properties=props;const preview=L.geoJSON(feature,{style:this._leafStyle(layer),pointToLayer:(f,ll)=>L.circleMarker(ll,this._pointStyle(layer))}).addTo(this.map);this.pending={type:'create',layer,feature,preview};this._showFeatureForm(layer,feature,true);},
  _showFeatureForm(layer,feature,isCreate=false){const body=this.panels.attrs.querySelector('.ddc_meko-panel-body');this.panels.attrs.classList.remove('hidden');let h='<div class="ddc_meko-warning" style="margin-bottom:10px">'+(isCreate?this.t('feature.previewCreate'):this.t('feature.previewEdit'))+'</div>';(layer.schema||[]).filter(f=>f.visible!==false).forEach(f=>{const v=feature.properties?.[f.name]??'';const typ=f.type==='Date'?'date':(f.type==='Integer'||f.type==='Double'?'number':'text');h+='<label class="ddc_meko-field"><span>'+esc(f.alias||f.name)+'</span><input data-field="'+esc(f.name)+'" type="'+typ+'" value="'+esc(v)+'" '+(f.editable===false?'disabled':'')+'></label>';});h+='<div class="ddc_meko-btnrow"><button class="ddc_meko-btn primary" data-act="commit">'+esc(this.t('common.save'))+'</button><button class="ddc_meko-btn" data-act="cancel">'+esc(this.t('common.cancel'))+'</button></div>';body.innerHTML=h;body.querySelectorAll('[data-field]').forEach(inp=>inp.oninput=()=>{const fd=layer.schema.find(x=>x.name===inp.dataset.field);let v=inp.value;if(fd&&(fd.type==='Integer'||fd.type==='Double'))v=v===''?null:Number(v);feature.properties[inp.dataset.field]=v;});body.querySelector('[data-act=commit]').onclick=()=>this._commitPending();body.querySelector('[data-act=cancel]').onclick=()=>this._cancelPending();},
  _commitPending(){const p=this.pending;if(!p)return;const series=(p.type==='create'&&this._createSeries?.active&&this._createSeries.layerId===p.layer.id)?{layerId:this._createSeries.layerId,opt:Object.assign({},this._createSeries.opt)}:null;this._pushUndo();if(p.type==='create'){p.feature.id=uuid();p.layer.fc.features.push(p.feature);}else if(p.type==='edit'){const idx=p.layer.fc.features.findIndex(f=>String(f.id)===String(p.feature.id));if(idx>=0)p.layer.fc.features[idx]=p.feature;}if(p.preview)this.map.removeLayer(p.preview);this.pending=null;this._renderLayer(p.layer);this._syncProject();this.emit(p.type==='create'?'feature:created':'feature:updated',{layer:p.layer,feature:p.feature});this.panels.attrs.classList.add('hidden');if(series)setTimeout(()=>{if(this._createSeries?.active&&this._createSeries.layerId===series.layerId&&!this.pending){const l=this.getLayer(series.layerId);if(l)this._beginLayerCreate?.(l,series.opt);}},0);},
  _cancelPending(){const p=this.pending,series=(p?.type==='create'&&this._createSeries?.active&&this._createSeries.layerId===p.layer.id)?{layerId:this._createSeries.layerId,opt:Object.assign({},this._createSeries.opt)}:null;if(p?.preview)this.map.removeLayer(p.preview);this.pending=null;this.panels.attrs.classList.add('hidden');if(series)setTimeout(()=>{if(this._createSeries?.active&&this._createSeries.layerId===series.layerId&&!this.pending){const l=this.getLayer(series.layerId);if(l)this._beginLayerCreate?.(l,series.opt);}},0);},
  editSelected(){if(!this.selected){this.toast(this.t('select.noFeature'));return;}const {layer,feature}=this.selected;const clone=JSON.parse(JSON.stringify(feature));const preview=L.geoJSON(clone,{style:this._leafStyle(layer),pointToLayer:(f,ll)=>L.circleMarker(ll,this._pointStyle(layer))}).addTo(this.map);const pmLayers=[];preview.eachLayer(x=>{if(x.pm){x.pm.enable({snappable:true});pmLayers.push(x);}});this.pending={type:'edit',layer,feature:clone,preview};const updateGeom=()=>{const gj=preview.toGeoJSON();clone.geometry=gj.type==='FeatureCollection'?gj.features[0].geometry:gj.geometry;};pmLayers.forEach(x=>x.on('pm:edit',updateGeom));this._showFeatureForm(layer,clone,false);},
  deleteSelected(){
    const items=(this.selection&&this.selection.length)?this.selection.slice():(this.selected?[this.selected]:[]);if(!items.length)return;
    if(!confirm(items.length>1?this.t('feature.confirmDeleteMany',{count:items.length}):this.t('feature.confirmDelete')))return;
    this._pushUndo();
    const byLayer=new Map();items.forEach(it=>{const a=byLayer.get(it.layer.id)||{layer:it.layer,ids:new Set(),features:[]};a.ids.add(String(it.feature.id));a.features.push(it.feature);byLayer.set(it.layer.id,a);});
    byLayer.forEach(x=>{x.layer.fc.features=x.layer.fc.features.filter(f=>!x.ids.has(String(f.id)));this._renderLayer(x.layer);});
    this.selection=[];this.selected=null;this._syncProject();this._setDirty?.('delete');this.emit('feature:deleted',{items});this._updateEditToolbarState?.();
  }
});

/* ===== src/tools/spatial-update.js ===== */
// Module: tools/spatial-update.js
// ArcGIS Desktop-inspired Spatial Update mouse mode with multi-layer vertex groups.
// Behaviour:
//   - click/drag a Point                -> move that point
//   - click/drag a Line segment         -> move the two vertices forming that segment
//   - a 2-vertex Line has one segment   -> moving that segment moves the whole feature
//   - drag a rectangle on empty map     -> select vertices across MANY visible layers
//   - drag any selected vertex/segment  -> move all selected vertices as one group
//   - if the box contains all vertices  -> the whole feature moves
//   - Space temporarily pans without leaving Spatial Update mode
Object.assign(WaterMapCore.prototype, {
  _ensureSpatialUpdateStyles(){
    if(document.getElementById('ddc_meko_spatial_update_css'))return;
    const s=document.createElement('style');s.id='ddc_meko_spatial_update_css';
    s.textContent=`
.ddc_meko-spatial-handle{background:#fff;border:2px solid #1677ff;border-radius:50%;box-sizing:border-box;box-shadow:0 0 0 2px rgba(255,255,255,.88);cursor:move}
.ddc_meko-spatial-handle.endpoint{border-color:#e5484d}.ddc_meko-spatial-handle.selected{background:#dff4f7;box-shadow:0 0 0 3px rgba(22,119,255,.18)}
.ddc_meko-spatial-box{position:absolute;z-index:925;border:1px dashed #1677ff;background:rgba(22,119,255,.10);pointer-events:none}
.ddc_meko-spatial-preview{pointer-events:none}.ddc_meko-spatial-active{cursor:crosshair!important}.ddc_meko-space-pan,.ddc_meko-space-pan .ddc_meko-map{cursor:grab!important}.ddc_meko-space-pan:active,.ddc_meko-space-pan .ddc_meko-map:active{cursor:grabbing!important}
`;
    document.head.appendChild(s);
  },

  showSpatialUpdateTool(){
    return this.enableSpatialUpdate();
  },

  enableSpatialUpdate(){
    if(!this.editSessionActive){this.toast(this.t('editToolbar.beginFirst'));return;}
    this.disableSelectMode?.();
    this.stopSpatialUpdate(false);
    this._ensureSpatialUpdateStyles();
    this._spatialUpdate={active:true,selection:[],handles:[],drag:null};
    this.mode='spatial-update';
    this._setToolActive?.('spatial-update');
    this.root?.classList.add('ddc_meko-spatial-active');
    try{this.map?.dragging.disable();}catch(_){ }
    this._installSpatialBoxHandlers();
    this._spatialEscHandler=e=>{if(e.key==='Escape'){this._clearSpatialSelection();}};
    document.addEventListener('keydown',this._spatialEscHandler,true);
    this.toast(this.t('spatial.arcMode')||'Cập nhật không gian: kéo segment/point hoặc quét vertex để chỉnh.',3500);
    this.emit?.('spatial:mode',{mode:'spatial-update'});
    this._updateEditToolbarState?.();
  },

  stopSpatialUpdate(showToast=true){
    this._clearSpatialSelection();
    this._removeSpatialBox();
    this._removeSpatialPreview();
    if(this._spatialBoxHandlers){
      const h=this._spatialBoxHandlers;
      h.el.removeEventListener('mousedown',h.down,true);
      document.removeEventListener('mousemove',h.move,true);
      document.removeEventListener('mouseup',h.up,true);
      this._spatialBoxHandlers=null;
    }
    if(this._spatialEscHandler){document.removeEventListener('keydown',this._spatialEscHandler,true);this._spatialEscHandler=null;}
    this.root?.classList.remove('ddc_meko-spatial-active');
    this._spatialUpdate=null;
    if(this.mode==='spatial-update')this.mode='pan';
    try{this.map?.dragging.enable();}catch(_){ }
    this._setToolActive?.('pan');
    this._updateEditToolbarState?.();
    if(showToast)this.toast(this.t('spatial.stopped'));
    this.emit?.('spatial:mode',{mode:null});
  },

  enablePanMode(){
    this._cancelSelectionDrag?.();
    if(this.mode==='spatial-update')this.stopSpatialUpdate(false);
    if(this.map?.pm){try{this.map.pm.disableDraw();}catch(_){ }}
    this.mode='pan';
    try{this.map?.dragging.enable();}catch(_){ }
    this._setToolActive?.('pan');
    this.emit?.('pan:mode',{enabled:true});
  },

  _spatialSnapshotPush(snapshot){
    if(!snapshot)return;
    this.undoStack.push(snapshot);if(this.undoStack.length>30)this.undoStack.shift();
    this.redoStack=[];this._setDirty?.('spatial-update');this._updateEditToolbarState?.();
  },

  _geometryVertexEntries(layer,feature){
    const g=feature?.geometry;if(!g)return[];const out=[];
    const addLine=(coords,prefix,closed=false)=>{const n=coords.length-(closed&&coords.length>1?1:0);for(let i=0;i<n;i++)out.push({layer,feature,path:[...prefix,i],coord:coords[i],endpoint:!closed&&(i===0||i===n-1)});};
    switch(g.type){
      case'Point':out.push({layer,feature,path:[],coord:g.coordinates,endpoint:true});break;
      case'MultiPoint':g.coordinates.forEach((c,i)=>out.push({layer,feature,path:[i],coord:c,endpoint:true}));break;
      case'LineString':addLine(g.coordinates,[],false);break;
      case'MultiLineString':g.coordinates.forEach((c,i)=>addLine(c,[i],false));break;
      case'Polygon':g.coordinates.forEach((c,i)=>addLine(c,[i],true));break;
      case'MultiPolygon':g.coordinates.forEach((poly,i)=>poly.forEach((c,j)=>addLine(c,[i,j],true)));break;
    }
    return out;
  },

  _geometrySegmentEntries(layer,feature){
    const g=feature?.geometry;if(!g)return[];const out=[];
    const add=(coords,prefix,closed=false)=>{
      const n=coords.length-(closed&&coords.length>1?1:0);if(n<2)return;
      for(let i=0;i<n-1;i++)out.push({layer,feature,a:{path:[...prefix,i],coord:coords[i]},b:{path:[...prefix,i+1],coord:coords[i+1]}});
      if(closed&&n>2)out.push({layer,feature,a:{path:[...prefix,n-1],coord:coords[n-1]},b:{path:[...prefix,0],coord:coords[0]}});
    };
    switch(g.type){
      case'LineString':add(g.coordinates,[],false);break;
      case'MultiLineString':g.coordinates.forEach((c,i)=>add(c,[i],false));break;
      case'Polygon':g.coordinates.forEach((c,i)=>add(c,[i],true));break;
      case'MultiPolygon':g.coordinates.forEach((poly,i)=>poly.forEach((c,j)=>add(c,[i,j],true)));break;
    }
    return out;
  },

  _spatialEntryKey(ent){return String(ent.layer.id)+'::'+String(ent.feature.id)+'::'+ent.path.join('.');},
  _dedupeSpatialEntries(entries){const m=new Map();for(const e of entries||[])m.set(this._spatialEntryKey(e),e);return[...m.values()];},

  _pointSegmentDistancePx(p,a,b){
    const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,den=vx*vx+vy*vy;
    let t=den?((wx*vx+wy*vy)/den):0;t=Math.max(0,Math.min(1,t));
    const q=L.point(a.x+t*vx,a.y+t*vy),dx=p.x-q.x,dy=p.y-q.y;
    return{distance:Math.sqrt(dx*dx+dy*dy),point:q,t};
  },

  _pickSpatialPart(layer,feature,oe){
    const mapEl=this.map.getContainer(),r=mapEl.getBoundingClientRect(),p=L.point(oe.clientX-r.left,oe.clientY-r.top);
    const vertices=this._geometryVertexEntries(layer,feature);
    if(!vertices.length)return[];
    // Point geometries always move as a whole point.
    if(feature.geometry?.type==='Point'||feature.geometry?.type==='MultiPoint')return[vertices[0]];
    // Clicking very close to a vertex moves only that vertex (Arc-style vertex priority).
    let bestV=null,bestVD=Infinity;
    for(const v of vertices){const vp=this.map.latLngToContainerPoint([v.coord[1],v.coord[0]]),d=p.distanceTo(vp);if(d<bestVD){bestVD=d;bestV=v;}}
    if(bestV&&bestVD<=7)return[bestV];
    // Otherwise choose the nearest segment and move the two vertices forming that segment.
    let bestS=null,bestSD=Infinity;
    for(const s of this._geometrySegmentEntries(layer,feature)){
      const a=this.map.latLngToContainerPoint([s.a.coord[1],s.a.coord[0]]),b=this.map.latLngToContainerPoint([s.b.coord[1],s.b.coord[0]]),d=this._pointSegmentDistancePx(p,a,b).distance;
      if(d<bestSD){bestSD=d;bestS=s;}
    }
    if(bestS){
      const byPath=new Map(vertices.map(v=>[v.path.join('.'),v]));
      return this._dedupeSpatialEntries([byPath.get(bestS.a.path.join('.')),byPath.get(bestS.b.path.join('.'))].filter(Boolean));
    }
    return vertices;
  },

  // Hook called by layer-renderer on mousedown while Spatial Update is active.
  _beginSpatialFeatureDrag(layer,feature,leafletLayer,e){
    if(this.mode!=='spatial-update'||!this.editSessionActive||this._temporaryPan)return false;
    const oe=e?.originalEvent||e;if(!oe||oe.button!==0)return false;
    L.DomEvent.stopPropagation(e);L.DomEvent.preventDefault(e);
    const picked=this._pickSpatialPart(layer,feature,oe);if(!picked.length)return false;
    // If the clicked vertex/segment is already part of a rectangle/multi-layer selection,
    // keep the whole current selection and drag it as one group. Otherwise replace it.
    const current=this._spatialUpdate?.selection||[];
    const currentKeys=new Set(current.map(x=>this._spatialEntryKey(x)));
    const touchesCurrent=picked.some(x=>currentKeys.has(this._spatialEntryKey(x)));
    const dragEntries=touchesCurrent&&current.length?current:picked;
    if(!touchesCurrent)this._setSpatialSelection(picked);
    this._beginSpatialEntriesDrag(dragEntries,oe);
    return true;
  },

  _setSpatialSelection(entries){
    if(!this._spatialUpdate)return;
    this._spatialUpdate.selection=this._dedupeSpatialEntries(entries);
    this._createSpatialHandles(this._spatialUpdate.selection);
    this.emit?.('spatial:selection',{entries:this._spatialUpdate.selection.slice()});
  },

  _clearSpatialSelection(){
    this._clearSpatialHandles();
    if(this._spatialUpdate)this._spatialUpdate.selection=[];
  },

  _createSpatialHandles(entries){
    this._clearSpatialHandles();if(!this._spatialUpdate)return;this._spatialUpdate.handles=[];
    for(const ent of entries||[]){
      const ll=L.latLng(ent.coord[1],ent.coord[0]),size=ent.endpoint?11:9;
      const icon=L.divIcon({className:'',html:'<div class="ddc_meko-spatial-handle selected '+(ent.endpoint?'endpoint':'')+'" style="width:'+size+'px;height:'+size+'px"></div>',iconSize:[size,size],iconAnchor:[size/2,size/2]});
      const m=L.marker(ll,{icon,zIndexOffset:1800,keyboard:false}).addTo(this.map);m._ddcSpatialEntry=ent;
      m.on('mousedown',ev=>{const oe=ev.originalEvent||ev;if(oe.button!==0)return;L.DomEvent.stopPropagation(ev);L.DomEvent.preventDefault(ev);this._beginSpatialEntriesDrag(this._spatialUpdate.selection,oe);});
      this._spatialUpdate.handles.push(m);
    }
  },
  _clearSpatialHandles(){if(!this._spatialUpdate?.handles)return;for(const m of this._spatialUpdate.handles){try{this.map.removeLayer(m);}catch(_){ }}this._spatialUpdate.handles=[];},

  _getSpatialCoordinate(geometry,path){
    if(!geometry)return null;if(geometry.type==='Point')return geometry.coordinates;
    let arr=geometry.coordinates;for(const i of path||[])arr=arr?.[i];return arr;
  },
  _setSpatialCoordinate(geometry,path,coord){
    if(!geometry)return;if(geometry.type==='Point'){geometry.coordinates=[...coord];return;}
    let arr=geometry.coordinates;for(let i=0;i<path.length-1;i++)arr=arr[path[i]];const idx=path[path.length-1];if(idx==null)return;
    const old=arr[idx],next=[coord[0],coord[1],...(Array.isArray(old)?old.slice(2):[])];arr[idx]=next;
    if((geometry.type==='Polygon'||geometry.type==='MultiPolygon')&&idx===0&&Array.isArray(arr)&&arr.length>1){const last=arr.length-1;if(Array.isArray(arr[last]))arr[last]=[...next];}
  },

  _shiftSpatialCoord(coord,dx,dy){
    const p=this.map.latLngToLayerPoint(L.latLng(coord[1],coord[0]));
    const ll=this.map.layerPointToLatLng(L.point(p.x+dx,p.y+dy));
    return[ll.lng,ll.lat,...coord.slice(2)];
  },

  _beginSpatialEntriesDrag(entries,oe){
    entries=this._dedupeSpatialEntries(entries);if(!entries.length)return;
    const mapEl=this.map.getContainer(),mr=mapEl.getBoundingClientRect(),startPt=L.point(oe.clientX-mr.left,oe.clientY-mr.top),snapshot=this._snapshot();
    const groups=new Map();
    for(const ent of entries){
      const key=String(ent.layer.id)+'::'+String(ent.feature.id);
      if(!groups.has(key))groups.set(key,{layer:ent.layer,feature:ent.feature,startGeometry:JSON.parse(JSON.stringify(ent.feature.geometry)),entries:[]});
      groups.get(key).entries.push(ent);
    }
    let moved=false,lastDx=0,lastDy=0;
    try{this.map.dragging.disable();}catch(_){ }
    const move=ev=>{
      const pt=L.point(ev.clientX-mr.left,ev.clientY-mr.top),dx=pt.x-startPt.x,dy=pt.y-startPt.y;if(Math.abs(dx)+Math.abs(dy)<2)return;
      moved=true;lastDx=dx;lastDy=dy;
      const previews=[];
      for(const g of groups.values()){
        const geom=JSON.parse(JSON.stringify(g.startGeometry));
        for(const ent of g.entries){const base=this._getSpatialCoordinate(g.startGeometry,ent.path);if(base)this._setSpatialCoordinate(geom,ent.path,this._shiftSpatialCoord(base,dx,dy));}
        previews.push({layer:g.layer,feature:g.feature,geometry:geom});
      }
      this._renderSpatialSelectionPreview(previews);
      this._updateSpatialHandlePositions(entries,dx,dy,groups);
      ev.preventDefault();ev.stopPropagation();
    };
    const up=ev=>{
      document.removeEventListener('mousemove',move,true);document.removeEventListener('mouseup',up,true);this._removeSpatialPreview();
      if(moved){
        this._spatialSnapshotPush(snapshot);
        const touched=new Map();
        for(const g of groups.values()){
          const geom=JSON.parse(JSON.stringify(g.startGeometry));
          for(const ent of g.entries){const base=this._getSpatialCoordinate(g.startGeometry,ent.path);if(base)this._setSpatialCoordinate(geom,ent.path,this._shiftSpatialCoord(base,lastDx,lastDy));}
          g.feature.geometry=geom;touched.set(g.layer.id,g.layer);
        }
        for(const l of touched.values())this._renderLayer(l);
        this._syncProject();this._setDirty?.('spatial-update');
        this.emit?.('feature:geometry-updated',{entries:entries.slice(),mode:'spatial-update'});
      }
      // Keep Spatial Update mode active and rebuild handles from the committed geometry.
      const refreshed=[];
      for(const ent of entries){const all=this._geometryVertexEntries(ent.layer,ent.feature),match=all.find(x=>x.path.join('.')===ent.path.join('.'));if(match)refreshed.push(match);}
      this._setSpatialSelection(refreshed);
      ev?.preventDefault?.();ev?.stopPropagation?.();
    };
    document.addEventListener('mousemove',move,true);document.addEventListener('mouseup',up,true);
  },

  _updateSpatialHandlePositions(entries,dx,dy,groups){
    if(!this._spatialUpdate?.handles)return;
    const byKey=new Map();
    for(const g of groups.values())for(const ent of g.entries){const base=this._getSpatialCoordinate(g.startGeometry,ent.path);if(base)byKey.set(this._spatialEntryKey(ent),this._shiftSpatialCoord(base,dx,dy));}
    for(const m of this._spatialUpdate.handles){const ent=m._ddcSpatialEntry,c=byKey.get(this._spatialEntryKey(ent));if(c)m.setLatLng([c[1],c[0]]);}
  },

  _renderSpatialSelectionPreview(items){
    this._removeSpatialPreview();const group=L.layerGroup().addTo(this.map);
    for(const it of items){
      const f={type:'Feature',id:it.feature.id,properties:it.feature.properties||{},geometry:it.geometry};
      const gj=L.geoJSON(f,{interactive:false,style:x=>Object.assign({},this._featureLeafStyle(it.layer,x),{dashArray:'6 4',opacity:.82}),pointToLayer:(x,ll)=>this._pointToLayerStyled(it.layer,x,ll)}).addTo(group);
      gj.eachLayer?.(x=>{x.options.interactive=false;if(x._path)x._path.style.pointerEvents='none';});
    }
    this._spatialPreview=group;
  },
  _removeSpatialPreview(){if(this._spatialPreview){try{this.map.removeLayer(this._spatialPreview);}catch(_){}this._spatialPreview=null;}},

  _installSpatialBoxHandlers(){
    if(this._spatialBoxHandlers||!this.map)return;const el=this.map.getContainer();
    const down=e=>{
      if(this.mode!=='spatial-update'||this._temporaryPan||e.button!==0)return;
      if(e.target.closest?.('.leaflet-marker-icon,.leaflet-interactive,.leaflet-control,.ddc_meko-panel,.ddc_meko-toolbar,.ddc_meko-edit-toolbar,.ddc_meko-modal'))return;
      const r=el.getBoundingClientRect();this._spatialDrag={sx:e.clientX-r.left,sy:e.clientY-r.top,x:e.clientX-r.left,y:e.clientY-r.top,moved:false};
      try{this.map.dragging.disable();}catch(_){ }e.preventDefault();e.stopPropagation();
    };
    const move=e=>{const d=this._spatialDrag;if(!d)return;const r=el.getBoundingClientRect();d.x=Math.max(0,Math.min(r.width,e.clientX-r.left));d.y=Math.max(0,Math.min(r.height,e.clientY-r.top));if(Math.abs(d.x-d.sx)+Math.abs(d.y-d.sy)>4)d.moved=true;if(d.moved)this._drawSpatialBox(d);e.preventDefault();e.stopPropagation();};
    const up=e=>{
      const d=this._spatialDrag;if(!d)return;this._spatialDrag=null;this._removeSpatialBox();if(!d.moved)return;
      const left=Math.min(d.sx,d.x),right=Math.max(d.sx,d.x),top=Math.min(d.sy,d.y),bottom=Math.max(d.sy,d.y),hits=[];
      // Intentionally scan every visible layer. One rectangle may select vertices from
      // main pipes, service pipes, junctions, polygons... and move them together.
      for(const l of this.layers.filter(x=>x.visible!==false))for(const f of l.fc.features||[])for(const ent of this._geometryVertexEntries(l,f)){
        const p=this.map.latLngToContainerPoint([ent.coord[1],ent.coord[0]]);if(p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom)hits.push(ent);
      }
      const op=(e.shiftKey?'add':(e.ctrlKey||e.metaKey?'toggle':'replace'));
      let next=hits;
      if(op!=='replace'){
        const m=new Map((this._spatialUpdate?.selection||[]).map(x=>[this._spatialEntryKey(x),x]));
        for(const h of hits){const k=this._spatialEntryKey(h);if(op==='toggle'&&m.has(k))m.delete(k);else m.set(k,h);}
        next=[...m.values()];
      }
      this._setSpatialSelection(next);
      this.toast(next.length?this.t('spatial.verticesSelected',{count:next.length}):this.t('spatial.noVertices'),2500);
      e.preventDefault();e.stopPropagation();
    };
    el.addEventListener('mousedown',down,true);document.addEventListener('mousemove',move,true);document.addEventListener('mouseup',up,true);this._spatialBoxHandlers={el,down,move,up};
  },
  _drawSpatialBox(d){if(!this._spatialBoxEl){this._spatialBoxEl=document.createElement('div');this._spatialBoxEl.className='ddc_meko-spatial-box';this.root.appendChild(this._spatialBoxEl);}Object.assign(this._spatialBoxEl.style,{left:Math.min(d.sx,d.x)+'px',top:Math.min(d.sy,d.y)+'px',width:Math.abs(d.x-d.sx)+'px',height:Math.abs(d.y-d.sy)+'px'});},
  _removeSpatialBox(){if(this._spatialBoxEl){this._spatialBoxEl.remove();this._spatialBoxEl=null;}}
});

/* ===== src/tools/layer-create.js ===== */
// Module: tools/layer-create.js - Add New from a concrete layer context, with persistent snapping setup.
Object.assign(WaterMapCore.prototype, {
  addNewFeatureToLayer(layerId){
    const l=this.getLayer(layerId);if(!l)return;this.activeLayerId=l.id;
    if(!this.editSessionActive){this.toast(this.t('editToolbar.beginFirst'));return;}
    if(!this.map.pm){this.toast(this.t('select.needGeoman'));return;}
    const kind=geomKind(l.geometryType);if(!['point','line','polygon'].includes(kind))return;
    // Starting Add New for another layer ends only the previous Add New series; it does not touch other tools/modules.
    if(this._createSeries?.active)this._endLayerCreateSeries?.(false);
    const candidates=this.layers.filter(x=>x.id!==l.id&&x.visible!==false);
    const checks=candidates.map(x=>'<label style="display:block;padding:2px 0"><input type="checkbox" data-snap-layer value="'+esc(x.id)+'" checked> '+esc(x.name)+'</label>').join('');
    const h='<label class="ddc_meko-field"><span>'+esc(this.t('create.snapEnabled'))+'</span><input id="ddcSnapEnabled" type="checkbox" checked></label><div class="ddc_meko-btnrow"><label><input id="ddcSnapVertex" type="checkbox" checked> '+esc(this.t('create.vertex'))+'</label><label><input id="ddcSnapSegment" type="checkbox" checked> '+esc(this.t('create.segment'))+'</label></div><label class="ddc_meko-field"><span>'+esc(this.t('create.tolerance'))+'</span><input id="ddcSnapDistance" type="number" min="3" max="50" value="10"></label><div><b>'+esc(this.t('create.snapLayers'))+'</b><div style="max-height:140px;overflow:auto">'+(checks||'<span class="ddc_meko-empty">'+esc(this.t('create.noSnapLayers'))+'</span>')+'</div></div>';
    this._modal(this.t('create.title',{name:l.name}),h,[{text:this.t('create.start'),primary:true,fn:()=>{
      const opt={snappable:this.modalWrap.querySelector('#ddcSnapEnabled').checked,snapDistance:Number(this.modalWrap.querySelector('#ddcSnapDistance').value)||10,snapVertex:this.modalWrap.querySelector('#ddcSnapVertex').checked,snapSegment:this.modalWrap.querySelector('#ddcSnapSegment').checked,snapLayerIds:[...this.modalWrap.querySelectorAll('[data-snap-layer]:checked')].map(x=>x.value)};
      this._closeModal();
      this._createSeries={active:true,layerId:l.id,opt:Object.assign({},opt)};
      this._beginLayerCreate(l,opt);
    }},{text:this.t('common.cancel'),fn:()=>this._closeModal()}]);
  },

  _beginLayerCreate(layer,opt){
    if(!layer||this.pending)return;
    const kind=geomKind(layer.geometryType),shape=kind==='point'?'Marker':kind==='line'?'Line':'Polygon';this.mode='draw';
    const allChildren=[];this.layers.forEach(l=>l.leaflet?.eachLayer?.(x=>allChildren.push({owner:l,leaf:x,old:x.options?.pmIgnore})));
    const allowed=new Set(opt.snapLayerIds||[]);allChildren.forEach(x=>{if(x.leaf?.options)x.leaf.options.pmIgnore=!(x.owner.id===layer.id||allowed.has(x.owner.id));});
    const ses=this._layerCreateSession={layerId:layer.id,opt:Object.assign({},opt),allowed,activeSnapPoint:null,isSnapped:false,lastCommittedSnapPoint:null};
    const restore=()=>allChildren.forEach(x=>{if(x.leaf?.options){if(x.old===undefined)delete x.leaf.options.pmIgnore;else x.leaf.options.pmIgnore=x.old;}});
    const drawOpt={snappable:!!opt.snappable,snapDistance:opt.snapDistance||10};
    const v=this._resolveFeatureVisualStyle?.(layer,{properties:{}})||{};if(kind!=='point')drawOpt.pathOptions={color:v.color||'#0b8ea6',weight:Number(v.weight)||3,opacity:v.opacity??.9,fillColor:v.fillColor||v.color||'#52b5c5',fillOpacity:v.fillOpacity??.25};
    let preview=null;

    const setActiveSnap=(ll)=>{ses.activeSnapPoint=L.latLng(ll.lat,ll.lng);ses.isSnapped=true;return ses.activeSnapPoint;};
    const clearActiveSnap=()=>{ses.activeSnapPoint=null;ses.isSnapped=false;};
    const snapOrMouse=(rawLL)=>{
      if(!rawLL)return rawLL;
      if(!ses.opt?.snappable){clearActiveSnap();return rawLL;}
      const c=this._nearestCreateSnapCandidate?.(rawLL,ses);
      if(c?.latlng)return setActiveSnap(c.latlng);
      // Snap latch / hysteresis: once the UI visibly snapped, a small cursor drift must not
      // silently fall back to the raw mouse coordinate. Release only after moving clearly away.
      if(ses.isSnapped&&ses.activeSnapPoint){
        const p=this.map.latLngToLayerPoint(rawLL),q=this.map.latLngToLayerPoint(ses.activeSnapPoint);
        const releasePx=Math.max((Number(ses.opt.snapDistance)||10)*1.8,(Number(ses.opt.snapDistance)||10)+6);
        if(p.distanceTo(q)<=releasePx)return ses.activeSnapPoint;
      }
      clearActiveSnap();return rawLL;
    };

    const moveHandler=e=>{
      const current=this._layerCreateSession;if(!current||current!==ses)return;
      const ll=snapOrMouse(e.latlng);
      if(kind==='point'&&ll){if(!preview){preview=this._pointToLayerStyled(layer,{properties:{}},ll);preview.options.interactive=false;preview.addTo(this.map);}else preview.setLatLng?.(ll);}
    };

    // Capture the coordinate that a real draw click is going to commit. This listener is
    // registered before Geoman draw mode, so pm:create can trust lastCommittedSnapPoint.
    const clickCapture=e=>{
      if(this._layerCreateSession!==ses||!e?.latlng)return;
      const ll=snapOrMouse(e.latlng);
      ses.lastCommittedSnapPoint=ses.isSnapped&&ses.activeSnapPoint?L.latLng(ses.activeSnapPoint.lat,ses.activeSnapPoint.lng):null;
      ses.lastCommittedLatLng=ll?L.latLng(ll.lat,ll.lng):null;
    };

    this.map.on('mousemove',moveHandler);
    this.map.on('click',clickCapture);

    const cleanup=()=>{
      this.map.off('pm:create',created);this.map.off('mousemove',moveHandler);this.map.off('click',clickCapture);
      if(preview){try{this.map.removeLayer(preview);}catch(_){}preview=null;}
      restore();
      if(this._layerCreateSession===ses)this._layerCreateSession=null;
      if(this._layerCreateCleanup===cleanup)this._layerCreateCleanup=null;
      try{this.map.pm.disableDraw();}catch(_){}
      this.mode='select';
    };
    this._layerCreateCleanup=cleanup;

    const created=e=>{
      // The coordinate that was visibly snapped at the last click is authoritative.
      // Never re-read the raw cursor coordinate at finish time.
      const sp=ses.lastCommittedSnapPoint||(ses.isSnapped?ses.activeSnapPoint:null);
      if(sp)this._commitLayerCreateSnapPoint?.(e.layer,kind,sp);
      const gj=e.layer.toGeoJSON();try{this.map.removeLayer(e.layer);}catch(_){}cleanup();this._stageCreate(layer,gj);
    };

    this.map.on('pm:create',created);this.map.pm.enableDraw(shape,drawOpt);
  },

  _endLayerCreateSeries(cancelPending=false){
    try{this._layerCreateCleanup?.();}catch(_){}
    this._createSeries=null;
    if(cancelPending&&this.pending?.type==='create'){
      if(this.pending.preview){try{this.map.removeLayer(this.pending.preview);}catch(_){} }
      this.pending=null;this.panels?.attrs?.classList.add('hidden');
    }
    try{this.map?.pm?.disableDraw?.();}catch(_){}
    if(this.mode==='draw')this.mode='select';
  },

  _commitLayerCreateSnapPoint(drawLayer,kind,snapLL){
    if(!drawLayer||!snapLL)return;
    if(kind==='point'){drawLayer.setLatLng?.(snapLL);return;}
    const latlngs=drawLayer.getLatLngs?.();if(!Array.isArray(latlngs)||!latlngs.length)return;
    if(kind==='line'){
      const line=Array.isArray(latlngs[0])?latlngs[0]:latlngs;if(line.length)line[line.length-1]=L.latLng(snapLL.lat,snapLL.lng);drawLayer.setLatLngs(latlngs);return;
    }
    if(kind==='polygon'){
      const ring=Array.isArray(latlngs[0])?latlngs[0]:latlngs;if(ring.length)ring[ring.length-1]=L.latLng(snapLL.lat,snapLL.lng);drawLayer.setLatLngs(latlngs);
    }
  },

  _nearestCreateSnapCandidate(rawLL,session){
    if(!session?.opt?.snappable||!rawLL)return null;
    const limit=Math.max(1,Number(session.opt.snapDistance)||10),p=this.map.latLngToLayerPoint(rawLL);let best=null;
    const useVertex=session.opt.snapVertex!==false,useSegment=session.opt.snapSegment!==false;
    // When targets overlap, prefer a concrete Point/Junction over a line vertex/segment.
    // This is important when a junction lies exactly on a pipe: clicking the junction must
    // commit the junction coordinate, not the underlying line segment coordinate.
    const rank={point:0,vertex:1,endpoint:2,segment:3};
    const better=(type,d)=>!best||(rank[type]??9)<(rank[best.type]??9)||((rank[type]??9)===(rank[best.type]??9)&&d<best.distancePx);
    const consider=(ll,type,layer,feature)=>{const q=this.map.latLngToLayerPoint(ll),d=p.distanceTo(q);if(d<=limit&&better(type,d))best={latlng:L.latLng(ll.lat,ll.lng),distancePx:d,type,layer,feature};};
    const seg=(aLL,bLL,layer,feature)=>{const a=this.map.latLngToLayerPoint(aLL),b=this.map.latLngToLayerPoint(bLL);const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;let t=0;if(l2>0)t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2));const q=L.point(a.x+t*dx,a.y+t*dy),d=p.distanceTo(q);if(d<=limit&&better('segment',d))best={latlng:this.map.layerPointToLatLng(q),distancePx:d,type:'segment',layer,feature};};
    for(const l of this.layers||[]){if(!session.allowed?.has(l.id)||l.visible===false)continue;for(const f of l.fc?.features||[]){const g=f.geometry;if(!g)continue;const visitLine=(coords)=>{if(!coords?.length)return;if(useVertex)for(const c of coords)consider(L.latLng(c[1],c[0]),'vertex',l,f);if(useSegment)for(let i=1;i<coords.length;i++)seg(L.latLng(coords[i-1][1],coords[i-1][0]),L.latLng(coords[i][1],coords[i][0]),l,f);};if(g.type==='Point'){if(useVertex)consider(L.latLng(g.coordinates[1],g.coordinates[0]),'point',l,f);}else if(g.type==='MultiPoint'){if(useVertex)for(const c of g.coordinates||[])consider(L.latLng(c[1],c[0]),'point',l,f);}else if(g.type==='LineString')visitLine(g.coordinates);else if(g.type==='MultiLineString')for(const a of g.coordinates||[])visitLine(a);else if(g.type==='Polygon')for(const a of g.coordinates||[])visitLine(a);else if(g.type==='MultiPolygon')for(const poly of g.coordinates||[])for(const a of poly||[])visitLine(a);}}
    return best;
  },

  _dispatchCreateMapClick(ll){
    if(!ll||!this.map)return;
    const cp=this.map.latLngToContainerPoint(ll),lp=this.map.latLngToLayerPoint(ll),container=this.map.getContainer(),rr=container.getBoundingClientRect();
    const init={bubbles:true,cancelable:true,view:window,clientX:rr.left+cp.x,clientY:rr.top+cp.y,button:0,buttons:0};
    // IMPORTANT: an existing Leaflet feature stops DOM propagation before the map receives the click.
    // Fire the Leaflet map event directly so Geoman gets the same click even when the user clicked
    // a Junction/Point/Line. The authoritative coordinate is the already-resolved snapped point.
    const originalEvent=new MouseEvent('click',init);
    this.map.fire('mousemove',{latlng:ll,containerPoint:cp,layerPoint:lp,originalEvent});
    this.map.fire('click',{latlng:ll,containerPoint:cp,layerPoint:lp,originalEvent});
  },

  _handleCreateTargetClick(layer,feature,e){
    const ses=this._layerCreateSession;if(this.mode!=='draw'||!ses?.opt?.snappable||!ses.allowed?.has(layer.id))return false;
    const raw=e?.latlng;if(!raw)return false;
    const c=this._nearestCreateSnapCandidate(raw,ses),ll=c?.latlng||raw;
    if(c?.latlng){ses.activeSnapPoint=L.latLng(ll.lat,ll.lng);ses.isSnapped=true;ses.lastCommittedSnapPoint=L.latLng(ll.lat,ll.lng);}else{ses.activeSnapPoint=null;ses.isSnapped=false;ses.lastCommittedSnapPoint=null;}
    ses.lastCommittedLatLng=L.latLng(ll.lat,ll.lng);
    this._dispatchCreateMapClick(ll);
    return true;
  },

  reverseSelectedDirection(layerId){
    const items=(this.selection||[]).filter(x=>x.layer?.id===layerId&&geomKind(x.layer.geometryType)==='line');if(items.length!==1){this.toast(this.t('direction.selectOne'));return;}this.reverseFeatureDirection(layerId,items[0].feature.id);
  }
});

/* ===== src/tools/select-box.js ===== */
// Module: tools/select-box.js - persistent GIS selection mode (click + drag rectangle).
Object.assign(WaterMapCore.prototype, {
  _ensureSelectionStyles(){
    if(document.getElementById('ddc_meko_selection_css'))return;
    const s=document.createElement('style');s.id='ddc_meko_selection_css';s.textContent=`
.ddc_meko-select-box{position:absolute;z-index:920;border:1px dashed #0b8ea6;background:rgba(11,142,166,.12);pointer-events:none}
.ddc_meko-selection-tree{height:100%;min-height:0;overflow:auto}.ddc_meko-selection-layer{border-bottom:1px solid #e5ecef}.ddc_meko-selection-layer-head{display:flex;align-items:center;gap:6px;padding:7px 5px;font-weight:700;cursor:pointer}.ddc_meko-selection-feature{padding:6px 8px 6px 24px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ddc_meko-selection-feature:hover,.ddc_meko-selection-feature.active{background:#e9f6f8}.ddc_meko-selection-split{display:flex;flex-direction:column;height:100%;min-height:0}.ddc_meko-selection-top{flex:1 1 auto;min-height:80px;overflow:auto}.ddc_meko-selection-resizer{height:8px;flex:0 0 8px;cursor:ns-resize;background:linear-gradient(to bottom,transparent 3px,#b9c7ce 3px,#b9c7ce 5px,transparent 5px)}.ddc_meko-selection-detail{height:42%;min-height:90px;overflow:auto;border-top:1px solid #dfe7eb;animation:ddcMekoSlideUp .18s ease-out}@keyframes ddcMekoSlideUp{from{transform:translateY(12px);opacity:.4}to{transform:translateY(0);opacity:1}}
.ddc_meko-tool.active{background:#dff4f7!important;border-color:#65b7c3!important}
`;
    document.head.appendChild(s);
  },
  _selectionKey(layerId,fid){return String(layerId)+'::'+String(fid);},
  _clearSelection(silent=false){
    this.selection=[];this.selected=null;
    this.layers.forEach(l=>this._renderLayer(l));
    if(this.panels?.attrs)this.panels.attrs.classList.add('hidden');
    if(!silent)this.emit('selection:changed',{features:[]});
    this._updateEditToolbarState?.();
  },
  unselect(){this._clearSelection();this.toast(this.t('select.cleared'));},
  _selectionOpFromEvent(ev){if(ev?.ctrlKey||ev?.metaKey)return'toggle';if(ev?.shiftKey)return'add';return'replace';},
  _applySelectionItems(items,op='replace',focusItem=null){
    const current=new Map((this.selection||[]).map(x=>[this._selectionKey(x.layer.id,x.feature.id),x]));
    if(op==='replace')current.clear();
    for(const item of items||[]){
      const k=this._selectionKey(item.layer.id,item.feature.id);
      if(op==='toggle'){if(current.has(k))current.delete(k);else current.set(k,item);}
      else current.set(k,item);
    }
    this.selection=[...current.values()];
    if(focusItem&&this.selection.some(x=>this._selectionKey(x.layer.id,x.feature.id)===this._selectionKey(focusItem.layer.id,focusItem.feature.id)))this.selected=focusItem;
    else this.selected=this.selection.length===1?this.selection[0]:(this.selection[this.selection.length-1]||null);
    if(this.selected)this.activeLayerId=this.selected.layer.id;
    this.layers.forEach(l=>this._renderLayer(l));
    this._renderSelectionPanel();
    this.emit('selection:changed',{features:this.selection.slice(),selected:this.selected});
    this._updateEditToolbarState?.();
  },
  _selectFeature(layer,feature,leafletLayer,opt={}){
    const op=opt.op||((opt.toggle)?'toggle':(opt.add?'add':'replace'));
    const item={layer,feature,leaflet:leafletLayer||null};
    this._applySelectionItems([item],op,item);
  },
  _featureBBoxIntersectsBounds(feature,bounds){
    if(!feature?.geometry)return false;const b=bboxFC({type:'FeatureCollection',features:[feature]});if(!b)return false;
    const south=b[0][0],west=b[0][1],north=b[1][0],east=b[1][1];
    return !(east<bounds.getWest()||west>bounds.getEast()||north<bounds.getSouth()||south>bounds.getNorth());
  },
  _collectFeaturesInBounds(bounds){
    const out=[];this.layers.filter(l=>l.visible!==false).forEach(l=>(l.fc.features||[]).forEach(f=>{if(this._featureBBoxIntersectsBounds(f,bounds))out.push({layer:l,feature:f,leaflet:null});}));return out;
  },
  enableSelectMode(){
    if(this.mode==='spatial-update')this.stopSpatialUpdate?.(false);
    this._ensureSelectionStyles();this._installSelectPointerHandlers();this.mode='select';try{this.map?.dragging.enable();}catch(_){}this._setToolActive?.('select');
    this.toast(this.t('select.mode'));this.emit('select:mode',{enabled:true});
  },
  disableSelectMode(){if(this.mode==='select')this.mode='pan';this._setToolActive?.(this.mode==='pan'?'pan':'');this._cancelSelectionDrag();this.emit('select:mode',{enabled:false});},
  _startBoxSelect(){this.enableSelectMode();},
  _stopBoxSelect(){this._cancelSelectionDrag();},
  _installSelectPointerHandlers(){
    if(this._selectionPointerInstalled||!this.map)return;this._selectionPointerInstalled=true;const el=this.map.getContainer();
    const down=e=>{
      if(this.mode!=='select'||this._temporaryPan||e.button!==0)return;
      if(e.target.closest?.('.leaflet-interactive,.leaflet-marker-icon,.leaflet-control,.ddc_meko-panel,.ddc_meko-toolbar,.ddc_meko-edit-toolbar'))return;
      const rect=el.getBoundingClientRect();this._selectDrag={sx:e.clientX-rect.left,sy:e.clientY-rect.top,x:e.clientX-rect.left,y:e.clientY-rect.top,op:this._selectionOpFromEvent(e),moved:false};
      try{this.map.dragging.disable();}catch(_){ } e.preventDefault();e.stopPropagation();
    };
    const move=e=>{if(!this._selectDrag)return;const rect=el.getBoundingClientRect(),d=this._selectDrag;d.x=Math.max(0,Math.min(rect.width,e.clientX-rect.left));d.y=Math.max(0,Math.min(rect.height,e.clientY-rect.top));if(Math.abs(d.x-d.sx)+Math.abs(d.y-d.sy)>5)d.moved=true;if(!d.moved)return;this._drawSelectionBox(d);e.preventDefault();};
    const up=e=>{
      if(!this._selectDrag)return;const d=this._selectDrag;this._removeSelectionBox();try{this.map.dragging.enable();}catch(_){ }
      this._selectDrag=null;if(!d.moved)return;
      const a=this.map.containerPointToLatLng([d.sx,d.sy]),b=this.map.containerPointToLatLng([d.x,d.y]);const bounds=L.latLngBounds(a,b);const found=this._collectFeaturesInBounds(bounds);this._applySelectionItems(found,d.op,found[found.length-1]||null);this.toast(found.length?this.t('select.selectedCount',{count:this.selection.length}):this.t('select.noneInBox'));e.preventDefault();e.stopPropagation();
    };
    el.addEventListener('mousedown',down,true);document.addEventListener('mousemove',move,true);document.addEventListener('mouseup',up,true);this._selectionHandlers={el,down,move,up};
  },
  _drawSelectionBox(d){if(!this._selectBoxEl){this._selectBoxEl=document.createElement('div');this._selectBoxEl.className='ddc_meko-select-box';this.root.appendChild(this._selectBoxEl);}const l=Math.min(d.sx,d.x),t=Math.min(d.sy,d.y),w=Math.abs(d.x-d.sx),h=Math.abs(d.y-d.sy);Object.assign(this._selectBoxEl.style,{left:l+'px',top:t+'px',width:w+'px',height:h+'px'});},
  _removeSelectionBox(){if(this._selectBoxEl){this._selectBoxEl.remove();this._selectBoxEl=null;}},
  _cancelSelectionDrag(){this._selectDrag=null;this._removeSelectionBox();try{this.map?.dragging.enable();}catch(_){ }},
  _renderSelectionPanel(){
    const p=this.panels?.attrs;if(!p)return;if(!this.selection?.length){p.classList.add('hidden');return;}p.classList.remove('hidden');const body=p.querySelector('.ddc_meko-panel-body');
    if(this.selection.length===1){const x=this.selection[0];this.selected=x;this._showSelected(x.layer,x.feature);return;}
    const groups=new Map();this.selection.forEach(x=>{if(!groups.has(x.layer.id))groups.set(x.layer.id,{layer:x.layer,items:[]});groups.get(x.layer.id).items.push(x);});
    let tree='<div class="ddc_meko-selection-tree">';for(const {layer,items} of groups.values()){tree+='<div class="ddc_meko-selection-layer"><div class="ddc_meko-selection-layer-head">▾ '+esc(layer.name)+' <span class="ddc_meko-badge">'+items.length+'</span></div>';for(const x of items){const label=x.feature?.properties?.id??x.feature?.properties?.ID??x.feature?.id;tree+='<div class="ddc_meko-selection-feature" data-lid="'+esc(layer.id)+'" data-fid="'+esc(x.feature.id)+'">'+esc(label)+'</div>';}tree+='</div>';}tree+='</div>';
    body.innerHTML='<div class="ddc_meko-selection-split"><div class="ddc_meko-selection-top">'+tree+'</div><div class="ddc_meko-selection-resizer hidden"></div><div class="ddc_meko-selection-detail hidden"></div></div>';
    body.querySelectorAll('.ddc_meko-selection-feature').forEach(el=>el.onclick=()=>this._showSelectionDetail(el.dataset.lid,el.dataset.fid,el));
  },
  _showSelectionDetail(layerId,fid,row){
    const p=this.panels.attrs,body=p.querySelector('.ddc_meko-panel-body'),top=body.querySelector('.ddc_meko-selection-top'),res=body.querySelector('.ddc_meko-selection-resizer'),detail=body.querySelector('.ddc_meko-selection-detail');const item=this.selection.find(x=>x.layer.id===layerId&&String(x.feature.id)===String(fid));if(!item)return;
    body.querySelectorAll('.ddc_meko-selection-feature').forEach(x=>x.classList.toggle('active',x===row));this.selected=item;this.activeLayerId=item.layer.id;res.classList.remove('hidden');detail.classList.remove('hidden');top.style.height='55%';top.style.flex='0 0 55%';let h='<b>'+esc(item.layer.name)+'</b><div style="height:6px"></div>';Object.keys(item.feature.properties||{}).forEach(k=>h+='<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #edf1f3"><span style="color:#6a7a8b;min-width:90px">'+esc(k)+'</span><span>'+esc(item.feature.properties[k])+'</span></div>');detail.innerHTML=h;this._bindSelectionResizer(top,res,detail,body);
  },
  _bindSelectionResizer(top,res,detail,body){if(res._bound)return;res._bound=true;let start=null;const move=e=>{if(!start)return;const r=body.getBoundingClientRect(),pct=Math.max(20,Math.min(80,((e.clientY-r.top)/r.height)*100));top.style.height=pct+'%';top.style.flex='0 0 '+pct+'%';detail.style.height=(100-pct)+'%';};const up=()=>{start=null;document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);};res.addEventListener('mousedown',e=>{start=true;document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);e.preventDefault();});}
});

/* ===== src/tools/topology-validator.js ===== */
// Module: tools/topology-validator.js - cross-layer topology inspection only. No geometry mutation.
Object.assign(WaterMapCore.prototype, {
  _ensureTopologyStyles(){
    if(document.getElementById('ddc_meko_topology_css'))return;
    const s=document.createElement('style');s.id='ddc_meko_topology_css';s.textContent=`
.ddc_meko-topology-summary{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.ddc_meko-topology-row{cursor:pointer}.ddc_meko-topology-row:hover{background:#eef8fa}
.ddc_meko-status-error{color:#b42318;font-weight:700}.ddc_meko-status-ok{color:#067647;font-weight:700}
.ddc_meko-topology-rulehint{font-size:12px;color:#667085;margin-top:4px}
.ddc_meko-topology-guide-label{background:#fff;border:1px solid #d0d5dd;border-radius:4px;padding:2px 5px;color:#344054;font-size:11px;box-shadow:none}
`;
    document.head.appendChild(s);
  },

  showTopologyCheck(){
    if(this.layers.length<2){this.toast(this.t('topology.needLayers'));return;}
    this._ensureTopologyStyles();
    const opts=this.layers.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+' ('+esc(geomKind(l.geometryType))+')</option>').join('');
    const h=''
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topology.sourceLayer'))+'</span><select id="ddcTopoSource">'+opts+'</select></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topology.targetLayer'))+'</span><select id="ddcTopoTarget">'+opts+'</select></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topology.rule'))+'</span><select id="ddcTopoRule"></select><div id="ddcTopoRuleHint" class="ddc_meko-topology-rulehint"></div></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topology.tolerance'))+'</span><input id="ddcTopoTolerance" type="number" min="0" step="0.01" value="0.50"></label>'
      +'<div class="ddc_meko-warning">'+esc(this.t('topology.help'))+'</div>';
    this._modal(this.t('topology.title'),h,[
      {text:this.t('topology.run'),primary:true,fn:()=>{
        const a=this.modalWrap.querySelector('#ddcTopoSource').value;
        const b=this.modalWrap.querySelector('#ddcTopoTarget').value;
        const rule=this.modalWrap.querySelector('#ddcTopoRule').value;
        const t=Number(this.modalWrap.querySelector('#ddcTopoTolerance').value)||0;
        if(a===b){this.toast(this.t('topology.sameLayer'));return;}
        this._closeModal();this.runTopologyCheck(a,b,t,rule);
      }},
      {text:this.t('common.cancel'),fn:()=>this._closeModal()}
    ]);
    const a=this.modalWrap.querySelector('#ddcTopoSource'),b=this.modalWrap.querySelector('#ddcTopoTarget');
    if(a&&b&&a.options.length>1)b.selectedIndex=1;
    const refresh=()=>this._refreshTopologyRuleOptions(a?.value,b?.value);
    a?.addEventListener('change',refresh);b?.addEventListener('change',refresh);refresh();
  },

  _refreshTopologyRuleOptions(sourceLayerId,targetLayerId){
    const ruleEl=this.modalWrap?.querySelector('#ddcTopoRule'),hintEl=this.modalWrap?.querySelector('#ddcTopoRuleHint');if(!ruleEl)return;
    const src=this.getLayer(sourceLayerId),dst=this.getLayer(targetLayerId),sk=geomKind(src?.geometryType),dk=geomKind(dst?.geometryType);
    const rules=[];
    if(sk==='line'&&dk==='line'){
      rules.push(['any_endpoint_to_segment',this.t('topology.anyEndpointToSegment')]);
      rules.push(['each_endpoint_to_segment',this.t('topology.eachEndpointToSegment')]);
      rules.push(['any_endpoint_to_endpoint',this.t('topology.anyEndpointToEndpoint')]);
      rules.push(['each_endpoint_to_endpoint',this.t('topology.eachEndpointToEndpoint')]);
      rules.push(['intersection',this.t('topology.intersection')]);
    }else if(sk==='point'&&dk==='line')rules.push(['point_to_segment',this.t('topology.pointToSegment')]);
    else if(sk==='point'&&dk==='point')rules.push(['point_to_point',this.t('topology.pointToPoint')]);
    else if(sk==='line'&&dk==='point'){
      rules.push(['any_endpoint_to_point',this.t('topology.anyEndpointToPoint')]);
      rules.push(['each_endpoint_to_point',this.t('topology.eachEndpointToPoint')]);
    }else rules.push(['nearest_geometry',this.t('topology.nearestGeometry')]);
    ruleEl.innerHTML=rules.map(r=>'<option value="'+r[0]+'">'+esc(r[1])+'</option>').join('');
    if(hintEl)hintEl.textContent=(sk==='line'&&dk==='line')?this.t('topology.sourceTargetHint'):'';
  },

  runTopologyCheck(sourceLayerId,targetLayerId,toleranceMeters=0.5,rule){
    const src=this.getLayer(sourceLayerId),dst=this.getLayer(targetLayerId);if(!src||!dst)return[];
    const sk=geomKind(src.geometryType),dk=geomKind(dst.geometryType);
    rule=rule||this._defaultTopologyRule(sk,dk);
    const results=[];
    for(const f of src.fc.features||[]){
      const checks=this._evaluateTopologyFeature(f,src,dst,sk,dk,rule,toleranceMeters);
      checks.forEach(r=>{if(r.status==='Error')results.push(r);});
    }
    this._topologyResults=results;
    this._renderTopologyResults(src,dst,toleranceMeters,results,rule);
    this.emit('topology:checked',{sourceLayer:src,targetLayer:dst,toleranceMeters,rule,results});
    return results;
  },

  _defaultTopologyRule(sk,dk){
    if(sk==='line'&&dk==='line')return'any_endpoint_to_segment';
    if(sk==='point'&&dk==='line')return'point_to_segment';
    if(sk==='point'&&dk==='point')return'point_to_point';
    if(sk==='line'&&dk==='point')return'any_endpoint_to_point';
    return'nearest_geometry';
  },

  _evaluateTopologyFeature(feature,src,dst,sk,dk,rule,toleranceMeters){
    const displayId=this._topologyFeatureDisplayId(feature);
    const base={sourceLayerId:src.id,sourceLayer:src.name,sourceFeatureId:feature.id,sourceObjectId:displayId,targetLayerId:dst.id,targetLayer:dst.name,rule};
    const tol=Math.max(0,Number(toleranceMeters)||0);
    const eps=0.001; // 1 mm numerical tolerance for WGS84 round-trip / SHP serialization noise.

    if(rule==='intersection'){
      const hit=this._findGeometryIntersection(feature.geometry,dst);
      if(hit)return[{...base,id:uuid(),targetFeatureId:hit.feature?.id??'',targetObjectId:this._topologyFeatureDisplayId(hit.feature),probe:'intersection',sourcePoint:hit.point,nearestPoint:hit.point,distance:0,status:'OK',message:this.t('topology.snapped')}];
      return[{...base,id:uuid(),targetFeatureId:'',targetObjectId:'',probe:'intersection',sourcePoint:this._representativePoint(feature.geometry),nearestPoint:null,distance:Infinity,status:'Error',message:this.t('topology.noIntersection')}];
    }

    const probes=this._topologyProbePoints(feature,sk,rule);
    if(!probes.length)return[];

    const nearestRule=(rule.includes('endpoint')&&rule.endsWith('_endpoint'))?'endpoint_to_endpoint':
      (rule.endsWith('_point')?'endpoint_to_point':rule);

    // IMPORTANT: evaluate each source probe against the ENTIRE target layer first.
    // For "any endpoint" rules, only the minimum distance among all source endpoints matters.
    const evaluated=probes.map((probe,idx)=>{
      const nearest=this._nearestTargetForTopology(probe.point,dst,nearestRule);
      const distance=nearest?.distance??Infinity;
      return{probe,idx,nearest,distance};
    });

    if(rule.startsWith('any_endpoint_')){
      const best=evaluated.reduce((a,b)=>!a||b.distance<a.distance?b:a,null);
      // One endpoint attached is enough. Do NOT emit an error for the other endpoint.
      if(best&&best.distance<=tol+eps)return[];
      return[{...base,id:uuid(),targetFeatureId:best?.nearest?.feature?.id??'',targetObjectId:this._topologyFeatureDisplayId(best?.nearest?.feature),probe:best?.probe?.name||'endpoint',sourcePoint:best?.probe?.point||null,nearestPoint:best?.nearest?.point||null,distance:best?.distance??Infinity,status:'Error',message:this.t('topology.notSnapped'),endpointDistances:evaluated.map(x=>({name:x.probe?.name,distance:x.distance}))}];
    }

    // Point rules and "each endpoint" rules: every probe must satisfy tolerance.
    const out=[];
    evaluated.forEach(({probe,idx,nearest,distance})=>{
      if(distance>tol+eps){
        out.push({...base,id:uuid(),targetFeatureId:nearest?.feature?.id??'',targetObjectId:this._topologyFeatureDisplayId(nearest?.feature),probe:probe.name||((probes.length>1)?(idx===0?'start':'end'):'point'),sourcePoint:probe.point,nearestPoint:nearest?.point||null,distance,status:'Error',message:this.t('topology.notSnapped')});
      }
    });
    return out;
  },

  _topologyFeatureDisplayId(feature){
    if(!feature)return'';
    const p=feature.properties||{};
    for(const k of ['Id','ID','id','asset_id','AssetId','ASSET_ID']){
      if(p[k]!==undefined&&p[k]!==null&&String(p[k])!=='')return p[k];
    }
    return feature.id??'';
  },

  _topologyProbePoints(feature,kind,rule){
    const g=feature?.geometry;if(!g)return[];
    if(kind==='point'){
      if(g.type==='Point')return[{name:'point',point:g.coordinates}];
      if(g.type==='MultiPoint')return(g.coordinates||[]).map((p,i)=>({name:'point '+(i+1),point:p}));
    }
    if(kind==='line'){
      if(g.type==='LineString'&&g.coordinates?.length)return[{name:'start',point:g.coordinates[0]},{name:'end',point:g.coordinates[g.coordinates.length-1]}];
      if(g.type==='MultiLineString'){
        const out=[];(g.coordinates||[]).forEach((a,i)=>{if(a?.length)out.push({name:'part '+(i+1)+' start',point:a[0]},{name:'part '+(i+1)+' end',point:a[a.length-1]});});return out;
      }
    }
    return[];
  },

  _representativePoint(g){
    if(!g)return null;const c=g.coordinates;
    if(g.type==='Point')return c;
    if(g.type==='LineString'&&c?.length)return c[0];
    if(g.type==='MultiLineString'&&c?.[0]?.length)return c[0][0];
    return null;
  },

  _findGeometryIntersection(sourceGeometry,targetLayer){
    const srcLines=this._geometryLineParts(sourceGeometry);
    for(const f of targetLayer.fc.features||[]){
      const dstLines=this._geometryLineParts(f.geometry);
      for(const a of srcLines)for(const b of dstLines){
        for(let i=1;i<a.length;i++)for(let j=1;j<b.length;j++){
          const p=this._segmentIntersectionLngLat(a[i-1],a[i],b[j-1],b[j]);
          if(p)return{feature:f,point:p};
        }
      }
    }
    return null;
  },

  _geometryLineParts(g){
    if(!g)return[];const c=g.coordinates||[];
    if(g.type==='LineString')return[c];
    if(g.type==='MultiLineString')return c;
    if(g.type==='Polygon')return c;
    if(g.type==='MultiPolygon')return c.flat();
    return[];
  },

  _segmentIntersectionLngLat(a,b,c,d){
    // Intersection is evaluated in current map projection so visual geometry and validation agree.
    const z=Math.min(this.map.getMaxZoom?.()??24,24),A=this.map.project(L.latLng(a[1],a[0]),z),B=this.map.project(L.latLng(b[1],b[0]),z),C=this.map.project(L.latLng(c[1],c[0]),z),D=this.map.project(L.latLng(d[1],d[0]),z);
    const r={x:B.x-A.x,y:B.y-A.y},s={x:D.x-C.x,y:D.y-C.y};
    const cross=(u,v)=>u.x*v.y-u.y*v.x,qp={x:C.x-A.x,y:C.y-A.y},den=cross(r,s);
    if(Math.abs(den)<1e-12)return null;
    const t=cross(qp,s)/den,u=cross(qp,r)/den;
    if(t<-1e-9||t>1+1e-9||u<-1e-9||u>1+1e-9)return null;
    const P=L.point(A.x+t*r.x,A.y+t*r.y),ll=this.map.unproject(P,z);return[ll.lng,ll.lat];
  },

  _nearestTargetForTopology(point,targetLayer,rule){
    let best=null;
    for(const f of targetLayer.fc.features||[]){
      const n=this._nearestPointOnGeometryMeters(point,f.geometry,rule);
      if(n&&Number.isFinite(n.distance)&&(!best||n.distance<best.distance))best={feature:f,distance:n.distance,point:n.point,partIndex:n.partIndex,segmentIndex:n.segmentIndex};
    }
    return best;
  },

  _nearestPointOnGeometryMeters(p,g,rule){
    if(!g)return null;const type=g.type,c=g.coordinates;
    const wantEndpoint=rule==='endpoint_to_endpoint'||rule==='endpoint_to_point'||rule==='point_to_point'||rule==='any_endpoint_to_endpoint'||rule==='each_endpoint_to_endpoint'||rule==='any_endpoint_to_point'||rule==='each_endpoint_to_point';
    if(type==='Point')return{distance:this._geoDistanceMeters(p,c),point:c};
    if(type==='MultiPoint'){
      let best=null;(c||[]).forEach((x,i)=>{const d=this._geoDistanceMeters(p,x);if(!best||d<best.distance)best={distance:d,point:x,partIndex:i};});return best;
    }
    const lines=[];
    if(type==='LineString')lines.push(c);
    else if(type==='MultiLineString')(c||[]).forEach(x=>lines.push(x));
    else if(type==='Polygon')(c||[]).forEach(x=>lines.push(x));
    else if(type==='MultiPolygon')(c||[]).forEach(poly=>(poly||[]).forEach(x=>lines.push(x)));
    let best=null;
    lines.forEach((line,pi)=>{
      if(!line?.length)return;
      if(wantEndpoint){
        const candidates=[line[0],line[line.length-1]];
        candidates.forEach((x,ei)=>{const d=this._geoDistanceMeters(p,x);if(!best||d<best.distance)best={distance:d,point:x,partIndex:pi,segmentIndex:ei===0?0:Math.max(0,line.length-2)};});
      }else{
        for(let i=1;i<line.length;i++){
          const n=this._nearestPointOnSegmentMeters(p,line[i-1],line[i]);
          if(!best||n.distance<best.distance)best={distance:n.distance,point:n.point,partIndex:pi,segmentIndex:i-1};
        }
      }
    });
    return best;
  },

  _geoDistanceMeters(a,b){
    if(!a||!b)return Infinity;
    const R=6371008.8;
    const rad=Math.PI/180;
    const lat1=a[1]*rad,lat2=b[1]*rad;
    const dLat=(b[1]-a[1])*rad,dLon=(b[0]-a[0])*rad;
    const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  },

  _nearestPointOnSegmentMeters(p,a,b){
    // All working GeoJSON coordinates in WaterMapCore are WGS84 [lng,lat].
    // Project locally to a metric tangent plane around the source probe. This is
    // independent from Leaflet zoom / basemap CRS and is stable at sub-meter scale.
    if(!p||!a||!b)return{distance:Infinity,point:null,t:0};
    const R=6371008.8,rad=Math.PI/180;
    const lat0=p[1]*rad,cos0=Math.max(1e-12,Math.cos(lat0));
    const toXY=(q)=>({x:(q[0]-p[0])*rad*R*cos0,y:(q[1]-p[1])*rad*R});
    const A=toXY(a),B=toXY(b);
    const dx=B.x-A.x,dy=B.y-A.y,l2=dx*dx+dy*dy;
    let t=0;
    if(l2>0)t=Math.max(0,Math.min(1,-(A.x*dx+A.y*dy)/l2));
    const qx=A.x+t*dx,qy=A.y+t*dy;
    const q=[p[0]+(qx/(R*cos0))/rad,p[1]+(qy/R)/rad];
    return{distance:Math.hypot(qx,qy),point:q,t};
  },

  _pointToGeometryDistanceMeters(p,g){const n=this._nearestPointOnGeometryMeters(p,g,'nearest_geometry');return n?.distance??Infinity;},

  _renderTopologyResults(src,dst,tol,results,rule){
    const p=this.panels.topology;p.classList.remove('hidden');p.querySelector('.ddc_meko-panel-head span').textContent=this.t('topology.resultsTitle');
    const body=p.querySelector('.ddc_meko-panel-body'),dist=v=>Number.isFinite(v)?v.toFixed(3):'—';
    let h='<div class="ddc_meko-topology-summary"><span class="ddc_meko-badge">'+esc(src.name)+' → '+esc(dst.name)+'</span><span class="ddc_meko-badge">'+esc(this._topologyRuleLabel(rule))+'</span><span class="ddc_meko-badge">Tolerance: '+esc(tol)+' m</span><span class="ddc_meko-badge">Errors: '+results.length+'</span></div>';
    if(!results.length){body.innerHTML=h+'<div class="ddc_meko-status-ok">'+esc(this.t('topology.noErrors'))+'</div>';return;}
    h+='<div class="ddc_meko-table-wrap"><table class="ddc_meko-table"><thead><tr><th>#</th><th>'+esc(this.t('topology.sourceLayer'))+'</th><th>ID</th><th>'+esc(this.t('topology.targetLayer'))+'</th><th>'+esc(this.t('topology.rule'))+'</th><th>'+esc(this.t('topology.distance'))+'</th><th>'+esc(this.t('topology.status'))+'</th></tr></thead><tbody>';
    results.forEach((r,i)=>{h+='<tr class="ddc_meko-topology-row" data-i="'+i+'"><td>'+(i+1)+'</td><td>'+esc(r.sourceLayer)+'</td><td>'+esc(r.sourceObjectId??r.sourceFeatureId)+'</td><td>'+esc(r.targetLayer)+'</td><td>'+esc(r.probe)+' - '+esc(r.message)+'</td><td>'+dist(r.distance)+'</td><td class="ddc_meko-status-error">Error</td></tr>';});
    h+='</tbody></table></div>';body.innerHTML=h;
    body.querySelectorAll('tr[data-i]').forEach(row=>row.onclick=()=>this._showTopologyResultOnMap(results[Number(row.dataset.i)]));
  },

  _topologyRuleLabel(rule){const map={any_endpoint_to_segment:'1 endpoint bất kỳ → segment',each_endpoint_to_segment:'mọi endpoint → segment',any_endpoint_to_endpoint:'1 endpoint bất kỳ → endpoint',each_endpoint_to_endpoint:'mọi endpoint → endpoint',intersection:'giao cắt geometry',point_to_segment:'point → segment',point_to_point:'point → point',any_endpoint_to_point:'1 endpoint bất kỳ → point',each_endpoint_to_point:'mọi endpoint → point',nearest_geometry:'nearest geometry'};return map[rule]||rule;},

  _showTopologyResultOnMap(r){
    if(!r)return;
    this.flashFeature(r.sourceLayerId,r.sourceFeatureId);
    if(r.targetFeatureId!==''&&r.targetFeatureId!=null)setTimeout(()=>this.flashFeature(r.targetLayerId,r.targetFeatureId),260);
    if(this._topologyGuideLayer){try{this.map.removeLayer(this._topologyGuideLayer);}catch(_){}this._topologyGuideLayer=null;}
    if(!r.sourcePoint||!r.nearestPoint)return;
    const a=[r.sourcePoint[1],r.sourcePoint[0]],b=[r.nearestPoint[1],r.nearestPoint[0]];
    const group=L.layerGroup().addTo(this.map);this._topologyGuideLayer=group;
    L.circleMarker(a,{radius:6,color:'#d92d20',weight:2,fillColor:'#fff',fillOpacity:1,interactive:false}).addTo(group);
    L.circleMarker(b,{radius:6,color:'#0396a6',weight:2,fillColor:'#fff',fillOpacity:1,interactive:false}).addTo(group);
    const line=L.polyline([a,b],{color:'#d92d20',weight:2,dashArray:'6,5',interactive:false}).addTo(group);
    line.bindTooltip((Number.isFinite(r.distance)?r.distance.toFixed(3):'—')+' m',{permanent:true,direction:'center',className:'ddc_meko-topology-guide-label'}).openTooltip();
    const bounds=L.latLngBounds([a,b]);if(bounds.isValid())this.map.fitBounds(bounds.pad(.8),{maxZoom:this.map.getMaxZoom?.()??24,animate:false});
  }
});

/* ===== src/tools/topology-snap-editor.js ===== */
// Module: tools/topology-snap-editor.js
// Manual topology snap editor (no Geoman vertex-drag persistence).
// Source geometry is stored as GeoJSON/WGS84 [lng,lat].
// Snapping is evaluated in current map screen pixels for stable UX.
Object.assign(WaterMapCore.prototype, {
  _ensureTopologySnapStyles(){
    if(document.getElementById('ddc_meko_topology_snap_css'))return;
    const s=document.createElement('style');s.id='ddc_meko_topology_snap_css';s.textContent=`
.ddc_meko-snap-active{box-shadow:inset 0 0 0 2px rgba(11,142,166,.25)}
.ddc_meko-snap-hint{position:absolute;left:50%;top:10px;transform:translateX(-50%);z-index:960;background:rgba(17,24,39,.9);color:#fff;padding:6px 10px;border-radius:6px;font-size:12px;pointer-events:none}
.ddc_meko-topology-vertex{width:12px;height:12px;border:2px solid #0aa6b8;border-radius:50%;background:#fff;box-sizing:border-box;box-shadow:0 1px 3px rgba(0,0,0,.28);cursor:grab}
.ddc_meko-topology-vertex.dragging{cursor:grabbing;border-color:#ff9800;box-shadow:0 0 0 4px rgba(255,152,0,.18)}
.ddc_meko-topology-snap-target{width:14px;height:14px;border:2px solid #00b894;border-radius:50%;background:rgba(255,255,255,.9);box-sizing:border-box;box-shadow:0 0 0 5px rgba(0,184,148,.18);pointer-events:none}
`;
    document.head.appendChild(s);
  },

  debugCRS(){
    const rows=this.layers.map(l=>({layer:l.name,sourceCRS:l.sourceCRS||'unknown',workingCRS:l.workingCRS||'EPSG:4326',sample:this._firstGeometryCoordinate?.(l.fc?.features?.[0]?.geometry)||null}));
    const result={mapCRS:this.map?.options?.crs?.code||'EPSG:3857 (Leaflet default)',workingCRS:'EPSG:4326',layers:rows};
    console.table(rows);console.log('[WaterMapCore CRS]',result);return result;
  },

  _firstGeometryCoordinate(g){
    let c=g?.coordinates;while(Array.isArray(c)&&Array.isArray(c[0]))c=c[0];
    return Array.isArray(c)&&typeof c[0]==='number'?[c[0],c[1]]:null;
  },
  _validateTopologySnapCRS(layer){
    if(!layer)return false;
    if((layer.workingCRS||'EPSG:4326')!=='EPSG:4326'){this.toast('Topology Snap yêu cầu working CRS EPSG:4326.',5000);return false;}
    const sample=this._firstGeometryCoordinate(layer.fc?.features?.find(f=>f.geometry)?.geometry);
    if(sample&&(!Number.isFinite(sample[0])||!Number.isFinite(sample[1])||Math.abs(sample[0])>180||Math.abs(sample[1])>90)){
      this.toast('Tọa độ layer không phải WGS84 hợp lệ. Hãy kiểm tra CRS import.',6000);return false;
    }
    return true;
  },

  showTopologySnapTool(){
    if(this._topologySnapMode){this.disableTopologySnapTool();return;}
    const lineOrPoint=this.layers.filter(l=>['line','point'].includes(geomKind(l.geometryType)));
    if(!lineOrPoint.length||this.layers.length<2){this.toast(this.t('topologySnap.needLayers'));return;}
    this._ensureTopologySnapStyles();
    const sourceOpts=lineOrPoint.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+' ('+esc(geomKind(l.geometryType))+')</option>').join('');
    const targetOpts=this.layers.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+' ('+esc(geomKind(l.geometryType))+')</option>').join('');
    const h=''
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologySnap.editLayer'))+'</span><select id="ddcSnapEditSource">'+sourceOpts+'</select></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologySnap.targetLayer'))+'</span><select id="ddcSnapEditTarget">'+targetOpts+'</select></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologySnap.tolerancePx'))+'</span><input id="ddcSnapEditTolerance" type="number" min="3" max="50" step="1" value="12"></label>'
      +'<div class="ddc_meko-warning">'+esc(this.t('topologySnap.help'))+'</div>';
    this._modal(this.t('topologySnap.title'),h,[
      {text:this.t('topologySnap.start'),primary:true,fn:()=>{
        const source=this.modalWrap.querySelector('#ddcSnapEditSource').value;
        const target=this.modalWrap.querySelector('#ddcSnapEditTarget').value;
        const px=Number(this.modalWrap.querySelector('#ddcSnapEditTolerance').value)||12;
        this._closeModal();this.enableTopologySnapTool(source,target,px);
      }},
      {text:this.t('common.cancel'),fn:()=>this._closeModal()}
    ]);
    // Same-layer snapping is allowed. The currently edited feature is excluded from targets,
    // so a main pipe can snap to another main pipe without snapping to itself.
  },

  enableTopologySnapTool(sourceLayerId,targetLayerId,snapDistance=12){
    this.disableTopologySnapTool(true);
    const src=this.getLayer(sourceLayerId),dst=this.getLayer(targetLayerId);if(!src||!dst)return;
    if(!this._validateTopologySnapCRS(src)||!this._validateTopologySnapCRS(dst))return;
    this._topologySnapMode={sourceLayerId,targetLayerId,snapDistance:Number(snapDistance)||12,editing:null,drag:null,snapIndicator:null};
    this.mode='topology-snap';this.root.classList.add('ddc_meko-snap-active');this._setToolActive?.('snap-edit');this._showTopologySnapHint();
    this.toast(this.t('topologySnap.active',{source:src.name,target:dst.name}));
    this.emit('topology:snap-start',{sourceLayer:src,targetLayer:dst,snapDistance:this._topologySnapMode.snapDistance});
  },

  disableTopologySnapTool(silent=false){
    if(!this._topologySnapMode)return;
    this._finishTopologySnapFeature(true);
    const old=this._topologySnapMode;this._topologySnapMode=null;this.mode='select';this.root.classList.remove('ddc_meko-snap-active');this._removeTopologySnapHint();this._setToolActive?.('select');
    if(!silent)this.toast(this.t('topologySnap.stopped'));this.emit('topology:snap-stop',{state:old});
  },
  _showTopologySnapHint(){this._removeTopologySnapHint();const d=document.createElement('div');d.className='ddc_meko-snap-hint';d.textContent=this.t('topologySnap.hint');this.root.appendChild(d);this._topologySnapHint=d;},
  _removeTopologySnapHint(){if(this._topologySnapHint){this._topologySnapHint.remove();this._topologySnapHint=null;}},

  _findLeafletFeatureLayer(layer,fid){let found=null;layer?.leaflet?.eachLayer?.(x=>{if(found)return;if(String(x.feature?.id)===String(fid))found=x;});return found;},
  _walkGeoVertices(coords,path=[],out=[]){
    if(!Array.isArray(coords))return out;
    if(coords.length>=2&&typeof coords[0]==='number'&&typeof coords[1]==='number'){out.push({path:path.slice(),coord:coords});return out;}
    coords.forEach((x,i)=>this._walkGeoVertices(x,path.concat(i),out));return out;
  },
  _getGeoCoordinateAtPath(feature,path){
    let cur=feature?.geometry?.coordinates;if(!cur)return null;
    for(const idx of path){if(!Array.isArray(cur)||cur[idx]==null)return null;cur=cur[idx];}
    return Array.isArray(cur)&&typeof cur[0]==='number'?[cur[0],cur[1]]:null;
  },
  _setGeoCoordinateAtPath(feature,path,ll){
    if(!feature?.geometry||!Array.isArray(path)||!ll)return false;
    if(feature.geometry.type==='Point'&&path.length===0){const old=feature.geometry.coordinates||[];feature.geometry.coordinates=[ll.lng,ll.lat].concat(old.slice(2));return true;}
    let cur=feature.geometry.coordinates;
    for(let i=0;i<path.length-1;i++){if(!Array.isArray(cur)||cur[path[i]]==null)return false;cur=cur[path[i]];}
    const idx=path[path.length-1];if(!Array.isArray(cur)||cur[idx]==null)return false;
    const old=Array.isArray(cur[idx])?cur[idx]:[];cur[idx]=[ll.lng,ll.lat].concat(old.slice(2));return true;
  },
  _cloneGeometry(g){return g?JSON.parse(JSON.stringify(g)):null;},
  _leafLatLngsFromGeoCoords(coords){
    if(!Array.isArray(coords))return coords;
    if(coords.length>=2&&typeof coords[0]==='number'&&typeof coords[1]==='number')return L.latLng(coords[1],coords[0]);
    return coords.map(x=>this._leafLatLngsFromGeoCoords(x));
  },
  _applyGeometryToLeafGeometry(g,leaf){
    if(!g||!leaf)return;
    if(g.type==='Point'&&leaf.setLatLng){leaf.setLatLng(L.latLng(g.coordinates[1],g.coordinates[0]));return;}
    if(leaf.setLatLngs)leaf.setLatLngs(this._leafLatLngsFromGeoCoords(g.coordinates));leaf.redraw?.();
  },
  _applyFeatureGeometryToLeaf(feature,leaf){this._applyGeometryToLeafGeometry(feature?.geometry,leaf);},

  _closestPointOnLayerSegment(p,a,b){
    const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,len2=vx*vx+vy*vy;
    if(!len2)return{point:L.point(a.x,a.y),distance:p.distanceTo(a),t:0};
    let t=(wx*vx+wy*vy)/len2;t=Math.max(0,Math.min(1,t));
    const q=L.point(a.x+t*vx,a.y+t*vy);return{point:q,distance:p.distanceTo(q),t};
  },
  _nearestTopologySnapCandidate(targetLayerId,rawLL,maxPx,excludeFeatureId=null){
    const target=this.getLayer(targetLayerId);if(!target||!rawLL)return null;
    const p=this.map.latLngToLayerPoint(rawLL),limit=Math.max(0,Number(maxPx)||0);let best=null;
    const consider=(ll,feature,type,path)=>{
      const q=this.map.latLngToLayerPoint(ll),d=p.distanceTo(q);
      if(d<=limit&&(!best||d<best.distancePx))best={latlng:L.latLng(ll.lat,ll.lng),distancePx:d,feature,type,path:path?.slice?.()||[]};
    };
    const scan=(coords,feature,pathPrefix=[])=>{
      if(!Array.isArray(coords)||!coords.length)return;
      if(typeof coords[0]?.[0]==='number'){
        for(let i=0;i<coords.length;i++){
          const aLL=L.latLng(coords[i][1],coords[i][0]);consider(aLL,feature,'vertex',pathPrefix.concat(i));
          if(i<coords.length-1){
            const bLL=L.latLng(coords[i+1][1],coords[i+1][0]),a=this.map.latLngToLayerPoint(aLL),b=this.map.latLngToLayerPoint(bLL),c=this._closestPointOnLayerSegment(p,a,b);
            if(c.distance<=limit&&(!best||c.distance<best.distancePx))best={latlng:this.map.layerPointToLatLng(c.point),distancePx:c.distance,feature,type:'segment',path:pathPrefix.concat(i)};
          }
        }
      }else coords.forEach((x,i)=>scan(x,feature,pathPrefix.concat(i)));
    };
    for(const f of target.fc?.features||[]){
      if(excludeFeatureId!=null&&String(f.id)===String(excludeFeatureId))continue;
      const g=f.geometry;if(!g)continue;
      if(g.type==='Point')consider(L.latLng(g.coordinates[1],g.coordinates[0]),f,'point',[]);
      else if(g.type==='MultiPoint')(g.coordinates||[]).forEach((c,i)=>consider(L.latLng(c[1],c[0]),f,'point',[i]));
      else scan(g.coordinates,f,[]);
    }
    return best;
  },

  _makeTopologyVertexIcon(){return L.divIcon({className:'',html:'<div class="ddc_meko-topology-vertex"></div>',iconSize:[12,12],iconAnchor:[6,6]});},
  _makeTopologySnapTargetIcon(){return L.divIcon({className:'',html:'<div class="ddc_meko-topology-snap-target"></div>',iconSize:[14,14],iconAnchor:[7,7]});},
  _eventContainerPoint(ev){
    const oe=ev?.touches?.[0]||ev?.changedTouches?.[0]||ev; if(!oe)return null;
    const r=this.map.getContainer().getBoundingClientRect();return L.point(oe.clientX-r.left,oe.clientY-r.top);
  },
  _installVertexPointerDrag(marker,path){
    marker.on('add',()=>{
      const el=marker.getElement?.();if(!el)return;
      const down=(ev)=>{ev.preventDefault();ev.stopPropagation();this._beginManualTopologyVertexDrag(marker,path,ev);};
      el.__ddcPointerDown=down;el.addEventListener('pointerdown',down,{passive:false});
    });
    marker.on('remove',()=>{const el=marker.getElement?.();if(el?.__ddcPointerDown)el.removeEventListener('pointerdown',el.__ddcPointerDown);});
  },
  _beginManualTopologyVertexDrag(marker,path,ev){
    const st=this._topologySnapMode,ed=st?.editing;if(!st||!ed)return;
    if(st.drag)this._endManualTopologyVertexDrag(null,true);
    this.map.dragging?.disable();
    const el=marker.getElement?.();el?.querySelector?.('.ddc_meko-topology-vertex')?.classList.add('dragging');
    const previewFeature={type:'Feature',properties:ed.feature.properties||{},geometry:this._cloneGeometry(ed.feature.geometry)};
    st.drag={marker,path:path.slice(),previewFeature,lastCandidate:null,committed:false};
    const move=e=>this._moveManualTopologyVertexDrag(e),up=e=>this._endManualTopologyVertexDrag(e,false),cancel=e=>this._endManualTopologyVertexDrag(e,true);
    st.drag.move=move;st.drag.up=up;st.drag.cancel=cancel;
    window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up,{passive:false});window.addEventListener('pointercancel',cancel,{passive:false});
    try{el?.setPointerCapture?.(ev.pointerId);}catch(_){}
  },
  _moveManualTopologyVertexDrag(ev){
    const st=this._topologySnapMode,d=st?.drag,ed=st?.editing;if(!d||!ed)return;
    ev.preventDefault();
    const cp=this._eventContainerPoint(ev);if(!cp)return;
    const rawLL=this.map.containerPointToLatLng(cp),candidate=this._nearestTopologySnapCandidate(st.targetLayerId,rawLL,st.snapDistance,ed.feature?.id),displayLL=candidate?.latlng||rawLL;
    d.lastCandidate=candidate||null;d.marker.setLatLng(displayLL);
    this._setGeoCoordinateAtPath(d.previewFeature,d.path,displayLL);this._applyGeometryToLeafGeometry(d.previewFeature.geometry,ed.leaf);
    this._showManualSnapIndicator(candidate?.latlng||null);
  },
  _showManualSnapIndicator(ll){
    const st=this._topologySnapMode;if(!st)return;
    if(!ll){if(st.snapIndicator){this.map.removeLayer(st.snapIndicator);st.snapIndicator=null;}return;}
    if(!st.snapIndicator)st.snapIndicator=L.marker(ll,{icon:this._makeTopologySnapTargetIcon(),interactive:false,zIndexOffset:20000}).addTo(this.map);
    else st.snapIndicator.setLatLng(ll);
  },
  _endManualTopologyVertexDrag(ev,cancel=false){
    const st=this._topologySnapMode,d=st?.drag,ed=st?.editing;if(!d||!ed)return;
    if(ev)ev.preventDefault();
    window.removeEventListener('pointermove',d.move);window.removeEventListener('pointerup',d.up);window.removeEventListener('pointercancel',d.cancel);
    this.map.dragging?.enable();
    const el=d.marker.getElement?.();el?.querySelector?.('.ddc_meko-topology-vertex')?.classList.remove('dragging');
    this._showManualSnapIndicator(null);
    if(cancel){
      const old=this._getGeoCoordinateAtPath(ed.feature,d.path);if(old)d.marker.setLatLng(L.latLng(old[1],old[0]));this._applyFeatureGeometryToLeaf(ed.feature,ed.leaf);st.drag=null;return;
    }
    const finalLL=d.marker.getLatLng();
    if(!finalLL){st.drag=null;return;}
    // If a snap candidate exists, it is the only authoritative final coordinate.
    const authoritativeLL=d.lastCandidate?.latlng||finalLL;
    d.marker.setLatLng(authoritativeLL);
    this._pushUndo();
    if(this._setGeoCoordinateAtPath(ed.feature,d.path,authoritativeLL)){
      this._applyFeatureGeometryToLeaf(ed.feature,ed.leaf);
      this._setDirty?.('topology-snap');this._syncProject?.();
      this.emit('feature:updated',{layer:ed.layer,feature:ed.feature,reason:'topology-snap-manual'});
      this.emit('topology:snap-committed',{layer:ed.layer,feature:ed.feature,path:d.path.slice(),latlng:{lat:authoritativeLL.lat,lng:authoritativeLL.lng},targetType:d.lastCandidate?.type||null,distancePx:d.lastCandidate?.distancePx??null});
    }
    st.drag=null;
  },

  _startTopologySnapEdit(layer,feature){
    const st=this._topologySnapMode;if(!st||layer.id!==st.sourceLayerId)return;
    if(st.editing&&String(st.editing.feature.id)===String(feature.id))return;
    this._finishTopologySnapFeature(true);
    const leaf=this._findLeafletFeatureLayer(layer,feature.id);if(!leaf){this.toast(this.t('topologySnap.noEditableGeometry'));return;}
    this._ensureEditSessionForFeatureAction?.();
    const handles=L.layerGroup().addTo(this.map),verts=this._walkGeoVertices(feature.geometry?.coordinates||[]);
    verts.forEach(v=>{
      const ll=L.latLng(v.coord[1],v.coord[0]),m=L.marker(ll,{icon:this._makeTopologyVertexIcon(),interactive:true,keyboard:false,zIndexOffset:15000});
      m.__ddcVertexPath=v.path.slice();this._installVertexPointerDrag(m,m.__ddcVertexPath);m.addTo(handles);
    });
    st.editing={layer,feature,leaf,handles};this.activeLayerId=layer.id;this.toast(this.t('topologySnap.editing',{id:feature.id}));
  },

  _finishTopologySnapFeature(keepMode=true){
    const st=this._topologySnapMode,ed=st?.editing;if(!ed)return;
    if(st.drag)this._endManualTopologyVertexDrag(null,true);
    this._showManualSnapIndicator(null);
    try{if(ed.handles)this.map.removeLayer(ed.handles);this._applyFeatureGeometryToLeaf(ed.feature,ed.leaf);this._syncProject?.();}catch(err){console.error(err);}
    st.editing=null;if(ed.layer)this._renderLayer(ed.layer);
  },

  _handleTopologySnapFeatureClick(layer,feature){
    const st=this._topologySnapMode;if(!st)return false;
    if(layer.id!==st.sourceLayerId){this.toast(this.t('topologySnap.pickSource'));return true;}
    this._startTopologySnapEdit(layer,feature);return true;
  }
});

/* ===== src/tools/topology-repair.js ===== */
// Module: tools/topology-repair.js
// Unified topology QA + safe auto repair for Meter -> Service -> Main connectivity.
// Scan NEVER mutates geometry. Only Apply commits fixes classified as safe.
Object.assign(WaterMapCore.prototype, {
  _ensureTopologyRepairStyles(){
    if(document.getElementById('ddc_meko_topology_repair_css'))return;
    const s=document.createElement('style');s.id='ddc_meko_topology_repair_css';s.textContent=`
.ddc_meko-repair-summary{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.ddc_meko-repair-row{cursor:pointer}.ddc_meko-repair-row:hover{background:#eef8fa}
.ddc_meko-repair-safe{color:#067647;font-weight:700}.ddc_meko-repair-review{color:#b54708;font-weight:700}.ddc_meko-repair-ok{color:#475467;font-weight:700}
.ddc_meko-repair-actions{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.ddc_meko-repair-note{font-size:12px;color:#667085;margin-top:5px}
`;
    document.head.appendChild(s);
  },

  showTopologyRepairTool(){
    if(this.layers.length<2){this.toast(this.t('topologyRepair.needLayers'));return;}
    this._ensureTopologyRepairStyles();
    const pointLayers=this.layers.filter(l=>geomKind(l.geometryType)==='point');
    const lineLayers=this.layers.filter(l=>geomKind(l.geometryType)==='line');
    if(!pointLayers.length||lineLayers.length<2){this.toast(this.t('topologyRepair.needLayers'));return;}
    const opt=(arr,guess)=>arr.map(l=>'<option value="'+esc(l.id)+'" '+(guess&&guess(l)?'selected':'')+'>'+esc(l.name)+'</option>').join('');
    const meterGuess=l=>/(meter|dhkh|dong.?ho|đồng.?hồ)/i.test(l.name||'');
    const serviceGuess=l=>/(service|dich.?vu|nhanh|đấu.?hộ|dau.?ho)/i.test(l.name||'');
    const mainGuess=l=>/(main|distribution|cap.?nuoc|cấp.?nước|do\b|ống.?chính)/i.test(l.name||'')&&!serviceGuess(l);
    const h=''
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologyRepair.meterLayer'))+'</span><select id="ddcRepairMeter">'+opt(pointLayers,meterGuess)+'</select></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologyRepair.serviceLayer'))+'</span><select id="ddcRepairService">'+opt(lineLayers,serviceGuess)+'</select></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologyRepair.mainLayer'))+'</span><select id="ddcRepairMain">'+opt(lineLayers,mainGuess)+'</select></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologyRepair.meterServiceTol'))+'</span><input id="ddcRepairMeterTol" type="number" min="0" step="0.05" value="1.00"></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologyRepair.serviceMainTol'))+'</span><input id="ddcRepairServiceTol" type="number" min="0" step="0.05" value="1.00"></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologyRepair.mainMainTol'))+'</span><input id="ddcRepairMainTol" type="number" min="0" step="0.05" value="0.50"></label>'
      +'<label class="ddc_meko-field"><span>'+esc(this.t('topologyRepair.reviewTol'))+'</span><input id="ddcRepairReviewTol" type="number" min="0" step="0.5" value="10"></label>'
      +'<div class="ddc_meko-warning">'+esc(this.t('topologyRepair.help'))+'</div>';
    this._modal(this.t('topologyRepair.title'),h,[
      {text:this.t('topologyRepair.scan'),primary:true,fn:()=>{
        const q=s=>this.modalWrap.querySelector(s),cfg={
          meterLayerId:q('#ddcRepairMeter').value,serviceLayerId:q('#ddcRepairService').value,mainLayerId:q('#ddcRepairMain').value,
          meterServiceTol:Math.max(0,Number(q('#ddcRepairMeterTol').value)||0),serviceMainTol:Math.max(0,Number(q('#ddcRepairServiceTol').value)||0),
          mainMainTol:Math.max(0,Number(q('#ddcRepairMainTol').value)||0),reviewTol:Math.max(0,Number(q('#ddcRepairReviewTol').value)||0)
        };
        if(cfg.serviceLayerId===cfg.mainLayerId){this.toast(this.t('topologyRepair.serviceMainDifferent'));return;}
        this._closeModal();this.runTopologyRepairScan(cfg);
      }},
      {text:this.t('common.cancel'),fn:()=>this._closeModal()}
    ]);
    // Ensure guesses do not accidentally point both line selects to the same layer.
    const a=this.modalWrap.querySelector('#ddcRepairService'),b=this.modalWrap.querySelector('#ddcRepairMain');
    if(a&&b&&a.value===b.value&&b.options.length>1)b.selectedIndex=(a.selectedIndex===0?1:0);
  },

  runTopologyRepairScan(cfg){
    const meter=this.getLayer(cfg.meterLayerId),service=this.getLayer(cfg.serviceLayerId),main=this.getLayer(cfg.mainLayerId);
    if(!meter||!service||!main)return null;
    const report={id:uuid(),cfg:{...cfg},meterLayer:meter,serviceLayer:service,mainLayer:main,issues:[],stats:{meterTotal:meter.fc.features.length,serviceTotal:service.fc.features.length,mainTotal:main.fc.features.length,safe:0,review:0,ok:0}};
    const serviceIndex=this._repairBuildLineIndex(service,Math.max(25,cfg.reviewTol*2));
    const mainIndex=this._repairBuildLineIndex(main,Math.max(25,cfg.reviewTol*2));
    const eps=0.01; // 1 cm: already connected for practical GIS topology.

    // 1) Meter -> Service. Preserve the physical meter point; repair a nearby service endpoint to the meter.
    for(const mf of meter.fc.features||[]){
      const p=mf.geometry?.type==='Point'?mf.geometry.coordinates:null;if(!p)continue;
      const nearest=this._repairNearestLineEndpointIndexed(p,service,serviceIndex,cfg.reviewTol,null);
      if(nearest&&nearest.distance<=eps){report.stats.ok++;continue;}
      if(nearest&&nearest.distance<=cfg.meterServiceTol){
        report.issues.push(this._repairIssue('meter_service','safe',meter,mf,service,nearest.feature,p,nearest.point,nearest.distance,{action:'move_line_endpoint',layerId:service.id,featureId:nearest.feature.id,partIndex:nearest.partIndex,endpoint:nearest.endpoint,to:p.slice()}));report.stats.safe++;
      }else{
        // For review, also accept nearest geometry because the meter may be close to the middle of a malformed line.
        const geomNear=this._repairNearestGeometryIndexed(p,service,serviceIndex,cfg.reviewTol,null);
        report.issues.push(this._repairIssue('meter_service','review',meter,mf,service,geomNear?.feature||nearest?.feature,p,geomNear?.point||nearest?.point||null,geomNear?.distance??nearest?.distance??Infinity,null));report.stats.review++;
      }
    }

    // 2) Service -> Main. Exactly one service endpoint should reach the hydraulic main network.
    for(const sf of service.fc.features||[]){
      const ends=this._repairFeatureEndpoints(sf);if(!ends.length)continue;
      let best=null;
      for(const e of ends){const n=this._repairNearestGeometryIndexed(e.point,main,mainIndex,cfg.reviewTol,null);if(n&&(!best||n.distance<best.distance))best={...n,source:e};}
      if(best&&best.distance<=eps){report.stats.ok++;continue;}
      if(best&&best.distance<=cfg.serviceMainTol){
        report.issues.push(this._repairIssue('service_main','safe',service,sf,main,best.feature,best.source.point,best.point,best.distance,{action:'move_line_endpoint',layerId:service.id,featureId:sf.id,partIndex:best.source.partIndex,endpoint:best.source.endpoint,to:best.point.slice()}));report.stats.safe++;
      }else{
        report.issues.push(this._repairIssue('service_main','review',service,sf,main,best?.feature,best?.source?.point||ends[0].point,best?.point||null,best?.distance??Infinity,null));report.stats.review++;
      }
    }

    // 3) Main -> Main near-miss endpoints. Legitimate dead ends are NOT errors: only report when another pipe is actually nearby.
    for(const sf of main.fc.features||[]){
      for(const e of this._repairFeatureEndpoints(sf)){
        const n=this._repairNearestGeometryIndexed(e.point,main,mainIndex,cfg.reviewTol,sf.id);
        if(!n)continue;
        if(n.distance<=eps){report.stats.ok++;continue;}
        if(n.distance<=cfg.mainMainTol){
          report.issues.push(this._repairIssue('main_main','safe',main,sf,main,n.feature,e.point,n.point,n.distance,{action:'move_line_endpoint',layerId:main.id,featureId:sf.id,partIndex:e.partIndex,endpoint:e.endpoint,to:n.point.slice()}));report.stats.safe++;
        }else if(n.distance<=cfg.reviewTol){
          report.issues.push(this._repairIssue('main_main','review',main,sf,main,n.feature,e.point,n.point,n.distance,null));report.stats.review++;
        }
      }
    }

    // Stabilize safe fixes before exposing them to Apply.
    // A repair must be idempotent: the same endpoint must never be pulled toward
    // competing targets, and reciprocal Main->Main fixes must not swap back and forth.
    this._repairStabilizeSafeIssues(report);

    this._topologyRepairReport=report;this._renderTopologyRepairReport(report);this.emit('topologyRepair:scanned',report);return report;
  },

  _repairStabilizeSafeIssues(report){
    if(!report?.issues?.length)return report;
    const eps=0.01;
    const vertexKey=fx=>fx&&fx.action==='move_line_endpoint'
      ? [fx.layerId,fx.featureId,fx.partIndex,fx.endpoint].map(v=>String(v??'')).join('|')
      : '';
    const setReview=item=>{
      if(!item||item.status!=='safe')return;
      item.status='review';
      item.fix=null;
      item.stabilizedReason='ambiguous_or_conflicting_fix';
    };

    // 1) One source vertex may only have one authoritative destination.
    // Meter->Service and Service->Main can otherwise select the same service endpoint
    // and alternately pull it toward the meter and the main pipe on repeated Auto Fix runs.
    const byVertex=new Map();
    for(const item of report.issues){
      if(item.status!=='safe'||!item.fix)continue;
      const k=vertexKey(item.fix);if(!k)continue;
      const a=byVertex.get(k)||[];a.push(item);byVertex.set(k,a);
    }
    for(const items of byVertex.values()){
      if(items.length<2)continue;
      let conflict=false;
      for(let i=0;i<items.length&&!conflict;i++)for(let j=i+1;j<items.length;j++){
        const a=items[i].fix?.to,b=items[j].fix?.to;
        if(!a||!b||this._geoDistanceMeters(a,b)>eps){conflict=true;break;}
      }
      if(conflict)for(const item of items)setReview(item);
    }

    // 2) Reciprocal Main->Main candidates (A snaps to B while B snaps to A) are
    // inherently ambiguous. Never auto-fix either direction; send both to Review.
    const mm=new Map();
    for(const item of report.issues){
      if(item.status!=='safe'||item.kind!=='main_main'||!item.fix)continue;
      const a=String(item.sourceFeatureId??''),b=String(item.targetFeatureId??'');
      if(!a||!b)continue;
      const pair=a<b?a+'|'+b:b+'|'+a;
      const arr=mm.get(pair)||[];arr.push(item);mm.set(pair,arr);
    }
    for(const items of mm.values()){
      const dirs=new Set(items.map(x=>String(x.sourceFeatureId)+'>'+String(x.targetFeatureId)));
      if(dirs.size>1)for(const item of items)setReview(item);
    }

    // Recalculate visible counters after stabilization. OK remains the count of
    // relationships already connected during the scan.
    report.stats.safe=0;report.stats.review=0;
    for(const item of report.issues){
      if(item.status==='safe')report.stats.safe++;
      else if(item.status==='review')report.stats.review++;
    }
    return report;
  },

  _repairIssue(kind,status,srcLayer,srcFeature,dstLayer,dstFeature,sourcePoint,nearestPoint,distance,fix){
    const labels={meter_service:this.t('topologyRepair.ruleMeterService'),service_main:this.t('topologyRepair.ruleServiceMain'),main_main:this.t('topologyRepair.ruleMainMain')};
    return{id:uuid(),kind,status,ruleLabel:labels[kind]||kind,sourceLayerId:srcLayer.id,sourceLayer:srcLayer.name,sourceFeatureId:srcFeature?.id,sourceObjectId:this._topologyFeatureDisplayId?.(srcFeature)??srcFeature?.id,targetLayerId:dstLayer.id,targetLayer:dstLayer.name,targetFeatureId:dstFeature?.id??'',targetObjectId:this._topologyFeatureDisplayId?.(dstFeature)??dstFeature?.id??'',sourcePoint,nearestPoint,distance,fix};
  },

  _repairBuildLineIndex(layer,cellMeters=50){
    const cells=new Map(),R=6371008.8,rad=Math.PI/180;
    const toXY=p=>({x:p[0]*rad*R,y:Math.log(Math.tan(Math.PI/4+(p[1]*rad)/2))*R});
    const add=(key,f)=>{const a=cells.get(key)||[];a.push(f);cells.set(key,a);};
    for(const f of layer.fc.features||[]){
      const pts=[];for(const line of this._geometryLineParts(f.geometry))for(const p of line||[])if(p?.length>=2)pts.push(p);if(!pts.length)continue;
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of pts){const q=toXY(p);minX=Math.min(minX,q.x);maxX=Math.max(maxX,q.x);minY=Math.min(minY,q.y);maxY=Math.max(maxY,q.y);}
      const x0=Math.floor(minX/cellMeters),x1=Math.floor(maxX/cellMeters),y0=Math.floor(minY/cellMeters),y1=Math.floor(maxY/cellMeters);
      for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)add(x+','+y,f);
    }
    return{cells,cellMeters,toXY};
  },

  _repairIndexCandidates(point,index,radiusMeters){
    if(!index)return[];const q=index.toXY(point),c=index.cellMeters,r=Math.max(1,Math.ceil(radiusMeters/c)),cx=Math.floor(q.x/c),cy=Math.floor(q.y/c),set=new Set();
    for(let x=cx-r;x<=cx+r;x++)for(let y=cy-r;y<=cy+r;y++)for(const f of index.cells.get(x+','+y)||[])set.add(f);
    return[...set];
  },

  _repairNearestGeometryIndexed(point,layer,index,maxDistance,excludeFeatureId){
    let best=null;const candidates=this._repairIndexCandidates(point,index,maxDistance);
    for(const f of candidates){if(excludeFeatureId!=null&&String(f.id)===String(excludeFeatureId))continue;const n=this._nearestPointOnGeometryMeters(point,f.geometry,'nearest_geometry');if(n&&n.distance<=maxDistance&&(!best||n.distance<best.distance))best={...n,feature:f};}
    return best;
  },

  _repairNearestLineEndpointIndexed(point,layer,index,maxDistance,excludeFeatureId){
    let best=null;for(const f of this._repairIndexCandidates(point,index,maxDistance)){if(excludeFeatureId!=null&&String(f.id)===String(excludeFeatureId))continue;for(const e of this._repairFeatureEndpoints(f)){const d=this._geoDistanceMeters(point,e.point);if(d<=maxDistance&&(!best||d<best.distance))best={feature:f,distance:d,point:e.point,partIndex:e.partIndex,endpoint:e.endpoint};}}
    return best;
  },

  _repairFeatureEndpoints(feature){
    const g=feature?.geometry;if(!g)return[];const out=[];
    if(g.type==='LineString'&&g.coordinates?.length){out.push({partIndex:0,endpoint:'start',point:g.coordinates[0]},{partIndex:0,endpoint:'end',point:g.coordinates[g.coordinates.length-1]});}
    else if(g.type==='MultiLineString')for(let i=0;i<(g.coordinates||[]).length;i++){const a=g.coordinates[i];if(a?.length)out.push({partIndex:i,endpoint:'start',point:a[0]},{partIndex:i,endpoint:'end',point:a[a.length-1]});}
    return out;
  },

  _repairSetLineEndpoint(feature,partIndex,endpoint,to){
    const g=feature?.geometry;if(!g||!to)return false;let a=null;
    if(g.type==='LineString')a=g.coordinates;
    else if(g.type==='MultiLineString')a=g.coordinates?.[partIndex];
    if(!a?.length)return false;const idx=endpoint==='start'?0:a.length-1;a[idx]=to.slice();return true;
  },

  _renderTopologyRepairReport(report){
    const p=this.panels.topology;p.classList.remove('hidden');this._bringPanelToFront?.(p);p.querySelector('.ddc_meko-panel-head span').textContent=this.t('topologyRepair.resultsTitle');
    const body=p.querySelector('.ddc_meko-panel-body'),dist=v=>Number.isFinite(v)?v.toFixed(3):'—';
    let h='<div class="ddc_meko-repair-summary">'
      +'<span class="ddc_meko-badge">'+esc(this.t('topologyRepair.safeCount'))+': '+report.stats.safe+'</span>'
      +'<span class="ddc_meko-badge">'+esc(this.t('topologyRepair.reviewCount'))+': '+report.stats.review+'</span>'
      +'<span class="ddc_meko-badge">'+esc(this.t('topologyRepair.okCount'))+': '+report.stats.ok+'</span></div>'
      +'<div class="ddc_meko-repair-actions"><button class="ddc_meko-btn primary" data-a="apply" '+(report.stats.safe?'':'disabled')+'>'+esc(this.t('topologyRepair.applySafe'))+'</button><button class="ddc_meko-btn" data-a="rescan">'+esc(this.t('topologyRepair.rescan'))+'</button></div>'
      +'<div class="ddc_meko-repair-note">'+esc(this.t('topologyRepair.reviewNote'))+'</div>';
    if(!report.issues.length){body.innerHTML=h+'<div class="ddc_meko-repair-safe">'+esc(this.t('topologyRepair.clean'))+'</div>';body.querySelector('[data-a=rescan]').onclick=()=>this.showTopologyRepairTool();return;}
    h+='<div class="ddc_meko-table-wrap"><table class="ddc_meko-table"><thead><tr><th>#</th><th>'+esc(this.t('topologyRepair.relation'))+'</th><th>'+esc(this.t('topologyRepair.source'))+'</th><th>'+esc(this.t('topologyRepair.target'))+'</th><th>'+esc(this.t('topology.distance'))+'</th><th>'+esc(this.t('topology.status'))+'</th></tr></thead><tbody>';
    report.issues.forEach((r,i)=>{const cls=r.status==='safe'?'ddc_meko-repair-safe':'ddc_meko-repair-review',st=r.status==='safe'?this.t('topologyRepair.safeFix'):this.t('topologyRepair.review');h+='<tr class="ddc_meko-repair-row" data-i="'+i+'"><td>'+(i+1)+'</td><td>'+esc(r.ruleLabel)+'</td><td>'+esc(r.sourceLayer)+' #'+esc(r.sourceObjectId??'')+'</td><td>'+esc(r.targetLayer)+' #'+esc(r.targetObjectId??'')+'</td><td>'+dist(r.distance)+'</td><td class="'+cls+'">'+esc(st)+'</td></tr>';});
    h+='</tbody></table></div>';body.innerHTML=h;
    body.querySelector('[data-a=apply]').onclick=()=>this.applyTopologyRepair(report);
    body.querySelector('[data-a=rescan]').onclick=()=>this.showTopologyRepairTool();
    body.querySelectorAll('tr[data-i]').forEach(row=>row.onclick=()=>this._showTopologyResultOnMap(report.issues[Number(row.dataset.i)]));
  },

  applyTopologyRepair(report=this._topologyRepairReport){
    if(!report)return;const fixes=report.issues.filter(x=>x.status==='safe'&&x.fix);if(!fixes.length){this.toast(this.t('topologyRepair.noSafeFix'));return;}
    this._pushUndo();const touched=new Set();let applied=0;
    for(const item of fixes){const fx=item.fix,l=this.getLayer(fx.layerId),f=l?.fc.features.find(x=>String(x.id)===String(fx.featureId));if(!l||!f)continue;if(fx.action==='move_line_endpoint'&&this._repairSetLineEndpoint(f,fx.partIndex,fx.endpoint,fx.to)){touched.add(l.id);applied++;}}
    for(const id of touched){const l=this.getLayer(id);if(l)this._renderLayer(l);}this._syncProject();this._setDirty?.('topology-repair');this.emit('topologyRepair:applied',{report,applied,touched:[...touched]});this.toast(this.t('topologyRepair.applied',{count:applied}),3500);
    // Immediately re-scan so the user sees what remains for manual review.
    setTimeout(()=>this.runTopologyRepairScan(report.cfg),0);
  }
});

/* ===== src/tools/measure.js ===== */
// Module: tools/measure.js
Object.assign(WaterMapCore.prototype, {
  _measure(){if(!this.map.pm){this.toast('Cần Leaflet-Geoman');return;}if(this.mode==='measure'){this.map.pm.disableDraw();this.map.off('pm:create',this._measureCreateHandler);this.mode='select';this._setToolActive('select');this.toast(this.t('measure.cancelled'));return;}this.mode='measure';this._setToolActive('measure');this.map.pm.disableDraw();this.map.pm.enableDraw('Line',{continueDrawing:false,snappable:true});this._measureCreateHandler=e=>{this.map.off('pm:create',this._measureCreateHandler);this._measureCreateHandler=null;this.map.pm.disableDraw();let total=0;const ll=e.layer.getLatLngs();for(let i=1;i<ll.length;i++)total+=ll[i-1].distanceTo(ll[i]);this.map.removeLayer(e.layer);e.layer.bindTooltip(total.toFixed(1)+' m',{permanent:true,direction:'center'});e.layer.on('click',()=>{if(confirm(this.t('measure.confirmDelete')))this.measureGroup.removeLayer(e.layer);});this.measureGroup.addLayer(e.layer);this.mode='select';this._setToolActive('select');this.toast(this.t('measure.done'));};this.map.on('pm:create',this._measureCreateHandler);},
  _clearMeasurements(){if(this.map.pm)this.map.pm.disableDraw();if(this._measureCreateHandler){this.map.off('pm:create',this._measureCreateHandler);this._measureCreateHandler=null;}this.measureGroup?.clearLayers();this.mode='select';this._setToolActive('select');this.toast(this.t('measure.cleared'));}
});

/* ===== src/tools/sample-demand-generator.js ===== */
// Module: tools/sample-demand-generator.js
// Synthetic EPANET base-demand generator for customer meter layers.
// Generates realistic-looking average demand from monthly consumption assumptions.
(function(){
  function hash32(str){
    str=String(str??'');let h=2166136261>>>0;
    for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
    h+=h<<13;h^=h>>>7;h+=h<<3;h^=h>>>17;h+=h<<5;
    return h>>>0;
  }
  function rng(seed){
    let a=seed>>>0;
    return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
  }
  function normal01(r){
    const u=Math.max(1e-12,r()),v=Math.max(1e-12,r());
    return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
  }
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function n(v,def=0){const x=Number(v);return Number.isFinite(x)?x:def;}
  function tier(d){
    // Assumptions for synthetic monthly customer use (m3/month).
    // Diameter is only a proxy because the current layer has no customer_type field.
    d=n(d,15);
    if(d<=15)return{median:14,min:5,max:28};
    if(d<=20)return{median:22,min:7,max:45};
    if(d<=25)return{median:38,min:12,max:85};
    if(d<=32)return{median:70,min:20,max:160};
    if(d<=40)return{median:120,min:35,max:300};
    if(d<=50)return{median:210,min:60,max:520};
    return{median:360,min:100,max:1000};
  }
  function monthlySample(diameter,seedKey,spread){
    const t=tier(diameter),r=rng(hash32(seedKey));
    // Log-normal around median; spread is sigma in ln-space.
    const sigma=clamp(n(spread,.42),.05,1.2);
    const value=t.median*Math.exp(sigma*normal01(r));
    return clamp(value,t.min,t.max);
  }
  function m3MonthToLps(v,days){return (v*1000)/(Math.max(1,days)*24*3600);}
  function percentile(arr,p){if(!arr.length)return 0;const a=arr.slice().sort((x,y)=>x-y);const i=(a.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(i-lo);}
  function featureKey(f,i){return f?.properties?.asset_id??f?.properties?.cus_id??f?.properties?.serial??f?.id??i;}
  function isDisabled(f,field){if(!field)return false;const v=f?.properties?.[field];return v===0||v===false||String(v).toLowerCase()==='false'||String(v).toLowerCase()==='disabled';}

  Object.assign(WaterMapCore.prototype,{
    _sampleDemandCandidateLayers(){
      return (this.layers||[]).filter(l=>Array.isArray(l.fc?.features)&&l.fc.features.length>0&&
        (l.schema||[]).some(f=>String(f.name).toLowerCase()==='demand'));
    },
    showSampleDemandTool(){
      const layers=this._sampleDemandCandidateLayers();
      if(!layers.length){this.toast(this.t('sampleDemand.noLayer'),4200);return;}
      const active=(this.getActiveLayer?.()&&layers.find(x=>x.id===this.activeLayerId))||layers[0];
      const layerOpts=layers.map(l=>'<option value="'+esc(l.id)+'"'+(l.id===active.id?' selected':'')+'>'+esc(l.name)+' ('+l.fc.features.length+')</option>').join('');
      const html='\
<div style="display:grid;grid-template-columns:180px 1fr;gap:10px 12px;align-items:center">\
<label>'+esc(this.t('sampleDemand.layer'))+'</label><select id="ddcDemandLayer">'+layerOpts+'</select>\
<label>'+esc(this.t('sampleDemand.demandField'))+'</label><select id="ddcDemandField"></select>\
<label>'+esc(this.t('sampleDemand.diameterField'))+'</label><select id="ddcDemandDiameter"></select>\
<label>'+esc(this.t('sampleDemand.enabledField'))+'</label><select id="ddcDemandEnabled"></select>\
<label>'+esc(this.t('sampleDemand.seed'))+'</label><input id="ddcDemandSeed" value="2026">\
<label>'+esc(this.t('sampleDemand.days'))+'</label><input id="ddcDemandDays" type="number" min="1" max="31" step="1" value="30">\
<label>'+esc(this.t('sampleDemand.variation'))+'</label><input id="ddcDemandSpread" type="number" min="0.05" max="1.2" step="0.05" value="0.42">\
<label>'+esc(this.t('sampleDemand.overwrite'))+'</label><input id="ddcDemandOverwrite" type="checkbox" checked>\
<label>'+esc(this.t('sampleDemand.zeroDisabled'))+'</label><input id="ddcDemandZeroDisabled" type="checkbox" checked>\
</div>\
<div style="margin-top:12px;padding:10px;border:1px solid #d8e0e5;border-radius:6px;background:#f8fafb">'+esc(this.t('sampleDemand.help'))+'</div>\
<div id="ddcDemandPreview" style="margin-top:12px"></div>';
      const refreshFields=()=>{
        const lid=this.modalWrap.querySelector('#ddcDemandLayer')?.value;
        const l=this.getLayer(lid)||layers[0];if(!l)return;
        const schema=l.schema||[];
        const demandSel=this.modalWrap.querySelector('#ddcDemandField');
        const diaSel=this.modalWrap.querySelector('#ddcDemandDiameter');
        const enaSel=this.modalWrap.querySelector('#ddcDemandEnabled');
        const numeric=schema.filter(f=>/double|integer|number|float|decimal/i.test(String(f.type||'')));
        demandSel.innerHTML=numeric.map(f=>'<option value="'+esc(f.name)+'"'+(String(f.name).toLowerCase()==='demand'?' selected':'')+'>'+esc(f.alias||f.name)+'</option>').join('');
        diaSel.innerHTML='<option value="">'+esc(this.t('sampleDemand.none'))+'</option>'+numeric.map(f=>'<option value="'+esc(f.name)+'"'+(String(f.name).toLowerCase()==='diameter'?' selected':'')+'>'+esc(f.alias||f.name)+'</option>').join('');
        enaSel.innerHTML='<option value="">'+esc(this.t('sampleDemand.none'))+'</option>'+schema.map(f=>'<option value="'+esc(f.name)+'"'+(String(f.name).toLowerCase()==='enabled'?' selected':'')+'>'+esc(f.alias||f.name)+'</option>').join('');
        const pv=this.modalWrap.querySelector('#ddcDemandPreview');if(pv)pv.innerHTML='';
      };
      const readCfg=()=>({
        layerId:this.modalWrap.querySelector('#ddcDemandLayer')?.value,
        demandField:this.modalWrap.querySelector('#ddcDemandField')?.value||'demand',
        diameterField:this.modalWrap.querySelector('#ddcDemandDiameter')?.value||'',
        enabledField:this.modalWrap.querySelector('#ddcDemandEnabled')?.value||'',
        seed:this.modalWrap.querySelector('#ddcDemandSeed')?.value||'2026',
        days:clamp(n(this.modalWrap.querySelector('#ddcDemandDays')?.value,30),1,31),
        spread:clamp(n(this.modalWrap.querySelector('#ddcDemandSpread')?.value,.42),.05,1.2),
        overwrite:!!this.modalWrap.querySelector('#ddcDemandOverwrite')?.checked,
        zeroDisabled:!!this.modalWrap.querySelector('#ddcDemandZeroDisabled')?.checked
      });
      const preview=()=>{
        const cfg=readCfg(),res=this._generateSampleDemandValues(cfg);
        this._sampleDemandPreview={cfg,values:res.values};
        const host=this.modalWrap.querySelector('#ddcDemandPreview');if(!host)return;
        host.innerHTML='<div style="font-weight:700;margin-bottom:6px">'+esc(this.t('sampleDemand.previewTitle'))+'</div>'+this._sampleDemandStatsHtml(res.stats);
      };
      const apply=()=>{
        const cfg=readCfg();
        let values=this._sampleDemandPreview&&JSON.stringify(this._sampleDemandPreview.cfg)===JSON.stringify(cfg)?this._sampleDemandPreview.values:null;
        if(!values)values=this._generateSampleDemandValues(cfg).values;
        const count=this._applySampleDemandValues(cfg,values);
        this._sampleDemandPreview=null;this._closeModal();this.toast(this.t('sampleDemand.applied',{count}),4200);
      };
      this._modal(this.t('sampleDemand.title'),html,[
        {text:this.t('sampleDemand.preview'),fn:preview},
        {text:this.t('sampleDemand.apply'),primary:true,fn:apply},
        {text:this.t('common.cancel'),fn:()=>{this._sampleDemandPreview=null;this._closeModal();}}
      ],{wide:true});
      this.modalWrap.querySelector('#ddcDemandLayer').onchange=refreshFields;
      refreshFields();
    },
    _generateSampleDemandValues(cfg){
      const l=this.getLayer(cfg.layerId);if(!l)throw new Error(this.t('sampleDemand.noLayer'));
      const values=[];const demands=[];const monthly=[];let skipped=0,disabled=0;
      l.fc.features.forEach((f,i)=>{
        f.properties=f.properties||{};
        const old=f.properties[cfg.demandField];
        if(!cfg.overwrite&&old!==null&&old!==undefined&&old!==''&&Number(old)!==0){values.push({i,skip:true});skipped++;return;}
        let month=0,demand=0;
        if(cfg.zeroDisabled&&isDisabled(f,cfg.enabledField)){disabled++;}
        else{
          const dia=cfg.diameterField?f.properties[cfg.diameterField]:15;
          month=monthlySample(dia,cfg.seed+'|'+featureKey(f,i),cfg.spread);
          demand=m3MonthToLps(month,cfg.days);
        }
        demand=Number(demand.toFixed(6));month=Number(month.toFixed(2));
        values.push({i,demand,month});demands.push(demand);monthly.push(month);
      });
      const sum=demands.reduce((a,b)=>a+b,0),sumMonth=monthly.reduce((a,b)=>a+b,0);
      const stats={count:demands.length,skipped,disabled,min:demands.length?Math.min(...demands):0,max:demands.length?Math.max(...demands):0,avg:demands.length?sum/demands.length:0,p50:percentile(demands,.5),p90:percentile(demands,.9),sum,sumMonth};
      return{values,stats};
    },
    _sampleDemandStatsHtml(s){
      const row=(a,b)=>'<tr><td style="padding:3px 12px 3px 0">'+esc(a)+'</td><td style="padding:3px 0;font-weight:600">'+esc(b)+'</td></tr>';
      return '<table>'+row(this.t('sampleDemand.count'),s.count)+row(this.t('sampleDemand.skipped'),s.skipped)+row(this.t('sampleDemand.disabledCount'),s.disabled)+row('Min demand',s.min.toFixed(6)+' L/s')+row('Median (P50)',s.p50.toFixed(6)+' L/s')+row('P90',s.p90.toFixed(6)+' L/s')+row('Average',s.avg.toFixed(6)+' L/s')+row('Max demand',s.max.toFixed(6)+' L/s')+row(this.t('sampleDemand.totalDemand'),s.sum.toFixed(4)+' L/s')+row(this.t('sampleDemand.totalMonthly'),s.sumMonth.toFixed(1)+' m³/tháng')+'</table>';
    },
    _applySampleDemandValues(cfg,values){
      const l=this.getLayer(cfg.layerId);if(!l)return 0;
      this._pushUndo?.();let count=0;
      values.forEach(v=>{if(v.skip)return;const f=l.fc.features[v.i];if(!f)return;f.properties=f.properties||{};f.properties[cfg.demandField]=v.demand;count++;});
      this._renderLayer?.(l);this._syncProject?.();this._setDirty?.('sample-demand');this.emit?.('sample-demand:applied',{layer:l,count,config:cfg});
      return count;
    }
  });
})();

/* ===== src/tools/aggregate-junction-generator.js ===== */
// Module: tools/aggregate-junction-generator.js
// v0.6.6: Demand Allocation + Hydraulic Junction generation.
// Goal: create a hydraulic skeleton for EPANET. Customer meters are NOT one-to-one
// with Junctions. Demand is projected onto the connected branch-pipe topology,
// grouped along the same hydraulic corridor, and each group becomes one Junction.
(function(){
  const GEN_TAG='demand_allocation_junction';
  const OLD_GEN_TAG='aggregate_junction';

  function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d;}
  function isPointLayer(l){return geomKind(l?.geometryType)==='point';}
  function isLineLayer(l){return geomKind(l?.geometryType)==='line';}
  function hasField(l,name){return (l?.schema||[]).some(f=>String(f.name).toLowerCase()===String(name).toLowerCase());}
  function lineParts(g){if(!g)return[];if(g.type==='LineString')return[g.coordinates||[]];if(g.type==='MultiLineString')return g.coordinates||[];return[];}
  function pointCoord(f){const g=f?.geometry;if(!g||g.type!=='Point'||!Array.isArray(g.coordinates))return null;return g.coordinates;}
  function metersPerDegLon(lat){return Math.max(1,111320*Math.cos((lat||0)*Math.PI/180));}
  function localXY(c,ref){return[(c[0]-ref[0])*metersPerDegLon(ref[1]),(c[1]-ref[1])*110540];}
  function distM(a,b){if(!a||!b)return Infinity;const lat=(a[1]+b[1])/2*Math.PI/180;const dx=(a[0]-b[0])*111320*Math.cos(lat),dy=(a[1]-b[1])*110540;return Math.hypot(dx,dy);}
  function nearestOnSegment(p,a,b){const A=localXY(a,p),B=localXY(b,p),vx=B[0]-A[0],vy=B[1]-A[1],den=vx*vx+vy*vy;let t=den?-(A[0]*vx+A[1]*vy)/den:0;t=Math.max(0,Math.min(1,t));const q=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];return{coord:q,distance:distM(p,q),t};}
  function featureKey(f,i){return f?.properties?.asset_id??f?.properties?.cus_id??f?.properties?.serial??f?.properties?.id??f?.id??i;}
  function safeName(v){return String(v||'').trim();}
  function generatedLayer(l){if(!l)return false;const fs=l.fc?.features||[];return fs.length>0&&fs.every(f=>f?.properties?.generated_by===GEN_TAG||f?.properties?.generated_by===OLD_GEN_TAG||f?.properties?.is_auto===1);}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

  function schema(){return[
    {name:'id',type:'String',dbfType:'C',length:40,decimals:0,visible:true,editable:false,required:true,alias:'id'},
    {name:'elevation',type:'Double',dbfType:'N',length:18,decimals:3,visible:true,editable:true,required:false,alias:'elevation'},
    {name:'demand',type:'Double',dbfType:'N',length:18,decimals:6,visible:true,editable:true,required:false,alias:'demand'},
    {name:'baseDemand',type:'Double',dbfType:'N',length:18,decimals:6,visible:true,editable:true,required:false,alias:'baseDemand'},
    {name:'pattern',type:'String',dbfType:'C',length:40,decimals:0,visible:true,editable:true,required:false,alias:'pattern'},
    {name:'source_count',type:'Integer',dbfType:'N',length:10,decimals:0,visible:true,editable:false,required:false,alias:'source_count'},
    {name:'pipe_id',type:'String',dbfType:'C',length:80,decimals:0,visible:true,editable:false,required:false,alias:'pipe_id'},
    {name:'branch_id',type:'String',dbfType:'C',length:50,decimals:0,visible:true,editable:false,required:false,alias:'branch_id'},
    {name:'cluster_no',type:'Integer',dbfType:'N',length:10,decimals:0,visible:true,editable:false,required:false,alias:'cluster_no'},
    {name:'chainage_m',type:'Double',dbfType:'N',length:18,decimals:3,visible:true,editable:false,required:false,alias:'chainage_m'},
    {name:'root_main',type:'String',dbfType:'C',length:80,decimals:0,visible:true,editable:false,required:false,alias:'root_main'},
    {name:'generated_by',type:'String',dbfType:'C',length:40,decimals:0,visible:true,editable:false,required:false,alias:'generated_by'},
    {name:'is_auto',type:'Integer',dbfType:'N',length:1,decimals:0,visible:true,editable:false,required:false,alias:'is_auto'}
  ];}

  // ---------- spatial index ----------
  function makeGrid(cellM,refLat){
    const lonDeg=cellM/metersPerDegLon(refLat),latDeg=cellM/110540,map=new Map();
    const key=(x,y)=>x+','+y;
    const cell=c=>[Math.floor(c[0]/lonDeg),Math.floor(c[1]/latDeg)];
    function insertBBox(minX,minY,maxX,maxY,id){
      const a=cell([minX,minY]),b=cell([maxX,maxY]);
      for(let x=a[0];x<=b[0];x++)for(let y=a[1];y<=b[1];y++){const k=key(x,y);if(!map.has(k))map.set(k,[]);map.get(k).push(id);}
    }
    function nearby(c,rCells=1){const p=cell(c),out=new Set();for(let dx=-rCells;dx<=rCells;dx++)for(let dy=-rCells;dy<=rCells;dy++){for(const id of map.get(key(p[0]+dx,p[1]+dy))||[])out.add(id);}return [...out];}
    return{insertBBox,nearby,lonDeg,latDeg};
  }

  function flattenSegments(features){
    const segments=[];
    features.forEach((f,fi)=>lineParts(f?.geometry).forEach((coords,pi)=>{
      for(let si=1;si<coords.length;si++){
        const a=coords[si-1],b=coords[si];if(!a||!b||distM(a,b)<1e-5)continue;
        segments.push({id:segments.length,featureIndex:fi,partIndex:pi,segmentIndex:si-1,a:a.slice(),b:b.slice(),len:distM(a,b),splits:[{t:0,coord:a.slice(),kind:'vertex'},{t:1,coord:b.slice(),kind:'vertex'}]});
      }
    }));
    return segments;
  }

  function buildMainIndex(mainFeatures,cellM=50){
    const segs=flattenSegments(mainFeatures);let lat=0,n=0;for(const s of segs){lat+=(s.a[1]+s.b[1])/2;n++;}lat=n?lat/n:0;
    const grid=makeGrid(Math.max(10,cellM),lat);
    segs.forEach(s=>{const padLat=cellM/110540,padLon=cellM/metersPerDegLon((s.a[1]+s.b[1])/2);grid.insertBBox(Math.min(s.a[0],s.b[0])-padLon,Math.min(s.a[1],s.b[1])-padLat,Math.max(s.a[0],s.b[0])+padLon,Math.max(s.a[1],s.b[1])+padLat,s.id);});
    function nearest(p,maxDist=Infinity){let best=null;const ids=grid.nearby(p,2);const use=ids.length?ids:segs.map(s=>s.id);for(const id of use){const s=segs[id],q=nearestOnSegment(p,s.a,s.b);if(q.distance<=maxDist&&(!best||q.distance<best.distance))best={segment:s,coord:q.coord,distance:q.distance,t:q.t,featureIndex:s.featureIndex};}return best;}
    return{segs,nearest};
  }

  // Build a noded service/branch graph. Important: an endpoint landing on the
  // middle of another pipe creates a T-node. Pure line crossings are NOT joined
  // automatically because crossing pipes are not necessarily hydraulically connected.
  function buildHydraulicGraph(features,tolM){
    const segs=flattenSegments(features);let lat=0,n=0;for(const s of segs){lat+=(s.a[1]+s.b[1])/2;n++;}lat=n?lat/n:0;
    const cellM=Math.max(2,tolM*3),grid=makeGrid(cellM,lat);
    segs.forEach(s=>{const padLat=tolM/110540,padLon=tolM/metersPerDegLon((s.a[1]+s.b[1])/2);grid.insertBBox(Math.min(s.a[0],s.b[0])-padLon,Math.min(s.a[1],s.b[1])-padLat,Math.max(s.a[0],s.b[0])+padLon,Math.max(s.a[1],s.b[1])+padLat,s.id);});

    // Endpoint -> segment noding (T-junction support).
    const endpoints=[];
    features.forEach((f,fi)=>lineParts(f?.geometry).forEach((coords,pi)=>{if(coords.length>=2){endpoints.push({coord:coords[0],featureIndex:fi,partIndex:pi,side:0});endpoints.push({coord:coords[coords.length-1],featureIndex:fi,partIndex:pi,side:1});}}));
    for(const ep of endpoints){
      for(const sid of grid.nearby(ep.coord,2)){
        const s=segs[sid];if(s.featureIndex===ep.featureIndex&&s.partIndex===ep.partIndex)continue;
        const q=nearestOnSegment(ep.coord,s.a,s.b);if(q.distance<=tolM&&q.t>1e-6&&q.t<1-1e-6)s.splits.push({t:q.t,coord:q.coord.slice(),kind:'t-junction'});
      }
    }

    const nodes=[],nodeGrid=makeGrid(Math.max(.25,tolM),lat),edges=[],featureEdges=new Map();
    function nodeFor(coord,meta){
      let best=-1,bestD=Infinity;for(const ni of nodeGrid.nearby(coord,1)){const d=distM(coord,nodes[ni].coord);if(d<=tolM&&d<bestD){best=ni;bestD=d;}}
      if(best>=0){if(meta?.kind==='endpoint')nodes[best].hasEndpoint=true;if(meta?.kind==='t-junction')nodes[best].hasTJunction=true;return best;}
      const id=nodes.length;nodes.push({id,coord:coord.slice(),edges:[],component:-1,hasEndpoint:meta?.kind==='endpoint',hasTJunction:meta?.kind==='t-junction',rootIds:[]});nodeGrid.insertBBox(coord[0],coord[1],coord[0],coord[1],id);return id;
    }
    segs.forEach(s=>{
      s.splits.sort((a,b)=>a.t-b.t);const clean=[];for(const x of s.splits){if(!clean.length||Math.abs(x.t-clean[clean.length-1].t)>1e-7)clean.push(x);}
      for(let i=1;i<clean.length;i++){
        const p0=clean[i-1],p1=clean[i],len=distM(p0.coord,p1.coord);if(len<1e-4)continue;
        const a=nodeFor(p0.coord,{kind:p0.t<=1e-7||p0.t>=1-1e-7?'endpoint':p0.kind}),b=nodeFor(p1.coord,{kind:p1.t<=1e-7||p1.t>=1-1e-7?'endpoint':p1.kind});
        if(a===b)continue;const id=edges.length,e={id,a,b,length:len,featureIndex:s.featureIndex,partIndex:s.partIndex,segmentIndex:s.segmentIndex,sourceSegmentId:s.id,coordA:p0.coord.slice(),coordB:p1.coord.slice()};edges.push(e);nodes[a].edges.push(id);nodes[b].edges.push(id);if(!featureEdges.has(s.featureIndex))featureEdges.set(s.featureIndex,[]);featureEdges.get(s.featureIndex).push(id);
      }
    });
    let comp=0;for(const node of nodes){if(node.component>=0)continue;node.component=comp;const st=[node.id];while(st.length){const u=st.pop();for(const ei of nodes[u].edges){const e=edges[ei],v=e.a===u?e.b:e.a;if(nodes[v].component<0){nodes[v].component=comp;st.push(v);}}}comp++;}
    return{nodes,edges,featureEdges,componentCount:comp};
  }

  function heapDijkstra(graph,seeds){
    const dist=new Array(graph.nodes.length).fill(Infinity),root=new Array(graph.nodes.length).fill(-1),heap=[];
    const push=it=>{heap.push(it);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p][0]<=it[0])break;heap[i]=heap[p];i=p;}heap[i]=it;};
    const pop=()=>{if(!heap.length)return null;const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let l=i*2+1,r=l+1,b=l;if(r<heap.length&&heap[r][0]<heap[l][0])b=r;if(b>=heap.length||heap[b][0]>=last[0])break;heap[i]=heap[b];i=b;}heap[i]=last;}return top;};
    seeds.forEach(s=>{if(0<dist[s.nodeId]){dist[s.nodeId]=0;root[s.nodeId]=s.rootId;push([0,s.nodeId,s.rootId]);}});
    while(heap.length){const [du,u,rid]=pop();if(Math.abs(du-dist[u])>1e-9||root[u]!==rid)continue;for(const ei of graph.nodes[u].edges){const e=graph.edges[ei],v=e.a===u?e.b:e.a,nd=du+e.length;if(nd+1e-9<dist[v]){dist[v]=nd;root[v]=rid;push([nd,v,rid]);}}}
    return{dist,root};
  }

  function detectRoots(graph,mains,mainTol){
    const mainIndex=buildMainIndex(mains,Math.max(30,mainTol*5));const raw=[];
    // Prefer endpoints/branch nodes. This avoids creating many roots when a branch pipe
    // happens to run parallel and close to the main.
    for(const node of graph.nodes){
      if(!(node.hasEndpoint||node.edges.length!==2))continue;
      const q=mainIndex.nearest(node.coord,mainTol);if(!q)continue;
      raw.push({nodeId:node.id,component:node.component,coord:q.coord.slice(),mainKey:String(featureKey(mains[q.featureIndex],q.featureIndex)),distance:q.distance});
    }
    // Same hydraulic point may be discovered multiple times due to tiny GIS offsets.
    const roots=[];
    for(const r of raw){let g=roots.find(x=>x.component===r.component&&x.mainKey===r.mainKey&&distM(x.coord,r.coord)<=mainTol);if(!g){g={id:roots.length,component:r.component,mainKey:r.mainKey,coord:r.coord.slice(),nodeIds:[]};roots.push(g);}g.nodeIds.push(r.nodeId);}
    roots.forEach(r=>r.nodeIds.forEach(n=>graph.nodes[n].rootIds.push(r.id)));
    return roots;
  }

  // A corridor is a continuous pipe path between hydraulic anchors (root, branch,
  // or dead-end). Shape vertices with degree 2 stay inside the corridor and do not
  // become standalone Junctions.
  function buildCorridors(graph,roots,labels,features){
    const rootNodes=new Set(roots.flatMap(r=>r.nodeIds));const anchor=n=>rootNodes.has(n.id)||n.edges.length!==2;const used=new Set(),corridors=[];
    function trace(startNode,firstEdge){
      const refs=[];let u=startNode,ei=firstEdge,length=0;
      while(true){if(used.has(ei))break;used.add(ei);const e=graph.edges[ei],v=e.a===u?e.b:e.a;refs.push({edgeId:ei,from:u,to:v,offset:length,length:e.length});length+=e.length;if(anchor(graph.nodes[v]))return{endNode:v,refs,length};const next=graph.nodes[v].edges.find(x=>x!==ei&&!used.has(x));if(next==null)return{endNode:v,refs,length};u=v;ei=next;}
      return{endNode:u,refs,length};
    }
    for(const n of graph.nodes){if(!anchor(n))continue;for(const ei of n.edges){if(used.has(ei))continue;const t=trace(n.id,ei),id=corridors.length;const rootA=labels.root[n.id],rootB=labels.root[t.endNode],rootId=rootA>=0?rootA:rootB;const sourceFeatures=new Set(t.refs.map(r=>graph.edges[r.edgeId].featureIndex));corridors.push({id,startNode:n.id,endNode:t.endNode,refs:t.refs,length:t.length,rootId,component:n.component,sourceFeatures,meters:[]});}}
    // Closed loops with no anchor: consume remaining edges as one corridor.
    for(const e of graph.edges){if(used.has(e.id))continue;const t=trace(e.a,e.id),id=corridors.length;const sourceFeatures=new Set(t.refs.map(r=>graph.edges[r.edgeId].featureIndex));corridors.push({id,startNode:e.a,endNode:t.endNode,refs:t.refs,length:t.length,rootId:labels.root[e.a],component:graph.nodes[e.a].component,sourceFeatures,meters:[]});}
    const edgeToCorridor=new Map();corridors.forEach(c=>c.refs.forEach((r,i)=>edgeToCorridor.set(r.edgeId,{corridorId:c.id,refIndex:i})));
    corridors.forEach(c=>{c.pipeKey=[...c.sourceFeatures].map(fi=>String(featureKey(features[fi],fi))).join('+');c.rootMain=c.rootId>=0?roots[c.rootId]?.mainKey||'':'';});
    return{corridors,edgeToCorridor};
  }

  function nearestGraphEdge(p,graph,maxDist){let best=null;for(const e of graph.edges){const q=nearestOnSegment(p,e.coordA,e.coordB);if(q.distance<=maxDist&&(!best||q.distance<best.distance))best={edge:e,coord:q.coord,distance:q.distance,t:q.t};}return best;}

  function corridorPointAt(c,graph,chainage){let x=clamp(chainage,0,c.length);for(const r of c.refs){if(x<=r.offset+r.length+1e-9){const e=graph.edges[r.edgeId],fromCoord=graph.nodes[r.from].coord,toCoord=graph.nodes[r.to].coord,t=r.length?clamp((x-r.offset)/r.length,0,1):0;return[fromCoord[0]+(toCoord[0]-fromCoord[0])*t,fromCoord[1]+(toCoord[1]-fromCoord[1])*t];}}return graph.nodes[c.endNode].coord.slice();}

  function chainageOnCorridor(c,graph,edgeId,q){const ref=c.refs.find(r=>r.edgeId===edgeId);if(!ref)return 0;const from=graph.nodes[ref.from].coord,to=graph.nodes[ref.to].coord;const nq=nearestOnSegment(q,from,to);return ref.offset+nq.t*ref.length;}

  function parentCorridorAtNode(c,corridors,graph,labels){
    // rootward endpoint is the endpoint with lower Dijkstra distance.
    const ds=labels.dist[c.startNode],de=labels.dist[c.endNode],nodeId=ds<=de?c.startNode:c.endNode;
    const candidates=[];for(const ei of graph.nodes[nodeId].edges){for(const x of corridors){if(x.id===c.id)continue;if(x.refs.some(r=>r.edgeId===ei)){candidates.push(x);break;}}}
    if(!candidates.length)return null;return candidates.sort((a,b)=>Math.min(labels.dist[a.startNode],labels.dist[a.endNode])-Math.min(labels.dist[b.startNode],labels.dist[b.endNode]))[0]||null;
  }

  function mapMeterToCorridor(meter,mi,graph,corridorData,roots,labels,features,cfg){
    const p=pointCoord(meter);if(!p)return null;const hit=nearestGraphEdge(p,graph,cfg.meterTolerance);if(!hit)return null;let info=corridorData.edgeToCorridor.get(hit.edge.id);if(!info)return null;let corridor=corridorData.corridors[info.corridorId],point=hit.coord.slice(),chain=chainageOnCorridor(corridor,graph,hit.edge.id,point),collapsedSpur=false;
    // Collapse only very short dead-end customer spurs. Distribution branches such as
    // E/D/B-C are normally longer than this threshold and remain independent corridors.
    const startDeg=graph.nodes[corridor.startNode].edges.length,endDeg=graph.nodes[corridor.endNode].edges.length,isDeadEnd=startDeg===1||endDeg===1;
    if(isDeadEnd&&corridor.length<=cfg.spurMaxLength){const parent=parentCorridorAtNode(corridor,corridorData.corridors,graph,labels);if(parent){const joinNode=(graph.nodes[corridor.startNode].edges.length===1)?corridor.endNode:corridor.startNode;point=graph.nodes[joinNode].coord.slice();corridor=parent; // place demand on the distribution corridor feeding the house spur
        // chainage on parent via nearest parent edge to join point
        let best=null;for(const r of parent.refs){const e=graph.edges[r.edgeId],q=nearestOnSegment(point,e.coordA,e.coordB);if(!best||q.distance<best.distance)best={edgeId:e.id,coord:q.coord,distance:q.distance};}if(best){point=best.coord;chain=chainageOnCorridor(parent,graph,best.edgeId,point);}collapsedSpur=true;}}
    const demand=num(meter?.properties?.[cfg.demandField],0);return{meterIndex:mi,meterId:String(featureKey(meter,mi)),demand,corridorId:corridor.id,coord:point,chainage:chain,collapsedSpur,rootId:corridor.rootId};
  }

  function splitSpatialRuns(items,cfg){
    if(!items.length)return[];const sorted=items.slice().sort((a,b)=>a.chainage-b.chainage),runs=[];let run=[sorted[0]],start=sorted[0].chainage;
    for(let i=1;i<sorted.length;i++){const gap=sorted[i].chainage-sorted[i-1].chainage,span=sorted[i].chainage-start;if(gap>cfg.clusterGap||span>cfg.maxClusterLength){runs.push(run);run=[sorted[i]];start=sorted[i].chainage;}else run.push(sorted[i]);}runs.push(run);return runs;
  }

  // Keep groups balanced. Example: 4 meters with max=3 -> 2+2, not 3+1.
  function balanceByCount(run,maxMeters){if(run.length<=maxMeters)return[run];const groups=Math.ceil(run.length/maxMeters),base=Math.floor(run.length/groups),extra=run.length%groups,out=[];let p=0;for(let g=0;g<groups;g++){const size=base+(g<extra?1:0);out.push(run.slice(p,p+size));p+=size;}return out;}

  function clusterMeters(assignments,corridors,graph,cfg){
    const by=new Map();for(const a of assignments){if(!by.has(a.corridorId))by.set(a.corridorId,[]);by.get(a.corridorId).push(a);}const clusters=[];
    for(const [cid,items] of by){const corridor=corridors[cid];let no=0;for(const run of splitSpatialRuns(items,cfg)){for(const group of balanceByCount(run,cfg.maxMetersPerJunction)){no++;const total=group.reduce((s,x)=>s+x.demand,0),chain=total>0?group.reduce((s,x)=>s+x.chainage*x.demand,0)/total:group.reduce((s,x)=>s+x.chainage,0)/group.length;clusters.push({corridorId:cid,clusterNo:no,items:group,demand:total,chainage:chain,coord:corridorPointAt(corridor,graph,chain),corridor});}}}
    return clusters;
  }

  Object.assign(WaterMapCore.prototype,{
    _aggregateJunctionCandidates(){const points=(this.layers||[]).filter(l=>isPointLayer(l)&&(l.fc?.features||[]).length),meters=points.filter(l=>hasField(l,'demand')||hasField(l,'baseDemand')),lines=(this.layers||[]).filter(l=>isLineLayer(l)&&(l.fc?.features||[]).length);return{meters,lines};},

    showAggregateJunctionTool(){
      const c=this._aggregateJunctionCandidates();if(!c.meters.length||c.lines.length<2){this.toast(this.t('aggregateJunction.needLayers'),4500);return;}
      const active=this.getActiveLayer?.(),meterDefault=c.meters.find(x=>x.id===active?.id)||c.meters[0],meterOpts=c.meters.map(l=>'<option value="'+esc(l.id)+'"'+(l.id===meterDefault.id?' selected':'')+'>'+esc(l.name)+' ('+(l.fc?.features?.length||0)+')</option>').join(''),lineOpts=c.lines.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+' ('+(l.fc?.features?.length||0)+')</option>').join('');
      const html='\
<div style="display:grid;grid-template-columns:225px 1fr;gap:10px 12px;align-items:center">\
<label>'+esc(this.t('aggregateJunction.meterLayer'))+'</label><select id="ddcAggMeter">'+meterOpts+'</select>\
<label>'+esc(this.t('aggregateJunction.demandField'))+'</label><select id="ddcAggDemand"></select>\
<label>'+esc(this.t('aggregateJunction.serviceLayer'))+'</label><select id="ddcAggService">'+lineOpts+'</select>\
<label>'+esc(this.t('aggregateJunction.mainLayer'))+'</label><select id="ddcAggMain">'+lineOpts+'</select>\
<label>'+esc(this.t('aggregateJunction.outputName'))+'</label><input id="ddcAggName" value="w_junctions_auto">\
<label>'+esc(this.t('aggregateJunction.meterTolerance'))+'</label><input id="ddcAggMeterTol" type="number" min="0.1" step="0.5" value="5">\
<label>'+esc(this.t('aggregateJunction.mainTolerance'))+'</label><input id="ddcAggMainTol" type="number" min="0.1" step="0.5" value="3">\
<label>'+esc(this.t('aggregateJunction.groupTolerance'))+'</label><input id="ddcAggGroupTol" type="number" min="0.05" step="0.1" value="0.75">\
<label>'+esc(this.t('aggregateJunction.spurMaxLength'))+'</label><input id="ddcAggSpur" type="number" min="0" step="1" value="20">\
<label>'+esc(this.t('aggregateJunction.clusterGap'))+'</label><input id="ddcAggGap" type="number" min="1" step="1" value="30">\
<label>'+esc(this.t('aggregateJunction.maxClusterLength'))+'</label><input id="ddcAggLen" type="number" min="1" step="5" value="50">\
<label>'+esc(this.t('aggregateJunction.maxMeters'))+'</label><input id="ddcAggMax" type="number" min="1" step="1" value="3">\
</div>\
<div style="margin-top:12px;padding:10px;border:1px solid #d8e0e5;border-radius:6px;background:#f8fafb">'+esc(this.t('aggregateJunction.help'))+'</div>\
<div id="ddcAggPreview" style="margin-top:12px"></div>';
      const score=(l,k)=>{const n=String(l.name||'').toLowerCase();return k==='service'?(/service|nhanh|phanphoi|distribution/.test(n)?10:0):(/main|chinh|trunk/.test(n)?10:0);};
      const setSmartDefaults=()=>{const service=this.modalWrap.querySelector('#ddcAggService'),main=this.modalWrap.querySelector('#ddcAggMain');const s=c.lines.slice().sort((a,b)=>score(b,'service')-score(a,'service'))[0],m=c.lines.filter(x=>x.id!==s?.id).sort((a,b)=>score(b,'main')-score(a,'main'))[0]||c.lines[1];if(s)service.value=s.id;if(m)main.value=m.id;};
      const refreshDemand=()=>{const l=this.getLayer(this.modalWrap.querySelector('#ddcAggMeter')?.value)||meterDefault,sel=this.modalWrap.querySelector('#ddcAggDemand'),numeric=(l.schema||[]).filter(f=>/double|integer|number|float|decimal/i.test(String(f.type||'')));sel.innerHTML=numeric.map(f=>'<option value="'+esc(f.name)+'"'+(/^(demand|basedemand)$/i.test(String(f.name))?' selected':'')+'>'+esc(f.alias||f.name)+'</option>').join('');};
      const readCfg=()=>({meterLayerId:this.modalWrap.querySelector('#ddcAggMeter')?.value,demandField:this.modalWrap.querySelector('#ddcAggDemand')?.value||'demand',serviceLayerId:this.modalWrap.querySelector('#ddcAggService')?.value,mainLayerId:this.modalWrap.querySelector('#ddcAggMain')?.value,outputName:safeName(this.modalWrap.querySelector('#ddcAggName')?.value)||'w_junctions_auto',meterTolerance:Math.max(.1,num(this.modalWrap.querySelector('#ddcAggMeterTol')?.value,5)),mainTolerance:Math.max(.1,num(this.modalWrap.querySelector('#ddcAggMainTol')?.value,3)),groupTolerance:Math.max(.05,num(this.modalWrap.querySelector('#ddcAggGroupTol')?.value,.75)),spurMaxLength:Math.max(0,num(this.modalWrap.querySelector('#ddcAggSpur')?.value,20)),clusterGap:Math.max(1,num(this.modalWrap.querySelector('#ddcAggGap')?.value,30)),maxClusterLength:Math.max(1,num(this.modalWrap.querySelector('#ddcAggLen')?.value,50)),maxMetersPerJunction:Math.max(1,Math.round(num(this.modalWrap.querySelector('#ddcAggMax')?.value,3)))});
      const preview=()=>{try{const cfg=readCfg(),res=this._buildAggregateJunctionData(cfg);this._aggregateJunctionPreview={cfg,res};const host=this.modalWrap.querySelector('#ddcAggPreview');if(host)host.innerHTML=this._aggregateJunctionStatsHtml(res.stats);}catch(e){console.error(e);this.toast(e.message||String(e),5000);}};
      const apply=()=>{try{const cfg=readCfg(),existing=(this.layers||[]).find(l=>String(l.name).toLowerCase()===cfg.outputName.toLowerCase());if(existing){if(!generatedLayer(existing)){this.toast(this.t('aggregateJunction.nameConflict',{name:cfg.outputName}),5200);return;}if(!confirm(this.t('aggregateJunction.rebuildConfirm',{name:existing.name,count:existing.fc?.features?.length||0})))return;}let res=this._aggregateJunctionPreview&&JSON.stringify(this._aggregateJunctionPreview.cfg)===JSON.stringify(cfg)?this._aggregateJunctionPreview.res:null;if(!res)res=this._buildAggregateJunctionData(cfg);this._applyAggregateJunctionData(cfg,res,existing);this._aggregateJunctionPreview=null;this._closeModal();this.toast(this.t('aggregateJunction.created',{count:res.fc.features.length,name:cfg.outputName}),5000);}catch(e){console.error(e);this.toast(e.message||String(e),6000);}};
      this._modal(this.t('aggregateJunction.title'),html,[{text:this.t('aggregateJunction.preview'),fn:preview},{text:this.t('aggregateJunction.generate'),primary:true,fn:apply},{text:this.t('common.cancel'),fn:()=>{this._aggregateJunctionPreview=null;this._closeModal();}}],{wide:true});this.modalWrap.querySelector('#ddcAggMeter').onchange=refreshDemand;setSmartDefaults();refreshDemand();
    },

    _buildAggregateJunctionData(cfg){
      const meterLayer=this.getLayer(cfg.meterLayerId),serviceLayer=this.getLayer(cfg.serviceLayerId),mainLayer=this.getLayer(cfg.mainLayerId);if(!meterLayer||!serviceLayer||!mainLayer)throw new Error(this.t('aggregateJunction.needLayers'));if(serviceLayer.id===mainLayer.id)throw new Error(this.t('aggregateJunction.serviceMainDifferent'));if(!isPointLayer(meterLayer)||!isLineLayer(serviceLayer)||!isLineLayer(mainLayer))throw new Error(this.t('aggregateJunction.geometryMismatch'));
      const meters=meterLayer.fc?.features||[],services=serviceLayer.fc?.features||[],mains=mainLayer.fc?.features||[];
      const graph=buildHydraulicGraph(services,cfg.groupTolerance),roots=detectRoots(graph,mains,cfg.mainTolerance),seeds=[];roots.forEach(r=>r.nodeIds.forEach(nodeId=>seeds.push({nodeId,rootId:r.id})));const labels=heapDijkstra(graph,seeds),corridorData=buildCorridors(graph,roots,labels,services);
      const assignments=[];let unmatchedMeter=0,unmatchedRoot=0,zeroDemand=0,collapsedSpurs=0;
      meters.forEach((m,mi)=>{const a=mapMeterToCorridor(m,mi,graph,corridorData,roots,labels,services,cfg);if(!a){unmatchedMeter++;return;}if(a.rootId<0){unmatchedRoot++;return;}if(a.demand===0)zeroDemand++;if(a.collapsedSpur)collapsedSpurs++;assignments.push(a);});
      const clusters=clusterMeters(assignments,corridorData.corridors,graph,cfg);let idx=0;const features=[];
      for(const cl of clusters){const c=cl.corridor;if(cl.items.length===0)continue;idx++;const id='AUTO_JUNC_'+String(idx).padStart(6,'0'),branchId='BRANCH_'+String((c.rootId>=0?c.rootId:c.component)+1).padStart(5,'0');features.push({type:'Feature',id,properties:{id,elevation:0,demand:Number(cl.demand.toFixed(6)),baseDemand:Number(cl.demand.toFixed(6)),pattern:'',source_count:cl.items.length,pipe_id:c.pipeKey||String(c.id),branch_id:branchId,cluster_no:cl.clusterNo,chainage_m:Number(cl.chainage.toFixed(3)),root_main:c.rootMain||'',generated_by:GEN_TAG,is_auto:1},geometry:{type:'Point',coordinates:cl.coord.slice()}});}
      const totalInputDemand=assignments.reduce((s,a)=>s+a.demand,0),totalOutputDemand=features.reduce((s,f)=>s+num(f.properties.demand,0),0),corridorsWithDemand=new Set(assignments.map(a=>a.corridorId)).size;
      return{fc:{type:'FeatureCollection',name:cfg.outputName,features},schema:schema(),stats:{meters:meters.length,services:services.length,serviceComponents:graph.componentCount,roots:roots.length,corridors:corridorData.corridors.length,corridorsWithDemand,matched:assignments.length,unmatchedMeter,unmatchedRoot,zeroDemand,collapsedSpurs,junctions:features.length,totalInputDemand,totalOutputDemand,demandBalance:Math.abs(totalInputDemand-totalOutputDemand)}};
    },

    _aggregateJunctionStatsHtml(s){const row=(a,b)=>'<tr><td style="padding:3px 14px 3px 0">'+esc(a)+'</td><td style="font-weight:600">'+esc(b)+'</td></tr>';return '<div style="font-weight:700;margin-bottom:6px">'+esc(this.t('aggregateJunction.previewTitle'))+'</div><table>'+row(this.t('aggregateJunction.meters'),s.meters)+row(this.t('aggregateJunction.services'),s.services)+row(this.t('aggregateJunction.serviceComponents'),s.serviceComponents)+row(this.t('aggregateJunction.roots'),s.roots)+row(this.t('aggregateJunction.corridors'),s.corridors)+row(this.t('aggregateJunction.corridorsWithDemand'),s.corridorsWithDemand)+row(this.t('aggregateJunction.matched'),s.matched)+row(this.t('aggregateJunction.unmatchedMeter'),s.unmatchedMeter)+row(this.t('aggregateJunction.unmatchedMain'),s.unmatchedRoot)+row(this.t('aggregateJunction.collapsedSpurs'),s.collapsedSpurs)+row(this.t('aggregateJunction.junctions'),s.junctions)+row(this.t('aggregateJunction.totalDemand'),s.totalOutputDemand.toFixed(6)+' L/s')+row(this.t('aggregateJunction.demandBalance'),s.demandBalance.toFixed(9)+' L/s')+'</table>';},
    _removeGeneratedLayerNoUndo(layer){if(!layer)return;try{if(layer.leaflet)this.map.removeLayer(layer.leaflet);if(layer._hitLayer)this.map.removeLayer(layer._hitLayer);if(layer._directionLayer)this.map.removeLayer(layer._directionLayer);}catch(_){}this.layers=this.layers.filter(x=>x.id!==layer.id);this.layerIndex.delete(layer.id);if(this.activeLayerId===layer.id)this.activeLayerId=null;this.emit?.('layer:removed',{layer});},
    _applyAggregateJunctionData(cfg,res,existing){this._pushUndo?.();if(existing)this._removeGeneratedLayerNoUndo(existing);const l=this._addLayerRecord({name:cfg.outputName,fc:res.fc,geometryType:'Point',schema:res.schema,style:{color:'#7a3db8',stroke:'#ffffff',radius:7,opacity:.95,symbol:'junction'},visible:true,sourceCRS:'EPSG:4326',epanetRole:'junction',epanetMapping:{id:'id',elevation:'elevation',baseDemand:'baseDemand',pattern:'pattern'},clustering:{enabled:false,radius:60,showCount:true}});this.activeLayerId=l.id;this._applyLayerOrder?.();this._syncProject?.();this._setDirty?.('demand-allocation-junction');this.showLayerPanel?.();this.emit?.('aggregate-junction:generated',{layer:l,stats:res.stats,config:cfg});return l;}
  });
})();

/* ===== src/style/style-validator.js ===== */
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
    if(!rule||!Array.isArray(rule.groups))return null;
    if(rule.fieldType==='numeric'){
      const n=Number(raw);if(!Number.isFinite(n))return null;
      return rule.groups.find(g=>{const mn=g.min===''||g.min==null?-Infinity:Number(g.min),mx=g.max===''||g.max==null?Infinity:Number(g.max);return n>=mn&&n<=mx;})||null;
    }
    const k=String(raw??'').trim().toLowerCase();
    return rule.groups.find(g=>(g.values||[]).some(v=>String(v).trim().toLowerCase()===k))||null;
  }
});

/* ===== src/render/layer-renderer.js ===== */
// Module: render/layer-renderer.js
Object.assign(WaterMapCore.prototype, {
  _leafStyle(layer){const s=layer.style||{};return{color:s.color||'#0b8ea6',weight:s.weight||3,opacity:s.opacity??0.9,fillColor:s.fillColor||'#52b5c5',fillOpacity:s.fillOpacity??0.25};},
  _pointStyle(layer){const s=layer.style||{};return{radius:s.radius||6,color:s.stroke||'#fff',weight:1.5,fillColor:s.color||'#0b8ea6',fillOpacity:s.opacity??0.95};},
  _isFeatureSelected(layer,f){return (this.selection||[]).some(x=>x.layer?.id===layer.id&&String(x.feature?.id)===String(f.id))||(!this.selection?.length&&this.selected?.layer?.id===layer.id&&String(this.selected?.feature?.id)===String(f.id));},
  _featureLeafStyle(layer,f){
    const v=this._resolveFeatureVisualStyle?this._resolveFeatureVisualStyle(layer,f):Object.assign({},this._leafStyle(layer));
    const st={color:v.color||'#0b8ea6',weight:Number(v.weight)||3,opacity:v.opacity??0.9,fillColor:v.fillColor||layer.style?.fillColor||'#52b5c5',fillOpacity:v.fillOpacity??layer.style?.fillOpacity??0.25};
    if(this._isFeatureSelected(layer,f))return Object.assign({},st,{color:'#ffd400',weight:Math.max((st.weight||3)+3,6),opacity:1,fillOpacity:Math.max(st.fillOpacity??0.25,.4)});return st;
  },
  _featurePointStyle(layer,f){
    const v=this._resolveFeatureVisualStyle?this._resolveFeatureVisualStyle(layer,f):Object.assign({},this._pointStyle(layer));
    const st={radius:Number(v.radius)||6,color:v.stroke||layer.style?.stroke||'#fff',weight:1.5,fillColor:v.color||'#0b8ea6',fillOpacity:v.opacity??0.95};
    if(this._isFeatureSelected(layer,f))return Object.assign({},st,{radius:(st.radius||6)+3,color:'#ffd400',weight:3,fillOpacity:1});return st;
  },
  _ensurePointSymbolCss(){
    if(document.getElementById('ddc_meko_symbol_css'))return;const s=document.createElement('style');s.id='ddc_meko_symbol_css';s.textContent='.ddc_meko-symbol{display:flex;align-items:center;justify-content:center;font-weight:700;line-height:1;text-shadow:0 1px 1px rgba(255,255,255,.8)}.ddc_meko-symbol.selected{filter:drop-shadow(0 0 3px #ffd400)}';document.head.appendChild(s);
  },
  _symbolGlyph(symbol){return({circle:'●',square:'■',diamond:'◆',triangle:'▲',star:'★',junction:'●',valve:'◈',pump:'P',meter:'M',tank:'▣'})[symbol]||'●';},
  _pointToLayerStyled(layer,f,ll){
    const v=this._resolveFeatureVisualStyle?this._resolveFeatureVisualStyle(layer,f):{symbol:'circle'};const symbol=v.symbol||'circle';
    if(symbol==='circle')return L.circleMarker(ll,this._featurePointStyle(layer,f));
    this._ensurePointSymbolCss();const size=Math.max(12,(Number(v.radius)||6)*2.6),selected=this._isFeatureSelected(layer,f);const html='<div class="ddc_meko-symbol '+(selected?'selected':'')+'" style="width:'+size+'px;height:'+size+'px;font-size:'+size+'px;color:'+esc(v.color||'#0b8ea6')+'">'+this._symbolGlyph(symbol)+'</div>';
    return L.marker(ll,{icon:L.divIcon({className:'',html,iconSize:[size,size],iconAnchor:[size/2,size/2]})});
  },
  _renderLayer(layer){
    if(layer.leaflet)this.map.removeLayer(layer.leaflet);if(layer._hitLayer){try{this.map.removeLayer(layer._hitLayer);}catch(_){}layer._hitLayer=null;}
    if(geomKind(layer.geometryType)==='point'&&layer.clustering?.enabled&&this._renderPointLayerClustered){this._renderPointLayerClustered(layer);return;}
    layer.leaflet=L.geoJSON(layer.fc,{
      style:f=>this._featureLeafStyle(layer,f),
      pointToLayer:(f,ll)=>this._pointToLayerStyled(layer,f,ll),
      onEachFeature:(f,ll)=>this._bindFeatureLayerEvents(layer,f,ll)
    });
    if(layer.visible!==false)layer.leaflet.addTo(this.map);
    if(geomKind(layer.geometryType)==='line')this._buildLineHitLayer?.(layer);
    this._refreshDirectionLayer?.(layer);
  },

  _buildLineHitLayer(layer){
    if(layer._hitLayer){try{this.map.removeLayer(layer._hitLayer);}catch(_){}layer._hitLayer=null;}
    const hit=L.geoJSON(layer.fc,{style:f=>{const st=this._featureLeafStyle(layer,f);return{color:'#000',weight:Math.max(12,(Number(st.weight)||3)+8),opacity:.001,fill:false};},interactive:true,onEachFeature:(f,ll)=>this._bindFeatureLayerEvents(layer,f,ll)});
    layer._hitLayer=hit;if(layer.visible!==false)hit.addTo(this.map);
  },
  _bindFeatureLayerEvents(layer,f,ll){
    ll.on('mousedown',e=>{if(this.mode==='spatial-update'&&this._beginSpatialFeatureDrag?.(layer,f,ll,e))return;});
    ll.on('click',e=>{L.DomEvent.stopPropagation(e);if(this.mode==='spatial-update')return;if(this.mode==='draw'&&this._handleCreateTargetClick?.(layer,f,e))return;if(this.mode==='topology-snap'){this._handleTopologySnapFeatureClick?.(layer,f);return;}if(this.mode!=='select')return;const oe=e.originalEvent||{};this._selectFeature?.(layer,f,ll,{op:this._selectionOpFromEvent?.(oe)||'replace'});});
    ll.on('contextmenu',e=>{L.DomEvent.preventDefault(e);this._showContext(e.originalEvent.clientX,e.originalEvent.clientY,layer,f,ll);});
    if(layer.style?.labelField&&f.properties?.[layer.style.labelField]!=null)ll.bindTooltip(String(f.properties[layer.style.labelField]),{permanent:false});
  },
  _showSelected(layer,f){
    const body=this.panels.attrs.querySelector('.ddc_meko-panel-body');this.panels.attrs.classList.remove('hidden');let h='<b>'+esc(layer.name)+'</b><div style="height:8px"></div>';
    Object.keys(f.properties||{}).forEach(k=>h+='<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #edf1f3"><span style="color:#6a7a8b;min-width:90px">'+esc(k)+'</span><span>'+esc(f.properties[k])+'</span></div>');
    h+='<div class="ddc_meko-btnrow"><button class="ddc_meko-btn" data-a="edit">'+esc(this.t('common.edit'))+'</button><button class="ddc_meko-btn danger" data-a="del">'+esc(this.t('common.delete'))+'</button></div>';
    body.innerHTML=h;const eb=body.querySelector('[data-a=edit]'),db=body.querySelector('[data-a=del]');if(eb)eb.onclick=()=>{this._ensureEditSessionForFeatureAction?.();this.editSelected();};if(db)db.onclick=()=>{this._ensureEditSessionForFeatureAction?.();this.deleteSelected();};
  },
  _showContext(clientX,clientY,layer,f,ll){
    const rr=this.root.getBoundingClientRect();const x=Math.max(4,Math.min(clientX-rr.left,rr.width-220));const y=Math.max(4,Math.min(clientY-rr.top,rr.height-330));this.contextEl.style.left=x+'px';this.contextEl.style.top=y+'px';this.contextEl.classList.remove('hidden');
    const acts=[[this.t('context.zoomTo'),()=>this.zoomToFeature(layer.id,f.id)],[this.t('context.panTo'),()=>this.panToFeature(layer.id,f.id)],[this.t('context.flash'),()=>this.flashFeature(layer.id,f.id)],[this.t('context.select'),()=>this._selectFeature?.(layer,f,ll,{add:false})]];
    acts.push([this.t('context.editAttributes'),()=>{this._selectFeature?.(layer,f,ll,{add:false});this._ensureEditSessionForFeatureAction?.();this.editSelected();}]);
    if(this.editSessionActive)acts.push([this.t('context.duplicate'),()=>this.duplicateFeature(layer.id,f.id)]);
    if(geomKind(layer.geometryType)==='line'&&layer.direction?.enabled)acts.push([this.t('direction.reverseSelected')||this.t('direction.reverse')||'Đảo chiều đối tượng đang chọn',()=>{this._selectFeature?.(layer,f,ll,{add:false});this._ensureEditSessionForFeatureAction?.();this.reverseFeatureDirection(layer.id,f.id);}]);
    acts.push([this.t('context.delete'),()=>{this._selectFeature?.(layer,f,ll,{add:false});this._ensureEditSessionForFeatureAction?.();this.deleteSelected();}]);
    acts.push([this.t('context.exportFeature'),()=>this.exportFeature(layer.id,f.id)]);
    this.contextEl.innerHTML='';acts.forEach(a=>{const b=document.createElement('button');b.textContent=a[0];b.onclick=e=>{e.stopPropagation();this._hideContext();a[1]();};this.contextEl.appendChild(b);});
  },
  _hideContext(){this.contextEl.classList.add('hidden');}
});

/* ===== src/render/clustering.js ===== */
// Module: render/clustering.js - lightweight per-layer point clustering without external plugin.
Object.assign(WaterMapCore.prototype, {
  _ensureClusterCss(){
    if(document.getElementById('ddc_meko_cluster_css'))return;const s=document.createElement('style');s.id='ddc_meko_cluster_css';s.textContent='.ddc_meko-cluster{display:flex;align-items:center;justify-content:center;border-radius:50%;background:#0b8ea6;color:#fff;border:3px solid rgba(255,255,255,.9);box-shadow:0 1px 6px rgba(0,0,0,.28);font-weight:700}.ddc_meko-cluster:hover{transform:scale(1.06)}';document.head.appendChild(s);
  },
  _renderPointLayerClustered(layer){
    this._ensureClusterCss();const group=L.layerGroup();layer.leaflet=group;if(layer.visible!==false)group.addTo(this.map);
    const radius=Math.max(25,Number(layer.clustering?.radius)||60),buckets=new Map();
    (layer.fc.features||[]).forEach(f=>{if(f.geometry?.type!=='Point')return;const ll=L.latLng(f.geometry.coordinates[1],f.geometry.coordinates[0]);const p=this.map.latLngToLayerPoint(ll),k=Math.floor(p.x/radius)+':'+Math.floor(p.y/radius);const a=buckets.get(k)||[];a.push({f,ll});buckets.set(k,a);});
    const maxZoom=Number.isFinite(this.map.getMaxZoom?.())?this.map.getMaxZoom():20;
    buckets.forEach(items=>{
      if(items.length===1){const it=items[0],m=this._pointToLayerStyled(layer,it.f,it.ll);this._bindFeatureLayerEvents(layer,it.f,m);group.addLayer(m);return;}
      const lat=items.reduce((s,x)=>s+x.ll.lat,0)/items.length,lng=items.reduce((s,x)=>s+x.ll.lng,0)/items.length,size=items.length>99?44:items.length>9?38:34;
      if(this.map.getZoom()>=maxZoom-0.01){this._renderSpiderBucketInto(group,layer,items,[lat,lng]);return;}
      const marker=L.marker([lat,lng],{icon:L.divIcon({className:'',html:'<div class="ddc_meko-cluster" style="width:'+size+'px;height:'+size+'px">'+items.length+'</div>',iconSize:[size,size],iconAnchor:[size/2,size/2]})});
      marker.on('click',e=>{L.DomEvent.stopPropagation(e);this._zoomOrSpiderCluster(layer,items,[lat,lng]);});group.addLayer(marker);
    });
  },

  _renderSpiderBucketInto(group,layer,items,center){
    const cp=this.map.latLngToLayerPoint(L.latLng(center)),r=Math.max(28,Math.min(90,26+items.length*3));
    items.forEach((it,i)=>{const a=(Math.PI*2*i/items.length),pt=L.point(cp.x+Math.cos(a)*r,cp.y+Math.sin(a)*r),ll=this.map.layerPointToLatLng(pt);group.addLayer(L.polyline([center,ll],{color:'#8494a2',weight:1,opacity:.55,interactive:false}));const m=this._pointToLayerStyled(layer,it.f,ll);this._bindFeatureLayerEvents(layer,it.f,m);group.addLayer(m);});
  },
  _zoomOrSpiderCluster(layer,items,center){
    const features=items.map(x=>x.f),b=bboxFC({type:'FeatureCollection',features});if(!b)return;
    const same=b[0][0]===b[1][0]&&b[0][1]===b[1][1],maxZoom=Number.isFinite(this.map.getMaxZoom?.())?this.map.getMaxZoom():20;if(this.map.getZoom()<maxZoom-1&&!same){this.map.fitBounds(b,{padding:[40,40],maxZoom:maxZoom-1});return;}
    if(this._clusterSpiderGroup)this.map.removeLayer(this._clusterSpiderGroup);this._clusterSpiderGroup=L.layerGroup().addTo(this.map);const cp=this.map.latLngToLayerPoint(L.latLng(center)),r=Math.max(35,Math.min(90,items.length*5));
    items.forEach((it,i)=>{const a=(Math.PI*2*i/items.length),pt=L.point(cp.x+Math.cos(a)*r,cp.y+Math.sin(a)*r),ll=this.map.layerPointToLatLng(pt);const line=L.polyline([center,ll],{color:'#8494a2',weight:1,opacity:.7});const m=this._pointToLayerStyled(layer,it.f,ll);this._bindFeatureLayerEvents(layer,it.f,m);this._clusterSpiderGroup.addLayer(line);this._clusterSpiderGroup.addLayer(m);});
  },
  configureClustering(layerId){
    const l=this.getLayer(layerId)||this.getActiveLayer();if(!l||geomKind(l.geometryType)!=='point')return;const c=l.clustering||{enabled:false,radius:60,showCount:true};
    const h='<label class="ddc_meko-field"><span>'+esc(this.t('cluster.enabled'))+'</span><input id="ddcClusterEnabled" type="checkbox" '+(c.enabled?'checked':'')+'></label><label class="ddc_meko-field"><span>'+esc(this.t('cluster.radius'))+'</span><input id="ddcClusterRadius" type="number" min="25" max="150" value="'+esc(c.radius||60)+'"></label>';
    this._modal(this.t('cluster.title',{name:l.name}),h,[{text:this.t('common.save'),primary:true,fn:()=>{l.clustering={enabled:this.modalWrap.querySelector('#ddcClusterEnabled').checked,radius:Number(this.modalWrap.querySelector('#ddcClusterRadius').value)||60,showCount:true};this._renderLayer(l);this._syncProject();this._setDirty?.('clustering');this._closeModal();}},{text:this.t('common.cancel'),fn:()=>this._closeModal()}]);
  },
  _refreshClusteredLayers(){if(this._clusterSpiderGroup){this.map.removeLayer(this._clusterSpiderGroup);this._clusterSpiderGroup=null;}this.layers.filter(l=>geomKind(l.geometryType)==='point'&&l.clustering?.enabled).forEach(l=>this._renderLayer(l));}
});

/* ===== src/render/flow-direction.js ===== */
// Module: render/flow-direction.js - digitized line direction overlay (Core GIS only).
Object.assign(WaterMapCore.prototype, {
  _ensureDirectionCss(){if(document.getElementById('ddc_meko_direction_css'))return;const s=document.createElement('style');s.id='ddc_meko_direction_css';s.textContent='.ddc_meko-flow-arrow{font-weight:800;line-height:1;transform-origin:center center;pointer-events:none!important;text-shadow:0 1px 2px rgba(255,255,255,.9)}.leaflet-pane.ddc_meko-direction-pane{pointer-events:none!important}';document.head.appendChild(s);},
  _ensureDirectionPane(){let pane=this.map.getPane('ddcMekoDirectionPane');if(!pane){pane=this.map.createPane('ddcMekoDirectionPane');pane.classList.add('ddc_meko-direction-pane');pane.style.zIndex='640';pane.style.pointerEvents='none';}return pane;},
  _directionLineParts(feature){const g=feature?.geometry;if(!g)return[];if(g.type==='LineString')return[g.coordinates];if(g.type==='MultiLineString')return g.coordinates;return[];},
  _refreshDirectionLayer(layer,phase){
    if(layer._directionLayer){try{this.map.removeLayer(layer._directionLayer);}catch(e){}layer._directionLayer=null;}
    const d=layer.direction||{};if(!d.enabled||geomKind(layer.geometryType)!=='line'||layer.visible===false)return 0;
    const minZoom=Number(d.minZoom??13);if(this.map.getZoom()<minZoom)return 0;
    this._ensureDirectionCss();this._ensureDirectionPane();const group=L.layerGroup().addTo(this.map),bounds=this.map.getBounds(),spacing=Math.max(35,Number(d.spacing)||90),size=Math.max(9,Number(d.size)||14),opacity=Math.max(.15,Math.min(1,Number(d.opacity)||.85)),maxArrows=Math.max(50,Number(d.maxArrows)||250);let count=0;
    const currentPhase=phase==null?(this._directionPhase||0):phase;
    outer: for(const f of layer.fc.features||[]){
      const fb=bboxFC({type:'FeatureCollection',features:[f]});if(!fb)continue;const fBounds=L.latLngBounds(fb[0],fb[1]);if(!bounds.intersects(fBounds))continue;
      for(const coords of this._directionLineParts(f)){
        if(!coords||coords.length<2)continue;const pts=coords.map(c=>this.map.latLngToLayerPoint([c[1],c[0]]));const seg=[];let total=0;for(let i=1;i<pts.length;i++){const len=pts[i-1].distanceTo(pts[i]);if(len>0){seg.push({a:pts[i-1],b:pts[i],start:total,len});total+=len;}}if(total<10)continue;
        for(let dist=spacing*(.25+currentPhase);dist<total;dist+=spacing){if(count>=maxArrows)break outer;let s=seg.find(x=>dist>=x.start&&dist<=x.start+x.len);if(!s)continue;const t=(dist-s.start)/s.len,x=s.a.x+(s.b.x-s.a.x)*t,y=s.a.y+(s.b.y-s.a.y)*t,ang=Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x)*180/Math.PI;const ll=this.map.layerPointToLatLng([x,y]);const html='<div class="ddc_meko-flow-arrow" style="font-size:'+size+'px;opacity:'+opacity+';transform:rotate('+ang+'deg)">➜</div>';group.addLayer(L.marker(ll,{interactive:false,pane:'ddcMekoDirectionPane',keyboard:false,icon:L.divIcon({className:'',html,iconSize:[size*1.4,size*1.4],iconAnchor:[size*.7,size*.7]})}));count++;}
      }
    }
    layer._directionLayer=group;this._ensureDirectionTimer();return count;
  },
  _refreshAllDirections(){const start=performance.now();let total=0;this.layers.filter(l=>l.direction?.enabled).forEach(l=>{total+=this._refreshDirectionLayer(l,this._directionPhase||0);});const took=performance.now()-start;if(total>0&&took>80)this._directionSlowCount=(this._directionSlowCount||0)+1;else this._directionSlowCount=0;if(this._directionSlowCount>=3){this.layers.filter(l=>l.direction?.enabled).forEach(l=>{l.direction.enabled=false;if(l._directionLayer){this.map.removeLayer(l._directionLayer);l._directionLayer=null;}});this._directionSlowCount=0;this._syncProject();this._setDirty?.('direction-auto-off');this.toast(this.t('direction.autoDisabled'),6500);}},
  _ensureDirectionTimer(){if(this._directionTimer)return;if(!this.layers.some(l=>l.direction?.enabled))return;this._directionTimer=setInterval(()=>{if(!this.layers.some(l=>l.direction?.enabled)){clearInterval(this._directionTimer);this._directionTimer=null;return;}const speed=Math.max(.1,Math.min(5,Math.max(...this.layers.filter(l=>l.direction?.enabled).map(l=>Number(l.direction.speed)||1),1)));this._directionPhase=((this._directionPhase||0)+.08*speed)%1;this._refreshAllDirections();},220);},
  configureDirection(layerId){
    const l=this.getLayer(layerId)||this.getActiveLayer();if(!l||geomKind(l.geometryType)!=='line')return;const d=l.direction||{enabled:false,speed:1,spacing:90,size:14,opacity:.85,minZoom:13,maxArrows:250};
    const h='<label class="ddc_meko-field"><span>'+esc(this.t('direction.enabled'))+'</span><input id="ddcDirEnabled" type="checkbox" '+(d.enabled?'checked':'')+'></label><label class="ddc_meko-field"><span>speed</span><input id="ddcDirSpeed" type="number" min="0.1" max="5" step="0.1" value="'+esc(d.speed||1)+'"></label><label class="ddc_meko-field"><span>spacing (px)</span><input id="ddcDirSpacing" type="number" min="35" max="250" value="'+esc(d.spacing||90)+'"></label><label class="ddc_meko-field"><span>size</span><input id="ddcDirSize" type="number" min="9" max="30" value="'+esc(d.size||14)+'"></label><label class="ddc_meko-field"><span>opacity <b id="ddcDirOpacityValue">'+esc(Number(d.opacity??.85).toFixed(2))+'</b></span><input id="ddcDirOpacity" type="range" min="0" max="1" step="0.05" value="'+esc(d.opacity??.85)+'"></label><label class="ddc_meko-field"><span>min zoom</span><input id="ddcDirMinZoom" type="number" min="0" max="20" value="'+esc(d.minZoom??13)+'"></label><div class="ddc_meko-warning">'+esc(this.t('direction.help'))+'</div>';
    this._modal(this.t('direction.title',{name:l.name}),h,[{text:this.t('common.save'),primary:true,fn:()=>{l.direction={enabled:this.modalWrap.querySelector('#ddcDirEnabled').checked,speed:Number(this.modalWrap.querySelector('#ddcDirSpeed').value)||1,spacing:Number(this.modalWrap.querySelector('#ddcDirSpacing').value)||90,size:Number(this.modalWrap.querySelector('#ddcDirSize').value)||14,opacity:Math.max(0,Math.min(1,Number(this.modalWrap.querySelector('#ddcDirOpacity').value))),minZoom:Number(this.modalWrap.querySelector('#ddcDirMinZoom').value)||13,maxArrows:250};this._refreshDirectionLayer(l);this._syncProject();this._setDirty?.('direction');this._closeModal();}},{text:this.t('common.cancel'),fn:()=>this._closeModal()}]);
    const op=this.modalWrap.querySelector('#ddcDirOpacity'),ov=this.modalWrap.querySelector('#ddcDirOpacityValue');if(op&&ov)op.oninput=()=>{ov.textContent=Number(op.value).toFixed(2);};
  },
  reverseFeatureDirection(layerId,fid){
    const l=this.getLayer(layerId),f=l?.fc.features.find(x=>String(x.id)===String(fid));if(!l||!f||geomKind(l.geometryType)!=='line')return;this._pushUndo();const g=f.geometry;if(g.type==='LineString')g.coordinates.reverse();else if(g.type==='MultiLineString'){g.coordinates.reverse();g.coordinates.forEach(x=>x.reverse());}
    if(['pipe','pump','valve'].includes(l.epanetRole)){const n1=l.epanetMapping?.node1||'node1',n2=l.epanetMapping?.node2||'node2';if(f.properties&&Object.prototype.hasOwnProperty.call(f.properties,n1)&&Object.prototype.hasOwnProperty.call(f.properties,n2)){const t=f.properties[n1];f.properties[n1]=f.properties[n2];f.properties[n2]=t;}}
    this._renderLayer(l);this._syncProject();this._setDirty?.('reverse-direction');this.emit('feature:direction-reversed',{layer:l,feature:f});
  },
  _refreshDynamicRenderers(){this._refreshClusteredLayers?.();this.layers.filter(l=>l.direction?.enabled).forEach(l=>this._refreshDirectionLayer(l,this._directionPhase||0));}
});

/* ===== src/layers/layer-manager.js ===== */
// Module: layers/layer-manager.js
Object.assign(WaterMapCore.prototype, {
  _addLayerRecord(rec){const l={id:rec.id||uuid(),name:rec.name||'Layer',fc:normalizeFC(rec.fc,rec.name),geometryType:rec.geometryType||rec.fc?.features?.find(f=>f.geometry)?.geometry?.type||'Unknown',schema:rec.schema||inferSchema(rec.fc),style:rec.style||{},visible:rec.visible!==false,sourceCRS:rec.sourceCRS||'EPSG:4326',workingCRS:'EPSG:4326',epanetRole:rec.epanetRole??(this.config.epanet.autoDetectRole?detectRole(rec.name):null),epanetMapping:rec.epanetMapping||{},direction:rec.direction||{enabled:false,speed:1,spacing:90,size:14,opacity:.85,minZoom:13,maxArrows:250},clustering:rec.clustering||{enabled:false,radius:60,showCount:true},originalFiles:rec.originalFiles||null};this.layers.push(l);this.layerIndex.set(l.id,l);this._renderLayer(l);if(!this.activeLayerId)this.activeLayerId=l.id;this.emit('layer:added',{layer:l});return l;},
  addLayer(name,fc,opt={}){this._pushUndo();const l=this._addLayerRecord(Object.assign({},opt,{name,fc}));this._syncProject();return l;},
  removeLayer(id){const l=this.layerIndex.get(id);if(!l)return;this._pushUndo();if(l.leaflet)this.map.removeLayer(l.leaflet);if(l._hitLayer)this.map.removeLayer(l._hitLayer);if(l._directionLayer)this.map.removeLayer(l._directionLayer);this.layers=this.layers.filter(x=>x.id!==id);this.layerIndex.delete(id);if(this.activeLayerId===id)this.activeLayerId=this.layers[0]?.id||null;this._syncProject();this.emit('layer:removed',{layer:l});},
  getLayer(id){return this.layerIndex.get(id)||null;},
  getActiveLayer(){return this.activeLayerId?this.getLayer(this.activeLayerId):null;},
  showLayerPanel(){
    const p=this.panels.layers;p.classList.remove('hidden');p.querySelector('.ddc_meko-panel-head span').textContent=this.t('panel.layers');const b=p.querySelector('.ddc_meko-panel-body');b.innerHTML='';
    this._ensureLayerPanelDnDStyles?.();
    this.layers.forEach(l=>{
      const r=document.createElement('div');r.className='ddc_meko-layer-row'+(l.id===this.activeLayerId?' active':'');r.draggable=true;r.dataset.layerId=l.id;
      r.innerHTML='<span class="ddc_meko-layer-drag" title="Kéo để đổi thứ tự">⋮⋮</span><input type="checkbox" '+(l.visible!==false?'checked':'')+'><span class="ddc_meko-layer-name">'+esc(l.name)+'</span><span class="ddc_meko-badge">'+esc(geomKind(l.geometryType))+' · '+l.fc.features.length+'</span>';
      r.onclick=e=>{if(e.target.tagName!=='INPUT'){this.activeLayerId=l.id;this.showLayerPanel();}};
      r.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();this.activeLayerId=l.id;this._showLayerContext(e.clientX,e.clientY,l);};
      r.querySelector('input').onchange=e=>{l.visible=e.target.checked;if(l.visible){if(!this.map.hasLayer(l.leaflet))l.leaflet.addTo(this.map);}else{if(l.leaflet)this.map.removeLayer(l.leaflet);if(l._hitLayer)this.map.removeLayer(l._hitLayer);if(l._directionLayer)this.map.removeLayer(l._directionLayer);}this._applyLayerOrder?.();this._syncProject();this._setDirty?.('layer-visibility');};
      r.ondragstart=e=>{this._dragLayerId=l.id;r.classList.add('dragging');try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',l.id);}catch(_){}};
      r.ondragend=()=>{this._dragLayerId=null;r.classList.remove('dragging');b.querySelectorAll('.ddc_meko-layer-row').forEach(x=>x.classList.remove('drag-over'));};
      r.ondragover=e=>{e.preventDefault();if(this._dragLayerId&&this._dragLayerId!==l.id){r.classList.add('drag-over');try{e.dataTransfer.dropEffect='move';}catch(_){}}};
      r.ondragleave=()=>r.classList.remove('drag-over');
      r.ondrop=e=>{e.preventDefault();r.classList.remove('drag-over');const from=this.layers.findIndex(x=>x.id===this._dragLayerId),to=this.layers.findIndex(x=>x.id===l.id);if(from<0||to<0||from===to)return;const [m]=this.layers.splice(from,1);this.layers.splice(to,0,m);this.activeLayerId=m.id;this._applyLayerOrder();this._syncProject();this._setDirty?.('layer-order');this.emit('layer:reordered',{layer:m,from,to});this.showLayerPanel();};
      b.appendChild(r);
    });
    if(this.layers.length){const row=document.createElement('div');row.className='ddc_meko-btnrow';row.innerHTML='<button class="ddc_meko-btn" data-a="fields">'+esc(this.t('context.fields'))+'</button><button class="ddc_meko-btn" data-a="epanet">EPANET</button><button class="ddc_meko-btn" data-a="zoom">'+esc(this.t('context.zoomTo'))+'</button>';b.appendChild(row);row.querySelector('[data-a=fields]').onclick=()=>this.configureFields();row.querySelector('[data-a=epanet]').onclick=()=>this.configureEpanet();row.querySelector('[data-a=zoom]').onclick=()=>this.zoomToLayer(this.activeLayerId);}
  },
  _ensureLayerPanelDnDStyles(){if(document.getElementById('ddc_meko_layer_dnd_css'))return;const st=document.createElement('style');st.id='ddc_meko_layer_dnd_css';st.textContent='.ddc_meko-layer-row{display:flex;align-items:center;gap:6px}.ddc_meko-layer-row[draggable=true]{cursor:default}.ddc_meko-layer-drag{cursor:grab;color:#7d8b95;padding:0 3px;font-weight:700}.ddc_meko-layer-row.dragging{opacity:.5}.ddc_meko-layer-row.drag-over{box-shadow:inset 0 2px 0 #0b8ea6}';document.head.appendChild(st);},
  _applyLayerOrder(){
    this.layers.forEach(l=>{if(l.leaflet&&this.map.hasLayer(l.leaflet))this.map.removeLayer(l.leaflet);if(l._hitLayer&&this.map.hasLayer(l._hitLayer))this.map.removeLayer(l._hitLayer);if(l._directionLayer&&this.map.hasLayer(l._directionLayer))this.map.removeLayer(l._directionLayer);});
    [...this.layers].reverse().forEach(l=>{if(l.visible!==false&&l.leaflet)l.leaflet.addTo(this.map);if(l.visible!==false&&l._hitLayer)l._hitLayer.addTo(this.map);if(l.visible!==false&&l._directionLayer)l._directionLayer.addTo(this.map);});
  },
  _showLayerContext(clientX,clientY,l){
    const rr=this.root.getBoundingClientRect();const x=Math.max(4,Math.min(clientX-rr.left,rr.width-240));const y=Math.max(4,Math.min(clientY-rr.top,rr.height-430));this.contextEl.style.left=x+'px';this.contextEl.style.top=y+'px';this.contextEl.classList.remove('hidden');
    const acts=[[this.t('context.zoomLayer'),()=>this.zoomToLayer(l.id)],[this.t('context.panLayer'),()=>this.panToLayer(l.id)],[this.t('context.flashLayer'),()=>this.flashLayer(l.id)],[this.t('context.attributeTable'),()=>this.showAttributeTable(l.id)],[this.t('context.fields'),()=>this.configureFields(l.id)],[this.t('style.legend'),()=>this.showLayerLegend?.(l.id)]];
    acts.unshift([this.t('layer.addNew')||'Thêm mới',()=>this.addNewFeatureToLayer?.(l.id)]);
    if(geomKind(l.geometryType)==='line')acts.push([this.t('direction.menu'),()=>this.configureDirection?.(l.id)]);
    if(geomKind(l.geometryType)==='point')acts.push([this.t('cluster.menu'),()=>this.configureClustering?.(l.id)]);
    acts.push(['EPANET',()=>this.configureEpanet()],[this.t('context.exportGeoJSON'),()=>this.exportGeoJSON(l.id)],[this.t('context.removeLayer'),()=>{if(confirm(this.t('layer.removeConfirm',{name:l.name})))this.removeLayer(l.id);}]);
    this.contextEl.innerHTML='';acts.forEach(a=>{const b=document.createElement('button');b.textContent=a[0];b.onclick=e=>{e.stopPropagation();this._hideContext();this.activeLayerId=l.id;a[1]();};this.contextEl.appendChild(b);});
  },
  configureStyle(){const l=this.getActiveLayer();if(!l)return;this.configureFields(l.id);},
  _distinctFieldValues(layer,fieldName){
    const set=new Map();(layer.fc?.features||[]).forEach(f=>{const v=f.properties?.[fieldName];if(v===null||v===undefined||v==='')return;const k=typeof v==='string'?v.trim().toLowerCase():String(v);if(!set.has(k))set.set(k,v);});
    return [...set.values()].sort((a,b)=>{const na=Number(a),nb=Number(b);if(Number.isFinite(na)&&Number.isFinite(nb))return na-nb;return String(a).localeCompare(String(b));});
  },
  configureFields(layerId){
    const l=this.getLayer(layerId)||this.getActiveLayer();if(!l)return;this.activeLayerId=l.id;
    let h='<div class="ddc_meko-warning" style="margin-bottom:8px">'+esc(this.t('field.clickToStyle')||'Chọn một field để xem các giá trị duy nhất và cấu hình Style/Symbol.')+'</div><div class="ddc_meko-table-wrap"><table class="ddc_meko-table"><thead><tr><th>'+esc(this.t('layer.field'))+'</th><th>'+esc(this.t('layer.alias'))+'</th><th>'+esc(this.t('layer.type'))+'</th><th>'+esc(this.t('layer.visible'))+'</th><th>'+esc(this.t('layer.editable'))+'</th><th>Style</th></tr></thead><tbody>';
    l.schema.forEach((f,i)=>h+='<tr data-i="'+i+'"><td><button class="ddc_meko-btn" data-field-style="'+esc(f.name)+'">'+esc(f.name)+'</button></td><td><input data-k="alias" value="'+esc(f.alias||f.name)+'"></td><td>'+esc(f.type)+'</td><td><input data-k="visible" type="checkbox" '+(f.visible!==false?'checked':'')+'></td><td><input data-k="editable" type="checkbox" '+(f.editable!==false?'checked':'')+'></td><td><button class="ddc_meko-btn" data-field-style="'+esc(f.name)+'">⚙</button></td></tr>');
    h+='</tbody></table></div>';
    const reopen=()=>this.configureFields(l.id);
    this._modal(this.t('layer.fieldsTitle',{name:l.name}),h,[{text:this.t('common.save'),primary:true,fn:()=>{this.modalWrap.querySelectorAll('tr[data-i]').forEach(r=>{const f=l.schema[Number(r.dataset.i)];f.alias=r.querySelector('[data-k=alias]').value;f.visible=r.querySelector('[data-k=visible]').checked;f.editable=r.querySelector('[data-k=editable]').checked;});this._syncProject();this._setDirty?.('fields');this._closeModal();}},{text:this.t('common.cancel'),fn:()=>this._closeModal()}],{wide:true});
    this.modalWrap.querySelectorAll('[data-field-style]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();const fieldName=btn.dataset.fieldStyle;this._showFieldStyleChooser(l,fieldName,reopen);});
  },
  _showFieldStyleChooser(layer,fieldName,back){
    const fd=(layer.schema||[]).find(x=>x.name===fieldName);if(!fd)return;const values=this._distinctFieldValues(layer,fieldName);const kind=geomKind(layer.geometryType);const props=kind==='point'?[['color',this.t('style.colorByField')],['radius',this.t('style.sizeByField')],['symbol',this.t('style.symbolByField')],['opacity',this.t('style.opacityByField')]]:kind==='line'?[['color',this.t('style.colorByField')],['weight',this.t('style.widthByField')],['opacity',this.t('style.opacityByField')]]:[['color',this.t('style.colorByField')],['weight',this.t('style.widthByField')],['opacity',this.t('style.opacityByField')]];
    const preview=values.length?values.slice(0,300).map(v=>'<span class="ddc_meko-badge" style="margin:2px">'+esc(v)+'</span>').join(''):'<span class="ddc_meko-empty">'+esc(this.t('field.noValues')||'Không có giá trị')+'</span>';
    let h='<div><b>'+esc(fd.alias||fd.name)+'</b> <small>('+esc(fd.type||'')+')</small></div><div class="ddc_meko-warning" style="margin:8px 0">'+esc(this.t('field.distinctCount',{count:values.length})||('Giá trị duy nhất: '+values.length))+'</div><div style="max-height:180px;overflow:auto;padding:4px;border:1px solid #e1e7eb;border-radius:6px">'+preview+'</div><div style="margin-top:10px"><b>'+esc(this.t('style.attributeStyle'))+'</b></div>'+props.map(([p,label])=>'<div class="ddc_meko-btnrow" style="justify-content:space-between"><span>'+esc(label)+'</span><button class="ddc_meko-btn" data-prop="'+p+'">'+esc(this.t('style.configure'))+'</button></div>').join('');
    this._modal((this.t('field.styleTitle',{field:fd.alias||fd.name})||('Style — '+(fd.alias||fd.name))),h,[{text:this.t('common.back'),fn:()=>back?.()}],{wide:true});
    this.modalWrap.querySelectorAll('[data-prop]').forEach(b=>b.onclick=()=>this._configureStyleProperty(layer,b.dataset.prop,fieldName,()=>this._showFieldStyleChooser(layer,fieldName,back)));
  },
  configureEpanet(){
      const l=this.getActiveLayer();if(!l)return;
      const roles=['','junction','reservoir','tank','pipe','pump','valve'];
      const buildFields=(role)=>{
        if(!role)return '<div class="ddc_meko-empty">'+esc(this.t('epanet.notUsed'))+'</div>';
        return '<div class="ddc_meko-warning" style="margin-bottom:10px">'+esc(this.t('epanet.mappingHelp'))+'</div>'+ (EPANET_SCHEMAS[role]||[]).map(([k])=>{
          const current=l.epanetMapping?.[k]||((l.schema||[]).find(f=>f.name.toLowerCase()===k.toLowerCase())?.name)||'';
          const opts='<option value="">'+esc(this.t('epanet.createField',{name:k}))+'</option>'+(l.schema||[]).map(f=>'<option value="'+esc(f.name)+'" '+(current===f.name?'selected':'')+'>'+esc(f.name)+'</option>').join('');
          return '<label class="ddc_meko-field"><span>'+esc(k)+'</span><select data-ep-field="'+esc(k)+'">'+opts+'</select></label>';
        }).join('');
      };
      let h='<label class="ddc_meko-field"><span>'+esc(this.t('epanet.role'))+'</span><select id="ddcRole">'+roles.map(r=>'<option value="'+r+'" '+((l.epanetRole||'')===r?'selected':'')+'>'+(r||esc(this.t('epanet.none')))+'</option>').join('')+'</select></label><div id="ddcEpanetFields">'+buildFields(l.epanetRole||'')+'</div>';
      this._modal(this.t('epanet.title',{name:l.name}),h,[{text:this.t('common.save'),primary:true,fn:()=>{
        const role=this.modalWrap.querySelector('#ddcRole').value||null;l.epanetRole=role;l.epanetMapping={};
        if(role){this.modalWrap.querySelectorAll('[data-ep-field]').forEach(sel=>{if(sel.value)l.epanetMapping[sel.dataset.epField]=sel.value;});this._ensureEpanetFields(l,role);(EPANET_SCHEMAS[role]||[]).forEach(([k])=>{if(!l.epanetMapping[k])l.epanetMapping[k]=k;});}
        this._syncProject();this._setDirty?.('epanet');this._closeModal();
      }},{text:this.t('common.cancel'),fn:()=>this._closeModal()}]);
      const roleSel=this.modalWrap.querySelector('#ddcRole');roleSel.onchange=()=>{this.modalWrap.querySelector('#ddcEpanetFields').innerHTML=buildFields(roleSel.value);};
    },
  _ensureEpanetFields(l,role){const existing=new Set(l.schema.map(f=>f.name.toLowerCase()));(EPANET_SCHEMAS[role]||[]).forEach(([name,type])=>{if(!existing.has(name.toLowerCase())){l.schema.push({name,type,dbfType:type==='String'?'C':'N',length:type==='String'?80:18,decimals:type==='Double'?6:0,visible:true,editable:true,required:false,alias:name});l.fc.features.forEach(f=>{if(!(name in f.properties))f.properties[name]=null;});}});},
  showAttributeTable(layerId){const l=this.getLayer(layerId)||this.getActiveLayer();if(!l){this.toast(this.t('table.noLayer'));return;}this.activeLayerId=l.id;const pageSize=this.config.attributeTable.pageSize;const mode=(this.config.attributeTable.mode||'modal').toLowerCase();let page=1;const render=()=>{const fields=l.schema.filter(f=>f.visible!==false);const max=Math.max(1,Math.ceil(l.fc.features.length/pageSize));page=Math.max(1,Math.min(page,max));const arr=l.fc.features.slice((page-1)*pageSize,page*pageSize);let h='<div class="ddc_meko-table-wrap"><table class="ddc_meko-table"><thead><tr>'+fields.map(f=>'<th>'+esc(f.alias||f.name)+'</th>').join('')+'</tr></thead><tbody>';arr.forEach(f=>{h+='<tr data-id="'+esc(f.id)+'">'+fields.map(fd=>'<td>'+esc(f.properties?.[fd.name])+'</td>').join('')+'</tr>';});h+='</tbody></table></div><div class="ddc_meko-pager"><button class="ddc_meko-btn" data-p="prev">←</button><span>'+esc(this.t('table.page',{page,max,count:l.fc.features.length}))+'</span><button class="ddc_meko-btn" data-p="next">→</button></div>';let host;const title=this.t('table.title',{name:l.name});if(mode==='bottom'){const p=this.panels.table;p.classList.remove('hidden');p.querySelector('.ddc_meko-panel-head span').textContent=title;host=p.querySelector('.ddc_meko-panel-body');host.innerHTML=h;}else{this._modal(title,h,[{text:this.t('common.close'),fn:()=>this._closeModal()}],{wide:true});host=this.modalWrap;}host.querySelector('[data-p=prev]').onclick=()=>{page--;render();};host.querySelector('[data-p=next]').onclick=()=>{page++;render();};host.querySelectorAll('tr[data-id]').forEach(r=>{r.ondblclick=()=>this.zoomToFeature(l.id,r.dataset.id);r.oncontextmenu=e=>{e.preventDefault();const f=l.fc.features.find(x=>String(x.id)===String(r.dataset.id));if(mode!=='bottom')this._closeModal();this._showContext(e.clientX,e.clientY,l,f,null);};});};render();},
  zoomToLayer(id){const l=this.getLayer(id);if(!l)return;const b=bboxFC(l.fc);if(b)this.map.fitBounds(b,{padding:[24,24]});},
  panToLayer(id){const l=this.getLayer(id);if(!l)return;const b=bboxFC(l.fc);if(b)this.map.panTo([(b[0][0]+b[1][0])/2,(b[0][1]+b[1][1])/2]);},
  flashLayer(id){const l=this.getLayer(id);if(!l?.leaflet)return;l.leaflet.eachLayer(x=>{if(x.setStyle)x.setStyle({color:'#ff6b4a',weight:6,fillOpacity:.8});});setTimeout(()=>this._renderLayer(l),1200);},
  zoomToFullExtent(){const all={type:'FeatureCollection',features:this.layers.flatMap(l=>l.fc.features)};const b=bboxFC(all);if(b)this.map.fitBounds(b,{padding:[28,28]});},
  goHome(){this.map.invalidateSize(false);if(this._homeBounds){const b=this._homeBounds;const same=b[0][0]===b[1][0]&&b[0][1]===b[1][1];if(same)this.map.setView(b[0],Math.min(this.map.getMaxZoom?.()??24,24),{animate:false});else this.map.fitBounds(b,{padding:[30,30],maxZoom:this.map.getMaxZoom?.()??24,animate:false});}else this.map.setView(this._homeView.center,this._homeView.zoom,{animate:false});},
  _focusLoadedData(){
      if(!this.map)return false;
      const features=this.layers.flatMap(l=>Array.isArray(l.fc?.features)?l.fc.features:[]);
      if(!features.length)return false;
      const b=bboxFC({type:'FeatureCollection',features});
      if(!b)return false;
      this.map.invalidateSize(false);
      const samePoint=b[0][0]===b[1][0]&&b[0][1]===b[1][1];
      if(samePoint){
        this.map.setView(b[0],Math.max(this.map.getZoom()||0,18));
      }else{
        this.map.fitBounds(b,{padding:[30,30],maxZoom:this.map.getMaxZoom?.()??24,animate:false});
      }
      this._homeBounds=JSON.parse(JSON.stringify(b));
      const c=this.map.getCenter();this._homeView={center:[c.lat,c.lng],zoom:this.map.getZoom()};
      return true;
    },
  _scheduleFocusLoadedData(fallbackMap){
      clearTimeout(this._focusLoadedTimer);
      this._focusLoadedTimer=setTimeout(()=>{
        const focused=this._focusLoadedData();
        if(!focused&&fallbackMap?.center){
          this.map.invalidateSize(false);
          this.map.setView(fallbackMap.center,fallbackMap.zoom||13,{animate:false});this._homeBounds=null;this._homeView={center:fallbackMap.center.slice(),zoom:fallbackMap.zoom||13};
        }
      },120);
    },
  zoomToFeature(layerId,fid){const l=this.getLayer(layerId),f=l?.fc.features.find(x=>String(x.id)===String(fid));if(!f)return;const b=bboxFC({type:'FeatureCollection',features:[f]});if(b[0][0]===b[1][0]&&b[0][1]===b[1][1])this.map.setView(b[0],Math.min(this.map.getMaxZoom?.()??24,Math.max(this.map.getZoom(),18)));else this.map.fitBounds(b,{padding:[30,30],maxZoom:this.map.getMaxZoom?.()??24});},
  panToFeature(layerId,fid){const l=this.getLayer(layerId),f=l?.fc.features.find(x=>String(x.id)===String(fid));if(!f)return;const b=bboxFC({type:'FeatureCollection',features:[f]});if(b)this.map.panTo([(b[0][0]+b[1][0])/2,(b[0][1]+b[1][1])/2]);},
  flashFeature(layerId,fid){
    const l=this.getLayer(layerId),f=l?.fc.features.find(x=>String(x.id)===String(fid));if(!l||!f)return;this.zoomToFeature(layerId,fid);
    if(this._flashOverlay){try{this.map.removeLayer(this._flashOverlay);}catch(_){}this._flashOverlay=null;}
    const base=this._resolveFeatureVisualStyle?.(l,f)||{};const group=L.layerGroup().addTo(this.map);this._flashOverlay=group;let on=false,n=0;
    const make=()=>{group.clearLayers();if(!on)return;L.geoJSON(f,{style:()=>({color:'#ffb000',weight:Math.max(5,(Number(base.weight)||3)+4),opacity:1,fillColor:'#ffd24a',fillOpacity:.55}),pointToLayer:(ff,ll)=>L.circleMarker(ll,{radius:Math.max(10,(Number(base.radius)||6)+7),color:'#ff8a00',weight:4,fillColor:'#ffd24a',fillOpacity:.75,interactive:false})}).addTo(group);};
    const timer=setInterval(()=>{on=!on;make();n++;if(n>=8){clearInterval(timer);group.clearLayers();try{this.map.removeLayer(group);}catch(_){}if(this._flashOverlay===group)this._flashOverlay=null;}},220);
  },
  duplicateFeature(layerId,fid){const l=this.getLayer(layerId),f=l?.fc.features.find(x=>String(x.id)===String(fid));if(!f)return;this._pushUndo();const c=JSON.parse(JSON.stringify(f));c.id=uuid();l.fc.features.push(c);this._renderLayer(l);this._syncProject();},
  exportFeature(layerId,fid){const l=this.getLayer(layerId),f=l?.fc.features.find(x=>String(x.id)===String(fid));if(!f)return;downloadBlob((l.name||'feature')+'_'+fid+'.geojson',new Blob([JSON.stringify(f,null,2)],{type:'application/geo+json'}));},
  clearLayers(push=true){if(push&&this.layers.length)this._pushUndo();this.layers.forEach(l=>{if(l.leaflet)this.map.removeLayer(l.leaflet);if(l._hitLayer)this.map.removeLayer(l._hitLayer);if(l._directionLayer)this.map.removeLayer(l._directionLayer);});if(this._clusterSpiderGroup){this.map.removeLayer(this._clusterSpiderGroup);this._clusterSpiderGroup=null;}this.layers=[];this.layerIndex.clear();this.activeLayerId=null;this.selected=null;}
});

/* ===== src/style/style-engine.js ===== */
// Module: style/style-engine.js
Object.assign(WaterMapCore.prototype, {
  _resolveFeatureVisualStyle(layer,feature){
    const s=layer.style||{},r=s.rules||{};const out={color:s.color||'#0b8ea6',weight:s.weight||3,opacity:s.opacity??0.9,fillColor:s.fillColor||'#52b5c5',fillOpacity:s.fillOpacity??0.25,radius:s.radius||6,stroke:s.stroke||'#fff',symbol:s.symbol||'circle'};
    const apply=(prop)=>{const rule=r[prop];if(!rule?.field)return;const g=this._matchStyleGroup?.(rule,feature.properties?.[rule.field]);if(g&&g.value!==undefined&&g.value!==null&&g.value!=='')out[prop]=prop==='weight'||prop==='opacity'||prop==='radius'?Number(g.value):g.value;};
    ['color','weight','opacity','radius','symbol'].forEach(apply);return out;
  },
  _styleValueControl(prop,value){
    if(prop==='color')return'<input data-style-value type="color" value="'+esc(value||'#0b8ea6')+'">';
    if(prop==='weight')return'<input data-style-value type="number" min="1" max="30" step="1" value="'+esc(value??3)+'">';
    if(prop==='opacity')return'<input data-style-value type="number" min="0.05" max="1" step="0.05" value="'+esc(value??0.9)+'">';
    if(prop==='radius')return'<input data-style-value type="number" min="2" max="40" step="1" value="'+esc(value??6)+'">';
    const symbols=['circle','square','diamond','triangle','star','junction','valve','pump','meter','tank'];return'<select data-style-value>'+symbols.map(x=>'<option value="'+x+'" '+(String(value||'circle')===x?'selected':'')+'>'+x+'</option>').join('')+'</select>';
  },
  configureStyle(){
    const l=this.getActiveLayer();if(!l)return;const kind=geomKind(l.geometryType),rules=l.style?.rules||{};
    const summary=p=>rules[p]?.field?esc(rules[p].field)+' · '+rules[p].groups.length+' '+esc(this.t('style.groups')):esc(this.t('style.notConfigured'));
    let h='<label class="ddc_meko-field"><span>'+esc(this.t('layer.color'))+'</span><input id="ddcStyleColor" type="color" value="'+esc(l.style.color||'#0b8ea6')+'"></label>';
    if(kind==='line'||kind==='polygon')h+='<label class="ddc_meko-field"><span>'+esc(this.t('layer.lineWidth'))+'</span><input id="ddcStyleWeight" type="number" min="1" max="30" value="'+esc(l.style.weight||3)+'"></label>';
    if(kind==='point')h+='<label class="ddc_meko-field"><span>'+esc(this.t('style.pointSize'))+'</span><input id="ddcStyleRadius" type="number" min="2" max="40" value="'+esc(l.style.radius||6)+'"></label>';
    h+='<label class="ddc_meko-field"><span>'+esc(this.t('style.opacity'))+'</span><input id="ddcStyleOpacity" type="number" min="0.05" max="1" step="0.05" value="'+esc(l.style.opacity??0.9)+'"></label><label class="ddc_meko-field"><span>'+esc(this.t('layer.labelField'))+'</span><select id="ddcLabelField"><option value="">'+esc(this.t('layer.noLabel'))+'</option>'+(l.schema||[]).map(f=>'<option value="'+esc(f.name)+'" '+(l.style.labelField===f.name?'selected':'')+'>'+esc(f.name)+'</option>').join('')+'</select></label>';
    const props=[];props.push(['color',this.t('style.colorByField')]);if(kind==='line'||kind==='polygon')props.push(['weight',this.t('style.widthByField')]);props.push(['opacity',this.t('style.opacityByField')]);if(kind==='point'){props.push(['radius',this.t('style.sizeByField')]);props.push(['symbol',this.t('style.symbolByField')]);}
    h+='<div style="margin-top:12px"><b>'+esc(this.t('style.attributeStyle'))+'</b></div>'+props.map(([p,label])=>'<div class="ddc_meko-btnrow" style="justify-content:space-between"><span>'+esc(label)+'<br><small>'+summary(p)+'</small></span><button class="ddc_meko-btn" data-style-prop="'+p+'">'+esc(this.t('style.configure'))+'</button></div>').join('');
    h+='<div class="ddc_meko-btnrow"><button class="ddc_meko-btn" data-show-legend>'+esc(this.t('style.legend'))+'</button></div>';
    this._modal(this.t('layer.styleTitle',{name:l.name}),h,[{text:this.t('common.save'),primary:true,fn:()=>{l.style=l.style||{};l.style.color=this.modalWrap.querySelector('#ddcStyleColor').value;l.style.weight=Number(this.modalWrap.querySelector('#ddcStyleWeight')?.value)||l.style.weight||3;l.style.radius=Number(this.modalWrap.querySelector('#ddcStyleRadius')?.value)||l.style.radius||6;l.style.opacity=Number(this.modalWrap.querySelector('#ddcStyleOpacity').value);l.style.labelField=this.modalWrap.querySelector('#ddcLabelField').value||null;this._renderLayer(l);this._syncProject();this._setDirty?.('style');this._closeModal();}},{text:this.t('common.cancel'),fn:()=>this._closeModal()}],{wide:true});
    this.modalWrap.querySelectorAll('[data-style-prop]').forEach(b=>b.onclick=()=>this._configureStyleProperty(l,b.dataset.styleProp));this.modalWrap.querySelector('[data-show-legend]').onclick=()=>this.showLayerLegend(l.id);
  },
  _configureStyleProperty(layer,prop,forcedField=null,backFn=null){
    const old=JSON.parse(JSON.stringify(layer.style?.rules?.[prop]||{}));const fields=(layer.schema||[]).slice();if(!fields.length){this.toast(this.t('style.noCompatibleField'));return;}
    let selected=forcedField&&fields.some(f=>f.name===forcedField)?forcedField:(old.field&&fields.some(f=>f.name===old.field)?old.field:fields[0].name);
    const fieldType=()=>{const f=fields.find(x=>x.name===selected);return ['Integer','Double','Float','Number'].includes(f?.type)?'numeric':'categorical';};
    const distinct=field=>{const set=new Set();(layer.fc.features||[]).forEach(f=>{const v=f.properties?.[field];if(v!==null&&v!==undefined&&v!=='')set.add(String(v));});return[...set].slice(0,200);};
    const render=()=>{
      const type=fieldType();const cur=(old.field===selected&&old.fieldType===type)?old:{field:selected,fieldType:type,groups:[]};
      const hint=distinct(selected).slice(0,40).join(', ');
      let body='<label class="ddc_meko-field"><span>'+esc(this.t('style.field'))+'</span><select id="ddcRuleField">'+fields.map(f=>'<option value="'+esc(f.name)+'" '+(f.name===selected?'selected':'')+'>'+esc(f.alias||f.name)+'</option>').join('')+'</select></label><div class="ddc_meko-warning">'+esc(this.t(type==='numeric'?'style.numericHelp':'style.categoryHelp'))+'<br><small>'+esc(hint)+'</small></div><div id="ddcRuleRows"></div><div class="ddc_meko-btnrow"><button class="ddc_meko-btn" data-add-rule>＋ '+esc(this.t('style.addGroup'))+'</button><button class="ddc_meko-btn danger" data-clear-rule>'+esc(this.t('style.clearRule'))+'</button></div>';
      this._modal(this.t('style.ruleTitle',{property:prop,name:layer.name}),body,[{text:this.t('common.save'),primary:true,fn:()=>save()},{text:this.t('common.back'),fn:()=>backFn?backFn():this.configureStyle()}],{wide:true});
      const host=this.modalWrap.querySelector('#ddcRuleRows');
      const addRow=g=>{const row=document.createElement('div');row.className='ddc_meko-btnrow';row.style.alignItems='end';if(type==='numeric')row.innerHTML='<label class="ddc_meko-field" style="flex:1"><span>Min</span><input data-min type="number" step="any" value="'+esc(g?.min??'')+'"></label><label class="ddc_meko-field" style="flex:1"><span>Max</span><input data-max type="number" step="any" value="'+esc(g?.max??'')+'"></label><label class="ddc_meko-field" style="flex:1"><span>'+esc(this.t('style.styleValue'))+'</span>'+this._styleValueControl(prop,g?.value)+'</label><button class="ddc_meko-btn danger" data-remove>×</button>';
        else row.innerHTML='<label class="ddc_meko-field" style="flex:2"><span>'+esc(this.t('style.valuesComma'))+'</span><input data-values value="'+esc((g?.values||[]).join(', '))+'"></label><label class="ddc_meko-field" style="flex:1"><span>'+esc(this.t('style.styleValue'))+'</span>'+this._styleValueControl(prop,g?.value)+'</label><button class="ddc_meko-btn danger" data-remove>×</button>';
        row.querySelector('[data-remove]').onclick=()=>row.remove();host.appendChild(row);};
      (cur.groups||[]).forEach(addRow);if(!(cur.groups||[]).length)addRow({});
      this.modalWrap.querySelector('[data-add-rule]').onclick=()=>addRow({});this.modalWrap.querySelector('[data-clear-rule]').onclick=()=>{host.innerHTML='';};
      this.modalWrap.querySelector('#ddcRuleField').disabled=!!forcedField;this.modalWrap.querySelector('#ddcRuleField').onchange=e=>{if(forcedField)return;selected=e.target.value;old.field=null;render();};
      const save=()=>{const rule={field:selected,fieldType:type,groups:[]};host.querySelectorAll('.ddc_meko-btnrow').forEach(row=>{const val=row.querySelector('[data-style-value]')?.value;if(type==='numeric'){const mi=row.querySelector('[data-min]').value,ma=row.querySelector('[data-max]').value;if(mi===''&&ma===''&&val==='')return;rule.groups.push({min:mi===''?null:Number(mi),max:ma===''?null:Number(ma),value:prop==='color'||prop==='symbol'?val:Number(val)});}else{const vals=row.querySelector('[data-values]').value.split(',').map(x=>x.trim()).filter(Boolean);if(!vals.length)return;rule.groups.push({values:vals,value:prop==='color'||prop==='symbol'?val:Number(val)});}});const check=this._validateStyleRuleSet(rule);if(!check.ok){this.toast(check.message,5000);return;}layer.style=layer.style||{};layer.style.rules=layer.style.rules||{};if(rule.groups.length)layer.style.rules[prop]=rule;else delete layer.style.rules[prop];this._renderLayer(layer);this._syncProject();this._setDirty?.('style-rule');if(backFn)backFn();else this.configureStyle();};
    };render();
  },
  showLayerLegend(layerId){
    const l=this.getLayer(layerId)||this.getActiveLayer();if(!l)return;const rules=l.style?.rules||{};let h='';Object.entries(rules).forEach(([prop,r])=>{h+='<div style="margin-bottom:12px"><b>'+esc(prop)+' ← '+esc(r.field)+'</b>';if(r.fieldType==='numeric')r.groups.forEach(g=>h+='<div style="padding:4px 0">'+esc((g.min??'-∞')+' – '+(g.max??'∞'))+' → '+esc(g.value)+'</div>');else r.groups.forEach(g=>h+='<div style="padding:4px 0">'+esc((g.values||[]).join(', '))+' → '+esc(g.value)+'</div>');h+='</div>';});if(!h)h='<div class="ddc_meko-empty">'+esc(this.t('style.noRules'))+'</div>';this._modal(this.t('style.legendTitle',{name:l.name}),h,[{text:this.t('common.back'),fn:()=>this.configureStyle()}]);
  }
});

/* ===== src/ui/modal.js ===== */
// Module: ui/modal.js
Object.assign(WaterMapCore.prototype, {
  _modal(title,html,buttons,opt={}){this.modalWrap.classList.remove('hidden');this.modalWrap.innerHTML='<div class="ddc_meko-modal" '+(opt.wide?'style="width:min(1100px,100%)"':'')+'><div class="ddc_meko-modal-head"><span>'+esc(title)+'</span>'+(opt.closable===false?'':'<button class="ddc_meko-panel-close">×</button>')+'</div><div class="ddc_meko-modal-body">'+html+'</div><div class="ddc_meko-modal-foot"></div></div>';const close=this.modalWrap.querySelector('.ddc_meko-panel-close');if(close)close.onclick=()=>this._closeModal();const foot=this.modalWrap.querySelector('.ddc_meko-modal-foot');(buttons||[]).forEach(x=>{const b=document.createElement('button');b.className='ddc_meko-btn'+(x.primary?' primary':'');b.textContent=x.text;b.onclick=x.fn;foot.appendChild(b);});},
  _closeModal(){this.modalWrap.classList.add('hidden');this.modalWrap.innerHTML='';}
});

/* ===== src/ui/edit-toolbar.js ===== */
// Module: ui/edit-toolbar.js
Object.assign(WaterMapCore.prototype, {
  _ensureEditToolbarStyles(){
    if(document.getElementById('ddc_meko_edit_toolbar_css'))return;
    const s=document.createElement('style');s.id='ddc_meko_edit_toolbar_css';
    s.textContent=`
.ddc_meko-edit-toolbar{position:absolute;z-index:850;left:90px;top:12px;display:flex;align-items:center;gap:4px;padding:5px;background:rgba(255,255,255,.96);border:1px solid #cfd8df;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.16);max-width:calc(100% - 16px);user-select:none}
.ddc_meko-edit-toolbar.hidden{display:none}.ddc_meko-edit-toolbar.vertical{flex-direction:column;left:auto}.ddc_meko-edit-drag{cursor:move;padding:4px 7px;border-right:1px solid #e4e9ed;font-weight:700;color:#60717f}.ddc_meko-edit-toolbar.vertical .ddc_meko-edit-drag{border-right:0;border-bottom:1px solid #e4e9ed;width:100%;text-align:center}
.ddc_meko-edit-tool{width:34px;height:32px;border:1px solid #d8e0e5;background:#fff;border-radius:5px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center}.ddc_meko-edit-tool:hover:not(:disabled){background:#edf7f9}.ddc_meko-edit-tool:disabled{opacity:.38;cursor:not-allowed}.ddc_meko-edit-tool.active{background:#dff4f7;border-color:#65b7c3}.ddc_meko-edit-tool.danger:not(:disabled){color:#b42318}
.ddc_meko-draw-wrap{position:relative}.ddc_meko-draw-menu{position:absolute;left:0;top:38px;display:flex;gap:3px;padding:4px;background:#fff;border:1px solid #d8e0e5;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.16);z-index:20}.ddc_meko-draw-menu.hidden{display:none}.ddc_meko-edit-toolbar.vertical .ddc_meko-draw-menu{left:40px;top:0;flex-direction:column}
`;
    document.head.appendChild(s);
  },
  _buildEditToolbar(){
    this._ensureEditToolbarStyles();
    this.editToolbar=document.createElement('div');this.editToolbar.className='ddc_meko-edit-toolbar hidden';
    const btn=(cmd,icon,title,danger=false)=>'<button class="ddc_meko-edit-tool'+(danger?' danger':'')+'" data-ecmd="'+cmd+'" title="'+esc(title)+'">'+icon+'</button>';
    this.editToolbar.innerHTML='<div class="ddc_meko-edit-drag" title="'+esc(this.t('editToolbar.drag'))+'">⋮⋮</div>'+
      btn('import','⇧',this.t('toolbar.import'))+
      btn('begin','✎',this.t('editToolbar.begin'))+
      btn('edit','✐',this.t('toolbar.edit'))+btn('delete','⌫',this.t('toolbar.delete'),true)+
      btn('save','💾',this.t('editToolbar.save'))+btn('cancel','✕',this.t('editToolbar.cancel'))+
      btn('undo','↶',this.t('toolbar.undo'))+btn('redo','↷',this.t('toolbar.redo'));
    this.root.appendChild(this.editToolbar);
    this.editToolbar.addEventListener('pointerdown',()=>this._bringPanelToFront?.(this.editToolbar),true);
    this.editToolbar.querySelectorAll('[data-ecmd]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();this._editToolbarCommand(b.dataset.ecmd);}));
    this._makeEditToolbarDraggable();
    this._restoreEditToolbarPosition();
    this._updateEditToolbarOrientation();
    this._updateEditToolbarState();
  },
  toggleEditToolbar(){if(!this.editToolbar)return;this.editToolbar.classList.toggle('hidden');if(!this.editToolbar.classList.contains('hidden')){this._bringPanelToFront?.(this.editToolbar);this._clampEditToolbar();this._updateEditToolbarState();}},
  _editToolbarCommand(cmd){
    const map={
      import:()=>this.showImport(false,{append:true}),begin:()=>this.beginEditSession(),
      edit:()=>this.editSelected(),delete:()=>this.deleteSelected(),save:()=>this.saveEditSession(),cancel:()=>this.cancelEditSession(),undo:()=>this.undo(),redo:()=>this.redo()
    };
    try{const r=map[cmd]?.();if(r&&typeof r.then==='function')r.catch(e=>{console.error(e);this.toast(e?.message||String(e),5000);});}catch(e){console.error(e);this.toast(e?.message||String(e),5000);}
    this._updateEditToolbarState();
  },
  beginEditSession(){
    if(this.editSessionActive)return;
    this._editSessionDirtyBefore=this.isDirty?.()||false;
    this.editSessionActive=true;
    this._editSessionSnapshot=this._snapshot();
    this._editSessionUndoStart=this.undoStack.length;
    this.emit('edit:begin',{});this.toast(this.t('editToolbar.started'));this._updateEditToolbarState();
  },
  async saveEditSession(){
    if(!this.editSessionActive||!this.isDirty())return;
    if(this.pending){this.toast(this.t('editToolbar.finishPending'));return;}
    await this.saveProject();
    this.stopSpatialUpdate?.(false);
    this.editSessionActive=false;this._editSessionSnapshot=null;this._editSessionUndoStart=0;this._editSessionDirtyBefore=false;
    this.emit('edit:saved',{});this._updateEditToolbarState();
  },
  cancelEditSession(){
    if(!this.editSessionActive)return;
    if(this.isDirty()&&!confirm(this.t('editToolbar.cancelConfirm')))return;
    this.stopSpatialUpdate?.(false);
    if(this._editSessionSnapshot)this._restore(this._editSessionSnapshot);
    this.undoStack=[];this.redoStack=[];this.editSessionActive=false;this._editSessionSnapshot=null;if(this._editSessionDirtyBefore)this._setDirty?.('pre-session');else this._markClean();this._editSessionDirtyBefore=false;
    this.emit('edit:cancelled',{});this._updateEditToolbarState();
  },
  _updateEditToolbarState(){
    if(!this.editToolbar)return;
    const active=!!this.editSessionActive,dirty=this.isDirty?.()||false,hasSel=(this.selection?.length||0)>0;
    const set=(c,en)=>{const b=this.editToolbar.querySelector('[data-ecmd="'+c+'"]');if(b)b.disabled=!en;};
    set('begin',!active);set('import',active);
    set('edit',active&&hasSel);set('delete',active&&hasSel);
    set('save',active&&dirty);set('cancel',active);set('undo',active&&this.undoStack.length>0);set('redo',active&&this.redoStack.length>0);
    const begin=this.editToolbar.querySelector('[data-ecmd="begin"]');if(begin)begin.classList.toggle('active',active);
  },
  _makeEditToolbarDraggable(){
    const drag=this.editToolbar.querySelector('.ddc_meko-edit-drag');let st=null;
    const move=e=>{if(!st)return;const rr=this.root.getBoundingClientRect();let left=e.clientX-st.dx-rr.left,top=e.clientY-st.dy-rr.top;this.editToolbar.style.left=left+'px';this.editToolbar.style.top=top+'px';this.editToolbar.style.right='auto';this._clampEditToolbar();};
    const up=()=>{if(!st)return;st=null;document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);this._saveEditToolbarPosition();};
    drag.addEventListener('mousedown',e=>{const br=this.editToolbar.getBoundingClientRect();st={dx:e.clientX-br.left,dy:e.clientY-br.top};document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);e.preventDefault();});
  },
  _updateEditToolbarOrientation(){
    if(!this.editToolbar||!this.root)return;const vertical=this.root.clientWidth<560;this.editToolbar.classList.toggle('vertical',vertical);this._clampEditToolbar();
  },
  _clampEditToolbar(){
    if(!this.editToolbar||this.editToolbar.classList.contains('hidden'))return;const rr=this.root.getBoundingClientRect(),br=this.editToolbar.getBoundingClientRect();let left=parseFloat(this.editToolbar.style.left)||8,top=parseFloat(this.editToolbar.style.top)||8;left=Math.max(4,Math.min(left,Math.max(4,rr.width-br.width-4)));top=Math.max(4,Math.min(top,Math.max(4,rr.height-br.height-4)));this.editToolbar.style.left=left+'px';this.editToolbar.style.top=top+'px';
  },
  _saveEditToolbarPosition(){try{localStorage.setItem('ddc_meko_edit_toolbar_pos',JSON.stringify({left:parseFloat(this.editToolbar.style.left)||8,top:parseFloat(this.editToolbar.style.top)||8}));}catch(e){}},
  _restoreEditToolbarPosition(){try{const p=JSON.parse(localStorage.getItem('ddc_meko_edit_toolbar_pos')||'null');if(p){this.editToolbar.style.left=p.left+'px';this.editToolbar.style.top=p.top+'px';}}catch(e){}}
});

/* ===== src/adapters/shapefile-import.js ===== */
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

/* ===== src/adapters/import-merge.js ===== */
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

/* ===== src/project/project-manager.js ===== */
// Module: project/project-manager.js
Object.assign(WaterMapCore.prototype, {
  _syncProject(){this.project.updatedAt=nowIso();this.project.lastUsedAt=nowIso();this.project.ui=this.project.ui||{};this.project.ui.locale=this.locale;this.project.layers=this.layers.map(l=>({id:l.id,name:l.name,geometryType:l.geometryType,fc:l.fc,schema:l.schema,style:l.style,visible:l.visible,sourceCRS:l.sourceCRS,workingCRS:l.workingCRS,epanetRole:l.epanetRole,epanetMapping:l.epanetMapping,direction:l.direction,clustering:l.clustering,originalFiles:l.originalFiles}));},
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

/* ===== src/adapters/shapefile-export.js ===== */
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

/* ===== src/adapters/epanet-adapter.js ===== */
// Module: adapters/epanet-adapter.js
Object.assign(WaterMapCore.prototype, {
  toEpanetJSON(){const out={junctions:[],reservoirs:[],tanks:[],pipes:[],pumps:[],valves:[]};for(const l of this.layers){const role=l.epanetRole;if(!role)continue;this._ensureEpanetFields(l,role);const coll=role==='junction'?'junctions':role==='reservoir'?'reservoirs':role==='tank'?'tanks':role==='pipe'?'pipes':role==='pump'?'pumps':'valves';for(const f of l.fc.features){const p=f.properties||{},m=l.epanetMapping||{};const val=k=>p[m[k]||k];const o={};(EPANET_SCHEMAS[role]||[]).forEach(([k])=>o[k]=val(k));if(['junction','reservoir','tank'].includes(role)&&f.geometry?.type==='Point'){o.lng=f.geometry.coordinates[0];o.lat=f.geometry.coordinates[1];}out[coll].push(o);}}return out;}
});

/* ===== src/adapters/geojson-export.js ===== */
// Module: adapters/geojson-export.js
Object.assign(WaterMapCore.prototype, {
  exportGeoJSON(layerId){const l=this.getLayer(layerId)||this.getActiveLayer();if(!l)return;downloadBlob(l.name+'.geojson',new Blob([JSON.stringify(l.fc,null,2)],{type:'application/geo+json'}));}
});

/* ===== src/core/99-destroy.js ===== */
// Module: core/99-destroy.js
Object.assign(WaterMapCore.prototype, {
  destroy(){try{if(this._directionTimer)clearInterval(this._directionTimer);clearTimeout(this._dynamicRenderTimer);this.ro?.disconnect();if(this._keyHandler)document.removeEventListener('keydown',this._keyHandler);if(this._keyUpHandler)document.removeEventListener('keyup',this._keyUpHandler);this._panelFocusObservers?.forEach(x=>x.disconnect?.());this.map?.remove();}catch(e){}this.container.innerHTML='';this.container.classList.remove('ddc_meko-host');this.events={};}
});

/* ===== src/99-export.js ===== */
// Public export
WaterMapCore.VERSION=VERSION;WaterMapCore.EPANET_SCHEMAS=EPANET_SCHEMAS;global.WaterMapCore=WaterMapCore;

})(window);
