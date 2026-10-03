# SignWave Project Status

Last updated: 2026-10-03
Branch: `codex/phase-1-baseline`

## Current Architecture

SignWave is currently a Flask application with a static HTML/CSS/JavaScript frontend.

- `app.py` serves the frontend, dataset media, and JSON APIs.
- `backend/audio_processor.py` accepts uploaded audio and calls the Google Web Speech API through `SpeechRecognition`.
- `backend/nlp_processor.py` tokenizes without stemming, lemmatizing, or removing stopwords/negation. Unicode names and contractions retain their characters; unsupported characters are explicit in the sequence.
- `backend/sign_mapper.py` caches the catalogue index and maps original text by longest phrase, exact word, reviewed alias, then character-by-character fingerspelling. Phrases cannot cross punctuation boundaries.
- `backend/sign_mapper.py` reports missing fallback characters explicitly so the frontend can show unavailable media.
- `backend/sign_catalogue.py` loads `data/sign_catalogue.json`, builds an in-memory index once, checks playback paths, and provides catalogue validation. Paths are relative to the application, independent of the shell working directory.
- `backend/gesture_recognizer.py` contains a rule-based MediaPipe landmark classifier. It is not a trained sign-language recognition model and no longer returns fabricated confidence values.
- `static/index.html`, `static/style.css`, and `static/script.js` implement the current two-mode frontend: speech/text to sign videos, and webcam landmark tracking to text/speech.
- `static/session_core.js` contains small state helpers for speech accumulation, ordered async responses, and duplicate gesture commit prevention. These helpers are covered by Node regression checks.

## Working Features

- Text-to-sign API: `POST /api/process-text` accepts JSON text and returns processed words plus a video sequence for available local signs and fallback letters.
- Audio-to-sign API: `POST /api/process-audio` accepts an uploaded audio file and attempts speech recognition before mapping text to local sign videos.
- Dataset media serving: `GET /datasets/<filename>` serves local sign video assets from `datasets/`.
- Browser speech flow: the frontend now accumulates finalized Web Speech API segments, displays interim speech separately, and only converts finalized segments.
- Text conversion requests are session-scoped and ordered; stale responses from old recordings or mode changes are ignored.
- Text-to-sign matching now uses the validated catalogue instead of repeatedly scanning `datasets/` by filename.
- Matching returns original text, matched catalogue entry metadata, fallback reason, and character/word boundaries.
- Audio upload is now a controlled fallback when browser speech has no finalized text, rather than a duplicate conversion path after every stop.
- Fallback fingerspelling: unsupported words can be decomposed into letter or digit clips when those files exist; missing fallback characters are surfaced as missing media.
- Idle demo playback is separated from user output and does not overwrite user transcripts.
- Webcam tracking UI: the frontend loads MediaPipe Hands from a CDN, draws hand landmarks, and applies experimental rule-based gesture heuristics without accuracy or confidence claims.
- Optional speech output in sign-to-text mode: the frontend uses browser `speechSynthesis`.

## Supported Versus Planned Capabilities

### Supported Now

- English text to developer-preview media lookup for the tracked `datasets/*.mp4` vocabulary; filenames remain unverified label candidates, not proof of ISL.
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

- [x] Create an explicit sign inventory from dataset files.
- [x] Add stable IDs, language, words/phrases, approved aliases, asset paths, source, reuse/licence information, and linguistic-review status.
- [x] Mark unknown provenance, unverified language, unknown licence, and developer-preview status honestly.
- [x] Distinguish developer-preview assets from verified release assets.
- [x] Implement deterministic matching: longest phrase, exact word, reviewed alias, then fingerspelling.
- [x] Preserve negation and meaning by removing lemmatization/stemming and stopword assumptions.
- [x] Return original text, matched entry, fallback reason, and boundaries in playback sequence items.
- [x] Validate alphabet/digit coverage, broken paths, duplicate entries, unsupported media formats, and missing metadata.
- [x] Return explicit unsupported results for missing fallback characters.
- [x] Resolve paths relative to the application root.
- [x] Index the catalogue instead of scanning `datasets/` for every lookup.
- [x] Add safe local dataset-import and validation commands with collision reporting.
- [x] Produce an honest coverage report listing assets needing human help.

