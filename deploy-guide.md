# Cloudflare Workers 部署指南

## 🎯 部署概览

本指南将帮助你将 Site Bot 部署到 Cloudflare Workers，实现完全免费的站点监控服务。

## 📋 前置要求

1. **Cloudflare 账户**
   - 注册 [Cloudflare](https://cloudflare.com) 账户
   - 验证邮箱地址

2. **Node.js 环境**
   - 安装 Node.js 16+ 版本
   - 安装 npm 或 yarn

3. **Bot Token**
   - Telegram Bot Token (从 @BotFather 获取)
   - Discord Bot Token (可选，从 Discord Developer Portal 获取)

## 🚀 快速部署

### 步骤 1: 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 步骤 2: 登录 Cloudflare

```bash
wrangler login
```

这会打开浏览器，授权 Wrangler 访问你的 Cloudflare 账户。

### 步骤 3: 安装项目依赖

```bash
npm install
```

### 步骤 4: 创建 KV 命名空间

```bash
# 创建 KV 命名空间
wrangler kv namespace create SITEMAP_STORAGE

# 创建预览环境的命名空间
wrangler kv namespace create SITEMAP_STORAGE --preview
```

执行后会得到类似这样的输出：
```
🌀 Creating namespace with title "SITEMAP_STORAGE"
✨ Success!
Add the following to your configuration file:
[[kv_namespaces]]
binding = "SITEMAP_STORAGE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### 步骤 5: 更新配置文件

将得到的 ID 更新到 `wrangler.toml` 文件中：

```toml
[[kv_namespaces]]
binding = "SITEMAP_STORAGE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # 替换为实际的 ID
preview_id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # 预览环境 ID
```

### 步骤 6: 设置环境变量

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

### 步骤 7: 部署到 Cloudflare

```bash
# 开发环境测试
npm run dev

# 生产环境部署
npm run deploy
```

部署成功后会显示类似这样的输出：
```
✨ Deployed to https://site-bot.your-subdomain.workers.dev
```

## 🔧 详细配置

### 环境变量说明

| 变量名 | 必填 | 格式 | 说明 |
|--------|------|------|------|
| `TELEGRAM_BOT_TOKEN` | ✅ | `123456789:ABCdefGHIjklMNOpqrsTUVwxyz` | Telegram 机器人 Token |
| `TELEGRAM_TARGET_CHAT` | ✅ | `@channelname` 或 `123456789` | 消息发送目标 |
| `DISCORD_TOKEN` | ❌ | `MTIzNDU2Nzg5MDEyMzQ1Njc4.GhIjKl.MnOpQrStUvWxYz` | Discord 机器人 Token |

### 获取 Bot Token

#### Telegram Bot Token

1. 在 Telegram 中找到 @BotFather
2. 发送 `/newbot` 命令
3. 按提示设置机器人名称和用户名
4. 获得 Token，格式如：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

#### Discord Bot Token

1. 访问 [Discord Developer Portal](https://discord.com/developers/applications)
2. 创建新应用
3. 在 Bot 页面创建机器人
4. 复制 Token

### 获取目标聊天 ID

#### Telegram 频道/用户 ID

**方法 1: 使用 @userinfobot**
1. 在 Telegram 中找到 @userinfobot
2. 发送任意消息
3. 获得你的用户 ID

**方法 2: 使用 @RawDataBot**
1. 将机器人添加到目标频道
2. 发送消息
3. 查看 `chat.id` 字段

**方法 3: 频道用户名**
- 直接使用频道用户名，如 `@mychannel`

## 🌐 Webhook 配置

### Telegram Webhook

设置 Telegram Bot 的 Webhook URL：

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://site-bot.your-subdomain.workers.dev/webhook/telegram"}'
```

### Discord Webhook

在 Discord Developer Portal 中设置交互端点：

```
https://site-bot.your-subdomain.workers.dev/webhook/discord
```

## 📊 监控和日志

### 查看实时日志

```bash
wrangler tail
```

### 健康检查

访问你的 Worker URL + `/health`：
```
https://site-bot.your-subdomain.workers.dev/health
```

### API 状态

访问 `/api/status` 查看运行状态：
```
https://site-bot.your-subdomain.workers.dev/api/status
```

## 🔍 故障排除

### 常见错误

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

### 调试步骤

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

## 🔄 更新部署

### 代码更新

```bash
# 拉取最新代码
git pull

# 重新部署
npm run deploy
```

### 环境变量更新

```bash
# 更新特定变量
wrangler secret put TELEGRAM_BOT_TOKEN

# 删除变量
wrangler secret delete TELEGRAM_BOT_TOKEN
```

## 💰 成本控制

### 免费额度

- **Workers 请求**：100,000 次/天
- **KV 读取**：100,000 次/天
- **KV 写入**：1,000 次/天
- **CPU 时间**：10ms/请求

### 使用量监控

在 Cloudflare Dashboard 中查看：
1. Workers > 你的 Worker > Analytics
2. Workers > KV > 你的命名空间 > Analytics

### 优化建议

1. **减少请求频率**：已内置 2 秒延迟
2. **优化 sitemap 大小**：建议单个文件 < 1MB
3. **合理设置监控数量**：建议 < 50 个 sitemap

## 🎉 部署完成

恭喜！你的 Site Bot 已经成功部署到 Cloudflare Workers。

### 下一步

1. **测试功能**：在 Telegram 中发送 `/start` 命令
2. **添加监控**：使用 `/rss add URL` 添加 sitemap
3. **查看状态**：访问 `/api/status` 查看运行状态
4. **监控日志**：使用 `wrangler tail` 查看实时日志

### 支持

如果遇到问题，请：
1. 查看本文档的故障排除部分
2. 检查 Cloudflare Workers 日志
3. 提交 Issue 到项目仓库 