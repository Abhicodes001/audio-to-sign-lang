const Core = window.SignWaveCore;

const recordBtn = document.getElementById('recordBtn');
const controlCard = document.getElementById('controlCard');
const micLabel = document.getElementById('micLabel');
const micSublabel = document.getElementById('micSublabel');
const transcriptionText = document.getElementById('transcriptionText');
const videoContainer = document.getElementById('videoContainer');
const signVideo = document.getElementById('signVideo');
const stagePlaceholder = document.getElementById('stagePlaceholder');
const stageTitle = document.getElementById('stageTitle');
const currentWordBadge = document.getElementById('currentWordBadge');
const fingerspellingTiles = document.getElementById('fingerspellingTiles');
const statWords = document.getElementById('statWords');
const statLetters = document.getElementById('statLetters');
const statStatus = document.getElementById('statStatus');

const btnHowItWorks = document.getElementById('btnHowItWorks');
const modalOverlay = document.getElementById('modalOverlay');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalPrevBtn = document.getElementById('modalPrevBtn');
const modalNextBtn = document.getElementById('modalNextBtn');
const modalNextLabel = document.getElementById('modalNextLabel');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const modalIcon = document.getElementById('modalIcon');
const modalDots = document.getElementById('modalDots').children;

const DEMO_SEQUENCE = [
  { word: 'hello', type: 'word', url: '/datasets/hello.mp4' },
  { word: 'sign', type: 'word', url: '/datasets/sign.mp4' },
  { word: 'language', type: 'word', url: '/datasets/language.mp4' },
  { word: 'welcome', type: 'word', url: '/datasets/welcome.mp4' }
];

const walkthroughSteps = [
  {
    icon: '<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>',
    title: '1. Allow the mic',
    desc: 'Tap the big button and approve the browser microphone prompt. Finalized speech is queued once; audio upload is used only as fallback.'
  },
  {
    icon: '<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>',
    title: '2. Speak naturally',
    desc: 'Speak clearly into your mic. Interim text stays visible without triggering duplicate conversions.'
  },
  {
    icon: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
    title: '3. Watch the transcript',
    desc: 'Final speech segments accumulate in order. Temporary interim text is separated from committed output.'
  },
  {
    icon: '<svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 9H3V5h9v7z"/></svg>',
    title: '4. Read the sign stage',
    desc: 'Only current-session responses can enqueue videos. Missing media is shown instead of being silently fabricated.'
  },
  {
    icon: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>',
    title: '5. Track session state',
    desc: 'Recording, processing, playback, demo, and camera states are kept separate so resources can be released cleanly.'
  }
];

const speechAccumulator = Core.createSpeechAccumulator();
const orderedResponses = Core.createOrderedResponseBuffer();
const appState = {
  mode: 'audio',
  recordingState: 'idle',
  playbackState: 'idle',
  playbackOwner: null,
  activeSessionId: 0,
  nextSessionId: 1,
  nextTextOrder: 1,
  activeTextRequests: new Map(),
  userHasOutput: false,
};

let currentModalStep = 0;
let recorder = null;
let stream = null;
let speechRecognizer = null;
let videoQueue = [];
let isPlayingVideo = false;
let idleDemoTimeout = null;
let playbackAdvanceTimeout = null;
let audioFallbackController = null;

function updateModalStep(stepIndex) {
  currentModalStep = stepIndex;
  const step = walkthroughSteps[stepIndex];
  modalTitle.textContent = step.title;
  modalDesc.textContent = step.desc;
  modalIcon.innerHTML = step.icon;

  for (let i = 0; i < modalDots.length; i += 1) {
    modalDots[i].classList.toggle('active', i === stepIndex);
  }

  modalNextLabel.textContent = stepIndex === walkthroughSteps.length - 1 ? 'START SIGNING' : 'NEXT';
}

function setRecordingState(state, message) {
  appState.recordingState = state;
  recordBtn.classList.toggle('recording', state === 'recording');
  controlCard.classList.toggle('recording', state === 'recording');

  if (state === 'idle') {
    micLabel.textContent = 'START RECORDING';
    micSublabel.textContent = message || 'Tap the big button to record';
    statStatus.textContent = appState.mode === 'camera' ? 'CAMERA READY' : 'IDLE';
  } else if (state === 'requesting-permission') {
    micLabel.textContent = 'REQUESTING MIC';
    micSublabel.textContent = 'Waiting for browser permission...';
    statStatus.textContent = 'MIC PERMISSION';
  } else if (state === 'recording') {
    micLabel.textContent = 'RECORDING';
    micSublabel.textContent = 'Listening... speak now';
    statStatus.textContent = 'LIVE';
  } else if (state === 'processing') {
    micLabel.textContent = 'PROCESSING';
    micSublabel.textContent = message || 'Converting finalized speech to available sign videos...';
    statStatus.textContent = 'PROCESSING';
  } else if (state === 'error') {
    micLabel.textContent = 'START RECORDING';
    micSublabel.textContent = message || 'Something went wrong. Try again.';
    statStatus.textContent = 'ERROR';
  }
}

