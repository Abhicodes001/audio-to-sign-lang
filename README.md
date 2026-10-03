# Audio to Sign Language Conversion System

An interactive web application that bridges the communication gap by converting spoken English audio directly into sign language. 

SignWave accumulates browser speech results, with Google Speech Recognition as an audio fallback, and matches text against an explicit media catalogue. Matching preserves words and negation, and falls back to individual letters/digits. Missing characters are reported explicitly.

All 151 bundled assets are developer previews: language, linguistic correctness, provenance and reuse permission are unverified. There are zero verified ISL release assets. See [project status](docs/PROJECT_STATUS.md) and [coverage and review needs](docs/DATASET_COVERAGE.md).

## Features
- **Live Voice Capture**: Directly records audio from your browser.
- **Catalogue Matching**: Longest phrase, exact word, reviewed alias, then fingerspelling; no stemming or stopword removal.
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
│   ├── nlp_processor.py   # Meaning-preserving tokenization
│   ├── sign_catalogue.py # Catalogue indexes and validation
│   └── sign_mapper.py     # Maps original text via the catalogue
│
├── datasets/              # Unverified developer-preview video assets
├── data/sign_catalogue.json # Asset metadata and review status
│
├── scripts/               # Helper scripts
│   └── manage_catalogue.py # Safe local import, generation, validation and audit
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

Text matching does not require NLTK corpora or download linguistic datasets.

## Dataset Setup Instructions
Catalogue entries identify assets by stable IDs and application-relative paths. Filename labels are only unreviewed candidates. MP4/WebM are accepted by the video pipeline; codec compatibility requires browser testing.

Dry-run a local import, then apply only after verifying reuse permission:
```bash
python scripts/manage_catalogue.py import path/to/local_media
python scripts/manage_catalogue.py import path/to/local_media --apply --permission-confirmed
python scripts/manage_catalogue.py generate
python scripts/manage_catalogue.py validate
```
Any collision aborts copying; existing files are never overwritten. Generation preserves existing catalogue IDs and review metadata. Restart Flask after editing the catalogue. The legacy ZIP importer is retired.

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

**Audit the catalogue:**
```bash
python scripts/manage_catalogue.py audit
```

**Run regression checks:**
```bash
python -m unittest discover -s tests
node tests/test_session_core.js
node --check static/script.js
```

## License
MIT License

This repository's stated code licence does not establish the provenance or reuse rights of bundled media.
