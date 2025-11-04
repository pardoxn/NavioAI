// src/autosave.js
import React from "react";

// Leichter Autosave: nur LocalStorage (kein Dateisystem), nur bei Änderungen,
// große Felder (Bilder) werden aus dem Autosave entfernt.
// Standardintervall: 5 Minuten.

const DEFAULT_MS = 5 * 60 * 1000;

function deepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj ?? null));
  } catch {
    return null;
  }
}

// einfacher Hash-Fallback
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(16);
}

async function sha256(str) {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const data = new TextEncoder().encode(str);
      const buf = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {}
  return djb2(str);
}

// schwere Felder (z.B. images) fürs Autosave entfernen
function stripHeavy(data) {
  const clone = deepClone(data);
  if (!clone) return clone;

  const stripOrders = (orders) =>
    Array.isArray(orders)
      ? orders.map((o) => {
          const { images, ...rest } = o || {};
          return { ...rest, _imagesCount: Array.isArray(images) ? images.length : 0 };
        })
      : orders;

  if (Array.isArray(clone.tours)) {
    clone.tours = clone.tours.map((t) => ({ ...t, orders: stripOrders(t.orders) }));
  }
  if (Array.isArray(clone.archivedTours)) {
    clone.archivedTours = clone.archivedTours.map((t) => ({ ...t, orders: stripOrders(t.orders) }));
  }
  return clone;
}

export function useAutosave({
  storageKey = "navio/autosave/v1",
  data,
  restoreOnMount = true,
  onRestore = () => {},
  onSaved = () => {},
  saveEveryMs = DEFAULT_MS,
  remoteUrl = null,            // bewusst aus
  stripImagesInAutosave = true // Bilder nicht im Autosave
} = {}) {
  const [lastAutoSaveAt, setLastAutoSaveAt] = React.useState(null);
  const lastHashRef = React.useRef(null);

  // Restore beim Mount
  React.useEffect(() => {
    if (!restoreOnMount) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) onRestore(JSON.parse(raw));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Intervall-Save (nur bei Änderungen)
  React.useEffect(() => {
    const min = Math.max(10_000, Number(saveEveryMs) || DEFAULT_MS);

    async function doSave() {
      try {
        const payload = stripImagesInAutosave ? stripHeavy(data) : deepClone(data);
        const json = JSON.stringify(payload ?? {});
        const hash = await sha256(json);
        if (hash === lastHashRef.current) return; // keine Änderung

        // LocalStorage
        localStorage.setItem(storageKey, json);

        // Optional Remote (ausgeschaltet)
        if (remoteUrl) {
          try {
            await fetch(remoteUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: json,
            });
          } catch {}
        }

        lastHashRef.current = hash;
        const ts = Date.now();
        setLastAutoSaveAt(ts);
        onSaved(ts);
      } catch {}
    }

    const interval = setInterval(doSave, min);
    return () => clearInterval(interval);
  }, [data, storageKey, saveEveryMs, remoteUrl, stripImagesInAutosave, onSaved]);

  // manueller Trigger (falls du ihn brauchst)
  const triggerAutosave = React.useCallback(async () => {
    try {
      const payload = stripImagesInAutosave ? stripHeavy(data) : deepClone(data);
      const json = JSON.stringify(payload ?? {});
      const hash = await sha256(json);
      if (hash === lastHashRef.current) return;

      localStorage.setItem(storageKey, json);
      if (remoteUrl) {
        try {
          await fetch(remoteUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: json,
          });
        } catch {}
      }
      lastHashRef.current = hash;
      const ts = Date.now();
      setLastAutoSaveAt(ts);
      onSaved(ts);
    } catch {}
  }, [data, remoteUrl, storageKey, stripImagesInAutosave, onSaved]);

  return { lastAutoSaveAt, triggerAutosave };
}
