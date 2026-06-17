const CORS = {"content-type":"application/json","access-control-allow-origin":"*"};

export default async (req) => {
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260720",
      { headers: {"User-Agent":"Mozilla/5.0"} }
    );
    const data = await res.json();
    return new Response(JSON.stringify(data), { headers: CORS });
  } catch(e) {
    return new Response(JSON.stringify({error:e.message,events:[]}), {status:500, headers:CORS});
  }
};