function setStageMessage(title, badge, clearTiles = false) {
  stageTitle.textContent = title;
  currentWordBadge.textContent = badge;
  if (clearTiles) fingerspellingTiles.innerHTML = '';
}

function updateTranscriptDisplay(finalText, interimText = '') {
  const finalClean = Core.normalizeText(finalText);
  const interimClean = Core.normalizeText(interimText);
  const display = Core.normalizeText([finalClean, interimClean].filter(Boolean).join(' '));

  if (!display) {
    transcriptionText.textContent = appState.playbackOwner === 'demo'
      ? 'Demo only: HELLO SIGN LANGUAGE WELCOME'
      : 'Listening for speech...';
    transcriptionText.classList.toggle('placeholder', appState.playbackOwner !== 'demo');
  } else {
    transcriptionText.textContent = interimClean ? `${finalClean} [hearing: ${interimClean}]`.trim() : finalClean;
    transcriptionText.classList.remove('placeholder');
  }

  statWords.textContent = display ? display.split(/\s+/).length : 0;
  statLetters.textContent = display.replace(/[^a-zA-Z0-9]/g, '').length;
}

function clearTimers() {
  clearTimeout(idleDemoTimeout);
  clearTimeout(playbackAdvanceTimeout);
  idleDemoTimeout = null;
  playbackAdvanceTimeout = null;
}

function abortActiveRequests() {
  for (const controller of appState.activeTextRequests.values()) controller.abort();
  appState.activeTextRequests.clear();

  if (audioFallbackController) {
    audioFallbackController.abort();
    audioFallbackController = null;
  }
}

function releaseMicStream() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
}

function resetPlayback(owner = null) {
  clearTimers();
  videoQueue = [];
  isPlayingVideo = false;
  appState.playbackState = 'idle';
  appState.playbackOwner = owner;

  signVideo.pause();
  signVideo.removeAttribute('src');
  signVideo.oncanplay = null;
  signVideo.onended = null;
  signVideo.onerror = null;
  signVideo.load();

  videoContainer.style.display = 'none';
  stagePlaceholder.style.display = 'flex';
}

function resetSessionState() {
  appState.activeSessionId = appState.nextSessionId;
  appState.nextSessionId += 1;
  appState.nextTextOrder = 1;
  appState.userHasOutput = false;
  speechAccumulator.reset();
  orderedResponses.reset();
  abortActiveRequests();
  resetPlayback('user');
}

async function setupAudio() {
  setRecordingState('requesting-permission');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    console.error('Microphone access error:', err);
    setRecordingState('error', 'Microphone permission denied or unavailable.');
    setStageMessage('MICROPHONE UNAVAILABLE', 'Permission denied or no microphone found', true);
    return false;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition && !speechRecognizer) {
    speechRecognizer = new SpeechRecognition();
    speechRecognizer.continuous = true;
    speechRecognizer.interimResults = true;
    speechRecognizer.lang = 'en-US';

    speechRecognizer.onresult = (event) => {
      if (appState.recordingState !== 'recording') return;
      const update = speechAccumulator.applyResult(event);
      updateTranscriptDisplay(update.finalText, update.interimText);
      for (const segment of update.finalSegments) {
        enqueueFinalSegment(segment, appState.activeSessionId);
      }
    };

    speechRecognizer.onerror = (event) => {
      console.warn('Speech recognition status:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setRecordingState('error', 'Browser speech recognition permission was denied.');
      }
    };
  }

  return true;
}

recordBtn.addEventListener('click', async () => {
  if (appState.recordingState === 'recording') {
    stopRecording();
    return;
  }
  if (appState.recordingState === 'requesting-permission' || appState.recordingState === 'processing') return;
  await startRecording();
});

