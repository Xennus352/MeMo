#!/usr/bin/env python3
"""
Nara Mini v1 (Shoon voice) local HTTP text-to-speech service for MeMo 💕.

Wraps the model's own ONNX inference (synthesize.py) behind a tiny stdlib-only
HTTP server so the app can speak reminder text locally — no cloud, no API key,
no Python packages beyond the requirements below. It binds to 127.0.0.1 by
default; set NARA_HOST=0.0.0.0 to reach it from another device on your LAN
(handy for a paired phone on the same Wi-Fi).

Setup (once):
  python3 -m venv .nara/nara-venv
  .nara/nara-venv/bin/pip install numpy onnxruntime misaki==0.7.4 \
      phonemizer-fork==3.3.2 espeakng-loader==0.2.4

Run:
  .nara/nara-venv/bin/python scripts/nara_tts_server.py

Endpoints:
  GET  /health          -> {"ok": true, "voice": "shoon"}
  GET  /                -> attribution + license (Apache 2.0)
  POST /tts             -> {"text": "..."}  returns audio/wav (24 kHz mono 16-bit)

License notes: output is Nara Mini v1 by the Nara contributors (Apache 2.0,
https://naraaudio.app, https://huggingface.co/YeeNyunn/nara-mini-v1). Nara
Mini v1 attribution must be preserved in distributed derivatives.
"""

import argparse
import hashlib
import json
import sys
import wave
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# Point phonemizer at the pip-bundled espeak-ng before any misaki import
from espeakng_loader import get_library_path, get_data_path
from phonemizer.backend.espeak.wrapper import EspeakWrapper

EspeakWrapper.set_library(get_library_path())
EspeakWrapper.set_data_path(get_data_path())

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_DIR = REPO_ROOT / '.nara' / 'nara-mini-v1'

MODEL_DIR: Path
VOICE: str
THREADS: int


@lru_cache(maxsize=64)
def synthesize_wav_bytes(text: str) -> bytes:
    model = MODEL_DIR / 'onnx' / VOICE
    if not model.exists():
        raise RuntimeError(f'Model not found at {model}')
    sys.path.insert(0, str(MODEL_DIR))
    try:
        import synthesize  # noqa: WPS433 - the model's own CLI module
        samples = synthesize.synthesize(model, text, THREADS)
    finally:
        try:
            sys.path.remove(str(MODEL_DIR))
        except ValueError:
            pass

    import io
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setparams((1, 2, 24000, 0, 'NONE', 'not compressed'))
        wf.writeframes((samples * 32767).astype('<i2').tobytes())
    return buf.getvalue()


class TtsHandler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def _send(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, payload) -> None:
        self._send(code, json.dumps(payload).encode('utf-8'), 'application/json; charset=utf-8')

    def log_message(self, fmt: str, *args) -> None:  # noqa: N802 - http.server API
        sys.stderr.write('nara-tts %s\n' % (fmt % args))

    def do_OPTIONS(self) -> None:
        self._send(204, b'', 'text/plain')

    def do_GET(self) -> None:
        if self.path == '/health':
            self._json(200, {'ok': True, 'voice': VOICE, 'model': str(MODEL_DIR)})
            return
        if self.path == '/':
            self._json(200, {
                'service': 'Nara Mini v1 · Shoon voice',
                'license': 'Apache-2.0',
                'attribution': 'Uses Nara Mini v1 by Nara contributors, a Kokoro-based Burmese and English speech model. https://naraaudio.app · https://huggingface.co/YeeNyunn/nara-mini-v1',
                'text-to-speech': 'local, no data leaves this machine',
            })
            return
        self._json(404, {'error': 'not_found'})

    def do_POST(self) -> None:
        if self.path != '/tts':
            self._json(404, {'error': 'not_found'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            self._json(400, {'error': 'bad_content_length'})
            return
        if length <= 0 or length > 8 * 1024:
            self._json(400, {'error': 'text_too_long'})
            return
        try:
            payload = json.loads(self.rfile.read(length) or b'{}')
        except json.JSONDecodeError:
            self._json(400, {'error': 'bad_json'})
            return
        text = str((payload or {}).get('text', '')).strip()
        if not text:
            self._json(400, {'error': 'missing_text'})
            return
        if len(text) > 400:
            text = text[:400]
        try:
            wav = synthesize_wav_bytes(text)
        except Exception as error:  # noqa: BLE001 - report, don't crash the server
            self._json(500, {'error': str(error)})
            return
        self._send(200, wav, 'audio/wav')


def main() -> None:
    global MODEL_DIR, VOICE, THREADS

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--port', type=int, default=8899)
    ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--model-dir', default=str(DEFAULT_MODEL_DIR))
    ap.add_argument('--voice', default='shoon', choices=['shoon', 'thazin', 'ko-banyar', 'htet-myat'])
    ap.add_argument('--threads', type=int, default=4)
    args = ap.parse_args()

    MODEL_DIR = Path(args.model_dir)
    VOICE = args.voice
    THREADS = args.threads

    if not (MODEL_DIR / 'onnx' / VOICE / 'encoder.onnx').exists():
        print(f'ERROR: model not found at {MODEL_DIR}/onnx/{VOICE}', file=sys.stderr)
        sys.exit(2)

    server = ThreadingHTTPServer((args.host, args.port), TtsHandler)
    print(f'Nara TTS · voice={VOICE} · listening on http://{args.host}:{args.port}')
    print('Try: curl -X POST http://127.0.0.1:%d/tts -H "Content-Type: application/json" -d \'{"text": "Hello!"}\'' % args.port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == '__main__':
    main()
