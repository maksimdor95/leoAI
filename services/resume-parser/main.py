from __future__ import annotations

import base64
import binascii
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from extractor import extract_pdf_text


class ExtractTextRequest(BaseModel):
    filename: str = Field(min_length=1)
    mimeType: str = Field(min_length=1)
    contentBase64: str = Field(min_length=1)


class ExtractTextMeta(BaseModel):
    pages: int
    method: str
    hasTextLayer: bool
    charCount: int


class ExtractTextResponse(BaseModel):
    status: str
    text: str
    meta: ExtractTextMeta


app = FastAPI(title="resume-parser", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/extract-text", response_model=ExtractTextResponse)
def extract_text(payload: ExtractTextRequest) -> dict[str, Any]:
    if "pdf" not in payload.mimeType.lower() and not payload.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail={
                "status": "error",
                "code": "UNSUPPORTED_FILE",
                "message": "Only PDF files are supported.",
            },
        )

    try:
        pdf_bytes = base64.b64decode(payload.contentBase64, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(
            status_code=400,
            detail={
                "status": "error",
                "code": "INVALID_BASE64",
                "message": "Invalid base64 payload.",
            },
        )

    try:
        result = extract_pdf_text(pdf_bytes)
    except Exception as exc:  # noqa: BLE001 - return stable API error to caller
        raise HTTPException(
            status_code=422,
            detail={
                "status": "error",
                "code": "EXTRACTION_FAILED",
                "message": str(exc),
            },
        )

    return {
        "status": "ok",
        "text": result["text"],
        "meta": result["meta"],
    }
