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

  await page.route('https://cdn.jsdelivr.net/npm/@mux/mux-player', route =>
    route.fulfill({
      contentType: 'application/javascript',
      body: "customElements.define('mux-player', class extends HTMLElement { play(){ return Promise.resolve(); } pause(){} load(){} });"
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

async function captureMobileState(page, label) {
  return page.evaluate((captureLabel) => {
    const readRect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        opacity: style.opacity,
        transform: style.transform,
        objectFit: style.objectFit,
        objectPosition: style.objectPosition,
        visibility: style.visibility,
        display: style.display
      };
    };

    const rootStyle = getComputedStyle(document.documentElement);
    return {
      label: captureLabel,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        visualWidth: window.visualViewport?.width || null,
        visualHeight: window.visualViewport?.height || null
      },
      locks: {
        width: rootStyle.getPropertyValue('--mobile-lock-w').trim(),
        height: rootStyle.getPropertyValue('--mobile-lock-h').trim(),
        vw: rootStyle.getPropertyValue('--mobile-lock-vw').trim(),
        vh: rootStyle.getPropertyValue('--mobile-lock-vh').trim()
      },
      bodyClass: document.body.className,
      activeSections: [...document.querySelectorAll('.scroll-section.active')].map((el) => el.id),
      homeVideo: readRect('#bg-video'),
      legacyMobileIntro: readRect('#mobile-intro-video'),
      navLinks: readRect('.mobile-nav-links'),
      servicesVideo: readRect('#services-bg-video'),
      servicesLoop: readRect('#services-loop-video'),
      portfolioGrid: readRect('#portfolios-section .portfolio-grid'),
      contactVideo: readRect('#bg-video'),
      legacyContactVideo: readRect('#contact-mob-vid'),
      aboutText: readRect('#about-section .manifesto-container'),
      contactText: readRect('#contact-section .contact-text-block')
    };
  }, label);
}

async function openMobileMenu(page) {
  const hamburger = page.locator('#mobile-hamburger.visible');
  if (await hamburger.count()) {
    await hamburger.click();
    await page.waitForTimeout(900);
  }
}

async function clickMobileRoute(page, target) {
  await openMobileMenu(page);
  await page.click(`.mobile-nav-item[data-target="${target}"]`);
}

test('mobile preserves desktop cinematic routing inside a locked vertical frame', async () => {
  test.setTimeout(120000);

  const qaDir = path.join(process.cwd(), 'output', 'mobile-hardlock-final');
  fs.mkdirSync(qaDir, { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), 'videos-mobile-hardlock-final'), { recursive: true });

  const app = await startStaticServer(process.cwd());
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    recordVideo: {
      dir: 'videos-mobile-hardlock-final/',
      size: { width: 390, height: 844 }
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

  const states = [];

  try {
    await page.goto(app.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5600);
    states.push(await captureMobileState(page, 'home-locked'));
    await page.screenshot({ path: path.join(qaDir, 'frame-01-home-locked.png') });

    await page.setViewportSize({ width: 390, height: 780 });
    await page.waitForTimeout(500);
    states.push(await captureMobileState(page, 'home-after-height-only-resize'));
    await page.screenshot({ path: path.join(qaDir, 'frame-02-home-height-resize.png') });

    expect(states[1].locks.height).toBe(states[0].locks.height);
    expect(states[1].homeVideo.transform).toBe(states[0].homeVideo.transform);
    expect(states[1].homeVideo.height).toBe(states[0].homeVideo.height);
    expect(states[0].legacyMobileIntro.display).toBe('none');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    await clickMobileRoute(page, 'services-section');
    await page.waitForTimeout(4300);
    states.push(await captureMobileState(page, 'services-composed'));
    await page.screenshot({ path: path.join(qaDir, 'frame-03-services-composed.png') });

    await clickMobileRoute(page, 'portfolios-section');
    await page.waitForTimeout(4200);
    states.push(await captureMobileState(page, 'portfolio-composed'));
    await page.screenshot({ path: path.join(qaDir, 'frame-04-portfolio-composed.png') });

    await clickMobileRoute(page, 'blogs-section');
    await page.waitForTimeout(2600);
    states.push(await captureMobileState(page, 'blogs-composed'));
    await page.screenshot({ path: path.join(qaDir, 'frame-05-blogs-composed.png') });

    await clickMobileRoute(page, 'about-section');
    await page.waitForTimeout(4200);
    states.push(await captureMobileState(page, 'about-composed'));
    await page.screenshot({ path: path.join(qaDir, 'frame-06-about-composed.png') });

    await clickMobileRoute(page, 'contact-section');
    await page.waitForTimeout(6600);
    states.push(await captureMobileState(page, 'contact-composed'));
    await page.screenshot({ path: path.join(qaDir, 'frame-07-contact-composed.png') });

    for (const state of states) {
      expect(state.bodyClass).toContain('mobile-composition-locked');
      expect(state.locks.width).toBe('390px');
      expect(state.locks.height).toBe('844px');
    }
    expect(states[states.length - 1].activeSections).toContain('contact-section');
    expect(states[states.length - 1].legacyContactVideo.display).toBe('none');

    fs.writeFileSync(
      path.join(qaDir, 'mobile-hardlock-diagnostic.json'),
      JSON.stringify({ states, events }, null, 2)
    );
  } finally {
    await context.close();
    await browser.close();
    app.server.close();
  }
});
