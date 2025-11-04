// src/cmr.js
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/* ---------- Config ---------- */
const OPT_URL = (import.meta.env?.VITE_OPTIMIZER_URL || "http://localhost:8001").replace(/\/+$/,"");

/* ---------- Mini Toast ---------- */
function ensureToastRoot(){ if(typeof document==="undefined") return null; let r=document.getElementById("toast-root"); if(!r){ r=document.createElement("div"); r.id="toast-root"; Object.assign(r.style,{position:"fixed",top:"16px",right:"16px",display:"flex",flexDirection:"column",gap:"8px",zIndex:999999}); document.body.appendChild(r);} return r;}
function toastMsg(m,v="info",ms=2600){const r=ensureToastRoot(); if(!r) return; const el=document.createElement("div"), c={success:{bg:"#10b981",fg:"#fff"},error:{bg:"#ef4444",fg:"#fff"},info:{bg:"#3b82f6",fg:"#fff"}}[v]||{bg:"#374151",fg:"#fff"}; Object.assign(el.style,{background:c.bg,color:c.fg,borderRadius:"10px",padding:"10px 12px",boxShadow:"0 10px 20px rgba(0,0,0,.12), 0 6px 6px rgba(0,0,0,.10)",font:"14px/1.25 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Ubuntu,sans-serif",maxWidth:"360px",wordBreak:"break-word",opacity:"0",transform:"translateY(-6px)",transition:"opacity .15s ease, transform .15s ease"}); el.textContent=String(m||""); r.appendChild(el); requestAnimationFrame(()=>{el.style.opacity="1"; el.style.transform="translateY(0)";}); const rm=()=>{el.style.opacity="0"; el.style.transform="translateY(-6px)"; setTimeout(()=>el.remove(),180)}; const t=setTimeout(rm,ms); el.addEventListener("click",()=>{clearTimeout(t); rm();});}
const toast={success:(m)=>toastMsg(m,"success"),error:(m)=>toastMsg(m,"error"),info:(m)=>toastMsg(m,"info")};

/* ---------- App Event für „CMR & Berichte“ ---------- */
function dispatchCmrSaved(detail){ try{window?.dispatchEvent?.(new CustomEvent("cmr:saved",{detail}))}catch{} try{document?.dispatchEvent?.(new CustomEvent("cmr:saved",{detail}))}catch{} }

/* ---------- Layout laden & normalisieren ---------- */
let layoutCache=null;

function normalizeLayout(raw){
  if(!raw || typeof raw!=="object") return null;
  const pageWidth  = Number(raw.pageWidth ?? (Array.isArray(raw.meta?.pageSize)? raw.meta.pageSize[0] : 595.28));
  const pageHeight = Number(raw.pageHeight ?? (Array.isArray(raw.meta?.pageSize)? raw.meta.pageSize[1] : 841.89));
  let fieldsArr=[];
  if(Array.isArray(raw.fields)) fieldsArr=raw.fields;
  else if(raw.fields && typeof raw.fields==="object") fieldsArr=Object.values(raw.fields);
  const layout = {
    pageWidth, pageHeight,
    backgroundPdfBase64: raw.backgroundPdfBase64 || null,
    calibration: raw.calibration || { offsetX:0, offsetY:0, scaleX:1, scaleY:1 },
    fields: fieldsArr.filter(Boolean)
  };
  if(window.__CMR_DEBUG) console.log("[CMR] normalized layout", {count: layout.fields.length, pageWidth, pageHeight, hasBg: !!layout.backgroundPdfBase64});
  return layout;
}
async function tryJson(url,label){
  try{
    const r=await fetch(url,{cache:"no-store"}); if(!r.ok) return null;
    const t=await r.text(); const j=JSON.parse(t); const n=normalizeLayout(j);
    if(n && n.fields.length>=1) { if(window.__CMR_DEBUG) console.log("[CMR] using",label,url); return n; }
    return null;
  }catch{ return null; }
}
async function loadLayout() {
  if (layoutCache) return layoutCache;

  // 1) optimizer (Festplatte)
  layoutCache =
    (await tryJson(`${OPT_URL}/save/file?bucket=cmr&name=layout.json`, "optimizer")) ||
    (await tryJson(`/api/layout/cmr`, "api")) ||
    (await tryJson(`/cmr-layout.json`, "file"));

  if (!layoutCache) throw new Error("CMR: kein valides Layout gefunden.");
  return layoutCache;
}


