import { loadAll } from './storage';
let lastAppliedSig=null;
function sigOf(o){try{return JSON.stringify(o??null)}catch{return'x'}}
export function canApplyRemote(remote){
  const { meta, active, archive } = loadAll();
  const quiet = Date.now() - (meta?.lastWriteAt||0) > 4000;
  if(!quiet) return false;
  const remoteSig=sigOf(remote); const localSig=sigOf({active,archive});
  if(remoteSig===lastAppliedSig || remoteSig===localSig) return false;
  lastAppliedSig=remoteSig; return true;
}