async function startRecording() {
  appState.mode = 'audio';
  resetSessionState();
  updateTranscriptDisplay('', '');
  setStageMessage('SIGN STAGE ACTIVE', '-', true);

  const ready = await setupAudio();
  if (!ready || !stream) return;

  if (typeof RecordRTC === 'undefined' || typeof StereoAudioRecorder === 'undefined') {
    console.warn('RecordRTC is unavailable; browser speech recognition will be used without audio fallback.');
    recorder = null;
  } else {
    recorder = new RecordRTC(stream, {
      type: 'audio',
      mimeType: 'audio/wav',
      recorderType: StereoAudioRecorder,
      numberOfAudioChannels: 1,
      desiredSampRate: 16000
    });
    recorder.startRecording();
  }

  if (speechRecognizer) {
    try { speechRecognizer.start(); } catch (e) {}
  }

  setRecordingState('recording');
}

function stopRecording(options = {}) {
  if (appState.recordingState !== 'recording' && appState.recordingState !== 'requesting-permission') {
    releaseMicStream();
    return;
  }

  const sessionId = appState.activeSessionId;
  const hasBrowserTranscript = Boolean(Core.normalizeText(speechAccumulator.finalText));

  if (speechRecognizer) {
    try { speechRecognizer.stop(); } catch (e) {}
  }

  setRecordingState('processing', hasBrowserTranscript ? 'Finishing queued speech segments...' : 'Trying audio upload fallback...');

  const finishWithoutAudio = () => {
    releaseMicStream();
    if (options.cancel || sessionId !== appState.activeSessionId) return;
    if (!hasBrowserTranscript && appState.activeTextRequests.size === 0) {
      setRecordingState('idle', 'No finalized speech detected. Try again.');
      setStageMessage('NO SPEECH DETECTED', 'Nothing was recognized', true);
    } else if (appState.activeTextRequests.size === 0) {
      setRecordingState('idle');
      scheduleIdleDemo();
    }
  };

  if (!recorder) {
    finishWithoutAudio();
    return;
  }

  recorder.stopRecording(async () => {
    const audioBlob = recorder.getBlob();
    recorder = null;
    releaseMicStream();
    if (options.cancel || sessionId !== appState.activeSessionId) return;

    if (!hasBrowserTranscript && audioBlob && audioBlob.size > 0) {
      await sendAudioFallback(audioBlob, sessionId);
    } else if (appState.activeTextRequests.size === 0) {
      setRecordingState('idle');
      scheduleIdleDemo();
    }
  });
}

function enqueueFinalSegment(segment, sessionId) {
  const cleanSegment = Core.normalizeText(segment);
  if (!cleanSegment || sessionId !== appState.activeSessionId) return;
  const order = appState.nextTextOrder;
  appState.nextTextOrder += 1;
  processTextSegment(cleanSegment, order, sessionId);
}

async function processTextSegment(text, order, sessionId) {
  const controller = new AbortController();
  appState.activeTextRequests.set(order, controller);

  try {
    const response = await fetch('/api/process-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal
    });
    const data = await response.json();
    if (sessionId !== appState.activeSessionId) return;

    if (!response.ok) {
      showProcessingError(data.error || 'Unable to process text.');
      orderedResponses.accept({ order, items: [] });
      return;
    }

    const items = (data.video_sequence || []).map((item) => ({ ...item, sourceText: text }));
    const readyItems = orderedResponses.accept({ order, items });
    if (items.length === 0) showProcessingError(`No sign or fingerspelling media found for "${text}".`);
    if (readyItems.length > 0) appendUserPlaybackItems(readyItems);
  } catch (err) {
    if (err.name !== 'AbortError' && sessionId === appState.activeSessionId) {
      console.error('Text processing error:', err);
      showProcessingError('Network failure while converting speech to signs.');
      orderedResponses.accept({ order, items: [] });
    }
  } finally {
    appState.activeTextRequests.delete(order);
    if (sessionId === appState.activeSessionId && appState.recordingState === 'processing' && appState.activeTextRequests.size === 0) {
      setRecordingState('idle');
      scheduleIdleDemo();
    }
  }
}

async function sendAudioFallback(audioBlob, sessionId) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');
  audioFallbackController = new AbortController();

  try {
    const response = await fetch('/api/process-audio', {
      method: 'POST',
      body: formData,
      signal: audioFallbackController.signal
    });
    const data = await response.json();
    if (sessionId !== appState.activeSessionId) return;

    if (!response.ok || !data.original_text) {
      setRecordingState('idle', data.error || 'Audio fallback could not recognize speech.');
      setStageMessage('AUDIO FALLBACK FAILED', data.error || 'No speech recognized', true);
      return;
    }

    appState.userHasOutput = true;
    speechAccumulator.finalText = Core.normalizeText(data.original_text);
    updateTranscriptDisplay(speechAccumulator.finalText, '');
    appendUserPlaybackItems(data.video_sequence || []);
    setRecordingState('idle');
  } catch (err) {
    if (err.name !== 'AbortError' && sessionId === appState.activeSessionId) {
      console.error('Audio API error:', err);
      setRecordingState('idle', 'Network failure while using audio fallback.');
      setStageMessage('AUDIO FALLBACK FAILED', 'Network failure', true);
    }
  } finally {
    audioFallbackController = null;
  }
}

