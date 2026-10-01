// Elements
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

// Stat Elements
const statWords = document.getElementById('statWords');
const statLetters = document.getElementById('statLetters');
const statStatus = document.getElementById('statStatus');

// Walkthrough Modal Elements
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

let isRecording = false;
let isUserSession = false;
let recorder = null;
let stream = null;
let speechRecognizer = null;

let currentText = '';
let videoQueue = [];
let isPlayingVideo = false;
let idleDemoTimeout = null;

// Default Demo Queue for continuous Sign Stage playback
const DEMO_SEQUENCE = [
  { word: 'hello', type: 'word', url: '/datasets/hello.mp4' },
  { word: 'sign', type: 'word', url: '/datasets/sign.mp4' },
  { word: 'language', type: 'word', url: '/datasets/language.mp4' },
  { word: 'welcome', type: 'word', url: '/datasets/welcome.mp4' }
];

// Walkthrough Steps Data
const walkthroughSteps = [
  {
    icon: `<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`,
    title: '1. Allow the mic',
    desc: 'Tap the big gradient button and approve the browser\'s microphone prompt. Speech recognition and audio recording run live in your session.'
  },
  {
    icon: `<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`,
    title: '2. Speak naturally',
    desc: 'Speak clearly into your mic. The equalizer dots will pulse dynamically and live speech transcription will capture your words.'
  },
  {
    icon: `<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>`,
    title: '3. Watch the transcript',
    desc: 'Your transcribed text will appear in real-time loud and proud inside the Recognized Text panel.'
  },
  {
    icon: `<svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 9H3V5h9v7z"/></svg>`,
    title: '4. Read the sign stage',
    desc: 'Our NLP engine processes your sentence structure and streams corresponding sign language clips and fingerspelling tiles onto the stage.'
  },
  {
    icon: `<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>`,
    title: '5. Track session stats',
    desc: 'Track live total word counts, character letters, and recording status in real-time at the bottom dashboard.'
  }
];

let currentModalStep = 0;

function updateModalStep(stepIndex) {
  currentModalStep = stepIndex;
  const step = walkthroughSteps[stepIndex];
  modalTitle.textContent = step.title;
  modalDesc.textContent = step.desc;
  modalIcon.innerHTML = step.icon;

  for (let i = 0; i < modalDots.length; i++) {
    if (i === stepIndex) {
      modalDots[i].classList.add('active');
    } else {
      modalDots[i].classList.remove('active');
    }
  }

  if (stepIndex === walkthroughSteps.length - 1) {
    modalNextLabel.textContent = 'START SIGNING';
  } else {
    modalNextLabel.textContent = 'NEXT';
  }
}

// Modal Event Listeners
if (btnHowItWorks) {
  btnHowItWorks.addEventListener('click', () => {
    updateModalStep(0);
    modalOverlay.classList.add('active');
  });
}

modalCloseBtn.addEventListener('click', () => {
  modalOverlay.classList.remove('active');
});

modalPrevBtn.addEventListener('click', () => {
  if (currentModalStep > 0) {
    updateModalStep(currentModalStep - 1);
  }
});

modalNextBtn.addEventListener('click', () => {
  if (currentModalStep < walkthroughSteps.length - 1) {
    updateModalStep(currentModalStep + 1);
  } else {
    modalOverlay.classList.remove('active');
  }
});

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    modalOverlay.classList.remove('active');
  }
});

// Setup Microphone & Web Speech Recognition
async function setupAudio() {
  if (!stream) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Please allow microphone access to record voice.");
      return false;
    }
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition && !speechRecognizer) {
    speechRecognizer = new SpeechRecognition();
    speechRecognizer.continuous = true;
    speechRecognizer.interimResults = true;
    speechRecognizer.lang = 'en-US';

    speechRecognizer.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript.trim()) {
        updateTranscriptionUI(transcript);
      }
    };

    speechRecognizer.onerror = (event) => {
      console.log("Speech recognition status:", event.error);
    };
  }

  return true;
}

