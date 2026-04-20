const HISTORY_KEY = 'minimax_voice_history_v1';
const API_KEY_STORAGE_KEY = 'minimax_voice_api_key';
const MODEL_OPTIONS = new Set([
  'speech-2.8-hd',
  'speech-2.8-turbo',
  'speech-2.6-hd',
  'speech-2.6-turbo',
  'speech-02-hd',
  'speech-02-turbo',
  'speech-01-hd',
  'speech-01-turbo'
]);
const LANGUAGE_BOOST_OPTIONS = new Set([
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
]);
const VOICE_TYPE_OPTIONS = new Set(['system', 'voice_cloning', 'voice_generation', 'all']);
const EMOTION_OPTIONS = new Set(['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm', 'fluent', 'whisper']);
const AUDIO_FORMAT_OPTIONS = new Set(['mp3', 'pcm', 'flac', 'wav']);
const SAMPLE_RATE_OPTIONS = new Set([8000, 16000, 22050, 24000, 32000, 44100]);
const BITRATE_OPTIONS = new Set([32000, 64000, 128000, 256000]);
const durationRules = {
  cloneAudio: { min: 10, max: 300, label: '复刻音频' },
  promptAudio: { min: 0, max: 8, label: '示例音频' }
};

const state = {
  mode: 'detecting',
  latestVoiceId: '',
  voices: [],
  apiKey: localStorage.getItem(API_KEY_STORAGE_KEY) || '',
  history: loadHistory(),
  currentObjectUrl: null
};

const cloneForm = document.getElementById('clone-form');
const ttsForm = document.getElementById('tts-form');
const cloneStatusEl = document.getElementById('form-status');
const ttsStatusEl = document.getElementById('tts-status');
const modeBadge = document.getElementById('mode-badge');
const modeText = document.getElementById('mode-text');
const modeHelp = document.getElementById('mode-help');
const apiKeyPanel = document.getElementById('api-key-panel');
const apiKeyInput = document.getElementById('api-key-input');
const apiKeyStatus = document.getElementById('api-key-status');
const saveApiKeyButton = document.getElementById('save-api-key');
const clearApiKeyButton = document.getElementById('clear-api-key');
const clonedVoiceInput = document.getElementById('tts-voice-id');
const useClonedVoiceButton = document.getElementById('use-cloned-voice');
const fetchVoicesButton = document.getElementById('fetch-voices');
const clearVoicesButton = document.getElementById('clear-voices');
const voiceTypeSelect = document.getElementById('voice-type-select');
const voiceSearchInput = document.getElementById('voice-search-input');
const voiceStatus = document.getElementById('voice-status');
const voiceListEmpty = document.getElementById('voice-list-empty');
const voiceList = document.getElementById('voice-list');
const clearHistoryButton = document.getElementById('clear-history');
const streamModeCheckbox = document.getElementById('stream-mode');
const audioFormatSelect = document.getElementById('audio-format-select');
const cloneHistoryEl = document.getElementById('clone-history');
const ttsHistoryEl = document.getElementById('tts-history');

const cloneResult = {
  empty: document.getElementById('result-empty'),
  content: document.getElementById('result-content'),
  badge: document.getElementById('result-badge'),
  voiceId: document.getElementById('result-voice-id'),
  cloneFileId: document.getElementById('clone-file-id'),
  promptFileId: document.getElementById('prompt-file-id'),
  statusCode: document.getElementById('status-code'),
  statusMsg: document.getElementById('status-msg'),
  sensitive: document.getElementById('sensitive-box'),
  audioBox: document.getElementById('audio-box'),
  audio: document.getElementById('demo-audio'),
  audioLink: document.getElementById('demo-audio-link'),
  raw: document.getElementById('raw-json')
};

