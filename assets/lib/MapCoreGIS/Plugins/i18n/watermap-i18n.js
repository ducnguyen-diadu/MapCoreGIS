(function(global){
'use strict';
function WaterMapI18n(options={}){
  const name='WaterMapI18n';
  return {
    name,
    install(core){
      const locales=options.locales||{};
      Object.keys(locales).forEach(code=>core.registerLocale(code,locales[code]));
      if(options.fallbackLocale)core.fallbackLocale=options.fallbackLocale;
      const locale=options.defaultLocale||core.config.locale||core.getLocale();
      core.i18n={
        t:(key,params)=>core.t(key,params),
        setLocale:(code)=>core.setLocale(code),
        getLocale:()=>core.getLocale(),
        registerLocale:(code,messages)=>core.registerLocale(code,messages)
      };
      core.setLocale(locale,{silent:true});
    }
  };
}
global.WaterMapI18n=WaterMapI18n;
})(window);
