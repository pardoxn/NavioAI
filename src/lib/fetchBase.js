const API_BASE = import.meta.env.VITE_API_BASE || '';
const REMOTE_SYNC = (import.meta.env.VITE_REMOTE_SYNC || '0') + '';

if (typeof window !== 'undefined') {
  const _fetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    let url = typeof input === 'string' ? input : (input?.url || '');
    const isStr = typeof input === 'string';

    const isApiPath = typeof url === 'string' && (url.startsWith('/api') || url.startsWith('/uploads'));
    const isTours2 = typeof url === 'string' && url.includes('/api/tours2');
    const isNominatim = typeof url === 'string' && url.includes('nominatim.openstreetmap.org');

    if (REMOTE_SYNC === '0' && isTours2) {
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (API_BASE && isNominatim) {
      try {
        const u = new URL(url);
        const q = u.searchParams.get('q') || '';
        const proxied = API_BASE + '/api/geocode?q=' + encodeURIComponent(q);
        const req = isStr ? proxied : new Request(proxied, input);
        return _fetch(req, { credentials: 'include' });
      } catch {}
    }

    if (API_BASE && isApiPath) {
      const target = API_BASE + (url.startsWith('/') ? url : `/${url}`);
      const req = isStr ? target : new Request(target, input);
      const opts = { ...init, credentials: 'include' };
      return _fetch(req, opts);
    }

    let opts = { ...init };
    if (opts.credentials === 'include') {
      opts = { ...opts };
      delete opts.credentials;
    }
    return _fetch(input, opts);
  };
}
