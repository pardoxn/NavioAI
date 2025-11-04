// src/routing.js
// Verbesserte Routenplanung (lokal, ohne Server):
// - Winkelbasiertes Sweep-Sort (vermeidet Zickzack)
// - Nearest-Neighbor-Start für die ersten Stops
// - 2-Opt zur lokalen Verbesserung jeder Tour
// - Gewicht- & Stop-Grenzen werden respektiert
// - Distanz = Depot → Stop1 → … → StopN (Straßen-Faktor statt Luftlinie)

const DEG2RAD = Math.PI / 180;
// Straßendistanz ~ 1.30 * Luftlinie ist oft realistisch bei Landstraßen
export const ROAD_FACTOR = 1.30;

/************ Distanz & Geometrie ************/
export function haversineKm(a, b) {
  if (!a || !b) return 0;
  const R = 6371;
  const dLat = (b.lat - a.lat) * DEG2RAD;
  const dLon = (b.lon - a.lon) * DEG2RAD;
  const lat1 = a.lat * DEG2RAD;
  const lat2 = b.lat * DEG2RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function roadDistanceKm(a, b) {
  return haversineKm(a, b) * ROAD_FACTOR;
}

export function totalPathKm(depot, arr, getC) {
  let km = 0;
  let last = depot;
  for (const it of arr) {
    const c = getC(it);
    if (last && c) km += roadDistanceKm(last, c);
    last = c;
  }
  return km;
}

/************ Ordnungen & Verbesserungen ************/
function angleFromDepot(depot, p) {
  return Math.atan2(p.lat - depot.lat, p.lon - depot.lon); // -PI..PI
}

export function buildSweepOrder(depot, items, getC) {
  return items.slice().sort((a, b) => {
    const A = getC(a), B = getC(b);
    const ang = angleFromDepot(depot, A) - angleFromDepot(depot, B);
    if (Math.abs(ang) > 1e-9) return ang;
    // Tie-break: näher zuerst
    return haversineKm(depot, A) - haversineKm(depot, B);
  });
}

export function nearestNeighborFrom(start, arr, getC) {
  const todo = arr.slice();
  const out = [];
  let cur = start;
  while (todo.length) {
    let bestIdx = 0, best = Infinity;
    for (let i = 0; i < todo.length; i++) {
      const d = roadDistanceKm(cur, getC(todo[i]));
      if (d < best) { best = d; bestIdx = i; }
    }
    const nxt = todo.splice(bestIdx, 1)[0];
    out.push(nxt);
    cur = getC(nxt);
  }
  return out;
}

export function nearestNeighborOrder(depot, items, getC) {
  const base = buildSweepOrder(depot, items, getC);
  const head = Math.min(8, base.length);
  const refinedHead = nearestNeighborFrom(depot, base.slice(0, head), getC);
  return refinedHead.concat(base.slice(head));
}

export function twoOptImprove(depot, order, getC, maxIter = 250) {
  const dist = (arr) => totalPathKm(depot, arr, getC);
  let best = order.slice();
  let bestKm = dist(best);
  let improved = true, iter = 0;

  while (improved && iter < maxIter) {
    improved = false; iter++;
    for (let i = 0; i < best.length - 2; i++) {
      for (let k = i + 1; k < best.length - 1; k++) {
        const cand = best.slice(0, i)
          .concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
        const km = dist(cand);
        if (km + 1e-6 < bestKm) {
          best = cand; bestKm = km; improved = true;
        }
      }
    }
  }
  return best;
}

/************ Packen nach Gewicht/Stopps ************/
export function greedyPartitionByWeight(ordered, maxWeight = Infinity, maxStops = Infinity) {
  const tours = [];
  let cur = [];
  let w = 0;

  for (const it of ordered) {
    const iw = Number(it.weight || 0);
    const nextStops = cur.length + 1;
    const wouldOverflow = (w + iw > maxWeight) || (nextStops > maxStops);

    if (wouldOverflow) {
      if (cur.length) tours.push(cur);
      cur = []; w = 0;
    }
    // Einzelauftrag über Limit: eigene Tour (wird später markiert)
    if (iw > maxWeight && isFinite(maxWeight)) {
      tours.push([it]);
      continue;
    }
    cur.push(it);
    w += iw;
  }
  if (cur.length) tours.push(cur);
  return tours;
}

/************ Touraufbau & Statistik ************/
export function computeTourStats(depot, orders, getC, costPerKm = 1.0) {
  const km = totalPathKm(depot, orders, getC);
  const weight = orders.reduce((s, o) => s + Number(o.weight || 0), 0);
  const cost = km * Number(costPerKm || 1);
  return {
    stops: orders.length,
    distance: Number(km.toFixed(2)),
    cost: Number(cost.toFixed(2)),
    weight: Number(weight.toFixed(1)),
  };
}

export function buildTours(depot, items, getC, { maxWeight = Infinity, maxStops = Infinity, costPerKm = 1.0 } = {}) {
  // 1) Grobe Ordnung
  const nn = nearestNeighborOrder(depot, items, getC);
  // 2) Packen
  const chunks = greedyPartitionByWeight(nn, maxWeight, maxStops);
  // 3) Lokale Verbesserung je Tour
  const improved = chunks.map(ch => twoOptImprove(depot, ch, getC, 250));
  // 4) Metriken
  return improved.map(orders => ({
    orders,
    stats: computeTourStats(depot, orders, getC, costPerKm),
  }));
}
