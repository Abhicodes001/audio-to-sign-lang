# SignWave Project Status

Last updated: 2026-10-02
Branch: `codex/phase-1-baseline`

## Current Architecture

SignWave is currently a Flask application with a static HTML/CSS/JavaScript frontend.

- `app.py` serves the frontend, dataset media, and JSON APIs.
- `backend/audio_processor.py` accepts uploaded audio and calls the Google Web Speech API through `SpeechRecognition`.
- `backend/nlp_processor.py` lowercases, tokenizes, strips punctuation, and lemmatizes text with NLTK, with a simple split fallback when NLTK data is unavailable.
- `backend/sign_mapper.py` maps processed words to local files in `datasets/`. If a word clip is missing, it attempts character-by-character fingerspelling using local letter or digit clips.
- `backend/sign_mapper.py` reports missing fallback characters explicitly so the frontend can show unavailable media.
- `backend/gesture_recognizer.py` contains a rule-based MediaPipe landmark classifier. It is not a trained sign-language recognition model and no longer returns fabricated confidence values.
- `static/index.html`, `static/style.css`, and `static/script.js` implement the current two-mode frontend: speech/text to sign videos, and webcam landmark tracking to text/speech.
- `static/session_core.js` contains small state helpers for speech accumulation, ordered async responses, and duplicate gesture commit prevention. These helpers are covered by Node regression checks.

## Working Features

- Text-to-sign API: `POST /api/process-text` accepts JSON text and returns processed words plus a video sequence for available local signs and fallback letters.
- Audio-to-sign API: `POST /api/process-audio` accepts an uploaded audio file and attempts speech recognition before mapping text to local sign videos.
- Dataset media serving: `GET /datasets/<filename>` serves local sign video assets from `datasets/`.
- Browser speech flow: the frontend now accumulates finalized Web Speech API segments, displays interim speech separately, and only converts finalized segments.
- Text conversion requests are session-scoped and ordered; stale responses from old recordings or mode changes are ignored.
- Audio upload is now a controlled fallback when browser speech has no finalized text, rather than a duplicate conversion path after every stop.
- Fallback fingerspelling: unsupported words can be decomposed into letter or digit clips when those files exist; missing fallback characters are surfaced as missing media.
- Idle demo playback is separated from user output and does not overwrite user transcripts.
- Webcam tracking UI: the frontend loads MediaPipe Hands from a CDN, draws hand landmarks, and applies experimental rule-based gesture heuristics without accuracy or confidence claims.
- Optional speech output in sign-to-text mode: the frontend uses browser `speechSynthesis`.

## Supported Versus Planned Capabilities

### Supported Now

- English text to local sign video lookup for the tracked `datasets/*.mp4` vocabulary.
- Fingerspelling fallback for unsupported alphanumeric characters when the matching `datasets/<character>.mp4` file exists.
- Local alphabet and digit media files: `a-z` and `0-9`.
- Finite tracked word-sign clips, including examples such as `hello`, `good`, `thank you`, `welcome`, `language`, `college`, `computer`, `help`, `learn`, `work`, `world`, `you`, and `your`.
- Experimental rule-based webcam gesture labels for a small set of hand shapes, such as open palm, thumbs up/down, pointing, fist, pinch, and selected letter-like shapes. These are unverified heuristics.

### Not Yet Supported

- Verified Indian Sign Language coverage for the current dataset.
- Dataset provenance, licensing, signer consent, or permission verification.
- A trained sign-language classifier.
- Accuracy, confidence calibration, or evaluation metrics.
- Universal or open-vocabulary sign recognition.
- Reliable unsupported-sign detection beyond returning the rule-based fallback state.
- A separate, production-ready fingerspelling recognition mode.
- Deployment hardening, CI, production configuration, or health checks.

## Phase Checklist And Acceptance Criteria

### Baseline: Truthful Status

- [x] Inspect the repository before making implementation assumptions.
- [x] Confirm repo-local instructions: no `AGENTS.md` file is present.
- [x] Create and work on a separate branch.
- [x] Document the current architecture, working features, limits, and blockers.
- [x] Add focused automated tests for deterministic text, mapping, and API behavior.
- [x] Distinguish automated checks from manual camera/microphone checks.

Acceptance criteria:

- `docs/PROJECT_STATUS.md` exists and accurately reflects the current repository.
- Tests avoid claims about trained models, accuracy, or verified ISL coverage.
- Unknown or unsupported signs are not represented as solved.

### Phase 1: Stabilize Existing Speech, Playback, And Camera Flows

- [x] Verify suspected speech, playback, request ordering, duplicate conversion, gesture commit, and resource cleanup issues against the current code.
- [x] Add explicit recording, processing, playback, demo, and camera state handling in the frontend.
- [x] Use session and request identifiers so obsolete responses are ignored.
- [x] Accumulate finalized speech segments correctly and display interim speech separately.
- [x] Convert finalized speech segments only once.
- [x] Use uploaded audio transcription only as a fallback when browser speech has no finalized transcript.
- [x] Preserve playback order for out-of-order conversion responses.
- [x] Release microphone and camera resources on stop or mode changes.
- [x] Surface permission denial, network failure, empty recognition, and missing media in the UI.
- [x] Keep idle demos clearly labeled and separate from user output.
- [x] Require release or a changed hand shape before the same gesture can be committed again.
- [x] Mark geometric sign recognition as experimental heuristic behavior and remove fabricated confidence percentages from UI and backend API output.
- [x] Add focused regression checks for transcript accumulation, stale/ordered responses, queue ordering, explicit missing media, and duplicate gesture commits.

