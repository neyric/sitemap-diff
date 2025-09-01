/**
 * RSS 管理器
 * 对应原 Python 项目的 services/rss/manager.py
 * 使用 Cloudflare KV 存储替代文件系统
 */

import { extractURLs } from "./xml-parser.ts";

interface DownloadResult {
  success: boolean;
  errorMsg: string;
  datedFile: string | null;
  newUrls: string[];
}

interface AddFeedResult {
  success: boolean;
  errorMsg: string;
  datedFile?: string | null;
  newUrls?: string[];
}

interface RemoveFeedResult {
  success: boolean;
  errorMsg: string;
}

export class RSSManager {
  private kv: KVNamespace;
  private feedsKey: string;

  constructor(kvStorage: KVNamespace) {
    this.kv = kvStorage;
    this.feedsKey = "rss_feeds";
  }

  /**
   * 获取所有监控的 feeds
   * @returns feeds 列表
   */
  async getFeeds(): Promise<string[]> {
    try {
      const feedsJson = await this.kv.get(this.feedsKey);
      return feedsJson ? JSON.parse(feedsJson) : [];
    } catch (error) {
      console.error("读取 feeds 失败:", error);
      return [];
    }
  }

  /**
   * 下载并保存 sitemap 文件
   * @param url - sitemap 的 URL
   * @param forceDownload - 是否强制下载，忽略今日更新检查
   * @returns 结果对象
   */
  async downloadSitemap(
    url: string,
    forceDownload: boolean = false
  ): Promise<DownloadResult> {
    try {
      console.log(`尝试下载 sitemap: ${url}`);

      const domain = new URL(url).hostname;
      const today = new Date().toISOString().split("T")[0].replace(/-/g, "");

      // 检查今天是否已经更新过（除非强制下载）
      const lastUpdateKey = `last_update_${domain}`;
      const lastUpdate = await this.kv.get(lastUpdateKey);

      if (!forceDownload && lastUpdate === today) {
        // 今天已经更新过，比较现有文件
        const currentContent = await this.kv.get(`sitemap_current_${domain}`);
        const latestContent = await this.kv.get(`sitemap_latest_${domain}`);

        if (currentContent && latestContent) {
          const newUrls = this.compareSitemaps(currentContent, latestContent);
          return {
            success: true,
            errorMsg: "今天已经更新过此sitemap, 但没发送",
            datedFile: null,
            newUrls,
          };
        }

        return {
          success: true,
          errorMsg: "今天已经更新过此sitemap",
          datedFile: null,
          newUrls: [],
        };
      }

      // 下载新文件
      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      };

      const response = await fetch(url, {
        method: "GET",
        headers,
        cf: { cacheTtl: 300 }, // 缓存5分钟
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let newContent: string;
      if (url.endsWith(".gz")) {
        console.log(`解压 gzipped sitemap: ${url}`);
        if (!response.body) {
          throw new Error("Response body is null, cannot decompress.");
        }
        const decompressionStream = new DecompressionStream("gzip");
        const decompressedStream =
          response.body.pipeThrough(decompressionStream);
        newContent = await new Response(decompressedStream).text();
      } else {
        newContent = await response.text();
      }

      let newUrls: string[] = [];

      // 如果存在 current 文件，比较差异
      const currentContent = await this.kv.get(`sitemap_current_${domain}`);
      if (currentContent) {
        newUrls = this.compareSitemaps(newContent, currentContent);
        // 将 current 移动到 latest
        await this.kv.put(`sitemap_latest_${domain}`, currentContent);
      }

      // 保存新文件
      await this.kv.put(`sitemap_current_${domain}`, newContent);
      await this.kv.put(`sitemap_dated_${domain}_${today}`, newContent);

      // 更新最后更新日期
      await this.kv.put(lastUpdateKey, today);

      console.log(`sitemap 已保存到 KV: ${domain}`);
      return {
        success: true,
        errorMsg: "",
        datedFile: `sitemap_dated_${domain}_${today}`,
        newUrls,
      };
    } catch (error) {
      console.error(`下载 sitemap 失败: ${url}`, error);
      return {
        success: false,
        errorMsg: `下载失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
        datedFile: null,
        newUrls: [],
      };
    }
  }

  /**
   * 添加 sitemap 监控
   * @param url - sitemap 的 URL
   * @returns 结果对象
   */
  async addFeed(url: string): Promise<AddFeedResult> {
    try {
      console.log(`尝试添加 sitemap 监控: ${url}`);

      // 验证是否已存在
      const feeds = await this.getFeeds();
      if (!feeds.includes(url)) {
        // 如果是新的 feed，先尝试下载
        const result = await this.downloadSitemap(url);
        if (!result.success) {
          return result;
        }

        // 添加到监控列表
        feeds.push(url);
        await this.kv.put(this.feedsKey, JSON.stringify(feeds));
        console.log(`成功添加 sitemap 监控: ${url}`);
        return {
          ...result,
          errorMsg: result.errorMsg || "成功添加",
        };
      } else {
        // 如果 feed 已存在，仍然尝试下载（可能是新的一天）
        const result = await this.downloadSitemap(url);
        if (!result.success) {
          return result;
        }
        return {
          ...result,
          errorMsg: "已存在的feed更新成功",
        };
      }
    } catch (error) {
      console.error(`添加 sitemap 监控失败: ${url}`, error);
      return {
        success: false,
        errorMsg: `添加失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
        datedFile: null,
        newUrls: [],
      };
    }
  }

  /**
   * 删除 RSS 订阅
   * @param url - RSS 订阅链接
   * @returns 结果对象
   */
  async removeFeed(url: string): Promise<RemoveFeedResult> {
    try {
      console.log(`尝试删除 RSS 订阅: ${url}`);
      const feeds = await this.getFeeds();

      if (!feeds.includes(url)) {
        console.warn(`RSS 订阅不存在: ${url}`);
        return {
          success: false,
          errorMsg: "该RSS订阅不存在",
        };
      }

      feeds.splice(feeds.indexOf(url), 1);
      await this.kv.put(this.feedsKey, JSON.stringify(feeds));
      console.log(`成功删除 RSS 订阅: ${url}`);
      return {
        success: true,
        errorMsg: "",
      };
    } catch (error) {
      console.error(`删除 RSS 订阅失败: ${url}`, error);
      return {
        success: false,
        errorMsg: `删除失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * 比较新旧 sitemap，返回新增的 URL 列表
   * @param currentContent - 当前 sitemap 内容
   * @param oldContent - 旧的 sitemap 内容
   * @returns 新增的 URL 列表
   */
  compareSitemaps(currentContent: string, oldContent: string): string[] {
    try {
      const currentUrls = extractURLs(currentContent);
      const oldUrls = extractURLs(oldContent);

      const newUrls = currentUrls.filter((url) => !oldUrls.includes(url));
      console.log(`发现 ${newUrls.length} 个新 URL`);
      return newUrls;
    } catch (error) {
      console.error(`比较 sitemap 失败:`, error);
      return [];
    }
  }

  /**
   * 获取 sitemap 内容
   * @param domain - 域名
   * @param type - 类型 (current, latest, dated)
   * @param date - 日期 (可选，用于 dated 类型)
   * @returns sitemap 内容
   */
  async getSitemapContent(
    domain: string,
    type: "current" | "latest" | "dated" = "current",
    date: string | null = null
  ): Promise<string | null> {
    try {
      let key: string;
      switch (type) {
        case "current":
          key = `sitemap_current_${domain}`;
          break;
        case "latest":
          key = `sitemap_latest_${domain}`;
          break;
        case "dated":
          if (!date) {
            date = new Date().toISOString().split("T")[0].replace(/-/g, "");
          }
          key = `sitemap_dated_${domain}_${date}`;
          break;
        default:
          throw new Error(`未知的 sitemap 类型: ${type}`);
      }

      return await this.kv.get(key);
    } catch (error) {
      console.error(`获取 sitemap 内容失败:`, error);
      return null;
    }
  }
}
