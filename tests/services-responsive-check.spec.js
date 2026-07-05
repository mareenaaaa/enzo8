const { test, chromium } = require('@playwright/test');
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = process.cwd();
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

function startStaticServer(rootDir) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = path.normalize(path.join(rootDir, pathname));
    const relative = path.relative(rootDir, filePath);

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
      res.writeHead(200, {
        'Accept-Ranges': 'bytes',
        'Content-Length': stat.size,
        'Content-Type': contentType
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function installRoutes(page) {
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js', (route) =>
    route.fulfill({ path: gsapPath, contentType: 'application/javascript' })
  );
  await page.route('https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'window.LocomotiveScroll=class{constructor(){this.el=null}update(){}stop(){}start(){}scrollTo(){}};'
    })
  );
  await page.route('https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'window.emailjs={init(){},sendForm(){return Promise.resolve({status:200})}};'
    })
  );
  await page.route('https://cdn.jsdelivr.net/npm/@mux/mux-player', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: "customElements.define('mux-player', class extends HTMLElement { play(){ return Promise.resolve(); } pause(){} load(){} });"
    })
  );
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', (route) => route.fulfill({ body: '' }));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' })
  );
  await page.route('https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.css', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' })
  );
}

async function capture(page) {
  return page.evaluate(() => {
    const items = [...document.querySelectorAll('#services-section .service-item')].map((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        text: el.textContent.trim(),
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        textAlign: style.textAlign
      };
    });

    const overlay = document.querySelector('.services-text-overlay');
    const overlayStyle = overlay ? getComputedStyle(overlay) : null;
    const servicesVideo = document.getElementById('services-bg-video');
    const servicesLoop = document.getElementById('services-loop-video');
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      bodyClass: document.body.className,
      servicesTextOpacity: overlayStyle?.opacity ?? null,
      servicesTextZ: overlayStyle?.zIndex ?? null,
      servicesVideo: servicesVideo ? {
        currentTime: Number(servicesVideo.currentTime.toFixed(3)),
        duration: Number.isFinite(servicesVideo.duration) ? Number(servicesVideo.duration.toFixed(3)) : null,
        paused: servicesVideo.paused,
        ended: servicesVideo.ended,
        readyState: servicesVideo.readyState
      } : null,
      servicesLoop: servicesLoop ? {
        currentTime: Number(servicesLoop.currentTime.toFixed(3)),
        duration: Number.isFinite(servicesLoop.duration) ? Number(servicesLoop.duration.toFixed(3)) : null,
        paused: servicesLoop.paused,
        ended: servicesLoop.ended,
        readyState: servicesLoop.readyState
      } : null,
      items
    };
  });
}

async function runViewport(label, viewport, options = {}) {
  const { server, url } = await startStaticServer(root);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    isMobile: Boolean(options.isMobile),
    hasTouch: Boolean(options.isMobile),
    deviceScaleFactor: options.deviceScaleFactor || 1
  });
  const page = await context.newPage();
  await installRoutes(page);

  const outDir = path.join(root, 'output', 'services-responsive-check', label);
  fs.mkdirSync(outDir, { recursive: true });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.startVideoTransition === 'function', null, { timeout: 30000 });
    await page.evaluate(() => window.startVideoTransition('services'));
    await page.waitForFunction(() => {
      const section = document.getElementById('services-section');
      return Boolean(section && section.classList.contains('active'));
    }, null, { timeout: 60000 });
    await page.waitForTimeout(options.settleMs || 6500);
    const state = await capture(page);
    await page.screenshot({ path: path.join(outDir, 'services.png'), fullPage: true });
    fs.writeFileSync(path.join(outDir, 'state.json'), JSON.stringify(state, null, 2));
    console.log(JSON.stringify({ label, state }, null, 2));
  } finally {
    await context.close();
    await browser.close();
    server.close();
  }
}

test('services responsive screenshots', async () => {
  test.setTimeout(360000);
  await runViewport('iphone-13', { width: 390, height: 844 }, { isMobile: true, deviceScaleFactor: 3, settleMs: 2400 });
  await runViewport('pixel-7', { width: 412, height: 915 }, { isMobile: true, deviceScaleFactor: 2.625, settleMs: 2400 });
  await runViewport('ipad-mini', { width: 820, height: 1180 }, { isMobile: false, deviceScaleFactor: 2, settleMs: 2600 });
});
