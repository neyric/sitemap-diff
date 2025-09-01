/**
 * Cloudflare Workers 主入口文件
 * 基于 Hono 框架重构
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initConfig, validateConfig } from './config.ts';
import { RSSManager } from './services/rss-manager.ts';
import {
  sendUpdateNotification,
  sendKeywordsSummary,
  sendUnifiedReport,
  handleTelegramUpdate
} from './apps/telegram-bot.ts';
import { handleDiscordInteraction } from './apps/discord-bot.ts';

interface DomainResult {
  domain: string;
  newUrls: string[];
  totalNew: number;
}

// 全局变量
let rssManager: RSSManager | null = null;

// 创建 Hono 应用实例
const app = new Hono();

// 添加日志中间件
app.use('*', logger());

// 添加 CORS 中间件
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}));

/**
 * 初始化应用
 * @param env - 环境变量
 */
function initializeApp(env: any, strict: boolean = false): void {
  console.log('🚀 初始化 Site Bot...');

  // 初始化配置
  initConfig(env);

  // 验证配置
  const validation = validateConfig(strict);
  if (!validation.isValid) {
    console.error('❌ 配置验证失败:', validation.errors);
    throw new Error(`配置错误: ${validation.errors.join(', ')}`);
  }

  // 初始化 RSS 管理器
  if (env.SITEMAP_STORAGE) {
    rssManager = new RSSManager(env.SITEMAP_STORAGE);
    console.log('✅ RSS 管理器初始化成功');
  } else {
    console.warn('⚠️ 未配置 KV 存储，某些功能可能不可用');
  }

  console.log('✅ Site Bot 初始化完成');
}

// 初始化中间件
app.use('*', async (c, next) => {
  const env = c.env;
  
  // 确保应用已初始化
  if (!rssManager) {
    try {
      initializeApp(env);
    } catch (error) {
      return c.json({
        error: 'Initialization Failed',
        message: error instanceof Error ? error.message : String(error)
      }, 500);
    }
  }

  return await next();
});

// 全局错误处理中间件
app.onError((err, c) => {
  console.error('Hono 错误处理:', err);
  
  return c.json({
    error: 'Internal Server Error',
    message: err.message || '服务器内部错误',
    timestamp: new Date().toISOString()
  }, 500);
});

// 404 处理
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: '未找到请求的资源',
    path: c.req.path,
    method: c.req.method,
    timestamp: new Date().toISOString()
  }, 404);
});

// 健康检查路由
app.get('/health', async (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'site-bot',
    version: '1.0.0'
  });
});

// 手动触发监控
app.post('/monitor', async (c) => {
  const env = c.env;
  c.executionCtx.waitUntil(performScheduledMonitoring(env));
  
  return c.json({
    status: 'success',
    message: '监控任务已启动',
    timestamp: new Date().toISOString()
  });
});

// Telegram Webhook
app.post('/webhook/telegram', async (c) => {
  // 对 webhook 端点进行严格配置检查
  const validation = validateConfig(true);
  if (!validation.isValid) {
    return c.json({
      error: 'Configuration Error',
      message: `配置错误: ${validation.errors.join(', ')}`
    }, 500);
  }

  const update = await c.req.json();
  const result = await handleTelegramUpdate(update as any, rssManager!);
  
  return c.json(result);
});

// Discord Webhook  
app.post('/webhook/discord', async (c) => {
  // 对 webhook 端点进行严格配置检查
  const validation = validateConfig(true);
  if (!validation.isValid) {
    return c.json({
      error: 'Configuration Error',
      message: `配置错误: ${validation.errors.join(', ')}`
    }, 500);
  }

  const interaction = await c.req.json();
  const result = await handleDiscordInteraction(interaction as any, rssManager!);
  
  return c.json(result);
});

// API 状态
app.get('/api/status', async (c) => {
  const feeds: string[] = rssManager ? await rssManager.getFeeds() : [];
  
  return c.json({
    status: 'running',
    feeds: feeds,
    timestamp: new Date().toISOString()
  });
});

// 根路径 - API 文档
app.get('/', async (c) => {
  return c.json({
    message: 'Site Bot API',
    endpoints: [
      '/health - 健康检查',
      'POST /monitor - 手动触发监控',
      'POST /webhook/telegram - Telegram Webhook',
      'POST /webhook/discord - Discord Webhook',
      '/api/status - API 状态'
    ],
    timestamp: new Date().toISOString()
  });
});

/**
 * 执行定时监控任务（8小时统一检查版本）
 * @param env - 环境变量
 */
async function performScheduledMonitoring(env: any): Promise<void> {
  try {
    console.log('⏰ 开始执行8小时统一监控任务...');

    if (!rssManager) {
      console.error('❌ RSS 管理器未初始化');
      return;
    }

    const feeds = await rssManager.getFeeds();
    console.log(`📊 总共 ${feeds.length} 个订阅源`);

    if (feeds.length === 0) {
      console.log('📭 没有配置的订阅源');
      return;
    }

    // 用于存储所有结果
    const domainResults = new Map<string, DomainResult>(); // 按域名分组的结果
    const allNewUrls: string[] = [];
    let processedCount = 0;
    let errorCount = 0;

    console.log('🔍 开始检查所有sitemap...');

    // 一次性处理所有sitemap
    for (let i = 0; i < feeds.length; i++) {
      const url = feeds[i];
      try {
        console.log(`🔍 正在检查订阅源 [${i + 1}/${feeds.length}]: ${url}`);

        const result = await rssManager.addFeed(url);
        processedCount++;

        if (result.success) {
          const domain = new URL(url).hostname;

          // 按域名分组统计
          if (!domainResults.has(domain)) {
            domainResults.set(domain, {
              domain: domain,
              newUrls: [],
              totalNew: 0
            });
          }

          if (result.newUrls && result.newUrls.length > 0) {
            const domainData = domainResults.get(domain)!;
            domainData.newUrls.push(...result.newUrls);
            domainData.totalNew += result.newUrls.length;
            allNewUrls.push(...result.newUrls);

            console.log(`✨ 域名 ${domain} 发现 ${result.newUrls.length} 个新URL`);
          } else {
            console.log(`✅ 域名 ${domain} 无新增URL`);
          }
        } else {
          errorCount++;
          console.warn(`⚠️ 订阅源 ${url} 更新失败: ${result.errorMsg}`);
        }

        // 适当延迟避免过载
        if (i < feeds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }

      } catch (error) {
        errorCount++;
        console.error(`❌ 检查订阅源失败: ${url}`, error);
      }
    }

    console.log(`📊 检查完成: 处理 ${processedCount} 个，失败 ${errorCount} 个，总计新增 ${allNewUrls.length} 个URL`);

    // 发送统一汇总报告
    await sendUnifiedReport(domainResults, allNewUrls, processedCount, errorCount);

    console.log('✅ 8小时统一监控任务完成');

  } catch (error) {
    console.error('❌ 定时监控任务失败:', error);
  }
}

// Cloudflare Workers 事件处理器
export default {
  // 处理 HTTP 请求 - 使用 Hono
  async fetch(request: Request, env: any, ctx: any) {
    return app.fetch(request, env, ctx);
  },

  // 定时任务触发器
  async scheduled(event: any, env: any, ctx: any) {
    console.log('⏰ 收到定时任务触发');

    // 确保应用已初始化
    if (!rssManager) {
      try {
        initializeApp(env);
      } catch (error) {
        console.error('❌ 初始化失败:', error);
        return;
      }
    }

    // 执行监控任务
    ctx.waitUntil(performScheduledMonitoring(env));
  }
}; 