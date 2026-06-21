const { test, chromium } = require('@playwright/test');
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

test('desktop cinematic transition continuity qa', async () => {
  const qaDir = path.join(process.cwd(), 'output', 'transition-qa');
  fs.mkdirSync(qaDir, { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), 'videos2'), { recursive: true });

  const app = await startStaticServer(process.cwd());
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: 'videos2/',
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

  try {
    await page.goto(app.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6200);
    await page.screenshot({ path: path.join(qaDir, '01-home-after-intro.png'), fullPage: true });

    await page.click('.nav-item[data-target="about-section"]');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(qaDir, '02-about-entered.png'), fullPage: true });

    await page.evaluate(() => document.querySelector('#about-section .brand-home-trigger')?.click());
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(qaDir, '03-home-after-about-reverse.png'), fullPage: true });

    await page.click('.nav-item[data-target="services-section"]');
    await page.waitForTimeout(4300);
    await page.screenshot({ path: path.join(qaDir, '04-services-entered.png'), fullPage: true });

    await page.evaluate(() => document.querySelector('#services-section .brand-home-trigger')?.click());
    await page.waitForTimeout(4100);
    await page.screenshot({ path: path.join(qaDir, '05-home-after-services-reverse.png'), fullPage: true });

    const state = await page.evaluate(() => ({
      bodyClass: document.body.className,
      videoSrc: document.getElementById('bg-video')?.currentSrc,
      videoOpacity: getComputedStyle(document.getElementById('bg-video')).opacity,
      videoFilter: getComputedStyle(document.getElementById('bg-video')).filter,
      videoTransform: getComputedStyle(document.getElementById('bg-video')).transform,
      heroDisplay: getComputedStyle(document.getElementById('hero-ui')).display,
      heroOpacity: getComputedStyle(document.getElementById('hero-ui')).opacity,
      staticLogoOverlayExists: Boolean(document.getElementById('stabilized-logo')),
      servicesVisibility: getComputedStyle(document.getElementById('services-section')).visibility,
      servicesOpacity: getComputedStyle(document.getElementById('services-section')).opacity,
      centerNavOpacity: getComputedStyle(document.getElementById('center-nav')).opacity,
      heroNavReady: document.body.classList.contains('hero-nav-ready'),
      activeSections: [...document.querySelectorAll('.scroll-section.active')].map(el => el.id)
    }));

    fs.writeFileSync(path.join(qaDir, 'qa-state.json'), JSON.stringify({ state, events }, null, 2));
  } finally {
    await context.close();
    await browser.close();
    app.server.close();
  }
});
