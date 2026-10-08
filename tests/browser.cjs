/* Development-only browser checks; no browser library is shipped to visitors. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = process.env.BASE_URL || 'http://127.0.0.1:8765';
const out = process.env.SCREENSHOT_DIR;
(async()=>{
 const browser = await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:1000},permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const external=[];page.on('request',r=>{if(new URL(r.url()).origin!==new URL(base).origin)external.push(r.url());});
 await page.goto(base+'/tools/');
 const tabs=page.getByRole('tab');assert.equal(await tabs.count(),7);
 const result=id=>page.locator('#'+id+' .results');
 assert.match(await result('fspl').innerText(),/146.427/);
 // Unit changes preserve the physical quantity.
 await page.locator('#fspl [data-unit-for="f"]').selectOption('MHz');assert.equal(await page.locator('#fspl-f').inputValue(),'10000');assert.match(await result('fspl').innerText(),/146.427/);
 await page.locator('#fspl-r').fill('100');assert.match(await result('fspl').innerText(),/152.448/);
 await page.locator('#fspl-r').fill('0');assert.equal(await result('fspl').isVisible(),false);assert.equal(await page.locator('#fspl .chart').isVisible(),false);assert.equal(await page.locator('#fspl .copy').isDisabled(),true);
 await page.locator('#fspl .reset').click();assert.match(await result('fspl').innerText(),/146.427/);
 await page.locator('#fspl .copy').click();await page.waitForFunction(()=>document.querySelector('#fspl .copy-status').textContent.includes('已复制'));assert.match(await page.locator('#fspl .copy-status').innerText(),/已复制/);assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/工作频率：10 GHz/);
 // Keyboard navigation and hash entry.
 await tabs.nth(0).focus();await page.keyboard.press('ArrowRight');assert.equal(await tabs.nth(1).getAttribute('aria-selected'),'true');assert.equal(new URL(page.url()).hash,'#pulse');
 await page.locator('#pulse-tau').fill('0');assert.equal(await result('pulse').isVisible(),false);await page.locator('#pulse .reset').click();
 await page.getByRole('tab',{name:'成像雷达 · SAR',exact:false}).click();
 await page.locator('#sar-target').selectOption('distributed');assert.equal(await page.locator('#sar-sigma').isVisible(),false);assert.equal(await page.locator('#sar-sigma0').isVisible(),true);assert.match(await result('sar').innerText(),/NESZ/);
 await page.locator('#sar-angle').fill('90');assert.equal(await result('sar').isVisible(),false);
 await page.locator('#sar-angle').fill('45');await page.locator('#sar-n').fill('1.5');assert.equal(await result('sar').isVisible(),false);
 await page.locator('#sar .reset').click();assert.equal(await page.locator('#sar-sigma0').isVisible(),false);
 await page.locator('#sar [data-unit-for="sigma"]').selectOption('dBsm');assert.equal(await page.locator('#sar-sigma').inputValue(),'0');assert.equal(await result('sar').isVisible(),true);
 await page.getByRole('tab',{name:'热噪声功率',exact:false}).click();await page.locator('#noise-b').fill('1');await page.locator('#noise-nf').fill('0');assert.match(await result('noise').innerText(),/-113.975/);
 await page.locator('#noise-t').fill('100');await page.locator('#noise-nf').fill('10');assert.match(await result('noise').innerText(),/2710/);
 await page.getByRole('tab',{name:'距离 / 多普勒',exact:false}).click();assert.match(await result('motion').innerText(),/333.564/);
 await page.locator('#motion-rangeDirection').selectOption('time');await page.locator('#motion-rangeValue').fill('0');assert.match(await result('motion').innerText(),/单程目标距离\n0/);
 await page.locator('#motion-velocityDirection').selectOption('doppler');await page.locator('#motion-velocityValue').fill('-2001.38');assert.match(await result('motion').innerText(),/-29.9999/);
 await page.getByRole('tab',{name:'dB / 功率单位',exact:false}).click();await page.locator('#db-value').fill('30');assert.match(await result('db').innerText(),/1W/);
 await page.locator('#db-kind').selectOption('ratio');await page.locator('#db-from').selectOption('amplitude');await page.locator('#db-value').fill('10');assert.match(await result('db').innerText(),/100倍/);
 await page.locator('#db-value').fill('');assert.equal(await result('db').isVisible(),false);
 // UTF-8 Base64, safe decoded markup and errors.
 await page.getByRole('tab',{name:'Base64 编解码',exact:false}).click();
 await page.locator('#base64-text').fill('你好\n😀');assert.equal(await page.locator('#base64 .text-result').inputValue(),Buffer.from('你好\n😀').toString('base64'));
 await page.locator('#base64-direction').selectOption('decode');await page.locator('#base64-text').fill(Buffer.from('<img src=x onerror=alert(1)>你好').toString('base64'));
 assert.equal(await page.locator('#base64 .text-result').inputValue(),'<img src=x onerror=alert(1)>你好');assert.equal(await page.locator('#base64 img').count(),0);
 await page.locator('#base64-text').fill('/w==');assert.equal(await result('base64').isVisible(),false);
 await page.locator('#base64-text').fill('');assert.equal(await result('base64').isVisible(),true);assert.equal(await page.locator('#base64 .text-result').inputValue(),'');
 // Clipboard failure has a selectable manual copy fallback.
 await page.evaluate(()=>{navigator.clipboard.writeText=()=>Promise.reject(new Error('blocked'));});
 await tabs.nth(0).click();await page.locator('#fspl .copy').click();await page.locator('#fspl .copy-fallback').waitFor({state:'visible'});assert.equal(await page.locator('#fspl .copy-fallback').isVisible(),true);await page.locator('#fspl-r').fill('100');assert.equal(await page.locator('#fspl .copy-fallback').count(),0);
 await page.goto(base+'/tools/#sar');assert.equal(await tabs.nth(2).getAttribute('aria-selected'),'true');
 if(out)await page.screenshot({path:path.join(out,'tools-desktop.png'),fullPage:true});
 for(const width of [320,375,390,760]){
  await page.setViewportSize({width,height:900});
  for(let i=0;i<7;i++){await tabs.nth(i).click();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false,`horizontal overflow ${width} tab ${i}`);}
 }
 await page.setViewportSize({width:390,height:844});await tabs.nth(0).click();if(out)await page.screenshot({path:path.join(out,'tools-mobile.png'),fullPage:true});
 await page.goto(base+'/');assert.equal(await page.getByRole('link',{name:'小工具',exact:true}).getAttribute('href'),'/tools/');
 await page.locator('#pebble').click();assert.equal(await page.locator('#pebble').getAttribute('aria-pressed'),'true');
 await page.goto(base+'/radar/');assert.equal(await page.getByRole('heading',{level:1}).count(),1);assert.ok(await page.locator('canvas').count()>0);
 await page.goto(base+'/sky/');assert.ok(await page.locator('canvas').count()>0);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS: seven calculators, valid/invalid states, units, keyboard/hash, clipboard/fallback, 4 mobile widths, existing homepage/radar/sky, no external requests or JS errors');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
