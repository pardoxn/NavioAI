import React, { useEffect, useMemo, useState } from 'react';
import { Navigation, Check, Camera, Clock, Package, ChevronDown, MapPin, Archive, Undo, Menu, X, User } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';
import { useApi } from '../api.js';

function ensureToastRoot() {
  if (typeof document === 'undefined') return null;
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    Object.assign(root.style, { position: 'fixed', top: '16px', right: '16px', left: '16px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 999999 });
    document.body.appendChild(root);
  }
  return root;
}
function safeToast(message, variant = 'info', ms = 2600) {
  const root = ensureToastRoot();
  if (!root) return;
  const el = document.createElement('div');
  const colors = { success: { bg: '#10b981', fg: '#fff' }, error: { bg: '#ef4444', fg: '#fff' }, info: { bg: '#3b82f6', fg: '#fff' } }[variant] || { bg: '#374151', fg: '#fff' };
  Object.assign(el.style, { background: colors.bg, color: colors.fg, borderRadius: '12px', padding: '12px 16px', boxShadow: '0 10px 20px rgba(0,0,0,.15)', font: '14px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif', wordBreak: 'break-word', opacity: '0', transform: 'translateY(-6px)', transition: 'opacity .2s ease, transform .2s ease' });
  el.textContent = String(message || '');
  root.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
  const remove = () => { el.style.opacity = '0'; el.style.transform = 'translateY(-6px)'; setTimeout(() => el.remove(), 200); };
  const t = setTimeout(remove, ms);
  el.addEventListener('click', () => { clearTimeout(t); remove(); });
}
const toast = { success: (m)=>safeToast(m,'success'), error:(m)=>safeToast(m,'error'), info:(m)=>safeToast(m,'info') };

export default function WarehouseMobileApp() {
  const { user, logout } = useAuth();
  const displayName = user?.displayName || user?.username || 'User';
  const { authedFetch } = useApi();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tours');
  const [expandedTour, setExpandedTour] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [showLoadingModal, setShowLoadingModal] = useState(null);
  const [tourLoadImage, setTourLoadImage] = useState(null);

  const [tours, setTours] = useState([]);
  const [archivedTours, setArchivedTours] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await authedFetch('/api/tours');
        if (!res.ok) throw new Error('load tours failed');
        const all = await res.json();
        if (!alive) return;
        const norm = (Array.isArray(all) ? all : []).map((t, i) => ({
          id: String(t.id ?? t._id ?? i+1),
          name: t.name || t.title || 'Tour',
          region: t.region || t.area || '–',
          stops: Array.isArray(t.orders) ? t.orders.length : (t.stops ?? 0),
          distance: t.distance ?? t.km ?? 0,
          weight: t.weight ?? t.totalWeight ?? 0,
          maxWeight: t.maxWeight ?? 1300,
          lastUpdated: t.updatedAt ? new Date(t.updatedAt).toLocaleString('de-DE') : new Date().toLocaleString('de-DE'),
          orders: Array.isArray(t.orders) ? t.orders.map((o, idx) => ({
            id: String(o.id ?? o._id ?? idx+1),
            customer: o.customer ?? o.name ?? 'Kunde',
            zip: o.zip ?? o.postal ?? '',
            city: o.city ?? '',
            weight: o.weight ?? 0,
            images: o.images ?? []
          })) : [],
          status: t.status || 'planned'
        }));
        setTours(norm.filter(t => t.status !== 'archived'));
        setArchivedTours(norm.filter(t => t.status === 'archived'));
      } catch {
        toast.error('Konnte Touren nicht laden');
      }
    })();
    return () => { alive = false; };
  }, [authedFetch]);

  const handleImageUpload = (tourId, orderId, e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setTours(prev => prev.map(t => t.id!==tourId ? t : ({
          ...t,
          orders: t.orders.map(o => o.id!==orderId ? o : ({
            ...o,
            images: [...(o.images||[]), { id: Date.now()+Math.random(), url: ev.target.result, timestamp: new Date().toLocaleString('de-DE') }]
          }))
        })));
        toast.success('Bild hinzugefügt');
      };
      reader.readAsDataURL(file);
    });
  };

  const handleTourLoadImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setTourLoadImage({ url: ev.target.result, timestamp: new Date().toLocaleString('de-DE') });
    reader.readAsDataURL(file);
  };

  const openLoadingModal = (tourId) => { setShowLoadingModal(tourId); setTourLoadImage(null); };

  const confirmMarkAsLoaded = async () => {
    if (!showLoadingModal) return;
    try {
      await authedFetch(`/api/tours/${encodeURIComponent(showLoadingModal)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' })
      });
      const t = tours.find(tt => tt.id === showLoadingModal);
      const archived = { ...t, loadedAt: new Date().toLocaleString('de-DE'), loadImage: tourLoadImage, status: 'archived' };
      setArchivedTours(prev => [archived, ...prev]);
      setTours(prev => prev.filter(tt => tt.id !== showLoadingModal));
      setShowLoadingModal(null); setTourLoadImage(null);
      setActiveTab('archive');
      toast.success('Tour ins Archiv verschoben');
    } catch {
      toast.error('Archivieren fehlgeschlagen');
    }
  };

  const unloadTour = async (tourId) => {
    try {
      await authedFetch(`/api/tours/${encodeURIComponent(tourId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'planned' })
      });
    } catch {}
    const t = archivedTours.find(tt => tt.id === tourId);
    const { loadedAt, loadImage, ...rest } = t || {};
    setTours(prev => [rest, ...prev]);
    setArchivedTours(prev => prev.filter(tt => tt.id !== tourId));
    setActiveTab('tours');
    toast.info('Tour zurück in aktive Touren verschoben');
  };

  const toggleTour = (tourId) => { setExpandedTour(expandedTour === tourId ? null : tourId); setExpandedOrder(null); };
  const toggleOrder = (orderId) => { setExpandedOrder(expandedOrder === orderId ? null : orderId); };

  const header = useMemo(() => (
    <header className="bg-gradient-to-r from-slate-800 to-slate-700 text-white sticky top-0 z-10 shadow-lg">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Navigation className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-[8px] font-bold">AI</span>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold">Navio AI</h1>
              <p className="text-sm text-gray-300">Lager-Ansicht</p>
            </div>
          </div>
          <button aria-label="Menü" onClick={() => setDrawerOpen(true)} className="w-11 h-11 rounded-xl bg-white/10 active:bg-white/20 flex items-center justify-center">
            <Menu className="w-6 h-6" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 bg-slate-900/30 rounded-lg p-1 mt-3">
          <button onClick={() => setActiveTab('tours')} className={`py-2 rounded-lg font-medium transition-colors ${activeTab==='tours' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'}`}>Touren ({tours.length})</button>
          <button onClick={() => setActiveTab('archive')} className={`py-2 rounded-lg font-medium transition-colors ${activeTab==='archive' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'}`}>Archiv ({archivedTours.length})</button>
        </div>
      </div>
    </header>
  ), [activeTab, tours.length, archivedTours.length]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 max-w-[600px] mx-auto">
      {header}

      {activeTab === 'tours' && (
        <div className="px-4 py-4 space-y-4">
          {tours.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Keine offenen Touren</p>
            </div>
          ) : (
            tours.map((tour) => (
              <div key={tour.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 cursor-pointer active:opacity-90" onClick={() => toggleTour(tour.id)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1">{tour.name}</h3>
                      <div className="flex items-center gap-2 text-blue-100 text-sm">
                        <MapPin size={14} />
                        <span>{tour.region}</span>
                      </div>
                    </div>
                    <div className={`transform transition-transform ${expandedTour === tour.id ? 'rotate-180' : ''}`}>
                      <ChevronDown className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-blue-800/30 rounded-lg p-2 text-center">
                      <div className="text-blue-200 text-xs mb-1">Stopps</div>
                      <div className="text-white font-bold text-lg">{tour.stops}</div>
                    </div>
                    <div className="bg-blue-800/30 rounded-lg p-2 text-center">
                      <div className="text-blue-200 text-xs mb-1">Distanz</div>
                      <div className="text-white font-bold text-lg">{tour.distance} km</div>
                    </div>
                    <div className="bg-blue-800/30 rounded-lg p-2 text-center">
                      <div className="text-blue-200 text-xs mb-1">Gewicht</div>
                      <div className="text-white font-bold text-lg">{tour.weight} kg</div>
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="w-full bg-blue-900/30 rounded-full h-2">
                      <div className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (tour.weight / (tour.maxWeight||1300)) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-blue-100 text-xs">
                    <Clock size={12} />
                    <span>Aktualisiert: {tour.lastUpdated}</span>
                  </div>
                </div>

                {expandedTour === tour.id && (
                  <div className="p-4 space-y-3">
                    {tour.orders.map((order, idx) => (
                      <div key={order.id} className="bg-gray-50 rounded-xl overflow-hidden">
                        <div className="p-4 cursor-pointer active:bg-gray-100" onClick={() => toggleOrder(order.id)}>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">{idx + 1}</div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-900 truncate">{order.customer}</div>
                              <div className="text-sm text-gray-500">{order.zip} {order.city}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-bold text-gray-900">{order.weight} kg</div>
                              {!!(order.images?.length) && (
                                <div className="text-xs text-green-600 flex items-center gap-1 justify-end">
                                  <Camera size={12} />
                                  <span>{order.images.length}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-end">
                            <ChevronDown className={`w-5 h-5 text-gray-400 transform transition-transform ${expandedOrder === order.id ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                        {expandedOrder === order.id && (
                          <div className="px-4 pb-4 space-y-3">
                            <label className="block w-full p-3 bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl text-center cursor-pointer active:bg-blue-100">
                              <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => handleImageUpload(tour.id, order.id, e)} />
                              <Camera className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                              <span className="text-sm font-medium text-blue-700">Foto hinzufügen</span>
                            </label>
                            {!!(order.images?.length) && (
                              <div className="grid grid-cols-2 gap-2">
                                {order.images.map((img) => (
                                  <div key={img.id} className="relative">
                                    <img src={img.url} alt="Sendung" className="w-full h-32 object-cover rounded-lg" />
                                    <div className="absolute bottom-1 left-1 right-1 bg-black/60 text-white text-xs px-2 py-1 rounded">{img.timestamp}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    <button onClick={() => openLoadingModal(tour.id)} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg active:bg-green-700 flex items-center justify-center gap-2">
                      <Check size={24} strokeWidth={3} />
                      Verladen markieren
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'archive' && (
        <div className="px-4 py-4 space-y-4">
          {archivedTours.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <Archive className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Keine archivierten Touren</p>
            </div>
          ) : (
            archivedTours.map((tour) => (
              <div key={tour.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-gray-600 to-gray-700 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1">{tour.name}</h3>
                      <div className="flex items-center gap-2 text-gray-200 text-sm">
                        <MapPin size={14} />
                        <span>{tour.region}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-gray-800/30 rounded-lg p-2 text-center">
                      <div className="text-gray-300 text-xs mb-1">Stopps</div>
                      <div className="text-white font-bold">{tour.stops}</div>
                    </div>
                    <div className="bg-gray-800/30 rounded-lg p-2 text-center">
                      <div className="text-gray-300 text-xs mb-1">Distanz</div>
                      <div className="text-white font-bold">{tour.distance} km</div>
                    </div>
                    <div className="bg-gray-800/30 rounded-lg p-2 text-center">
                      <div className="text-gray-300 text-xs mb-1">Gewicht</div>
                      <div className="text-white font-bold">{tour.weight} kg</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-200 text-xs">
                    <Clock size={12} />
                    <span>Verladen: {tour.loadedAt}</span>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {tour.loadImage && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">Tour-Foto</div>
                      <div className="relative">
                        <img src={tour.loadImage.url} alt="Verladenes Fahrzeug" className="w-full h-48 object-cover rounded-lg" />
                        <div className="absolute bottom-2 left-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">{tour.loadImage.timestamp}</div>
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Stops ({tour.orders.length})</div>
                    <div className="space-y-2">
                      {tour.orders.map((order, idx) => (
                        <div key={order.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-6 h-6 bg-gray-400 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">{idx + 1}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 text-sm truncate">{order.customer}</div>
                            <div className="text-xs text-gray-500">{order.zip} {order.city}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold text-gray-900 text-sm">{order.weight} kg</div>
                            {!!(order.images?.length) && (
                              <div className="text-xs text-green-600 flex items-center gap-1 justify-end">
                                <Camera size={10} />
                                <span>{order.images.length}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => unloadTour(tour.id)} className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold shadow-lg active:bg-orange-700 flex items-center justify-center gap-2">
                    <Undo size={20} />
                    Tour zurücknehmen
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showLoadingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Tour verladen</h3>
            <p className="text-gray-600 mb-4">Möchten Sie ein Foto vom beladenen Fahrzeug hinzufügen?</p>
            <label className="block w-full p-4 bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl text-center cursor-pointer active:bg-blue-100 mb-4">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleTourLoadImageUpload} />
              <Camera className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <span className="text-sm font-medium text-blue-700">{tourLoadImage ? 'Foto ändern' : 'Foto aufnehmen (optional)'}</span>
            </label>
            {tourLoadImage && (
              <div className="relative mb-4">
                <img src={tourLoadImage.url} alt="Tour geladen" className="w-full h-48 object-cover rounded-lg" />
                <div className="absolute bottom-2 left-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">{tourLoadImage.timestamp}</div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowLoadingModal(null)} className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium active:bg-gray-300">Abbrechen</button>
              <button onClick={confirmMarkAsLoaded} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-bold active:bg-green-700">Bestätigen</button>
            </div>
          </div>
        </div>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[85%] max-w-sm bg-white shadow-xl">
            <div className="p-4 flex items-center justify-between border-b">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center"><User size={18} /></div>
                <div className="text-sm">
                  <div className="font-semibold">{displayName}</div>
                  <div className="text-gray-500">lager</div>
                </div>
              </div>
              <button className="w-10 h-10 rounded-lg hover:bg-gray-100 flex items-center justify-center" onClick={() => setDrawerOpen(false)} aria-label="Schließen">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4">
              <button onClick={() => doLogout()} className="w-full py-3 rounded-lg border text-left px-3 hover:bg-gray-50">Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
