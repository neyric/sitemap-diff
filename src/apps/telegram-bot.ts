/**
 * Telegram 机器人模块
 * 对应原 Python 项目的 apps/telegram_bot.py
 * 使用 Telegram Bot API 的 HTTP 接口
 */

import { telegramConfig } from '../config.ts';
import { RSSManager } from '../services/rss-manager.ts';

interface TelegramSendOptions {
  disableWebPagePreview?: boolean;
  parse_mode?: string;
  [key: string]: any;
}

interface TelegramResponse {
  ok: boolean;
  result?: any;
  error_code?: number;
  description?: string;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramChat {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}

interface KeywordStat {
  keyword: string;
  count: number;
}

interface DomainStat {
  domain: string;
  count: number;
}

interface DomainResult {
  domain: string;
  newUrls: string[];
  totalNew: number;
}

/**
 * 发送消息到 Telegram
 * @param chatId - 聊天 ID
 * @param text - 消息文本
 * @param options - 其他选项
 * @returns API 响应
 */
export async function sendMessage(chatId: string | number, text: string, options: TelegramSendOptions = {}): Promise<TelegramResponse> {
  try {
    const url = `https://api.telegram.org/bot${telegramConfig.token}/sendMessage`;
    const data = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: options.disableWebPagePreview !== false,
      ...options
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('发送 Telegram 消息失败:', error);
    throw error;
  }
}

/**
 * 发送文档到 Telegram
 * @param chatId - 聊天 ID
 * @param document - 文档内容
 * @param filename - 文件名
 * @param caption - 说明文字
 * @returns API 响应
 */
export async function sendDocument(chatId: string | number, document: string, filename: string, caption: string = ''): Promise<TelegramResponse> {
  try {
    const url = `https://api.telegram.org/bot${telegramConfig.token}/sendDocument`;

    // 创建 FormData
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('document', new Blob([document], { type: 'application/xml' }), filename);
    if (caption) {
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('发送 Telegram 文档失败:', error);
    throw error;
  }
}

/**
 * 发送 sitemap 更新通知（优化版本）
 * @param url - sitemap URL
 * @param newUrls - 新增的 URL 列表
 * @param sitemapContent - sitemap 内容
 * @param targetChat - 目标聊天 ID
 * @param batchMode - 是否批量模式（减少通知）
 * @returns 
 */
export async function sendUpdateNotification(url: string, newUrls: string[], sitemapContent: string | null, targetChat: string | null = null, batchMode: boolean = false): Promise<void> {
  const chatId = targetChat || telegramConfig.targetChat;
  if (!chatId) {
    console.error('未配置发送目标，请检查 TELEGRAM_TARGET_CHAT 环境变量');
    return;
  }

  const domain = new URL(url).hostname;

  // 静默模式：只有在有新URL时才发送通知
  if (!newUrls || newUrls.length === 0) {
    console.log(`静默模式：${domain} 无更新，跳过通知`);
    return;
  }

  try {
    // 构造标题消息
    const headerMessage =
      `✨ <b>${domain}</b> ✨\n` +
      `------------------------------------\n` +
      `发现新增内容！ (共 ${newUrls.length} 条)\n` +
      `来源: ${url}\n`;

    // 发送 sitemap 文件
    if (sitemapContent) {
      const filename = `${domain}_sitemap_${new Date().toISOString().split('T')[0]}.xml`;
      await sendDocument(chatId, sitemapContent, filename, headerMessage);
      console.log(`已发送 sitemap 文件: ${filename} for ${url}`);
    } else {
      // 没有文件时，发送文本消息
      await sendMessage(chatId, headerMessage);
    }

    // 优化：批量模式下只发送前5个URL作为示例，避免消息轰炸
    const maxUrlsToSend = batchMode ? Math.min(5, newUrls.length) : newUrls.length;
    const urlsToSend = newUrls.slice(0, maxUrlsToSend);

    console.log(`开始发送 ${urlsToSend.length}/${newUrls.length} 个新URL for ${domain}`);

    // 批量发送URL而不是逐个发送
    if (urlsToSend.length > 0) {
      const urlMessage = `🔗 <b>新增链接 (${urlsToSend.length}/${newUrls.length})</b>\n` +
        urlsToSend.map((url, index) => `${index + 1}. ${url}`).join('\n') +
        (newUrls.length > maxUrlsToSend ? `\n\n... 还有 ${newUrls.length - maxUrlsToSend} 个链接未显示` : '');

      await sendMessage(chatId, urlMessage, { disableWebPagePreview: true });
      console.log(`已批量发送URL列表 for ${domain}`);
    }

    // 发送更新结束消息
    await new Promise(resolve => setTimeout(resolve, 500));
    const endMessage = `✨ ${domain} 更新推送完成 ✨\n------------------------------------`;
    await sendMessage(chatId, endMessage);
    console.log(`已发送更新结束消息 for ${domain}`);

  } catch (error) {
    console.error(`发送 URL 更新消息失败 for ${url}:`, error);
  }
}

/**
 * 发送8小时统一检查报告
 * @param domainResults - 按域名分组的结果
 * @param allNewUrls - 所有新增的 URL 列表
 * @param processedCount - 处理成功数量
 * @param errorCount - 处理失败数量
 * @param targetChat - 目标聊天 ID
 * @returns 
 */
export async function sendUnifiedReport(domainResults: Map<string, DomainResult>, allNewUrls: string[], processedCount: number, errorCount: number, targetChat: string | null = null): Promise<void> {
  const chatId = targetChat || telegramConfig.targetChat;
  if (!chatId) {
    console.error('未配置发送目标，请检查 TELEGRAM_TARGET_CHAT 环境变量');
    return;
  }

  try {
    const now = new Date();
    const reportTime = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // 构建报告头部
    let reportMessage = `📊 <b>8小时监控汇总报告</b>\n`;
    reportMessage += `统计日期：${reportTime}\n`;
    reportMessage += `====================================\n\n`;

    // 域名检查汇总
    reportMessage += `📈 <b>域名检查汇总</b>\n`;
    reportMessage += `检查完成：${processedCount} 个sitemap`;
    if (errorCount > 0) {
      reportMessage += `，失败：${errorCount} 个`;
    }
    reportMessage += `\n\n`;

    if (domainResults.size === 0) {
      reportMessage += `暂无新增内容\n\n`;
    } else {
      // 按新增数量排序域名
      const sortedDomains = Array.from(domainResults.values())
        .filter(domain => domain.totalNew > 0)
        .sort((a, b) => b.totalNew - a.totalNew);

      for (const domainData of sortedDomains) {
        reportMessage += `🌐 <b>${domainData.domain}</b>\n`;
        reportMessage += `新增加 ${domainData.totalNew} 个链接\n`;

        // 显示前3个链接作为示例，换行展示
        const sampleUrls = domainData.newUrls.slice(0, 3);
        reportMessage += `链接：\n`;
        sampleUrls.forEach((url, index) => {
          reportMessage += `${index + 1}. ${url}\n`;
        });
        if (domainData.newUrls.length > 3) {
          reportMessage += `...(还有${domainData.newUrls.length - 3}个)\n`;
        }
        reportMessage += `\n`;
      }
    }

    // 关键词汇总
    if (allNewUrls.length > 0) {
      const keywordStats = extractKeywordsWithCount(allNewUrls);
      reportMessage += `🏷️ <b>关键词汇总</b>\n`;

      if (keywordStats.length > 0) {
        keywordStats.slice(0, 10).forEach((stat, index) => {
          reportMessage += `${index + 1}、${stat.keyword} (${stat.count}次)\n`;
        });
      } else {
        reportMessage += `未提取到有效关键词\n`;
      }
    } else {
      reportMessage += `🏷️ <b>关键词汇总</b>\n`;
      reportMessage += `本次检查无新增内容\n`;
    }

    reportMessage += `\n====================================\n`;
    reportMessage += `📊 总计新增：${allNewUrls.length} 个链接`;

    await sendMessage(chatId, reportMessage);
    console.log('已发送8小时统一检查报告');

  } catch (error) {
    console.error('发送统一报告失败:', error);
  }
}

/**
 * 发送关键词汇总（优化版本，包含统计功能）
 * @param allNewUrls - 所有新增的 URL 列表
 * @param targetChat - 目标聊天 ID
 * @returns 
 */
export async function sendKeywordsSummary(allNewUrls: string[], targetChat: string | null = null): Promise<void> {
  const chatId = targetChat || telegramConfig.targetChat;
  if (!chatId) {
    console.error('未配置发送目标，请检查 TELEGRAM_TARGET_CHAT 环境变量');
    return;
  }

  if (!allNewUrls || allNewUrls.length === 0) {
    console.log('没有新的 URL，跳过关键词汇总');
    return;
  }

  try {
    // 提取关键词并统计出现次数
    const keywordStats = extractKeywordsWithCount(allNewUrls);
    const domainStats = extractDomainStats(allNewUrls);

    // 构建汇总消息
    const keywordText = keywordStats.length > 0
      ? keywordStats.map(stat => `${stat.keyword} (${stat.count}次)`).join(', ')
      : '无关键词';

    const domainText = domainStats.length > 0
      ? domainStats.map(stat => `${stat.domain}: ${stat.count}条`).join('\n')
      : '无域名统计';

    const summaryMessage =
      `📊 <b>关键词汇总</b>\n` +
      `====================================\n` +
      `📈 总计新增: ${allNewUrls.length} 条\n\n` +
      `🏷️ <b>热门关键词</b> (前10个):\n${keywordText}\n\n` +
      `🌐 <b>域名分布</b>:\n${domainText}\n` +
      `====================================\n` +
      `⏰ 时间: ${new Date().toLocaleString('zh-CN')}`;

    await sendMessage(String(chatId), summaryMessage);
    console.log('已发送关键词汇总');

  } catch (error) {
    console.error('发送关键词汇总失败:', error);
  }
}

/**
 * 提取关键词并统计出现次数
 * @param urls - URL 列表
 * @returns 关键词统计列表
 */
function extractKeywordsWithCount(urls: string[]): KeywordStat[] {
  const keywordCounts = new Map<string, number>();

  for (const url of urls) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      // 改进的关键词提取逻辑
      const segments = path.split('/').filter(segment => segment.length > 2);
      for (const segment of segments) {
        // 更智能的过滤条件
        if (segment.length > 2 &&
          !segment.match(/^\d+$/) && // 不是纯数字
          !segment.includes('.') && // 不包含文件扩展名
          !segment.match(/^(index|page|post|article|news|blog)$/i)) { // 排除常见无意义词

          // 处理带连字符的词
          const cleanSegment = segment.replace(/-/g, '').toLowerCase();
          if (cleanSegment.length > 2) {
            keywordCounts.set(cleanSegment, (keywordCounts.get(cleanSegment) || 0) + 1);
          }
        }
      }
    } catch (error) {
      // 忽略无效 URL
    }
  }

