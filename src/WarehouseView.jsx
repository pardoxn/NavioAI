// src/WarehouseView.jsx
import React from "react";
import {
  Navigation, Check, Camera, Clock, Package, ChevronDown, MapPin, Undo,
} from "lucide-react";

// kleines lokales Toast (unabhängig vom App-Toast – stört nix)
function ensureToastRoot() {
  if (typeof document === "undefined") return null;
  let root = document.getElementById("toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "toast-root";
    Object.assign(root.style, {
      position: "fixed", top: "16px", right: "16px", left: "16px",
      display: "flex", flexDirection: "column", gap: "8px", zIndex: 999999
    });
    document.body.appendChild(root);
  }
  return root;
}
function safeToast(message, variant = "info", ms = 2400) {
  const root = ensureToastRoot(); if (!root) return;
  const el = document.createElement("div");
  const colors = { success: { bg: "#10b981", fg: "#fff" }, error: { bg: "#ef4444", fg: "#fff" }, info: { bg: "#3b82f6", fg: "#fff" } }[variant] || { bg: "#374151", fg: "#fff" };
  Object.assign(el.style, { background: colors.bg, color: colors.fg, borderRadius: "12px", padding: "12px 16px", boxShadow: "0 10px 20px rgba(0,0,0,.15)", font: "14px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif", wordBreak: "break-word", opacity: "0", transform: "translateY(-6px)", transition: "opacity .2s ease, transform .2s ease" });
  el.textContent = String(message || "");
  root.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
  const remove = () => { el.style.opacity = "0"; el.style.transform = "translateY(-6px)"; setTimeout(() => el.remove(), 200); };
  const t = setTimeout(remove, ms); el.addEventListener("click", () => { clearTimeout(t); remove(); });
}
const toast = { success: (m)=>safeToast(m,"success"), error:(m)=>safeToast(m,"error"), info:(m)=>safeToast(m,"info") };

