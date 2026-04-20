const form = document.getElementById('clone-form');
const statusEl = document.getElementById('form-status');
const emptyEl = document.getElementById('result-empty');
const contentEl = document.getElementById('result-content');
const badgeEl = document.getElementById('result-badge');
const voiceIdEl = document.getElementById('result-voice-id');
const cloneFileIdEl = document.getElementById('clone-file-id');
const promptFileIdEl = document.getElementById('prompt-file-id');
const statusCodeEl = document.getElementById('status-code');
const statusMsgEl = document.getElementById('status-msg');
const sensitiveBoxEl = document.getElementById('sensitive-box');
const audioBoxEl = document.getElementById('audio-box');
const demoAudioEl = document.getElementById('demo-audio');
const demoAudioLinkEl = document.getElementById('demo-audio-link');
const rawJsonEl = document.getElementById('raw-json');

const durationRules = {
  cloneAudio: { min: 10, max: 300, label: '复刻音频' },
  promptAudio: { min: 0, max: 8, label: '示例音频' }
};

for (const input of form.querySelectorAll('input[type="file"]')) {
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

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusEl.textContent = '正在上传文件并请求 MiniMax...';

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const formData = new FormData(form);
    const response = await fetch('/api/voice-clone', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || data.result?.base_resp?.status_msg || '请求失败');
    }

    renderResult(data, false);
    statusEl.textContent = '复刻完成，可以直接试听或复制 voice_id 继续做正式合成。';
  } catch (error) {
    renderResult({ error: error.message }, true);
    statusEl.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

function renderResult(data, isError) {
  emptyEl.classList.add('hidden');
  contentEl.classList.remove('hidden');
  badgeEl.textContent = isError ? '失败' : '成功';
  badgeEl.className = `badge ${isError ? 'error' : 'success'}`;

  if (isError) {
    voiceIdEl.textContent = '请求未完成';
    cloneFileIdEl.textContent = '-';
    promptFileIdEl.textContent = '-';
    statusCodeEl.textContent = '-';
    statusMsgEl.textContent = data.error;
    sensitiveBoxEl.textContent = '请先检查服务端 `.env` 中的 `MINIMAX_API_KEY`，以及账号是否已开通音色复刻权限。';
    audioBoxEl.classList.add('hidden');
    rawJsonEl.textContent = JSON.stringify(data, null, 2);
    return;
  }

  voiceIdEl.textContent = data.request.voice_id;
  cloneFileIdEl.textContent = data.upload.cloneFile?.file_id ?? '-';
  promptFileIdEl.textContent = data.upload.promptFile?.file_id ?? '-';
  statusCodeEl.textContent = data.result.base_resp?.status_code ?? '-';
  statusMsgEl.textContent = data.result.base_resp?.status_msg ?? '-';

  const sensitive = data.result.input_sensitive;
  if (typeof sensitive === 'object' && sensitive !== null) {
    sensitiveBoxEl.textContent = `风控检测：type=${sensitive.type ?? 'unknown'}`;
  } else {
    sensitiveBoxEl.textContent = `风控检测：${JSON.stringify(sensitive ?? '未返回')}`;
  }

  if (data.result.demo_audio) {
    audioBoxEl.classList.remove('hidden');
    demoAudioEl.src = data.result.demo_audio;
    demoAudioLinkEl.href = data.result.demo_audio;
  } else {
    audioBoxEl.classList.add('hidden');
    demoAudioEl.removeAttribute('src');
    demoAudioLinkEl.href = '#';
  }

  rawJsonEl.textContent = JSON.stringify(data, null, 2);
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
