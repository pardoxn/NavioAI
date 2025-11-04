// src/CmrLayoutEditor.jsx
import React from 'react';
import { Upload, Download, Trash2, Plus } from 'lucide-react';

import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerSrc;

// Welche Quellen dürfen Felder haben?
const SOURCE_OPTIONS = [
  { value: 'static', label: 'Fester Text (staticText)' },
  { value: 'customerName', label: 'Kundenname (Name 1 Auftraggeber)' },
  { value: 'customerZipCityCountry', label: 'Kunde PLZ / Ort / Land (Lieferanschrift)' },
  { value: 'ourZipCityCountry', label: 'Unser PLZ / Ort / Land (33181 Bad Wünnenberg Deutschland)' },
  { value: 'deliveryNote', label: 'Lieferschein-Nr. (Jahr + Belegnummer)' },
  { value: 'weightKg', label: 'Gewicht (kg)' },
  { value: 'todayDate', label: 'Heutiges Datum' }
];

export default function CmrLayoutEditor() {
  const [layout, setLayout] = React.useState(null);
  const [selectedKey, setSelectedKey] = React.useState('');
  const [dragging, setDragging] = React.useState(null);

  const containerRef = React.useRef(null);
  const canvasRef = React.useRef(null);

 // Layout laden – erst API (nur wenn gültig), dann Fallback /cmr-layout.json
React.useEffect(() => {
  (async () => {
    function isValidLayout(x) {
      return !!(
        x &&
        typeof x === 'object' &&
        typeof x.pageWidth === 'number' &&
        typeof x.pageHeight === 'number' &&
        x.fields &&
        typeof x.fields === 'object' &&
        Object.keys(x.fields).length >= 1
      );
    }

    async function loadFromApi() {
      try {
        const r = await fetch('/api/layout/cmr', { cache: 'no-store' });
        if (!r.ok) return null;
        const j = await r.json().catch(() => null);
        return isValidLayout(j) ? j : null;
      } catch { return null; }
    }
    async function loadFromPublic() {
      try {
        const r = await fetch('/cmr-layout.json', { cache: 'no-store' });
        if (!r.ok) return null;
        const j = await r.json().catch(() => null);
        return isValidLayout(j) ? j : null;
      } catch { return null; }
    }

    let json = (await loadFromApi()) || (await loadFromPublic());
    if (!json) {
      // harmloser Fallback, damit der Editor nicht leer crasht
      json = {
        pageWidth: 595.28,
        pageHeight: 841.89,
        backgroundPdfBase64: "",
        calibration: { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotationDeg: 0 },
        fields: {}
      };
      console.warn('CMR: Kein valides Layout gefunden – nutze Minimal-Fallback.');
    }

    json.calibration ||= { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotationDeg: 0 };
    setLayout(json);

    const firstKey = Object.keys(json.fields || {})[0] || '';
    setSelectedKey(firstKey);
  })();
}, []);


  // Hintergrund-PDF ins Canvas zeichnen (nur wenn PDF oder Größe sich ändern)
  React.useEffect(() => {
    async function renderBg() {
      if (!layout) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      canvas.width = layout.pageWidth;
      canvas.height = layout.pageHeight;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (layout.backgroundPdfBase64) {
        try {
          // base64 -> Bytes
          const base64raw = layout.backgroundPdfBase64.includes(',')
            ? layout.backgroundPdfBase64.split(',')[1]
            : layout.backgroundPdfBase64;
          const bin = atob(base64raw);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

          const pdf = await getDocument({ data: bytes }).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 1 });

          // Falls PDF eine andere Seitengröße hat, übernehmen
          if (Math.abs(viewport.width - layout.pageWidth) > 0.5 ||
              Math.abs(viewport.height - layout.pageHeight) > 0.5) {
            setLayout((prev) => ({
              ...prev,
              pageWidth: viewport.width,
              pageHeight: viewport.height,
            }));
            canvas.width = viewport.width;
            canvas.height = viewport.height;
          }

          await page.render({ canvasContext: ctx, viewport }).promise;
        } catch (err) {
          console.error('PDF render error', err);
        }
      }
    }
    renderBg();
  }, [layout?.backgroundPdfBase64, layout?.pageWidth, layout?.pageHeight]);

  // Drag-Handling
  React.useEffect(() => {
    function onMove(e) {
      if (!dragging || !layout) return;
      const rect = containerRef.current.getBoundingClientRect();

      let newScreenX = e.clientX - rect.left - dragging.offsetX;
      let newScreenY = e.clientY - rect.top - dragging.offsetY;

      if (newScreenX < 0) newScreenX = 0;
      if (newScreenY < 0) newScreenY = 0;
      if (newScreenX > layout.pageWidth) newScreenX = layout.pageWidth;
      if (newScreenY > layout.pageHeight) newScreenY = layout.pageHeight;

      // Bildschirm (oben/links) -> PDF-Koords (unten/links)
      const newPdfX = newScreenX;
      const newPdfY = layout.pageHeight - newScreenY;

      setLayout((prev) => {
        const copy = { ...prev, fields: { ...prev.fields } };
        copy.fields[dragging.key] = { ...copy.fields[dragging.key], x: newPdfX, y: newPdfY };
        return copy;
      });
    }
    function onUp() { if (dragging) setDragging(null); }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, layout]);

  if (!layout) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">CMR Layout Editor</h2>
        <p className="text-sm text-gray-500">Layout wird geladen…</p>
      </div>
    );
  }

  const fields = layout.fields || {};
  const current = fields[selectedKey];

  // Helper zum Aktualisieren eines Feld-Props
  const updateFieldProp = (prop, value) => {
    if (!selectedKey) return;
    setLayout((prev) => {
      const copy = { ...prev, fields: { ...prev.fields } };
      copy.fields[selectedKey] = { ...copy.fields[selectedKey], [prop]: value };
      return copy;
    });
  };

  // Hintergrund-PDF hochladen
  async function handleUploadBg(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const arrBuf = await file.arrayBuffer();
    const bytes = new Uint8Array(arrBuf);

    // base64 bauen
    let binStr = '';
    for (let i = 0; i < bytes.length; i++) binStr += String.fromCharCode(bytes[i]);
    const b64 = btoa(binStr);
    const dataUrl = 'data:application/pdf;base64,' + b64;

    // Größe ermitteln
    const pdf = await getDocument({ data: bytes }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });

    setLayout((prev) => ({
      ...prev,
      backgroundPdfBase64: dataUrl,
      pageWidth: viewport.width,
      pageHeight: viewport.height,
    }));
  }

  // Layout als JSON runterladen
  function handleDownloadConfig() {
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cmr-layout.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Neues Feld hinzufügen
  function handleAddField() {
    const newKey = 'field_' + Date.now().toString(36);
    const newField = { label: 'Neues Feld', preview: 'Neues Feld', source: 'static', staticText: 'Neues Feld', x: 20, y: 20, size: 10 };
    const newFields = { ...layout.fields, [newKey]: newField };
    setLayout((prev) => ({ ...prev, fields: newFields }));
    setSelectedKey(newKey);
  }

  // Feld löschen
  function handleDeleteField() {
    if (!selectedKey) return;
    const newFields = { ...layout.fields };
    delete newFields[selectedKey];
    const keys = Object.keys(newFields);
    const nextKey = keys[0] || '';
    setLayout((prev) => ({ ...prev, fields: newFields }));
    setSelectedKey(nextKey);
  }

  // Drag starten
  function onMouseDownField(key, e) {
    e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    const f = layout.fields[key];
    const screenX = f.x;
    const screenY = layout.pageHeight - f.y;

    setSelectedKey(key);
    setDragging({
      key,
      offsetX: e.clientX - (rect.left + screenX),
      offsetY: e.clientY - (rect.top + screenY),
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      {/* Header + Buttons */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">CMR Layout Editor</h2>
          <p className="text-sm text-gray-500 max-w-xl">
            Hintergrund-PDF hochladen, Felder an die richtige Stelle ziehen, Schriftgrößen anpassen.
            Danach „Layout als JSON herunterladen“ oder „Auf Server speichern“.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-500 rounded-xl text-sm font-medium cursor-pointer hover:bg-blue-100">
            <Upload size={16} />
            <span>Hintergrund-PDF hochladen</span>
            <input type="file" accept="application/pdf" className="hidden" onChange={handleUploadBg} />
          </label>

          <button
            onClick={handleDownloadConfig}
            className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-500 rounded-xl text-sm font-medium hover:bg-green-100"
          >
            <Download size={16} />
            Layout als JSON herunterladen
          </button>

          {/* <-- Der Button ist jetzt hier im Header-Button-Stack */}
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/layout/cmr', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(layout),
                });
                if (res.ok) {
                  alert('Layout wurde auf dem Server gespeichert.');
                } else {
                  alert('Speichern fehlgeschlagen (Server meldet Fehler).');
                }
              } catch (e) {
                console.error(e);
                alert('Speichern fehlgeschlagen (keine Verbindung zum Server).');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-500 rounded-xl text-sm font-medium hover:bg-indigo-100"
          >
            Auf Server speichern
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Linke Seite: Vorschau */}
        <div className="col-span-2">
          <div
            ref={containerRef}
            className="relative border border-gray-300 rounded-xl overflow-hidden bg-white"
            style={{ width: layout.pageWidth + 'px', height: layout.pageHeight + 'px' }}
          >
            {/* Hintergrund (Canvas mit dem hochgeladenen PDF) */}
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: layout.pageWidth + 'px',
                height: layout.pageHeight + 'px',
              }}
            />

            {/* Ziehbare Felder */}
            {Object.entries(fields).map(([key, cfg]) => {
              const screenX = cfg.x;
              const screenY = layout.pageHeight - cfg.y;
              return (
                <div
                  key={key}
                  onMouseDown={(e) => onMouseDownField(key, e)}
                  style={{
                    position: 'absolute',
                    left: screenX + 'px',
                    top: screenY + 'px',
                    fontSize: cfg.size + 'px',
                    lineHeight: 1.2,
                    fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Ubuntu,sans-serif',
                    backgroundColor: selectedKey === key ? 'rgba(37,99,235,0.15)' : 'rgba(251,191,36,0.25)',
                    color: '#111827',
                    border: selectedKey === key ? '2px solid rgba(37,99,235,0.8)' : '1px solid rgba(251,191,36,0.8)',
                    borderRadius: '4px',
                    padding: '2px 4px',
                    cursor: 'move',
                    whiteSpace: 'nowrap',
                  }}
                  title="Mit Pfeiltasten fein schieben (Shift=5pt, Alt=0.2pt)"
                >
                  {cfg.preview || cfg.label || key}
                </div>
              );
            })}
          </div>
        </div>

        {/* Rechte Seite: Editor Panel */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-4 text-sm text-gray-800">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500 font-semibold">Felder verwalten</div>
            <div className="flex gap-2">
              <button
                onClick={handleAddField}
                className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 border border-blue-500 rounded-lg text-xs font-medium hover:bg-blue-100"
              >
                <Plus size={14} /> Neu
              </button>
              <button
                onClick={handleDeleteField}
                className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 border border-red-500 rounded-lg text-xs font-medium hover:bg-red-100"
              >
                <Trash2 size={14} /> Löschen
              </button>
            </div>
          </div>

          {/* Feld-Auswahl */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Feld auswählen</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
            >
              {Object.entries(fields).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label || key}</option>
              ))}
            </select>
          </div>

          {current && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Feld-Name / Label</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={current.label || ''}
                  onChange={(e) => updateFieldProp('label', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Inhalt (Quelle für den Text im PDF)</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={current.source || 'static'}
                  onChange={(e) => updateFieldProp('source', e.target.value)}
                >
                  {SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {current.source === 'static' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Statischer Druck-Text (z. B. "Telefon:" oder "X")
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={current.staticText || ''}
                    onChange={(e) => updateFieldProp('staticText', e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Vorschau im Editor</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={current.preview || ''}
                  onChange={(e) => updateFieldProp('preview', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Schriftgröße</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={current.size || 10}
                    onChange={(e) => updateFieldProp('size', parseFloat(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">X (von links)</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={current.x || 0}
                    onChange={(e) => updateFieldProp('x', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Y (von unten)</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={current.y || 0}
                    onChange={(e) => updateFieldProp('y', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="text-xs text-gray-500 leading-relaxed">
                <p>X / Y sind echte PDF-Punkte. Y = 0 ist ganz UNTEN auf der Seite.</p>
                <p className="mt-2">Diese Werte gehen 1:1 in das gedruckte PDF rein.</p>
              </div>

              <div className="text-xs text-gray-400 border-t border-gray-200 pt-3">
                <p>Tipp: Für Kreuzchen Quelle = „Fester Text“ und <strong>X</strong> als statischen Text setzen.</p>
              </div>
            </>
          )}

          {!current && <div className="text-xs text-gray-500">Kein Feld ausgewählt.</div>}
        </div>
      </div>
    </div>
  );
}
