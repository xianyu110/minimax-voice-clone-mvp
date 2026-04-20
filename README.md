# MiniMax 音色快速复刻 MVP

一个最小可用的 Web 项目：上传复刻音频，服务端先调用 MiniMax 文件上传接口，再调用音色快速复刻接口，最后把 `voice_id`、`file_id` 和试听音频返回到页面。

## 功能

- 上传复刻音频，支持 `mp3`、`m4a`、`wav`
- 可选上传示例音频 + 对应文本，增强音色相似度
- 可选填写试听文本和模型，直接拿到 `demo_audio`
- 支持 `language_boost`、降噪、音量归一化、水印开关
- 前端显示上传文件时长提示，服务端负责真正鉴权与接口调用

## 依赖的官方文档

我根据 MiniMax 官方文档索引 `https://platform.minimaxi.com/docs/llms.txt` 选用了这几页：

- 音色快速复刻：`https://platform.minimaxi.com/docs/api-reference/voice-cloning-clone.md`
- 上传复刻音频：`https://platform.minimaxi.com/docs/api-reference/voice-cloning-uploadcloneaudio.md`
- 上传示例音频：`https://platform.minimaxi.com/docs/api-reference/voice-cloning-uploadprompt.md`
- 使用指南：`https://platform.minimaxi.com/docs/guides/speech-voice-clone.md`
- 常见问题（权限说明）：`https://platform.minimaxi.com/docs/faq/about-apis.md`

## 本地启动

```bash
cd minimax-voice-clone-mvp
cp .env.example .env
# 编辑 .env，填入你的 MiniMax API Key
npm install
npm test
npm run dev
```

浏览器打开：`http://localhost:3000`

## 环境变量

```bash
MINIMAX_API_KEY=your_minimax_api_key
PORT=3000
```

## 项目结构

```text
minimax-voice-clone-mvp/
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   └── voice-clone.js
├── test/
│   └── voice-clone.test.js
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js
```

## API 流程

1. 浏览器把文件和表单提交到本地 `/api/voice-clone`
2. 服务端调用 `POST https://api.minimaxi.com/v1/files/upload`
   - 主音频使用 `purpose=voice_clone`
   - 示例音频使用 `purpose=prompt_audio`
3. 服务端拿到 `file_id` 后调用 `POST https://api.minimaxi.com/v1/voice_clone`
4. 页面展示 `voice_id`、上传后的 `file_id`、状态码和 `demo_audio`

## 注意事项

- 复刻音频官方要求：10 秒到 5 分钟、20MB 内
- 示例音频官方要求：小于 8 秒、20MB 内
- 如果你填写了试听文本，必须同时选择试听模型
- 音色复刻权限可能依赖账号认证状态；官方错误码 `2038` 表示无复刻权限
- 复刻出的音色如果 7 天内未正式调用，官方会删除该音色

## 可继续扩展

- 增加正式 TTS 合成页面，直接消费已生成的 `voice_id`
- 增加历史记录、重试与错误码说明
- 增加登录态与多用户隔离
