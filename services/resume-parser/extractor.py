from __future__ import annotations

from io import BytesIO
from typing import Any

import pdfplumber


def extract_pdf_text(pdf_bytes: bytes) -> dict[str, Any]:
    texts: list[str] = []
    page_count = 0
    has_text_layer = False

    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            page_text = page.extract_text(x_tolerance=2, y_tolerance=3) or ""
            stripped = page_text.strip()
            if stripped:
                has_text_layer = True
                texts.append(stripped)

    text = "\n\n".join(texts).strip()
    return {
        "text": text,
        "meta": {
            "pages": page_count,
            "method": "pdfplumber",
            "hasTextLayer": has_text_layer,
            "charCount": len(text),
        },
    }
