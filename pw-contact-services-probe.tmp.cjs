const { chromium } = require('@playwright/test');

function parseScale(transform) {
  if (!transform || transform === 'none') return 1;
  const m2 = transform.match(/matrix\(([^)]+)\)/);
  if (m2) {
    const p = m2[1].split(',').map(v => Number(v.trim()));
    return Math.sqrt((p[0] || 1) ** 2 + (p[1] || 0) ** 2);
  }
  const m3 = transform.match(/matrix3d\(([^)]+)\)/);
  if (m3) {
    const p = m3[1].split(',').map(v => Number(v.trim()));
    return Math.sqrt((p[0] || 1) ** 2 + (p[1] || 0) ** 2);
  }
  return null;
}

async function openMenuAndClick(page, label) {
  await page.locator('#mobile-hamburger').click({ force: true });
  await page.waitForTimeout(180);
  await page.locator('#mobile-nav-overlay .mobile-nav-item', { hasText: label }).click({ force: true });
}

async function sample(page, name, duration = 4200, step = 90) {
  const rows = [];
  const start = Date.now();
  while (Date.now() - start < duration) {
    rows.push(await page.evaluate(({ name, parseScaleSrc }) => {
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
        name,
        now: Math.round(performance.now()),
        bgSrc: bg?.currentSrc?.split('/').slice(-1)[0] || '',
        bgTime: bg ? Number(bg.currentTime.toFixed(3)) : null,
        bgOpacity: bgStyle ? Number(bgStyle.opacity).toFixed(2) : null,
        bgScale: bgStyle ? Number((parseScale(bgStyle.transform) || 0).toFixed(3)) : null,
        bgObj: bgStyle?.objectPosition || null,
        servicesIntroOpacity: sIntroStyle ? Number(sIntroStyle.opacity).toFixed(2) : null,
        servicesIntroScale: sIntroStyle ? Number((parseScale(sIntroStyle.transform) || 0).toFixed(3)) : null,
        servicesLoopOpacity: sLoopStyle ? Number(sLoopStyle.opacity).toFixed(2) : null,
        heroOpacity: hero ? Number(getComputedStyle(hero).opacity).toFixed(2) : null,
        contactActive: !!contact?.classList.contains('active'),
        servicesActive: !!services?.classList.contains('active')
      };
    }, { name, parseScaleSrc: parseScale.toString() }));
    await page.waitForTimeout(step);
  }
  return rows;
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);

  await openMenuAndClick(page, 'Contact');
  await page.waitForTimeout(4600);
  const contactToHome = (async () => {
    await page.locator('#mobile-brand-home').click({ force: true });
    return await sample(page, 'contact-to-home');
  })();
  const homeRows = await contactToHome;

  await page.waitForTimeout(2200);
  await openMenuAndClick(page, 'Contact');
  await page.waitForTimeout(4600);
  const contactToServices = (async () => {
    await openMenuAndClick(page, 'Services');
    return await sample(page, 'contact-to-services');
  })();
  const serviceRows = await contactToServices;

  console.log(JSON.stringify({ homeRows, serviceRows }, null, 2));
  await browser.close();
})();