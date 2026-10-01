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

Object.assign(CORE_MESSAGES_VI.create,{end:'Bắt Endpoint',sketch:'Đối tượng đang vẽ',tipPoint:'Điểm',tipEnd:'Đầu mút',tipVertex:'Đỉnh',tipEdge:'Cạnh'});

Object.assign(CORE_MESSAGES_VI.create,{hintPoint:'Click: đặt điểm · Esc: thoát công cụ',hintShape:'Click: đặt đỉnh · Double-click / Enter: kết thúc · Backspace: xóa đỉnh cuối · Esc: hủy sketch (Esc lần nữa: thoát công cụ)',tooFew:'Cần tối thiểu {n} đỉnh để kết thúc.'});

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
