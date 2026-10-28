const { chromium, expect }=require('@playwright/test');
const fs=require('fs'),path=require('path');
const asset='00000000-0000-4000-8000-000000000011',order='00000000-0000-4000-8000-000000000040',alert='00000000-0000-4000-8000-000000000030';
(async()=>{
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&/Unexpected text node|Uncaught|TypeError|ReferenceError/.test(m.text()))errors.push(page.url()+': '+m.text())});
await page.goto('http://localhost:8082/login',{waitUntil:'networkidle'});
await page.getByRole('button',{name:'Sign In',exact:true}).click();
await page.getByText('Plant Health',{exact:true}).waitFor();
const shots=[];
async function shot(number,title,url,ready){
 await page.goto('http://localhost:8082'+url,{waitUntil:'networkidle'});
 await ready();await page.waitForTimeout(350);
 const filename=`output/page-${number}.png`;
 await page.screenshot({path:path.resolve(filename)});shots.push({number,title,filename});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
 if(overflow)throw new Error(`Horizontal overflow: ${title}`);
}
await shot(5,'Trend Chart',`/asset/trends?id=${asset}`,()=>page.getByText('X Axis Vibration (RMS)',{exact:true}).waitFor());
await page.getByRole('tab',{name:'Temperature',exact:true}).click();await page.getByText('Temperature trend',{exact:true}).waitFor();
await page.getByRole('tab',{name:'Health',exact:true}).click();await page.getByText('Health trend',{exact:true}).waitFor();
await page.getByRole('button',{name:'Time range',exact:true}).click();await page.getByText('24H',{exact:true}).click();
await shot(6,'Alerts List','/alerts',()=>page.getByRole('button',{name:'Motor M-07: High radial vibration',exact:true}).waitFor());
await page.getByRole('button',{name:'Acknowledged',exact:true}).click();await page.getByRole('button',{name:'Gearbox GB-01: Abnormal vibration pattern',exact:true}).waitFor();
await page.getByRole('button',{name:'Resolved',exact:true}).click();await page.getByRole('button',{name:'Fan F-02: Sensor offline — connection restored',exact:true}).waitFor();
await shot(7,'Alert Detail',`/alert/${alert}`,()=>page.getByRole('button',{name:'Acknowledge',exact:true}).waitFor());
await shot(8,'Work Orders List','/work-orders',()=>page.getByRole('button',{name:'WO-2026-0047: Inspect drive-end bearing',exact:true}).waitFor());
await page.getByRole('button',{name:'In Progress',exact:true}).click();await page.getByRole('button',{name:'WO-2026-0045: Check pump alignment',exact:true}).waitFor();
await shot(9,'Work Order Detail',`/work-order/${order}`,()=>page.getByText('Inspection checklist',{exact:true}).waitFor());
for(const name of ['Updates','Photos','Details','Tasks'])await page.getByRole('tab',{name,exact:true}).click();
await shot(10,'Complete Work Order',`/work-order/complete?id=${order}`,()=>page.getByRole('textbox',{name:'Root Cause',exact:true}).waitFor());
await page.getByRole('button',{name:'Complete Work Order',exact:true}).click();await page.getByText('Complete every checklist task before closing an editable work order.',{exact:true}).waitFor();
await shot(11,'Documents',`/asset/documents?id=${asset}`,()=>page.getByRole('button',{name:'Open ABB Motor Manual',exact:true}).waitFor());
await page.getByRole('button',{name:'Datasheets',exact:true}).click();await page.getByRole('button',{name:'Open Motor Datasheet',exact:true}).waitFor();
await page.getByRole('button',{name:'Upload',exact:true}).click();await page.getByRole('button',{name:'Upload Document',exact:true}).waitFor();
await page.goto('http://localhost:8082/ai',{waitUntil:'networkidle'});
await page.getByText('Analyze current condition',{exact:false}).first().click();await page.getByText('LIVE SENSOR EVIDENCE',{exact:true}).waitFor();
await page.waitForTimeout(350);await page.screenshot({path:path.resolve('output/page-12.png')});shots.push({number:12,title:'AI Assistant',filename:'output/page-12.png'});
await expect(page.getByRole('textbox',{name:'Ask about this machine',exact:true})).toBeVisible();
for(const [number,title,url,ready] of [
 [13,'Create Work Order',`/work-order/create?assetId=${asset}`,()=>page.getByRole('textbox',{name:'Title',exact:true}).waitFor()],
 [14,'Upload Document',`/document/upload?assetId=${asset}`,()=>page.getByRole('button',{name:'Upload Document',exact:true}).waitFor()],
 [15,'Maintenance History',`/asset/history?id=${asset}`,()=>page.getByText('Bearing lubrication',{exact:true}).waitFor()],
 [16,'Document Detail',`/document/00000000-0000-4000-8000-000000000050?assetId=${asset}`,()=>page.getByRole('button',{name:'Open File',exact:true}).waitFor()],
 [17,'Profile','/profile',()=>page.getByText('Rajesh Kumar',{exact:true}).waitFor()],
 [18,'Notifications','/notifications',()=>page.getByText('High radial vibration',{exact:true}).last().waitFor()],
 [19,'Password Recovery','/forgot-password',()=>page.getByRole('button',{name:'Send Recovery Link',exact:true}).waitFor()],
])await shot(number,title,url,ready);
const html=`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#eaf2f9;font-family:Arial;color:#103250}h1{margin:0 0 8px;font-size:27px}p{margin:0 0 20px;color:#536f89;font-size:14px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}.tile{min-width:0}img{width:100%;display:block;border:3px solid #062844;border-radius:22px;box-shadow:0 7px 18px #173e551a}h2{font-size:14px;text-align:center;margin:10px 0 0}</style></head><body><h1>RevUpTime · Remaining screens</h1><p>Mobile app previews · Connected demo workflows</p><div class="grid">${shots.filter(s=>s.number<=12).map(s=>`<div class="tile"><img src="data:image/png;base64,${fs.readFileSync(s.filename).toString('base64')}"><h2>${s.number}. ${s.title}</h2></div>`).join('')}</div></body></html>`;
fs.writeFileSync('output/remaining-pages.html',html);
const gallery=await browser.newPage({viewport:{width:1120,height:1350}});await gallery.setContent(html);await gallery.screenshot({path:path.resolve('output/remaining-pages.png'),fullPage:true});
if(errors.length)throw new Error(errors.join('\n'));
console.log(JSON.stringify({errors,pages:shots.length,trends:'passed',alertFilters:'passed',workOrderTabs:'passed',completionValidation:'passed',documentFilters:'passed',uploadNavigation:'passed',aiEvidence:'passed'}));
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
