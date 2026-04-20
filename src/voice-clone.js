import path from 'node:path';
import { LANGUAGE_BOOST_OPTIONS, MODEL_OPTIONS, normalizeBoolean } from './speech.js';

export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const ALLOWED_AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav']);

export function buildVoiceId(rawVoiceId = '') {
  const voiceId = String(rawVoiceId).trim();
  if (!voiceId) {
    return `MiniMvp_${Date.now()}`;
  }

  if (voiceId.length < 8 || voiceId.length > 256) {
    throw new Error('voice_id 长度需在 8 到 256 之间。');
  }

  if (!/^[A-Za-z][A-Za-z0-9_-]*[A-Za-z0-9]$/.test(voiceId)) {
    throw new Error('voice_id 必须以字母开头，只允许字母、数字、-、_，且不能以 - 或 _ 结尾。');
  }

  return voiceId;
}

export function validateAudioFile(file, label) {
  if (!file) {
    throw new Error(`请上传${label}。`);
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
    throw new Error(`${label}仅支持 mp3、m4a、wav 格式。`);
  }

  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error(`${label}不能超过 20MB。`);
  }
}

export function buildClonePayload(fields, files) {
  const cloneAudio = files.cloneAudio?.[0];
  const promptAudio = files.promptAudio?.[0];
  validateAudioFile(cloneAudio, '复刻音频');

  const voiceId = buildVoiceId(fields.voiceId);
  const text = String(fields.text || '').trim();
  const promptText = String(fields.promptText || '').trim();
  const model = String(fields.model || '').trim();
  const languageBoost = String(fields.languageBoost || '').trim();

  if (text.length > 1000) {
    throw new Error('试听文本不能超过 1000 个字符。');
  }

  if (promptAudio && !promptText) {
    throw new Error('上传示例音频后，必须同时填写对应文本。');
  }

  if (!promptAudio && promptText) {
    throw new Error('填写示例文本后，必须同时上传示例音频。');
  }

  if (promptAudio) {
    validateAudioFile(promptAudio, '示例音频');
  }

  if (text && !model) {
    throw new Error('填写试听文本后，必须选择试听模型。');
  }

  if (model && !MODEL_OPTIONS.includes(model)) {
    throw new Error('试听模型不在 MiniMax 文档允许的范围内。');
  }

  if (languageBoost && !LANGUAGE_BOOST_OPTIONS.includes(languageBoost)) {
    throw new Error('language_boost 不在 MiniMax 文档允许的范围内。');
  }

  return {
    voiceId,
    text,
    promptText,
    model: model || undefined,
    languageBoost: languageBoost || undefined,
    needNoiseReduction: normalizeBoolean(fields.needNoiseReduction),
    needVolumeNormalization: normalizeBoolean(fields.needVolumeNormalization),
    aigcWatermark: normalizeBoolean(fields.aigcWatermark),
    cloneAudio,
    promptAudio
  };
}

export function buildVoiceCloneRequest({
  cloneFileId,
  promptFileId,
  voiceId,
  promptText,
  text,
  model,
  languageBoost,
  needNoiseReduction,
  needVolumeNormalization,
  aigcWatermark
}) {
  const payload = {
    file_id: cloneFileId,
    voice_id: voiceId,
    need_noise_reduction: needNoiseReduction,
    need_volume_normalization: needVolumeNormalization,
    aigc_watermark: aigcWatermark
  };

  if (promptFileId && promptText) {
    payload.clone_prompt = {
      prompt_audio: promptFileId,
      prompt_text: promptText
    };
  }

  if (text) {
    payload.text = text;
    payload.model = model;
  }

  if (languageBoost) {
    payload.language_boost = languageBoost;
  }

  return payload;
}
