"""OpenEngQuiz speech service: pronunciation assessment (Pronunciada) and TTS (Kokoro).

Only the Next.js server calls this service, with a shared bearer token. Audio is processed in
memory/temp files and never stored.
"""

import asyncio
import hmac
import io
import os
import subprocess
import tempfile
from functools import lru_cache

import numpy as np
import onnxruntime
import pronunciada
import soundfile as sf
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response
from kokoro_onnx import Kokoro
from pydantic import BaseModel, Field

TOKEN = os.environ.get("SPEECH_API_TOKEN", "")
MAX_AUDIO_BYTES = 5 * 1024 * 1024
MAX_AUDIO_SECONDS = 60
MODELS_DIR = os.environ.get("MODELS_DIR", "/models")

if len(TOKEN) < 32:
    raise RuntimeError("SPEECH_API_TOKEN must be set (at least 32 characters)")

app = FastAPI(title="openengquiz-speech", docs_url=None, redoc_url=None)
# The VPS is shared with other apps: run at most two model jobs at once.
jobs = asyncio.Semaphore(int(os.environ.get("MAX_CONCURRENT_JOBS", "2")))


def require_token(authorization: str = Header(default="")) -> None:
    expected = f"Bearer {TOKEN}"
    if not hmac.compare_digest(authorization.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="unauthorized")


@lru_cache(maxsize=1)
def kokoro() -> Kokoro:
    # Thread count dominates Kokoro latency on CPU (2 threads ~5.5 s, 6 threads ~3 s for a
    # 7 s sentence), so it is configurable instead of inheriting OMP_NUM_THREADS.
    options = onnxruntime.SessionOptions()
    options.intra_op_num_threads = int(os.environ.get("KOKORO_THREADS", "4"))
    options.inter_op_num_threads = 1
    session = onnxruntime.InferenceSession(
        f"{MODELS_DIR}/kokoro-v1.0.int8.onnx", options, providers=["CPUExecutionProvider"],
    )
    return Kokoro.from_session(session, f"{MODELS_DIR}/voices-v1.0.bin")


@app.on_event("startup")
def warm_up() -> None:
    # Load both models once so the first user request is not slow.
    kokoro().create("ready", voice="af_heart", speed=1.0, lang="en-us")
    silence = (np.zeros(16000, dtype=np.float32), 16000)
    try:
        pronunciada.score(silence, "ready")
    except Exception as error:  # Silence may be rejected after the model loads; log anything else.
        print(f"pronunciada warm-up: {type(error).__name__}: {error}", flush=True)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


def to_wav_16k(data: bytes) -> bytes:
    """Decodes any browser recording (webm/ogg/mp4/wav) to 16 kHz mono WAV with ffmpeg."""
    with tempfile.NamedTemporaryFile() as src:
        src.write(data)
        src.flush()
        result = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", src.name, "-t", str(MAX_AUDIO_SECONDS),
             "-ac", "1", "-ar", "16000", "-f", "wav", "pipe:1"],
            capture_output=True, timeout=20, check=False,
        )
    if result.returncode != 0 or not result.stdout:
        raise HTTPException(status_code=400, detail="unreadable audio")
    return result.stdout


def issue_summary(tip) -> dict:
    """Coaching entries are dicts (schema v2); keep the fields the app turns into Vietnamese tips."""
    data = tip if isinstance(tip, dict) else getattr(tip, "to_dict", lambda: {"kind": str(tip)})()
    return {
        "kind": data.get("kind"),
        "word": data.get("word"),
        "word_index": data.get("word_index"),
        "expected": data.get("expected_ipa") or data.get("expected"),
        "heard": data.get("heard_ipa") or data.get("heard"),
        "error_prob": data.get("error_prob"),
        "features": [
            {"feature": f.get("feature"), "expected": f.get("expected"), "heard": f.get("heard")}
            for f in data.get("features") or []
        ],
    }


def summarize(result) -> dict:
    """Keeps what the app shows: scores per sentence, word and phone, plus coaching tips."""
    scores = result.scores or {}
    return {
        "text": result.text,
        "score": result.prob,
        "accuracy": scores.get("accuracy"),
        "fluency": result.fluency,
        "completeness": result.completeness,
        "words": [
            {
                "text": w.text,
                "score": w.prob,
                "omitted": w.omitted,
                "start": w.start,
                "end": w.end,
                "phones": [{"ipa": p.ipa, "score": p.prob, "heard": p.heard} for p in w.phones],
            }
            for w in result.words
        ],
        "issues": [issue_summary(tip) for tip in (result.coaching() or [])],
        "warnings": [str(w) for w in (result.warnings or [])],
    }


@app.post("/assess", dependencies=[Depends(require_token)])
async def assess(
    audio: UploadFile = File(...),
    text: str = Form(..., min_length=1, max_length=2000),
    strictness: float = Form(0.5, ge=0.0, le=1.0),
) -> dict:
    data = await audio.read(MAX_AUDIO_BYTES + 1)
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="audio too large")
    async with jobs:
        wav = await asyncio.to_thread(to_wav_16k, data)
        result = await asyncio.to_thread(pronunciada.score, wav, text, "en", strictness)
    return summarize(result)


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    voice: str = "af_heart"
    speed: float = Field(1.0, ge=0.5, le=1.5)


@app.post("/tts", dependencies=[Depends(require_token)])
async def tts(body: TtsRequest) -> Response:
    if body.voice not in kokoro().get_voices():
        raise HTTPException(status_code=400, detail="unknown voice")
    lang = "en-gb" if body.voice.startswith("b") else "en-us"
    async with jobs:
        samples, rate = await asyncio.to_thread(
            kokoro().create, body.text, voice=body.voice, speed=body.speed, lang=lang,
        )
    out = io.BytesIO()
    sf.write(out, samples, rate, format="MP3")
    return Response(content=out.getvalue(), media_type="audio/mpeg")
