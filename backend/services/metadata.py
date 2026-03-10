"""Extract metadata (topic, keywords) from text chunks using Claude Haiku."""

import json
import os

import anthropic

EXTRACTION_PROMPT = """Extract metadata from the following text chunk.
Return ONLY valid JSON with exactly these fields:
- "topic": a short phrase (2-5 words) describing the main topic
- "keywords": a list of 3-8 relevant keywords (lowercase)

Text chunk:
{chunk}"""


def extract_metadata(chunk: str) -> dict:
    """Extract topic and keywords from a chunk using Claude Haiku."""
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        messages=[{"role": "user", "content": EXTRACTION_PROMPT.format(chunk=chunk)}],
    )

    try:
        text = response.content[0].text.strip()
        # Handle markdown code blocks
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        result = json.loads(text)
        return {
            "topic": str(result.get("topic", "unknown")),
            "keywords": [str(k).lower() for k in result.get("keywords", [])],
        }
    except (json.JSONDecodeError, IndexError, KeyError):
        return {"topic": "unknown", "keywords": []}
