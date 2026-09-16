/* Enquiry + pageview beacon. First-party and cookieless: the page sends
   {t, m, p, r} with navigator.sendBeacon; we add the visitor's country from
   Cloudflare and store nothing else — no IP, no user agent, no cookie. That is
   what lets the site skip a consent banner in Thailand (PDPA) and the UAE. */
const TYPES = new Set(["view", "whatsapp", "call", "email", "form"]);
const MARKETS = new Set(["india", "uae", "thailand", ""]);

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return new Response(null, { status: 400 }); }
  const type = TYPES.has(b.t) ? b.t : null;
  if (!type) return new Response(null, { status: 400 });
  const ua = request.headers.get("user-agent") || "";
  // crawlers and audit tools inflate views; they never make enquiries anyway
  if (/bot|crawl|spider|lighthouse|pagespeed|headless/i.test(ua)) return new Response(null, { status: 204 });
  const market = MARKETS.has(b.m) ? b.m : "";
  const path = String(b.p || "").slice(0, 160).replace(/[^\w\-\/.#%]/g, "");
  let ref = "";
  try { if (b.r) ref = new URL(b.r).hostname.replace(/^www\./, "").slice(0, 80); } catch { ref = ""; }
  if (ref === "artmechatronics.com" || ref.endsWith(".pages.dev")) ref = "";
  const country = (request.cf && request.cf.country) || request.headers.get("cf-ipcountry") || "";
  await env.DB.prepare("INSERT INTO events (ts, type, market, path, ref, country) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(Math.floor(Date.now() / 1000), type, market, path, ref, String(country).slice(0, 2)).run();
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

export function onRequest() { return new Response(null, { status: 405 }); }
