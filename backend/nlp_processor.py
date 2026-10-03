from backend.sign_catalogue import tokenize_with_boundaries

def process_text(text):
    """
    Tokenizes text without removing stopwords or stemming word forms.
    Sign matching must preserve negation and meaning.
    """
    if not text:
        return []
    return [token["normalized"] for token in tokenize_with_boundaries(text)]
