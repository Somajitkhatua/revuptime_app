const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");
const cli = require.resolve("@expo/cli/package.json", { paths: [require.resolve("expo/package.json")] });
const { toQR } = require(require.resolve("toqr", { paths: [cli] }));
const address = process.argv[2];
if (!address || !/^exps?:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(address)) throw new Error("Pass the Expo Go LAN or tunnel URL.");
const data = toQR(address), size = Math.sqrt(data.length), margin = 4;
const cells = Array.from(data).map((on, i) => on ? `<rect x="${i % size + margin}" y="${Math.floor(i / size) + margin}" width="1" height="1"/>` : "").join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size + 8} ${size + 8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><g fill="black">${cells}</g></svg>`;
fs.writeFileSync("output/expo-go-qr.svg", svg);
(async () => {
 const browser = await chromium.launch({ channel: "chrome", headless: true });
 const page = await browser.newPage({ viewport: { width: 360, height: 430 } });
 await page.setContent(`<html><body style="margin:0;background:white;font-family:Arial;text-align:center;color:#163653"><h3 style="margin:18px 0 0">RevUpTime · Expo Go · SDK 55</h3><div style="width:330px;height:330px;margin:auto">${svg}</div><div style="font-size:12px;overflow-wrap:anywhere">${address}</div><p style="font-size:12px">${address.includes("exp.direct") || address.includes("trycloudflare.com") ? "Tunnel connection · Keep internet on." : "Phone and PC must use the same Wi-Fi."}</p></body></html>`);
 await page.screenshot({ path: path.resolve("output/expo-go-qr.png") });
 await browser.close();console.log(address);
})().catch(e => { console.error(e); process.exit(1); });
