#!/usr/bin/env python3
"""
server.py: Local standard-library HTTP server with robust byte-range support for Stardust score workbench.
Binds strictly to 127.0.0.1, prevents directory traversal, serves correct MIME types and no-store headers.
"""

import os
import sys
import argparse
import mimetypes
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import unquote, urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Accurate MIME type mappings
MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.m4a': 'audio/mp4',
    '.mp4': 'audio/mp4',
    '.mid': 'audio/midi',
    '.midi': 'audio/midi',
    '.musicxml': 'application/vnd.recordare.musicxml+xml',
    '.xml': 'application/xml; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8'
}


class WorkbenchRequestHandler(BaseHTTPRequestHandler):
    server_version = "StardustWorkbenchServer/1.0"

    def do_HEAD(self):
        self.handle_request(send_body=False)

    def do_GET(self):
        self.handle_request(send_body=True)

    def send_no_store_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")

    def handle_request(self, send_body=True):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        # Map root to index.html
        if path == "/" or path == "":
            path = "/index.html"

        # Sanitize path to prevent directory traversal
        rel_path = path.lstrip("/")
        # Resolve realpath
        target_path = os.path.realpath(os.path.join(BASE_DIR, rel_path))

        # Check traversal boundary
        if not (target_path == BASE_DIR or target_path.startswith(BASE_DIR + os.sep)):
            self.send_error(403, "Access Denied: Path outside tool directory")
            return

        # If it's a directory, check for index.html
        if os.path.isdir(target_path):
            target_path = os.path.join(target_path, "index.html")

        if not os.path.isfile(target_path):
            self.send_error(404, f"File Not Found: {path}")
            return

        file_size = os.path.getsize(target_path)
        ext = os.path.splitext(target_path)[1].lower()
        content_type = MIME_TYPES.get(ext, mimetypes.guess_type(target_path)[0] or "application/octet-stream")

        # Range header parsing
        range_header = self.headers.get("Range")
        if range_header:
            range_match = re.match(r"^bytes=(\d*)-(\d*)$", range_header.strip())
            if not range_match:
                # Malformed range header
                self.send_response(416, "Range Not Satisfiable")
                self.send_header("Content-Range", f"bytes */{file_size}")
                self.send_header("Content-Length", "0")
                self.send_no_store_headers()
                self.end_headers()
                return

            raw_start, raw_end = range_match.groups()
            if raw_start == "" and raw_end == "":
                # Invalid range
                self.send_response(416, "Range Not Satisfiable")
                self.send_header("Content-Range", f"bytes */{file_size}")
                self.send_header("Content-Length", "0")
                self.send_no_store_headers()
                self.end_headers()
                return
            elif raw_start == "":
                # Suffix byte range: e.g. -500
                suffix_len = int(raw_end)
                if suffix_len <= 0:
                    start = file_size
                else:
                    start = max(0, file_size - suffix_len)
                end = file_size - 1
            elif raw_end == "":
                start = int(raw_start)
                end = file_size - 1
            else:
                start = int(raw_start)
                end = int(raw_end)

            if start >= file_size or start > end or start < 0:
                self.send_response(416, "Range Not Satisfiable")
                self.send_header("Content-Range", f"bytes */{file_size}")
                self.send_header("Content-Length", "0")
                self.send_no_store_headers()
                self.end_headers()
                return

            end = min(end, file_size - 1)
            chunk_length = end - start + 1

            self.send_response(206, "Partial Content")
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
            self.send_header("Content-Length", str(chunk_length))
            self.send_header("Accept-Ranges", "bytes")
            self.send_no_store_headers()
            self.end_headers()

            if send_body:
                with open(target_path, "rb") as f:
                    f.seek(start)
                    bytes_remaining = chunk_length
                    buffer_size = 64 * 1024
                    while bytes_remaining > 0:
                        to_read = min(buffer_size, bytes_remaining)
                        chunk = f.read(to_read)
                        if not chunk:
                            break
                        try:
                            self.wfile.write(chunk)
                        except (BrokenPipeError, ConnectionResetError):
                            break
                        bytes_remaining -= len(chunk)
            return

        # Normal full 200 response
        self.send_response(200, "OK")
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(file_size))
        self.send_header("Accept-Ranges", "bytes")
        self.send_no_store_headers()
        self.end_headers()

        if send_body:
            with open(target_path, "rb") as f:
                buffer_size = 64 * 1024
                while True:
                    chunk = f.read(buffer_size)
                    if not chunk:
                        break
                    try:
                        self.wfile.write(chunk)
                    except (BrokenPipeError, ConnectionResetError):
                        break


def run_server(port=8791, host="127.0.0.1"):
    server_address = (host, port)
    httpd = HTTPServer(server_address, WorkbenchRequestHandler)
    print(f"Stardust Workbench server running at http://{host}:{port}/")
    print(f"Serving files from: {BASE_DIR}")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server gracefully...")
        httpd.shutdown()
        httpd.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Local HTTP server for Stardust score and lyrics tool")
    parser.add_argument("--port", type=int, default=8791, help="Port to bind (default: 8791)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host address to bind (default: 127.0.0.1)")
    args = parser.parse_args()

    run_server(port=args.port, host=args.host)
