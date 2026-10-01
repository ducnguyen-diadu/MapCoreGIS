(function () {
  window.global = window;
  const base = 'assets/lib/MapCoreGIS/MainCore/';
  const files = [
  '00-preamble.js',
  'core/01-watermapcore-base.js',
  'core/01b-events.js',
  'core/02-plugins-i18n.js',
  'core/03-shell.js',
  'core/04-messages-v040.js',

  'ui/modal.js',
  'ui/edit-toolbar.js',

  'project/dirty-state.js',
  'project/project-manager.js',

  'render/layer-renderer.js',
  'render/clustering.js',
  'render/flow-direction.js',

  'style/style-validator.js',
  'style/style-engine.js',

  'layers/layer-manager.js',
  'style/symbology.js', 

  'tools/edit-session.js',
  'tools/layer-create.js',
  'tools/snap-engine.js',
  'tools/sketch-create.js',
  'tools/select-box.js',
  'tools/spatial-update.js',
  'tools/measure.js',
  'tools/topology-validator.js',
  'tools/topology-snap-editor.js',
  'tools/topology-repair.js',
  'tools/sample-demand-generator.js',
  'tools/aggregate-junction-generator.js',

  'adapters/shapefile-import.js',
  'adapters/import-merge.js',   // phải SAU shapefile-import (ghi đè showImport/_groupFiles/_importGroup)
  'adapters/shapefile-export.js',
  'adapters/geojson-export.js',
  'adapters/epanet-adapter.js',

  'core/99-destroy.js',
  '99-export.js'
];
  const v = Date.now(); // chống cache khi dev

  window.WaterMapCoreReady = files.reduce(
    (p, f) => p.then(() => new Promise((ok, err) => {
      const s = document.createElement('script');
      s.src = base + f + '?v=' + v;
      s.onload = ok;
      s.onerror = () => err(new Error('Không load được ' + f));
      document.head.appendChild(s);
    })),
    Promise.resolve()
  );
})();