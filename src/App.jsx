// src/App.jsx
import WarehouseView from "./WarehouseView.jsx";
import SaveControls from "./SaveControls.jsx";
import MobileHeader from "./components/MobileHeader.jsx";
import MobileDrawer from "./components/MobileDrawer.jsx";
import { useAutosave } from "./autosave.js";
import { optimizeRemote } from "./optimizerClient.js";
import React from "react";
import Analytics from "./Analytics.jsx";
import {
  Truck, Package, Archive, FileText, Plus, Search, MapPin, Settings,
  Menu, X, Map as MapIcon, Download, Trash2, Copy, Lock, Unlock, Navigation,
  MoreVertical, ChevronDown, LogOut, Shield, Sparkles, GripVertical,
  BarChart3
} from "lucide-react";

import { useAuth } from "./AuthContext.jsx";
import AdminPanel from "./admin/AdminPanel.jsx";

import { cmrForStop, cmrForTour, cmrSaveStop, cmrSaveTour } from "./cmr.js";
import CmrLayoutEditor from "./CmrLayoutEditor.jsx";

import { geocodeAddress, geocodeZipCity } from "./geocode.js";
import { nearestNeighborOrder, twoOptImprove, computeTourStats } from "./routing.js";

/************************************************************
 * Klein-Toast
 ************************************************************/
function ensureToastRoot() {
  if (typeof document === "undefined") return null;
  let root = document.getElementById("toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "toast-root";
    Object.assign(root.style, {
      position: "fixed", top: "16px", right: "16px",
      display: "flex", flexDirection: "column", gap: "8px", zIndex: 999999,
    });
    document.body.appendChild(root);
  }
  return root;
}
function safeToast(message, variant = "info", ms = 2600) {
  const root = ensureToastRoot(); if (!root) return;
  const el = document.createElement("div");
  const colors = {
    success: { bg: "#10b981", fg: "#fff" },
    error:   { bg: "#ef4444", fg: "#fff" },
    info:    { bg: "#3b82f6", fg: "#fff" },
  }[variant] || { bg: "#374151", fg: "#fff" };
  Object.assign(el.style, {
    background: colors.bg, color: colors.fg, borderRadius: "10px",
    padding: "10px 12px",
    boxShadow: "0 10px 20px rgba(0,0,0,.12), 0 6px 6px rgba(0,0,0,.10)",
    font: "14px/1.25 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Ubuntu,sans-serif",
    maxWidth: "360px", wordBreak: "break-word", opacity: "0",
    transform: "translateY(-6px)", transition: "opacity .15s ease, transform .15s ease",
  });
  el.textContent = String(message || "");
  root.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
  const remove = () => { el.style.opacity = "0"; el.style.transform = "translateY(-6px)"; setTimeout(() => el.remove(), 180); };
  const t = setTimeout(remove, ms);
  el.addEventListener("click", () => { clearTimeout(t); remove(); });
}
const toast = {
  success: (m) => safeToast(m, "success"),
  error:   (m) => safeToast(m, "error"),
  info:    (m) => safeToast(m, "info"),
};
if (typeof window !== "undefined") window.safeToast = safeToast;

/************************************************************
 * Settings & Helper
 ************************************************************/
const DEFAULT_START_ADDRESS = "Ostring 3, 33181 Bad Wünnenberg";
const MAX_STOPS  = 12;
const MAX_WEIGHT = 1300;

function encodeForMaps(o) {
  const destText = `${o.zip || ""} ${o.city || ""}`.trim() || o.customerName || "";
  return encodeURIComponent(destText);
}
function openStopInMaps(startAddress, stop) {
  const origin = encodeURIComponent(startAddress || DEFAULT_START_ADDRESS);
  const destination = encodeForMaps(stop);
  const url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${origin}&destination=${destination}`;
  window.open(url, "_blank", "noopener");
}
function openTourInMaps(startAddress, orders = []) {
  if (!orders.length) return;
  const origin = encodeURIComponent(startAddress || DEFAULT_START_ADDRESS);
  const waypoints = orders.slice(0, -1).map(encodeForMaps).join("|");
  const destination = encodeForMaps(orders[orders.length - 1]);
  const url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${origin}${
    waypoints ? `&waypoints=${waypoints}` : ""
  }&destination=${destination}`;
  window.open(url, "_blank", "noopener");
}

/************************************************************
 * CSV utils
 ************************************************************/
