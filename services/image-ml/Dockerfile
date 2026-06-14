# MedAccess Image ML — sidecar container
# Lean Python 3.11 base. Add CUDA layer later if GPU inference is needed.
# Last modified: 2026-06-14  Temirlan — added COPY model_manager.py (was missing, caused boot crash)

FROM python:3.11-slim

WORKDIR /app

# OpenCV needs a couple of native libs even on the headless build
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY model_manager.py .

EXPOSE 5001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001"]
