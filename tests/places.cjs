// Run next to browser.cjs against a local static copy of the site.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = process.env.BASE_URL || 'http://127.0.0.1:8765';
(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || undefined});
  try {
    const page=await browser.newPage({viewport:{width:1200,height:900}});
    await page.addInitScript(()=>{
      window.playedFrequencies=[];
      const start=OscillatorNode.prototype.start;
      OscillatorNode.prototype.start=function(...args){
        window.playedFrequencies.push(this.frequency.value);
        return start.apply(this,args);
      };
    });
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);
    const home=page.locator('a[href="/tools/"]');
    assert.equal(await home.count(),1);
    await home.click();
    await page.getByRole('link',{name:'← 回到首页'}).click();
    await page.getByRole('link',{name:'去逛逛'}).click();
    await page.locator('.map img').evaluate(img=>img.decode());
    const places=page.locator('.map a');
    assert.equal(await places.count(),4);
    for(const width of [320,390,1200]) {
      await page.setViewportSize({width,height:850});
      assert.equal(await page.locator('.map img').evaluate(img=>img.complete && img.naturalWidth>0),true);
      for(const place of await places.all()){
        assert.equal(await place.evaluate(a=>{
          const r=a.getBoundingClientRect(),over=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
          return a.contains(over);
        }),true);
      }
    }
    for(const href of ['/sky/','/radar/','/home/','/repair/']) {
      await page.locator('.map a[href="'+href+'"]').click();
      await page.getByRole('link',{name:'← 回到地图'}).click();
      assert.equal(new URL(page.url()).pathname,'/map/');
    }
    await page.goto(base+'/repair/#music');
    await page.locator('#music-stage.has-model').waitFor({timeout:45000});
    if(process.env.SCREENSHOT_DIR) await page.locator('#music-stage').screenshot({path:path.join(process.env.SCREENSHOT_DIR,'mechanism.png')});
    const track=page.getByRole('slider',{name:'第1拍音高',exact:true});
    await track.focus(); await page.keyboard.press('End');
    assert.equal(await track.getAttribute('aria-valuetext'),'C6');
    await page.locator('#step-turn').click();
    assert.ok(Math.abs(await page.evaluate(()=>playedFrequencies[0])-1046.502)<.02);
    const stage=await page.locator('#music-stage').boundingBox();
    await page.mouse.move(stage.x+stage.width*.22,stage.y+stage.height*.5);
    await page.mouse.down();
    await page.mouse.move(stage.x+stage.width*.52,stage.y+stage.height*.5,{steps:12});
    await page.mouse.up();
    assert.ok(await page.evaluate(()=>playedFrequencies.length)>=12);
    await page.locator('#listen-turn').click();
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');
    await page.locator('#listen-turn').click();
    await page.locator('#take-home').click();
    for(let i=0;i<3;i++){
      await page.locator('[data-gear="'+i+'"]').click();
      await page.locator('[data-slot="'+i+'"]').click();
    }
    for(let i=0;i<3;i++) await page.locator('.winding').click();
    await page.locator('#try').click();
    await page.getByRole('button',{name:'带回小家'}).click();
    await page.waitForURL('**/home/#music-box');
    await page.locator('#window-tune').click();
    assert.equal(await page.locator('#window-tune').getAttribute('aria-pressed'),'true');
    const played=await page.evaluate(()=>playedFrequencies.filter((_,i)=>i%3===0));
    const expected=[7,2,4,2,1,3,5,3].map(p=>523.251*2**([0,2,4,5,7,9,11,12][p]/12));
    assert.equal(played.length,8);
    played.forEach((f,i)=>assert.ok(Math.abs(f-expected[i])<.02));
    await page.reload();
    assert.equal(await page.locator('#window-tune').isVisible(),true);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('zxylab-music-box-v1')).pitches[0]),7);
    await page.locator('.objects summary').click();
    const object=page.locator('#object-list').getByRole('button',{name:'窗边的八音盒'});
    await object.click();
    assert.equal(await page.locator('#object-title').innerText(),'窗边的八音盒');
    await page.goto(base+'/repair/#music');
    assert.equal(await track.getAttribute('aria-valuetext'),'C6');
    assert.equal(await page.locator('#take-home').innerText(),'去窗边听听');
    await page.getByRole('button',{name:'散开的星星',exact:false}).first().click();
    assert.equal(await page.locator('#music-workshop').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log('PASS: map labels, up links, playable 3D mechanism, pitch edit, repair, delivery, room object and persistent tune');
    const flat=await browser.newPage({viewport:{width:360,height:800}});
    await flat.addInitScript(()=>{
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:original.call(this,type,...args);};
    });
    await flat.goto(base+'/repair/#music');
    await flat.locator('#step-turn').click();
    assert.equal(await flat.locator('#music-flat').isVisible(),true);
    console.log('PASS: touch-sized WebGL-free diagram');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
