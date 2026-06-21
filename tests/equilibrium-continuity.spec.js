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
    route.fulfill({ path: gsapPath, contentType: 'application/javascript' })
  );

  await page.route('https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.js', route =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'window.LocomotiveScroll=class{constructor(opts){this.el=opts&&opts.el}update(){}stop(){}start(){}scrollTo(){}};'
    })
  );

  await page.route('https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js', route =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'window.emailjs={init(){},send(){return Promise.resolve({status:200})},sendForm(){return Promise.resolve({status:200})}};'
    })
  );

  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', route => route.fulfill({ body: '' }));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/**', route =>
    route.fulfill({ contentType: 'text/css', body: '' })
  );
  await page.route('https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.css', route =>
    route.fulfill({ contentType: 'text/css', body: '' })
  );
}

async function installContinuityDiagnostics(page) {
  await page.addInitScript(() => {
    window.__equilibriumLogs = [];

    const round = value => Number.isFinite(value) ? Number(value.toFixed(4)) : value;
    const matrixFor = transform => {
      if (!transform || transform === 'none') {
        return { scaleX: 1, scaleY: 1, x: 0, y: 0, raw: transform || 'none' };
      }
      const matrix = new DOMMatrixReadOnly(transform);
      return {
        scaleX: round(matrix.a),
        scaleY: round(matrix.d),
        x: round(matrix.m41),
        y: round(matrix.m42),
        raw: transform
      };
    };
    const readVideo = id => {
      const el = document.getElementById(id);
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        id,
        src: el.currentSrc || el.src || '',
        currentTime: round(el.currentTime || 0),
        duration: round(el.duration || 0),
        readyState: el.readyState,
        paused: el.paused,
        opacity: round(Number(style.opacity)),
        visibility: style.visibility,
        transform: matrixFor(style.transform),
        filter: style.filter,
        objectPosition: style.objectPosition
      };
    };
    const snapshot = (label, kind) => ({
      label,
      kind,
      t: round(performance.now()),
      bodyClass: document.body.className,
      bg: readVideo('bg-video'),
      buffer: readVideo('handoff-video-buffer'),
      servicesIntro: readVideo('services-bg-video'),
      servicesLoop: readVideo('services-loop-video'),
      activeSections: [...document.querySelectorAll('.scroll-section.active')].map(el => el.id)
    });

    window.__eqMark = label => {
      window.__equilibriumLogs.push(snapshot(label, 'mark'));
    };

    window.__eqStartSampling = (label, duration) => {
      const start = performance.now();
      let frame = 0;
      const sample = () => {
        frame += 1;
        window.__equilibriumLogs.push({ frame, ...snapshot(label, 'frame') });
        if (performance.now() - start < duration) {
          requestAnimationFrame(sample);
        } else {
          window.__equilibriumLogs.push(snapshot(`${label}:sampling-complete`, 'mark'));
        }
      };
      requestAnimationFrame(sample);
    };

    window.__eqGetLogs = () => window.__equilibriumLogs;
  });
}

async function screenshot(page, outDir, name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
}

async function captureBoundary(page, outDir, name, trigger) {
  const shots = [0, 80, 180, 320, 650, 1100, 1600];
  await page.evaluate(label => window.__eqMark(`${label}:before-trigger`), name);
  await screenshot(page, outDir, `${name}-00-before`);
  await page.evaluate(({ label, duration }) => window.__eqStartSampling(label, duration), {
    label: name,
    duration: 2200
  });
  await trigger();

  let elapsed = 0;
  for (let i = 0; i < shots.length; i += 1) {
    const delay = Math.max(0, shots[i] - elapsed);
    if (delay) await page.waitForTimeout(delay);
    elapsed = shots[i];
    await screenshot(page, outDir, `${name}-${String(i + 1).padStart(2, '0')}-${shots[i]}ms`);
  }

  await page.waitForTimeout(Math.max(0, 2300 - elapsed));
  await page.evaluate(label => window.__eqMark(`${label}:after-window`), name);
}

