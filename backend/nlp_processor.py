import nltk
from nltk.tokenize import word_tokenize
from nltk.stem import WordNetLemmatizer
import string

def process_text(text):
    """
    Processes the raw recognized phrase into a list of base-form words.
    - lowercase
    - tokenization
    - remove specific stopwords irrelevant to sign language
    - lemmatize to base form
    """
    # 1. Lowercase
    text = text.lower()
    
    # Ensure dependencies are downloaded (or assuming they were downloaded via setup)
    try:
        nltk.data.find('tokenizers/punkt')
    except LookupError:
        nltk.download('punkt')
        nltk.download('stopwords')
        nltk.download('wordnet')
        nltk.download('punkt_tab')
    
    # 2. Tokenize
    tokens = word_tokenize(text)
    
    # 3. Stopword removal (customize for sign language: exclude a, the, is, are, am, etc.)
    # Standard English stopwords remove too much (like 'not', or pronouns)
    # We define a custom list.
    common_stops = {'a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being', 'of', 'to', 'at', 'by', 'for', 'with', 'about', 'against'}
    
    # Removes punctuation as well
    filtered_tokens = [word for word in tokens if word not in common_stops and word not in string.punctuation]
    
    # 4. Lemmatization (base form)
    lemmatizer = WordNetLemmatizer()
    lemmatized_words = [lemmatizer.lemmatize(word) for word in filtered_tokens]
    
    return lemmatized_words