/* ---------- Hintergrund-PDF (robust) ---------- */
let tplCache=null;
async function getTemplate(layout){
  if(tplCache) return tplCache;
  const b64=layout?.backgroundPdfBase64; if(!b64) return null;
  try{
    const raw=b64.startsWith("data:")? b64.split(",")[1] : b64;
    const bytes=Uint8Array.from(atob(raw), c=>c.charCodeAt(0));
    tplCache = await PDFDocument.load(bytes);
    return tplCache;
  }catch(e){
    console.warn("[CMR] Hintergrund konnte nicht geladen werden → weiter ohne BG.", e);
    return null; // niemals throwen → kein Fallback nötig
  }
}
async function addPage(outDoc,layout,tpl){
  if(tpl){
    const [p]=await outDoc.copyPages(tpl,[0]);
    return outDoc.addPage(p);
  }
  return outDoc.addPage([layout.pageWidth, layout.pageHeight]);
}

/* ---------- Feldwerte ---------- */
function normStop(s0){
  const s={...(s0||{})};
  if(s.postal && !s.zip) s.zip=s.postal;
  if(s.contact && !s.customerName) s.customerName=s.contact;
  return s;
}
function valFor(cfg,raw){
  const stop=normStop(raw); const src=cfg.source||"static";
  if(src==="static") return cfg.staticText||cfg.preview||cfg.label||"";
  if(src==="customerName") return stop.customerName||"";
  if(src==="customerZipCityCountry") return [stop.zip||"",stop.city||"",stop.countryDelivery||""].filter(Boolean).join(" ");
  if(src==="ourZipCityCountry") return "33181 Bad Wünnenberg Deutschland";
  if(src==="deliveryNote"){ const y=new Date().getFullYear(); const nr=stop.deliveryNoteNumberRaw||stop.deliveryNote||""; return nr?`${y}-${nr}`:String(y); }
  if(src==="weightKg") return `${Number(stop.weight||0).toLocaleString("de-DE")} kg`;
  if(src==="todayDate") return new Date().toLocaleDateString("de-DE");
  return "";
}
function applyCalib(x,y,layout){ const c=layout?.calibration||{}; const sx=c.scaleX??1, sy=c.scaleY??1, ox=c.offsetX??0, oy=c.offsetY??0; return {x:x*sx+ox, y:y*sy+oy}; }
function drawStop(page,font,stop,layout){
  const list = Array.isArray(layout.fields)? layout.fields : [];
  for(const cfg of list){
    const v=valFor(cfg,stop); if(!v) continue;
    const p=applyCalib(Number(cfg.x||0), Number(cfg.y||0), layout);
    page.drawText(v,{ x:p.x, y:p.y, size:Number(cfg.size||10), font, color:rgb(0,0,0) });
  }
}

/* ---------- PDFs bauen (werfen nicht) ---------- */
async function buildStopBytes(stop){
  try{
    const layout=await loadLayout();
    const out=await PDFDocument.create();
    const tpl=await getTemplate(layout);
    const page=await addPage(out,layout,tpl);
    const font=await out.embedFont(StandardFonts.Helvetica);
    drawStop(page,font,stop,layout);
    return await out.save();
  }catch(e){
    console.error("[CMR] buildStopBytes error → HTML-Fallback", e);
    throw e;
  }
}
async function buildTourBytes(tour){
  try{
    const layout=await loadLayout();
    const out=await PDFDocument.create();
    const tpl=await getTemplate(layout);
    const font=await out.embedFont(StandardFonts.Helvetica);
    const arr = Array.isArray(tour?.orders)? tour.orders : (Array.isArray(tour?.stops)? tour.stops : []);
    for(const s of arr){
      const page=await addPage(out,layout,tpl);
      drawStop(page,font,s,layout);
    }
    return await out.save();
  }catch(e){
    console.error("[CMR] buildTourBytes error → HTML-Fallback", e);
    throw e;
  }
}