  // 按出现次数排序，返回前10个
  return Array.from(keywordCounts.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

/**
 * 统计域名分布
 * @param urls - URL 列表
 * @returns 域名统计列表
 */
function extractDomainStats(urls: string[]): DomainStat[] {
  const domainCounts = new Map<string, number>();

  for (const url of urls) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    } catch (error) {
      // 忽略无效 URL
    }
  }

  // 按出现次数排序
  return Array.from(domainCounts.entries())
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 提取关键词（简化版本，保持向后兼容）
 * @param urls - URL 列表
 * @returns 关键词列表
 */
function extractKeywords(urls: string[]): string[] {
  const stats = extractKeywordsWithCount(urls);
  return stats.map(stat => stat.keyword);
}

/**
 * 处理 Telegram Webhook 更新
 * @param update - Telegram 更新对象
 * @param rssManager - RSS 管理器实例
 * @returns 响应对象
 */
export async function handleTelegramUpdate(update: TelegramUpdate, rssManager: RSSManager): Promise<{ success: boolean; error?: string }> {
  try {
    if (!update.message || !update.message.text) {
      return { success: true };
    }

    const message = update.message;
    const text = message.text?.trim();
    if (!text) {
      return { success: true };
    }
    const chatId = message.chat.id;

    console.log(`收到 Telegram 消息: ${text} from ${message.from.username || message.from.id}`);

    // 处理命令
    if (text.startsWith('/')) {
      const parts = text.split(' ');
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);

      switch (command) {
        case '/start':
        case '/help':
          await sendMessage(chatId,
            `Hello, ${message.from.first_name || 'User'}!\n\n` +
            `这是一个站点监控机器人，支持以下命令：\n` +
            `/rss list - 显示所有监控的sitemap\n` +
            `/rss add URL - 添加sitemap监控\n` +
            `/rss del URL - 删除sitemap监控\n` +
            `/news - 手动触发关键词汇总`
          );
          break;

        case '/rss':
          await handleRSSCommand(chatId, args, rssManager);
          break;

        case '/news':
          await handleNewsCommand(chatId, rssManager);
          break;

        default:
          await sendMessage(chatId, '未知命令，请使用 /help 查看帮助');
      }
    }

    return { success: true };
  } catch (error) {
    console.error('处理 Telegram 更新失败:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 处理 RSS 命令
 * @param chatId - 聊天 ID
 * @param args - 命令参数
 * @param rssManager - RSS 管理器实例
 * @returns 
 */
async function handleRSSCommand(chatId: string | number, args: string[], rssManager: RSSManager): Promise<void> {
  if (args.length === 0) {
    await sendMessage(chatId,
      '请使用以下命令：\n' +
      '/rss list - 显示所有监控的sitemap\n' +
      '/rss add URL - 添加sitemap监控（URL必须以sitemap.xml结尾）\n' +
      '/rss del URL - 删除sitemap监控'
    );
    return;
  }

  const cmd = args[0].toLowerCase();

  switch (cmd) {
    case 'list':
      const feeds = await rssManager.getFeeds();
      if (feeds.length === 0) {
        await sendMessage(chatId, '当前没有RSS订阅');
        return;
      }

      const feedList = feeds.map(feed => `- ${feed}`).join('\n');
      await sendMessage(chatId, `当前RSS订阅总数${feeds.length}个,列表：\n${feedList}`);
      break;

    case 'add':
      if (args.length < 2) {
        await sendMessage(chatId,
          '请提供sitemap.xml的URL\n例如：/rss add https://example.com/sitemap.xml'
        );
        return;
      }

      const url = args[1];
      if (!url.toLowerCase().includes('sitemap')) {
        await sendMessage(chatId, 'URL必须包含sitemap关键词');
        return;
      }

      const result = await rssManager.addFeed(url);
      if (result.success) {
        await sendMessage(chatId, `成功添加sitemap监控：${url}`);
        await sendUpdateNotification(url, result.newUrls || [], null, String(chatId));
      } else {
        await sendMessage(chatId, `添加sitemap监控失败：${url}\n原因：${result.errorMsg}`);
      }
      break;

    case 'del':
      if (args.length < 2) {
        await sendMessage(chatId,
          '请提供要删除的RSS订阅链接\n例如：/rss del https://example.com/feed.xml'
        );
        return;
      }

      const delUrl = args[1];
      const delResult = await rssManager.removeFeed(delUrl);
      if (delResult.success) {
        await sendMessage(chatId, `成功删除RSS订阅：${delUrl}`);
      } else {
        await sendMessage(chatId, `删除RSS订阅失败：${delUrl}\n原因：${delResult.errorMsg}`);
      }
      break;

    default:
      await sendMessage(chatId, '未知的RSS命令，请使用 /rss 查看帮助');
  }
}

/**
 * 处理新闻命令（使用统一报告格式）
 * @param chatId - 聊天 ID
 * @param rssManager - RSS 管理器实例
 * @returns 
 */
async function handleNewsCommand(chatId: string | number, rssManager: RSSManager): Promise<void> {
  try {
    const feeds = await rssManager.getFeeds();
    if (feeds.length === 0) {
      await sendMessage(chatId, '当前没有监控的sitemap');
      return;
    }

    await sendMessage(chatId, '开始手动触发统一检查...');

    // 用于存储所有结果
    const domainResults = new Map<string, DomainResult>(); // 按域名分组的结果
    const allNewUrls: string[] = [];
    let processedCount = 0;
    let errorCount = 0;

    for (const url of feeds) {
      try {
        console.log(`手动检查 sitemap: ${url}`);

        // 强制下载sitemap，绕过今日更新检查
        const result = await rssManager.downloadSitemap(url, true);
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

            console.log(`发现 ${result.newUrls.length} 个新URL from ${domain}`);
          }
        }
      } catch (error) {
        errorCount++;
        console.error(`处理 sitemap 失败: ${url}`, error);
      }
    }

    // 发送统一汇总报告
    await sendUnifiedReport(domainResults, allNewUrls, processedCount, errorCount, String(chatId));

  } catch (error) {
    console.error('处理新闻命令失败:', error);
    await sendMessage(chatId, '处理新闻命令失败，请稍后重试');
  }
} 