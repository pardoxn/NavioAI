import fs from 'fs'; import path from 'path';
const exts = ['.js','.jsx','.ts','.tsx'];
const root = path.resolve('src');
function listFiles(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>{const p=path.join(dir,d.name);return d.isDirectory()?listFiles(p):[p];});}
function isSrcFile(f){return exts.includes(path.extname(f));}
function norm(p){return p.split(path.sep).join('/');}
const files = listFiles(root).filter(isSrcFile).map(norm);
const fileSet = new Set(files);
function tryResolve(fromFile,spec){
  if(!spec.startsWith('.')&& !spec.startsWith('/')) return null;
  const base = spec.startsWith('.')? norm(path.join(path.dirname(fromFile),spec)) : norm(spec);
  const candidates = [base,...exts.map(e=>base+e),...exts.map(e=>base+'/index'+e)];
  return candidates.find(c=>fileSet.has(c)) || null;
}
function parseImports(txt){
  const out=[]; const rx=[
    /import\s+[^'"]*['"]([^'"]+)['"]/g,
    /import\(['"]([^'"]+)['"]\)/g,
    /export\s+[^'"]*from\s+['"]([^'"]+)['"]/g,
    /require\(['"]([^'"]+)['"]\)/g
  ];
  for(const r of rx){ let m; while((m=r.exec(txt))){ out.push(m[1]); } }
  return out;
}
const entryCandidates = ['src/main.jsx','src/main.tsx','src/App.jsx','src/App.tsx'].filter(f=>fs.existsSync(f));
if(entryCandidates.length===0){console.log('# No entry found'); process.exit(0);}
const queue=[...entryCandidates.map(norm)];
const seen=new Set(queue);
while(queue.length){
  const f = queue.shift();
  let txt=''; try{ txt=fs.readFileSync(f,'utf8'); }catch{}
  for(const spec of parseImports(txt)){
    const r = tryResolve(f,spec);
    if(r && !seen.has(r)){ seen.add(r); queue.push(r); }
  }
}
const orphans = files.filter(f=>!seen.has(f));
console.log(orphans.join('\n'));
