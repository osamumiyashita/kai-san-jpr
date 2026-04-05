/**
 * Playwright script template: Collect all PDF links from a company's IR pages.
 * Used inside mcp__plugin_playwright_playwright__browser_run_code
 *
 * Usage: Replace SUB_PAGES with the actual company IR sub-page URLs.
 */
async (page) => {
  // === FILL IN: Company-specific IR sub-page URLs ===
  const subPages = [
    // 'https://www.example.co.jp/ir/library/financial_info/index.html',  // 決算短信
    // 'https://www.example.co.jp/ir/library/annual_report/index.html',   // 有価証券報告書
    // 'https://www.example.co.jp/ir/library/presentation/index.html',    // 決算説明資料
    // 'https://www.example.co.jp/ir/library/mtmp/index.html',            // 中期経営計画
    // 'https://www.example.co.jp/ir/news/index.html',                    // ニュース一覧
  ];

  const allLinks = [];

  for (const url of subPages) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      const links = await page.evaluate(() => {
        const anchors = document.querySelectorAll('a[href$=".pdf"]');
        return Array.from(anchors).map(a => ({
          url: a.href,
          text: a.textContent.replace(/\s+/g, ' ').trim().substring(0, 200)
        }));
      });
      allLinks.push({
        page: url.split('/').slice(-2).join('/'),
        count: links.length,
        links
      });
    } catch (e) {
      allLinks.push({ page: url, error: e.message });
    }
  }

  return JSON.stringify(allLinks, null, 2);
}
