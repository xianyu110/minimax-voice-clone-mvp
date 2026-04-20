export const MODEL_OPTIONS = [
  'speech-2.8-hd',
  'speech-2.8-turbo',
  'speech-2.6-hd',
  'speech-2.6-turbo',
  'speech-02-hd',
  'speech-02-turbo',
  'speech-01-hd',
  'speech-01-turbo'
];

export const LANGUAGE_BOOST_OPTIONS = [
  'Chinese',
  'Chinese,Yue',
  'English',
  'Arabic',
  'Russian',
  'Spanish',
  'French',
  'Portuguese',
  'German',
  'Turkish',
  'Dutch',
  'Ukrainian',
  'Vietnamese',
  'Indonesian',
  'Japanese',
  'Italian',
  'Korean',
  'Thai',
  'Polish',
  'Romanian',
  'Greek',
  'Czech',
  'Finnish',
  'Hindi',
  'Bulgarian',
  'Danish',
  'Hebrew',
  'Malay',
  'Persian',
  'Slovak',
  'Swedish',
  'Croatian',
  'Filipino',
  'Hungarian',
  'Norwegian',
  'Slovenian',
  'Catalan',
  'Nynorsk',
  'Tamil',
  'Afrikaans',
  'auto'
];

export const EMOTION_OPTIONS = [
  'happy',
  'sad',
  'angry',
  'fearful',
  'disgusted',
  'surprised',
  'calm',
  'fluent',
  'whisper'
];

export const AUDIO_FORMAT_OPTIONS = ['mp3', 'pcm', 'flac', 'wav'];
export const SAMPLE_RATE_OPTIONS = [8000, 16000, 22050, 24000, 32000, 44100];
export const BITRATE_OPTIONS = [32000, 64000, 128000, 256000];
export const CHANNEL_OPTIONS = [1, 2];

export function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 'on' || value === '1';
}

function parseOptionalNumber(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('数值参数格式不正确。');
  }

  return parsed;
}

function assertRange(value, min, max, label, inclusiveMin = true) {
  if ((inclusiveMin ? value < min : value <= min) || value > max) {
    const left = inclusiveMin ? '[' : '(';
    throw new Error(`${label} 超出范围，需在 ${left}${min}, ${max}] 内。`);
  }
}

export function buildSpeechPayload(fields) {
  const voiceId = String(fields.voiceId || '').trim();
  const text = String(fields.text || '').trim();
  const model = String(fields.model || '').trim();
  const emotion = String(fields.emotion || '').trim();
  const languageBoost = String(fields.languageBoost || '').trim();
  const audioFormat = String(fields.audioFormat || 'mp3').trim() || 'mp3';
  const sampleRate = parseOptionalNumber(fields.sampleRate, 32000);
  const bitrate = parseOptionalNumber(fields.bitrate, 128000);
  const channel = parseOptionalNumber(fields.channel, 1);
  const speed = parseOptionalNumber(fields.speed, 1);
  const vol = parseOptionalNumber(fields.vol, 1);
  const pitch = parseOptionalNumber(fields.pitch, 0);

  if (!voiceId) {
    throw new Error('正式合成必须填写 voice_id。');
  }

  if (!text) {
    throw new Error('正式合成必须填写文本。');
  }

  if (text.length >= 10000) {
    throw new Error('正式合成文本长度需小于 10000 字符。');
  }

  if (!MODEL_OPTIONS.includes(model)) {
    throw new Error('正式合成模型不在 MiniMax 文档允许的范围内。');
  }

  if (emotion && !EMOTION_OPTIONS.includes(emotion)) {
    throw new Error('emotion 不在 MiniMax 文档允许的范围内。');
  }

  if (languageBoost && !LANGUAGE_BOOST_OPTIONS.includes(languageBoost)) {
    throw new Error('language_boost 不在 MiniMax 文档允许的范围内。');
  }

  if (!AUDIO_FORMAT_OPTIONS.includes(audioFormat)) {
    throw new Error('audio format 不在 MiniMax 文档允许的范围内。');
  }

  if (!SAMPLE_RATE_OPTIONS.includes(sampleRate)) {
    throw new Error('sample_rate 不在 MiniMax 文档允许的范围内。');
  }

  if (audioFormat === 'mp3' && !BITRATE_OPTIONS.includes(bitrate)) {
    throw new Error('mp3 bitrate 不在 MiniMax 文档允许的范围内。');
  }

  if (!CHANNEL_OPTIONS.includes(channel)) {
    throw new Error('channel 只支持 1 或 2。');
  }

  assertRange(speed, 0.5, 2, 'speed');
  assertRange(vol, 0, 10, 'vol', false);
  assertRange(pitch, -12, 12, 'pitch');

  if (!Number.isInteger(pitch)) {
    throw new Error('pitch 必须是整数。');
  }

  const payload = {
    model,
    text,
    stream: false,
    voice_setting: {
      voice_id: voiceId,
      speed,
      vol,
      pitch,
      text_normalization: normalizeBoolean(fields.textNormalization)
    },
    audio_setting: {
      sample_rate: sampleRate,
      format: audioFormat,
      channel
    },
    subtitle_enable: normalizeBoolean(fields.subtitleEnable),
    output_format: 'url',
    aigc_watermark: normalizeBoolean(fields.aigcWatermark)
  };

  if (audioFormat === 'mp3') {
    payload.audio_setting.bitrate = bitrate;
  }

  if (emotion) {
    payload.voice_setting.emotion = emotion;
  }

  if (languageBoost) {
    payload.language_boost = languageBoost;
  }

  return payload;
}
