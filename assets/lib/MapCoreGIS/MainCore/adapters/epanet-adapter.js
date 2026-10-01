// Module: adapters/epanet-adapter.js
Object.assign(WaterMapCore.prototype, {
  toEpanetJSON(){const out={junctions:[],reservoirs:[],tanks:[],pipes:[],pumps:[],valves:[]};for(const l of this.layers){const role=l.epanetRole;if(!role)continue;this._ensureEpanetFields(l,role);const coll=role==='junction'?'junctions':role==='reservoir'?'reservoirs':role==='tank'?'tanks':role==='pipe'?'pipes':role==='pump'?'pumps':'valves';for(const f of l.fc.features){const p=f.properties||{},m=l.epanetMapping||{};const val=k=>p[m[k]||k];const o={};(EPANET_SCHEMAS[role]||[]).forEach(([k])=>o[k]=val(k));if(['junction','reservoir','tank'].includes(role)&&f.geometry?.type==='Point'){o.lng=f.geometry.coordinates[0];o.lat=f.geometry.coordinates[1];}out[coll].push(o);}}return out;}
});