function showProcessingError(message) {
  appState.userHasOutput = true;
  setStageMessage('ATTENTION NEEDED', message, false);
  currentWordBadge.textContent = message;
}

function appendUserPlaybackItems(items) {
  const playableItems = items.filter(Boolean);
  if (playableItems.length === 0) return;
  appState.userHasOutput = true;
  clearTimers();
  appState.playbackOwner = 'user';
  appState.playbackState = 'playing';
  videoQueue.push(...playableItems);
  if (!isPlayingVideo) playNextSignVideo('user');
}

function renderFingerspellingTiles(word, activeChar = null) {
  fingerspellingTiles.innerHTML = '';
  const cleanWord = String(word || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const char of cleanWord) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    if (activeChar && char === activeChar.toUpperCase()) tile.classList.add('active');
    tile.textContent = char;
    fingerspellingTiles.appendChild(tile);
  }
}

function showMissingMedia(item) {
  const label = item.parent_word || item.parentWord || item.sourceText || item.word || 'unknown';
  videoContainer.style.display = 'none';
  stagePlaceholder.style.display = 'flex';
  renderFingerspellingTiles(label, item.word);
  setStageMessage('MISSING VIDEO', `Missing media for ${String(item.word || label).toUpperCase()}`, false);
  playbackAdvanceTimeout = setTimeout(() => playNextSignVideo(appState.playbackOwner), 600);
}

function playNextSignVideo(owner) {
  if (owner && owner !== appState.playbackOwner) return;

  if (videoQueue.length === 0) {
    isPlayingVideo = false;
    appState.playbackState = 'idle';
    setStageMessage(appState.playbackOwner === 'demo' ? 'DEMO COMPLETE' : 'SIGN STAGE READY', '-', false);
    if (appState.playbackOwner === 'user') scheduleIdleDemo();
    return;
  }

  isPlayingVideo = true;
  const item = videoQueue.shift();

  if (!item.url || item.type === 'missing') {
    showMissingMedia(item);
    return;
  }

  stagePlaceholder.style.display = 'none';
  videoContainer.style.display = 'block';

  if (item.type === 'letter') {
    currentWordBadge.textContent = `Letter: ${String(item.word).toUpperCase()}`;
    renderFingerspellingTiles(item.parent_word || item.parentWord || item.sourceText || item.word, item.word);
  } else {
    currentWordBadge.textContent = appState.playbackOwner === 'demo'
      ? `Demo: ${String(item.word).toUpperCase()}`
      : `Signing: ${String(item.word).toUpperCase()}`;
    renderFingerspellingTiles(item.word);
  }

  signVideo.src = item.url;
  signVideo.load();
  signVideo.oncanplay = () => {
    signVideo.playbackRate = 0.75;
    signVideo.play().catch((err) => {
      console.warn('Video play error:', err);
      showMissingMedia(item);
    });
  };
  signVideo.onended = () => {
    playbackAdvanceTimeout = setTimeout(() => playNextSignVideo(appState.playbackOwner), 250);
  };
  signVideo.onerror = () => {
    console.error('Video file not found for:', item.url);
    showMissingMedia(item);
  };
}

function startIdleDemoLoop() {
  if (appState.mode !== 'audio' || appState.recordingState !== 'idle' || isPlayingVideo || appState.userHasOutput) return;
  resetPlayback('demo');
  appState.playbackState = 'demo';
  transcriptionText.textContent = 'Demo only: HELLO SIGN LANGUAGE WELCOME';
  transcriptionText.classList.remove('placeholder');
  statWords.textContent = '4';
  statLetters.textContent = '26';
  videoQueue = [...DEMO_SEQUENCE];
  playNextSignVideo('demo');
}

function scheduleIdleDemo() {
  clearTimeout(idleDemoTimeout);
  if (appState.mode !== 'audio' || appState.userHasOutput) return;
  idleDemoTimeout = setTimeout(startIdleDemoLoop, 3000);
}

if (btnHowItWorks) {
  btnHowItWorks.addEventListener('click', () => {
    updateModalStep(0);
    modalOverlay.classList.add('active');
  });
}
modalCloseBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));
modalPrevBtn.addEventListener('click', () => {
  if (currentModalStep > 0) updateModalStep(currentModalStep - 1);
});
modalNextBtn.addEventListener('click', () => {
  if (currentModalStep < walkthroughSteps.length - 1) updateModalStep(currentModalStep + 1);
  else modalOverlay.classList.remove('active');
});
modalOverlay.addEventListener('click', (event) => {
  if (event.target === modalOverlay) modalOverlay.classList.remove('active');
});

