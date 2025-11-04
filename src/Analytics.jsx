// src/Analytics.jsx
import React from "react";
import {
  BarChart3, PieChart, Truck, MapPin, Activity, Weight, DollarSign, Clock, Download
} from "lucide-react";

// Deutsche Monatsnamen
const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

// Soft-Parser für ISO / de-DE / Fallback
function parseDateFlexible(input) {
  if (!input) return null;
  if (typeof input === "number") return new Date(input);
  if (typeof input === "string") {
    // ISO?
    const iso = Date.parse(input);
    if (!Number.isNaN(iso)) return new Date(iso);
    // de-DE "dd.mm.yyyy, hh:mm:ss" -> grober Parser
    const m = input.match?.(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m) {
      const [ , d, mo, y ] = m;
      return new Date(Number(y), Number(mo)-1, Number(d));
    }
  }
  try { return new Date(input); } catch { return null; }
}

// Hilfsfunktionen
function sum(arr, pick = (x)=>x) { return arr.reduce((s,x)=>s + Number(pick(x)||0), 0); }
function toFixed(n, d=1) {
  const x = Number(n);
  return Number.isFinite(x) ? x.toFixed(d) : "0";
}

// Ableitung: alle Touren (aktiv + archiv) zu einer flachen Liste mit Datum
function unifyTours({ tours, archivedTours }) {
  const active = (Array.isArray(tours) ? tours : []).map(t => ({
    id: t.id,
    date: parseDateFlexible(t.createdAt) || new Date(), // wenn fehlt: jetzt
    region: t.region || "",
    stops: Number(t.stops ?? (t.orders?.length || 0)),
    distance: Number(t.distance || 0),
    weight: Number(t.weight || 0),
    cost: Number(t.cost || 0),
    orders: Array.isArray(t.orders) ? t.orders : [],
    kind: "active",
  }));

  const archived = (Array.isArray(archivedTours) ? archivedTours : []).map(t => ({
    id: t.id,
    date: parseDateFlexible(t.archivedAt) || parseDateFlexible(t.date) || new Date(),
    region: t.region || "",
    stops: Number(t.stops ?? (t.orders?.length || 0)),
    distance: Number(t.distance || 0),
    weight: Number(t.weight || 0),
    cost: Number(t.cost || 0),
    orders: Array.isArray(t.orders) ? t.orders : [],
    kind: "archived",
  }));

  return [...active, ...archived].filter(x => x.date && !Number.isNaN(x.date.getTime()));
}

