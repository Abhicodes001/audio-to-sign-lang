const assert = require('assert');
const {
  createGestureCommitGate,
  createOrderedResponseBuffer,
  createSpeechAccumulator,
} = require('../static/session_core');

function speechResult(transcript, isFinal) {
  return {
    0: { transcript },
    isFinal,
  };
}

function testTranscriptAccumulationSeparatesInterim() {
  const accumulator = createSpeechAccumulator();

  let update = accumulator.applyResult({
    resultIndex: 0,
    results: [speechResult('hello', true)],
  });
  assert.deepStrictEqual(update.finalSegments, ['hello']);
  assert.strictEqual(update.finalText, 'hello');
  assert.strictEqual(update.interimText, '');

  update = accumulator.applyResult({
    resultIndex: 1,
    results: [speechResult('hello', true), speechResult('wor', false)],
  });
  assert.deepStrictEqual(update.finalSegments, []);
  assert.strictEqual(update.finalText, 'hello');
  assert.strictEqual(update.interimText, 'wor');

  update = accumulator.applyResult({
    resultIndex: 1,
    results: [speechResult('hello', true), speechResult('world', true)],
  });
  assert.deepStrictEqual(update.finalSegments, ['world']);
  assert.strictEqual(update.finalText, 'hello world');
  assert.strictEqual(update.interimText, '');
}

function testDuplicateFinalSpeechResultIsIgnored() {
  const accumulator = createSpeechAccumulator();

  accumulator.applyResult({
    resultIndex: 0,
    results: [speechResult('hello', true)],
  });
  const duplicate = accumulator.applyResult({
    resultIndex: 0,
    results: [speechResult('hello', true)],
  });

  assert.deepStrictEqual(duplicate.finalSegments, []);
  assert.strictEqual(duplicate.finalText, 'hello');
}

function testOrderedResponseBufferPreventsStaleOrdering() {
  const buffer = createOrderedResponseBuffer();

  assert.deepStrictEqual(buffer.accept({ order: 2, items: ['second'] }), []);
  assert.deepStrictEqual(buffer.accept({ order: 1, items: ['first'] }), ['first', 'second']);
  assert.deepStrictEqual(buffer.accept({ order: 1, items: ['stale-first'] }), []);
  assert.deepStrictEqual(buffer.accept({ order: 3, items: ['third'] }), ['third']);
}

function testGestureCommitRequiresReleaseBeforeDuplicate() {
  const gate = createGestureCommitGate(3);

  assert.deepStrictEqual(gate.update('HELLO').committed, null);
  assert.deepStrictEqual(gate.update('HELLO').committed, null);
  assert.strictEqual(gate.update('HELLO').committed, 'HELLO');
  assert.deepStrictEqual(gate.update('HELLO').committed, null);
  assert.deepStrictEqual(gate.update('HELLO').needsRelease, true);

  gate.update(null);
  gate.update('HELLO');
  gate.update('HELLO');
  assert.strictEqual(gate.update('HELLO').committed, 'HELLO');
}

testTranscriptAccumulationSeparatesInterim();
testDuplicateFinalSpeechResultIsIgnored();
testOrderedResponseBufferPreventsStaleOrdering();
testGestureCommitRequiresReleaseBeforeDuplicate();

console.log('session_core regression checks passed');
