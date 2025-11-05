if (import.meta.env?.VITE_REMOTE_SYNC === '0' && typeof window !== 'undefined') {
  const _fetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const u = typeof input === 'string' ? input : (input?.url || '');
    if (typeof u === 'string' && u.includes('/api/tours2')) {
      return new Response(JSON.stringify({}), { status: 204, headers: { 'Content-Type': 'application/json' } });
    }
    return _fetch(input, init);
  };
}
