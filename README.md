# Audio to Sign Language Conversion System

An interactive web application that bridges the communication gap by converting spoken English audio directly into sign language. 

The system captures spoken audio via the microphone, converts it to text using Google Speech Recognition, uses Natural Language Processing (NLP) to extract relevant keywords, and seamlessly maps them against a dataset of sign language videos. If a word isn't available, the system will fall back to spelling it out character-by-character.

## Features
- **Live Voice Capture**: Directly records audio from your browser.
- **NLP Text Processing**: Uses NLTK to tokenize, lowercase, and lemmatize sentences to match the root dictionary words.
- **Dynamic Video Mapping**: Automatically strings together the appropriate sequence of sign language videos.
- **Fallback Finger Spelling**: Dynamically splits unknown words into individual letter gestures automatically.
- **Portable & Secure**: Zero hardcoded paths, runs on any OS (Windows/macOS/Linux).

## Folder Structure
```text
Audio-to-Sign-Language/
│
├── app.py                 # Main Flask server application
├── requirements.txt       # Python dependencies
├── README.md              # Project documentation
├── .gitignore             # Ignored files for version control
│
├── backend/               # Core Python processing logic
│   ├── audio_processor.py # Speech-to-text conversion
│   ├── nlp_processor.py   # Text tokenization & lemmatization
│   └── sign_mapper.py     # Maps NLP words to video files
│
├── datasets/              # Contains all the sign language videos (.mp4/.gif)
│
├── scripts/               # Helper scripts
│   └── setup_dataset.py   # Script to extract and format new datasets
│
└── static/                # Frontend web assets
    ├── index.html         # User interface
    ├── style.css          # UI styling
    └── script.js          # Audio recording & video playback logic
```

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/Audio-to-Sign-Language.git
cd Audio-to-Sign-Language
```

### 2. Set up a Virtual Environment
```bash
python -m venv venv
# On Windows
venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

*(Note: The first time you run the application, the NLTK library will automatically download the required language corpuses in the background).*

## Dataset Setup Instructions
A comprehensive default sign language dataset is securely stored in the `datasets/` folder. All dataset files MUST be purely lowercase with spaces (e.g., `thank you.mp4`) to exactly match the NLP output. 

If you want to add your own custom videos in bulk, you can compress them into a `.zip` file and run our helper script:
```bash
python scripts/setup_dataset.py path/to/your/custom_videos.zip
```
This script will safely extract them to the `datasets/` folder and format the filenames correctly.

## How to Run

Start the Flask server:
```bash
python app.py
```

Then, open your web browser and navigate to:
**http://localhost:5000**

## Example Commands
Here are the essential commands for everyday usage:

**Run the server:**
```bash
python app.py
```

**Add a new dataset (Zip File):**
```bash
python scripts/setup_dataset.py C:\path\to\new_signs.zip
```

**Run NLTK downloads manually (Optional):**
```bash
python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('wordnet')"
```

## License
MIT License
