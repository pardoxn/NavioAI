// src/optimizerClient.js
const OPT_URL = (import.meta.env?.VITE_OPTIMIZER_URL || "http://localhost:8001").replace(/\/+$/, "");

async function fetchWithTimeout(url, opts = {}) {
  const { timeoutMs = 15000, ...rest } = opts;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, ...rest });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export async function optimizeRemote({ depot, orders, maxStops = 12, maxWeight = 1300, vehicles = null }) {
  if (!depot || !Array.isArray(orders)) throw new Error("Optimizer: ungültige Parameter");

  const payload = {
    depot,
    max_stops: Number(maxStops),
    max_weight: Number(maxWeight),
    vehicles: vehicles == null ? null : Number(vehicles),
    return_to_depot: false, // <-- WICHTIG: offene Route, keine Rückfahrt
    orders: orders.map(o => ({
      id: o.rowId ?? o.id ?? String(Math.random()),
      weight: Number(o.weight || 0),
      lat: Number(o.__coord?.lat),
      lon: Number(o.__coord?.lon),
    })).filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lon)),
  };

  let res;
  try {
    res = await fetchWithTimeout(`${OPT_URL}/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      timeoutMs: 20000,
    });
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error("Optimizer Timeout (keine Antwort innerhalb von 20 Sekunden). Läuft der Server und ist die URL korrekt?");
    }
    throw new Error("Optimizer nicht erreichbar (Netzwerkproblem). Läuft der Server und stimmt VITE_OPTIMIZER_URL?");
  }

  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Optimizer HTTP ${res.status}: ${text || "Unbekannter Fehler"}`);

  let data;
  try { data = JSON.parse(text); } catch { throw new Error("Optimizer lieferte keine valide JSON-Antwort."); }
  if (!data || !Array.isArray(data.tours)) throw new Error("Optimizer-Antwort unvollständig (tours fehlt).");
  return data;
}
