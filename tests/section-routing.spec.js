const { test, chromium, expect } = require('@playwright/test');
const fs = require('fs');
const http = require('http');
const path = require('path');

const gsapPath = require.resolve('gsap/dist/gsap.min.js');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime'
};

function startStaticServer(root) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = path.normalize(path.join(root, pathname));
    const relative = path.relative(root, filePath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      const range = req.headers.range;

      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        const start = match && match[1] ? Number(match[1]) : 0;
        const end = match && match[2] ? Number(match[2]) : stat.size - 1;

        if (!match || start > end || end >= stat.size) {
          res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
          res.end();
          return;
        }

        res.writeHead(206, {
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Content-Type': contentType
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }

      res.writeHead(200, {
        'Accept-Ranges': 'bytes',
        'Content-Length': stat.size,
        'Content-Type': contentType
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function installLocalRoutes(page) {
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js', route =>
    route.fulfill({
      path: gsapPath,
      contentType: 'application/javascript'
    })
  );

  await page.route('https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.js', route =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'window.LocomotiveScroll=class{constructor(){this.el=null}update(){}stop(){}start(){}scrollTo(){}};'
    })
  );

  await page.route('https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js', route =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'window.emailjs={init(){},sendForm(){return Promise.resolve({status:200})}};'
    })
  );

  await page.route('https://fonts.googleapis.com/**', route =>
    route.fulfill({ contentType: 'text/css', body: '' })
  );
  await page.route('https://fonts.gstatic.com/**', route => route.fulfill({ body: '' }));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/**', route =>
    route.fulfill({ contentType: 'text/css', body: '' })
  );
  await page.route('https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.css', route =>
    route.fulfill({ contentType: 'text/css', body: '' })
  );
}

async function captureState(page) {
  return page.evaluate(() => {
    const video = document.getElementById('bg-video');
    const ids = ['about-section', 'services-section', 'contact-section', 'portfolios-section'];
    const sections = Object.fromEntries(ids.map(id => {
      const el = document.getElementById(id);
      const style = el ? getComputedStyle(el) : null;
      return [id, style ? {
        active: el.classList.contains('active'),
        opacity: style.opacity,
        visibility: style.visibility
      } : null];
    }));

    return {
      bodyClass: document.body.className,
      videoSrc: video?.currentSrc || '',
      videoOpacity: getComputedStyle(video).opacity,
      videoTransform: getComputedStyle(video).transform,
      centerNavOpacity: getComputedStyle(document.getElementById('center-nav')).opacity,
      staticLogoOverlayExists: Boolean(document.getElementById('stabilized-logo')),
      activeSections: [...document.querySelectorAll('.scroll-section.active')].map(el => el.id),
      sections
    };
  });
}

async function setupPage() {
  const app = await startStaticServer(process.cwd());
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: 'videos-routing/',
      size: { width: 1440, height: 900 }
    }
  });
  const page = await context.newPage();
  await installLocalRoutes(page);

  const events = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || /prevented|failed|error/i.test(msg.text())) {
      events.push(`[console:${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => events.push(`[pageerror] ${err.message}`));
  page.on('requestfailed', req => events.push(`[requestfailed] ${req.url()} ${req.failure()?.errorText}`));

  return { app, browser, context, page, events };
}

async function closePage(env) {
  await env.context.close();
  await env.browser.close();
  env.app.server.close();
}

async function bootHome(page) {
  await page.goto(page._appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6200);
}

async function clickMainNav(page, targetId) {
  await page.click(`.nav-item[data-target="${targetId}"]`);
}

async function clickSectionNav(page, sectionId, targetId) {
  await page.evaluate(({ sectionId, targetId }) => {
    document.querySelector(`#${sectionId} .nav-link[data-target="${targetId}"]`)?.click();
  }, { sectionId, targetId });
}

async function clickSectionHome(page, sectionId) {
  await page.evaluate(sectionId => {
    document.querySelector(`#${sectionId} .brand-home-trigger`)?.click();
  }, sectionId);
}

async function waitForActiveSection(page, sectionId, timeout = 12000) {
  await page.waitForFunction(id => {
    const el = document.getElementById(id);
    return el && el.classList.contains('active') && getComputedStyle(el).visibility !== 'hidden';
  }, sectionId, { timeout });
}

async function waitForHome(page, timeout = 12000) {
  await page.waitForFunction(() => {
    const active = [...document.querySelectorAll('.scroll-section.active')];
    const navOpacity = Number(getComputedStyle(document.getElementById('center-nav')).opacity);
    return active.length === 0 && navOpacity > 0.9 && document.body.classList.contains('hero-nav-ready');
  }, null, { timeout });
}

async function runFlow(name, steps) {
  const qaDir = path.join(process.cwd(), 'output', 'section-routing', name);
  fs.mkdirSync(qaDir, { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), 'videos-routing'), { recursive: true });

  const env = await setupPage();
  env.page._appUrl = env.app.url;
  const states = {};

  try {
    await bootHome(env.page);
    states.home = await captureState(env.page);
    await env.page.screenshot({ path: path.join(qaDir, '01-home.png'), fullPage: true });

    await steps(env.page, states, qaDir);

    fs.writeFileSync(path.join(qaDir, 'qa-state.json'), JSON.stringify({ states, events: env.events }, null, 2));
  } finally {
    await closePage(env);
  }
}

test('services contact routes through home logo state', async () => {
  await runFlow('services-contact', async (page, states, qaDir) => {
    await clickMainNav(page, 'services-section');
    await page.waitForTimeout(4800);
    states.services = await captureState(page);

    await clickSectionNav(page, 'services-section', 'contact-section');
    await page.waitForTimeout(1100);
    states.viaHome = await captureState(page);
    await page.screenshot({ path: path.join(qaDir, '02-via-home.png'), fullPage: true });

    expect(states.viaHome.videoSrc).toContain('horizontal%20utility%20home%20reverse.mp4');
    expect(states.viaHome.videoSrc).not.toContain('contact%20horizontal');

    await waitForActiveSection(page, 'contact-section');
    await page.waitForTimeout(700);
    states.contact = await captureState(page);
    await page.screenshot({ path: path.join(qaDir, '03-contact.png'), fullPage: true });

    expect(states.contact.activeSections).toContain('contact-section');
    expect(states.contact.staticLogoOverlayExists).toBe(false);
  });
});

test('contact about routes through home logo state', async () => {
  await runFlow('contact-about', async (page, states, qaDir) => {
    await clickMainNav(page, 'contact-section');
    await waitForActiveSection(page, 'contact-section');
    await page.waitForTimeout(700);
    states.contact = await captureState(page);

    await clickSectionNav(page, 'contact-section', 'about-section');
    await page.waitForTimeout(1100);
    states.viaHome = await captureState(page);
    await page.screenshot({ path: path.join(qaDir, '02-via-home.png'), fullPage: true });

    expect(states.viaHome.videoSrc).toContain('contact%20horizontal%20reverse.mp4');
    expect(states.viaHome.videoSrc).not.toContain('about%20horizontal');

    await waitForActiveSection(page, 'about-section');
    await page.waitForTimeout(700);
    states.about = await captureState(page);
    await page.screenshot({ path: path.join(qaDir, '03-about.png'), fullPage: true });

    expect(states.about.activeSections).toContain('about-section');
    expect(states.about.staticLogoOverlayExists).toBe(false);
  });
});

test('about portfolio routes through home logo state', async () => {
  await runFlow('about-portfolio', async (page, states, qaDir) => {
    await clickMainNav(page, 'about-section');
    await waitForActiveSection(page, 'about-section');
    await page.waitForTimeout(700);
    states.about = await captureState(page);

    await clickSectionNav(page, 'about-section', 'portfolios-section');
    await page.waitForTimeout(900);
    states.viaHome = await captureState(page);
    await page.screenshot({ path: path.join(qaDir, '02-via-home.png'), fullPage: true });

    expect(states.viaHome.videoSrc).toContain('about%20horizontal%20reverse.mp4');
    expect(states.viaHome.activeSections).not.toContain('portfolios-section');

    await waitForActiveSection(page, 'portfolios-section');
    await page.waitForTimeout(700);
    states.portfolio = await captureState(page);
    await page.screenshot({ path: path.join(qaDir, '03-portfolio.png'), fullPage: true });

    expect(states.portfolio.activeSections).toContain('portfolios-section');
    expect(states.portfolio.staticLogoOverlayExists).toBe(false);
  });
});

test('section reverse transitions return to home logo state', async () => {
  await runFlow('section-reverses', async (page, states, qaDir) => {
    await clickMainNav(page, 'services-section');
    await page.waitForTimeout(4800);
    await clickSectionHome(page, 'services-section');
    await waitForHome(page);
    states.afterServicesReverse = await captureState(page);

    await clickMainNav(page, 'contact-section');
    await waitForActiveSection(page, 'contact-section');
    await page.waitForTimeout(700);
    await clickSectionHome(page, 'contact-section');
    await waitForHome(page);
    states.afterContactReverse = await captureState(page);

    await clickMainNav(page, 'about-section');
    await waitForActiveSection(page, 'about-section');
    await page.waitForTimeout(700);
    await clickSectionHome(page, 'about-section');
    await waitForHome(page);
    states.afterAboutReverse = await captureState(page);
    await page.screenshot({ path: path.join(qaDir, '02-final-home.png'), fullPage: true });

    expect(states.afterServicesReverse.activeSections).toEqual([]);
    expect(states.afterContactReverse.activeSections).toEqual([]);
    expect(states.afterAboutReverse.activeSections).toEqual([]);
    expect(states.afterAboutReverse.staticLogoOverlayExists).toBe(false);
  });
});
