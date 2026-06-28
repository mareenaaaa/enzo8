const { chromium } = require('@playwright/test');

function parseScale(transform) {
  if (!transform || transform === 'none') return 1;
  const m2 = transform.match(/matrix\(([^)]+)\)/);
  if (m2) {
    const p = m2[1].split(',').map((v) => Number(v.trim()));
    return Math.sqrt((p[0] || 1) ** 2 + (p[1] || 0) ** 2);
  }
  const m3 = transform.match(/matrix3d\(([^)]+)\)/);
  if (m3) {
    const p = m3[1].split(',').map((v) => Number(v.trim()));
    return Math.sqrt((p[0] || 1) ** 2 + (p[1] || 0) ** 2);
  }
  return null;
}

async function startTransition(pageId, page) {
  await page.evaluate(async (target) => {
    startVideoTransition(target);
  }, pageId);
}

async function sample(page, duration = 4200, step = 90) {
  const rows = [];
  const start = Date.now();
  while (Date.now() - start < duration) {
    rows.push(await page.evaluate(({ parseScaleSrc }) => {
      const parseScale = new Function(`return (${parseScaleSrc})`)();
      const bg = document.querySelector('#bg-video');
      const sIntro = document.querySelector('#services-bg-video');
      const sLoop = document.querySelector('#services-loop-video');
      const hero = document.querySelector('#hero-ui');
      const contact = document.querySelector('#contact-section');
      const services = document.querySelector('#services-section');
      const bgStyle = bg ? getComputedStyle(bg) : null;
      const sIntroStyle = sIntro ? getComputedStyle(sIntro) : null;
      const sLoopStyle = sLoop ? getComputedStyle(sLoop) : null;
      return {
        now: Math.round(performance.now()),
        state: typeof state === 'string' ? state : '',
        bgSrc: bg?.currentSrc?.split('/').slice(-1)[0] || '',
        bgTime: bg ? Number(bg.currentTime.toFixed(3)) : null,
        bgOpacity: bgStyle ? Number(bgStyle.opacity).toFixed(2) : null,
        bgScale: bgStyle ? Number((parseScale(bgStyle.transform) || 0).toFixed(3)) : null,
        bgVisibility: bgStyle?.visibility || null,
        servicesIntroOpacity: sIntroStyle ? Number(sIntroStyle.opacity).toFixed(2) : null,
        servicesIntroScale: sIntroStyle ? Number((parseScale(sIntroStyle.transform) || 0).toFixed(3)) : null,
        servicesLoopOpacity: sLoopStyle ? Number(sLoopStyle.opacity).toFixed(2) : null,
        heroOpacity: hero ? Number(getComputedStyle(hero).opacity).toFixed(2) : null,
        contactActive: !!contact?.classList.contains('active'),
        servicesActive: !!services?.classList.contains('active')
      };
    }, { parseScaleSrc: parseScale.toString() }));
    await page.waitForTimeout(step);
  }
  return rows;
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);

  await startTransition('contact', page);
  await page.waitForTimeout(4200);
  await page.screenshot({ path: 'C:/tmp/contact-stable-mobile.png' });

  await page.locator('#mobile-brand-home').click({ force: true });
  const homeRows = await sample(page);
  await page.screenshot({ path: 'C:/tmp/contact-to-home-end-mobile.png' });

  await page.waitForTimeout(2200);
  await startTransition('contact', page);
  await page.waitForTimeout(4200);

  await startTransition('services', page);
  const serviceRows = await sample(page);
  await page.screenshot({ path: 'C:/tmp/contact-to-services-end-mobile.png' });

  console.log(JSON.stringify({ homeRows, serviceRows }, null, 2));
  await browser.close();
})();