const ttsResult = {
  empty: document.getElementById('tts-empty'),
  content: document.getElementById('tts-content'),
  badge: document.getElementById('tts-badge'),
  traceId: document.getElementById('tts-trace-id'),
  usage: document.getElementById('tts-usage'),
  length: document.getElementById('tts-length'),
  format: document.getElementById('tts-format'),
  msg: document.getElementById('tts-msg'),
  streamBox: document.getElementById('tts-stream-box'),
  audioBox: document.getElementById('tts-audio-box'),
  audio: document.getElementById('tts-audio'),
  audioLink: document.getElementById('tts-audio-link'),
  subtitleLink: document.getElementById('tts-subtitle-link'),
  raw: document.getElementById('tts-raw-json')
};

apiKeyInput.value = state.apiKey;
renderHistory();
void bootstrap();

for (const input of cloneForm.querySelectorAll('input[type="file"]')) {
  input.addEventListener('change', handleAudioMeta);
}

cloneForm.addEventListener('submit', handleCloneSubmit);
ttsForm.addEventListener('submit', handleTtsSubmit);
useClonedVoiceButton.addEventListener('click', useLatestVoiceId);
fetchVoicesButton.addEventListener('click', fetchVoices);
clearVoicesButton.addEventListener('click', clearVoices);
voiceSearchInput.addEventListener('input', renderVoiceList);
clearHistoryButton.addEventListener('click', clearHistory);
saveApiKeyButton.addEventListener('click', saveApiKey);
clearApiKeyButton.addEventListener('click', clearApiKey);
streamModeCheckbox.addEventListener('change', handleStreamToggle);

async function bootstrap() {
  await detectMode();
  handleStreamToggle();
}

