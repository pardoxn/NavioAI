const API_BASE = import.meta.env.VITE_API_BASE || '';
if (API_BASE && typeof window !== 'undefined') {
  const _fetch = window.fetch.bind(window);
  window.fetch = (input, init={}) => {
    let url = typeof input === 'string' ? input : (input?.url || '');
    if (typeof url === 'string' && (url.startsWith('/api') || url.startsWith('/uploads'))) {
      url = API_BASE + url;
      if (typeof input !== 'string') input = new Request(url, input);
    }
    const opts = Object.assign({ credentials: 'include' }, init || {});
    return _fetch(typeof input === 'string' ? url : input, opts);
  };
}
