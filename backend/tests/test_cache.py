import pytest
import time
from cache import LRUCache, make_cache_key, cached

def test_lru_cache_basic():
    cache = LRUCache(max_size=2)
    cache.set("a", 1)
    cache.set("b", 2)
    assert cache.get("a") == 1
    
    cache.set("c", 3) # Should evict "b" (least recently used because "a" was accessed)
    assert cache.get("b") is None
    assert cache.get("c") == 3

def test_lru_cache_ttl():
    cache = LRUCache(default_ttl=0.1)
    cache.set("a", 1)
    assert cache.get("a") == 1
    time.sleep(0.2)
    assert cache.get("a") is None

def test_make_cache_key():
    k1 = make_cache_key("arg", k="v")
    k2 = make_cache_key("arg", k="v")
    assert k1 == k2
    k3 = make_cache_key("other")
    assert k1 != k3

def test_cached_decorator():
    my_cache = LRUCache()
    
    call_count = 0
    @cached(my_cache)
    def my_func(x):
        nonlocal call_count
        call_count += 1
        return x * 2
    
    assert my_func(5) == 10
    assert my_func(5) == 10
    assert call_count == 1