async function detectMode() {
  const preferredMode = window.APP_ENV?.preferredMode;
  if (preferredMode === 'direct') {
    setDirectMode();
    return;
  }

  if (preferredMode === 'proxy') {
    try {
      const response = await fetch('api/health', { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error('health unavailable');
      }
      const data = await response.json();
      if (data.ok) {
        setProxyMode(data.hasApiKey);
        return;
      }
    } catch {
      setDirectMode();
      return;
    }
  }

  try {
    const response = await fetch('api/health', { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error('health unavailable');
    }
    const data = await response.json();
    if (data.ok) {
      setProxyMode(data.hasApiKey);
      return;
    }
  } catch {
    setDirectMode();
  }
}

function setProxyMode(hasApiKey) {
  state.mode = 'proxy';
  modeBadge.textContent = 'Proxy';
  modeBadge.className = 'badge success';
  modeText.textContent = '本地代理模式';
  modeHelp.textContent = hasApiKey
    ? '服务端已接管 MiniMax 鉴权，前端不会暴露 API Key。'
    : '服务端已启动，但还没有配置 MINIMAX_API_KEY。';
  apiKeyPanel.classList.add('hidden');
}

function setDirectMode() {
  state.mode = 'direct';
  modeBadge.textContent = 'Direct';
  modeBadge.className = 'badge';
  modeText.textContent = 'GitHub Pages / 静态直连模式';
  modeHelp.textContent = '静态模式不会经过你自己的服务端，页面会直接调用 MiniMax API。';
  apiKeyPanel.classList.remove('hidden');
  apiKeyStatus.textContent = state.apiKey ? '已从浏览器本地读取 API Key。' : '请先填写自己的 MiniMax API Key。';
}

function saveApiKey() {
  state.apiKey = apiKeyInput.value.trim();
  if (!state.apiKey) {
    apiKeyStatus.textContent = '请输入有效的 API Key。';
    return;
  }
  localStorage.setItem(API_KEY_STORAGE_KEY, state.apiKey);
  apiKeyStatus.textContent = 'API Key 已保存到浏览器本地。';
}

function clearApiKey() {
  state.apiKey = '';
  apiKeyInput.value = '';
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  apiKeyStatus.textContent = '已清空本地保存的 API Key。';
}

async function handleAudioMeta(event) {
  const file = event.target.files?.[0];
  const metaEl = document.querySelector(`[data-file-meta="${event.target.name}"]`);
  if (!metaEl) {
    return;
  }

  if (!file) {
    metaEl.textContent = '';
    return;
  }

  const sizeMb = (file.size / 1024 / 1024).toFixed(2);
  metaEl.textContent = `${file.name} · ${sizeMb} MB · 正在读取时长...`;

  try {
    const duration = await readAudioDuration(file);
    const rule = durationRules[event.target.name];
    const seconds = duration.toFixed(1);
    const hints = [`${rule.label}时长 ${seconds}s`];
    if (file.size > 20 * 1024 * 1024) {
      hints.push('超过 20MB');
    }
    if (rule.min && duration < rule.min) {
      hints.push(`低于 ${rule.min}s`);
    }
    if (rule.max && duration >= rule.max && event.target.name === 'promptAudio') {
      hints.push('应小于 8s');
    }
    if (rule.max && duration > rule.max && event.target.name === 'cloneAudio') {
      hints.push(`超过 ${rule.max}s`);
    }
    metaEl.textContent = `${file.name} · ${sizeMb} MB · ${hints.join(' · ')}`;
  } catch {
    metaEl.textContent = `${file.name} · ${sizeMb} MB · 无法读取时长，请手动确认。`;
  }
}

async function handleCloneSubmit(event) {
  event.preventDefault();
  cloneStatusEl.textContent = '正在上传文件并请求 MiniMax...';
  const submitButton = cloneForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    let data;
    if (state.mode === 'proxy') {
      const formData = new FormData(cloneForm);
      data = await requestJson('api/voice-clone', { method: 'POST', body: formData });
    } else {
      ensureApiKey();
      data = await directCloneVoice(cloneForm);
    }

    renderCloneResult(data, false);
    state.latestVoiceId = data.request.voice_id;
    clonedVoiceInput.value = state.latestVoiceId;
    pushHistory('clone', {
      voiceId: state.latestVoiceId,
      status: data.result.base_resp?.status_msg || 'success',
      demoAudio: data.result.demo_audio || '',
      createdAt: new Date().toISOString()
    });
    cloneStatusEl.textContent = '复刻完成，已自动把 voice_id 填进正式合成表单。';
  } catch (error) {
    renderCloneResult({ error: error.message }, true);
    cloneStatusEl.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
}

async function handleTtsSubmit(event) {
  event.preventDefault();
  ttsStatusEl.textContent = '正在请求正式语音合成...';
  const submitButton = ttsForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const rawFields = Object.fromEntries(new FormData(ttsForm).entries());
    for (const checkbox of ttsForm.querySelectorAll('input[type="checkbox"]')) {
      rawFields[checkbox.name] = checkbox.checked;
    }

    let data;
    if (rawFields.streamMode) {
      data = state.mode === 'proxy'
        ? await proxyStreamTts(rawFields)
        : await directStreamTts(rawFields);
      ttsStatusEl.textContent = '流式音频已接收完成，已生成可播放链接。';
    } else {
      data = state.mode === 'proxy'
        ? await requestJson('api/text-to-speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rawFields)
          })
        : await directTextToSpeech(rawFields);
      ttsStatusEl.textContent = '正式语音已生成，可直接试听或打开 URL。';
    }

    renderTtsResult(data, false);
    pushHistory('tts', {
      voiceId: data.request?.voice_setting?.voice_id || rawFields.voiceId,
      text: String(rawFields.text || '').slice(0, 60),
      stream: Boolean(rawFields.streamMode),
      audioUrl: data.audioUrl || '',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    renderTtsResult({ error: error.message }, true);
    ttsStatusEl.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
}

function useLatestVoiceId() {
  if (state.latestVoiceId) {
    clonedVoiceInput.value = state.latestVoiceId;
    ttsStatusEl.textContent = '已填入刚刚复刻出来的 voice_id。';
    return;
  }
  ttsStatusEl.textContent = '当前还没有可复用的复刻 voice_id，请先完成 Step 1。';
}

async function fetchVoices() {
  voiceStatus.textContent = '正在拉取音色列表...';
  try {
    const voiceType = voiceTypeSelect.value;
    if (!VOICE_TYPE_OPTIONS.has(voiceType)) {
      throw new Error('voice_type 不合法。');
    }

    let data;
    if (state.mode === 'proxy') {
      data = await requestJson('api/voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceType })
      });
    } else {
      ensureApiKey();
      const result = await minimaxJson('https://api.minimaxi.com/v1/get_voice', {
        method: 'POST',
        headers: minimaxHeaders(),
        body: JSON.stringify({ voice_type: voiceType })
      });
      data = { ok: result.base_resp?.status_code === 0, request: { voice_type: voiceType }, result };
    }

    state.voices = normalizeVoices(data.result);
    renderVoiceList();
    voiceStatus.textContent = `已拉取 ${state.voices.length} 个音色。`;
  } catch (error) {
    state.voices = [];
    renderVoiceList();
    voiceStatus.textContent = error.message;
  }
}

function clearVoices() {
  state.voices = [];
  voiceSearchInput.value = '';
  renderVoiceList();
  voiceStatus.textContent = '已清空音色结果。';
}

function renderVoiceList() {
  const keyword = voiceSearchInput.value.trim().toLowerCase();
  const filtered = state.voices.filter((voice) => {
    if (!keyword) {
      return true;
    }
    return [voice.voice_id, voice.voice_name, voice.descriptionText, voice.category].some((value) =>
      String(value || '').toLowerCase().includes(keyword)
    );
  });

  if (filtered.length === 0) {
    voiceList.classList.add('hidden');
    voiceListEmpty.classList.remove('hidden');
    return;
  }

  voiceListEmpty.classList.add('hidden');
  voiceList.classList.remove('hidden');
  voiceList.innerHTML = filtered
    .map(
      (voice) => `
        <article class="voice-card">
          <div class="voice-card-head">
            <span class="badge">${escapeHtml(voice.category)}</span>
            <button class="ghost-btn use-voice-btn" type="button" data-voice-id="${escapeHtml(voice.voice_id)}">使用这个 voice_id</button>
          </div>
          <strong>${escapeHtml(voice.voice_name || voice.voice_id)}</strong>
          <p class="voice-id">${escapeHtml(voice.voice_id)}</p>
          <p class="voice-desc">${escapeHtml(voice.descriptionText || '暂无描述')}</p>
          <small>${escapeHtml(voice.created_time || 'system voice')}</small>
        </article>
      `
    )
    .join('');

  for (const button of voiceList.querySelectorAll('.use-voice-btn')) {
    button.addEventListener('click', () => {
      clonedVoiceInput.value = button.dataset.voiceId || '';
      ttsStatusEl.textContent = `已带入 voice_id：${button.dataset.voiceId}`;
    });
  }
}

function renderCloneResult(data, isError) {
  cloneResult.empty.classList.add('hidden');
  cloneResult.content.classList.remove('hidden');
  cloneResult.badge.textContent = isError ? '失败' : '成功';
  cloneResult.badge.className = `badge ${isError ? 'error' : 'success'}`;

  if (isError) {
    cloneResult.voiceId.textContent = '请求未完成';
    cloneResult.cloneFileId.textContent = '-';
    cloneResult.promptFileId.textContent = '-';
    cloneResult.statusCode.textContent = '-';
    cloneResult.statusMsg.textContent = data.error;
    cloneResult.sensitive.textContent = '请检查 API Key、账号权限与上传音频规范。';
    cloneResult.audioBox.classList.add('hidden');
    cloneResult.raw.textContent = JSON.stringify(data, null, 2);
    return;
  }

  cloneResult.voiceId.textContent = data.request.voice_id;
  cloneResult.cloneFileId.textContent = data.upload?.cloneFile?.file_id ?? '-';
  cloneResult.promptFileId.textContent = data.upload?.promptFile?.file_id ?? '-';
  cloneResult.statusCode.textContent = data.result.base_resp?.status_code ?? '-';
  cloneResult.statusMsg.textContent = data.result.base_resp?.status_msg ?? '-';
  const sensitive = data.result.input_sensitive;
  cloneResult.sensitive.textContent = typeof sensitive === 'object' && sensitive !== null
    ? `风控检测：type=${sensitive.type ?? 'unknown'}`
    : `风控检测：${JSON.stringify(sensitive ?? '未返回')}`;

  if (data.result.demo_audio) {
    cloneResult.audioBox.classList.remove('hidden');
    cloneResult.audio.src = data.result.demo_audio;
    cloneResult.audioLink.href = data.result.demo_audio;
  } else {
    cloneResult.audioBox.classList.add('hidden');
    cloneResult.audio.removeAttribute('src');
    cloneResult.audioLink.href = '#';
  }

  cloneResult.raw.textContent = JSON.stringify(data, null, 2);
}

function renderTtsResult(data, isError) {
  ttsResult.empty.classList.add('hidden');
  ttsResult.content.classList.remove('hidden');
  ttsResult.badge.textContent = isError ? '失败' : '成功';
  ttsResult.badge.className = `badge ${isError ? 'error' : 'success'}`;
  ttsResult.streamBox.classList.add('hidden');

  if (isError) {
    ttsResult.traceId.textContent = '请求未完成';
    ttsResult.usage.textContent = '-';
    ttsResult.length.textContent = '-';
    ttsResult.format.textContent = '-';
    ttsResult.msg.textContent = data.error;
    ttsResult.audioBox.classList.add('hidden');
    ttsResult.raw.textContent = JSON.stringify(data, null, 2);
    return;
  }

  ttsResult.traceId.textContent = data.result.trace_id ?? '-';
  ttsResult.usage.textContent = data.result.extra_info?.usage_characters ?? '-';
  ttsResult.length.textContent = data.result.extra_info?.audio_length ?? '-';
  ttsResult.format.textContent = data.result.extra_info?.audio_format ?? '-';
  ttsResult.msg.textContent = data.result.base_resp?.status_msg ?? '-';

  if (data.streamSummary) {
    ttsResult.streamBox.classList.remove('hidden');
    ttsResult.streamBox.textContent = data.streamSummary;
  }

  if (state.currentObjectUrl) {
    URL.revokeObjectURL(state.currentObjectUrl);
    state.currentObjectUrl = null;
  }

  if (data.audioUrl) {
    ttsResult.audioBox.classList.remove('hidden');
    ttsResult.audio.src = data.audioUrl;
    ttsResult.audioLink.href = data.audioUrl;
    if (data.audioUrl.startsWith('blob:')) {
      state.currentObjectUrl = data.audioUrl;
    }
  } else {
    ttsResult.audioBox.classList.add('hidden');
    ttsResult.audio.removeAttribute('src');
    ttsResult.audioLink.href = '#';
  }

  if (data.subtitleUrl) {
    ttsResult.subtitleLink.classList.remove('hidden');
    ttsResult.subtitleLink.href = data.subtitleUrl;
  } else {
    ttsResult.subtitleLink.classList.add('hidden');
    ttsResult.subtitleLink.href = '#';
  }

  ttsResult.raw.textContent = JSON.stringify(data, null, 2);
}

function handleStreamToggle() {
  const enabled = streamModeCheckbox.checked;
  if (enabled && audioFormatSelect.value === 'wav') {
    audioFormatSelect.value = 'mp3';
  }
  audioFormatSelect.querySelector('option[value="wav"]').disabled = enabled;
}

function renderHistory() {
  cloneHistoryEl.innerHTML = renderHistoryItems(state.history.clone, '暂无复刻历史');
  ttsHistoryEl.innerHTML = renderHistoryItems(state.history.tts, '暂无合成历史');
}

function renderHistoryItems(items, emptyLabel) {
  if (!items.length) {
    return `<div class="history-empty">${escapeHtml(emptyLabel)}</div>`;
  }

  return items
    .map((item) => `
      <article class="history-item">
        <strong>${escapeHtml(item.voiceId || 'unknown')}</strong>
        <p>${escapeHtml(item.text || item.status || '')}</p>
        <small>${new Date(item.createdAt).toLocaleString('zh-CN')}</small>
      </article>
    `)
    .join('');
}

function pushHistory(type, item) {
  state.history[type] = [item, ...(state.history[type] || [])].slice(0, 8);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
  renderHistory();
}

function clearHistory() {
  state.history = { clone: [], tts: [] };
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
  renderHistory();
}

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
    return {
      clone: Array.isArray(parsed.clone) ? parsed.clone : [],
      tts: Array.isArray(parsed.tts) ? parsed.tts : []
    };
  } catch {
    return { clone: [], tts: [] };
  }
}