export default function Analytics({ tours, archivedTours }) {
  const [selectedMonth, setSelectedMonth] = React.useState(new Date().getMonth());
  const [selectedYear, setSelectedYear]   = React.useState(new Date().getFullYear());

  // Datenbasis
  const allTours = React.useMemo(() => unifyTours({ tours, archivedTours }), [tours, archivedTours]);

  // Filter: aktueller Monat/Jahr
  const filtered = React.useMemo(() => {
    return allTours.filter(t => t.date.getFullYear() === selectedYear && t.date.getMonth() === selectedMonth);
  }, [allTours, selectedMonth, selectedYear]);

  // KPIs
  const totalTours     = filtered.length;
  const totalStops     = sum(filtered, t => t.stops);
  const totalDistance  = sum(filtered, t => t.distance);
  const totalWeight    = sum(filtered, t => t.weight);
  const totalCost      = sum(filtered, t => t.cost);
  const avgStops       = totalTours ? (totalStops / totalTours) : 0;
  const avgDistance    = totalTours ? (totalDistance / totalTours) : 0;
  const avgWeight      = totalTours ? (totalWeight / totalTours) : 0;

  // Region-Stats
  const regionStats = React.useMemo(() => {
    const map = new Map();
    for (const t of filtered) {
      const key = t.region || "—";
      const v = map.get(key) || { count: 0, distance: 0, weight: 0 };
      v.count += 1;
      v.distance += t.distance || 0;
      v.weight += t.weight || 0;
      map.set(key, v);
    }
    return Array.from(map.entries()).map(([region, data]) => ({ region, ...data }));
  }, [filtered]);

  const maxRegionCount = Math.max(1, ...regionStats.map(r => r.count));
  const maxDistance    = Math.max(1, ...regionStats.map(r => r.distance));

  // Timeline: letzte 7 Touren des Filters
  const timeline = React.useMemo(() => {
    return [...filtered].sort((a,b) => b.date - a.date).slice(0, 7);
  }, [filtered]);

  // Export (JSON der gefilterten Daten)
  function handleExport() {
    const payload = filtered.map(t => ({
      id: t.id,
      date: t.date.toISOString(),
      region: t.region,
      stops: t.stops,
      distance: t.distance,
      weight: t.weight,
      cost: t.cost,
      kind: t.kind,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `navio_analytics_${selectedYear}_${String(selectedMonth+1).padStart(2,"0")}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header mit Filter */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
          <p className="text-gray-500">Monatliche Auswertung deiner Touren & Sendungen</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
            <Clock className="w-5 h-5 text-gray-500" />
            <select
              value={selectedMonth}
              onChange={(e)=>setSelectedMonth(Number(e.target.value))}
              className="bg-transparent border-none outline-none text-gray-700 font-medium cursor-pointer"
            >
              {MONTHS.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={(e)=>setSelectedYear(Number(e.target.value))}
              className="bg-transparent border-none outline-none text-gray-700 font-medium cursor-pointer"
            >
              {/* einfache Auswahl – bei Bedarf dynamisch aus allTours ableiten */}
              {[selectedYear, selectedYear-1, selectedYear-2].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <button onClick={handleExport}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{totalTours}</div>
          <div className="text-sm text-gray-500">Touren im Monat</div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <MapPin className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{totalStops}</div>
          <div className="text-sm text-gray-500">Sendungen (Stops)</div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{totalDistance.toLocaleString("de-DE")}</div>
          <div className="text-sm text-gray-500">Kilometer</div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Weight className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{toFixed(totalWeight/1000,1)} t</div>
          <div className="text-sm text-gray-500">Fracht gesamt</div>
        </div>
      </div>

      {/* Charts (ohne Libs, einfache Balken) */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Touren nach Region</h3>
            <PieChart className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {regionStats.map((r, i) => {
              const color = ["bg-blue-500","bg-purple-500","bg-orange-500","bg-green-500","bg-red-500"][i%5];
              return (
                <div key={r.region + i}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${color}`}></div>
                      <span className="text-sm font-medium text-gray-700">{r.region}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{r.count} Touren</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${color}`} style={{ width: `${(r.count / maxRegionCount) * 100}%` }} />
                  </div>
                </div>
              );
            })}
            {regionStats.length === 0 && <div className="text-sm text-gray-500">Keine Daten für diesen Monat.</div>}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Kilometer nach Region</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {regionStats.map((r, i) => {
              const color = ["bg-blue-500","bg-purple-500","bg-orange-500","bg-green-500","bg-red-500"][i%5];
              return (
                <div key={r.region + i}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${color}`}></div>
                      <span className="text-sm font-medium text-gray-700">{r.region}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{r.distance} km</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${color}`} style={{ width: `${(r.distance / maxDistance) * 100}%` }} />
                  </div>
                </div>
              );
            })}
            {regionStats.length === 0 && <div className="text-sm text-gray-500">Keine Daten für diesen Monat.</div>}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">Letzte Touren (Monat)</h3>
          <Clock className="w-5 h-5 text-gray-400" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Region</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Stops</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Distanz</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Gewicht</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kosten</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {timeline.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {t.date.toLocaleDateString("de-DE", { day:"2-digit", month:"2-digit", year:"numeric" })}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.region || "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{t.stops}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{t.distance} km</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{t.weight} kg</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{toFixed(t.cost,2)} €</td>
                </tr>
              ))}
              {timeline.length === 0 && (
                <tr><td className="px-4 py-6 text-sm text-gray-500" colSpan={6}>Keine Touren im gewählten Monat.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
