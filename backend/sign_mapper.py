import os

# Relative to where app.py is run
DATASET_DIR = "datasets"

def map_words_to_videos(words):
    """
    Maps a list of processed words to video filenames (e.g., /videos/hello.mp4).
    If a word video doesn't exist, spells it out letter by letter when media exists.
    Missing characters are returned explicitly so the frontend can show the gap.
    """
    video_sequence = []

    for word in words:
        # 1. Direct Word Match
        exact_match = find_video_file(word)
        if exact_match:
            video_sequence.append({
                'word': word,
                'type': 'word',
                'url': f'/datasets/{exact_match}'
            })
        else:
            # 2. Fallback to Character Finger Spelling
            for char in word:
                if char.isalnum():
                    # Try to find exactly char
                    char_match = find_video_file(char)
                    if char_match:
                        video_sequence.append({
                            'word': char,
                            'parent_word': word,
                            'type': 'letter',
                            'url': f'/datasets/{char_match}'
                        })
                    else:
                        video_sequence.append({
                            'word': char,
                            'parent_word': word,
                            'type': 'missing',
                            'url': None
                        })
                            
    return video_sequence

def find_video_file(name):
    """ Helper to find a file disregarding its extension. """
    if not os.path.exists(DATASET_DIR):
        return None
        
    for f in os.listdir(DATASET_DIR):
        if os.path.splitext(f)[0] == name:
            return f
    return None
