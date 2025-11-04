# Tourenplanung – Pixel-Exact (Vite + React + Tailwind)

Diese Version bildet **exakt** dein aktuelles UI nach, aber mit einer sauberen Projektstruktur (Vite Build, Tailwind ohne CDN, keine In‑Browser‑Babel‑Warnungen).

## Los geht's

1. **Ordner öffnen**  
   Öffne diesen Ordner in VS Code.

2. **Node installieren (falls noch nicht vorhanden)**  
   Empfohlen: Node 20 LTS. Prüfen: `node -v`

3. **Abhängigkeiten installieren**
   ```bash
   npm install
   ```

4. **Entwicklung starten**
   ```bash
   npm run dev
   ```
   Vite zeigt dir eine lokale URL (z. B. `http://localhost:5173`). Diese im Browser öffnen.

5. **Build (optional)**
   ```bash
   npm run build
   npm run preview
   ```

## Hinweise

- **Pop‑ups zulassen:** Für CMR‑PDFs wird ein neues Tab/Fenster geöffnet. Stelle sicher, dass dein Browser Pop‑ups für `localhost` erlaubt.
- **jsPDF wird dynamisch geladen:** Deine bestehende `ensureJsPDF()`‑Logik lädt jsPDF über CDN, damit du aktuell keine extra Abhängigkeit brauchst.
- **Icons:** `lucide-react` ist lokal installiert, keine externen CDN‑Warnungen mehr.
- **Pixel‑Exact:** Klassen & Markup sind unverändert, daher bleibt die Optik 1:1.

## Nächste Schritte (optional)

- Rollensteuerung (Disposition/Lager) kann als **unsichtiger Schalter** via `?role=lager` umgesetzt werden, ohne UI zu verändern.
- Persistenz (z. B. `savedCmrs` in `localStorage`) kann ergänzt werden, ohne sichtbare Änderungen.
