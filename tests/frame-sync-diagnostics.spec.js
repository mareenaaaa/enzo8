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

async function installDiagnostics(page) {
  await page.addInitScript(() => {
    window.__frameSyncEvents = [];
    window.__frameSyncMarks = [];

    const round = value => Number.isFinite(value) ? Number(value.toFixed(4)) : value;
    const readStyle = el => {
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        opacity: style.opacity,
        visibility: style.visibility,
        transform: style.transform,
        filter: style.filter,
        display: style.display
      };
    };

    const readVideo = id => {
      const el = document.getElementById(id);
      if (!el) return null;
      const style = readStyle(el);
      return {
        id,
        src: el.currentSrc || el.src || '',
        currentTime: round(el.currentTime || 0),
        duration: round(el.duration || 0),
        readyState: el.readyState,
        networkState: el.networkState,
        paused: el.paused,
        ended: el.ended,
        playbackRate: el.playbackRate,
        opacity: style.opacity,
        transform: style.transform,
        filter: style.filter,
        visibility: style.visibility
      };
    };

    const readSection = id => {
      const el = document.getElementById(id);
      if (!el) return null;
      const style = readStyle(el);
      return {
        id,
        active: el.classList.contains('active'),
        opacity: style.opacity,
        visibility: style.visibility,
        transform: style.transform,
        pointerEvents: style.pointerEvents
      };
    };

    const snapshot = kind => ({
      kind,
      t: round(performance.now()),
      bodyClass: document.body.className,
      bg: readVideo('bg-video'),
      buffer: readVideo('handoff-video-buffer'),
      servicesIntro: readVideo('services-bg-video'),
      servicesLoop: readVideo('services-loop-video'),
      sections: {
        services: readSection('services-section'),
        contact: readSection('contact-section'),
        about: readSection('about-section'),
        portfolio: readSection('portfolios-section')
      },
      staticLogoOverlayExists: Boolean(document.getElementById('stabilized-logo'))
    });

    window.__markFrameSync = label => {
      window.__frameSyncMarks.push({ label, t: round(performance.now()) });
      window.__frameSyncEvents.push({ label, ...snapshot('mark') });
    };

    window.__getFrameSyncDiagnostics = () => ({
      marks: window.__frameSyncMarks,
      events: window.__frameSyncEvents
    });

    window.addEventListener('DOMContentLoaded', () => {
      const ids = ['bg-video', 'handoff-video-buffer', 'services-bg-video', 'services-loop-video'];
      const watchedEvents = ['loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'playing', 'waiting', 'pause', 'ended', 'seeking', 'seeked'];

      const attach = id => {
        const el = document.getElementById(id);
        if (!el || el.dataset.frameSyncWatched === 'true') return;
        el.dataset.frameSyncWatched = 'true';
        watchedEvents.forEach(type => {
          el.addEventListener(type, () => {
            window.__frameSyncEvents.push({
              videoEvent: type,
              videoId: id,
              ...snapshot('video-event')
            });
          });
        });
      };

      ids.forEach(attach);
      const observer = new MutationObserver(() => ids.forEach(attach));
      observer.observe(document.documentElement, { childList: true, subtree: true });
      let frame = 0;
      const sample = () => {
        frame += 1;
        if (frame % 2 === 0) {
          window.__frameSyncEvents.push({ frame, ...snapshot('raf') });
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  });
}

async function setupPage() {
  const app = await startStaticServer(process.cwd());
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: 'videos-frame-sync-diagnostics/',
      size: { width: 1440, height: 900 }
    }
  });
  const page = await context.newPage();
  await installLocalRoutes(page);
  await installDiagnostics(page);
  return { app, browser, context, page };
}

async function teardown(env) {
  await env.context.close();
  await env.browser.close();
  env.app.server.close();
}

async function boot(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6200);
  await page.evaluate(() => window.__markFrameSync('home-settled'));
}

