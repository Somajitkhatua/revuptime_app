const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const qrRoot = 'C:/Users/khatu/AppData/Local/npm-cache/_npx/1165c3a7792ee1ca/node_modules/qrcode-terminal/vendor/QRCode';
const QRCode = require(qrRoot);
const correction = require(path.join(qrRoot, 'QRErrorCorrectLevel'));

const build = JSON.parse(fs.readFileSync(path.join(__dirname, 'release-1.1.0-build-result.json'), 'utf8'));
if (build.status !== 'FINISHED' || build.appVersion !== '1.1.0' || build.appBuildVersion !== '11') {
  throw new Error('The verified 1.1.0 / 11 build must finish before generating installation links.');
}
const url = build.artifacts.applicationArchiveUrl || build.artifacts.buildUrl;
if (!url || !url.endsWith('.apk') || !url.startsWith('https://expo.dev/artifacts/')) {
  throw new Error('Missing or unexpected signed APK artifact URL.');
}
const code = new QRCode(-1, correction.M);
code.addData(url);
code.make();
const modules = code.getModuleCount(), quiet = 4, scale = 8;
const size = (modules + quiet * 2) * scale;
const png = new PNG({ width: size, height: size });
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const row = Math.floor(y / scale) - quiet, col = Math.floor(x / scale) - quiet;
  const dark = row >= 0 && row < modules && col >= 0 && col < modules && code.isDark(row, col);
  const offset = (y * size + x) * 4;
  png.data[offset] = png.data[offset + 1] = png.data[offset + 2] = dark ? 0 : 255;
  png.data[offset + 3] = 255;
}
const qr = PNG.sync.write(png);
fs.writeFileSync(path.join(__dirname, 'revuptime-1.1.0-apk-install-qr.png'), qr);
const icon = fs.readFileSync(path.join(__dirname, '../assets/branding/app-icon.png')).toString('base64');
fs.writeFileSync(path.join(__dirname, 'revuptime-1.1.0-install.html'), `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Install RevUpTime 1.1.0</title>
<style>body{margin:0;background:#edf4fa;font:16px system-ui;color:#102744}main{max-width:480px;margin:36px auto;background:white;padding:32px;border-radius:24px;text-align:center}h1{font-size:26px;margin-bottom:8px}p{line-height:1.6}.icon{width:92px;border-radius:24px}.qr{width:300px;max-width:100%;height:auto;display:block;margin:20px auto}a.button{display:block;padding:16px;background:#0085ff;color:white;border-radius:12px;text-decoration:none;font-weight:700}small{color:#526a82}ol{text-align:left;line-height:1.8;padding-left:24px}footer{font-size:13px;color:#526a82;line-height:1.6}</style>
<main><img alt="RevUpTime app icon" class="icon" src="data:image/png;base64,${icon}"><h1>RevUpTime 1.1.0</h1><small>Signed Android APK · Build 11</small><p>The latest Home, launcher icon, Devices navigation, operational screens and workspace document features.</p><img class="qr" alt="Scan to download the signed RevUpTime 1.1.0 APK" src="data:image/png;base64,${qr.toString('base64')}"><a class="button" href="${url}">Download Android APK</a><ol><li>Scan with your phone camera, or open the download link on your Android phone.</li><li>Open the downloaded APK and allow installation from your browser if Android asks.</li><li>Choose Install or Update, then open RevUpTime and sign in.</li></ol><p>Expo Go and a connection to this computer are not required.</p><footer><a href="${build.buildPage}">View the completed Expo build</a><p>Physical-phone acceptance and live AI/vector generation are not certified by the build. Backend provider configuration and sharing permissions remain unchanged.</p></footer></main></html>`);
console.log(JSON.stringify({ version: build.appVersion, build: build.appBuildVersion, url, qrSize: size }));