/* ---------- Öffnen ---------- */
function openPdf(bytes){
  const blob=new Blob([bytes],{type:"application/pdf"});
  const url=URL.createObjectURL(blob);
  const w=window.open(url,"_blank"); if(!w) alert("Bitte Pop-ups erlauben.");
  return {blob,url};
}

/* ---------- Disk-Save via optimizer ---------- */
async function saveToDisk(blob, filename){
  try{
    const r=await fetch(`${OPT_URL}/save?bucket=cmr&key=${encodeURIComponent(filename)}`,{
      method:"POST", headers:{ "Content-Type":"application/pdf" }, body: blob
    });
    return r.ok;
  }catch{ return false; }
}

/* ---------- App-Register ---------- */
function cleanName(s){ return (String(s||"").replace(/[\\/:*?"<>|]/g,"_").trim()||"CMR"); }
function register({blob, filename, meta}){
  const href=URL.createObjectURL(blob);
  const detail={ id:Date.now()+"-"+Math.random().toString(36).slice(2,6), name:filename, href, size:blob.size||0, createdAt:new Date().toISOString(), ...meta };
  dispatchCmrSaved(detail);
  toast.success(`CMR gespeichert: ${detail.name}`);
}

/* ---------- Public API ---------- */
export async function cmrForStop(order){
  try{
    const bytes=await buildStopBytes(order);
    openPdf(bytes);
  }catch{ fallbackHtml([order]); }
}
export async function cmrForTour(tour){
  try{
    const bytes=await buildTourBytes(tour);
    openPdf(bytes);
  }catch{
    const arr=Array.isArray(tour?.orders)? tour.orders : (tour?.stops||[]);
    fallbackHtml(arr);
  }
}
export async function cmrSaveStop(order){
  try{
    const bytes=await buildStopBytes(order);
    const blob=new Blob([bytes],{type:"application/pdf"});
    const name=cleanName((order?.customerName||"Empfaenger")+" - CMR.pdf");
    await saveToDisk(blob,name); // optional; ignoriert Fehler
    register({blob,filename:name,meta:{kind:"stop",customer:order?.customerName||"",zip:order?.zip||"",city:order?.city||""}});
  }catch{ toast.error("Fehler beim Speichern des CMR (Stopp)"); }
}
export async function cmrSaveTour(tour){
  try{
    const bytes=await buildTourBytes(tour);
    const blob=new Blob([bytes],{type:"application/pdf"});
    const name=cleanName((tour?.name||"Tour")+" - CMR (Tour).pdf");
    await saveToDisk(blob,name);
    const count=(Array.isArray(tour?.orders)? tour.orders : (tour?.stops||[])).length;
    register({blob,filename:name,meta:{kind:"tour",tourName:tour?.name||"",count}});
  }catch{ toast.error("Fehler beim Speichern des CMR (Tour)"); }
}

/* ---------- HTML-Fallback ---------- */
function fallbackHtml(stops){
  const win=window.open("","_blank"); if(!win){ alert("Bitte Pop-ups erlauben."); return; }
  const esc=(s)=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const html=(stops&&stops.length?stops:[{}]).map(s=>`
<section style="page-break-after:always;font:12pt/1.3 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Ubuntu,sans-serif;padding:24px">
  <h2>CMR – Frachtbrief (Fallback)</h2>
  <p><b>Empfänger:</b> ${esc(s.customerName||"")}</p>
  <p><b>Lieferanschrift:</b> ${esc([s.zip,s.city,s.countryDelivery].filter(Boolean).join(" "))}</p>
  <p><b>Gewicht:</b> ${esc(Number(s.weight||0).toLocaleString("de-DE"))} kg</p>
</section>`).join("");
  win.document.write(`<!doctype html><meta charset="utf-8"><title>CMR</title><body>${html}</body>`); win.document.close();
}
