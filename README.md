# MiniMax 音色快速复刻 MVP

一个最小可用的 Web 项目，现在包含四块能力：

- 音色快速复刻
- 系统音色 / 已激活复刻音色查询与搜索
- 正式语音合成（普通模式 + 流式生成）
- GitHub Pages 静态部署

## 两种运行方式

### 1) 本地代理模式

本地启动 `Node/Express` 服务，由服务端代理 MiniMax API，前端不暴露 API Key。

```bash
cd minimax-voice-clone-mvp
cp .env.example .env
# 编辑 .env，填入你的 MiniMax API Key
npm install
npm test
npm run dev
```

浏览器打开：`http://localhost:3000`

### 2) GitHub Pages 静态模式

GitHub Pages 不能运行 Node 服务，所以静态页会切换成浏览器直连 MiniMax API 的模式。

注意：
- 需要在页面顶部临时填写你自己的 `MiniMax API Key`
- API Key 只保存在你的浏览器本地 `localStorage`
- 如果目标接口未来收紧 CORS，静态模式可能受限；此时请改用本地代理模式

## 功能

- 上传复刻音频，支持 `mp3`、`m4a`、`wav`
- 可选上传示例音频 + 对应文本，增强音色相似度
- 可选填写试听文本和模型，直接拿到复刻阶段的 `demo_audio`
- 查询系统音色、复刻音色、文生音色或全部音色
- 支持按 `voice_id`、名称、描述搜索音色，并一键带入正式合成
- 支持正式语音合成：`voice_id`、文本、模型、情绪、语速、音量、音高、音频格式等参数
- 支持流式生成：实时接收音频分片，完成后自动生成可播放音频
- 支持历史记录：复刻历史和合成历史保存在浏览器本地

## 依赖的官方文档

我根据 MiniMax 官方文档索引 `https://platform.minimaxi.com/docs/llms.txt` 选用了这几页：

- 音色快速复刻：`https://platform.minimaxi.com/docs/api-reference/voice-cloning-clone.md`
- 上传复刻音频：`https://platform.minimaxi.com/docs/api-reference/voice-cloning-uploadcloneaudio.md`
- 上传示例音频：`https://platform.minimaxi.com/docs/api-reference/voice-cloning-uploadprompt.md`
- 同步语音合成 HTTP：`https://platform.minimaxi.com/docs/api-reference/speech-t2a-http.md`
- 查询可用音色 ID：`https://platform.minimaxi.com/docs/api-reference/voice-management-get.md`
- 音色快速复刻指南：`https://platform.minimaxi.com/docs/guides/speech-voice-clone.md`

## 环境变量

```bash
MINIMAX_API_KEY=your_minimax_api_key
PORT=3000
```

## 项目结构

```text
minimax-voice-clone-mvp/
├── docs/                    # GitHub Pages 发布目录（由 public 同步生成）
├── public/                  # 前端源码
├── scripts/
│   └── sync-pages.js
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

## 已实现的本地接口

- `GET /api/health`：检查服务与 API Key 状态
- `POST /api/voice-clone`：上传主音频/示例音频并发起音色复刻
- `POST /api/voices`：查询系统音色 / 复刻音色 / 全部音色
- `POST /api/text-to-speech`：正式语音合成（普通模式）
- `POST /api/text-to-speech/stream`：正式语音合成（流式模式，转发上游分片）

## GitHub Pages 同步

每次前端变更后，可执行：

```bash
npm run sync:pages
```

这会把 `public/` 同步到 `docs/`，并生成 `docs/.nojekyll` 与 `docs/404.html`。

## 注意事项

- 复刻音频官方要求：10 秒到 5 分钟、20MB 内
- 示例音频官方要求：小于 8 秒、20MB 内
- 正式合成文本官方要求：小于 10000 字符
- `output_format=url` 返回的普通模式音频 URL 有效期为 24 小时
- 流式模式不支持 `wav`
- 快速复刻得到的音色，需要正式调用一次后，才可在“查询可用音色”接口里看到
- 复刻出的音色如果 7 天内未正式调用，官方会删除该音色
