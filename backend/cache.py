"""
Pagani Zonda R – In-Memory LRU Cache
Thread-safe caching with TTL expiration. Redis-ready interface.
"""

import time
import hashlib
import json
import logging
import functools
from collections import OrderedDict
from threading import Lock

logger = logging.getLogger("pagani.cache")


class LRUCache:
    """Thread-safe in-memory LRU cache with TTL support."""

    def __init__(self, max_size: int = 256, default_ttl: int = 300):
        """
        Args:
            max_size: Maximum number of cached items.
            default_ttl: Default time-to-live in seconds.
        """
        self._cache: OrderedDict[str, dict] = OrderedDict()
        self._lock = Lock()
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._hits = 0
        self._misses = 0

    def get(self, key: str):
        """Get a value from cache. Returns None if not found or expired."""
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                self._misses += 1
                return None

            # Check TTL
            if time.time() > entry["expires_at"]:
                del self._cache[key]
                self._misses += 1
                return None

            # Move to end (most recently used)
            self._cache.move_to_end(key)
            self._hits += 1
            return entry["value"]

    def set(self, key: str, value, ttl: int | None = None):
        """Set a value in cache with optional TTL override."""
        ttl = ttl if ttl is not None else self._default_ttl
        with self._lock:
            if key in self._cache:
                del self._cache[key]
            elif len(self._cache) >= self._max_size:
                self._cache.popitem(last=False)  # Remove oldest

            self._cache[key] = {
                "value": value,
                "expires_at": time.time() + ttl,
            }

    def delete(self, key: str):
        """Remove a key from cache."""
        with self._lock:
            self._cache.pop(key, None)

    def clear(self):
        """Clear all cached items."""
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0

    @property
    def stats(self) -> dict:
        """Return cache statistics."""
        total = self._hits + self._misses
        return {
            "size": len(self._cache),
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self._hits / total, 3) if total > 0 else 0.0,
        }


# ── Singleton Instances ──
query_cache = LRUCache(max_size=512, default_ttl=600)       # 10 min TTL
embedding_cache = LRUCache(max_size=1024, default_ttl=3600)  # 1 hour TTL


def make_cache_key(*args, **kwargs) -> str:
    """Generate a deterministic cache key from arguments."""
    raw = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def cached(cache_instance: LRUCache, ttl: int | None = None):
    """Decorator to cache function results."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            key = f"{func.__name__}:{make_cache_key(*args, **kwargs)}"
            result = cache_instance.get(key)
            if result is not None:
                logger.debug(f"Cache HIT for {func.__name__}")
                return result
            logger.debug(f"Cache MISS for {func.__name__}")
            result = func(*args, **kwargs)
            cache_instance.set(key, result, ttl=ttl)
            return result
        return wrapper
    return decorator
