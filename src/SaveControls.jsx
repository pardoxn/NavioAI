// src/SaveControls.jsx
import React from "react";
import { Download, Save } from "lucide-react";

// 🔁 Hook: liefert alle Sek. einen neuen Text wie "1 Min 09 Sek"
function useElapsedSince(ts) {
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!ts) return "0 Min 00 Sek";
  const diff = Math.max(0, now - ts);
  const total = Math.floor(diff / 1000);

  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");

  return hrs > 0 ? `${hrs} Std ${mm} Min ${ss} Sek` : `${mins} Min ${ss} Sek`;
}

export default function SaveControls({
  onSave,                // () => void
  onLoad,                // () => void
  lastAutoSaveAt,        // number | null (ms)
  lastManualSaveAt,      // number | null (ms)
}) {
  // Nimm den neuesten Zeitstempel (manuell vs. autosave)
  const latestTs = Math.max(lastAutoSaveAt || 0, lastManualSaveAt || 0) || null;
  const elapsedText = useElapsedSince(latestTs);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onSave}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 active:translate-y-[1px]"
      >
        <Save size={18} /> Speichern
      </button>

      <button
        onClick={onLoad}
        className="inline-flex items-center gap-2 rounded-xl bg-gray-100 text-gray-900 px-4 py-2 hover:bg-gray-200 active:translate-y-[1px]"
      >
        <Download size={18} /> Laden
      </button>

      {/* Timer-Pille – feste Breite, damit nichts springt */}
      <div
        className="inline-flex items-center gap-2 rounded-xl bg-gray-50 text-gray-700 px-3 py-2"
        style={{
          fontFeatureSettings: '"tnum" 1',          // tabellarische Ziffern
          minWidth: 170,                             // feste Breite (≈ "00 Std 00 Min 00 Sek")
          justifyContent: "space-between",
        }}
        title={latestTs ? new Date(latestTs).toLocaleString() : "Noch nie gespeichert"}
      >
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: latestTs ? "#10b981" : "#9CA3AF" }}
          />
          Gespeichert vor:
        </span>
        <span className="font-medium tabular-nums text-right">{elapsedText}</span>
      </div>
    </div>
  );
}