async function directCloneVoice(form) {
  const formData = new FormData(form);
  const cloneAudio = formData.get('cloneAudio');
  const promptAudio = formData.get('promptAudio');
  validateAudioFile(cloneAudio, '复刻音频');
  if (promptAudio && promptAudio.size > 0) {
    validateAudioFile(promptAudio, '示例音频');
  }

  const voiceId = buildVoiceId(String(formData.get('voiceId') || ''));
  const text = String(formData.get('text') || '').trim();
  const model = String(formData.get('model') || '').trim();
  const languageBoost = String(formData.get('languageBoost') || '').trim();
  const promptText = String(formData.get('promptText') || '').trim();

  if (text && !MODEL_OPTIONS.has(model)) {
    throw new Error('填写试听文本后，必须选择有效试听模型。');
  }
  if (languageBoost && !LANGUAGE_BOOST_OPTIONS.has(languageBoost)) {
    throw new Error('language_boost 不合法。');
  }
  if ((promptAudio && promptAudio.size > 0 && !promptText) || (!(promptAudio && promptAudio.size > 0) && promptText)) {
    throw new Error('示例音频和示例文本必须同时提供。');
  }

  const cloneUpload = await uploadFileDirect(cloneAudio, 'voice_clone');
  const promptUpload = promptAudio && promptAudio.size > 0 ? await uploadFileDirect(promptAudio, 'prompt_audio') : null;

  const request = {
    file_id: cloneUpload.file.file_id,
    voice_id: voiceId,
    need_noise_reduction: normalizeBoolean(formData.get('needNoiseReduction')),
    need_volume_normalization: normalizeBoolean(formData.get('needVolumeNormalization')),
    aigc_watermark: normalizeBoolean(formData.get('aigcWatermark'))
  };

  if (promptUpload && promptText) {
    request.clone_prompt = {
      prompt_audio: promptUpload.file.file_id,
      prompt_text: promptText
    };
  }
  if (text) {
    request.text = text;
    request.model = model;
  }
  if (languageBoost) {
    request.language_boost = languageBoost;
  }

  const result = await minimaxJson('https://api.minimaxi.com/v1/voice_clone', {
    method: 'POST',
    headers: minimaxHeaders(),
    body: JSON.stringify(request)
  });

  return {
    ok: result.base_resp?.status_code === 0,
    request,
    upload: {
      cloneFile: cloneUpload.file,
      promptFile: promptUpload?.file || null
    },
    result
  };
}