async function dump(page, name) {
  const outDir = path.join(process.cwd(), 'output', 'frame-sync-diagnostics');
  fs.mkdirSync(outDir, { recursive: true });
  const diagnostics = await page.evaluate(() => window.__getFrameSyncDiagnostics());
  const serialized = JSON.stringify(diagnostics);
  const forbiddenRuntimeMedia = [
    'PORTFOLIO%20ANIMATION',
    'BLOG%20%20ANIMATION',
    'Screen%20Recording',
    'cinematic-reference',
    'ai-context/references'
  ];
  const leakedAsset = forbiddenRuntimeMedia.find(asset => serialized.includes(asset));
  if (leakedAsset) {
    throw new Error(`Forbidden reference/runtime media appeared in transition diagnostics: ${leakedAsset}`);
  }
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(diagnostics, null, 2));
}

test('diagnose home services contact boundaries', async () => {
  const env = await setupPage();
  try {
    await boot(env.page, env.app.url);
    await env.page.evaluate(() => window.__markFrameSync('click-services'));
    await env.page.click('.nav-item[data-target="services-section"]');
    await env.page.waitForTimeout(4700);
    await env.page.evaluate(() => window.__markFrameSync('services-ambient'));
    await env.page.evaluate(() => {
      window.__markFrameSync('click-contact');
      document.querySelector('#services-section .nav-link[data-target="contact-section"]')?.click();
    });
    await env.page.waitForTimeout(4700);
    await env.page.evaluate(() => window.__markFrameSync('contact-active'));
    await dump(env.page, 'home-services-contact');
  } finally {
    await teardown(env);
  }
});

test('diagnose direct home about and about portfolio boundaries', async () => {
  const env = await setupPage();
  try {
    await boot(env.page, env.app.url);
    await env.page.evaluate(() => window.__markFrameSync('click-about'));
    await env.page.click('.nav-item[data-target="about-section"]');
    await env.page.waitForTimeout(4300);
    await env.page.evaluate(() => window.__markFrameSync('about-active'));
    await env.page.evaluate(() => {
      window.__markFrameSync('click-portfolio');
      document.querySelector('#about-section .nav-link[data-target="portfolios-section"]')?.click();
    });
    await env.page.waitForTimeout(6500);
    await env.page.evaluate(() => window.__markFrameSync('portfolio-active'));
    await dump(env.page, 'home-about-portfolio');
  } finally {
    await teardown(env);
  }
});

test('diagnose contact about portfolio chained boundaries', async () => {
  const env = await setupPage();
  try {
    await boot(env.page, env.app.url);
    await env.page.evaluate(() => window.__markFrameSync('click-contact'));
    await env.page.click('.nav-item[data-target="contact-section"]');
    await env.page.waitForTimeout(4300);
    await env.page.evaluate(() => window.__markFrameSync('contact-active'));
    await env.page.evaluate(() => {
      window.__markFrameSync('click-about');
      document.querySelector('#contact-section .nav-link[data-target="about-section"]')?.click();
    });
    await env.page.waitForTimeout(5200);
    await env.page.evaluate(() => window.__markFrameSync('about-active'));
    await env.page.evaluate(() => {
      window.__markFrameSync('click-portfolio');
      document.querySelector('#about-section .nav-link[data-target="portfolios-section"]')?.click();
    });
    await env.page.waitForTimeout(6500);
    await env.page.evaluate(() => window.__markFrameSync('portfolio-active'));
    await dump(env.page, 'contact-about-portfolio');
  } finally {
    await teardown(env);
  }
});

test('diagnose reverse boundaries', async () => {
  const env = await setupPage();
  try {
    await boot(env.page, env.app.url);
    await env.page.click('.nav-item[data-target="services-section"]');
    await env.page.waitForTimeout(4700);
    await env.page.evaluate(() => {
      window.__markFrameSync('click-services-home');
      document.querySelector('#services-section .brand-home-trigger')?.click();
    });
    await env.page.waitForTimeout(4200);
    await env.page.click('.nav-item[data-target="contact-section"]');
    await env.page.waitForTimeout(3600);
    await env.page.evaluate(() => {
      window.__markFrameSync('click-contact-home');
      document.querySelector('#contact-section .brand-home-trigger')?.click();
    });
    await env.page.waitForTimeout(4200);
    await dump(env.page, 'reverse-boundaries');
  } finally {
    await teardown(env);
  }
});
