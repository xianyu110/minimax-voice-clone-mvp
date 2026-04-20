const cloneForm = document.getElementById('clone-form');
const ttsForm = document.getElementById('tts-form');
const cloneStatusEl = document.getElementById('form-status');
const ttsStatusEl = document.getElementById('tts-status');
const clonedVoiceInput = document.getElementById('tts-voice-id');
const useClonedVoiceButton = document.getElementById('use-cloned-voice');

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
  audioBox: document.getElementById('tts-audio-box'),
  audio: document.getElementById('tts-audio'),
  audioLink: document.getElementById('tts-audio-link'),
  subtitleLink: document.getElementById('tts-subtitle-link'),
  raw: document.getElementById('tts-raw-json')
};

const durationRules = {
  cloneAudio: { min: 10, max: 300, label: '复刻音频' },
  promptAudio: { min: 0, max: 8, label: '示例音频' }
};

let latestVoiceId = '';

for (const input of cloneForm.querySelectorAll('input[type="file"]')) {
  input.addEventListener('change', async (event) => {
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
  });
}

cloneForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  cloneStatusEl.textContent = '正在上传文件并请求 MiniMax...';

  const submitButton = cloneForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const formData = new FormData(cloneForm);
    const data = await requestJson('/api/voice-clone', {
      method: 'POST',
      body: formData
    });

    renderCloneResult(data, false);
    latestVoiceId = data.request.voice_id;
    clonedVoiceInput.value = latestVoiceId;
    cloneStatusEl.textContent = '复刻完成，已自动把 voice_id 填进正式合成表单。';
  } catch (error) {
    renderCloneResult({ error: error.message }, true);
    cloneStatusEl.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

ttsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  ttsStatusEl.textContent = '正在请求正式语音合成...';

  const submitButton = ttsForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const formData = new FormData(ttsForm);
    const payload = Object.fromEntries(formData.entries());
    for (const checkbox of ttsForm.querySelectorAll('input[type="checkbox"]')) {
      payload[checkbox.name] = checkbox.checked;
    }

    const data = await requestJson('/api/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    renderTtsResult(data, false);
    ttsStatusEl.textContent = '正式语音已生成，可直接试听或打开 URL。';
  } catch (error) {
    renderTtsResult({ error: error.message }, true);
    ttsStatusEl.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

useClonedVoiceButton.addEventListener('click', () => {
  if (latestVoiceId) {
    clonedVoiceInput.value = latestVoiceId;
    ttsStatusEl.textContent = '已填入刚刚复刻出来的 voice_id。';
    return;
  }

  ttsStatusEl.textContent = '当前还没有可复用的复刻 voice_id，请先完成 Step 1。';
});

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
    cloneResult.sensitive.textContent = '请先检查服务端 `.env` 中的 `MINIMAX_API_KEY`，以及账号是否已开通音色复刻权限。';
    cloneResult.audioBox.classList.add('hidden');
    cloneResult.raw.textContent = JSON.stringify(data, null, 2);
    return;
  }

  cloneResult.voiceId.textContent = data.request.voice_id;
  cloneResult.cloneFileId.textContent = data.upload.cloneFile?.file_id ?? '-';
  cloneResult.promptFileId.textContent = data.upload.promptFile?.file_id ?? '-';
  cloneResult.statusCode.textContent = data.result.base_resp?.status_code ?? '-';
  cloneResult.statusMsg.textContent = data.result.base_resp?.status_msg ?? '-';

  const sensitive = data.result.input_sensitive;
  if (typeof sensitive === 'object' && sensitive !== null) {
    cloneResult.sensitive.textContent = `风控检测：type=${sensitive.type ?? 'unknown'}`;
  } else {
    cloneResult.sensitive.textContent = `风控检测：${JSON.stringify(sensitive ?? '未返回')}`;
  }

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

  if (data.audioUrl) {
    ttsResult.audioBox.classList.remove('hidden');
    ttsResult.audio.src = data.audioUrl;
    ttsResult.audioLink.href = data.audioUrl;
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

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || data.result?.base_resp?.status_msg || '请求失败');
  }
  return data;
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
