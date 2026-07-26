import nltk
import string

def process_text(text):
    """
    Processes the raw recognized phrase into a list of words for sign mapping.
    """
    if not text:
        return []

    text = text.lower().strip()
    
    # Try NLTK processing with safe fallback
    try:
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            try:
                nltk.download('punkt', quiet=True)
                nltk.download('stopwords', quiet=True)
                nltk.download('wordnet', quiet=True)
            except Exception:
                pass

        from nltk.tokenize import word_tokenize
        from nltk.stem import WordNetLemmatizer

        tokens = word_tokenize(text)
        lemmatizer = WordNetLemmatizer()
        
        # Keep meaningful words and punctuation-free tokens
        words = []
        for token in tokens:
            clean = token.strip(string.punctuation)
            if clean:
                try:
                    lemma = lemmatizer.lemmatize(clean)
                except Exception:
                    lemma = clean
                words.append(lemma)
        return words if words else text.split()
    except Exception as e:
        print(f"NLTK fallback triggered: {e}")
        # Clean split fallback
        return [w.strip(string.punctuation) for w in text.split() if w.strip(string.punctuation)]
