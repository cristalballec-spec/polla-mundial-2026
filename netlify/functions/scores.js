const CORS = {"content-type":"application/json","access-control-allow-origin":"*"};
const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

export default async (req) => {
  try {
    const url = new URL(req.url);
    const event = url.searchParams.get("event");
    // Si viene ?event=ID, devolver el summary (para córners); si no, el scoreboard
    const target = event
      ? `${BASE}/summary?event=${encodeURIComponent(event)}`
      : `${BASE}/scoreboard?dates=20260611-20260720`;
    const res = await fetch(target, { headers: {"User-Agent":"Mozilla/5.0"} });
    const data = await res.json();
    return new Response(JSON.stringify(data), { headers: CORS });
  } catch(e) {
    return new Response(JSON.stringify({error:e.message,events:[]}), {status:500, headers:CORS});
  }
};