window.addEventListener('DOMContentLoaded', () => {
  scheduleIdleDemo();
  initSignToTextPipeline();
});

function initSignToTextPipeline() {
  const tabAudioToSign = document.getElementById('tabAudioToSign');
  const tabSignToText = document.getElementById('tabSignToText');
  const audioToSignView = document.getElementById('audioToSignView');
  const signToTextView = document.getElementById('signToTextView');
  if (!tabAudioToSign || !tabSignToText) return;

  const webcamElement = document.getElementById('webcamElement');
  const handCanvas = document.getElementById('handCanvas');
  const ctx = handCanvas.getContext('2d');
  const cameraPromptOverlay = document.getElementById('cameraPromptOverlay');
  const btnStartCamera = document.getElementById('btnStartCamera');
  const camControlBar = document.getElementById('camControlBar');
  const btnStopCamera = document.getElementById('btnStopCamera');
  const btnFlipCamera = document.getElementById('btnFlipCamera');
  const camStatusBadge = document.getElementById('camStatusBadge');
  const handCountBadge = document.getElementById('handCountBadge');
  const fpsDisplay = document.getElementById('fpsDisplay');
  const predictedSignBadge = document.getElementById('predictedSignBadge');
  const predictedSignDesc = document.getElementById('predictedSignDesc');
  const confidencePercentage = document.getElementById('confidencePercentage');
  const confidenceBar = document.getElementById('confidenceBar');
  const commitFill = document.getElementById('commitFill');
  const sentenceDisplay = document.getElementById('sentenceDisplay');
  const toggleAutoSpeak = document.getElementById('toggleAutoSpeak');
  const btnSpeakSentence = document.getElementById('btnSpeakSentence');
  const btnCopySentence = document.getElementById('btnCopySentence');
  const btnBackspaceSentence = document.getElementById('btnBackspaceSentence');
  const btnClearSentence = document.getElementById('btnClearSentence');

  let camera = null;
  let handsModel = null;
  let isCameraActive = false;
  let isMirrored = true;
  let fallbackCameraStream = null;
  let cameraRafId = null;
  let frameCount = 0;
  let fpsTimer = performance.now();
  let accumulatedWords = [];
  const gestureGate = Core.createGestureCommitGate(14);

  tabAudioToSign.addEventListener('click', () => {
    tabAudioToSign.classList.add('active');
    tabSignToText.classList.remove('active');
    audioToSignView.style.display = 'flex';
    signToTextView.style.display = 'none';
    appState.mode = 'audio';
    stopCameraFeed();
    if (appState.recordingState !== 'recording') setRecordingState('idle');
    scheduleIdleDemo();
  });

  tabSignToText.addEventListener('click', () => {
    tabSignToText.classList.add('active');
    tabAudioToSign.classList.remove('active');
    signToTextView.style.display = 'flex';
    audioToSignView.style.display = 'none';
    appState.mode = 'camera';
    stopRecording({ cancel: true });
    abortActiveRequests();
    resetPlayback(null);
    releaseMicStream();
    statStatus.textContent = 'CAMERA READY';
    statWords.textContent = accumulatedWords.length;
    statLetters.textContent = accumulatedWords.join('').length;
  });

  function setupHandsModel() {
    if (typeof Hands === 'undefined') {
      console.warn('MediaPipe Hands library not loaded yet.');
      return null;
    }
    const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
    hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.65, minTrackingConfidence: 0.65 });
    hands.onResults(onHandResults);
    return hands;
  }

  async function startCameraFeed() {
    if (isCameraActive) return;
    if (!handsModel) handsModel = setupHandsModel();
    if (!handsModel) {
      camStatusBadge.textContent = 'TRACKER UNAVAILABLE';
      predictedSignDesc.textContent = 'MediaPipe failed to load. Check network access.';
      return;
    }

    try {
      camStatusBadge.textContent = 'INITIALIZING...';
      camStatusBadge.className = 'cam-status-pill status-off';
      isCameraActive = true;

      if (typeof Camera !== 'undefined') {
        camera = new Camera(webcamElement, {
          onFrame: async () => {
            if (isCameraActive && handsModel) await handsModel.send({ image: webcamElement });
          },
          width: 640,
          height: 360
        });
        await camera.start();
      } else {
        fallbackCameraStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 360, facingMode: 'user' },
          audio: false
        });
        webcamElement.srcObject = fallbackCameraStream;
        await webcamElement.play();
        const processVideoLoop = async () => {
          if (!isCameraActive) return;
          if (handsModel && webcamElement.videoWidth > 0) await handsModel.send({ image: webcamElement });
          cameraRafId = requestAnimationFrame(processVideoLoop);
        };
        cameraRafId = requestAnimationFrame(processVideoLoop);
      }

      cameraPromptOverlay.style.display = 'none';
      camControlBar.style.display = 'flex';
      camStatusBadge.textContent = 'TRACKING LIVE';
      camStatusBadge.className = 'cam-status-pill status-live';
      statStatus.textContent = 'TRACKING LIVE';
    } catch (err) {
      console.error('Webcam access error:', err);
      isCameraActive = false;
      camStatusBadge.textContent = 'CAM ERROR';
      camStatusBadge.className = 'cam-status-pill status-off';
      predictedSignDesc.textContent = 'Camera permission denied or unavailable.';
      cameraPromptOverlay.style.display = 'flex';
    }
  }

  function stopCameraFeed() {
    isCameraActive = false;
    if (camera && camera.stop) {
      try { camera.stop(); } catch (e) {}
    }
    camera = null;
    if (cameraRafId) {
      cancelAnimationFrame(cameraRafId);
      cameraRafId = null;
    }
    if (fallbackCameraStream) {
      fallbackCameraStream.getTracks().forEach((track) => track.stop());
      fallbackCameraStream = null;
    }
    if (webcamElement.srcObject) {
      webcamElement.srcObject.getTracks().forEach((track) => track.stop());
      webcamElement.srcObject = null;
    }
    gestureGate.reset();
    cameraPromptOverlay.style.display = 'flex';
    camControlBar.style.display = 'none';
    camStatusBadge.textContent = 'CAMERA OFF';
    camStatusBadge.className = 'cam-status-pill status-off';
    handCountBadge.textContent = '0 HANDS';
    predictedSignBadge.textContent = 'IDLE';
    predictedSignDesc.textContent = 'Experimental heuristic: show your hand clearly';
    confidenceBar.style.width = '0%';
    confidencePercentage.textContent = 'UNVERIFIED';
    commitFill.style.width = '0%';
    fpsDisplay.textContent = '0';
    ctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  }

  btnStartCamera.addEventListener('click', startCameraFeed);
  btnStopCamera.addEventListener('click', stopCameraFeed);
  btnFlipCamera.addEventListener('click', () => {
    isMirrored = !isMirrored;
    const transformVal = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
    webcamElement.style.transform = transformVal;
    handCanvas.style.transform = transformVal;
  });

  function onHandResults(results) {
    if (!isCameraActive) return;
    if (handCanvas.width !== webcamElement.videoWidth || handCanvas.height !== webcamElement.videoHeight) {
      handCanvas.width = webcamElement.videoWidth || 640;
      handCanvas.height = webcamElement.videoHeight || 360;
    }

    frameCount += 1;
    const now = performance.now();
    if (now - fpsTimer >= 1000) {
      fpsDisplay.textContent = Math.round((frameCount * 1000) / (now - fpsTimer));
      frameCount = 0;
      fpsTimer = now;
    }

    ctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    const handsDetected = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;
    handCountBadge.textContent = `${handsDetected} ${handsDetected === 1 ? 'HAND' : 'HANDS'}`;

    if (handsDetected > 0) {
      for (const landmarks of results.multiHandLandmarks) drawCyberpunkHand(ctx, landmarks, handCanvas.width, handCanvas.height);
      updatePredictionHUD(classifyHandGesture(results.multiHandLandmarks[0]));
    } else {
      predictedSignBadge.textContent = 'NO HAND';
      predictedSignDesc.textContent = 'Release detected. Show a supported hand shape to try again.';
      confidenceBar.style.width = '0%';
      confidencePercentage.textContent = 'UNVERIFIED';
      commitFill.style.width = '0%';
      gestureGate.update(null);
    }
  }

  function drawCyberpunkHand(canvasCtx, landmarks, width, height) {
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17]
    ];

    canvasCtx.save();
    canvasCtx.lineWidth = 3.5;
    canvasCtx.lineCap = 'round';
    canvasCtx.lineJoin = 'round';
    canvasCtx.strokeStyle = '#00d2ff';
    canvasCtx.shadowColor = '#00d2ff';
    canvasCtx.shadowBlur = 12;

    for (const [startIdx, endIdx] of connections) {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];
      canvasCtx.beginPath();
      canvasCtx.moveTo(p1.x * width, p1.y * height);
      canvasCtx.lineTo(p2.x * width, p2.y * height);
      canvasCtx.stroke();
    }

    for (let i = 0; i < landmarks.length; i += 1) {
      const lm = landmarks[i];
      const cx = lm.x * width;
      const cy = lm.y * height;
      const isTip = [4, 8, 12, 16, 20].includes(i);
      const isWrist = i === 0;
      canvasCtx.beginPath();
      canvasCtx.arc(cx, cy, isTip ? 6 : (isWrist ? 7 : 4), 0, 2 * Math.PI);

      if (isTip) {
        canvasCtx.fillStyle = '#ff2a85';
        canvasCtx.shadowColor = '#ff2a85';
        canvasCtx.shadowBlur = 14;
      } else if (isWrist) {
        canvasCtx.fillStyle = '#ffb800';
        canvasCtx.shadowColor = '#ffb800';
        canvasCtx.shadowBlur = 10;
      } else {
        canvasCtx.fillStyle = '#b3ff00';
        canvasCtx.shadowColor = '#b3ff00';
        canvasCtx.shadowBlur = 8;
      }
      canvasCtx.fill();
    }
    canvasCtx.restore();
  }

  function classifyHandGesture(landmarks) {
    if (!landmarks || landmarks.length < 21) return { gesture: 'WAITING', desc: 'Detecting landmarks...', supported: false };

    const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y, (p1.z || 0) - (p2.z || 0));
    const wrist = landmarks[0];
    const middleMcp = landmarks[9];
    const scale = dist(wrist, middleMcp) || 1.0;
    const norm = landmarks.map((p) => ({ x: (p.x - wrist.x) / scale, y: (p.y - wrist.y) / scale, z: ((p.z || 0) - (wrist.z || 0)) / scale }));
    const thumbTip = norm[4], thumbIp = norm[3], thumbMcp = norm[2];
    const indexTip = norm[8], indexPip = norm[6];
    const middleTip = norm[12], middlePip = norm[10];
    const ringTip = norm[16], ringPip = norm[14];
    const pinkyTip = norm[20], pinkyPip = norm[18], pinkyMcp = norm[17];
    const origin = { x: 0, y: 0, z: 0 };

    const indexExtended = dist(indexTip, origin) > dist(indexPip, origin) * 1.15;
    const middleExtended = dist(middleTip, origin) > dist(middlePip, origin) * 1.15;
    const ringExtended = dist(ringTip, origin) > dist(ringPip, origin) * 1.15;
    const pinkyExtended = dist(pinkyTip, origin) > dist(pinkyPip, origin) * 1.15;
    const thumbExtended = dist(thumbTip, pinkyMcp) > dist(thumbIp, pinkyMcp) * 1.25;
    const distThumbIndex = dist(thumbTip, indexTip);
    const distThumbMiddle = dist(thumbTip, middleTip);

    if (distThumbIndex < 0.35 && middleExtended && ringExtended && pinkyExtended) return { gesture: 'OKAY', desc: 'Experimental hand-shape heuristic: okay-like shape', supported: true };
    if (thumbExtended && indexExtended && !middleExtended && !ringExtended && pinkyExtended) return { gesture: 'I LOVE YOU', desc: 'Experimental hand-shape heuristic: ILY-like shape', supported: true };
    if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
      return dist(indexTip, middleTip) > 0.3
        ? { gesture: 'PEACE', desc: 'Experimental hand-shape heuristic: V shape', supported: true }
        : { gesture: 'U', desc: 'Experimental hand-shape heuristic: U-like shape', supported: true };
    }
    if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      if (thumbTip.y < thumbMcp.y - 0.2) return { gesture: 'GOOD', desc: 'Experimental hand-shape heuristic: thumbs up', supported: true };
      if (thumbTip.y > thumbMcp.y + 0.2) return { gesture: 'BAD', desc: 'Experimental hand-shape heuristic: thumbs down', supported: true };
      return { gesture: 'A', desc: 'Experimental hand-shape heuristic: A-like fist', supported: true };
    }
    if (thumbExtended && indexExtended && !middleExtended && !ringExtended && !pinkyExtended) return { gesture: 'L', desc: 'Experimental hand-shape heuristic: L-like shape', supported: true };
    if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && pinkyExtended) return { gesture: 'CALL ME', desc: 'Experimental hand-shape heuristic: Y-like shape', supported: true };
    if (!thumbExtended && !indexExtended && !middleExtended && !ringExtended && pinkyExtended) return { gesture: 'I', desc: 'Experimental hand-shape heuristic: I-like shape', supported: true };
    if (!thumbExtended && indexExtended && !middleExtended && !ringExtended && !pinkyExtended) return { gesture: 'YOU', desc: 'Experimental hand-shape heuristic: pointing shape', supported: true };
    if (indexExtended && middleExtended && ringExtended && !pinkyExtended) return { gesture: 'W', desc: 'Experimental hand-shape heuristic: W-like shape', supported: true };
    if (thumbExtended && indexExtended && middleExtended && ringExtended && pinkyExtended) return { gesture: 'HELLO', desc: 'Experimental hand-shape heuristic: open palm', supported: true };
    if (!thumbExtended && indexExtended && middleExtended && ringExtended && pinkyExtended) return { gesture: 'THANK YOU', desc: 'Experimental hand-shape heuristic: B-like hand', supported: true };
    if (!thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) return { gesture: 'YES', desc: 'Experimental hand-shape heuristic: closed fist', supported: true };
    if (distThumbIndex < 0.4 && distThumbMiddle < 0.4 && !ringExtended && !pinkyExtended) return { gesture: 'NO', desc: 'Experimental hand-shape heuristic: pinch shape', supported: true };
    if (!indexExtended && !pinkyExtended && distThumbIndex > 0.35 && distThumbIndex < 0.75) return { gesture: 'C', desc: 'Experimental hand-shape heuristic: C-like curve', supported: true };
    return { gesture: 'UNKNOWN', desc: 'Unknown or unsupported hand shape', supported: false };
  }

  function updatePredictionHUD(prediction) {
    predictedSignBadge.textContent = prediction.gesture;
    predictedSignDesc.textContent = prediction.desc;
    confidencePercentage.textContent = 'UNVERIFIED';

    if (!prediction.supported) {
      const result = gestureGate.update(null);
      confidenceBar.style.width = '0%';
      commitFill.style.width = `${result.progress}%`;
      return;
    }

    const gateResult = gestureGate.update(prediction.gesture);
    confidenceBar.style.width = `${gateResult.progress}%`;
    commitFill.style.width = `${gateResult.progress}%`;

    if (gateResult.committed) {
      commitGestureToSentence(gateResult.committed);
    } else if (gateResult.needsRelease) {
      predictedSignDesc.textContent = `${prediction.desc}. Release or change shape before adding it again.`;
    }
  }

  function commitGestureToSentence(gesture) {
    accumulatedWords.push(gesture);
    renderSentence();
    predictedSignBadge.style.transform = 'scale(1.15)';
    predictedSignBadge.style.color = 'var(--accent-lime)';
    setTimeout(() => {
      predictedSignBadge.style.transform = 'scale(1)';
      predictedSignBadge.style.color = 'var(--accent-cyan)';
    }, 250);
    if (toggleAutoSpeak && toggleAutoSpeak.checked) speakAloud(gesture);
  }

  function renderSentence() {
    if (accumulatedWords.length === 0) {
      sentenceDisplay.textContent = 'Signed words will accumulate here...';
      sentenceDisplay.classList.add('placeholder');
    } else {
      sentenceDisplay.textContent = accumulatedWords.join(' ');
      sentenceDisplay.classList.remove('placeholder');
    }
    statWords.textContent = accumulatedWords.length;
    statLetters.textContent = accumulatedWords.join('').length;
  }

  function speakAloud(text) {
    if (!text || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const engVoice = voices.find((voice) => voice.lang.startsWith('en'));
      if (engVoice) utterance.voice = engVoice;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('SpeechSynthesis error:', e);
    }
  }

  btnSpeakSentence.addEventListener('click', () => {
    const text = accumulatedWords.join(' ');
    speakAloud(text || 'No words recorded yet.');
  });

  btnCopySentence.addEventListener('click', async () => {
    const text = accumulatedWords.join(' ');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const originalText = btnCopySentence.innerHTML;
      btnCopySentence.innerHTML = '<span>OK</span> COPIED!';
      btnCopySentence.style.background = 'var(--accent-lime)';
      btnCopySentence.style.color = '#000';
      setTimeout(() => {
        btnCopySentence.innerHTML = originalText;
        btnCopySentence.style.background = '';
        btnCopySentence.style.color = '';
      }, 1500);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
    }
  });

  btnBackspaceSentence.addEventListener('click', () => {
    if (accumulatedWords.length > 0) {
      accumulatedWords.pop();
      renderSentence();
      gestureGate.reset();
    }
  });

  btnClearSentence.addEventListener('click', () => {
    accumulatedWords = [];
    gestureGate.reset();
    renderSentence();
  });
}