Acceptance criteria:

- Interim speech does not trigger conversion requests.
- Finalized speech segments accumulate instead of replacing earlier transcript segments.
- Stale async responses cannot overwrite newer playback.
- Stopping recording does not run both text and audio conversion when browser speech already produced finalized text.
- Recording indicators do not reset while a recording is still active.
- Holding one gesture does not repeatedly append the same word.
- Mode changes stop media streams, timers, playback, and pending requests where applicable.

### Phase 2: Reliable Speech/Text To ISL Video Pipeline

- [ ] Create an explicit sign inventory from dataset files.
- [ ] Add API metadata that distinguishes word signs, fingerspelled letters, and missing characters.
- [ ] Prevent frontend fallback from fabricating video URLs for unavailable clips.
- [ ] Add clear UI messaging for unsupported words and missing fingerspelling media.
- [ ] Verify and document any ISL dataset source before claiming ISL support.

Acceptance criteria:

- The app never silently claims a sign video exists when the asset is missing.
- Unsupported words remain visible to users and fall back to available fingerspelling only.
- The status document lists verified and unverified media sources separately.

### Phase 3: Supported Sign To Text/Speech

- [ ] Separate MediaPipe tracking from recognition claims in API and UI copy.
- [ ] Replace or gate rule-based labels behind a documented supported-sign inventory.
- [ ] Add unknown-state handling for ambiguous or unsupported hand shapes.
- [ ] Add tests for gesture API validation and classifier unknown behavior.

Acceptance criteria:

- Rule-based output is labeled as limited heuristic recognition unless a trained model is added.
- Unsupported signs can remain unknown.
- No universal sign recognition claim appears in the app or docs.

### Phase 4: Separate Fingerspelling Recognition Mode

- [ ] Define target alphabet, input format, hold-to-commit behavior, and unknown state.
- [ ] Add a separate UI mode rather than mixing it into general sign recognition.
- [ ] Add model or rule documentation and validation tests.

Acceptance criteria:

- Fingerspelling recognition is separately accessible and does not imply sentence-level ISL recognition.
- Unknown or ambiguous letters remain unknown.

### Phase 5: Deployment Readiness

- [ ] Add environment configuration for production Flask/Gunicorn.
- [ ] Add CI-friendly test commands.
- [ ] Add dependency pinning review.
- [ ] Add deployment notes without publishing a deployment.

Acceptance criteria:

- The app can be installed, tested, and run from documented commands.
- Deployment remains unpublished until explicitly requested.

## Data And Model Dependencies

- Local media in `datasets/` is the only sign-video source currently used by the app.
- Dataset files are tracked in git, but this baseline did not verify source, permissions, licenses, signer consent, or whether each clip is Indian Sign Language.
- NLTK is required for full tokenization and lemmatization. The code falls back to a simpler splitter if NLTK data is unavailable.
- Speech recognition uses Google through the `SpeechRecognition` package and requires network access at runtime.
- Frontend webcam tracking depends on MediaPipe scripts loaded from jsDelivr CDN.
- No trained ML model file is present in the repository.

## Unresolved Blockers

- Verified ISL video dataset and permissions are unavailable.
- Trained recognition data/model for supported ISL signs is unavailable.
- Trained or evaluated fingerspelling recognition is unavailable.
- Manual microphone, camera, and browser permission checks require an interactive browser and user hardware.
- Deployment target and environment variables have not been selected.

## Commands

Install dependencies:

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Run the Flask app:

```bash
python app.py
```

Open the app:

```text
http://localhost:5000
```

Run automated tests:

```bash
python -m unittest discover -s tests
```

Run frontend state regression checks:

```bash
node tests/test_session_core.js
node --check static/script.js
```

List tracked dataset media:

```bash
git ls-files datasets
```

## Verification Notes

Automated checks cover deterministic backend behavior and extracted frontend state logic:

- NLP fallback cleanup.
- Video mapping for available word signs.
- Letter fallback for unsupported words when letter media exists.
- Explicit missing-media entries when fallback character media is absent.
- API error handling for missing text and invalid landmarks.
- Backend gesture heuristic output no longer includes fabricated confidence.
- Transcript accumulation and duplicate final speech suppression.
- Ordered response buffering for out-of-order conversion results.
- Duplicate gesture commit prevention until release/change.
- Frontend controller syntax.

Manual checks still required:

- Browser microphone permission and live recording.
- Browser speech recognition behavior.
- Uploaded audio recognition through Google Speech Recognition.
- Webcam permission, MediaPipe CDN loading, and hand tracking.
- Video playback quality and sign correctness.
