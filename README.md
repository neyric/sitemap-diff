# Site Bot - 网站监控机器人

一个基于 Cloudflare Workers 的智能网站监控机器人，自动监控多个网站的 sitemap 变化，并通过 Telegram/Discord 推送更新通知。

## 🎯 项目特色

- **零成本部署**：基于 Cloudflare Workers，完全免费
- **智能监控**：自动检测 sitemap 变化，支持 .gz 压缩文件
- **静默模式**：只在有更新时发送通知，避免消息轰炸
- **多平台支持**：Telegram 和 Discord 双平台
- **关键词汇总**：自动提取和分析新增内容关键词
- **实时交互**：支持命令行操作和状态查询

---

## 📋 第一部分：业务逻辑与功能

### 🔍 核心功能

#### 1. 自动监控
- **定时检查**：每小时自动检查所有配置的 sitemap
- **变化检测**：对比新旧 sitemap，识别新增的 URL
- **智能解析**：支持 XML 和 HTML 格式的 sitemap
- **压缩支持**：自动处理 .gz 压缩的 sitemap 文件

#### 2. 消息推送策略

**静默模式设计**：
- ✅ **有更新**：发送完整的更新通知
- 🔇 **无更新**：完全静默，不发送任何消息
- 📊 **汇总报告**：所有更新完成后发送关键词汇总

**消息类型**：
1. **更新通知**：包含域名、新增数量、sitemap 文件、URL 列表
2. **关键词汇总**：分析新增内容的主题关键词
3. **命令响应**：用户交互的反馈信息
4. **错误通知**：配置错误或网络问题的提示

#### 3. 支持的命令

**Telegram 命令**：
```
/start, /help     - 显示帮助信息
/rss list         - 显示所有监控的 sitemap
/rss add URL      - 添加 sitemap 监控
/rss del URL      - 删除 sitemap 监控
/news             - 手动触发关键词汇总
```

**Discord 命令**：
```
/rss list         - 显示所有监控的 sitemap
/rss add URL      - 添加 sitemap 监控
/rss del URL      - 删除 sitemap 监控
/news             - 手动触发关键词汇总
```

#### 4. API 接口

**健康检查**：
```
GET /health
```

**手动触发监控**：
```
POST /monitor
```

**API 状态查询**：
```
GET /api/status
```

**Webhook 端点**：
```
POST /webhook/telegram  - Telegram Webhook
POST /webhook/discord   - Discord Webhook
```

### 🏗️ 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cloudflare    │    │   Telegram      │    │   Discord       │
│   Workers       │◄──►│   Bot API       │    │   Bot API       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│   Cloudflare    │
│   KV Storage    │
└─────────────────┘
```

**核心组件**：
- **RSSManager**：sitemap 下载、解析、存储管理
- **TelegramBot**：Telegram 消息发送和命令处理
- **DiscordBot**：Discord 消息发送和命令处理
- **Config**：环境变量配置管理

---

## 🚀 第二部分：快速上手指南

### 📋 前置要求

1. **Cloudflare 账户**
   - 注册 [Cloudflare](https://cloudflare.com) 账户
   - 验证邮箱地址

2. **Node.js 环境**
   - 安装 Node.js 16+ 版本
   - 安装 npm 或 yarn

3. **Bot Token**
   - Telegram Bot Token (从 @BotFather 获取)
   - Discord Bot Token (可选，从 Discord Developer Portal 获取)

### 🔧 快速部署

#### 步骤 1: 安装 Wrangler CLI

```bash
npm install -g wrangler
```

#### 步骤 2: 登录 Cloudflare

```bash
wrangler login
```

#### 步骤 3: 安装项目依赖

```bash
npm install
```

#### 步骤 4: 创建 KV 命名空间

```bash
# 创建 KV 命名空间
wrangler kv namespace create SITEMAP_STORAGE

# 创建预览环境的命名空间
wrangler kv namespace create SITEMAP_STORAGE --preview
```

#### 步骤 5: 更新配置文件

将得到的 ID 更新到 `wrangler.toml` 文件中：

```toml
[[kv_namespaces]]
binding = "SITEMAP_STORAGE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # 替换为实际的 ID
preview_id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # 预览环境 ID
```

#### 步骤 6: 设置环境变量

```bash
# 设置 Telegram Bot Token
wrangler secret put TELEGRAM_BOT_TOKEN
# 输入你的 Telegram Bot Token

# 设置目标聊天 ID
wrangler secret put TELEGRAM_TARGET_CHAT
# 输入频道用户名（如 @mychannel）或用户 ID

# 设置 Discord Token (可选)
wrangler secret put DISCORD_TOKEN
# 输入你的 Discord Bot Token
```

**获取 TELEGRAM_TARGET_CHAT 的方法**：

1. **频道用户名**：直接使用频道用户名，如 `@mychannel`
2. **用户 ID**：使用 @userinfobot 获取你的用户 ID
3. **频道 ID**：将机器人添加到频道，使用 @userinfobot 获取频道 ID

**获取 Bot Token 的方法**：
1. 在 Telegram 中找到 @BotFather
2. 发送 `/newbot` 命令
3. 按提示设置机器人名称和用户名
4. 获得 Token，格式如：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

#### 步骤 7: 配置 Webhook

**Telegram Webhook 设置**：

方法一：浏览器访问（推荐）
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://site-bot.your-subdomain.workers.dev/webhook/telegram
```
将 `<YOUR_BOT_TOKEN>` 替换为你的实际 Bot Token，`your-subdomain` 替换为你的 Workers 子域名。

