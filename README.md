# MiniMax 音色快速复刻 MVP

一个最小可用的 Web 项目：先上传复刻音频，服务端调用 MiniMax 文件上传接口和音色快速复刻接口，拿到 `voice_id` 后，再直接调用正式语音合成接口生成可试听的正式音频。

## 功能

- 上传复刻音频，支持 `mp3`、`m4a`、`wav`
- 可选上传示例音频 + 对应文本，增强音色相似度
- 可选填写试听文本和模型，直接拿到复刻阶段的 `demo_audio`
- 支持 `language_boost`、降噪、音量归一化、水印开关
- 支持正式语音合成：输入 `voice_id`、文本、模型、情绪、语速、音量、音高、音频格式等参数
- 正式合成返回 24 小时有效音频 URL，可选返回字幕链接
- 前端显示上传文件时长提示，服务端负责真正鉴权与接口调用

## 依赖的官方文档

我根据 MiniMax 官方文档索引 `https://platform.minimaxi.com/docs/llms.txt` 选用了这几页：

- 音色快速复刻：`https://platform.minimaxi.com/docs/api-reference/voice-cloning-clone.md`
- 上传复刻音频：`https://platform.minimaxi.com/docs/api-reference/voice-cloning-uploadcloneaudio.md`
- 上传示例音频：`https://platform.minimaxi.com/docs/api-reference/voice-cloning-uploadprompt.md`
- 同步语音合成 HTTP：`https://platform.minimaxi.com/docs/api-reference/speech-t2a-http.md`
- 音色快速复刻指南：`https://platform.minimaxi.com/docs/guides/speech-voice-clone.md`
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
│   ├── speech.js
│   └── voice-clone.js
├── test/
│   ├── speech.test.js
│   └── voice-clone.test.js
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js
```

## API 流程

### 1) 音色快速复刻

1. 浏览器把文件和表单提交到本地 `/api/voice-clone`
2. 服务端调用 `POST https://api.minimaxi.com/v1/files/upload`
   - 主音频使用 `purpose=voice_clone`
   - 示例音频使用 `purpose=prompt_audio`
3. 服务端拿到 `file_id` 后调用 `POST https://api.minimaxi.com/v1/voice_clone`
4. 页面展示 `voice_id`、上传后的 `file_id`、状态码和 `demo_audio`

### 2) 正式语音合成

1. 浏览器把 JSON 参数提交到本地 `/api/text-to-speech`
2. 服务端调用 `POST https://api.minimaxi.com/v1/t2a_v2`
3. 请求固定使用 `stream=false` + `output_format=url`
4. 页面展示正式音频 URL、`trace_id`、字符计费、时长和字幕链接

## 注意事项

- 复刻音频官方要求：10 秒到 5 分钟、20MB 内
- 示例音频官方要求：小于 8 秒、20MB 内
- 如果你填写了复刻试听文本，必须同时选择试听模型
- 正式合成文本官方要求：小于 10000 字符
- `output_format=url` 返回的正式音频 URL 有效期为 24 小时
- 音色复刻权限可能依赖账号认证状态；官方错误码 `2038` 表示无复刻权限
- 复刻出的音色如果 7 天内未正式调用，官方会删除该音色

## 已实现的本地接口

- `POST /api/voice-clone`：上传主音频/示例音频并发起音色复刻
- `POST /api/text-to-speech`：使用 `voice_id` 做正式语音合成
- `GET /api/health`：检查服务是否启动以及是否配置了 API Key

## 可继续扩展

- 增加流式 TTS 播放
- 增加复刻历史与正式合成历史
- 增加系统音色查询与搜索
- 增加部署脚本和在线 Demo
