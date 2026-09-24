// 用无头 Chrome 逐帧渲染 promo.html 并管道给 ffmpeg。
// node render.js stills 0.8 3 7.4 ...   → 导出指定时刻的 PNG 到 stills/
// node render.js video                  → 导出 out/silent.mp4
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG = process.env.FFMPEG;
const FPS = 30;

(async () => {
  const [mode, ...rest] = process.argv.slice(2);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--force-color-profile=srgb'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('file://' + path.join(__dirname, 'promo.html') + '?export');
  await page.evaluate(() => document.fonts.ready);
  const grab = t => page.evaluate(t => { renderAt(t); return document.getElementById('c').toDataURL('image/png'); }, t);

  if (mode === 'stills') {
    fs.mkdirSync(path.join(__dirname, 'stills'), { recursive: true });
    for (const s of rest) {
      const b64 = (await grab(parseFloat(s))).split(',')[1];
      fs.writeFileSync(path.join(__dirname, 'stills', `t${s}.png`), Buffer.from(b64, 'base64'));
    }
  } else {
    fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
    const duration = await page.evaluate(() => window.DURATION);
    const n = Math.round(duration * FPS);
    const ff = spawn(FFMPEG, ['-y', '-f', 'image2pipe', '-c:v', 'png', '-r', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-tune', 'film',
      path.join(__dirname, 'out', 'silent.mp4')], { stdio: ['pipe', 'ignore', 'inherit'] });
    for (let i = 0; i < n; i++) {
      const buf = Buffer.from((await grab(i / FPS)).split(',')[1], 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 90 === 0) process.stdout.write(`frame ${i}/${n}\n`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();
