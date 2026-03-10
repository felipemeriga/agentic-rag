"""Extract text from documents using Docling."""

import tempfile
from pathlib import Path

from docling.document_converter import DocumentConverter


def parse_document(file_bytes: bytes, filename: str) -> str:
    """Extract text content from a document file using Docling.

    Supports PDF, DOCX, HTML, Markdown, and plain text.
    Returns extracted text as a string.
    """
    suffix = Path(filename).suffix.lower()

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        converter = DocumentConverter()
        result = converter.convert(tmp_path)
        return result.document.export_to_markdown()
    finally:
        Path(tmp_path).unlink(missing_ok=True)
