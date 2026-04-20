import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVoiceCloneRequest,
  buildVoiceId,
  buildClonePayload
} from '../src/voice-clone.js';

function fakeFile(name, size = 1024) {
  return {
    originalname: name,
    size,
    buffer: Buffer.from('test')
  };
}

test('buildVoiceId auto generates a valid id when empty', () => {
  const voiceId = buildVoiceId('');
  assert.match(voiceId, /^MiniMvp_\d+$/);
});

test('buildVoiceId rejects invalid suffix characters', () => {
  assert.throws(() => buildVoiceId('MiniMax__'), /不能以 - 或 _ 结尾/);
});

test('buildClonePayload requires model when preview text is present', () => {
  assert.throws(
    () =>
      buildClonePayload(
        { text: 'hello world' },
        { cloneAudio: [fakeFile('sample.wav')] }
      ),
    /必须选择试听模型/
  );
});

test('buildVoiceCloneRequest omits optional fields when absent', () => {
  const payload = buildVoiceCloneRequest({
    cloneFileId: 123,
    voiceId: 'MiniMvp_12345678',
    needNoiseReduction: false,
    needVolumeNormalization: false,
    aigcWatermark: false
  });

  assert.deepEqual(payload, {
    file_id: 123,
    voice_id: 'MiniMvp_12345678',
    need_noise_reduction: false,
    need_volume_normalization: false,
    aigc_watermark: false
  });
});

test('buildClonePayload accepts prompt audio only when prompt text is also provided', () => {
  const payload = buildClonePayload(
    {
      promptText: '你好。',
      model: 'speech-2.8-hd',
      text: '试听文本',
      voiceId: 'MiniDemo_2026'
    },
    {
      cloneAudio: [fakeFile('clone.mp3')],
      promptAudio: [fakeFile('prompt.m4a')]
    }
  );

  assert.equal(payload.voiceId, 'MiniDemo_2026');
  assert.equal(payload.model, 'speech-2.8-hd');
  assert.equal(payload.promptText, '你好。');
});
