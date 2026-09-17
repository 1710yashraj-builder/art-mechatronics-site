/* Which country is this visitor in? Cloudflare already knows (request.cf.country);
   the page uses it once, to put the visitor's nearest ART office first in the
   WhatsApp/call picker (TH → Thailand, AE → UAE, IN → India). Nothing is stored. */
export function onRequestGet({ request }) {
  const c = (request.cf && request.cf.country) || request.headers.get("cf-ipcountry") || "";
  return new Response(JSON.stringify({ c: String(c).slice(0, 2).toUpperCase() }), {
    headers: { "content-type": "application/json", "cache-control": "private, max-age=3600" },
  });
}
