// Module: adapters/geojson-export.js
Object.assign(WaterMapCore.prototype, {
  exportGeoJSON(layerId){const l=this.getLayer(layerId)||this.getActiveLayer();if(!l)return;downloadBlob(l.name+'.geojson',new Blob([JSON.stringify(l.fc,null,2)],{type:'application/geo+json'}));}
});
