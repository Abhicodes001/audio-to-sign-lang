import os

from backend.sign_catalogue import load_catalogue, tokenize_with_boundaries


_CATALOGUE = None


def get_catalogue():
    global _CATALOGUE
    if _CATALOGUE is None:
        _CATALOGUE = load_catalogue(release_only=os.environ.get("SIGNWAVE_CATALOGUE_MODE") == "release")
    return _CATALOGUE


def reset_catalogue_cache():
    global _CATALOGUE
    _CATALOGUE = None


def map_text_to_videos(text):
    """
    Maps original text to catalogue-backed playback items.
    Matching order:
    1. Longest supported phrase.
    2. Exact word.
    3. Reviewed alias mapping.
    4. Letter/digit fingerspelling.
    """
    tokens = tokenize_with_boundaries(text)
    return get_catalogue().match_tokens(tokens)


def map_words_to_videos(words):
    """
    Compatibility wrapper for older callers. Prefer map_text_to_videos(text)
    because it preserves original text and word boundaries.
    """
    return map_text_to_videos(" ".join(words))
