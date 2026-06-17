const CORS={"content-type":"application/json","access-control-allow-origin":"*","access-control-allow-methods":"GET,OPTIONS","access-control-allow-headers":"content-type"};

export default async (req)=>{
  if(req.method==="OPTIONS")return new Response("",{headers:CORS});
  try{
    const url="https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260720";
    const res=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0"},cache:"no-store"});
    const data=await res.json();
    return new Response(JSON.stringify(data),{headers:CORS});
  }catch(e){
    return new Response(JSON.stringify({error:e.message,events:[]}),{status:500,headers:CORS});
  }
};

export const config={path:"/api/scores"};
