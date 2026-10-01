// Module: tools/select-box.js - persistent GIS selection mode (click + drag rectangle).
Object.assign(WaterMapCore.prototype, {
  _ensureSelectionStyles() {
    if (document.getElementById('ddc_meko_selection_css')) return;
    const s = document.createElement('style'); s.id = 'ddc_meko_selection_css'; s.textContent = `
.ddc_meko-select-box{position:absolute;z-index:920;border:1px dashed #0b8ea6;background:rgba(11,142,166,.12);pointer-events:none}
.ddc_meko-selection-tree{height:100%;min-height:0;overflow:auto}.ddc_meko-selection-layer{border-bottom:1px solid #e5ecef}.ddc_meko-selection-layer-head{display:flex;align-items:center;gap:6px;padding:7px 5px;font-weight:700;cursor:pointer}.ddc_meko-selection-feature{padding:6px 8px 6px 24px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ddc_meko-selection-feature:hover,.ddc_meko-selection-feature.active{background:#e9f6f8}.ddc_meko-selection-split{display:flex;flex-direction:column;height:100%;min-height:0}.ddc_meko-selection-top{flex:1 1 auto;min-height:80px;overflow:auto}.ddc_meko-selection-resizer{height:8px;flex:0 0 8px;cursor:ns-resize;background:linear-gradient(to bottom,transparent 3px,#b9c7ce 3px,#b9c7ce 5px,transparent 5px)}.ddc_meko-selection-detail{height:42%;min-height:90px;overflow:auto;border-top:1px solid #dfe7eb;animation:ddcMekoSlideUp .18s ease-out}@keyframes ddcMekoSlideUp{from{transform:translateY(12px);opacity:.4}to{transform:translateY(0);opacity:1}}
.ddc_meko-tool.active{background:#dff4f7!important;border-color:#65b7c3!important}
`;
    document.head.appendChild(s);
  },
  _selectionKey(layerId, fid) { return String(layerId) + '::' + String(fid); },
  _clearSelection(silent = false) {
    this.selection = []; this.selected = null;
    this._renderAllLayers();
    if (this.panels?.attrs) this.panels.attrs.classList.add('hidden');
    if (!silent) this.emit('selection:changed', { features: [] });
    this._updateEditToolbarState?.();
  },
  unselect() { this._clearSelection(); this.toast(this.t('select.cleared')); },
  _selectionOpFromEvent(ev) { if (ev?.ctrlKey || ev?.metaKey) return 'toggle'; if (ev?.shiftKey) return 'add'; return 'replace'; },
  _applySelectionItems(items, op = 'replace', focusItem = null) {
    const current = new Map((this.selection || []).map(x => [this._selectionKey(x.layer.id, x.feature.id), x]));
    if (op === 'replace') current.clear();
    for (const item of items || []) {
      const k = this._selectionKey(item.layer.id, item.feature.id);
      if (op === 'toggle') { if (current.has(k)) current.delete(k); else current.set(k, item); }
      else current.set(k, item);
    }
    this.selection = [...current.values()];
    if (focusItem && this.selection.some(x => this._selectionKey(x.layer.id, x.feature.id) === this._selectionKey(focusItem.layer.id, focusItem.feature.id))) this.selected = focusItem;
    else this.selected = this.selection.length === 1 ? this.selection[0] : (this.selection[this.selection.length - 1] || null);
    if (this.selected) this.activeLayerId = this.selected.layer.id;
    this._renderAllLayers();
    this._renderSelectionPanel();
    this.emit('selection:changed', { features: this.selection.slice(), selected: this.selected });
    this._updateEditToolbarState?.();
  },
  _selectFeature(layer, feature, leafletLayer, opt = {}) {
    const op = opt.op || ((opt.toggle) ? 'toggle' : (opt.add ? 'add' : 'replace'));
    const item = { layer, feature, leaflet: leafletLayer || null };
    this._applySelectionItems([item], op, item);
  },
  _featureBBoxIntersectsBounds(feature, bounds) {
    if (!feature?.geometry) return false; const b = bboxFC({ type: 'FeatureCollection', features: [feature] }); if (!b) return false;
    const south = b[0][0], west = b[0][1], north = b[1][0], east = b[1][1];
    return !(east < bounds.getWest() || west > bounds.getEast() || north < bounds.getSouth() || south > bounds.getNorth());
  },
  _collectFeaturesInBounds(bounds) {
    const out = []; this.layers.filter(l => l.visible !== false).forEach(l => (l.fc.features || []).forEach(f => { if (this._featureBBoxIntersectsBounds(f, bounds)) out.push({ layer: l, feature: f, leaflet: null }); })); return out;
  },
  enableSelectMode() {
    if (this.mode === 'spatial-update') this.stopSpatialUpdate?.(false);
    this._ensureSelectionStyles(); this._installSelectPointerHandlers(); this.mode = 'select'; try { this.map?.dragging.enable(); } catch (_) { } this._setToolActive?.('select');
    this.toast(this.t('select.mode')); this.emit('select:mode', { enabled: true });
  },
  disableSelectMode() { if (this.mode === 'select') this.mode = 'pan'; this._setToolActive?.(this.mode === 'pan' ? 'pan' : ''); this._cancelSelectionDrag(); this.emit('select:mode', { enabled: false }); },
  _startBoxSelect() { this.enableSelectMode(); },
  _stopBoxSelect() { this._cancelSelectionDrag(); },
  _installSelectPointerHandlers() {
    if (this._selectionPointerInstalled || !this.map) return; this._selectionPointerInstalled = true; const el = this.map.getContainer();
    const down = e => {
      if (this.mode !== 'select' || this._temporaryPan || e.button !== 0) return;
      if (e.target.closest?.('.leaflet-interactive,.leaflet-marker-icon,.leaflet-control,.ddc_meko-panel,.ddc_meko-toolbar,.ddc_meko-edit-toolbar')) return;
      const rect = el.getBoundingClientRect(); this._selectDrag = { sx: e.clientX - rect.left, sy: e.clientY - rect.top, x: e.clientX - rect.left, y: e.clientY - rect.top, op: this._selectionOpFromEvent(e), moved: false };
      try { this.map.dragging.disable(); } catch (_) { } e.preventDefault(); e.stopPropagation();
    };
    const move = e => { if (!this._selectDrag) return; const rect = el.getBoundingClientRect(), d = this._selectDrag; d.x = Math.max(0, Math.min(rect.width, e.clientX - rect.left)); d.y = Math.max(0, Math.min(rect.height, e.clientY - rect.top)); if (Math.abs(d.x - d.sx) + Math.abs(d.y - d.sy) > 5) d.moved = true; if (!d.moved) return; this._drawSelectionBox(d); e.preventDefault(); };
    const up = e => {
      if (!this._selectDrag) return; const d = this._selectDrag; this._removeSelectionBox(); try { this.map.dragging.enable(); } catch (_) { }
      this._selectDrag = null; if (!d.moved) return;
      const a = this.map.containerPointToLatLng([d.sx, d.sy]), b = this.map.containerPointToLatLng([d.x, d.y]); const bounds = L.latLngBounds(a, b); const found = this._collectFeaturesInBounds(bounds); this._applySelectionItems(found, d.op, found[found.length - 1] || null); this.toast(found.length ? this.t('select.selectedCount', { count: this.selection.length }) : this.t('select.noneInBox')); e.preventDefault(); e.stopPropagation();
    };
    el.addEventListener('mousedown', down, true); document.addEventListener('mousemove', move, true); document.addEventListener('mouseup', up, true); this._selectionHandlers = { el, down, move, up };
  },
  _drawSelectionBox(d) { if (!this._selectBoxEl) { this._selectBoxEl = document.createElement('div'); this._selectBoxEl.className = 'ddc_meko-select-box'; this.root.appendChild(this._selectBoxEl); } const l = Math.min(d.sx, d.x), t = Math.min(d.sy, d.y), w = Math.abs(d.x - d.sx), h = Math.abs(d.y - d.sy); Object.assign(this._selectBoxEl.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px' }); },
  _removeSelectionBox() { if (this._selectBoxEl) { this._selectBoxEl.remove(); this._selectBoxEl = null; } },
  _cancelSelectionDrag() { this._selectDrag = null; this._removeSelectionBox(); try { this.map?.dragging.enable(); } catch (_) { } },
  _renderSelectionPanel() {
    const p = this.panels?.attrs; if (!p) return; if (!this.selection?.length) { p.classList.add('hidden'); return; } p.classList.remove('hidden'); const body = p.querySelector('.ddc_meko-panel-body');
    if (this.selection.length === 1) { const x = this.selection[0]; this.selected = x; this._showSelected(x.layer, x.feature); return; }
    const groups = new Map(); this.selection.forEach(x => { if (!groups.has(x.layer.id)) groups.set(x.layer.id, { layer: x.layer, items: [] }); groups.get(x.layer.id).items.push(x); });
    let tree = '<div class="ddc_meko-selection-tree">'; for (const { layer, items } of groups.values()) { tree += '<div class="ddc_meko-selection-layer"><div class="ddc_meko-selection-layer-head">▾ ' + esc(layer.name) + ' <span class="ddc_meko-badge">' + items.length + '</span></div>'; for (const x of items) { const label = x.feature?.properties?.id ?? x.feature?.properties?.ID ?? x.feature?.id; tree += '<div class="ddc_meko-selection-feature" data-lid="' + esc(layer.id) + '" data-fid="' + esc(x.feature.id) + '">' + esc(label) + '</div>'; } tree += '</div>'; } tree += '</div>';
    body.innerHTML = '<div class="ddc_meko-selection-split"><div class="ddc_meko-selection-top">' + tree + '</div><div class="ddc_meko-selection-resizer hidden"></div><div class="ddc_meko-selection-detail hidden"></div></div>';
    body.querySelectorAll('.ddc_meko-selection-feature').forEach(el => el.onclick = () => this._showSelectionDetail(el.dataset.lid, el.dataset.fid, el));
  },
  _showSelectionDetail(layerId, fid, row) {
    const p = this.panels.attrs, body = p.querySelector('.ddc_meko-panel-body'), top = body.querySelector('.ddc_meko-selection-top'), res = body.querySelector('.ddc_meko-selection-resizer'), detail = body.querySelector('.ddc_meko-selection-detail'); const item = this.selection.find(x => x.layer.id === layerId && String(x.feature.id) === String(fid)); if (!item) return;
    body.querySelectorAll('.ddc_meko-selection-feature').forEach(x => x.classList.toggle('active', x === row)); this.selected = item; this.activeLayerId = item.layer.id; res.classList.remove('hidden'); detail.classList.remove('hidden'); top.style.height = '55%'; top.style.flex = '0 0 55%'; let h = '<b>' + esc(item.layer.name) + '</b><div style="height:6px"></div>'; 
    h += this._featureAttrRowsHtml(item.layer, item.feature);
    detail.innerHTML = h; this._bindSelectionResizer(top, res, detail, body);
  },
  _bindSelectionResizer(top, res, detail, body) { if (res._bound) return; res._bound = true; let start = null; const move = e => { if (!start) return; const r = body.getBoundingClientRect(), pct = Math.max(20, Math.min(80, ((e.clientY - r.top) / r.height) * 100)); top.style.height = pct + '%'; top.style.flex = '0 0 ' + pct + '%'; detail.style.height = (100 - pct) + '%'; }; const up = () => { start = null; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); }; res.addEventListener('mousedown', e => { start = true; document.addEventListener('mousemove', move); document.addEventListener('mouseup', up); e.preventDefault(); }); }
});
