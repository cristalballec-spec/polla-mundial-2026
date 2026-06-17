import { getStore } from "@netlify/blobs";
import { matchFinal } from "./_kick.js";

const CORS={"content-type":"application/json","access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type"};
function hasScore(o){return o&&o.h!==""&&o.h!=null&&o.a!==""&&o.a!=null;}
function outcome(h,a){return h>a?"H":h<a?"A":"D";}
function evalP(r,p){
  if(!hasScore(r)||!hasScore(p))return{st:"pending",pts:0};
  const rh=+r.h,ra=+r.a,ph=+p.h,pa=+p.a;
  if(rh===ph&&ra===pa)return{st:"exact",pts:5};
  if(outcome(rh,ra)===outcome(ph,pa))return{st:"partial",pts:3};
  return{st:"miss",pts:0};
}
const cleanCode=c=>(c||"STATUS").toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,24)||"STATUS";

export default async (req)=>{
  if(req.method==="OPTIONS")return new Response("",{headers:CORS});
  const url=new URL(req.url);
  const code=cleanCode(url.searchParams.get("league"));
  const store=getStore("polla");
  let results={};
  try{results=(await store.get(`liga:${code}:results`,{type:"json",consistency:"strong"}))||{};}catch(e){results={};}
  // Defensa: solo contar resultados de partidos terminados y válidos (ignora futuros/corruptos)
  const cleanR={};
  Object.keys(results).forEach(mid=>{const r=results[mid];const h=String(r&&r.h),a=String(r&&r.a);if(/^\d{1,2}$/.test(h)&&/^\d{1,2}$/.test(a)&&matchFinal(mid))cleanR[mid]=r;});
  results=cleanR;
  let ids=new Set();
  try{const idx=await store.get(`liga:${code}:idx`,{type:"json",consistency:"strong"});if(Array.isArray(idx))idx.forEach(i=>{if(i)ids.add(i);});}catch(e){}
  try{const listing=await store.list({prefix:`liga:${code}:p:`});(listing.blobs||[]).forEach(b=>{const pid=b.key.split(":p:")[1];if(pid)ids.add(pid);});}catch(e){}
  const players=[];
  for(const pid of ids){
    try{const pl=await store.get(`liga:${code}:p:${pid}`,{type:"json",consistency:"strong"});if(pl)players.push(pl);}catch(e){}
  }
  const board=players.map(pl=>{
    const preds=pl.preds||{};
    let pts=0,exact=0,partial=0,miss=0,played=0,predCount=0;
    Object.keys(preds).forEach(mid=>{
      if(hasScore(preds[mid]))predCount++;
      const e=evalP(results[mid],preds[mid]);
      if(e.st==="pending")return;
      pts+=e.pts;played++;
      if(e.st==="exact")exact++;else if(e.st==="partial")partial++;else miss++;
    });
    return{playerId:pl.playerId||"",name:pl.name||"Anónimo",pts,exact,partial,miss,played,predCount,updatedAt:pl.updatedAt||0};
  }).sort((a,b)=>b.pts-a.pts||b.exact-a.exact||a.name.localeCompare(b.name));
  // entries: pronósticos por jugador SOLO de partidos con resultado (privacidad + suficiente para jornadas)
  const entries=players.map(pl=>{
    const preds=pl.preds||{};const fp={};
    Object.keys(preds).forEach(mid=>{if(results[mid])fp[mid]=preds[mid];});
    return{playerId:pl.playerId||"",name:pl.name||"Anónimo",preds:fp};
  });
  return new Response(JSON.stringify({code,results,leaderboard:board,entries,players:board.length}),{headers:CORS});
};
