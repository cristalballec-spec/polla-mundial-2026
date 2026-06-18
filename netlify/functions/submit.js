import { getStore } from "@netlify/blobs";
import { matchFinal } from "./_kick.js";

const SECRET="status-2026-admin";
const CORS={"content-type":"application/json","access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type"};
function ok(o){return o&&o.h!==""&&o.h!=null&&o.a!==""&&o.a!=null;}
const cleanCode=c=>(c||"STATUS").toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,24)||"STATUS";
const cleanId=i=>(i||"").toString().replace(/[^a-zA-Z0-9_-]/g,"").slice(0,64);

export default async (req)=>{
  if(req.method==="OPTIONS")return new Response("",{headers:CORS});
  if(req.method!=="POST")return new Response(JSON.stringify({error:"method"}),{status:405,headers:CORS});
  let body;
  try{body=await req.json();}catch(e){return new Response(JSON.stringify({error:"bad json"}),{status:400,headers:CORS});}

  // Acción administrativa interna: borrar un jugador de una liga (protegida por secreto, sin UI)
  if(body.action==="delete"){
    if(body.secret!==SECRET)return new Response(JSON.stringify({error:"forbidden"}),{status:403,headers:CORS});
    const dcode=cleanCode(body.league);
    const dpid=cleanId(body.playerId);
    if(!dpid)return new Response(JSON.stringify({error:"no playerId"}),{status:400,headers:CORS});
    const dstore=getStore("polla");
    try{await dstore.delete(`liga:${dcode}:p:${dpid}`);}catch(e){}
    try{
      let idx=await dstore.get(`liga:${dcode}:idx`,{type:"json",consistency:"strong"});
      if(Array.isArray(idx)){idx=idx.filter(x=>x!==dpid);await dstore.setJSON(`liga:${dcode}:idx`,idx);}
    }catch(e){}
    return new Response(JSON.stringify({ok:true,deleted:dpid,code:dcode}),{headers:CORS});
  }

  // Acción administrativa interna: purgar resultados inválidos (partidos no terminados o corruptos)
  if(body.action==="cleanresults"){
    if(body.secret!==SECRET)return new Response(JSON.stringify({error:"forbidden"}),{status:403,headers:CORS});
    const ccode=cleanCode(body.league);
    const cstore=getStore("polla");
    let cur={};try{cur=await cstore.get(`liga:${ccode}:results`,{type:"json",consistency:"strong"})||{};}catch(e){cur={};}
    const cleaned={},removed=[];
    Object.keys(cur).forEach(mid=>{
      const r=cur[mid];const h=String(r&&r.h),a=String(r&&r.a);
      if(/^\d{1,2}$/.test(h)&&/^\d{1,2}$/.test(a)&&matchFinal(mid))cleaned[mid]={h,a};else removed.push(mid);
    });
    try{await cstore.setJSON(`liga:${ccode}:results`,cleaned);}catch(e){}
    return new Response(JSON.stringify({ok:true,code:ccode,kept:Object.keys(cleaned),removed}),{headers:CORS});
  }

  const code=cleanCode(body.league);
  const playerId=cleanId(body.playerId);
  if(!playerId)return new Response(JSON.stringify({error:"no playerId"}),{status:400,headers:CORS});
  const name=(body.name||"Anónimo").toString().trim().slice(0,40)||"Anónimo";
  const preds=(body.preds&&typeof body.preds==="object")?body.preds:{};
  const bracket=(body.bracket&&typeof body.bracket==="object")?body.bracket:{};
  const results=(body.results&&typeof body.results==="object")?body.results:{};
  const extras=(body.extras&&typeof body.extras==="object")?body.extras:{};

  const store=getStore("polla");
  // 1) Guardar el blob propio del jugador (sin condición de carrera)
  await store.setJSON(`liga:${code}:p:${playerId}`,{playerId,name,preds,bracket,extras,updatedAt:Date.now()});

  // 1b) Índice de jugadores de la liga (para listado inmediato, sin depender del list eventual)
  try{
    let idx=await store.get(`liga:${code}:idx`,{type:"json",consistency:"strong"});
    if(!Array.isArray(idx))idx=[];
    if(!idx.includes(playerId)){idx.push(playerId);await store.setJSON(`liga:${code}:idx`,idx);}
  }catch(e){}

  // 2) Mezclar resultados oficiales en la clave compartida (lectura fuerte) — solo partidos terminados y válidos
  const clean={};
  Object.keys(results).forEach(mid=>{const r=results[mid];if(!ok(r))return;const h=String(r.h),a=String(r.a);if(!/^\d{1,2}$/.test(h)||!/^\d{1,2}$/.test(a))return;if(!matchFinal(mid))return;clean[mid]={h,a};});
  if(Object.keys(clean).length){
    let cur=null;try{cur=await store.get(`liga:${code}:results`,{type:"json",consistency:"strong"});}catch(e){cur=null;}
    cur=cur||{};
    let changed=false;
    Object.keys(clean).forEach(mid=>{if(!cur[mid]||cur[mid].h!==clean[mid].h||cur[mid].a!==clean[mid].a){cur[mid]=clean[mid];changed=true;}});
    if(changed){try{await store.setJSON(`liga:${code}:results`,cur);}catch(e){}}
  }
  return new Response(JSON.stringify({ok:true,code}),{headers:CORS});
};
