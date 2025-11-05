(function(){
  var API_BASE = (window.__API_BASE || '').trim();
  var REMOTE_SYNC = String(window.__REMOTE_SYNC || '0');

  function toApiUrl(u){ return API_BASE ? API_BASE + (u[0]==='/'?u:'/'+u) : u; }
  function isApi(u){ return typeof u==='string' && (u.startsWith('/api') || u.startsWith('/uploads')); }
  function isTours2(u){ return typeof u==='string' && u.indexOf('/api/tours2')>=0; }
  function isNominatim(u){ return typeof u==='string' && u.indexOf('nominatim.openstreetmap.org')>=0; }

  // ---- fetch hook ----
  if (typeof window!=='undefined' && typeof window.fetch==='function') {
    var _fetch = window.fetch.bind(window);
    window.fetch = function(input, init){
      init = init || {};
      var url = (typeof input==='string') ? input : (input && input.url) || '';

      // Remote-Sync aus -> tours2 neutral
      if (REMOTE_SYNC==='0' && isTours2(url)) {
        return Promise.resolve(new Response('{}',{status:200,headers:{'Content-Type':'application/json'}}));
      }

      // Nominatim -> Proxy
      if (API_BASE && isNominatim(url)) {
        try {
          var u = new URL(url);
          var q = u.searchParams.get('q') || '';
          var proxied = API_BASE + '/api/geocode?q=' + encodeURIComponent(q);
          return _fetch(proxied, { credentials:'include' });
        } catch (_) {}
      }

      // Eigene API -> Cookies einschalten
      if (API_BASE && isApi(url)) {
        var target = toApiUrl(url);
        return _fetch(target, Object.assign({}, init, { credentials:'include' }));
      }

      // Extern -> niemals credentials: 'include'
      if (init && init.credentials==='include') {
        var clean = Object.assign({}, init); delete clean.credentials;
        return _fetch((typeof input==='string')?input:(input && input.url)||'', clean);
      }
      // Bei Request-Objekten immer auf URL-String zurückfallen, damit oben greift
      if (typeof input!=='string') {
        return _fetch(url, init);
      }
      return _fetch(input, init);
    };
  }

  // ---- XHR hook (Axios etc.) ----
  if (typeof window!=='undefined' && window.XMLHttpRequest) {
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, async, user, password){
      try{
        var u = String(url||'');
        if (REMOTE_SYNC==='0' && isTours2(u)) this.__navio_forceEmpty = true;
        if (API_BASE && isApi(u)) { u = toApiUrl(u); this.withCredentials = true; }
        if (API_BASE && isNominatim(u)) {
          try{
            var o = new URL(u); var q = o.searchParams.get('q')||'';
            u = API_BASE + '/api/geocode?q=' + encodeURIComponent(q);
            this.withCredentials = true;
          }catch(_){}
        }
        return origOpen.call(this, method, u, async, user, password);
      }catch(_){
        return origOpen.call(this, method, url, async, user, password);
      }
    };

    XMLHttpRequest.prototype.send = function(body){
      if (this.__navio_forceEmpty){
        delete this.__navio_forceEmpty;
        var self=this;
        setTimeout(function(){
          Object.defineProperty(self,'readyState',{value:4});
          Object.defineProperty(self,'status',{value:200});
          Object.defineProperty(self,'responseText',{value:'{}'});
          if (typeof self.onreadystatechange==='function') self.onreadystatechange();
          if (typeof self.onload==='function') self.onload();
        },0);
        return;
      }
      return origSend.call(this, body);
    };
  }
})();
