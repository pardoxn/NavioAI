const API_BASE = import.meta.env.VITE_API_BASE || '';
if (typeof window !== 'undefined') {
  const _fetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    let url = typeof input === 'string' ? input : (input?.url || '');
    const opts = Object.assign({ credentials: 'include' }, init || {});
    if (API_BASE && typeof url === 'string' && (url.startsWith('/api') || url.startsWith('/uploads'))) {
      url = API_BASE + url;
      input = typeof input === 'string' ? url : new Request(url, input);
      return _fetch(input, opts);
    }
    if (API_BASE && typeof url === 'string' && url.includes('nominatim.openstreetmap.org/search')) {
      try {
        const u = new URL(url);
        const q = u.searchParams.get('q') || '';
        const proxied = API_BASE + '/api/geocode?q=' + encodeURIComponent(q);
        return _fetch(proxied, opts);
      } catch {}
    }
    return _fetch(input, opts);
  };
}
