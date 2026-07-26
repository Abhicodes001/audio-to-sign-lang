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
let recorder = null;
let stream = null;
let speechRecognizer = null;

let currentText = '';
let videoQueue = [];
let isPlayingVideo = false;

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

  // Update dots
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

// Demo Button Listener
const btnTryDemo = document.getElementById('btnTryDemo');
if (btnTryDemo) {
  btnTryDemo.addEventListener('click', () => {
    updateTranscriptionUI('hello welcome');
    videoQueue = [
      { word: 'hello', type: 'word', url: '/datasets/hello.mp4' },
      { word: 'welcome', type: 'word', url: '/datasets/welcome.mp4' }
    ];
    if (!isPlayingVideo) {
      playNextSignVideo();
    }
  });
}

// Modal Event Listeners
btnHowItWorks.addEventListener('click', () => {
  updateModalStep(0);
  modalOverlay.classList.add('active');
});

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
      alert("Please allow microphone access to use SignWave.");
      return false;
    }
  }

  // Setup Web Speech API if supported in browser
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

  // Reset video player
  videoQueue = [];
  isPlayingVideo = false;
  signVideo.pause();
  signVideo.removeAttribute('src');
  videoContainer.style.display = 'none';
  stagePlaceholder.style.display = 'flex';
  currentWordBadge.textContent = '-';
  fingerspellingTiles.innerHTML = '';
}

function stopRecording() {
  isRecording = false;

  recordBtn.classList.remove('recording');
  controlCard.classList.remove('recording');
  micLabel.textContent = 'PROCESSING';
  micSublabel.textContent = 'Translating audio into signs...';
  statStatus.textContent = 'PROCESSING';

  if (speechRecognizer) {
    try { speechRecognizer.stop(); } catch (e) {}
  }

  recorder.stopRecording(async () => {
    const audioBlob = recorder.getBlob();
    await sendAudioToBackend(audioBlob);
  });
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

  // Render Live Fingerspelling Tiles for the latest word
  const wordList = text.trim().split(/\s+/);
  if (wordList.length > 0) {
    const lastWord = wordList[wordList.length - 1].toUpperCase();
    renderFingerspellingTiles(lastWord);
  }
}

function renderFingerspellingTiles(word) {
  fingerspellingTiles.innerHTML = '';
  const cleanWord = word.replace(/[^A-Z0-9]/g, '');
  for (let char of cleanWord) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.textContent = char;
    fingerspellingTiles.appendChild(tile);
  }
  if (cleanWord) {
    currentWordBadge.textContent = `Word: ${cleanWord}`;
  }
}

// Send Captured Audio to Backend API (/api/process-audio)
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

    if (response.ok) {
      if (data.original_text) {
        updateTranscriptionUI(data.original_text);
      }

      if (data.video_sequence && data.video_sequence.length > 0) {
        videoQueue = data.video_sequence;
        if (!isPlayingVideo) {
          playNextSignVideo();
        }
      } else {
        stageTitle.textContent = 'NO MATCHING SIGN VIDEOS FOUND';
        currentWordBadge.textContent = 'Finished';
      }
    } else {
      if (!currentText) {
        transcriptionText.textContent = data.error || 'Could not recognize speech.';
        transcriptionText.classList.add('placeholder');
      }
    }
  } catch (err) {
    console.error("API error:", err);
    micLabel.textContent = 'START RECORDING';
    micSublabel.textContent = 'Error connecting to server';
    statStatus.textContent = 'IDLE';
  }
}

// Play videos sequentially on Sign Stage
function playNextSignVideo() {
  if (videoQueue.length === 0) {
    isPlayingVideo = false;
    stageTitle.textContent = 'SIGN STAGE STANDING BY';
    setTimeout(() => {
      videoContainer.style.display = 'none';
      stagePlaceholder.style.display = 'flex';
      currentWordBadge.textContent = 'Completed';
    }, 1500);
    return;
  }

  isPlayingVideo = true;
  const item = videoQueue.shift();

  stagePlaceholder.style.display = 'none';
  videoContainer.style.display = 'block';

  if (item.type === 'letter') {
    currentWordBadge.textContent = `Letter: ${item.word}`;
    renderFingerspellingTiles(item.word);
  } else {
    currentWordBadge.textContent = `Signing: ${item.word}`;
    renderFingerspellingTiles(item.word);
  }

  signVideo.src = item.url;
  signVideo.load();

  signVideo.oncanplay = () => {
    signVideo.playbackRate = 0.7;
    signVideo.play().catch(e => console.log("Video play error:", e));
  };

  signVideo.onended = () => {
    setTimeout(playNextSignVideo, 300);
  };

  signVideo.onerror = () => {
    console.error("Failed to load video:", item.url);
    playNextSignVideo();
  };
}