function normalize(h) {
  return String(h || "")
    .toLowerCase()
    .replaceAll("ä", "ae").replaceAll("ö", "oe").replaceAll("ü", "ue").replaceAll("ß", "ss")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/__+/g, "_");
}
function toNumberLocale(v) {
  if (v == null) return 0;
  let s = String(v).trim().replace(/\s/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  s = s.replace(/[^0-9.-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function parseCsvRobust(text) {
  const comma = (text.match(/,/g) || []).length;
  const semi  = (text.match(/;/g) || []).length;
  const sep   = semi > comma ? ";" : ",";

  const lines = []; let i = 0, field = "", row = [], inQ = false;
  const pushF = ()=>{ row.push(field); field=""; };
  const pushR = ()=>{ if (row.length) lines.push(row); row=[]; };
  const s = String(text || "").replace(/\r\n?|\n/g, "\n");

  while (i < s.length) {
    const ch = s[i];
    if (inQ) {
      if (ch === "\"") { if (s[i+1] === "\"") { field+="\""; i+=2; continue; } inQ = false; i++; continue; }
      field += ch; i++; continue;
    }
    if (ch === "\"") { inQ = true; i++; continue; }
    if (ch === sep) { pushF(); i++; continue; }
    if (ch === "\n") { pushF(); pushR(); i++; continue; }
    field += ch; i++;
  }
  pushF(); pushR();

  if (!lines.length) return { headers: [], rows: [] };

  const headersRaw  = lines[0].map(h => (h || "").trim());
  const headersNorm = headersRaw.map(normalize);
  const rowsRaw = lines.slice(1).filter(r => r.some(c => String(c).trim() !== ""));

  const rows = rowsRaw.map(cells => {
    const o = {}; headersNorm.forEach((hn, idx) => { o[hn] = (cells[idx] ?? "").toString().trim(); });

    const pick = (...keys)=>{ for (const k of keys) if (o[k]!=null && o[k]!=="") return o[k]; return ""; };

    const customerName = pick("name_1_auftraggeber","name_2_auftraggeber","empfaenger","empfänger","kunde","customer","name");
    const customerNr   = pick("auftraggeber","kunden-nr","kunden_nr","kundennr","kd-nr");
    const zip          = pick("plz_lieferanschrift","plz","postleitzahl");
    const city         = pick("ort_lieferanschrift","city","ort","stadt");
    const country      = pick("land_lieferanschrift_bezeichnung","land_lieferanschrift_wert") || "Deutschland";
    const region       = pick("gebiet","region");
    const weight       = toNumberLocale(pick("gesamtgewicht_in_kg","bruttogewicht","gewicht","kg","weight"));
    const dlvRaw       = pick("belegnummer","ihre_belegnummer","vorgang","auftrag_id","auftrag");
    const docTypeRaw   = pick("belegart","belegart_text","dokumentenart","doctype","beleg_typ");
    const docTypeNorm  = normalize(docTypeRaw);

    const rowId        = pick("auftrag","auftrag_id","belegnummer") || Math.random().toString(36).slice(2,8);

    return { rowId, customerName, customerNr, zip, city, countryDelivery: country, region, weight, deliveryNoteNumberRaw: dlvRaw, docTypeRaw, docTypeNorm };
  });

  // Nur "Lieferschein" akzeptieren (nicht "Strecken-Lieferschein")
  const filtered = rows.filter(r => r.docTypeNorm === "lieferschein");

  return { headers: headersRaw, rows: filtered };
}

/************************************************************
 * Tours normalisieren
 ************************************************************/
function normalizePlannedTours(input) {
  const arr = Array.isArray(input) ? input : [];
  return arr.map((t, i) => {
    const orders = Array.isArray(t?.orders)
      ? t.orders
      : (Array.isArray(t?.stops) ? t.stops : []);
    return {
      id: t?.id ?? `tour_${Date.now()}_${i}`,
      name: t?.name ?? t?.title ?? `Tour ${i + 1}`,
      status: t?.status ?? "active",
      orders,
      ...t,
    };
  });
}

/****************
 * Haupt-App
 ****************/
export default function App() {
  const { user, logout } = useAuth();

  // Rollen-Handling
  const resolvedUser = React.useMemo(() => {
    if (user && typeof user === "object") return user;
    if (typeof window === "undefined") return null;
    try {
      const raw =
        window.localStorage?.getItem("auth:user") ||
        window.localStorage?.getItem("user");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [user]);
  const normalizedRoles = React.useMemo(() => {
    const list = [];
    if (Array.isArray(resolvedUser?.roles)) list.push(...resolvedUser.roles);
    if (resolvedUser?.role) list.push(resolvedUser.role);
    const seen = new Set();
    const normalized = list
      .map((r) => String(r || "").toLowerCase())
      .filter((r) => r && !seen.has(r) && (seen.add(r), true));
    return normalized.length ? normalized : ["dispo"];
  }, [resolvedUser]);
  const role = normalizedRoles[0] || "dispo";
  const isAdmin = normalizedRoles.includes("admin");
  const isDispo = normalizedRoles.includes("dispo");
  const isLager = normalizedRoles.includes("lager");
  const isWarehouseStandalone = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    const s = new URLSearchParams(window.location.search);
    return s.get("warehouse") === "1" || window.location.pathname === "/lager";
  }, []);
  const isLagerMode = isLager || isWarehouseStandalone;

  // UI/Navigation
  const [activeView, setActiveView] = React.useState("expedition");
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [expandedOrders, setExpandedOrders] = React.useState({});
  const [showTourMenu, setShowTourMenu] = React.useState(null);
  const [query, setQuery] = React.useState("");
  const [useAi, setUseAi] = React.useState(true);
  const [isPlanning, setIsPlanning] = React.useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);
  const fileRef = React.useRef(null);

  // Admin-Panel ohne URL-Wechsel
  const [showAdmin, setShowAdmin] = React.useState(false);
  React.useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
      setShowAdmin(true);
      window.history.replaceState(null, "", "/");
    }
  }, []);

  // CMR-Speicherliste
  const [savedCmrs, setSavedCmrs] = React.useState([]);
  React.useEffect(() => {
    const onSaved = (e) => setSavedCmrs(prev => [e.detail, ...prev]);
    document.addEventListener("cmr:saved", onSaved);
    window.addEventListener("cmr:saved", onSaved);
    return () => { document.removeEventListener("cmr:saved", onSaved); window.removeEventListener("cmr:saved", onSaved); };
  }, []);
  const deleteSavedCmr = (id) => setSavedCmrs(prev => {
    const it = prev.find(x => x.id === id); if (it) URL.revokeObjectURL(it.href);
    return prev.filter(x => x.id !== id);
  });
  const formatBytes = (b) => {
    if (!b) return "---";
    const u = ["B","KB","MB","GB"]; let i=0, n=b;
    while (n>1024 && i<u.length-1) { n/=1024; i++; }
    return n.toFixed(i?1:0)+" "+u[i];
  };

  // Daten-States
  const [orders, setOrders] = React.useState([]);
  const [tours, setTours] = React.useState([]);
  const [archivedTours, setArchivedTours] = React.useState([]);
  const [settings, setSettings] = React.useState({});

  const [lastAutoSaveAt, setLastAutoSaveAt] = React.useState(null);
  const [lastManualSaveAt, setLastManualSaveAt] = React.useState(null);

  // abgeleitet
  const activeToursCount = React.useMemo(() => {
    return Array.isArray(tours) ? tours.filter(t => t?.status === "active").length : 0;
  }, [tours]);

  const visibleTours = React.useMemo(() => {
    if (!Array.isArray(tours)) return [];
    const hasStatus = tours.some(t => t && t.status);
    return hasStatus ? tours.filter(t => t.status === "active") : tours;
  }, [tours]);

  // Optimizer-URL
  const OPT_URL = (import.meta.env?.VITE_OPTIMIZER_URL || "http://localhost:8001").replace(/\/+$/, "");

  // Manuelles Speichern (lokal + optional Festplatte)
  async function handleManualSave() {
    const snap = {
      orders, tours, settings, archivedTours,
      _meta: { savedAt: Date.now(), type: "manual" },
    };
    const json = JSON.stringify(snap);

    try { localStorage.setItem("navio/manual/v1", json); } catch {}

    try {
      await fetch(`${OPT_URL}/save?bucket=manual&key=navio.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: json,
      });
    } catch {}

    setLastManualSaveAt(snap._meta.savedAt);
  }

  // Neueste Sicherung laden (manuell ODER autosave)
  async function handleLoadLatest() {
    let autosave = null, manual = null;

    try { const raw = localStorage.getItem("navio/autosave/v1"); if (raw) autosave = JSON.parse(raw); } catch {}
    try { const raw = localStorage.getItem("navio/manual/v1");  if (raw) manual   = JSON.parse(raw); } catch {}

    const pick = (() => {
      const at = autosave?._meta?.savedAt || 0;
      const mt = manual?._meta?.savedAt   || 0;
      if (mt > at) return manual;
      if (at > 0)  return autosave;
      return null;
    })();

    if (!pick) { alert("Kein gespeicherter Stand gefunden."); return; }

    if (Array.isArray(pick.orders))        setOrders(pick.orders);
    if (Array.isArray(pick.tours))         setTours(pick.tours);
    if (Array.isArray(pick.archivedTours)) setArchivedTours(pick.archivedTours);
    if (pick.settings)                     setSettings(pick.settings);

    setActiveView("tours");
  }

  // === stabile Callbacks für useAutosave ===
  const handleAutosaveRestore = React.useCallback((p) => {
    if (Array.isArray(p?.orders))        setOrders(p.orders);
    if (Array.isArray(p?.tours))         setTours(p.tours);
    if (Array.isArray(p?.archivedTours)) setArchivedTours(p.archivedTours);
    if (p?.settings)                     setSettings(p.settings);
  }, [setOrders, setTours, setArchivedTours, setSettings]);

  const handleAutosaveSaved = React.useCallback((ts) => {
    setLastAutoSaveAt(ts);
  }, [setLastAutoSaveAt]);

  // Autosave (lokal + optional Server-Datei)
  const { saveNow: triggerAutosave } = useAutosave({
    storageKey: "navio/autosave/v1",
    data: { orders, tours, settings, archivedTours },
    restoreOnMount: true,
    saveEveryMs: 5 * 60 * 1000, // 5 Minuten
    shouldSave: (d) =>
      (Array.isArray(d.tours) && d.tours.length > 0) ||
      (Array.isArray(d.orders) && d.orders.length > 0) ||
      (Array.isArray(d.archivedTours) && d.archivedTours.length > 0) ||
      (d.settings && Object.keys(d.settings).length > 0),
    onRestore: handleAutosaveRestore,
    onSaved:   handleAutosaveSaved,
    remoteUrl: import.meta.env.VITE_ENABLE_REMOTE_SAVE === 'true'
      ? `${OPT_URL}/save?bucket=autosave&key=navio.json`
      : null,
  });

  // === Drag & Drop (innerhalb von App) ===
  const [dragInfo, setDragInfo] = React.useState(null);         // { tourId, fromIdx }
  const [dragHoverKey, setDragHoverKey] = React.useState(null); // `${tourId}-${idx}`

  function arrayMove(arr, from, to) {
    const a = arr.slice();
    const [it] = a.splice(from, 1);
    a.splice(to, 0, it);
    return a;
  }
  function recomputeTourFast(tour, newOrders) {
    const weight = newOrders.reduce((s, o) => s + Number(o?.weight || 0), 0);
    return { ...tour, orders: newOrders, weight, stops: newOrders.length };
  }
  async function recomputeTourAccurate(tourId, orders) {
    try {
      const startCoord = await geocodeAddress(DEFAULT_START_ADDRESS, { timeoutMs: 5000 });
      const hasAnyCoord = orders.some(o => !!o.__coord);
      if (!startCoord || !hasAnyCoord) return;
      const stats = computeTourStats(startCoord, orders, (x) => x.__coord, 1.0);
      setTours(prev => prev.map(t =>
        t.id === tourId
          ? { ...t, stops: stats.stops, distance: stats.distance, cost: stats.cost, weight: stats.weight }
          : t
      ));
    } catch { /* ok */ }
  }
  async function reorderStops(tourId, fromIdx, toIdx) {
    // 1) Sofort Reihenfolge + Basis-Stats aktualisieren
    setTours(prev => prev.map(t => {
      if (t.id !== tourId) return t;
      const newOrders = arrayMove(t.orders || [], fromIdx, toIdx);
      return recomputeTourFast(t, newOrders);
    }));

    // 2) Exakte Distanz/Kosten nachziehen (optional) + Autosave
    const tour = tours.find(t => t.id === tourId);
    const baseOrders = tour?.orders || [];
    const newOrders = arrayMove(baseOrders, fromIdx, toIdx);
    recomputeTourAccurate(tourId, newOrders);

    try { triggerAutosave?.(); } catch {}

    // 3) DnD-State zurücksetzen
    setDragInfo(null);
    setDragHoverKey(null);
  }

  // Logout
  const handleLogout = async () => {
    setMobileDrawerOpen(false);
    try {
      await logout?.();
    } finally {
      localStorage.removeItem("auth");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("auth:user");
      sessionStorage.clear();
      toast.info("Abgemeldet"); setTimeout(()=>{ window.location.href = "/"; }, 350);
    }
  };

  // CSV
  const handleCsvClick = () => fileRef.current && fileRef.current.click();
  const handleCsvChange = async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const text = await f.text(); const parsed = parseCsvRobust(text);
    setOrders(parsed.rows); setActiveView("expedition"); setShowAdmin(false);
    safeToast(`Importiert: ${parsed.rows.length} Lieferscheine`, "success");
  };

  /** --- Helper: limitierte Parallelverarbeitung --- **/
  async function mapPool(arr, limit, fn) {
    const out = new Array(arr.length);
    let i = 0;
    const workers = Array.from({ length: Math.min(limit, arr.length) }, () => (async () => {
      while (true) {
        const idx = i++;
        if (idx >= arr.length) break;
        try { out[idx] = await fn(arr[idx], idx); } catch { out[idx] = undefined; }
      }
    })());
    await Promise.all(workers);
    return out;
  }

  // --- Geografische Planung (mit/ohne KI/Optimizer) ---
  async function planToursGeographically(sourceOrders) {
    // 1) Start koordinieren
    const startCoord = await geocodeAddress(DEFAULT_START_ADDRESS, { timeoutMs: 6500 });
    if (!startCoord) throw new Error("Startadresse konnte nicht geokodiert werden.");

    // 2) Alle Orders geokodieren – parallel (Limit 4), Timeout pro Request
    const mapped = await mapPool(sourceOrders, 4, async (o) => {
      const c = await geocodeZipCity(o.zip, o.city, o.countryDelivery || "Deutschland", { timeoutMs: 6500, jitter: true });
      if (c) return { ...o, __coord: c };
      return null;
    });
    const withCoord = mapped.filter(Boolean);
    if (!withCoord.length) throw new Error("Keine gültigen Adressen/PLZ gefunden.");

    // Helper: Packe Aufträge in Touren nach Gewicht/Stopps
    function partitionByWeight(ordered, maxWeight, maxStops) {
      const out = [];
      let cur = []; let w = 0;
      for (const it of ordered) {
        const iw = Number(it.weight || 0);
        const nextStops = cur.length + 1;
        const overflow = (w + iw > maxWeight) || (nextStops > maxStops);
        if (overflow) {
          if (cur.length) out.push(cur);
          cur = []; w = 0;
        }
        if (iw > maxWeight) { // einzelner Auftrag über Limit -> eigene Tour
          out.push([it]);
          continue;
        }
        cur.push(it); w += iw;
      }
      if (cur.length) out.push(cur);
      return out;
    }

    // 3) Optimizer (KI) oder lokale Heuristik
    if (useAi) {
      try {
        const opt = await optimizeRemote({
          depot: startCoord,
          orders: withCoord,
          maxStops: MAX_STOPS,
          maxWeight: MAX_WEIGHT,
          vehicles: null,
        });

        const idToOrder = new globalThis.Map(withCoord.map(o => [o.rowId || o.id, o]));
        const built = (opt?.tours || []).map((t, idx) => {
          const ordered = (t.order_ids || []).map(id => idToOrder.get(id)).filter(Boolean);
          const stats = computeTourStats(startCoord, ordered, (x)=>x.__coord, 1.0);
          return {
            id: Date.now() + idx,
            name: `Kleiner Polensprinter ${idx + 1}`,
            region: "Auto",
            startPoint: DEFAULT_START_ADDRESS,
            stops: stats.stops,
            distance: stats.distance,
            cost: stats.cost,
            weight: stats.weight,
            maxWeight: MAX_WEIGHT,
            orders: ordered,
            status: "active",
            locked: false
          };
        });

        if (built.length && built.every(t => Array.isArray(t.orders) && t.orders.length)) {
          return built;
        }
      } catch (e) {
        console.warn("KI-Optimierung fehlgeschlagen, lokale Heuristik wird genutzt:", e);
      }
    }

    // --- Lokale Heuristik ---
    const initial = nearestNeighborOrder(startCoord, withCoord, (x)=>x.__coord);
    const chunks  = partitionByWeight(initial, MAX_WEIGHT, MAX_STOPS);
    const tours   = chunks.map((chunk, idx) => {
      const improved = twoOptImprove(startCoord, chunk, (x)=>x.__coord, 200);
      const stats = computeTourStats(startCoord, improved, (x)=>x.__coord, 1.0);
      const overweight = improved.length === 1 && Number(improved[0]?.weight || 0) > MAX_WEIGHT;
      return {
        id: Date.now() + idx,
        name: `Kleiner Polensprinter ${idx + 1}`,
        region: "Auto",
        startPoint: DEFAULT_START_ADDRESS,
        stops: stats.stops,
        distance: stats.distance,
        cost: stats.cost,
        weight: stats.weight,
        maxWeight: MAX_WEIGHT,
        orders: improved,
        status: "active",
        locked: false,
        weightOverLimit: overweight || undefined,
      };
    });

    return tours;
  }

  // Button-Aktion: Auto-Plan
  const onAutoPlan = async () => {
    const hasOrders = Array.isArray(orders) && orders.length > 0;
    if (!hasOrders) { safeToast("Keine Bestellungen vorhanden. CSV importieren oder manuell hinzufügen.", "error"); return; }

    const planningLabel = useAi ? "NavioAI plant…" : "Plant…";
    safeToast(planningLabel, "info");

    try {
      const plannedRaw = await planToursGeographically(orders);
      const planned = Array.isArray(plannedRaw?.tours) ? plannedRaw.tours : (Array.isArray(plannedRaw) ? plannedRaw : []);
      const normalized = normalizePlannedTours(planned);
      const stamped = normalized.map(t => ({ ...t, createdAt: t.createdAt || new Date().toISOString() }));
      setTours(stamped);

      // sofort Snapshot speichern
      triggerAutosave?.();

      // Tab erst nach State-Update wechseln
      requestAnimationFrame(() => {
        setActiveView("tours");
        setShowAdmin(false);
      });

      safeToast("Geplante Touren: " + normalized.length, "success");
    } catch (e) {
      console.error(e);
      safeToast("Planung fehlgeschlagen: " + (e?.message || "Unbekannter Fehler"), "error");
    }
  };

  const toggleOrder = (tourId, orderIdx) => setExpandedOrders(prev => ({ ...prev, [tourId+"-"+orderIdx]: !prev[tourId+"-"+orderIdx] }));
  const toggleLock  = (tourId) => setTours(prev => prev.map(t => t.id===tourId ? ({...t, locked:!t.locked}) : t));
  const markLoaded  = (tourId) => {
    const t = tours.find(x => x.id===tourId); if (!t) return;
    setTours(prev => prev.filter(x => x.id!==tourId));
    setArchivedTours(a => [{
      id: Number(String(tourId)+Math.floor(Math.random()*100)),
      name:t.name, region:t.region, weight:t.weight, maxWeight:t.maxWeight,
      date: new Date().toLocaleString("de-DE", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit" }),
      archivedAt: new Date().toISOString(),
      orders:t.orders, startPoint:t.startPoint, locked:true, distance:t.distance, cost:t.cost, stops:t.stops
    }, ...a]);
    safeToast("Tour ins Archiv verschoben", "info");
  };
  const undoLoaded = async (archId) => {
    const t = archivedTours.find(x => x.id===archId); if (!t) return;
    setArchivedTours(prev => prev.filter(x => x.id!==archId));

    const startCoord = await geocodeAddress(t.startPoint || DEFAULT_START_ADDRESS, { timeoutMs: 6500 });
    const mapped = await mapPool(t.orders, 4, async (o) => {
      const c = await geocodeZipCity(o.zip, o.city, o.countryDelivery || "Deutschland", { timeoutMs: 6500, jitter: true });
      return { ...o, __coord: c || null };
    });

    const stats = computeTourStats(startCoord, mapped, (x)=>x.__coord || startCoord, 1.0);

    setTours(ts => [{
      id: Date.now(), name:t.name, region:t.region, startPoint:t.startPoint || DEFAULT_START_ADDRESS,
      stops: stats.stops, distance: stats.distance, cost: stats.cost, weight: stats.weight, maxWeight:t.maxWeight,
      orders:t.orders, status:"active", locked:false
    }, ...ts]);
    safeToast("Tour zurückgeholt", "info");
  };
  const copyTour = (tour) => { const clone = JSON.parse(JSON.stringify(tour)); clone.id = Date.now(); clone.locked = false; setTours(prev => [clone, ...prev]); safeToast("Tour kopiert", "success"); };

  // ====== LAGER-KIOSK: Rolle 'lager' ODER /lager/?warehouse=1 ======
  if (isLagerMode) {
    const openDrawer = () => setMobileDrawerOpen(true);
    const closeDrawer = () => setMobileDrawerOpen(false);
    const drawerRole = isLager ? role : "lager";

    return (
      <div className="flex min-h-screen flex-col bg-slate-100">
        <MobileDrawer
          open={mobileDrawerOpen}
          onClose={closeDrawer}
          onLogout={handleLogout}
          user={resolvedUser}
          role={drawerRole}
        />
        <MobileHeader onMenuToggle={openDrawer} />

        <main className="flex-1 overflow-y-auto snap-y snap-mandatory">
          <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-16 pt-4">
            <WarehouseView
              embedded
              tours={tours}
              setTours={setTours}
              archivedTours={archivedTours}
              setArchivedTours={setArchivedTours}
            />
          </div>
        </main>
      </div>
    );
  }

  // ====== ADMIN/DISPO Layout ======
  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <div className={(sidebarOpen ? "w-64" : "w-20") + " bg-slate-800 text-white transition-all duration-300 flex flex-col"}>
        <div className="p-4 flex items-center justify-between border-b border-slate-700">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <img src="/brand/navio_ai_mark_dark_tile.svg" alt="Navio AI" className="w-6 h-6 rounded-md" draggable={false}/>
              <span className="font-bold text-lg">Tourenplanung</span>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-700 rounded-lg">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => { setActiveView("expedition"); setShowAdmin(false); }}
            className={"w-full flex items-center gap-3 p-3 rounded-lg transition-colors "+(!showAdmin && activeView==="expedition" ? "bg-blue-600 text-white" : "hover:bg-slate-700")}
          >
            <Package size={20} /> {sidebarOpen && <span>Bestellungen</span>}
          </button>

          <button
            onClick={() => { setActiveView("tours"); setShowAdmin(false); }}
            className={"w-full flex items-center gap-3 p-3 rounded-lg transition-colors "+(!showAdmin && activeView==="tours" ? "bg-blue-600 text-white" : "hover:bg-slate-700")}
          >
            <MapIcon size={20} /> {sidebarOpen && <span>Touren</span>}
          </button>

          <button
            onClick={() => { setActiveView("archive"); setShowAdmin(false); }}
            className={"w-full flex items-center gap-3 p-3 rounded-lg transition-colors "+(!showAdmin && activeView==="archive" ? "bg-blue-600 text-white" : "hover:bg-slate-700")}
          >
            <Archive size={20} /> {sidebarOpen && <span>Archiv</span>}
          </button>

          <button
            onClick={() => { setActiveView("analytics"); setShowAdmin(false); }}
            className={"w-full flex items-center gap-3 p-3 rounded-lg transition-colors "+(!showAdmin && activeView==="analytics" ? "bg-blue-600 text-white" : "hover:bg-slate-700")}
          >
            <BarChart3 size={20} /> {sidebarOpen && <span>Analytics</span>}
          </button>

          {/* Lager-Menüpunkt NUR für Admin sichtbar */}
          {isAdmin && (
            <button
              onClick={() => { setActiveView("warehouse"); setShowAdmin(false); }}
              className={"w-full flex items-center gap-3 p-3 rounded-lg transition-colors "+(!showAdmin && activeView==="warehouse" ? "bg-blue-600 text-white" : "hover:bg-slate-700")}
            >
              <Navigation size={20} /> {sidebarOpen && <span>Lager</span>}
            </button>
          )}

          <button
            onClick={() => { setActiveView("reports"); setShowAdmin(false); }}
            className={"w-full flex items-center gap-3 p-3 rounded-lg transition-colors "+(!showAdmin && activeView==="reports" ? "bg-blue-600 text-white" : "hover:bg-slate-700")}
          >
            <FileText size={20} /> {sidebarOpen && <span>CMR & Berichte</span>}
          </button>

          {/* Benutzerverwaltung NUR für Admin */}
          {isAdmin && (
            <button
              onClick={() => setShowAdmin(true)}
              className={"w-full flex items-center gap-3 p-3 rounded-lg transition-colors "+(showAdmin ? "bg-blue-600 text-white" : "hover:bg-slate-700")}
              title="Benutzerverwaltung"
            >
              <Shield size={20} /> {sidebarOpen && <span>Benutzerverwaltung</span>}
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={() => { setActiveView("settings"); setShowAdmin(false); }}
            className={"w-full flex items-center gap-3 p-3 rounded-lg transition-colors "+(!showAdmin && activeView==="settings" ? "bg-blue-600 text-white" : "hover:bg-slate-700")}
          >
            <Settings size={20} /> {sidebarOpen && <span>Einstellungen</span>}
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors mt-2 hover:bg-slate-700 text-red-300 hover:text-red-100"
            title="Abmelden"
          >
            <LogOut size={20} /> {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              {showAdmin
                ? "Benutzerverwaltung"
                : activeView === "expedition" ? "Bestellungen"
                : activeView === "tours"      ? "Touren"
                : activeView === "archive"    ? "Archiv"
                : activeView === "analytics"  ? "Analytics"
                : activeView === "warehouse"  ? "Lager"
                : activeView === "reports"    ? "CMR & Berichte"
                : "Einstellungen / CMR Layout"}
            </h1>

            {!showAdmin && !isLager && (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="text-sm"><span className="text-gray-600">Touren:</span><span className="ml-2 font-bold text-blue-600">{activeToursCount}</span></div>
                  <div className="text-sm"><span className="text-gray-600">Archiviert:</span><span className="ml-2 font-bold text-gray-700">{archivedTours.length}</span></div>
                </div>

                {/* Speichern/Laden + Status */}
                <SaveControls
                  onSave={handleManualSave}
                  onLoad={handleLoadLatest}
                  lastAutoSaveAt={lastAutoSaveAt}
                  lastManualSaveAt={lastManualSaveAt}
                />
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {/* Admin */}
          {showAdmin && <AdminPanel />}

          {/* Rest ausblenden, wenn Admin offen */}
          <div className={showAdmin ? "hidden" : ""}>
            {/* --- Bestellungen --- */}
            {activeView === "expedition" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Truck className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">Neue Bestellungen</h2>
                        <p className="text-sm text-gray-500">Erstellen Sie automatisch optimierte Touren</p>
                      </div>
                    </div>

                    <button
                      onClick={() => { setOrders([]); setTours([]); setArchivedTours([]); }}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-2 text-sm"
                    >
                      <Trash2 size={18} /> Alle Daten löschen
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <button onClick={handleCsvClick}
                            className="p-4 border-2 border-blue-500 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 text-blue-600 font-medium">
                      <Download size={20} /> CSV-Datei hochladen
                    </button>
                    <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvChange} />

                    {/* PLAN-BUTTON */}
                    <button
                      onClick={async () => {
                        if (isPlanning) return;
                        setIsPlanning(true);
                        try { await onAutoPlan(); }
                        finally { setIsPlanning(false); }
                      }}
                      disabled={isPlanning}
                      aria-busy={isPlanning ? "true" : "false"}
                      className={
                        "relative p-4 rounded-xl transition-colors flex items-center justify-center gap-2 font-medium " +
                        (isPlanning
                          ? "border-2 border-green-500 bg-green-50 text-green-600 cursor-wait"
                          : "border-2 border-green-500 bg-green-50 text-green-600 hover:bg-green-100 cursor-pointer")
                      }
                    >
                      {isPlanning ? (
                        <>
                          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a 8 8 0 0 1 8-8v4A4 4 0 0 0 8 12H4z"></path>
                          </svg>
                          <span>{useAi ? "NavioAI plant…" : "Plant…"}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={20} />
                          <span>{useAi ? "KI: Touren geografisch planen" : "Touren automatisch planen"}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* KI Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl border border-purple-200 bg-purple-50">
                    <div>
                      <div className="font-semibold text-gray-900">KI-Optimierung</div>
                      <div className="text-sm text-gray-600">Geografisch optimierte Touren mit minimalen Fahrwegen</div>
                    </div>
                    <label className="inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={useAi} onChange={(e)=>setUseAi(e.target.checked)} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500 relative"></div>
                    </label>
                  </div>

                  {/* Schnellerfassung */}
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    <input type="text" id="quick-plz"  placeholder="PLZ*" className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    <input type="text" id="quick-kunde" placeholder="Kunde (Name)" className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    <input type="number" id="quick-kg"  placeholder="Gewicht (kg)*" className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    <input type="text" id="quick-id"   placeholder="Kunden-Nr."   className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>

                  <button
                    onClick={() => {
                      const plz   = document.getElementById("quick-plz")?.value?.trim();
                      const kunde = document.getElementById("quick-kunde")?.value?.trim();
                      const kg    = Number(document.getElementById("quick-kg")?.value);
                      const kidRaw= document.getElementById("quick-id")?.value?.trim();
                      const kid = kidRaw || Math.random().toString(36).slice(2,8);
                      if (!plz || !kg) return;
                      setOrders(prev => [{ rowId:kid, customerName:kunde || "Kunde", customerNr:kid, zip:plz, city:"", countryDelivery:"Deutschland", region:"", weight:kg, deliveryNoteNumberRaw:kid, docTypeNorm:"lieferschein" }, ...prev]);
                      safeToast("Bestellung hinzugefügt", "success");
                    }}
                    className="mt-4 w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    <Plus size={20} /> Bestellung hinzufügen
                  </button>
                </div>

                {/* Tabelle */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-lg">Bestellungen ({orders.length})</h3>
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input type="text" placeholder="Suchen..." className="pl-9 pr-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                             value={query} onChange={(e)=>setQuery(e.target.value)} />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">PLZ / Ort</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kunde</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kunden-Nr.</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Gewicht</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Aktion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {orders
                          .filter(o => {
                            const q = query.toLowerCase(); if (!q) return true;
                            return (o.customerName||"").toLowerCase().includes(q) ||
                                   (o.city||"").toLowerCase().includes(q) ||
                                   String(o.zip).includes(q) ||
                                   String(o.customerNr||"").toLowerCase().includes(q);
                          })
                          .map((order, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">{order.zip} {order.city}</div>
                              <div className="text-sm text-gray-500">{order.region ? "nähe "+order.region : ""}</div>
                            </td>
                            <td className="px-6 py-4 text-gray-900">{order.customerName}</td>
                            <td className="px-6 py-4 text-gray-700">{order.customerNr}</td>
                            <td className="px-6 py-4 font-semibold text-gray-900">{Number(order.weight||0).toLocaleString("de-DE")} kg</td>
                            <td className="px-6 py-4 space-x-3">
                              <button onClick={()=>openStopInMaps(DEFAULT_START_ADDRESS, order)} className="text-blue-600 hover:text-blue-700 font-medium text-sm">Navigation</button>
                              <button onClick={()=>cmrForStop(order)} className="text-gray-700 hover:text-gray-900 font-medium text-sm">CMR</button>
                              <button onClick={()=>cmrSaveStop(order)} className="text-green-700 hover:text-green-800 font-medium text-sm">CMR speichern</button>
                              <button onClick={()=>setOrders(prev => prev.filter((_,i)=>i!==idx))} className="text-red-600 hover:text-red-700 font-medium text-sm">Entfernen</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* --- Touren --- */}
            {activeView === "tours" && (
              <div className="space-y-4">
                {visibleTours.map(tour => (
                  <div key={tour.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-6 relative">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold text-white mb-2">{tour.name}</h3>
                          <div className="flex items-center gap-2 text-blue-100 text-sm">
                            <MapPin size={16} /><span>{tour.region} · {tour.startPoint || DEFAULT_START_ADDRESS}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={()=>toggleLock(tour.id)} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors" aria-label={tour.locked?"Unlock":"Lock"}>
                            {tour.locked ? <Unlock className="w-5 h-5 text-white"/> : <Lock className="w-5 h-5 text-white"/>}
                          </button>
                          <div className="relative">
                            <button onClick={()=>setShowTourMenu(showTourMenu===tour.id?null:tour.id)}
                                    className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors">
                              <MoreVertical className="w-5 h-5 text-white"/>
                            </button>
                            {showTourMenu===tour.id && (
                              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg py-2 z-10">
                                <button onClick={()=>openTourInMaps(tour.startPoint || DEFAULT_START_ADDRESS, tour.orders)}
                                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 text-gray-700">
                                  <Navigation size={18}/> Google Maps öffnen
                                </button>
                                <button onClick={()=>cmrForTour(tour)}
                                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 text-gray-700">
                                  <FileText size={18}/> CMR (Tour)
                                </button>
                                <button onClick={()=>cmrSaveTour(tour)}
                                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 text-gray-700">
                                  <FileText size={18}/> CMR speichern (Tour)
                                </button>
                                <button onClick={()=>copyTour(tour)}
                                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 text-gray-700">
                                  <Copy size={18}/> Tour kopieren
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-6">
                        <div><div className="text-blue-200 text-sm mb-1">Stopps</div><div className="text-3xl font-bold text-white">{tour.stops ?? (tour.orders?.length || 0)}</div></div>
                        <div><div className="text-blue-200 text-sm mb-1">Gesamt KM</div><div className="text-3xl font-bold text-white">{tour.distance ?? 0} km</div></div>
                        <div><div className="text-blue-200 text-sm mb-1">Kosten</div><div className="text-3xl font-bold text-white">{Number(tour.cost ?? 0).toFixed(2)} €</div></div>
                      </div>

                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-blue-100 text-sm">Ladung</span>
                          <span className="text-white font-semibold text-sm">{tour.weight ?? 0} kg / {tour.maxWeight ?? MAX_WEIGHT} kg</span>
                        </div>
                        <div className="w-full bg-blue-800/50 rounded-full h-3 overflow-hidden">
                          <div className="bg-gradient-to-r from-green-400 to-green-500 h-full rounded-full transition-all duration-300"
                               style={{ width: `${Math.min(100, ((tour.weight ?? 0) / (tour.maxWeight ?? MAX_WEIGHT)) * 100)}%` }}/>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-3">
                      {tour.orders.map((order, idx) => {
                        const hoverKey = `${tour.id}-${idx}`;
                        const isHover = dragHoverKey === hoverKey;
                        const draggable = !tour.locked;

                        return (
                          <div
                            key={idx}
                            className={
                              "bg-gray-50 rounded-xl overflow-hidden transition ring-offset-2 " +
                              (isHover ? "ring-2 ring-blue-400 " : "") +
                              (draggable ? "" : "opacity-60 ")
                            }
                            draggable={draggable}
                            onDragStart={(e) => {
                              if (!draggable) return;
                              setDragInfo({ tourId: tour.id, fromIdx: idx });
                              try {
                                e.dataTransfer.setData("text/plain", `${tour.id}:${idx}`);
                                e.dataTransfer.effectAllowed = "move";
                              } catch {}
                            }}
                            onDragOver={(e) => {
                              if (!dragInfo || dragInfo.tourId !== tour.id) return;
                              e.preventDefault();
                              setDragHoverKey(hoverKey);
                            }}
                            onDragLeave={() => {
                              setDragHoverKey((k) => (k === hoverKey ? null : k));
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragHoverKey(null);
                              if (!dragInfo || dragInfo.tourId !== tour.id) return;
                              const from = dragInfo.fromIdx;
                              const to = idx;
                              if (from === to) return;
                              reorderStops(tour.id, from, to);
                            }}
                            onDragEnd={() => {
                              setDragInfo(null);
                              setDragHoverKey(null);
                            }}
                          >
                            <div
                              className="p-4 flex items-center justify-between cursor-default"
                              style={{ cursor: draggable ? "grab" : "default" }}
                              onClick={() => toggleOrder(tour.id, idx)}
                            >
                              <div className="flex items-center gap-4 flex-1">
                                <div className="w-5 h-5 flex items-center justify-center text-gray-400">
                                  <GripVertical className="w-4 h-4" />
                                </div>

                                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg select-none">
                                  {idx + 1}
                                </div>

                                <div className="flex-1">
                                  <div className="font-semibold text-gray-900 text-lg">
                                    {order.zip} {order.city}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {order.region ? "nähe " + order.region : ""}
                                  </div>
                                  <div className="text-sm text-gray-700 mt-1">{order.customerName}</div>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="text-sm text-gray-500">Gewicht</div>
                                  <div className="text-xl font-bold text-gray-900">
                                    {Number(order.weight || 0).toLocaleString("de-DE")} kg
                                  </div>
                                </div>
                                <ChevronDown
                                  onClick={() => toggleOrder(tour.id, idx)}
                                  className={
                                    "w-5 h-5 text-gray-400 cursor-pointer " +
                                    (expandedOrders[tour.id + "-" + idx] ? "rotate-180" : "")
                                  }
                                />
                              </div>
                            </div>

                            {expandedOrders[tour.id + "-" + idx] && (
                              <div className="px-4 pb-4 grid grid-cols-3 gap-3">
                                <button
                                  onClick={() => openStopInMaps(tour.startPoint || DEFAULT_START_ADDRESS, order)}
                                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-colors font-medium"
                                >
                                  Navigation
                                </button>
                                <button
                                  onClick={() => cmrForStop(order)}
                                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
                                >
                                  CMR anzeigen
                                </button>
                                <button
                                  onClick={() => cmrSaveStop(order)}
                                  className="px-4 py-2 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-colors font-medium"
                                >
                                  CMR speichern
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="px-6 pb-6">
                      <button onClick={()=>markLoaded(tour.id)} className="w-full px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-semibold text-lg shadow-lg">
                        <Truck size={22}/> Verladen markieren
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* --- Archiv --- */}
            {activeView === "archive" && (
              <div className="space-y-4">
                {archivedTours.map(tour => (
                  <div key={tour.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-gray-700 px-6 py-5">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-white">{tour.name}</h3>
                          <p className="text-gray-300 text-sm mt-1">Region: {tour.region}</p>
                          <p className="text-gray-400 text-xs mt-1">Verladen am: {tour.date}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="px-4 py-2 bg-gray-600 rounded-xl text-center">
                            <div className="text-lg font-bold text-white">{tour.weight} kg</div>
                            <div className="text-xs text-gray-300">von {tour.maxWeight} kg</div>
                          </div>
                          <button onClick={()=>openStopInMaps(tour.startPoint || DEFAULT_START_ADDRESS, tour.orders[0] || {})} className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm">
                            <MapIcon size={16}/> Google Maps
                          </button>
                          <button onClick={()=>cmrForTour(tour)} className="px-4 py-2 bg-gray-800 text-white rounded-xl hover:bg-gray-900 transition-colors text-sm">
                            CMR (Tour)
                          </button>
                          <button onClick={()=>undoLoaded(tour.id)} className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-sm whitespace-nowrap">
                            Verladen zurücknehmen
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-3">
                      {tour.orders.map((order, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-gray-400 text-white rounded-full flex items-center justify-center font-bold text-sm">{idx+1}</div>
                            <div>
                              <div className="font-semibold text-gray-900">{order.customerName}</div>
                              <div className="text-sm text-gray-500">{order.zip} • {order.city}</div>
                            </div>
                          </div>
                          <span className="font-bold text-gray-900">{order.weight} kg</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* --- Analytics --- */}
            {activeView === "analytics" && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <Analytics tours={tours} archivedTours={archivedTours} />
              </div>
            )}

            {/* --- Lager (nur Admin sichtbar in Sidebar, hier renderbar wenn gewählt) */}
            {activeView === "warehouse" && isAdmin && (
              <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
                <WarehouseView
                  tours={tours}
                  setTours={setTours}
                  archivedTours={archivedTours}
                  setArchivedTours={setArchivedTours}
                />
              </div>
            )}

            {/* --- CMR & Berichte --- */}
            {activeView === "reports" && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-gray-900">CMR & Berichte</h3>
                  <span className="text-sm text-gray-500">Gespeichert: {savedCmrs.length}</span>
                </div>

                {savedCmrs.length === 0 ? (
                  <div className="p-10 text-center text-gray-500">Noch keine CMRs gespeichert. Erzeuge zuerst ein CMR — es wird automatisch hier abgelegt.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Typ</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Größe</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Aktion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {savedCmrs.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3 text-gray-900">{item.name}</td>
                            <td className="px-6 py-3 text-gray-700">{item.kind==="tour" ? "Tour" : "Stopp"}</td>
                            <td className="px-6 py-3 text-gray-700">{formatBytes(item.size)}</td>
                            <td className="px-6 py-3 space-x-3">
                              <a href={item.href} download={item.name} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700 font-medium text-sm">Download</a>
                              <button onClick={()=>deleteSavedCmr(item.id)} className="text-red-600 hover:text-red-700 font-medium text-sm">Löschen</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* --- Einstellungen (CMR-Layout) --- */}
            {activeView === "settings" && <CmrLayoutEditor />}
          </div>
        </main>
      </div>
    </div>
  );
}
