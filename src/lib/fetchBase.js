// Route /api & /uploads zum Backend; Nominatim-Calls -> /api/geocode.
// Cookies NUR für das Backend mitsenden (verhindert 401/CORS bei fremden Hosts).
const API_BASE = import.meta.env.VITE_API_BASE || '';
if (typeof window !== 'undefined') {
  const _fetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    let url = typeof input === 'string' ? input : (input?.url || '');
    let opts = init || {};

    const toApi = API_BASE && typeof url === 'string' &&
      (url.startsWith('/api') || url.startsWith('/uploads'));

    // /api & /uploads -> Backend + Cookies
    if (toApi) {
      const target = API_BASE + (url.startsWith('/') ? url : `/${url}`);
      if (typeof input === 'string') {
        input = target;
      } else {
        input = new Request(target, input);
      }
      opts = { credentials: 'include', ...opts };
      return _fetch(input, opts);
    }

    // Nominatim -> Backend-Proxy (/api/geocode?q=...)
    if (API_BASE && typeof url === 'string' && url.includes('nominatim.openstreetmap.org')) {
      try {
        const u = new URL(url);
        const q = u.searchParams.get('q') || '';
        const proxied = API_BASE + '/api/geocode?q=' + encodeURIComponent(q);
        return _fetch(proxied, { credentials: 'include' });
      } catch {
        // fällt durch
      }
    }

    // alle anderen wie normal (ohne credentials: 'include')
    return _fetch(input, opts);
  };
}
