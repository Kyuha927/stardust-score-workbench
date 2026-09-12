#!/usr/bin/env python3
"""
test_server.py: Automated test suite for server.py.
Launches server.py on an ephemeral port, verifies endpoints, MIME types, byte-range responses,
invalid range handling, traversal protection, and cleanly terminates the server.
"""

import sys
import os
import time
import socket
import subprocess
import urllib.request
import urllib.error

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

def run_tests():
    port = find_free_port()
    base_url = f"http://127.0.0.1:{port}"
    print(f"--- LAUNCHING SERVER ON EPHEMERAL PORT {port} ---")

    server_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server.py")
    proc = subprocess.Popen(
        [sys.executable, server_script, "--port", str(port), "--host", "127.0.0.1"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    try:
        # Wait for server to start
        max_attempts = 30
        connected = False
        for _ in range(max_attempts):
            try:
                with urllib.request.urlopen(f"{base_url}/", timeout=1) as resp:
                    if resp.status == 200:
                        connected = True
                        break
            except Exception:
                time.sleep(0.1)

        if not connected:
            raise RuntimeError("Server failed to start and respond within 3 seconds")

        print("✓ Server launched and responding.")

        # 1. Test index.html
        req = urllib.request.Request(f"{base_url}/index.html")
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200, f"Expected 200, got {resp.status}"
            content_type = resp.headers.get("Content-Type", "")
            assert "text/html" in content_type, f"Expected text/html, got {content_type}"
            cache_ctrl = resp.headers.get("Cache-Control", "")
            assert "no-store" in cache_ctrl, "Expected no-store cache header"
            print(f"✓ index.html endpoint verified ({content_type})")

        # 2. Test state.mjs
        req = urllib.request.Request(f"{base_url}/state.mjs")
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200, f"Expected 200, got {resp.status}"
            content_type = resp.headers.get("Content-Type", "")
            assert "javascript" in content_type, f"Expected javascript, got {content_type}"
            print(f"✓ state.mjs endpoint verified ({content_type})")

        # 3. Test stardust-score-data.json
        req = urllib.request.Request(f"{base_url}/assets/stardust-score-data.json")
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200, f"Expected 200, got {resp.status}"
            content_type = resp.headers.get("Content-Type", "")
            assert "application/json" in content_type, f"Expected application/json, got {content_type}"
            print(f"✓ score data JSON endpoint verified ({content_type})")

        # 4. Test score SVG page
        req = urllib.request.Request(f"{base_url}/assets/pages/stardust-lead-score-page-01.svg")
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200, f"Expected 200, got {resp.status}"
            content_type = resp.headers.get("Content-Type", "")
            assert "image/svg+xml" in content_type, f"Expected image/svg+xml, got {content_type}"
            print(f"✓ score SVG page endpoint verified ({content_type})")

        # 5. Test MusicXML
        req = urllib.request.Request(f"{base_url}/assets/stardust-lead-with-lyrics.musicxml")
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200, f"Expected 200, got {resp.status}"
            content_type = resp.headers.get("Content-Type", "")
            assert "xml" in content_type, f"Expected XML MIME type, got {content_type}"
            print(f"✓ MusicXML endpoint verified ({content_type})")

        # 6. Test MIDI
        req = urllib.request.Request(f"{base_url}/assets/stardust-lead-with-lyrics.mid")
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200, f"Expected 200, got {resp.status}"
            content_type = resp.headers.get("Content-Type", "")
            assert "audio/midi" in content_type, f"Expected audio/midi, got {content_type}"
            print(f"✓ MIDI endpoint verified ({content_type})")

        # 7. Test 1024-byte M4A range request
        req = urllib.request.Request(f"{base_url}/assets/Stardust-R01-JP-Cinematic-Opening_vocals.m4a")
        req.add_header("Range", "bytes=0-1023")
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 206, f"Expected 206 Partial Content, got {resp.status}"
            content_range = resp.headers.get("Content-Range", "")
            assert content_range.startswith("bytes 0-1023/"), f"Unexpected Content-Range: {content_range}"
            content_len = int(resp.headers.get("Content-Length", "0"))
            assert content_len == 1024, f"Expected length 1024, got {content_len}"
            body = resp.read()
            assert len(body) == 1024, f"Expected body size 1024, got {len(body)}"
            print(f"✓ 1024-byte range request verified (Status 206, Content-Range: {content_range})")

        # 8. Test Multi-Staff MusicXML
        req = urllib.request.Request(f"{base_url}/assets/stardust-multistaff.musicxml")
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200, f"Expected 200, got {resp.status}"
            content_type = resp.headers.get("Content-Type", "")
            assert "xml" in content_type, f"Expected XML MIME type, got {content_type}"
            print(f"✓ Multi-Staff MusicXML endpoint verified ({content_type})")

        # 9. Test Multi-Staff MIDI
        req = urllib.request.Request(f"{base_url}/assets/stardust-multistaff.mid")
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200, f"Expected 200, got {resp.status}"
            content_type = resp.headers.get("Content-Type", "")
            assert "audio/midi" in content_type, f"Expected audio/midi, got {content_type}"
            print(f"✓ Multi-Staff MIDI endpoint verified ({content_type})")

        # 10. Test Multi-Staff SVG page
        req = urllib.request.Request(f"{base_url}/assets/pages/stardust-multistaff-page-01.svg")
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200, f"Expected 200, got {resp.status}"
            content_type = resp.headers.get("Content-Type", "")
            assert "image/svg+xml" in content_type, f"Expected image/svg+xml, got {content_type}"
            print(f"✓ Multi-Staff SVG page endpoint verified ({content_type})")

        # 11. Test per-stem SVG pages (Drums, Bass, Other, Vocals)
        for stem_name in ["drums", "bass", "other", "vocals"]:
            req = urllib.request.Request(f"{base_url}/assets/pages/stardust-{stem_name}-page-01.svg")
            with urllib.request.urlopen(req) as resp:
                assert resp.status == 200, f"Expected 200 for {stem_name}, got {resp.status}"
                content_type = resp.headers.get("Content-Type", "")
                assert "image/svg+xml" in content_type, f"Expected image/svg+xml, got {content_type}"
        print("✓ All 4 individual stem SVG score pages verified (Drums, Bass, Other, Vocals)")

        # 12. Test Flow stem byte-range requests for all 4 stems
        for stem_name in ["drums", "bass", "other", "vocals"]:
            req = urllib.request.Request(f"{base_url}/assets/flow-stems/{stem_name}.m4a")
            req.add_header("Range", "bytes=0-2047")
            with urllib.request.urlopen(req) as resp:
                assert resp.status == 206, f"Expected 206 for {stem_name}.m4a, got {resp.status}"
                content_range = resp.headers.get("Content-Range", "")
                assert content_range.startswith("bytes 0-2047/"), f"Unexpected Content-Range for {stem_name}: {content_range}"
                content_len = int(resp.headers.get("Content-Length", "0"))
                assert content_len == 2048, f"Expected length 2048, got {content_len}"
                body = resp.read()
                assert len(body) == 2048, f"Expected body size 2048, got {len(body)}"
        print("✓ All 4 Flow stem audio byte-range requests verified (Drums, Bass, Other, Vocals)")

        # 13. Test Contact Sheet
        req = urllib.request.Request(f"{base_url}/assets/score-contact-sheet.png")
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200, f"Expected 200, got {resp.status}"
            content_type = resp.headers.get("Content-Type", "")
            assert "image/png" in content_type, f"Expected image/png, got {content_type}"
            print(f"✓ Contact sheet PNG verified ({content_type})")

        # 14. Test invalid range request (returns 416)
        req = urllib.request.Request(f"{base_url}/assets/Stardust-R01-JP-Cinematic-Opening_vocals.m4a")
        req.add_header("Range", "bytes=999999999-999999999")
        try:
            urllib.request.urlopen(req)
            assert False, "Expected HTTPError 416 Range Not Satisfiable"
        except urllib.error.HTTPError as e:
            assert e.code == 416, f"Expected 416, got {e.code}"
            content_range = e.headers.get("Content-Range", "")
            assert content_range.startswith("bytes */"), f"Expected 'bytes */...', got {content_range}"
            print(f"✓ Invalid range request returns 416 (Content-Range: {content_range})")

        # 15. Test directory traversal denial
        traversal_attempts = [
            f"{base_url}/../../../../etc/passwd",
            f"{base_url}/assets/../../server.py",
            f"{base_url}/..%2f..%2fetc/passwd"
        ]
        for trav_url in traversal_attempts:
            try:
                urllib.request.urlopen(trav_url)
                assert False, f"Expected traversal denial for {trav_url}"
            except urllib.error.HTTPError as e:
                assert e.code in (403, 404), f"Expected 403 or 404, got {e.code}"
        print("✓ Directory traversal protection verified (all attempts denied with 403/404).")

        print("--- ALL SERVER TESTS PASSED SUCCESSFULLY! ---")

    finally:
        print("Stopping server subprocess...")
        proc.terminate()
        try:
            proc.wait(timeout=3)
            print("Server subprocess terminated cleanly.")
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
            print("Server subprocess killed.")

if __name__ == "__main__":
    run_tests()