Implementation is complete. Linguistic and release acceptance remains blocked: 151 developer-preview entries (115 word/phrase labels, 36 character labels), zero verified release entries. The 36/36 alphabet/digit coverage count measures file presence, not correctness or decodability. No datasets were downloaded or imported during this phase.

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
- Dataset files are tracked in git and indexed in `data/sign_catalogue.json`, but source, permissions, licences, signer consent, and whether each clip is Indian Sign Language remain unverified.
- Current catalogue coverage is documented in `docs/DATASET_COVERAGE.md`.
- NLTK is no longer used for sign matching because stemming or stopword removal can change meaning.
- Speech recognition uses Google through the `SpeechRecognition` package and requires network access at runtime.
- Frontend webcam tracking depends on MediaPipe scripts loaded from jsDelivr CDN.
- No trained ML model file is present in the repository.

## Unresolved Blockers

- Verified ISL video dataset and permissions are unavailable.
- All current catalogue entries are developer-preview only and need source/licence/language review.
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

Validate/audit the sign catalogue:

```bash
python scripts/manage_catalogue.py validate
python scripts/manage_catalogue.py audit
```

Import local media after verifying reuse permission (dry run first):

```bash
python scripts/manage_catalogue.py import path/to/local_media
python scripts/manage_catalogue.py import path/to/local_media --apply --permission-confirmed
python scripts/manage_catalogue.py generate
python scripts/manage_catalogue.py validate
```

Imports accept MP4/WebM only, abort all copying on collisions, and never overwrite files. `generate` appends new preview entries and preserves existing IDs/review metadata. Restart Flask after editing the catalogue because indexes are cached.

The former `scripts/setup_dataset.py` ZIP importer is retired: it exits without extracting or copying. README instructions now point to the safe importer. The README's MIT code licence claim is not evidence of dataset reuse rights.

To restrict API matching to reviewed release entries, set `SIGNWAVE_CATALOGUE_MODE=release` before starting Flask (PowerShell: `$env:SIGNWAVE_CATALOGUE_MODE = 'release'`). With today's catalogue every character returns unsupported in that mode. This filters API matching only; it is not a deployment or media-distribution permission gate. The local frontend's separately labelled idle demos remain developer previews.

List tracked dataset media:

```bash
git ls-files datasets
```

## Verification Notes

Automated checks cover deterministic backend behavior and extracted frontend state logic:

- Meaning-preserving tokenization.
- Video mapping for available word signs.
- Letter fallback for unsupported words when letter media exists.
- Explicit missing-media entries when fallback character media is absent.
- Catalogue phrase precedence, punctuation/case handling, reviewed aliases, repeated letters, numbers, negation, missing fallback characters, and validation errors.
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

### Phase 2 Checks Actually Run (2026-10-03)

- `python -m unittest discover -s tests`: 26 tests passed, including safe import collisions/dry runs, permission confirmation, metadata preservation, missing file coverage, Unicode/contraction handling, release filtering, matching, and API regressions. Fixture media are empty/test bytes; these tests do not claim video decoding or linguistic validity.
- Catalogue validation: 151 entries, 0 errors, 454 warnings (preview/review/licence warnings for all entries plus `mic3.png`, a non-playback image).
- Flask test-client smoke check from shell working directory `C:/`: text conversion and `/datasets/a.mp4` both returned HTTP 200; phrase ordering, repeated letters, digits and negation were retained.
- `node tests/test_session_core.js`: passed on retry outside the Windows sandbox after sandbox path resolution returned EPERM.
- `node --check static/script.js`: passed.
- Python compilation and `git diff --check`: passed. The retired ZIP command was checked to exit with a migration message.
- Local Flask server HTTP smoke check: `/api/process-text` returned the expected original and tokenized text.
- Live microphone/camera, browser decoding, and linguistic review have not been performed.

Phase 3 engineering can begin when requested; trained recognition and verified ISL claims still require reviewed data/models. No later-phase work is included here.
