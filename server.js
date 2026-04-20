import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { Blob } from 'node:buffer';
import {
  buildClonePayload,
  buildVoiceCloneRequest,
  MAX_AUDIO_BYTES
} from './src/voice-clone.js';
import { buildSpeechPayload, buildVoiceListPayload } from './src/speech.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.MINIMAX_API_KEY;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AUDIO_BYTES
  }
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasApiKey: Boolean(apiKey), mode: 'proxy' });
});

app.post('/api/voices', async (req, res) => {
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: '服务端缺少 MINIMAX_API_KEY，请先配置环境变量。' });
  }

  try {
    const requestBody = buildVoiceListPayload(req.body || {});
    const voiceResponse = await fetchJson('https://api.minimaxi.com/v1/get_voice', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(60_000)
    });

    const statusCode = voiceResponse.base_resp?.status_code;
    return res.status(statusCode === 0 ? 200 : 502).json({
      ok: statusCode === 0,
      request: requestBody,
      result: voiceResponse
    });
  } catch (error) {
    return handleError(res, error, '音色查询请求失败。');
  }
});

app.post(
  '/api/voice-clone',
  upload.fields([
    { name: 'cloneAudio', maxCount: 1 },
    { name: 'promptAudio', maxCount: 1 }
  ]),
  async (req, res) => {
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: '服务端缺少 MINIMAX_API_KEY，请先配置环境变量。' });
    }

    try {
      const normalized = buildClonePayload(req.body, req.files || {});
      const cloneUpload = await uploadFileToMiniMax(normalized.cloneAudio, 'voice_clone', apiKey);
      const promptUpload = normalized.promptAudio
        ? await uploadFileToMiniMax(normalized.promptAudio, 'prompt_audio', apiKey)
        : null;

      const requestBody = buildVoiceCloneRequest({
        cloneFileId: cloneUpload.file.file_id,
        promptFileId: promptUpload?.file?.file_id,
        voiceId: normalized.voiceId,
        promptText: normalized.promptText,
        text: normalized.text,
        model: normalized.model,
        languageBoost: normalized.languageBoost,
        needNoiseReduction: normalized.needNoiseReduction,
        needVolumeNormalization: normalized.needVolumeNormalization,
        aigcWatermark: normalized.aigcWatermark
      });

      const cloneResponse = await fetchJson('https://api.minimaxi.com/v1/voice_clone', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(60_000)
      });

      const statusCode = cloneResponse.base_resp?.status_code;
      return res.status(statusCode === 0 ? 200 : 502).json({
        ok: statusCode === 0,
        request: requestBody,
        upload: {
          cloneFile: cloneUpload.file,
          promptFile: promptUpload?.file || null
        },
        result: cloneResponse
      });
    } catch (error) {
      return handleError(res, error, '音色复刻请求失败。');
    }
  }
);

app.post('/api/text-to-speech', async (req, res) => {
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: '服务端缺少 MINIMAX_API_KEY，请先配置环境变量。' });
  }

  try {
    const requestBody = buildSpeechPayload(req.body || {}, { stream: false });
    const speechResponse = await fetchJson('https://api.minimaxi.com/v1/t2a_v2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(60_000)
    });

    const statusCode = speechResponse.base_resp?.status_code;
    return res.status(statusCode === 0 ? 200 : 502).json({
      ok: statusCode === 0,
      request: requestBody,
      result: speechResponse,
      audioUrl: speechResponse.data?.audio || null,
      subtitleUrl: speechResponse.data?.subtitle_file || null
    });
  } catch (error) {
    return handleError(res, error, '正式语音合成请求失败。');
  }
});

app.post('/api/text-to-speech/stream', async (req, res) => {
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: '服务端缺少 MINIMAX_API_KEY，请先配置环境变量。' });
  }

  try {
    const requestBody = buildSpeechPayload(req.body || {}, { stream: true });
    const upstream = await fetch('https://api.minimaxi.com/v1/t2a_v2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(120_000)
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      let details;
      try {
        details = JSON.parse(text);
      } catch {
        details = { raw: text };
      }
      const message = details?.base_resp?.status_msg || details?.message || `MiniMax 返回 HTTP ${upstream.status}`;
      const error = new Error(message);
      error.statusCode = upstream.status;
      error.details = details;
      throw error;
    }

    res.status(200);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const reader = upstream.body?.getReader();
    if (!reader) {
      throw new Error('上游流式响应为空。');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      res.write(Buffer.from(value));
    }

    res.end();
  } catch (error) {
    if (!res.headersSent) {
      return handleError(res, error, '流式语音合成请求失败。');
    }
    res.end();
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ ok: false, error: '上传文件不符合要求，请确认文件大小不超过 20MB。' });
  }

  return res.status(500).json({ ok: false, error: error.message || '未知错误' });
});

app.listen(port, () => {
  console.log(`MiniMax voice clone MVP running at http://localhost:${port}`);
});

function handleError(res, error, fallbackMessage) {
  const status = error.statusCode || 500;
  return res.status(status).json({
    ok: false,
    error: error.message || fallbackMessage,
    details: error.details || null
  });
}

async function uploadFileToMiniMax(file, purpose, apiKey) {
  const formData = new FormData();
  formData.set('purpose', purpose);
  formData.set('file', new Blob([file.buffer]), file.originalname);

  const response = await fetchJson('https://api.minimaxi.com/v1/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData,
    signal: AbortSignal.timeout(60_000)
  });

  if (response.base_resp?.status_code !== 0) {
    const error = new Error(response.base_resp?.status_msg || '文件上传失败。');
    error.statusCode = 502;
    error.details = response;
    throw error;
  }

  return response;
}

async function fetchJson(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    const wrapped = new Error(`请求 MiniMax 失败：${error.message}`);
    wrapped.statusCode = 502;
    throw wrapped;
  }

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data?.base_resp?.status_msg || data?.message || `MiniMax 返回 HTTP ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  return data;
}
