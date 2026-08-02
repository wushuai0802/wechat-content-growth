# 快速上手

## 1. 启动演示工作区

```bash
git clone https://github.com/wushuai0802/wechat-content-growth.git
cd wechat-content-growth
npm ci
npm run dev
```

访问 `http://127.0.0.1:3000`。第一次启动会自动创建 `.data/runtime/data/workspace.json`，其中只包含合成演示数据。

## 2. 连接文本与图片模型

应用使用本机 OpenAI-compatible provider，默认拒绝远程 provider URL。这一限制避免把密钥和运营内容直接发送到未经确认的远程地址。

在“模型配置”中填写 Base URL、API key 和模型名称。也可以使用 `.env.local` 或 `.data/runtime/config/cpa.env`。保存后先运行健康检查，再生成一篇测试文章。

## 3. 连接微信公众号

在微信公众号后台获取 AppID 和 AppSecret，并配置服务器 Token。账号必须拥有对应素材、草稿或发布接口权限。

在“账号管理”中填写配置后：

1. 保持发布模式为 `draft_only`。
2. 检查 access token。
3. 用一篇无敏感内容的文章验证图片上传和草稿创建。
4. 在微信后台人工检查标题、摘要、作者、封面和正文图片。

若需要微信服务器回调，只公开反向代理 `/api/wechat/callback`，不要公开整个应用。

## 4. 使用日常工作流

推荐顺序：

1. 抓取或导入热点线索。
2. 检查来源、时间和事实素材。
3. 选择候选选题并生成草稿。
4. 编辑正文，完成质量、语气和风险审核。
5. 生成与检查位图素材。
6. 创建微信草稿并人工发布。
7. 导入阅读、分享、关注、收入和成本数据。
8. 根据真实结果调整下一批选题。

## 5. 数据和备份

默认数据都在 `.data/`，升级或迁移前直接备份这个目录即可。不要把该目录提交到 Git。

```text
.data/runtime/data/workspace.json
.data/runtime/config/cpa.env
.data/runtime/config/wechat.env
.data/deliverables/
.data/backups/
```

## 6. 生产运行

```bash
npm run build
npm start
```

服务默认监听 `127.0.0.1:3000`。可通过 `PORT` 修改端口。完整自检使用：

```bash
npm run check
```

Docker 用户可运行 `docker compose up --build`。Compose 仍只绑定宿主机回环地址。
