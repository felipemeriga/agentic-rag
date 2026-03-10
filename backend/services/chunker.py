"""Recursive character text splitter for document chunking."""


def chunk_text(
    text: str,
    chunk_size: int = 2048,
    chunk_overlap: int = 200,
) -> list[str]:
    """Split text into chunks using recursive character splitting.

    Splits on double newline, single newline, sentence end, then space.
    Target: ~512 tokens per chunk (~2048 chars), ~50 token overlap (~200 chars).
    """
    separators = ["\n\n", "\n", ". ", " "]
    return _split_recursive(text, separators, chunk_size, chunk_overlap)


def _split_recursive(
    text: str,
    separators: list[str],
    chunk_size: int,
    chunk_overlap: int,
) -> list[str]:
    """Recursively split text using separator hierarchy."""
    if len(text) <= chunk_size:
        stripped = text.strip()
        return [stripped] if stripped else []

    separator = separators[0]
    remaining_separators = separators[1:] if len(separators) > 1 else separators

    parts = text.split(separator)

    chunks: list[str] = []
    current = ""

    for part in parts:
        candidate = current + separator + part if current else part
        if len(candidate) > chunk_size and current:
            stripped = current.strip()
            if stripped:
                if len(stripped) > chunk_size and remaining_separators != separators:
                    chunks.extend(
                        _split_recursive(stripped, remaining_separators, chunk_size, chunk_overlap)
                    )
                else:
                    chunks.append(stripped)
            if chunk_overlap > 0 and current:
                overlap_text = current[-chunk_overlap:]
                current = overlap_text + separator + part
            else:
                current = part
        else:
            current = candidate

    if current.strip():
        stripped = current.strip()
        if len(stripped) > chunk_size and remaining_separators != separators:
            chunks.extend(
                _split_recursive(stripped, remaining_separators, chunk_size, chunk_overlap)
            )
        else:
            chunks.append(stripped)

    return chunks
