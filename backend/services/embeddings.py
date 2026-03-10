import os
import voyageai


def get_voyage_client() -> voyageai.Client:
    return voyageai.Client(api_key=os.environ["VOYAGE_API_KEY"])


def embed_query(text: str) -> list[float]:
    """Embed a single query string. Returns a 1024-dim vector."""
    client = get_voyage_client()
    result = client.embed([text], model="voyage-3", input_type="query")
    return result.embeddings[0]


def embed_document(text: str) -> list[float]:
    """Embed a document chunk. Returns a 1024-dim vector."""
    client = get_voyage_client()
    result = client.embed([text], model="voyage-3", input_type="document")
    return result.embeddings[0]