export default function WarehouseView({
  tours, setTours,
  archivedTours, setArchivedTours,
  embedded = false,
}) {
  const [activeTab, setActiveTab] = React.useState("tours"); // 'tours' | 'archive'
  const [expandedTour, setExpandedTour] = React.useState(null);
  const [expandedOrder, setExpandedOrder] = React.useState(null);
  const [showLoadingModal, setShowLoadingModal] = React.useState(null); // tourId
  const [tourLoadImage, setTourLoadImage] = React.useState(null);
  const [tourNote, setTourNote] = React.useState("");

  // Optional: nur „fertige“ Touren anzeigen (falls ihr lock/ready benutzt)
  const readyTours = React.useMemo(() => {
    return (tours || []).filter(t => true /* t.locked || t.status === 'ready' */);
  }, [tours]);

  const handleImageUpload = (tourId, orderId, e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = evt => {
        setTours(prev => prev.map(tour => {
          if (tour.id !== tourId) return tour;
          return {
            ...tour,
            updatedAt: new Date().toISOString(),
            orders: (tour.orders || []).map(order => {
              if (order.id !== orderId) return order;
              const images = Array.isArray(order.images) ? order.images : [];
              return {
                ...order,
                images: [...images, {
                  id: Date.now() + Math.random(),
                  dataUrl: evt.target.result,
                  timestamp: new Date().toLocaleString("de-DE"),
                }],
              };
            }),
          };
        }));
        toast.success("Bild hinzugefügt");
      };
      reader.readAsDataURL(file);
    });
  };

  const handleTourLoadImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      setTourLoadImage({
        dataUrl: evt.target.result,
        timestamp: new Date().toLocaleString("de-DE"),
      });
      toast.success("Tour-Foto hinzugefügt");
    };
    reader.readAsDataURL(file);
  };

  const openLoadingModal = (tourId) => {
    setShowLoadingModal(tourId);
    setTourLoadImage(null);
    setTourNote("");
  };

  const confirmMarkAsLoaded = () => {
    const tourId = showLoadingModal;
    if (!tourId) return;
    const t = (tours || []).find(x => x.id === tourId);
    if (!t) return;

    const archived = {
      ...t,
      loadedAt: new Date().toLocaleString("de-DE"),
      loadedAtISO: new Date().toISOString(),
      loadImage: tourLoadImage || null,
      warehouseNote: (tourNote || "").trim(),
      kind: "loaded",
      archivedAt: new Date().toISOString(),
      date: new Date().toLocaleString("de-DE", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit" }),
    };

    setArchivedTours(prev => [archived, ...(prev || [])]);
    setTours(prev => (prev || []).filter(x => x.id !== tourId));
    setShowLoadingModal(null);
    setTourLoadImage(null);
    setTourNote("");
    toast.success("Tour ins Archiv verschoben");
  };

  const unloadTour = (tourId) => {
    const t = (archivedTours || []).find(x => x.id === tourId);
    if (!t) return;
    const { loadedAt, loadedAtISO, loadImage, warehouseNote, archivedAt, kind, ...active } = t;
    setTours(prev => [{ ...active, updatedAt: new Date().toISOString() }, ...(prev || [])]);
    setArchivedTours(prev => (prev || []).filter(x => x.id !== tourId));
    toast.info("Tour zurück in aktive Touren verschoben");
  };

  const toggleTour = (tourId) => {
    setExpandedTour(expandedTour === tourId ? null : tourId);
    setExpandedOrder(null);
  };
  const toggleOrder = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const containerClasses = embedded
    ? "bg-slate-50 pb-16 snap-start"
    : "min-h-screen bg-gray-50 pb-24";

  return (
    <div className={containerClasses}>
      {/* Header */}
      {embedded ? (
        <div className="sticky top-16 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto max-w-xl px-4 py-3">
            <div
              className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory"
              style={{ scrollbarWidth: "thin" }}
            >
              <button
                onClick={() => setActiveTab("tours")}
                className={`flex h-11 min-w-[160px] snap-start items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors ${activeTab === "tours" ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}
              >
                Touren ({readyTours.length})
              </button>
              <button
                onClick={() => setActiveTab("archive")}
                className={`flex h-11 min-w-[160px] snap-start items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors ${activeTab === "archive" ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}
              >
                Archiv ({(archivedTours || []).length})
              </button>
            </div>
          </div>
        </div>
      ) : (
        <header className="bg-gradient-to-r from-slate-800 to-slate-700 text-white sticky top-0 z-10 shadow">
          <div className="px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
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

            {/* Tabs */}
            <div className="grid grid-cols-2 gap-2 bg-slate-900/30 rounded-lg p-1">
              <button
                onClick={() => setActiveTab("tours")}
                className={`py-2 rounded-lg font-medium transition-colors ${activeTab === "tours" ? "bg-blue-600 text-white" : "text-gray-300 hover:text-white"}`}
              >
                Touren ({readyTours.length})
              </button>
              <button
                onClick={() => setActiveTab("archive")}
                className={`py-2 rounded-lg font-medium transition-colors ${activeTab === "archive" ? "bg-blue-600 text-white" : "text-gray-300 hover:text-white"}`}
              >
                Archiv ({(archivedTours || []).length})
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Tour-Liste */}
      {activeTab === "tours" && (
        <div className={`${embedded ? "px-0" : "px-4"} py-4 space-y-4`}>
          {readyTours.length === 0 ? (
            <div className={`bg-white rounded-2xl p-8 text-center ${embedded ? "snap-start shadow-sm" : ""}`}>
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Keine offenen Touren</p>
            </div>
          ) : readyTours.map(tour => {
            const stops = (tour.orders || []).length;
            return (
              <div key={tour.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden ${embedded ? "snap-start" : ""}`}>
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 cursor-pointer active:opacity-90" onClick={() => toggleTour(tour.id)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-white mb-1">{tour.name || "Tour"}</h3>
                      <div className="flex items-center gap-2 text-blue-100 text-sm">
                        <MapPin size={14} />
                        <span className="truncate">{tour.region || "—"}</span>
                      </div>
                    </div>
                    <div className={`transform transition-transform ${expandedTour === tour.id ? "rotate-180" : ""}`}>
                      <ChevronDown className="w-6 h-6 text-white" />
                    </div>
                  </div>

                  {/* Kennzahlen */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-blue-800/30 rounded-lg p-2 text-center">
                      <div className="text-blue-200 text-xs mb-1">Stopps</div>
                      <div className="text-white font-bold text-lg">{stops}</div>
                    </div>
                    <div className="bg-blue-800/30 rounded-lg p-2 text-center">
                      <div className="text-blue-200 text-xs mb-1">Distanz</div>
                      <div className="text-white font-bold text-lg">{tour.distance || 0} km</div>
                    </div>
                    <div className="bg-blue-800/30 rounded-lg p-2 text-center">
                      <div className="text-blue-200 text-xs mb-1">Gewicht</div>
                      <div className="text-white font-bold text-lg">{tour.weight || 0} kg</div>
                    </div>
                  </div>

                  {/* Zeitstempel */}
                  <div className="flex items-center gap-2 text-blue-100 text-xs">
                    <Clock size={12} />
                    <span>Aktualisiert: {new Date(tour.updatedAt || tour.createdAt || Date.now()).toLocaleString("de-DE")}</span>
                  </div>
                </div>

                {/* Bestellungen */}
                {expandedTour === tour.id && (
                  <div className="p-4 space-y-3">
                    {(tour.orders || []).map((order, idx) => {
                      const imgs = Array.isArray(order.images) ? order.images : [];
                      return (
                        <div key={order.id ?? `o-${idx}`} className="bg-gray-50 rounded-xl overflow-hidden">
                          <div className="p-4">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">{idx + 1}</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 truncate">{order.customerName || order.customer || "Kunde"}</div>
                                <div className="text-sm text-gray-500">{order.zip} {order.city}</div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="font-bold text-gray-900">{order.weight || 0} kg</div>
                                {imgs.length > 0 && (
                                  <div className="text-xs text-green-600 flex items-center gap-1 justify-end">
                                    <Camera size={12} />
                                    <span>{imgs.length}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Upload */}
                            <label className="block mt-2 w-full p-3 bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl text-center cursor-pointer active:bg-blue-100">
                              <input
                                type="file" accept="image/*" capture="environment" multiple
                                className="hidden"
                                onChange={(e) => handleImageUpload(tour.id, order.id, e)}
                              />
                              <Camera className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                              <span className="text-sm font-medium text-blue-700">Foto hinzufügen</span>
                            </label>

                            {/* Bilder */}
                            {imgs.length > 0 && (
                              <div className="grid grid-cols-2 gap-2 mt-3">
                                {imgs.map(img => (
                                  <div key={img.id} className="relative">
                                    <img src={img.dataUrl} alt="Sendung" className="w-full h-32 object-cover rounded-lg" />
                                    <div className="absolute bottom-1 left-1 right-1 bg-black/60 text-white text-[10px] px-2 py-1 rounded">{img.timestamp}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Verladen */}
                    <button
                      onClick={() => openLoadingModal(tour.id)}
                      className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg shadow active:bg-green-700 flex items-center justify-center gap-2"
                    >
                      <Check size={22} strokeWidth={3} />
                      Verladen markieren
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Archiv */}
      {activeTab === "archive" && (
        <div className={`${embedded ? "px-0" : "px-4"} py-4 space-y-4`}>
          {(archivedTours || []).length === 0 ? (
            <div className={`bg-white rounded-2xl p-8 text-center ${embedded ? "snap-start shadow-sm" : ""}`}>
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Keine archivierten Touren</p>
            </div>
          ) : (archivedTours || []).map(t => (
            <div key={t.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden ${embedded ? "snap-start" : ""}`}>
              <div className="bg-gradient-to-r from-gray-600 to-gray-700 p-4 text-white">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-1">{t.name || "Tour"}</h3>
                    <div className="flex items-center gap-2 text-gray-200 text-sm">
                      <MapPin size={14} />
                      <span className="truncate">{t.region || "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-gray-800/30 rounded-lg p-2 text-center">
                    <div className="text-gray-300 text-xs mb-1">Stopps</div>
                    <div className="text-white font-bold">{(t.orders || []).length}</div>
                  </div>
                  <div className="bg-gray-800/30 rounded-lg p-2 text-center">
                    <div className="text-gray-300 text-xs mb-1">Distanz</div>
                    <div className="text-white font-bold">{t.distance || 0} km</div>
                  </div>
                  <div className="bg-gray-800/30 rounded-lg p-2 text-center">
                    <div className="text-gray-300 text-xs mb-1">Gewicht</div>
                    <div className="text-white font-bold">{t.weight || 0} kg</div>
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-xs text-gray-200">
                  <div className="flex items-center gap-2"><Clock size={12} /> <span>Verladen: {t.loadedAt || "—"}</span></div>
                  {t.warehouseNote && <div className="opacity-90">Notiz: {t.warehouseNote}</div>}
                </div>
              </div>

              <div className="p-4 space-y-3">
                {/* Tour-Foto */}
                {t.loadImage?.dataUrl && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Tour-Foto</div>
                    <div className="relative">
                      <img src={t.loadImage.dataUrl} alt="Verladenes Fahrzeug" className="w-full h-48 object-cover rounded-lg" />
                      <div className="absolute bottom-2 left-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        {t.loadImage.timestamp}
                      </div>
                    </div>
                  </div>
                )}

                {/* Stop-Übersicht */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Stops ({(t.orders || []).length})</div>
                  <div className="space-y-2">
                    {(t.orders || []).map((o, i) => (
                      <div key={o.id ?? `ao-${i}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-6 h-6 bg-gray-400 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">{o.customerName || o.customer || "Kunde"}</div>
                          <div className="text-xs text-gray-500">{o.zip} {o.city}</div>
                        </div>
                        <div className="text-right flex-shrink-0 font-bold text-gray-900 text-sm">{o.weight || 0} kg</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Zurücknehmen */}
                <button
                  onClick={() => unloadTour(t.id)}
                  className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold shadow active:bg-orange-700 flex items-center justify-center gap-2"
                >
                  <Undo size={20} />
                  Tour zurücknehmen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal „Verladen“ */}
      {showLoadingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Tour verladen</h3>
            <p className="text-gray-600 mb-4">Optional: Foto aufnehmen und Notiz an die Dispo.</p>

            {/* Upload Tour-Foto */}
            <label className="block w-full p-4 bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl text-center cursor-pointer active:bg-blue-100 mb-4">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleTourLoadImageUpload} />
              <Camera className="w-7 h-7 text-blue-600 mx-auto mb-2" />
              <span className="text-sm font-medium text-blue-700">
                {tourLoadImage ? "Foto ändern" : "Foto aufnehmen (optional)"}
              </span>
            </label>

            {/* Notiz */}
            <textarea
              value={tourNote}
              onChange={e => setTourNote(e.target.value)}
              rows={3}
              className="w-full border rounded-xl p-3 text-sm mb-4 outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Notiz an die Dispo (optional)…"
            />

            {/* Preview */}
            {tourLoadImage?.dataUrl && (
              <div className="relative mb-4">
                <img src={tourLoadImage.dataUrl} alt="Tour geladen" className="w-full h-48 object-cover rounded-lg" />
                <div className="absolute bottom-2 left-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">{tourLoadImage.timestamp}</div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => setShowLoadingModal(null)} className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium active:bg-gray-300">
                Abbrechen
              </button>
              <button onClick={confirmMarkAsLoaded} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-bold active:bg-green-700">
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
