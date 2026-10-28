const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");
const root = path.resolve(__dirname, "..");
const version = process.argv[2] || require("../app.json").expo.version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Invalid release version");
const build = JSON.parse(fs.readFileSync(path.join(root, "output", `release-${version}-build-result.json`), "utf8"));
if (build.status !== "FINISHED" || build.appVersion !== version) throw new Error("Release build has not finished");
const url = build.artifacts.applicationArchiveUrl || build.artifacts.buildUrl;
if (!url?.startsWith("https://expo.dev/artifacts/") || !url.endsWith(".apk")) throw new Error("Unexpected APK URL");
const qrRoot = "C:/Users/khatu/AppData/Local/npm-cache/_npx/1165c3a7792ee1ca/node_modules/qrcode-terminal/vendor/QRCode";
const QRCode = require(qrRoot);
const correction = require(path.join(qrRoot, "QRErrorCorrectLevel"));
const code = new QRCode(-1, correction.M);
code.addData(url);
code.make();
const count = code.getModuleCount(), quiet = 4, scale = 8, size = (count + quiet * 2) * scale;
const image = new PNG({ width: size, height: size });
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const row = Math.floor(y / scale) - quiet, col = Math.floor(x / scale) - quiet;
  const dark = row >= 0 && row < count && col >= 0 && col < count && code.isDark(row, col);
  const offset = (y * size + x) * 4;
  image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = dark ? 0 : 255;
  image.data[offset + 3] = 255;
}
const qr = PNG.sync.write(image);
const output = path.join(root, "output");
fs.writeFileSync(path.join(output, `revuptime-${version}-apk-install-qr.png`), qr);
fs.writeFileSync(path.join(output, `revuptime-${version}-install.html`), `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RevUpTime ${version}</title>
<style>body{margin:0;background:#edf4fa;font:16px system-ui;color:#102744}main{max-width:480px;margin:30px auto;padding:28px;background:white;border-radius:22px}h1,p{text-align:center}img{display:block;margin:20px auto;width:300px;max-width:100%;height:auto}a.button{display:block;padding:16px;background:#0085ff;color:white;border-radius:12px;text-align:center;text-decoration:none;font-weight:700}li{margin:10px 0;line-height:1.6}small{line-height:1.6}</style>
<main><h1>RevUpTime ${version}</h1><p>Signed Android APK · Build ${build.appBuildVersion}</p><img alt="Scan to download the RevUpTime APK" src="data:image/png;base64,${qr.toString("base64")}"><a class="button" href="${url}">Download Android APK</a><ol><li>Open the link on your Android phone or scan the QR code with its camera.</li><li>Open the downloaded file and choose Update/Install. Keep the existing installation to preserve local history.</li><li>Sign in and select the same Workspace you use on the SaaS app. For manuals and measurements, choose Workspace documents and machine data.</li></ol><small>The app includes workspace and shared-document fixes. AI-written answers depend on the existing SaaS server's provider settings. The server model repair is prepared separately; remote deployment is not implied by this APK build.</small><p><a href="${build.buildPage}">Expo build details</a></p></main></html>`);
console.log(JSON.stringify({ version, build: build.appBuildVersion, url }));
