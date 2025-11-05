const K_ACTIVE='navio_active';const K_ARCHIVE='navio_archive';const K_ANALYTICS='navio_analytics';const K_META='navio_meta';
function now(){return Date.now()}function read(k,f){try{const v=localStorage.getItem(k);return v?JSON.parse(v):f}catch{return f}}
function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
export function loadAll(){const active=read(K_ACTIVE,[]);const archive=read(K_ARCHIVE,[]);const analytics=read(K_ANALYTICS,{});const meta=read(K_META,{revision:0,lastWriteAt:0});return{active,archive,analytics,meta}}
function bumpMeta(meta){const next={revision:(meta?.revision||0)+1,lastWriteAt:now()};write(K_META,next);return next}
export function saveActive(next){const m=loadAll().meta;write(K_ACTIVE,next);return bumpMeta(m)}
export function saveArchive(next){const m=loadAll().meta;write(K_ARCHIVE,next);return bumpMeta(m)}
export function saveAnalytics(next){const m=loadAll().meta;write(K_ANALYTICS,next);return bumpMeta(m)}
export function shouldApplyIncoming(incoming){const local=loadAll().meta;return (incoming?.revision||0)>(local?.revision||0)}
export function clearAllButArchiveAnalytics(){const keepA=read(K_ARCHIVE,[]);const keepAn=read(K_ANALYTICS,{});write(K_ACTIVE,[]);write(K_ARCHIVE,keepA);write(K_ANALYTICS,keepAn);write(K_META,{revision:(loadAll().meta.revision||0)+1,lastWriteAt:now()})}