// Toggle Recording State
recordBtn.addEventListener('click', async () => {
  const ready = await setupAudio();
  if (!ready || !stream) return;

  if (!isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
});

function startRecording() {
  isRecording = true;
  isUserSession = true;
  clearTimeout(idleDemoTimeout);
  currentText = '';

  // Initialize RecordRTC
  recorder = new RecordRTC(stream, {
    type: 'audio',
    mimeType: 'audio/wav',
    recorderType: StereoAudioRecorder,
    numberOfAudioChannels: 1,
    desiredSampRate: 16000
  });

  recorder.startRecording();

  if (speechRecognizer) {
    try { speechRecognizer.start(); } catch (e) {}
  }

  // UI Updates
  recordBtn.classList.add('recording');
  controlCard.classList.add('recording');
  micLabel.textContent = 'RECORDING';
  micSublabel.textContent = 'Listening... speak now';

  transcriptionText.textContent = 'Listening for speech...';
  transcriptionText.classList.remove('placeholder');

  stageTitle.textContent = 'SIGN STAGE ACTIVE';
  statStatus.textContent = 'LIVE';

  videoQueue = [];
  isPlayingVideo = false;
  signVideo.pause();
  signVideo.removeAttribute('src');
}

function stopRecording() {
  isRecording = false;

  recordBtn.classList.remove('recording');
  controlCard.classList.remove('recording');
  micLabel.textContent = 'TRANSLATING';
  micSublabel.textContent = 'Converting words to sign language animations...';
  statStatus.textContent = 'PROCESSING';

  if (speechRecognizer) {
    try { speechRecognizer.stop(); } catch (e) {}
  }

  // If we already have live text from Web Speech API, immediately process text for sign videos!
  if (currentText && currentText.trim()) {
    processTextForSignVideos(currentText);
  }

  // Send audio file blob as backup
  if (recorder) {
    recorder.stopRecording(async () => {
      const audioBlob = recorder.getBlob();
      await sendAudioToBackend(audioBlob);
    });
  }
}

function updateTranscriptionUI(text) {
  currentText = text;
  transcriptionText.textContent = text;
  transcriptionText.classList.remove('placeholder');

  // Stats calculation
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const letters = text.replace(/[^a-zA-Z0-9]/g, '').length;

  statWords.textContent = words;
  statLetters.textContent = letters;

  // Real-time sign mapping as user speaks
  if (text.trim().length > 2) {
    processTextForSignVideos(text);
  }
}

// Process Text to Sign Language Videos via Backend API (/api/process-text)
async function processTextForSignVideos(text) {
  try {
    const response = await fetch('/api/process-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    });

    const data = await response.json();

    micLabel.textContent = 'START RECORDING';
    micSublabel.textContent = 'Tap the big button to record again';
    statStatus.textContent = 'IDLE';

    if (response.ok && data.video_sequence && data.video_sequence.length > 0) {
      videoQueue = data.video_sequence;
      if (!isPlayingVideo) {
        playNextSignVideo();
      }
    } else {
      spellOutTextLetters(text);
    }
  } catch (err) {
    console.error("Text processing error:", err);
    spellOutTextLetters(text);
  }
}

function renderFingerspellingTiles(word, activeChar = null) {
  fingerspellingTiles.innerHTML = '';
  const cleanWord = word.toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (let char of cleanWord) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    if (activeChar && char === activeChar.toUpperCase()) {
      tile.classList.add('active');
    }
    tile.textContent = char;
    fingerspellingTiles.appendChild(tile);
  }
  if (cleanWord) {
    currentWordBadge.textContent = activeChar ? `Fingerspelling: ${activeChar}` : `Signing: ${cleanWord}`;
  }
}

// Send Audio Blob to Backend API (/api/process-audio)
async function sendAudioToBackend(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');

  try {
    const response = await fetch('/api/process-audio', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    micLabel.textContent = 'START RECORDING';
    micSublabel.textContent = 'Tap the big button to record again';
    statStatus.textContent = 'IDLE';

    if (response.ok && data.video_sequence && data.video_sequence.length > 0) {
      if (data.original_text) {
        updateTranscriptionUI(data.original_text);
      }
      videoQueue = data.video_sequence;
      if (!isPlayingVideo) {
        playNextSignVideo();
      }
    }
  } catch (err) {
    console.error("Audio API error:", err);
    micLabel.textContent = 'START RECORDING';
    micSublabel.textContent = 'Tap the big button to record again';
    statStatus.textContent = 'IDLE';
  }
}

// Spell out letters dynamically if no full word video exists
function spellOutTextLetters(text) {
  const words = text.trim().split(/\s+/);
  const queue = [];

  for (let word of words) {
    const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let char of cleanWord) {
      queue.push({
        word: char,
        parentWord: word,
        type: 'letter',
        url: `/datasets/${char}.mp4`
      });
    }
  }

  if (queue.length > 0) {
    videoQueue = queue;
    if (!isPlayingVideo) {
      playNextSignVideo();
    }
  }
}

// Play sign language MP4 videos sequentially on the Sign Stage
function playNextSignVideo() {
  if (videoQueue.length === 0) {
    isPlayingVideo = false;
    stageTitle.textContent = 'DEMO SIGN STAGE';
    
    // Resume continuous demo loop after 3 seconds of idle time
    idleDemoTimeout = setTimeout(() => {
      startIdleDemoLoop();
    }, 3000);
    return;
  }

  isPlayingVideo = true;
  const item = videoQueue.shift();

  // ALWAYS MAKE VIDEO CONTAINER VISIBLE
  stagePlaceholder.style.display = 'none';
  videoContainer.style.display = 'block';

  if (item.type === 'letter') {
    currentWordBadge.textContent = `Letter: ${item.word.toUpperCase()}`;
    const wordContext = item.parentWord || item.word;
    renderFingerspellingTiles(wordContext, item.word);
  } else {
    currentWordBadge.textContent = `Signing: ${item.word.toUpperCase()}`;
    renderFingerspellingTiles(item.word);
  }

  signVideo.src = item.url;
  signVideo.load();

  signVideo.oncanplay = () => {
    signVideo.playbackRate = 0.75;
    signVideo.play().catch(e => console.log("Video play error:", e));
  };

  signVideo.onended = () => {
    setTimeout(playNextSignVideo, 250);
  };

  signVideo.onerror = () => {
    console.error("Video file not found for:", item.url);
    // If word video missing, expand into letter videos
    if (item.type !== 'letter' && item.word) {
      const letters = item.word.toLowerCase().split('');
      const letterItems = letters.map(c => ({
        word: c,
        parentWord: item.word,
        type: 'letter',
        url: `/datasets/${c}.mp4`
      }));
      videoQueue.unshift(...letterItems);
    }
    playNextSignVideo();
  };
}

// Continuous Idle Demo Sign Loop
function startIdleDemoLoop() {
  if (isRecording || isPlayingVideo) return;

  if (transcriptionText.classList.contains('placeholder') || !isUserSession) {
    transcriptionText.textContent = "Demonstration: HELLO SIGN LANGUAGE WELCOME";
    transcriptionText.classList.remove('placeholder');
    statWords.textContent = '4';
    statLetters.textContent = '26';
  }

  videoQueue = [...DEMO_SEQUENCE];
  playNextSignVideo();
}

// Automatically start continuous demo sign video playback on page load
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(startIdleDemoLoop, 400);
  initSignToTextPipeline();
});

