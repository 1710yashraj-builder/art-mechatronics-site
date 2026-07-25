#!/usr/bin/env python3
"""Local preview server that behaves like Cloudflare Pages.

Cloudflare Pages serves foo.html at /foo and 308-redirects /foo.html -> /foo.
Python's plain http.server does neither, so testing with it gives a false
picture: extensionless links 404 locally but work in production, and .html
links work locally but redirect in production.

This mirrors production so local verification actually means something:
  /foo        -> serves foo.html
  /foo.html   -> 308 to /foo
  /           -> index.html
  missing     -> 404.html with a real 404 status

Usage:  python3 serve-local.py [port] [--dir dist/client]
"""
import http.server
import os
import posixpath
import socketserver
import sys
import urllib.parse

port = 4180
directory = "."
args = sys.argv[1:]
if args and args[0].isdigit():
    port = int(args[0]); args = args[1:]
if "--dir" in args:
    directory = args[args.index("--dir") + 1]

ROOT = os.path.abspath(directory)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def send_head(self):
        parsed = urllib.parse.urlsplit(self.path)
        path = urllib.parse.unquote(parsed.path)
        query = f"?{parsed.query}" if parsed.query else ""

        # /foo.html -> 308 /foo   (and /index.html -> /)
        if path.endswith(".html"):
            target = path[: -len(".html")]
            if target.endswith("/index"):
                target = target[: -len("index")]
            elif target == "/index":
                target = "/"
            self.send_response(308)
            self.send_header("Location", target + query)
            self.end_headers()
            return None

        local = os.path.join(ROOT, path.lstrip("/"))
        # A sibling FILE beats a directory of the same name: the site has both
        # industries.html and industries/, and Cloudflare serves the file for
        # /industries. Checking the .html first keeps local behaviour identical.
        if not path.endswith("/") and os.path.exists(local + ".html"):
            self.path = path + ".html" + query
            return super().send_head()
        if os.path.isdir(local):
            if os.path.exists(os.path.join(local, "index.html")):
                return super().send_head()
            return self.not_found()
        if not os.path.exists(local):
            return self.not_found()
        return super().send_head()

    def not_found(self):
        page = os.path.join(ROOT, "404.html")
        if not os.path.exists(page):
            self.send_error(404)
            return None
        body = open(page, "rb").read()
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        return __import__("io").BytesIO(body)

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", port), Handler) as httpd:
    print(f"Serving {ROOT} on http://127.0.0.1:{port} (Cloudflare Pages URL behaviour)")
    httpd.serve_forever()
