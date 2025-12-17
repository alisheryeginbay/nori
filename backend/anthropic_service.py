from functools import lru_cache
import anthropic


@lru_cache
def get_anthropic_client():
    return anthropic.AsyncAnthropic()
