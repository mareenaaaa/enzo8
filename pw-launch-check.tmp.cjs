const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.goto('about:blank');
  console.log('ok');
  await browser.close();
})();