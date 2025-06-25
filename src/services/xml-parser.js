/**
 * XML 解析器
 * 用于解析 sitemap XML 文件
 */

/**
 * 解析 XML 字符串
 * @param {string} xmlString - XML 字符串
 * @returns {Document} DOM 文档对象
 */
export function parseXML(xmlString) {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
}

/**
 * 从 sitemap XML 中提取所有 URL
 * @param {string} xmlContent - sitemap XML 内容
 * @returns {string[]} URL 列表
 */
export function extractURLs(xmlContent) {
  try {
    const doc = parseXML(xmlContent);
    const urls = [];

    // 查找所有 <loc> 标签
    const locElements = doc.querySelectorAll('loc');

    for (const element of locElements) {
      const url = element.textContent.trim();
      if (url) {
        urls.push(url);
      }
    }

    return urls;
  } catch (error) {
    console.error('解析 XML 失败:', error);
    return [];
  }
}

/**
 * 从 sitemap XML 中提取 URL 和最后修改时间
 * @param {string} xmlContent - sitemap XML 内容
 * @returns {Array<{url: string, lastmod?: string}>} URL 和修改时间列表
 */
export function extractURLsWithLastMod(xmlContent) {
  try {
    const doc = parseXML(xmlContent);
    const results = [];

    // 查找所有 <url> 标签
    const urlElements = doc.querySelectorAll('url');

    for (const urlElement of urlElements) {
      const locElement = urlElement.querySelector('loc');
      const lastmodElement = urlElement.querySelector('lastmod');

      if (locElement) {
        const url = locElement.textContent.trim();
        const lastmod = lastmodElement ? lastmodElement.textContent.trim() : undefined;

        if (url) {
          results.push({ url, lastmod });
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
 * @param {string} xmlContent - XML 内容
 * @returns {boolean} 是否为有效的 sitemap
 */
export function isValidSitemap(xmlContent) {
  try {
    const doc = parseXML(xmlContent);

    // 检查根元素是否为 urlset
    const rootElement = doc.documentElement;
    if (!rootElement || rootElement.tagName !== 'urlset') {
      return false;
    }

    // 检查是否包含 sitemap 命名空间
    const namespace = rootElement.getAttribute('xmlns');
    if (!namespace || !namespace.includes('sitemaps.org')) {
      return false;
    }

    // 检查是否至少有一个 url 元素
    const urlElements = doc.querySelectorAll('url');
    return urlElements.length > 0;

  } catch (error) {
    console.error('验证 sitemap 失败:', error);
    return false;
  }
} 