方法二：curl 命令
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://site-bot.your-subdomain.workers.dev/webhook/telegram"}'
```

**Discord Webhook 设置**：
在 Discord Developer Portal 中设置交互端点：
```
https://site-bot.your-subdomain.workers.dev/webhook/discord
```

#### 步骤 8: 部署到 Cloudflare

```bash
# 开发环境测试
npm run dev

# 生产环境部署
npm run deploy
```

### 🔧 本地开发配置

#### 创建本地环境变量文件

在项目根目录创建 `.dev.vars` 文件（用于本地开发）：

```bash
# 创建 .dev.vars 文件
touch .dev.vars
```

编辑 `.dev.vars` 文件，添加以下内容：

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_TARGET_CHAT=@your_channel_or_user_id
DISCORD_TOKEN=your_discord_token_here
```

**注意**：`.dev.vars` 文件已添加到 `.gitignore`，不会被提交到版本控制。

#### 本地开发测试

```bash
# 启动本地开发服务器
npm run dev

# 测试健康检查
curl http://localhost:8787/health

# 测试手动触发监控
curl -X POST http://localhost:8787/monitor
```

### 🔄 修改和更新

#### 修改业务逻辑

**添加新的消息类型**：
1. 编辑 `src/apps/telegram-bot.js` 或 `src/apps/discord-bot.js`
2. 添加新的消息发送函数
3. 在相应位置调用新函数

**修改监控策略**：
1. 编辑 `src/services/rss-manager.js`
2. 修改 `downloadSitemap` 函数的解析逻辑
3. 调整 `addFeed` 函数的处理流程

**添加新的命令**：
1. 在 `src/apps/telegram-bot.js` 的 `handleTelegramUpdate` 函数中添加新的 case
2. 实现对应的处理函数
3. 更新帮助信息

#### 更新部署

```bash
# 拉取最新代码
git pull

# 重新部署
npm run deploy
```

#### 环境变量更新

```bash
# 更新特定变量
wrangler secret put TELEGRAM_BOT_TOKEN

# 删除变量
wrangler secret delete TELEGRAM_BOT_TOKEN
```

### 📊 监控和调试

#### 查看实时日志

```bash
wrangler tail
```

#### 健康检查

访问你的 Worker URL + `/health`：
```
https://site-bot.your-subdomain.workers.dev/health
```

#### API 状态

访问 `/api/status` 查看运行状态：
```
https://site-bot.your-subdomain.workers.dev/api/status
```

### 🔍 故障排除

#### 常见错误

1. **"Initialization Failed"**
   - 检查环境变量是否正确设置
   - 确认 KV 命名空间 ID 是否正确

2. **"配置验证失败"**
   - 确保 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_TARGET_CHAT` 已设置
   - 检查 Token 格式是否正确

3. **"KV 存储错误"**
   - 确认 KV 命名空间已创建
   - 检查 `wrangler.toml` 中的 ID 是否正确

4. **"定时任务不执行"**
   - 检查 cron 表达式：`"0 * * * *"` (每小时执行)
   - 确认 Workers 已正确部署

#### 调试步骤

1. **检查配置**
   ```bash
   wrangler whoami
   wrangler kv:namespace list
   ```

2. **本地测试**
   ```bash
   npm run dev
   ```

3. **查看日志**
   ```bash
   wrangler tail
   ```

4. **重新部署**
   ```bash
   wrangler deploy
   ```

### 💰 成本控制

#### 免费额度

- **Workers 请求**：100,000 次/天
- **KV 读取**：100,000 次/天
- **KV 写入**：1,000 次/天
- **CPU 时间**：10ms/请求

#### 使用量监控

在 Cloudflare Dashboard 中查看：
1. Workers > 你的 Worker > Analytics
2. Workers > KV > 你的命名空间 > Analytics

#### 优化建议

1. **减少请求频率**：已内置 2 秒延迟
2. **优化 sitemap 大小**：建议单个文件 < 1MB
3. **合理设置监控数量**：建议 < 50 个 sitemap

### 🎉 部署完成

恭喜！你的 Site Bot 已经成功部署到 Cloudflare Workers。

#### 下一步

1. **测试功能**：在 Telegram 中发送 `/start` 命令
2. **添加监控**：使用 `/rss add URL` 添加 sitemap
3. **查看状态**：访问 `/api/status` 查看运行状态
4. **监控日志**：使用 `wrangler tail` 查看实时日志

#### 支持

如果遇到问题，请：
1. 查看本文档的故障排除部分
2. 检查 Cloudflare Workers 日志
3. 提交 Issue 到项目仓库 