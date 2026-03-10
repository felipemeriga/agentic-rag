"""Seed the documents table with sample RAG content and embeddings."""

import os
import sys
sys.path.insert(0, os.path.dirname(__file__) + "/..")

from dotenv import load_dotenv
load_dotenv()

from services.embeddings import embed_document
from db.client import get_supabase

SAMPLE_CHUNKS = [
    {
        "content": "Retrieval-Augmented Generation (RAG) is a technique that combines information retrieval with text generation. It retrieves relevant documents from a knowledge base and uses them as context for a language model to generate accurate, grounded responses.",
        "metadata": {"topic": "RAG overview", "chunk_index": 0},
    },
    {
        "content": "Vector embeddings are dense numerical representations of text that capture semantic meaning. Similar texts have similar embeddings, enabling semantic search. Models like Voyage AI produce high-quality embeddings for retrieval tasks.",
        "metadata": {"topic": "embeddings", "chunk_index": 0},
    },
    {
        "content": "pgvector is a PostgreSQL extension that adds support for vector similarity search. It supports multiple index types including HNSW and IVFFlat, and distance metrics like cosine similarity, inner product, and L2 distance.",
        "metadata": {"topic": "pgvector", "chunk_index": 0},
    },
    {
        "content": "Chunking is the process of splitting documents into smaller pieces for embedding and retrieval. Common strategies include fixed-size chunks with overlap, sentence-based splitting, and recursive character splitting. Typical chunk sizes are 256-512 tokens.",
        "metadata": {"topic": "chunking", "chunk_index": 0},
    },
    {
        "content": "Hybrid search combines vector (semantic) search with keyword (lexical) search. This approach captures both semantic meaning and exact keyword matches. Results from both methods can be merged using Reciprocal Rank Fusion (RRF).",
        "metadata": {"topic": "hybrid search", "chunk_index": 0},
    },
    {
        "content": "Reranking is a second-stage retrieval step that re-scores retrieved documents using a more powerful model. After initial retrieval returns candidate documents, a reranker evaluates each document's relevance to the query more carefully.",
        "metadata": {"topic": "reranking", "chunk_index": 0},
    },
    {
        "content": "Supabase is an open-source Firebase alternative built on PostgreSQL. It provides authentication, real-time subscriptions, storage, and database management. With the pgvector extension, Supabase can serve as a vector database for RAG applications.",
        "metadata": {"topic": "supabase", "chunk_index": 0},
    },
]


def seed():
    import time

    sb = get_supabase()

    # Get already-seeded topics
    existing = sb.table("documents").select("metadata").execute()
    seeded_topics = set()
    for doc in existing.data:
        if doc.get("metadata") and doc["metadata"].get("topic"):
            seeded_topics.add(doc["metadata"]["topic"])

    remaining = [c for c in SAMPLE_CHUNKS if c["metadata"]["topic"] not in seeded_topics]
    if not remaining:
        print(f"All {len(SAMPLE_CHUNKS)} documents already seeded. Skipping.")
        return

    print(f"{len(seeded_topics)} already seeded, {len(remaining)} remaining.")

    for i, chunk in enumerate(remaining):
        topic = chunk["metadata"]["topic"]
        print(f"Embedding: {topic}...")
        embedding = embed_document(chunk["content"])
        sb.table("documents").insert(
            {
                "content": chunk["content"],
                "embedding": embedding,
                "metadata": chunk["metadata"],
            }
        ).execute()
        print(f"  Inserted.")
        # Rate limit: 3 RPM on free tier — wait 25s between calls
        if i < len(remaining) - 1:
            print("  Waiting 25s for rate limit...")
            time.sleep(25)

    print(f"\nSeeded {len(remaining)} documents ({len(SAMPLE_CHUNKS)} total).")


if __name__ == "__main__":
    seed()
