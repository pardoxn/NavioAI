const K_ACTIVE = 'navio_active';
const K_ARCHIVE = 'navio_archive';
const K_ANALYTICS = 'navio_analytics';
const K_META = 'navio_meta';
function now(){return Date.now();}
function read(key,fallback){try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback;}catch{return fallback;}}
function write(key,val){localStorage.setItem(key,JSON.stringify(val));}
export function loadAll(){const active=read(K_ACTIVE,[]);const archive=read(K_ARCHIVE,[]);const analytics=read(K_ANALYTICS,{});const meta=read(K_META,{revision:0,lastWriteAt:0});return{active,archive,analytics,meta};}
function bumpMeta(meta){const next={revision:(meta?.revision||0)+1,lastWriteAt:now()};write(K_META,next);return next;}
export function saveActive(nextActive){const meta=loadAll().meta;write(K_ACTIVE,nextActive);return bumpMeta(meta);}
export function saveArchive(nextArchive){const meta=loadAll().meta;write(K_ARCHIVE,nextArchive);return bumpMeta(meta);}
export function saveAnalytics(nextAnalytics){const meta=loadAll().meta;write(K_ANALYTICS,nextAnalytics);return bumpMeta(meta);}
export function shouldApplyIncoming(incomingMeta){const localMeta=loadAll().meta;return (incomingMeta?.revision||0)>(localMeta?.revision||0);}
export function clearAllButArchiveAnalytics(){const keepArchive=read(K_ARCHIVE,[]);const keepAnalytics=read(K_ANALYTICS,{});write(K_ACTIVE,[]);write(K_ARCHIVE,keepArchive);write(K_ANALYTICS,keepAnalytics);write(K_META,{revision:(loadAll().meta.revision||0)+1,lastWriteAt:now()});}
