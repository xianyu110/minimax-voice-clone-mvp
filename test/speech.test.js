import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpeechPayload, buildVoiceListPayload } from '../src/speech.js';

test('buildSpeechPayload creates request body for url-based synthesis', () => {
  const payload = buildSpeechPayload(
    {
      voiceId: 'MiniDemo_2026',
      text: '你好，这是一段正式语音。',
      model: 'speech-2.8-hd',
      speed: '1.2',
      vol: '0.8',
      pitch: '2',
      audioFormat: 'mp3',
      sampleRate: '32000',
      bitrate: '128000',
      channel: '1',
      subtitleEnable: true,
      textNormalization: true
    },
    { stream: false }
  );

  assert.deepEqual(payload, {
    model: 'speech-2.8-hd',
    text: '你好，这是一段正式语音。',
    stream: false,
    voice_setting: {
      voice_id: 'MiniDemo_2026',
      speed: 1.2,
      vol: 0.8,
      pitch: 2,
      text_normalization: true
    },
    audio_setting: {
      sample_rate: 32000,
      format: 'mp3',
      channel: 1,
      bitrate: 128000
    },
    subtitle_enable: true,
    output_format: 'url',
    aigc_watermark: false
  });
});

test('buildSpeechPayload rejects missing voice id', () => {
  assert.throws(
    () => buildSpeechPayload({ text: 'hello', model: 'speech-2.8-hd' }, { stream: false }),
    /必须填写 voice_id/
  );
});

test('buildSpeechPayload rejects non-integer pitch', () => {
  assert.throws(
    () => buildSpeechPayload({ voiceId: 'MiniDemo_2026', text: 'hello', model: 'speech-2.8-hd', pitch: '1.5' }, { stream: false }),
    /pitch 必须是整数/
  );
});

test('buildSpeechPayload rejects invalid sample rate', () => {
  assert.throws(
    () => buildSpeechPayload({ voiceId: 'MiniDemo_2026', text: 'hello', model: 'speech-2.8-hd', sampleRate: '12345' }, { stream: false }),
    /sample_rate/
  );
});

test('buildSpeechPayload rejects wav in streaming mode', () => {
  assert.throws(
    () => buildSpeechPayload({ voiceId: 'MiniDemo_2026', text: 'hello', model: 'speech-2.8-hd', audioFormat: 'wav' }, { stream: true }),
    /流式模式不支持 wav/
  );
});

test('buildVoiceListPayload supports all voices', () => {
  assert.deepEqual(buildVoiceListPayload({ voiceType: 'all' }), { voice_type: 'all' });
});

test('buildVoiceListPayload rejects invalid type', () => {
  assert.throws(() => buildVoiceListPayload({ voiceType: 'bad' }), /voice_type/);
});
