Navio AI – Minimal Brand Kit (v1)

Enthalten:
- navio_ai_mark_light.svg         (transparenter Mark – nur das N)
- navio_ai_mark_dark_tile.svg     (Mark auf dunkler Kachel – ideal als App-Icon)
- navio_ai_lockup_light.svg       (Icon + Wortmarke auf Weiß)
- navio_ai_lockup_dark.svg        (Icon + Wortmarke auf Dunkel)
- navio_ai_favicon.svg            (SVG-Favicon)
- apple-touch-icon-180.png        (iOS Homescreen)
- icon-192.png / icon-512.png     (PWA Icons)
- site.webmanifest                (PWA Manifest)
- src_brand/NavioMinimalMark.jsx  (React-Komponente)

Einbindung (Vite/React):
1) Erstelle `public/brand/` und lege alle Dateien dort ab.
2) In `index.html` im <head>:
   <link rel="icon" href="/brand/navio_ai_favicon.svg" type="image/svg+xml" />
   <link rel="apple-touch-icon" sizes="180x180" href="/brand/apple-touch-icon-180.png" />
   <link rel="manifest" href="/brand/site.webmanifest" />
   <meta name="theme-color" content="#0F172A">
3) Icon im Login austauschen:
   <img src="/brand/navio_ai_mark_dark_tile.svg" alt="Navio AI" className="w-10 h-10" />
   // oder als React-Komponente:
   // import NavioMinimalMark from './brand/NavioMinimalMark.jsx'
   // <NavioMinimalMark size={40} tile />

Hinweise:
- Die Strichstärke ist neutral gehalten (72 @ 512). Für feinere oder kräftigere Varianten sag kurz Bescheid.
- Die SVGs sind vektorbasiert und skalieren sauber (auch für PDFs).
