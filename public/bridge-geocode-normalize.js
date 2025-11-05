(function(){
  if (typeof window==='undefined' || typeof window.fetch!=='function') return;
  var API_BASE = (window.__API_BASE||'').trim();
  var _fetch = window.fetch.bind(window);

  function isGeocode(url){ return typeof url==='string' && url.indexOf('/api/geocode')>=0; }

  window.fetch = async function(input, init){
    var use = input, opts = init || {};
    try{
      var url = (typeof input==='string') ? input : (input && input.url) || '';
      if (API_BASE && typeof url==='string' && url.startsWith('/api/geocode')) {
        use = API_BASE + url;
        opts = Object.assign({}, opts);
        if (opts.credentials) delete opts.credentials;
      }
    }catch(e){}
    var res = await _fetch(use, opts);
    try{
      var finalUrl = res && res.url ? res.url : '';
      if (isGeocode(finalUrl)) {
        var data = await res.clone().json().catch(function(){ return null; });
        if (data && !Array.isArray(data) && data.lat!=null && data.lon!=null) {
          var arr = [{ lat: String(data.lat), lon: String(data.lon), display_name: data.name || '' }];
          return new Response(JSON.stringify(arr), { status: 200, headers: { 'Content-Type':'application/json' } });
        }
      }
    }catch(e){}
    return res;
  };
})();
