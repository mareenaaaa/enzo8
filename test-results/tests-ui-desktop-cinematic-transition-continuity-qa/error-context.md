# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\ui.spec.js >> desktop cinematic transition continuity qa
- Location: tests\ui.spec.js:115:1

# Error details

```
Error: browserType.launch: Executable doesn't exist at C:\Users\sathi\AppData\Local\ms-playwright\chromium_headless_shell-1223\chrome-headless-shell-win64\chrome-headless-shell.exe
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║                                                            ║
║     npx playwright install                                 ║
║                                                            ║
║ <3 Playwright Team                                         ║
╚════════════════════════════════════════════════════════════╝
```

# Test source

```ts
  21  | function startStaticServer(root) {
  22  |   const server = http.createServer((req, res) => {
  23  |     const url = new URL(req.url, 'http://127.0.0.1');
  24  |     const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  25  |     const filePath = path.normalize(path.join(root, pathname));
  26  |     const relative = path.relative(root, filePath);
  27  | 
  28  |     if (relative.startsWith('..') || path.isAbsolute(relative)) {
  29  |       res.writeHead(403);
  30  |       res.end('Forbidden');
  31  |       return;
  32  |     }
  33  | 
  34  |     fs.stat(filePath, (err, stat) => {
  35  |       if (err || !stat.isFile()) {
  36  |         res.writeHead(404);
  37  |         res.end('Not found');
  38  |         return;
  39  |       }
  40  | 
  41  |       const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  42  |       const range = req.headers.range;
  43  | 
  44  |       if (range) {
  45  |         const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  46  |         const start = match && match[1] ? Number(match[1]) : 0;
  47  |         const end = match && match[2] ? Number(match[2]) : stat.size - 1;
  48  | 
  49  |         if (!match || start > end || end >= stat.size) {
  50  |           res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
  51  |           res.end();
  52  |           return;
  53  |         }
  54  | 
  55  |         res.writeHead(206, {
  56  |           'Accept-Ranges': 'bytes',
  57  |           'Content-Length': end - start + 1,
  58  |           'Content-Range': `bytes ${start}-${end}/${stat.size}`,
  59  |           'Content-Type': contentType
  60  |         });
  61  |         fs.createReadStream(filePath, { start, end }).pipe(res);
  62  |         return;
  63  |       }
  64  | 
  65  |       res.writeHead(200, {
  66  |         'Accept-Ranges': 'bytes',
  67  |         'Content-Length': stat.size,
  68  |         'Content-Type': contentType
  69  |       });
  70  |       fs.createReadStream(filePath).pipe(res);
  71  |     });
  72  |   });
  73  | 
  74  |   return new Promise(resolve => {
  75  |     server.listen(0, '127.0.0.1', () => {
  76  |       resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
  77  |     });
  78  |   });
  79  | }
  80  | 
  81  | async function installLocalRoutes(page) {
  82  |   await page.route('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js', route =>
  83  |     route.fulfill({
  84  |       path: gsapPath,
  85  |       contentType: 'application/javascript'
  86  |     })
  87  |   );
  88  | 
  89  |   await page.route('https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.js', route =>
  90  |     route.fulfill({
  91  |       contentType: 'application/javascript',
  92  |       body: 'window.LocomotiveScroll=class{constructor(){this.el=null}update(){}stop(){}start(){}scrollTo(){}};'
  93  |     })
  94  |   );
  95  | 
  96  |   await page.route('https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js', route =>
  97  |     route.fulfill({
  98  |       contentType: 'application/javascript',
  99  |       body: 'window.emailjs={init(){},sendForm(){return Promise.resolve({status:200})}};'
  100 |     })
  101 |   );
  102 | 
  103 |   await page.route('https://fonts.googleapis.com/**', route =>
  104 |     route.fulfill({ contentType: 'text/css', body: '' })
  105 |   );
  106 |   await page.route('https://fonts.gstatic.com/**', route => route.fulfill({ body: '' }));
  107 |   await page.route('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/**', route =>
  108 |     route.fulfill({ contentType: 'text/css', body: '' })
  109 |   );
  110 |   await page.route('https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.css', route =>
  111 |     route.fulfill({ contentType: 'text/css', body: '' })
  112 |   );
  113 | }
  114 | 
  115 | test('desktop cinematic transition continuity qa', async () => {
  116 |   const qaDir = path.join(process.cwd(), 'output', 'transition-qa');
  117 |   fs.mkdirSync(qaDir, { recursive: true });
  118 |   fs.mkdirSync(path.join(process.cwd(), 'videos2'), { recursive: true });
  119 | 
  120 |   const app = await startStaticServer(process.cwd());
> 121 |   const browser = await chromium.launch({ headless: true });
      |                                  ^ Error: browserType.launch: Executable doesn't exist at C:\Users\sathi\AppData\Local\ms-playwright\chromium_headless_shell-1223\chrome-headless-shell-win64\chrome-headless-shell.exe
  122 |   const context = await browser.newContext({
  123 |     viewport: { width: 1440, height: 900 },
  124 |     recordVideo: {
  125 |       dir: 'videos2/',
  126 |       size: { width: 1440, height: 900 }
  127 |     }
  128 |   });
  129 | 
  130 |   const page = await context.newPage();
  131 |   await installLocalRoutes(page);
  132 | 
  133 |   const events = [];
  134 |   page.on('console', msg => {
  135 |     if (msg.type() === 'error' || /prevented|failed|error/i.test(msg.text())) {
  136 |       events.push(`[console:${msg.type()}] ${msg.text()}`);
  137 |     }
  138 |   });
  139 |   page.on('pageerror', err => events.push(`[pageerror] ${err.message}`));
  140 |   page.on('requestfailed', req => events.push(`[requestfailed] ${req.url()} ${req.failure()?.errorText}`));
  141 | 
  142 |   try {
  143 |     await page.goto(app.url, { waitUntil: 'domcontentloaded' });
  144 |     await page.waitForTimeout(6200);
  145 |     await page.screenshot({ path: path.join(qaDir, '01-home-after-intro.png'), fullPage: true });
  146 | 
  147 |     await page.click('.nav-item[data-target="about-section"]');
  148 |     await page.waitForTimeout(3000);
  149 |     await page.screenshot({ path: path.join(qaDir, '02-about-entered.png'), fullPage: true });
  150 | 
  151 |     await page.evaluate(() => document.querySelector('#about-section .brand-home-trigger')?.click());
  152 |     await page.waitForTimeout(3500);
  153 |     await page.screenshot({ path: path.join(qaDir, '03-home-after-about-reverse.png'), fullPage: true });
  154 | 
  155 |     await page.click('.nav-item[data-target="services-section"]');
  156 |     await page.waitForTimeout(4300);
  157 |     await page.screenshot({ path: path.join(qaDir, '04-services-entered.png'), fullPage: true });
  158 | 
  159 |     await page.evaluate(() => document.querySelector('#services-section .brand-home-trigger')?.click());
  160 |     await page.waitForTimeout(4100);
  161 |     await page.screenshot({ path: path.join(qaDir, '05-home-after-services-reverse.png'), fullPage: true });
  162 | 
  163 |     const state = await page.evaluate(() => ({
  164 |       bodyClass: document.body.className,
  165 |       videoSrc: document.getElementById('bg-video')?.currentSrc,
  166 |       videoOpacity: getComputedStyle(document.getElementById('bg-video')).opacity,
  167 |       videoFilter: getComputedStyle(document.getElementById('bg-video')).filter,
  168 |       videoTransform: getComputedStyle(document.getElementById('bg-video')).transform,
  169 |       heroDisplay: getComputedStyle(document.getElementById('hero-ui')).display,
  170 |       heroOpacity: getComputedStyle(document.getElementById('hero-ui')).opacity,
  171 |       staticLogoOverlayExists: Boolean(document.getElementById('stabilized-logo')),
  172 |       servicesVisibility: getComputedStyle(document.getElementById('services-section')).visibility,
  173 |       servicesOpacity: getComputedStyle(document.getElementById('services-section')).opacity,
  174 |       centerNavOpacity: getComputedStyle(document.getElementById('center-nav')).opacity,
  175 |       heroNavReady: document.body.classList.contains('hero-nav-ready'),
  176 |       activeSections: [...document.querySelectorAll('.scroll-section.active')].map(el => el.id)
  177 |     }));
  178 | 
  179 |     fs.writeFileSync(path.join(qaDir, 'qa-state.json'), JSON.stringify({ state, events }, null, 2));
  180 |   } finally {
  181 |     await context.close();
  182 |     await browser.close();
  183 |     app.server.close();
  184 |   }
  185 | });
  186 | 
```