import { canApplyRemote } from '../lib/syncGuard';
import { loadAll } from '../lib/storage';

if (import.meta.env?.VITE_REMOTE_SYNC === '1' && typeof window !== 'undefined') {
  const _fetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const u = typeof input === 'string' ? input : (input?.url || '');
    if (typeof u === 'string' && u.includes('/api/tours2')) {
      try {
        const res = await _fetch(input, init);
        if (!res || !res.ok) return res;
        const clone = res.clone();
        const data = await clone.json().catch(() => null);
        if (data && canApplyRemote(data)) {
          return res; // Remote ist "neu genug" -> durchlassen
        } else {
          const local = loadAll(); // Sonst lokalen Stand zurückgeben
          return new Response(JSON.stringify(local), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      } catch {
        const local = loadAll();
        return new Response(JSON.stringify(local), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }
    return _fetch(input, init);
  };
}
