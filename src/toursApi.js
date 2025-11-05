const API = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/+$/, "");

async function j(path, init) {
  const res = await fetch(API + path, { credentials: "include", ...init });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function saveActiveTours(active) {
  return j("/api/tours2/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ active }),
  });
}

export async function fetchTours() {
  return j("/api/tours2");
}

export async function markLoaded(id, payload = {}) {
  return j(`/api/tours2/${encodeURIComponent(id)}/load`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function unLoad(id, payload = {}) {
  return j(`/api/tours2/${encodeURIComponent(id)}/unload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
