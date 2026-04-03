import os
import threading
from functools import lru_cache

from supabase import Client, create_client

_thread_local = threading.local()


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Return the cached Supabase client for the main thread / request handlers."""
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


def get_supabase_thread_safe() -> Client:
    """Return a per-thread Supabase client.

    Background threads (e.g. asyncio.to_thread for ingestion) need their
    own httpx connection pool — the cached singleton is not thread-safe.
    """
    client = getattr(_thread_local, "client", None)
    if client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_KEY"]
        client = create_client(url, key)
        _thread_local.client = client
    return client
