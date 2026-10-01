// Module: layers/layer-manager.js
Object.assign(WaterMapCore.prototype, {
  _addLayerRecord(rec) { const l = { id: rec.id || uuid(), name: rec.name || 'Layer', fc: normalizeFC(rec.fc, rec.name), geometryType: rec.geometryType || rec.fc?.features?.find(f => f.geometry)?.geometry?.type || 'Unknown', schema: rec.schema || inferSchema(rec.fc), style: rec.style || {}, visible: rec.visible !== false, sourceCRS: rec.sourceCRS || 'EPSG:4326', workingCRS: 'EPSG:4326', epanetRole: rec.epanetRole ?? (this.config.epanet.autoDetectRole ? detectRole(rec.name) : null), epanetMapping: rec.epanetMapping || {}, direction: rec.direction || { enabled: false, speed: 1, spacing: 90, size: 14, opacity: .85, minZoom: 13, maxArrows: 250 }, clustering: rec.clustering || { enabled: false, radius: 60, showCount: true }, originalFiles: rec.originalFiles || null }; this.layers.push(l); this.layerIndex.set(l.id, l); this._renderLayer(l); if (!this.activeLayerId) this.activeLayerId = l.id; this.emit('layer:added', { layer: l });this._refreshLayerPanelIfOpen?.(); return l; },
  addLayer(name, fc, opt = {}) { this._pushUndo(); const l = this._addLayerRecord(Object.assign({}, opt, { name, fc })); this._syncProject(); return l; },
  removeLayer(id) { const l = this.layerIndex.get(id); if (!l) return; this._pushUndo(); if (l.leaflet) this.map.removeLayer(l.leaflet); if (l._hitLayer) this.map.removeLayer(l._hitLayer); if (l._directionLayer) this.map.removeLayer(l._directionLayer); this.layers = this.layers.filter(x => x.id !== id); this.layerIndex.delete(id); if (this.activeLayerId === id) this.activeLayerId = this.layers[0]?.id || null; this._syncProject(); this.emit('layer:removed', { layer: l }); },
  getLayer(id) { return this.layerIndex.get(id) || null; },
  getActiveLayer() { return this.activeLayerId ? this.getLayer(this.activeLayerId) : null; },
  _refreshLayerPanelIfOpen() {
    if (this._layerPanelRaf) return;
    this._layerPanelRaf = requestAnimationFrame(() => {
      this._layerPanelRaf = null;
      const p = this.panels?.layers;
      if (!p || p.classList.contains('hidden') || this._dragLayerId) return;
      this.showLayerPanel();
    });
  },
  showLayerPanel() {
    const p = this.panels.layers; p.classList.remove('hidden'); p.querySelector('.ddc_meko-panel-head span').textContent = this.t('panel.layers'); const b = p.querySelector('.ddc_meko-panel-body'); b.innerHTML = '';
    this._ensureLayerPanelDnDStyles?.();
    this.layers.forEach(l => {
      const r = document.createElement('div'); r.className = 'ddc_meko-layer-row' + (l.id === this.activeLayerId ? ' active' : ''); r.draggable = true; r.dataset.layerId = l.id;
      r.innerHTML = '<span class="ddc_meko-layer-drag" title="Kéo để đổi thứ tự">⋮⋮</span><input type="checkbox" ' + (l.visible !== false ? 'checked' : '') + '><span class="ddc_meko-layer-name">' + esc(l.name) + '</span><span class="ddc_meko-badge">' + esc(geomKind(l.geometryType)) + ' · ' + l.fc.features.length + '</span>';
      r.onclick = e => { if (e.target.tagName !== 'INPUT') { this.activeLayerId = l.id; this.showLayerPanel(); } };
      r.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); this.activeLayerId = l.id; this._showLayerContext(e.clientX, e.clientY, l); };
      r.querySelector('input').onchange = e => { l.visible = e.target.checked; if (l.visible) { if (!this.map.hasLayer(l.leaflet)) l.leaflet.addTo(this.map); } else { if (l.leaflet) this.map.removeLayer(l.leaflet); if (l._hitLayer) this.map.removeLayer(l._hitLayer); if (l._directionLayer) this.map.removeLayer(l._directionLayer); } this._applyLayerOrder?.(); this._syncProject(); this._setDirty?.('layer-visibility'); };
      r.ondragstart = e => { this._dragLayerId = l.id; r.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', l.id); } catch (_) { } };
      r.ondragend = () => { this._dragLayerId = null; r.classList.remove('dragging'); b.querySelectorAll('.ddc_meko-layer-row').forEach(x => x.classList.remove('drag-over')); };
      r.ondragover = e => { e.preventDefault(); if (this._dragLayerId && this._dragLayerId !== l.id) { r.classList.add('drag-over'); try { e.dataTransfer.dropEffect = 'move'; } catch (_) { } } };
      r.ondragleave = () => r.classList.remove('drag-over');
      r.ondrop = e => { e.preventDefault(); r.classList.remove('drag-over'); const from = this.layers.findIndex(x => x.id === this._dragLayerId), to = this.layers.findIndex(x => x.id === l.id); if (from < 0 || to < 0 || from === to) return; const [m] = this.layers.splice(from, 1); this.layers.splice(to, 0, m); this.activeLayerId = m.id; this._applyLayerOrder(); this._syncProject(); this._setDirty?.('layer-order'); this.emit('layer:reordered', { layer: m, from, to }); this.showLayerPanel(); };
      b.appendChild(r);
    });
    if (this.layers.length) { const row = document.createElement('div'); row.className = 'ddc_meko-btnrow'; row.innerHTML = '<button class="ddc_meko-btn" data-a="fields">' + esc(this.t('context.fields')) + '</button><button class="ddc_meko-btn" data-a="epanet">EPANET</button><button class="ddc_meko-btn" data-a="zoom">' + esc(this.t('context.zoomTo')) + '</button>'; b.appendChild(row); row.querySelector('[data-a=fields]').onclick = () => this.configureFields(); row.querySelector('[data-a=epanet]').onclick = () => this.configureEpanet(); row.querySelector('[data-a=zoom]').onclick = () => this.zoomToLayer(this.activeLayerId); }
  },
  _ensureLayerPanelDnDStyles() { if (document.getElementById('ddc_meko_layer_dnd_css')) return; const st = document.createElement('style'); st.id = 'ddc_meko_layer_dnd_css'; st.textContent = '.ddc_meko-layer-row{display:flex;align-items:center;gap:6px}.ddc_meko-layer-row[draggable=true]{cursor:default}.ddc_meko-layer-drag{cursor:grab;color:#7d8b95;padding:0 3px;font-weight:700}.ddc_meko-layer-row.dragging{opacity:.5}.ddc_meko-layer-row.drag-over{box-shadow:inset 0 2px 0 #0b8ea6}'; document.head.appendChild(st); },
  _applyLayerOrder() {
    this.layers.forEach(l => { if (l.leaflet && this.map.hasLayer(l.leaflet)) this.map.removeLayer(l.leaflet); if (l._hitLayer && this.map.hasLayer(l._hitLayer)) this.map.removeLayer(l._hitLayer); if (l._directionLayer && this.map.hasLayer(l._directionLayer)) this.map.removeLayer(l._directionLayer); });
    [...this.layers].reverse().forEach(l => { if (l.visible !== false && l.leaflet) l.leaflet.addTo(this.map); if (l.visible !== false && l._hitLayer) l._hitLayer.addTo(this.map); if (l.visible !== false && l._directionLayer) l._directionLayer.addTo(this.map); });
  },
  _showLayerContext(clientX, clientY, l) {
    const rr = this.root.getBoundingClientRect(); const x = Math.max(4, Math.min(clientX - rr.left, rr.width - 240)); const y = Math.max(4, Math.min(clientY - rr.top, rr.height - 430)); this.contextEl.style.left = x + 'px'; this.contextEl.style.top = y + 'px'; this.contextEl.classList.remove('hidden');
    const acts = [[this.t('context.zoomLayer'), () => this.zoomToLayer(l.id)], [this.t('context.panLayer'), () => this.panToLayer(l.id)], [this.t('context.flashLayer'), () => this.flashLayer(l.id)], [this.t('context.attributeTable'), () => this.showAttributeTable(l.id)], [this.t('context.fields'), () => this.configureFields(l.id)], [this.t('symbology.menu'),()=>this.configureSymbology?.(l.id)],[this.t('style.legend'),()=>this.showLayerLegend?.(l.id)]];
    acts.unshift([this.t('layer.addNew') || 'Thêm mới', () => this.addNewFeatureToLayer?.(l.id)]);
    if (geomKind(l.geometryType) === 'line') acts.push([this.t('direction.menu'), () => this.configureDirection?.(l.id)]);
    if (geomKind(l.geometryType) === 'point') acts.push([this.t('cluster.menu'), () => this.configureClustering?.(l.id)]);
    acts.push(['EPANET', () => this.configureEpanet()], [this.t('context.exportGeoJSON'), () => this.exportGeoJSON(l.id)], [this.t('context.removeLayer'), () => { if (confirm(this.t('layer.removeConfirm', { name: l.name }))) this.removeLayer(l.id); }]);
    this.contextEl.innerHTML = ''; acts.forEach(a => { const b = document.createElement('button'); b.textContent = a[0]; b.onclick = e => { e.stopPropagation(); this._hideContext(); this.activeLayerId = l.id; a[1](); }; this.contextEl.appendChild(b); });
  },
  configureStyle() { const l = this.getActiveLayer(); if (!l) return; this.configureFields(l.id); },
  _distinctFieldValues(layer, fieldName) {
    const set = new Map(); (layer.fc?.features || []).forEach(f => { const v = f.properties?.[fieldName]; if (v === null || v === undefined || v === '') return; const k = typeof v === 'string' ? v.trim().toLowerCase() : String(v); if (!set.has(k)) set.set(k, v); });
    return [...set.values()].sort((a, b) => { const na = Number(a), nb = Number(b); if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb; return String(a).localeCompare(String(b)); });
  },
  configureFields(layerId) {
    const l = this.getLayer(layerId) || this.getActiveLayer(); if (!l) return; this.activeLayerId = l.id;
    let h = '<div class="ddc_meko-warning" style="margin-bottom:8px">' + esc(this.t('field.clickToStyle') || 'Chọn một field để xem các giá trị duy nhất và cấu hình Style/Symbol.') + '</div><div class="ddc_meko-table-wrap"><table class="ddc_meko-table"><thead><tr><th>' + esc(this.t('layer.field')) + '</th><th>' + esc(this.t('layer.alias')) + '</th><th>' + esc(this.t('layer.type')) + '</th><th>' + esc(this.t('layer.visible')) + '</th><th>' + esc(this.t('layer.editable')) + '</th><th>Style</th></tr></thead><tbody>';
    l.schema.forEach((f, i) => h += '<tr data-i="' + i + '"><td><button class="ddc_meko-btn" data-field-style="' + esc(f.name) + '">' + esc(f.name) + '</button></td><td><input data-k="alias" value="' + esc(f.alias || f.name) + '"></td><td>' + esc(f.type) + '</td><td><input data-k="visible" type="checkbox" ' + (f.visible !== false ? 'checked' : '') + '></td><td><input data-k="editable" type="checkbox" ' + (f.editable !== false ? 'checked' : '') + '></td><td><button class="ddc_meko-btn" data-field-style="' + esc(f.name) + '">⚙</button></td></tr>');
    h += '</tbody></table></div>';
    const reopen = () => this.configureFields(l.id);
    this._modal(this.t('layer.fieldsTitle', { name: l.name }), h, [{ text: this.t('common.save'), primary: true, fn: () => { this.modalWrap.querySelectorAll('tr[data-i]').forEach(r => { const f = l.schema[Number(r.dataset.i)]; f.alias = r.querySelector('[data-k=alias]').value; f.visible = r.querySelector('[data-k=visible]').checked; f.editable = r.querySelector('[data-k=editable]').checked; }); this._syncProject(); this._setDirty?.('fields'); this._closeModal(); } }, { text: this.t('common.cancel'), fn: () => this._closeModal() }], { wide: true });
    this.modalWrap.querySelectorAll('[data-field-style]').forEach(btn => btn.onclick = e => { e.stopPropagation(); const fieldName = btn.dataset.fieldStyle; this._showFieldStyleChooser(l, fieldName, reopen); });
  },
  _showFieldStyleChooser(layer, fieldName, back) {
    const fd = (layer.schema || []).find(x => x.name === fieldName); if (!fd) return; const values = this._distinctFieldValues(layer, fieldName); const kind = geomKind(layer.geometryType); const props = kind === 'point' ? [['color', this.t('style.colorByField')], ['radius', this.t('style.sizeByField')], ['symbol', this.t('style.symbolByField')], ['opacity', this.t('style.opacityByField')]] : kind === 'line' ? [['color', this.t('style.colorByField')], ['weight', this.t('style.widthByField')], ['opacity', this.t('style.opacityByField')]] : [['color', this.t('style.colorByField')], ['weight', this.t('style.widthByField')], ['opacity', this.t('style.opacityByField')]];
    const preview = values.length ? values.slice(0, 300).map(v => '<span class="ddc_meko-badge" style="margin:2px">' + esc(v) + '</span>').join('') : '<span class="ddc_meko-empty">' + esc(this.t('field.noValues') || 'Không có giá trị') + '</span>';
    let h = '<div><b>' + esc(fd.alias || fd.name) + '</b> <small>(' + esc(fd.type || '') + ')</small></div><div class="ddc_meko-warning" style="margin:8px 0">' + esc(this.t('field.distinctCount', { count: values.length }) || ('Giá trị duy nhất: ' + values.length)) + '</div><div style="max-height:180px;overflow:auto;padding:4px;border:1px solid #e1e7eb;border-radius:6px">' + preview + '</div><div style="margin-top:10px"><b>' + esc(this.t('style.attributeStyle')) + '</b></div>' + props.map(([p, label]) => '<div class="ddc_meko-btnrow" style="justify-content:space-between"><span>' + esc(label) + '</span><button class="ddc_meko-btn" data-prop="' + p + '">' + esc(this.t('style.configure')) + '</button></div>').join('');
    this._modal((this.t('field.styleTitle', { field: fd.alias || fd.name }) || ('Style — ' + (fd.alias || fd.name))), h, [{ text: this.t('common.back'), fn: () => back?.() }], { wide: true });
    this.modalWrap.querySelectorAll('[data-prop]').forEach(b => b.onclick = () => this._configureStyleProperty(layer, b.dataset.prop, fieldName, () => this._showFieldStyleChooser(layer, fieldName, back)));
  },
  configureEpanet() {
    const l = this.getActiveLayer(); if (!l) return;
    const roles = ['', 'junction', 'reservoir', 'tank', 'pipe', 'pump', 'valve'];
    const buildFields = (role) => {
      if (!role) return '<div class="ddc_meko-empty">' + esc(this.t('epanet.notUsed')) + '</div>';
      return '<div class="ddc_meko-warning" style="margin-bottom:10px">' + esc(this.t('epanet.mappingHelp')) + '</div>' + (EPANET_SCHEMAS[role] || []).map(([k]) => {
        const current = l.epanetMapping?.[k] || ((l.schema || []).find(f => f.name.toLowerCase() === k.toLowerCase())?.name) || '';
        const opts = '<option value="">' + esc(this.t('epanet.createField', { name: k })) + '</option>' + (l.schema || []).map(f => '<option value="' + esc(f.name) + '" ' + (current === f.name ? 'selected' : '') + '>' + esc(f.name) + '</option>').join('');
        return '<label class="ddc_meko-field"><span>' + esc(k) + '</span><select data-ep-field="' + esc(k) + '">' + opts + '</select></label>';
      }).join('');
    };
    let h = '<label class="ddc_meko-field"><span>' + esc(this.t('epanet.role')) + '</span><select id="ddcRole">' + roles.map(r => '<option value="' + r + '" ' + ((l.epanetRole || '') === r ? 'selected' : '') + '>' + (r || esc(this.t('epanet.none'))) + '</option>').join('') + '</select></label><div id="ddcEpanetFields">' + buildFields(l.epanetRole || '') + '</div>';
    this._modal(this.t('epanet.title', { name: l.name }), h, [{
      text: this.t('common.save'), primary: true, fn: () => {
        const role = this.modalWrap.querySelector('#ddcRole').value || null; l.epanetRole = role; l.epanetMapping = {};
        if (role) { this.modalWrap.querySelectorAll('[data-ep-field]').forEach(sel => { if (sel.value) l.epanetMapping[sel.dataset.epField] = sel.value; }); this._ensureEpanetFields(l, role); (EPANET_SCHEMAS[role] || []).forEach(([k]) => { if (!l.epanetMapping[k]) l.epanetMapping[k] = k; }); }
        this._syncProject(); this._setDirty?.('epanet'); this._closeModal();
      }
    }, { text: this.t('common.cancel'), fn: () => this._closeModal() }]);
    const roleSel = this.modalWrap.querySelector('#ddcRole'); roleSel.onchange = () => { this.modalWrap.querySelector('#ddcEpanetFields').innerHTML = buildFields(roleSel.value); };
  },
  _ensureEpanetFields(l, role) { const existing = new Set(l.schema.map(f => f.name.toLowerCase())); (EPANET_SCHEMAS[role] || []).forEach(([name, type]) => { if (!existing.has(name.toLowerCase())) { l.schema.push({ name, type, dbfType: type === 'String' ? 'C' : 'N', length: type === 'String' ? 80 : 18, decimals: type === 'Double' ? 6 : 0, visible: true, editable: true, required: false, alias: name }); l.fc.features.forEach(f => { if (!(name in f.properties)) f.properties[name] = null; }); } }); },
  showAttributeTable(layerId) { const l = this.getLayer(layerId) || this.getActiveLayer(); if (!l) { this.toast(this.t('table.noLayer')); return; } this.activeLayerId = l.id; const pageSize = this.config.attributeTable.pageSize; const mode = (this.config.attributeTable.mode || 'modal').toLowerCase(); let page = 1; const render = () => { const fields = l.schema.filter(f => f.visible !== false); const max = Math.max(1, Math.ceil(l.fc.features.length / pageSize)); page = Math.max(1, Math.min(page, max)); const arr = l.fc.features.slice((page - 1) * pageSize, page * pageSize); let h = '<div class="ddc_meko-table-wrap"><table class="ddc_meko-table"><thead><tr>' + fields.map(f => '<th>' + esc(f.alias || f.name) + '</th>').join('') + '</tr></thead><tbody>'; arr.forEach(f => { h += '<tr data-id="' + esc(f.id) + '">' + fields.map(fd => '<td>' + esc(f.properties?.[fd.name]) + '</td>').join('') + '</tr>'; }); h += '</tbody></table></div><div class="ddc_meko-pager"><button class="ddc_meko-btn" data-p="prev">←</button><span>' + esc(this.t('table.page', { page, max, count: l.fc.features.length })) + '</span><button class="ddc_meko-btn" data-p="next">→</button></div>'; let host; const title = this.t('table.title', { name: l.name }); if (mode === 'bottom') { const p = this.panels.table; p.classList.remove('hidden'); p.querySelector('.ddc_meko-panel-head span').textContent = title; host = p.querySelector('.ddc_meko-panel-body'); host.innerHTML = h; } else { this._modal(title, h, [{ text: this.t('common.close'), fn: () => this._closeModal() }], { wide: true }); host = this.modalWrap; } host.querySelector('[data-p=prev]').onclick = () => { page--; render(); }; host.querySelector('[data-p=next]').onclick = () => { page++; render(); }; host.querySelectorAll('tr[data-id]').forEach(r => { r.ondblclick = () => this.zoomToFeature(l.id, r.dataset.id); r.oncontextmenu = e => { e.preventDefault(); const f = l.fc.features.find(x => String(x.id) === String(r.dataset.id)); if (mode !== 'bottom') this._closeModal(); this._showContext(e.clientX, e.clientY, l, f, null); }; }); }; render(); },
  zoomToLayer(id) { const l = this.getLayer(id); if (!l) return; const b = bboxFC(l.fc); if (b) this.map.fitBounds(b, { padding: [24, 24] }); },
  panToLayer(id) { const l = this.getLayer(id); if (!l) return; const b = bboxFC(l.fc); if (b) this.map.panTo([(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]); },
  flashLayer(id) { const l = this.getLayer(id); if (!l?.leaflet) return; l.leaflet.eachLayer(x => { if (x.setStyle) x.setStyle({ color: '#ff6b4a', weight: 6, fillOpacity: .8 }); }); setTimeout(() => this._renderLayer(l), 1200); },
  zoomToFullExtent() { const all = { type: 'FeatureCollection', features: this.layers.flatMap(l => l.fc.features) }; const b = bboxFC(all); if (b) this.map.fitBounds(b, { padding: [28, 28] }); },
  goHome() { this.map.invalidateSize(false); if (this._homeBounds) { const b = this._homeBounds; const same = b[0][0] === b[1][0] && b[0][1] === b[1][1]; if (same) this.map.setView(b[0], Math.min(this.map.getMaxZoom?.() ?? 24, 24), { animate: false }); else this.map.fitBounds(b, { padding: [30, 30], maxZoom: this.map.getMaxZoom?.() ?? 24, animate: false }); } else this.map.setView(this._homeView.center, this._homeView.zoom, { animate: false }); },
  _focusLoadedData() {
    if (!this.map) return false;
    const features = this.layers.flatMap(l => Array.isArray(l.fc?.features) ? l.fc.features : []);
    if (!features.length) return false;
    const b = bboxFC({ type: 'FeatureCollection', features });
    if (!b) return false;
    this.map.invalidateSize(false);
    const samePoint = b[0][0] === b[1][0] && b[0][1] === b[1][1];
    if (samePoint) {
      this.map.setView(b[0], Math.max(this.map.getZoom() || 0, 18));
    } else {
      this.map.fitBounds(b, { padding: [30, 30], maxZoom: this.map.getMaxZoom?.() ?? 24, animate: false });
    }
    this._homeBounds = JSON.parse(JSON.stringify(b));
    const c = this.map.getCenter(); this._homeView = { center: [c.lat, c.lng], zoom: this.map.getZoom() };
    return true;
  },
  _scheduleFocusLoadedData(fallbackMap) {
    clearTimeout(this._focusLoadedTimer);
    this._focusLoadedTimer = setTimeout(() => {
      const focused = this._focusLoadedData();
      if (!focused && fallbackMap?.center) {
        this.map.invalidateSize(false);
        this.map.setView(fallbackMap.center, fallbackMap.zoom || 13, { animate: false }); this._homeBounds = null; this._homeView = { center: fallbackMap.center.slice(), zoom: fallbackMap.zoom || 13 };
      }
    }, 120);
  },
  zoomToFeature(layerId, fid) { const l = this.getLayer(layerId), f = l?.fc.features.find(x => String(x.id) === String(fid)); if (!f) return; const b = bboxFC({ type: 'FeatureCollection', features: [f] }); if (b[0][0] === b[1][0] && b[0][1] === b[1][1]) this.map.setView(b[0], Math.min(this.map.getMaxZoom?.() ?? 24, Math.max(this.map.getZoom(), 18))); else this.map.fitBounds(b, { padding: [30, 30], maxZoom: this.map.getMaxZoom?.() ?? 24 }); },
  panToFeature(layerId, fid) { const l = this.getLayer(layerId), f = l?.fc.features.find(x => String(x.id) === String(fid)); if (!f) return; const b = bboxFC({ type: 'FeatureCollection', features: [f] }); if (b) this.map.panTo([(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]); },
  flashFeature(layerId, fid) {
    const l = this.getLayer(layerId), f = l?.fc.features.find(x => String(x.id) === String(fid)); if (!l || !f) return; this.zoomToFeature(layerId, fid);
    if (this._flashOverlay) { try { this.map.removeLayer(this._flashOverlay); } catch (_) { } this._flashOverlay = null; }
    const base = this._resolveFeatureVisualStyle?.(l, f) || {}; const group = L.layerGroup().addTo(this.map); this._flashOverlay = group; let on = false, n = 0;
    const make = () => { group.clearLayers(); if (!on) return; L.geoJSON(f, { style: () => ({ color: '#ffb000', weight: Math.max(5, (Number(base.weight) || 3) + 4), opacity: 1, fillColor: '#ffd24a', fillOpacity: .55 }), pointToLayer: (ff, ll) => L.circleMarker(ll, { radius: Math.max(10, (Number(base.radius) || 6) + 7), color: '#ff8a00', weight: 4, fillColor: '#ffd24a', fillOpacity: .75, interactive: false }) }).addTo(group); };
    const timer = setInterval(() => { on = !on; make(); n++; if (n >= 8) { clearInterval(timer); group.clearLayers(); try { this.map.removeLayer(group); } catch (_) { } if (this._flashOverlay === group) this._flashOverlay = null; } }, 220);
  },
  duplicateFeature(layerId, fid) { const l = this.getLayer(layerId), f = l?.fc.features.find(x => String(x.id) === String(fid)); if (!f) return; this._pushUndo(); const c = JSON.parse(JSON.stringify(f)); c.id = uuid(); l.fc.features.push(c); this._renderLayer(l); this._syncProject(); },
  exportFeature(layerId, fid) { const l = this.getLayer(layerId), f = l?.fc.features.find(x => String(x.id) === String(fid)); if (!f) return; downloadBlob((l.name || 'feature') + '_' + fid + '.geojson', new Blob([JSON.stringify(f, null, 2)], { type: 'application/geo+json' })); },
  clearLayers(push = true) { if (push && this.layers.length) this._pushUndo(); this.layers.forEach(l => { if (l.leaflet) this.map.removeLayer(l.leaflet); if (l._hitLayer) this.map.removeLayer(l._hitLayer); if (l._directionLayer) this.map.removeLayer(l._directionLayer); }); if (this._clusterSpiderGroup) { this.map.removeLayer(this._clusterSpiderGroup); this._clusterSpiderGroup = null; } this.layers = []; this.layerIndex.clear(); this.activeLayerId = null; this.selected = null; this._refreshLayerPanelIfOpen?.();}
});
