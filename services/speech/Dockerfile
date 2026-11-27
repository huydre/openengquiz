FROM python:3.12-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kokoro model files (Apache-2.0), baked into the image.
RUN mkdir /models \
  && curl -sSL -o /models/kokoro-v1.0.int8.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx \
  && curl -sSL -o /models/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

COPY app.py .

RUN useradd --create-home speech
USER speech
ENV HOME=/home/speech
# Download Pronunciada's acoustic model at build time (it would otherwise download on first use).
# Scoring one second of silence may raise after the model loads, so only the cache dir is checked.
RUN (python -c "import numpy as np, pronunciada; pronunciada.score((np.zeros(16000, dtype=np.float32), 16000), 'ready')" || true) \
  && test -d /home/speech/.cache/pronunciada
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s CMD curl -fsS http://127.0.0.1:8000/health || exit 1
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