/* ==========================================================================
   MODE SWITCHER & MEDIAPIPE SIGN-TO-TEXT PIPELINE
   ========================================================================== */

function initSignToTextPipeline() {
  // Mode Tab Elements
  const tabAudioToSign = document.getElementById('tabAudioToSign');
  const tabSignToText = document.getElementById('tabSignToText');
  const audioToSignView = document.getElementById('audioToSignView');
  const signToTextView = document.getElementById('signToTextView');

  if (!tabAudioToSign || !tabSignToText) return;

  // Tab Switching
  tabAudioToSign.addEventListener('click', () => {
    tabAudioToSign.classList.add('active');
    tabSignToText.classList.remove('active');
    audioToSignView.style.display = 'flex';
    signToTextView.style.display = 'none';

    // Stop webcam if active to save resources
    stopCameraFeed();

    // Resume idle demo if idle
    if (!isRecording && !isPlayingVideo) {
      startIdleDemoLoop();
    }
  });

  tabSignToText.addEventListener('click', () => {
    tabSignToText.classList.add('active');
    tabAudioToSign.classList.remove('active');
    signToTextView.style.display = 'flex';
    audioToSignView.style.display = 'none';

    // Pause audio-to-sign playback
    if (signVideo) signVideo.pause();
    isPlayingVideo = false;
    clearTimeout(idleDemoTimeout);

    // Update status in stats
    statStatus.textContent = 'CAMERA READY';
    statWords.textContent = accumulatedWords.length;
    statLetters.textContent = accumulatedWords.join('').length;
  });

  // Camera & Tracking Elements
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

  // Prediction HUD Elements
  const predictedSignBadge = document.getElementById('predictedSignBadge');
  const predictedSignDesc = document.getElementById('predictedSignDesc');
  const confidencePercentage = document.getElementById('confidencePercentage');
  const confidenceBar = document.getElementById('confidenceBar');
  const commitFill = document.getElementById('commitFill');

  // Sentence Builder Elements
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

  // Frame timing & FPS
  let lastFrameTime = performance.now();
  let frameCount = 0;
  let fpsTimer = performance.now();

  // Gesture Recognition State
  let candidateGesture = null;
  let candidateHoldCount = 0;
  const REQUIRED_HOLD_FRAMES = 14; // ~0.5s at 30fps
  let lastCommittedGesture = null;
  let cooldownFrames = 0;
  const COOLDOWN_DURATION = 20; // prevent immediate duplicate appends
  let accumulatedWords = [];

  // Initialize MediaPipe Hands
  function setupHandsModel() {
    if (typeof Hands === 'undefined') {
      console.warn("MediaPipe Hands library not loaded yet.");
      return null;
    }

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.65
    });

    hands.onResults(onHandResults);
    return hands;
  }

  // Camera Start
  async function startCameraFeed() {
    if (isCameraActive) return;

    if (!handsModel) {
      handsModel = setupHandsModel();
    }

    try {
      camStatusBadge.textContent = 'INITIALIZING...';
      camStatusBadge.className = 'cam-status-pill status-off';

      if (typeof Camera !== 'undefined') {
        camera = new Camera(webcamElement, {
          onFrame: async () => {
            if (isCameraActive && handsModel) {
              await handsModel.send({ image: webcamElement });
            }
          },
          width: 640,
          height: 360
        });

        await camera.start();
      } else {
        // Fallback to standard getUserMedia
        const userMediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 360, facingMode: 'user' },
          audio: false
        });
        webcamElement.srcObject = userMediaStream;
        await webcamElement.play();

        const processVideoLoop = async () => {
          if (isCameraActive && handsModel && webcamElement.videoWidth > 0) {
            await handsModel.send({ image: webcamElement });
            requestAnimationFrame(processVideoLoop);
          }
        };
        requestAnimationFrame(processVideoLoop);
      }

      isCameraActive = true;
      cameraPromptOverlay.style.display = 'none';
      camControlBar.style.display = 'flex';
      camStatusBadge.textContent = 'TRACKING LIVE';
      camStatusBadge.className = 'cam-status-pill status-live';
      statStatus.textContent = 'TRACKING LIVE';
    } catch (err) {
      console.error("Webcam access error:", err);
      camStatusBadge.textContent = 'CAM ERROR';
      alert("Unable to access camera. Please allow camera permissions in your browser.");
    }
  }

  // Camera Stop
  function stopCameraFeed() {
    if (!isCameraActive) return;
    isCameraActive = false;

    if (camera && camera.stop) {
      try { camera.stop(); } catch (e) {}
    }

    if (webcamElement.srcObject) {
      const tracks = webcamElement.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      webcamElement.srcObject = null;
    }

    cameraPromptOverlay.style.display = 'flex';
    camControlBar.style.display = 'none';
    camStatusBadge.textContent = 'CAMERA OFF';
    camStatusBadge.className = 'cam-status-pill status-off';
    handCountBadge.textContent = '0 HANDS';
    predictedSignBadge.textContent = 'IDLE';
    predictedSignDesc.textContent = 'Show your hand clearly';
    confidenceBar.style.width = '0%';
    confidencePercentage.textContent = '0%';
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

  // MediaPipe Results Callback
  function onHandResults(results) {
    if (!isCameraActive) return;

    // Adjust canvas dimensions to match video stream
    if (handCanvas.width !== webcamElement.videoWidth || handCanvas.height !== webcamElement.videoHeight) {
      handCanvas.width = webcamElement.videoWidth || 640;
      handCanvas.height = webcamElement.videoHeight || 360;
    }

    // Measure FPS
    frameCount++;
    const now = performance.now();
    if (now - fpsTimer >= 1000) {
      fpsDisplay.textContent = Math.round((frameCount * 1000) / (now - fpsTimer));
      frameCount = 0;
      fpsTimer = now;
    }

    ctx.clearRect(0, 0, handCanvas.width, handCanvas.height);

    const handsDetected = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;
    handCountBadge.textContent = `${handsDetected} ${handsDetected === 1 ? 'HAND' : 'HANDS'}`;

    if (cooldownFrames > 0) {
      cooldownFrames--;
    }

    if (handsDetected > 0) {
      // Draw neon skeleton for each detected hand
      for (const landmarks of results.multiHandLandmarks) {
        drawCyberpunkHand(ctx, landmarks, handCanvas.width, handCanvas.height);
      }

      // Classify the primary hand
      const primaryHand = results.multiHandLandmarks[0];
      const prediction = classifyHandGesture(primaryHand);

      updatePredictionHUD(prediction);
    } else {
      // No hands in view
      predictedSignBadge.textContent = 'NO HAND';
      predictedSignDesc.textContent = 'Position hand in frame';
      confidenceBar.style.width = '0%';
      confidencePercentage.textContent = '0%';
      commitFill.style.width = '0%';
      candidateGesture = null;
      candidateHoldCount = 0;
    }
  }

  // Draw Cyberpunk Glowing Neon Hand Skeleton
  function drawCyberpunkHand(canvasCtx, landmarks, width, height) {
    // 21 Joint Connections for MediaPipe Hand
    const connections = [
      // Thumb
      [0, 1], [1, 2], [2, 3], [3, 4],
      // Index
      [0, 5], [5, 6], [6, 7], [7, 8],
      // Middle
      [0, 9], [9, 10], [10, 11], [11, 12],
      // Ring
      [0, 13], [13, 14], [14, 15], [15, 16],
      // Pinky
      [0, 17], [17, 18], [18, 19], [19, 20],
      // Palm Base
      [5, 9], [9, 13], [13, 17]
    ];

    // Draw connecting bones
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

    // Draw joints
    for (let i = 0; i < landmarks.length; i++) {
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

  // Fast Geometric Feature Extractor & Classifier
  function classifyHandGesture(landmarks) {
    if (!landmarks || landmarks.length < 21) {
      return { gesture: 'WAITING', confidence: 0, desc: 'Detecting...' };
    }

    // Euclidean distance helper
    const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y, (p1.z || 0) - (p2.z || 0));

    const wrist = landmarks[0];
    const middleMcp = landmarks[9];
    const scale = dist(wrist, middleMcp) || 1.0;

    // Normalizing landmarks relative to wrist and palm scale
    const norm = landmarks.map(p => ({
      x: (p.x - wrist.x) / scale,
      y: (p.y - wrist.y) / scale,
      z: ((p.z || 0) - (wrist.z || 0)) / scale
    }));

    const thumbTip = norm[4], thumbIp = norm[3], thumbMcp = norm[2];
    const indexTip = norm[8], indexPip = norm[6], indexMcp = norm[5];
    const middleTip = norm[12], middlePip = norm[10], middleMcpNorm = norm[9];
    const ringTip = norm[16], ringPip = norm[14], ringMcp = norm[13];
    const pinkyTip = norm[20], pinkyPip = norm[18], pinkyMcp = norm[17];

    // Extension state logic: TIP further from wrist than PIP
    const indexExtended = dist(indexTip, {x:0,y:0,z:0}) > dist(indexPip, {x:0,y:0,z:0}) * 1.15;
    const middleExtended = dist(middleTip, {x:0,y:0,z:0}) > dist(middlePip, {x:0,y:0,z:0}) * 1.15;
    const ringExtended = dist(ringTip, {x:0,y:0,z:0}) > dist(ringPip, {x:0,y:0,z:0}) * 1.15;
    const pinkyExtended = dist(pinkyTip, {x:0,y:0,z:0}) > dist(pinkyPip, {x:0,y:0,z:0}) * 1.15;

    // Thumb extended away from pinky MCP
    const thumbExtended = dist(thumbTip, pinkyMcp) > dist(thumbIp, pinkyMcp) * 1.25;

    // Pinch distances
    const distThumbIndex = dist(thumbTip, indexTip);
    const distThumbMiddle = dist(thumbTip, middleTip);

    // 1. OKAY Sign: Thumb and Index tips touch, other 3 extended
    if (distThumbIndex < 0.35 && middleExtended && ringExtended && pinkyExtended) {
      return { gesture: 'OKAY', confidence: 0.94, desc: 'Okay / Perfect' };
    }

    // 2. I LOVE YOU (ILY): Thumb, Index, Pinky extended; Middle and Ring curled
    if (thumbExtended && indexExtended && !middleExtended && !ringExtended && pinkyExtended) {
      return { gesture: 'I LOVE YOU', confidence: 0.96, desc: 'Sign: I Love You' };
    }

    // 3. PEACE / VICTORY: Index and Middle extended in V shape, others curled
    if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
      const vSpread = dist(indexTip, middleTip);
      if (vSpread > 0.3) {
        return { gesture: 'PEACE', confidence: 0.95, desc: 'Sign: Peace / Victory' };
      } else {
        return { gesture: 'U', confidence: 0.88, desc: 'Letter: U' };
      }
    }

    // 4. THUMBS UP / GOOD vs THUMBS DOWN / BAD
    if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      // In web viewport, y decreases upward
      if (thumbTip.y < thumbMcp.y - 0.2) {
        return { gesture: 'GOOD', confidence: 0.95, desc: 'Sign: Good / Yes' };
      } else if (thumbTip.y > thumbMcp.y + 0.2) {
        return { gesture: 'BAD', confidence: 0.92, desc: 'Sign: Bad / Dislike' };
      } else {
        return { gesture: 'A', confidence: 0.86, desc: 'Letter: A / Fist' };
      }
    }

    // 5. LETTER L: Thumb and Index extended at ~90 degrees, others curled
    if (thumbExtended && indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return { gesture: 'L', confidence: 0.94, desc: 'Letter: L' };
    }

    // 6. CALL ME / LETTER Y: Thumb and Pinky extended, middle 3 curled
    if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && pinkyExtended) {
      return { gesture: 'CALL ME', confidence: 0.95, desc: 'Sign: Call Me / Letter Y' };
    }

    // 7. LETTER I: Only Pinky extended, others curled
    if (!thumbExtended && !indexExtended && !middleExtended && !ringExtended && pinkyExtended) {
      return { gesture: 'I', confidence: 0.92, desc: 'Letter: I' };
    }

    // 8. POINT / YOU: Only Index extended
    if (!thumbExtended && indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return { gesture: 'YOU', confidence: 0.93, desc: 'Sign: You / Pointing' };
    }

    // 9. LETTER W / THREE: Index, Middle, Ring extended; Pinky curled
    if (indexExtended && middleExtended && ringExtended && !pinkyExtended) {
      return { gesture: 'W', confidence: 0.91, desc: 'Letter: W / Three' };
    }

    // 10. HELLO / OPEN PALM: All 5 fingers extended and spread
    if (thumbExtended && indexExtended && middleExtended && ringExtended && pinkyExtended) {
      return { gesture: 'HELLO', confidence: 0.96, desc: 'Sign: Hello / Open Palm' };
    }

    // 11. LETTER B: 4 fingers upright together, thumb tucked
    if (!thumbExtended && indexExtended && middleExtended && ringExtended && pinkyExtended) {
      return { gesture: 'THANK YOU', confidence: 0.92, desc: 'Sign: Thank You / Letter B' };
    }

    // 12. YES / FIST: All 5 fingers curled into fist
    if (!thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return { gesture: 'YES', confidence: 0.89, desc: 'Sign: Yes / Closed Fist' };
    }

    // 13. NO / PINCH: Thumb, Index, Middle pinch together
    if (distThumbIndex < 0.4 && distThumbMiddle < 0.4 && !ringExtended && !pinkyExtended) {
      return { gesture: 'NO', confidence: 0.90, desc: 'Sign: No / Pinch' };
    }

    // 14. LETTER C: Curved fingers
    if (!indexExtended && !pinkyExtended && distThumbIndex > 0.35 && distThumbIndex < 0.75) {
      return { gesture: 'C', confidence: 0.83, desc: 'Letter: C' };
    }

    return { gesture: 'ANALYZING', confidence: 0.50, desc: 'Analyzing hand shape...' };
  }

  // Update Prediction HUD & Hold-to-Commit Logic
  function updatePredictionHUD(prediction) {
    const isReliable = prediction.confidence >= 0.75 && prediction.gesture !== 'ANALYZING' && prediction.gesture !== 'WAITING';

    predictedSignBadge.textContent = prediction.gesture;
    predictedSignDesc.textContent = prediction.desc;

    const confPct = Math.round(prediction.confidence * 100);
    confidencePercentage.textContent = `${confPct}%`;
    confidenceBar.style.width = `${confPct}%`;

    // Hold-to-commit stabilization
    if (isReliable) {
      if (candidateGesture === prediction.gesture) {
        candidateHoldCount++;
      } else {
        candidateGesture = prediction.gesture;
        candidateHoldCount = 1;
      }

      const holdProgress = Math.min((candidateHoldCount / REQUIRED_HOLD_FRAMES) * 100, 100);
      commitFill.style.width = `${holdProgress}%`;

      // Trigger commit when held steady
      if (candidateHoldCount >= REQUIRED_HOLD_FRAMES && cooldownFrames === 0) {
        commitGestureToSentence(prediction.gesture);
        candidateHoldCount = 0;
        commitFill.style.width = '0%';
        cooldownFrames = COOLDOWN_DURATION;
      }
    } else {
      candidateHoldCount = Math.max(0, candidateHoldCount - 2);
      commitFill.style.width = `${(candidateHoldCount / REQUIRED_HOLD_FRAMES) * 100}%`;
    }
  }

  // Commit Gesture to Sentence Builder
  function commitGestureToSentence(gesture) {
    // Avoid immediate duplicate append unless user intentionally paused
    if (lastCommittedGesture === gesture && cooldownFrames > 0) return;

    lastCommittedGesture = gesture;
    accumulatedWords.push(gesture);

    renderSentence();

    // Pulse badge to confirm commit
    predictedSignBadge.style.transform = 'scale(1.15)';
    predictedSignBadge.style.color = 'var(--accent-lime)';
    setTimeout(() => {
      predictedSignBadge.style.transform = 'scale(1)';
      predictedSignBadge.style.color = 'var(--accent-cyan)';
    }, 250);

    // Auto-TTS if enabled
    if (toggleAutoSpeak && toggleAutoSpeak.checked) {
      speakAloud(gesture);
    }
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

  // Text-To-Speech Synthesis
  function speakAloud(text) {
    if (!text || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel(); // Stop any pending speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Try selecting an English voice
      const voices = window.speechSynthesis.getVoices();
      const engVoice = voices.find(v => v.lang.startsWith('en'));
      if (engVoice) utterance.voice = engVoice;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("SpeechSynthesis error:", e);
    }
  }

  // Sentence Toolbar Action Listeners
  btnSpeakSentence.addEventListener('click', () => {
    const text = accumulatedWords.join(' ');
    if (text) {
      speakAloud(text);
    } else {
      speakAloud("No words recorded yet.");
    }
  });

  btnCopySentence.addEventListener('click', async () => {
    const text = accumulatedWords.join(' ');
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      const originalText = btnCopySentence.innerHTML;
      btnCopySentence.innerHTML = '<span>✓</span> COPIED!';
      btnCopySentence.style.background = 'var(--accent-lime)';
      btnCopySentence.style.color = '#000';
      setTimeout(() => {
        btnCopySentence.innerHTML = originalText;
        btnCopySentence.style.background = '';
        btnCopySentence.style.color = '';
      }, 1500);
    } catch (e) {
      console.warn("Clipboard copy failed:", e);
    }
  });

  btnBackspaceSentence.addEventListener('click', () => {
    if (accumulatedWords.length > 0) {
      accumulatedWords.pop();
      renderSentence();
    }
  });

  btnClearSentence.addEventListener('click', () => {
    accumulatedWords = [];
    lastCommittedGesture = null;
    renderSentence();
  });
}