async function directTextToSpeech(rawFields) {
  ensureApiKey();
  const request = buildTtsPayload(rawFields, { stream: false });
  const result = await minimaxJson('https://api.minimaxi.com/v1/t2a_v2', {
    method: 'POST',
    headers: minimaxHeaders(),
    body: JSON.stringify(request)
  });
  return {
    ok: result.base_resp?.status_code === 0,
    request,
    result,
    audioUrl: result.data?.audio || null,
    subtitleUrl: result.data?.subtitle_file || null
  };
}

async function directStreamTts(rawFields) {
  ensureApiKey();
  const request = buildTtsPayload(rawFields, { stream: true });
  const response = await fetch('https://api.minimaxi.com/v1/t2a_v2', {
    method: 'POST',
    headers: {
      ...minimaxHeaders(),
      Accept: 'text/event-stream'
    },
    body: JSON.stringify(request)
  });

  return consumeStreamResponse(response, request);
}

async function proxyStreamTts(rawFields) {
  const response = await fetch('api/text-to-speech/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rawFields)
  });
  const request = buildTtsPayload(rawFields, { stream: true });
  return consumeStreamResponse(response, request);
}

async function consumeStreamResponse(response, request) {
  if (!response.ok) {
    const errorData = await safeJson(response);
    throw new Error(errorData?.error || errorData?.message || `请求失败：HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('流式响应为空。');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let traceId = '-';
  let chunkCount = 0;
  let extraInfo = {};
  let subtitleUrl = null;
  const hexChunks = [];
  let baseResp = { status_code: 0, status_msg: 'success' };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parsed = extractStreamMessages(buffer);
    buffer = parsed.rest;

    for (const message of parsed.messages) {
      const json = coerceStreamJson(message);
      if (!json) {
        continue;
      }
      traceId = json.trace_id || traceId;
      baseResp = json.base_resp || baseResp;
      extraInfo = json.extra_info || extraInfo;
      if (json.data?.subtitle_file) {
        subtitleUrl = json.data.subtitle_file;
      }
      if (json.data?.audio) {
        hexChunks.push(json.data.audio);
        chunkCount += 1;
        ttsStatusEl.textContent = `流式接收中：已收到 ${chunkCount} 个音频分片...`;
      }
    }
  }

  const audioUrl = hexChunks.length
    ? URL.createObjectURL(new Blob([hexChunksToUint8Array(hexChunks)], { type: mimeTypeForFormat(request.audio_setting.format) }))
    : null;

  return {
    ok: true,
    request,
    result: {
      trace_id: traceId,
      extra_info: extraInfo,
      base_resp: baseResp
    },
    audioUrl,
    subtitleUrl,
    streamSummary: `流式完成：共接收 ${chunkCount} 个音频分片。`
  };
}

function extractStreamMessages(input) {
  const messages = [];
  const parts = input.split(/\n\n+/);
  const rest = parts.pop() || '';
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed) {
      messages.push(trimmed);
    }
  }
  return { messages, rest };
}

function coerceStreamJson(message) {
  const dataLines = message
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());

  const raw = dataLines.length ? dataLines.join('') : message;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function uploadFileDirect(file, purpose) {
  const body = new FormData();
  body.set('purpose', purpose);
  body.set('file', file, file.name);
  const result = await minimaxJson('https://api.minimaxi.com/v1/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${state.apiKey}`
    },
    body
  });
  return result;
}

