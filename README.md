# WeChat Content Growth

[![CI](https://github.com/wushuai0802/wechat-content-growth/actions/workflows/ci.yml/badge.svg)](https://github.com/wushuai0802/wechat-content-growth/actions/workflows/ci.yml)
[![CodeQL](https://github.com/wushuai0802/wechat-content-growth/actions/workflows/codeql.yml/badge.svg)](https://github.com/wushuai0802/wechat-content-growth/actions/workflows/codeql.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

本地优先、自托管的微信公众号内容运营与实验控制台。项目把热点采集、选题评分、文章生成、内容质量门禁、配图计划、微信草稿箱和收益复盘放进同一个可审阅工作流。

This repository is a local-first, self-hosted operations console for WeChat Official Account content experiments.

## 能做什么

- 聚合百度、微博、头条等热点信号，并生成多角度候选选题。
- 按时效、账号匹配、竞争度、成本、风险和预估收益排序。
- 通过本地 OpenAI-compatible provider 生成文章草稿。
- 检查事实素材、文章结构、编辑语气和风险边界。
- 为封面和正文图片建立可追踪的位图生成计划。
- 在人工审核后创建或更新微信公众号草稿。
- 导入阅读、分享、关注、收入和成本数据，更新后续策略。
- 使用本地 JSON 工作区运行，不要求外部数据库。

公开仓库只包含合成演示数据。真实文章、账号信息、媒体 ID、浏览器资料、运营日志和收益样本不在仓库中。

## 安全边界

管理台没有多用户登录系统，必须只在本机或可信私有网络中使用。应用默认监听 `127.0.0.1`，中间件也会拒绝非回环地址访问管理 API。

需要接收微信服务器回调时，只应通过反向代理暴露 `/api/wechat/callback`。不要把整个管理台或 `/api/*` 暴露到公网。

微信操作默认使用 `draft_only`。公开版本不应被视为无人值守自动发布系统，发布前必须完成人工审核、事实核验和风险检查。

## 快速开始

要求 Node.js 20 或更高版本。

```bash
git clone https://github.com/wushuai0802/wechat-content-growth.git
cd wechat-content-growth
npm ci
npm run dev
```

打开 `http://127.0.0.1:3000`。首次访问会在 `.data/` 下创建本地演示工作区。

运行验证：

```bash
npm test
npm run build
npm start
```

## 配置

复制 `.env.example` 为 `.env.local`，只填写实际需要的变量。不要提交 `.env.local`。

| 变量 | 用途 | 默认值 |
| --- | --- | --- |
| `WCG_DATA_ROOT` | 运行数据、配置和交付物根目录 | `<repo>/.data` |
| `CPA_BASE_URL` | 本地 OpenAI-compatible API | 无 |
| `CPA_API_KEY` | 本地 provider 密钥 | 无 |
| `CPA_MODEL` | 文本生成模型 | `gpt-5.4-mini` |
| `WECHAT_APP_ID` | 公众号 AppID | 无 |
| `WECHAT_APP_SECRET` | 公众号 AppSecret | 无 |
| `WECHAT_TOKEN` | 微信回调 Token | 无 |
| `WECHAT_PUBLISH_MODE` | 微信操作模式 | `draft_only` |

完整说明见 [配置文档](docs/configuration.md) 和 [安全模型](docs/security-model.md)。

## Docker

```bash
docker compose up --build
```

Compose 只把端口绑定到宿主机 `127.0.0.1:3000`，数据写入仓库下的 `.data/`。若要接入微信回调，请单独配置反向代理和 TLS，仅转发回调路径。

## 项目结构

```text
src/app/          Next.js 页面和 Route Handlers
src/lib/          领域模型、热点、生成、质量门禁、微信和收益逻辑
scripts/          本地启动辅助脚本
editorial-room/   可复用的文件协议模板，不含真实运行记录
docs/             架构、配置和安全文档
.data/            本地运行数据，已被 Git 忽略
```

架构与数据流详见 [architecture.md](docs/architecture.md)。

## 当前限制

- 管理台没有用户登录和权限系统。
- 默认存储是单机 JSON，不适合多实例并发部署。
- 微信草稿和发布能力受公众号类型、接口权限、IP 白名单及微信平台规则限制。
- 热点线索不等于事实；具体数字、政策、医疗、法律、金融等内容必须人工核验。
- AI 生成内容和图片必须在使用前检查事实、版权、肖像和平台合规性。

## 开源边界

本仓库提供通用产品框架和合成示例。真实运营数据、私有提示词变体、账号定位、商业合作信息以及生产环境自动化应保留在独立私有目录或仓库中。

项目采用 [GNU AGPL v3](LICENSE)。参与贡献前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [SECURITY.md](SECURITY.md)。
