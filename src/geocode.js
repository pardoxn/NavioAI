// src/geocode.js
// Robuste Geokodierung mit Timeout, LocalStorage-Cache und Nominatim "email" Param.
// Drop-in: geocodeAddress(addr), geocodeZipCity(zip, city, country?, opts)

const NOM_BASE = "https://nominatim.openstreetmap.org";
const CONTACT_EMAIL = "navio.local@invalid"; // optional anpassen

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cacheGet(k) {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function cacheSet(k, v) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

async function fetchWithTimeout(url, { timeoutMs = 7000 } = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Navio/AI Planner (contact: " + CONTACT_EMAIL + ")"
      }
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function parseCoord(it) {
  const lat = Number(it.lat), lon = Number(it.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

export async function geocodeAddress(address, { timeoutMs = 7000 } = {}) {
  if (!address || !address.trim()) return null;
  const key = "geo_addr_" + address.toLowerCase().trim();
  const cached = cacheGet(key);
  if (cached) return cached;

  const url = new URL(NOM_BASE + "/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("email", CONTACT_EMAIL);

  let res;
  try {
    res = await fetchWithTimeout(url.toString(), { timeoutMs });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const arr = await res.json().catch(() => null);
  const c = Array.isArray(arr) && arr.length ? parseCoord(arr[0]) : null;
  if (c) cacheSet(key, c);
  return c;
}

export async function geocodeZipCity(zip, city, country = "Deutschland", { timeoutMs = 7000, jitter = false } = {}) {
  if (!zip && !city) return null;
  const q = `${zip || ""} ${city || ""} ${country || ""}`.replace(/\s+/g, " ").trim();
  const key = "geo_zip_" + q.toLowerCase();
  const cached = cacheGet(key);
  if (cached) return cached;

  const url = new URL(NOM_BASE + "/search");
  url.searchParams.set("postalcode", String(zip || ""));
  url.searchParams.set("city", String(city || ""));
  url.searchParams.set("country", String(country || ""));
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("email", CONTACT_EMAIL);

  if (jitter) await sleep(120 + Math.random() * 120);

  let res;
  try {
    res = await fetchWithTimeout(url.toString(), { timeoutMs });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const arr = await res.json().catch(() => null);
  const c = Array.isArray(arr) && arr.length ? parseCoord(arr[0]) : null;
  if (c) cacheSet(key, c);
  return c;
}
