/* Aggregates for the private report page. Read-only; needs the REPORT_KEY
   secret so the numbers are not public, but nothing here is personal data. */
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!env.REPORT_KEY || url.searchParams.get("key") !== env.REPORT_KEY) return new Response("forbidden", { status: 403 });
  const days = Math.min(365, Math.max(7, parseInt(url.searchParams.get("days") || "30", 10) || 30));
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const q = (sql, ...args) => env.DB.prepare(sql).bind(...args);
  const [byType, byMarket, byCountry, daily, topEnqPages, topViewPages, refs, lifetime, first] = await env.DB.batch([
    q("SELECT type, COUNT(*) n FROM events WHERE ts>=? GROUP BY type", since),
    q("SELECT market, COUNT(*) n FROM events WHERE ts>=? AND type!='view' GROUP BY market", since),
    q("SELECT country, COUNT(*) n FROM events WHERE ts>=? AND type='view' AND country!='' GROUP BY country ORDER BY n DESC LIMIT 10", since),
    q("SELECT date(ts,'unixepoch') d, SUM(type='view') views, SUM(type!='view') enq FROM events WHERE ts>=? GROUP BY d ORDER BY d", since),
    q("SELECT path, COUNT(*) n FROM events WHERE ts>=? AND type!='view' GROUP BY path ORDER BY n DESC LIMIT 8", since),
    q("SELECT path, COUNT(*) n FROM events WHERE ts>=? AND type='view' GROUP BY path ORDER BY n DESC LIMIT 8", since),
    q("SELECT ref, COUNT(*) n FROM events WHERE ts>=? AND type='view' AND ref!='' GROUP BY ref ORDER BY n DESC LIMIT 8", since),
    q("SELECT SUM(type='view') views, SUM(type!='view') enq FROM events"),
    q("SELECT MIN(ts) t FROM events"),
  ]);
  const body = {
    days, since, generated: Math.floor(Date.now() / 1000),
    byType: byType.results, byMarket: byMarket.results, byCountry: byCountry.results, daily: daily.results,
    topEnquiryPages: topEnqPages.results, topViewPages: topViewPages.results, referrers: refs.results,
    lifetime: lifetime.results[0], firstEvent: (first.results[0] || {}).t || null,
  };
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