function buildTtsPayload(fields, options = {}) {
  const { stream = false } = options;
  const voiceId = String(fields.voiceId || '').trim();
  const text = String(fields.text || '').trim();
  const model = String(fields.model || '').trim();
  const emotion = String(fields.emotion || '').trim();
  const languageBoost = String(fields.languageBoost || '').trim();
  const audioFormat = String(fields.audioFormat || 'mp3').trim();
  const sampleRate = Number(fields.sampleRate || 32000);
  const bitrate = Number(fields.bitrate || 128000);
  const channel = Number(fields.channel || 1);
  const speed = Number(fields.speed || 1);
  const vol = Number(fields.vol || 1);
  const pitch = Number(fields.pitch || 0);

  if (!voiceId) {
    throw new Error('正式合成必须填写 voice_id。');
  }
  if (!text || text.length >= 10000) {
    throw new Error('正式合成文本需填写且长度小于 10000 字符。');
  }
  if (!MODEL_OPTIONS.has(model)) {
    throw new Error('正式合成模型不合法。');
  }
  if (emotion && !EMOTION_OPTIONS.has(emotion)) {
    throw new Error('emotion 不合法。');
  }
  if (languageBoost && !LANGUAGE_BOOST_OPTIONS.has(languageBoost)) {
    throw new Error('language_boost 不合法。');
  }
  if (!AUDIO_FORMAT_OPTIONS.has(audioFormat)) {
    throw new Error('audio format 不合法。');
  }
  if (stream && audioFormat === 'wav') {
    throw new Error('流式模式不支持 wav。');
  }
  if (!SAMPLE_RATE_OPTIONS.has(sampleRate)) {
    throw new Error('sample rate 不合法。');
  }
  if (audioFormat === 'mp3' && !BITRATE_OPTIONS.has(bitrate)) {
    throw new Error('mp3 bitrate 不合法。');
  }
  if (![1, 2].includes(channel)) {
    throw new Error('channel 只支持 1 或 2。');
  }
  if (!(speed >= 0.5 && speed <= 2)) {
    throw new Error('speed 需在 [0.5, 2]。');
  }
  if (!(vol > 0 && vol <= 10)) {
    throw new Error('vol 需在 (0, 10]。');
  }
  if (!Number.isInteger(pitch) || pitch < -12 || pitch > 12) {
    throw new Error('pitch 必须是 [-12, 12] 的整数。');
  }

  const payload = {
    model,
    text,
    stream,
    voice_setting: {
      voice_id: voiceId,
      speed,
      vol,
      pitch,
      text_normalization: Boolean(fields.textNormalization)
    },
    audio_setting: {
      sample_rate: sampleRate,
      format: audioFormat,
      channel
    },
    subtitle_enable: Boolean(fields.subtitleEnable)
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
  if (!stream) {
    payload.output_format = 'url';
    payload.aigc_watermark = Boolean(fields.aigcWatermark);
  }

  return payload;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await safeJson(response);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || data?.result?.base_resp?.status_msg || '请求失败');
  }
  return data;
}

