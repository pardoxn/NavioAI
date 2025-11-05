const API_BASE = import.meta?.env?.VITE_API_BASE || '';
const REMOTE_SYNC = String(import.meta?.env?.VITE_REMOTE_SYNC ?? '0');

function toApiUrl(u){ return API_BASE ? API_BASE + (u.startsWith('/') ? u : `/${u}`) : u; }

// ---- fetch() hook ----
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const _fetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    let url = typeof input === 'string' ? input : (input?.url || '');
    const isStr = typeof input === 'string';
    const isApi   = typeof url === 'string' && (url.startsWith('/api') || url.startsWith('/uploads'));
    const isTours = typeof url === 'string' && url.includes('/api/tours2');
    const isNom   = typeof url === 'string' && url.includes('nominatim.openstreetmap.org');

    if (REMOTE_SYNC === '0' && isTours) {
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (API_BASE && isNom) {
      try {
        const u = new URL(url); const q = u.searchParams.get('q') || '';
        const proxied = `${API_BASE}/api/geocode?q=${encodeURIComponent(q)}`;
        const req = isStr ? proxied : new Request(proxied, input);
        return _fetch(req, { credentials: 'include' });
      } catch {}
    }
    if (API_BASE && isApi) {
      const target = toApiUrl(url);
      const req = isStr ? target : new Request(target, input);
      const opts = { ...init, credentials: 'include' };
      return _fetch(req, opts);
    }
    let opts = { ...init };
    if (opts.credentials === 'include') { opts = { ...opts }; delete opts.credentials; }
    return _fetch(input, opts);
  };
}

// ---- XMLHttpRequest hook (Axios etc.) ----
if (typeof window !== 'undefined' && window.XMLHttpRequest) {
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    try {
      let u = String(url || '');
      if (REMOTE_SYNC === '0' && u.includes('/api/tours2')) this.__navio_forceEmpty = true;
      if (API_BASE && (u.startsWith('/api') || u.startsWith('/uploads'))) { u = toApiUrl(u); this.withCredentials = true; }
      if (API_BASE && u.includes('nominatim.openstreetmap.org')) {
        try { const o=new URL(u); const q=o.searchParams.get('q')||''; u = `${API_BASE}/api/geocode?q=${encodeURIComponent(q)}`; this.withCredentials = true; } catch {}
      }
      return origOpen.call(this, method, u, async, user, password);
    } catch { return origOpen.call(this, method, url, async, user, password); }
  };

  XMLHttpRequest.prototype.send = function(body) {
    if (this.__navio_forceEmpty) {
      delete this.__navio_forceEmpty;
      const self=this;
      setTimeout(()=>{ Object.defineProperty(self,'readyState',{value:4});
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
