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
});
