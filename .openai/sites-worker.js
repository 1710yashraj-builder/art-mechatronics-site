/**
 * Minimal Sites runtime for the generated ART Mechatronics catalogue.
 * All page and media files are served from the deployment's static asset binding.
 */
export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || !["GET", "HEAD"].includes(request.method)) {
      return response;
    }

    const url = new URL(request.url);
    if (url.pathname.endsWith("/")) {
      url.pathname += "index.html";
    } else if (!url.pathname.split("/").at(-1).includes(".")) {
      url.pathname += ".html";
    } else {
      return response;
    }

    return env.ASSETS.fetch(new Request(url, request));
  },
};
