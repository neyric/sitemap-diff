/**
 * XML 解析器
 * 用于解析 sitemap XML 文件
 * 适配 Cloudflare Workers 环境（不支持 DOMParser）
 */

/**
 * 从 sitemap XML 中提取所有 URL
 * @param xmlContent - sitemap XML 内容
 * @returns URL 列表
 */
export function extractURLs(xmlContent: string): string[] {
  try {
    const urls: string[] = [];

    // 使用正则表达式匹配 <loc> 标签中的 URL
    const locRegex = /<loc[^>]*>(.*?)<\/loc>/gi;
    let match;

    while ((match = locRegex.exec(xmlContent)) !== null) {
      const url = match[1].trim();
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        urls.push(url);
      }
    }

    return urls;
  } catch (error) {
    console.error('解析 XML 失败:', error);
    return [];
  }
}

interface UrlWithLastMod {
  url: string;
  lastmod?: string | undefined;
}

/**
 * 从 sitemap XML 中提取 URL 和最后修改时间
 * @param xmlContent - sitemap XML 内容
 * @returns URL 和修改时间列表
 */
export function extractURLsWithLastMod(xmlContent: string): UrlWithLastMod[] {
  try {
    const results: UrlWithLastMod[] = [];

    // 使用正则表达式匹配 <url> 块
    const urlBlockRegex = /<url[^>]*>(.*?)<\/url>/gis;
    let urlMatch: RegExpExecArray | null;

    while ((urlMatch = urlBlockRegex.exec(xmlContent)) !== null) {
      const urlBlock = urlMatch[1];

      // 在每个 url 块中提取 loc 和 lastmod
      const locMatch = /<loc[^>]*>(.*?)<\/loc>/i.exec(urlBlock);
      const lastmodMatch = /<lastmod[^>]*>(.*?)<\/lastmod>/i.exec(urlBlock);

      if (locMatch) {
        const url = locMatch[1].trim();
        const lastmod = lastmodMatch ? lastmodMatch[1].trim() : undefined;

        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          results.push({ url, lastmod: lastmod || undefined });
        }
      }
    }

    return results;
  } catch (error) {
    console.error('解析 XML 失败:', error);
    return [];
  }
}

/**
 * 验证 XML 是否为有效的 sitemap
 * @param xmlContent - XML 内容
 * @returns 是否为有效的 sitemap
 */
export function isValidSitemap(xmlContent: string): boolean {
  try {
    // 检查是否包含 sitemap 相关的标签
    const hasUrlset = /<urlset[^>]*>/i.test(xmlContent);
    const hasSitemapindex = /<sitemapindex[^>]*>/i.test(xmlContent);
    const hasLocTags = /<loc[^>]*>.*?<\/loc>/i.test(xmlContent);

    return (hasUrlset || hasSitemapindex) && hasLocTags;
  } catch (error) {
    console.error('验证 sitemap 失败:', error);
    return false;
  }
}