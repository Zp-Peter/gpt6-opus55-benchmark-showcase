const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const work = __dirname;
const out = path.join(work, '..', 'outputs', 'promo.mp4');
const server = http.createServer((req, res) => {
  if (req.url === '/') { res.writeHead(200, {'Content-Type':'text/html'}); res.end('<!doctype html><title>Encoder</title>'); return; }
  const p = req.url === '/soundtrack.wav' ? path.join(work, 'soundtrack.wav') :
    /^\/frames\/\d{4}\.jpg$/.test(req.url) ? path.join(work, req.url) : null;
  if (!p || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', p.endsWith('.wav') ? 'audio/wav' : 'image/jpeg');
  fs.createReadStream(p).pipe(res);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`http://127.0.0.1:${port}/`);
  const result = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d', { alpha: false });
    const imageCache = new Map();
    function preload(index) {
      if (index < 0 || index >= 540 || imageCache.has(index)) return;
      const img = new Image();
      img.src = `/frames/${String(index).padStart(4, '0')}.jpg`;
      imageCache.set(index, img);
    }
    for (let i = 0; i < 65; i++) preload(i);
    await Promise.all([...imageCache.values()].map(img => img.decode()));
    const response = await fetch('/soundtrack.wav');
    const audioContext = new AudioContext({ sampleRate: 48000 });
    const audioBuffer = await audioContext.decodeAudioData(await response.arrayBuffer());
    const audioSource = audioContext.createBufferSource();
    audioSource.buffer = audioBuffer;
    const audioOutput = audioContext.createMediaStreamDestination();
    audioSource.connect(audioOutput);
    ctx.drawImage(imageCache.get(0), 0, 0);
    const stream = canvas.captureStream(30);
    stream.addTrack(audioOutput.stream.getAudioTracks()[0]);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
      videoBitsPerSecond: 8_000_000,
      audioBitsPerSecond: 160_000
    });
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = event => reject(new Error(String(event.error || event)));
    });
    await audioContext.resume();
    const start = performance.now();
    recorder.start();
    audioSource.start();
    let last = -1;
    await new Promise(resolve => {
      const timer = setInterval(() => {
        const elapsed = (performance.now() - start) / 1000;
        const index = Math.min(539, Math.floor(elapsed * 30));
        if (index !== last) {
          const image = imageCache.get(index);
          if (image && image.complete && image.naturalWidth) ctx.drawImage(image, 0, 0);
          last = index;
          for (let i = index + 1; i <= index + 65; i++) preload(i);
          for (const key of imageCache.keys()) if (key < index - 6) imageCache.delete(key);
        }
        if (elapsed >= 18) { clearInterval(timer); resolve(); }
      }, 15);
    });
    recorder.stop();
    await stopped;
    window.outputBlob = new Blob(chunks, { type: 'video/mp4' });
    return { bytes: window.outputBlob.size, type: window.outputBlob.type, elapsed: (performance.now()-start)/1000 };
  });
  if (result.bytes < 100_000) throw new Error(`Recording too small: ${JSON.stringify(result)}`);
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(window.outputBlob);
    a.download = 'promo.mp4';
    a.click();
  });
  const download = await downloadPromise;
  await download.saveAs(out);
  console.log(JSON.stringify({ output: out, ...result, savedBytes: fs.statSync(out).size }));
  await browser.close();
  server.close();
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