async function minimaxJson(url, options) {
  const response = await fetch(url, options);
  const data = await safeJson(response);
  if (!response.ok) {
    throw new Error(data?.base_resp?.status_msg || data?.message || `MiniMax 返回 HTTP ${response.status}`);
  }
  if (data?.base_resp?.status_code && data.base_resp.status_code !== 0) {
    throw new Error(data.base_resp.status_msg || 'MiniMax 请求失败');
  }
  return data;
}

async function safeJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function minimaxHeaders() {
  ensureApiKey();
  return {
    Authorization: `Bearer ${state.apiKey}`,
    'Content-Type': 'application/json'
  };
}

function ensureApiKey() {
  if (!state.apiKey) {
    throw new Error('静态模式下请先在页面顶部填写 MiniMax API Key。');
  }
}

function validateAudioFile(file, label) {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error(`请上传${label}。`);
  }
  if (!/\.(mp3|m4a|wav)$/i.test(file.name)) {
    throw new Error(`${label}仅支持 mp3、m4a、wav 格式。`);
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error(`${label}不能超过 20MB。`);
  }
}

function buildVoiceId(rawVoiceId = '') {
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

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 'on' || value === '1';
}

function normalizeVoices(result) {
  return [
    ...(result.system_voice || []).map((item) => ({
      ...item,
      category: 'system',
      descriptionText: Array.isArray(item.description) ? item.description.join(' ') : ''
    })),
    ...(result.voice_cloning || []).map((item) => ({
      ...item,
      category: 'voice_cloning',
      descriptionText: Array.isArray(item.description) ? item.description.join(' ') : ''
    })),
    ...(result.voice_generation || []).map((item) => ({
      ...item,
      category: 'voice_generation',
      descriptionText: Array.isArray(item.description) ? item.description.join(' ') : ''
    }))
  ];
}

function hexChunksToUint8Array(chunks) {
  const bytes = [];
  for (const hex of chunks) {
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.slice(i, i + 2), 16));
    }
  }
  return new Uint8Array(bytes);
}

function mimeTypeForFormat(format) {
  switch (format) {
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'flac':
      return 'audio/flac';
    default:
      return 'application/octet-stream';
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function readAudioDuration(file) {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    const objectUrl = URL.createObjectURL(file);
    audio.preload = 'metadata';
    audio.src = objectUrl;
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      if (Number.isFinite(audio.duration)) {
        resolve(audio.duration);
      } else {
        reject(new Error('duration unavailable'));
      }
    };
    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('audio metadata error'));
    };
  });
}