function summarizeScaleJumps(logs) {
  const summaries = {};
  const isVisibleVideoFrame = video => Boolean(video && video.src && video.readyState >= 2 && video.opacity > 0.2);
  for (const label of [...new Set(logs.filter(item => item.kind === 'frame').map(item => item.label))]) {
    const frames = logs.filter(item => item.kind === 'frame' && item.label === label);
    let maxBgDelta = 0;
    let maxServicesDelta = 0;
    for (let i = 1; i < frames.length; i += 1) {
      const prev = frames[i - 1];
      const next = frames[i];
      const frameDuration = Math.max(16.7, next.t - prev.t);
      const frameNormalizer = 16.7 / frameDuration;
      if (isVisibleVideoFrame(prev.bg) && isVisibleVideoFrame(next.bg) && prev.bg.src === next.bg.src) {
        maxBgDelta = Math.max(
          maxBgDelta,
          Math.abs(next.bg.transform.scaleX - prev.bg.transform.scaleX) * frameNormalizer
        );
      }
      if (
        isVisibleVideoFrame(prev.servicesIntro) &&
        isVisibleVideoFrame(next.servicesIntro) &&
        prev.servicesIntro.src === next.servicesIntro.src
      ) {
        maxServicesDelta = Math.max(
          maxServicesDelta,
          Math.abs(next.servicesIntro.transform.scaleX - prev.servicesIntro.transform.scaleX) * frameNormalizer
        );
      }
    }
    summaries[label] = {
      frames: frames.length,
      maxVisibleBgScaleDelta: Number(maxBgDelta.toFixed(4)),
      maxVisibleServicesScaleDelta: Number(maxServicesDelta.toFixed(4))
    };
  }
  return summaries;
}

test('desktop equilibrium continuity: intro home about, about services, services contact', async () => {
  test.setTimeout(140000);

  const root = process.cwd();
  const outDir = path.join(root, 'output', 'equilibrium-continuity');
  const videoDir = path.join(root, 'videos-equilibrium-continuity');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(videoDir, { recursive: true });

  const app = await startStaticServer(root);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1440, height: 900 }
    }
  });
  const page = await context.newPage();
  await installLocalRoutes(page);
  await installContinuityDiagnostics(page);

  try {
    await page.goto(app.url, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.__eqStartSampling('intro-home', 7600));
    await page.waitForFunction(() => document.body.classList.contains('hero-nav-ready'), null, { timeout: 30000 });
    await page.waitForFunction(
      () => window.__equilibriumLogs.some(item => item.label === 'intro-home:sampling-complete'),
      null,
      { timeout: 12000 }
    );
    await page.waitForTimeout(400);
    await screenshot(page, outDir, 'intro-home-00-home-settled');

    await captureBoundary(page, outDir, 'home-about', async () => {
      await page.click('.nav-item[data-target="about-section"]');
    });
    await page.waitForFunction(() => document.getElementById('about-section')?.classList.contains('active'), null, {
      timeout: 18000
    });
    await screenshot(page, outDir, 'home-about-99-about-active');

    await captureBoundary(page, outDir, 'about-services', async () => {
      await page.evaluate(() => {
        document.querySelector('#about-section .nav-link[data-target="services-section"]')?.click();
      });
    });
    await page.waitForFunction(() => document.getElementById('services-section')?.classList.contains('active'), null, {
      timeout: 18000
    });
    await screenshot(page, outDir, 'about-services-99-services-active');

    await captureBoundary(page, outDir, 'services-contact', async () => {
      await page.evaluate(() => {
        document.querySelector('#services-section .nav-link[data-target="contact-section"]')?.click();
      });
    });
    await page.waitForFunction(() => document.getElementById('contact-section')?.classList.contains('active'), null, {
      timeout: 18000
    });
    await screenshot(page, outDir, 'services-contact-99-contact-active');

    const logs = await page.evaluate(() => window.__eqGetLogs());
    const summary = summarizeScaleJumps(logs);
    fs.writeFileSync(path.join(outDir, 'transform-log.json'), JSON.stringify(logs, null, 2));
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));

    expect(summary['intro-home'].maxVisibleBgScaleDelta).toBeLessThan(0.18);
    expect(summary['home-about'].maxVisibleBgScaleDelta).toBeLessThan(0.18);
    expect(summary['about-services'].maxVisibleBgScaleDelta).toBeLessThan(0.18);
    expect(summary['services-contact'].maxVisibleBgScaleDelta).toBeLessThan(0.18);
  } finally {
    await context.close();
    await browser.close();
    app.server.close();
  }
});
