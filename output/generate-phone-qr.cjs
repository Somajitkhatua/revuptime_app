const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const qrRoot = 'C:/Users/khatu/AppData/Local/npm-cache/_npx/1165c3a7792ee1ca/node_modules/qrcode-terminal/vendor/QRCode';
const QRCode = require(qrRoot);
const correction = require(path.join(qrRoot, 'QRErrorCorrectLevel'));

function writeQR(url, filename) {
  const code = new QRCode(-1, correction.M);
  code.addData(url);
  code.make();
  const modules = code.getModuleCount(), quiet = 4, scale = 8;
  const size = (modules + quiet * 2) * scale;
  const png = new PNG({width:size, height:size});
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const row = Math.floor(y / scale) - quiet;
    const col = Math.floor(x / scale) - quiet;
    const dark = row >= 0 && row < modules && col >= 0 && col < modules && code.isDark(row, col);
    const offset = (y * size + x) * 4;
    png.data[offset] = png.data[offset+1] = png.data[offset+2] = dark ? 0 : 255;
    png.data[offset+3] = 255;
  }
  fs.writeFileSync(path.join(__dirname,filename), PNG.sync.write(png));
  console.log(JSON.stringify({filename,url,size}));
}

writeQR('https://expo.dev/go?sdkVersion=55&platform=android&device=true', 'install-expo-go-sdk55-qr.png');
writeQR('exp://10.218.221.137:8083', 'revuptime-1.1.0-phone-preview-qr.png');

const image = (name) => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname,name)).toString('base64');
fs.writeFileSync(path.join(__dirname,'phone-connection.html'),`<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RevUpTime 1.1.0 phone preview</title>
<style>body{margin:0;background:#f2f6fb;font:16px system-ui;color:#102744}main{max-width:820px;margin:40px auto;padding:24px}h1{font-size:28px}.cards{display:flex;gap:20px;flex-wrap:wrap}section{background:white;border:1px solid #dce6f0;border-radius:20px;padding:24px;flex:1;min-width:240px}img{display:block;width:260px;max-width:100%;height:auto;margin:18px auto}a{color:#006de0}small{display:block;line-height:1.6}footer{margin-top:28px;line-height:1.6}</style>
<main><h1>RevUpTime 1.1.0 — phone preview</h1><p>Keep your Android phone and this computer on the same Wi-Fi network.</p>
<div class="cards"><section><h2>1. Install Expo Go</h2><small>Scan with your phone camera. Open the official Expo page and install Expo Go for SDK 55.</small><img alt="Install Expo Go SDK 55 QR code" src="${image('install-expo-go-sdk55-qr.png')}"><a href="https://expo.dev/go?sdkVersion=55&amp;platform=android&amp;device=true">Open installation page</a></section>
<section><h2>2. Connect to RevUpTime</h2><small>Open Expo Go, choose Scan QR code, and scan this code.</small><img alt="RevUpTime phone preview QR code" src="${image('revuptime-1.1.0-phone-preview-qr.png')}"><a href="exp://10.218.221.137:8083">Open in Expo Go</a><p><code>exp://10.218.221.137:8083</code></p></section></div>
<footer>This opens the latest mobile UI in Expo Go. It does not install a new signed RevUpTime APK or its launcher icon. Keep the computer and preview server running. This QR code will need regeneration if the computer's Wi-Fi address changes.<p>The signed APK build is still pending explicit approval to upload mobile sources to Expo Build.</p></footer></main></html>`);
