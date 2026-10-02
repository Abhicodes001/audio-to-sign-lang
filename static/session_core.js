(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SignWaveCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function createSpeechAccumulator() {
    return {
      finalText: '',
      interimText: '',
      seenFinalKeys: new Set(),
      applyResult(event) {
        const finalSegments = [];
        const interimSegments = [];
        const startIndex = Number.isInteger(event.resultIndex) ? event.resultIndex : 0;

        for (let i = startIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const segment = normalizeText(result && result[0] && result[0].transcript);
          if (!segment) continue;

          if (result.isFinal) {
            const key = `${i}:${segment.toLowerCase()}`;
            if (!this.seenFinalKeys.has(key)) {
              this.seenFinalKeys.add(key);
              finalSegments.push(segment);
            }
          } else {
            interimSegments.push(segment);
          }
        }

        if (finalSegments.length > 0) {
          this.finalText = normalizeText([this.finalText, ...finalSegments].filter(Boolean).join(' '));
        }

        this.interimText = normalizeText(interimSegments.join(' '));
        return {
          finalText: this.finalText,
          interimText: this.interimText,
          finalSegments,
          displayText: normalizeText([this.finalText, this.interimText].filter(Boolean).join(' ')),
        };
      },
      reset() {
        this.finalText = '';
        this.interimText = '';
        this.seenFinalKeys.clear();
      },
    };
  }

  function createOrderedResponseBuffer() {
    return {
      nextOrder: 1,
      pending: new Map(),
      reset() {
        this.nextOrder = 1;
        this.pending.clear();
      },
      accept(response) {
        if (!response || !Number.isInteger(response.order) || response.order < this.nextOrder) {
          return [];
        }

        this.pending.set(response.order, response.items || []);
        const ready = [];
        while (this.pending.has(this.nextOrder)) {
          const items = this.pending.get(this.nextOrder);
          this.pending.delete(this.nextOrder);
          ready.push(...items);
          this.nextOrder += 1;
        }
        return ready;
      },
    };
  }

  function createGestureCommitGate(requiredHoldFrames) {
    return {
      requiredHoldFrames,
      candidate: null,
      holdFrames: 0,
      lockedGesture: null,
      update(gesture) {
        if (!gesture) {
          this.candidate = null;
          this.holdFrames = 0;
          this.lockedGesture = null;
          return { committed: null, progress: 0, needsRelease: false };
        }

        if (gesture === this.lockedGesture) {
          return { committed: null, progress: 100, needsRelease: true };
        }

        if (gesture === this.candidate) {
          this.holdFrames += 1;
        } else {
          this.candidate = gesture;
          this.holdFrames = 1;
        }

        const progress = Math.min((this.holdFrames / this.requiredHoldFrames) * 100, 100);
        if (this.holdFrames >= this.requiredHoldFrames) {
          this.lockedGesture = gesture;
          this.candidate = null;
          this.holdFrames = 0;
          return { committed: gesture, progress: 100, needsRelease: true };
        }

        return { committed: null, progress, needsRelease: false };
      },
      reset() {
        this.candidate = null;
        this.holdFrames = 0;
        this.lockedGesture = null;
      },
    };
  }

  return {
    createGestureCommitGate,
    createOrderedResponseBuffer,
    createSpeechAccumulator,
    normalizeText,
  };
});
