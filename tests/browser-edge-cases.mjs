import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.JELLY_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const base='http://127.0.0.1:8032';const results=[];
const pass=s=>{results.push(s);console.log('PASS',s);};
async function context(){return browser.newContext({viewport:{width:320,height:720},locale:'ko-KR',timezoneId:'Asia/Seoul'});}
// A denied play must not stop the text routine.
{
const c=await context();await c.addInitScript(()=>{HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('Denied','NotAllowedError'));};});
const p=await c.newPage();await p.goto(base);await p.locator('#quick-start').click();await p.waitForFunction(()=>document.querySelector('#audio-status').textContent.includes('다시 시작'));
assert.ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('sleepApp:v1')).active));assert.equal(await p.locator('#routine-dialog').evaluate(d=>d.open),true);pass('Playback denied: text routine keeps running with retry guidance');await c.close();
}
{
const c=await context();const p=await c.newPage();await p.route('**/*.mp3',route=>route.fulfill({status:404,body:'not found'}));await p.goto(base);await p.locator('#quick-start').click();await p.waitForFunction(()=>document.querySelector('#audio').error!==null);assert.ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('sleepApp:v1')).active));await p.locator('#skip-stage').click();assert.match(await p.locator('#stage-name').textContent(),/몸의 힘/);pass('Missing MP3: failure is visible and the routine can continue');await c.close();
}
{
const c=await context();await c.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Blocked','QuotaExceededError');};});const p=await c.newPage();await p.goto(base);assert.equal(await p.locator('#storage-banner').isVisible(),true);await p.locator('#quick-start').click();await p.locator('#end-routine').click();await p.locator('#confirm-ok').click();assert.match(await p.locator('#routine-body').textContent(),/저장하지 못했/);await p.locator('#complete-journal').click();assert.equal(await p.locator('.session-card').count(),1);pass('Storage denied: no false success and in-memory record is retained');await c.close();
}
{
const c=await context();await c.addInitScript(()=>localStorage.setItem('sleepApp:v1','{broken'));const p=await c.newPage();await p.goto(base);assert.equal(await p.evaluate(()=>localStorage.getItem('sleepApp:v1')),'{broken');assert.equal(await p.locator('#storage-banner').isVisible(),true);pass('Corrupt JSON: original data is not overwritten');await c.close();
}
{
const c=await context();const p=await c.newPage();await p.goto(base);await p.locator('#quick-start').click();await p.locator('#skip-stage').click();await p.locator('#skip-stage').click();await p.locator('#skip-stage').click();
let active=await p.evaluate(()=>JSON.parse(localStorage.getItem('sleepApp:v1')).active);assert.equal(active.stageIndex,3);assert.equal(active.endsAtMs-active.startedAtMs,600000);assert.equal(await p.locator('#skip-stage').isVisible(),false);pass('Skipping all relaxation/imagery preserves original end time');
await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('sleepApp:v1'));for(const key of ['startedAtMs','endsAtMs','stageStartedAtMs','stageEndsAtMs'])d.active[key]-=660000;localStorage.setItem('sleepApp:v1',JSON.stringify(d));});
// Avoid the old page's pagehide handler rewriting the test fixture.
const stored=await p.evaluate(()=>localStorage.getItem('sleepApp:v1'));const p2=await c.newPage();await p2.addInitScript(s=>localStorage.setItem('sleepApp:v1',s),stored);await p2.goto(base);await p2.waitForFunction(()=>document.querySelector('#routine-body').textContent.includes('오늘의 쉼을 마쳤'));
assert.equal(await p2.evaluate(()=>JSON.parse(localStorage.getItem('sleepApp:v1')).sessions[0].completionSource),'recovered');assert.equal(await p2.locator('audio').evaluate(a=>a.paused),true);pass('Expired routine on return is saved once as recovered with no autoplay');await c.close();
}
{
const c=await context();const p=await c.newPage();await p.route('**/tracks.js',route=>route.fulfill({contentType:'text/javascript',body:'export const tracks = [];'}));await p.goto(base);await p.locator('.bottom-nav [data-tab=sounds]').click();assert.match(await p.locator('#track-list').textContent(),/등록된 음악이 없/);await p.locator('#empty-music-action').click();await p.locator('#start-quiet').click();assert.equal(await p.locator('audio').evaluate(a=>a.paused),true);assert.match(await p.locator('#stage-name').textContent(),/호흡/);pass('Empty catalogue offers a fully usable silent routine');await c.close();
}
{
const c=await context();const p=await c.newPage();const extra=readFileSync('dist/tracks.js','utf8')+'\ntracks.splice(1);tracks.push({...tracks[0],id:"test-second",title:"아주 긴 제목을 가진 두 번째 검증용 자장가"},{...tracks[0],id:"test-third",title:"세 번째 검증용 자장가"});';
await p.route('**/tracks.js',route=>route.fulfill({contentType:'text/javascript',body:extra}));await p.goto(base);await p.locator('.bottom-nav [data-tab=sounds]').click();assert.equal(await p.locator('.music-card').count(),3);await p.locator('.music-select').first().click();await p.locator('#next').click();assert.match(await p.locator('#player-title').textContent(),/두 번째/);await p.locator('#next').click();assert.match(await p.locator('#player-title').textContent(),/세 번째/);await p.locator('#next').click();assert.equal(await p.locator('#player-title').textContent(),'힘을 놓고 고요함에 머물러요');await p.locator('#previous').click();assert.match(await p.locator('#player-title').textContent(),/세 번째/);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);pass('Three-track fixture: automatic cards, long title, manual next/previous wrap');
await p.locator('#play-mode').selectOption('all');await p.waitForFunction(()=>Number.isFinite(document.querySelector('audio').duration));await p.locator('#audio').evaluate(a=>{a.currentTime=a.duration-.15;});await p.waitForFunction(()=>document.querySelector('audio').ended);assert.equal(await p.locator('audio').evaluate(a=>a.paused),true);pass('Continuous list stops after final track');await c.close();
}
{
const c=await context();await c.addInitScript(()=>{document.modelContext={registerTool(t){window.testTool=t;}};});const p=await c.newPage();await p.goto(base);
const r=await p.evaluate(()=>window.testTool.execute({mood:'calm',minutes:5}));assert.equal(r.routineId,'calm-5');assert.equal(await p.locator('#routine-dialog').evaluate(d=>d.open),true);
assert.equal(await p.evaluate(()=>{try{window.testTool.execute({mood:'wrong',minutes:5});return false;}catch{return true;}}),true);assert.equal(await p.locator('#hero-minutes').textContent(),'5분');pass('Optional WebMCP handler valid/invalid input (mock registry; native support not verified)');await c.close();
}
// Clean screenshots, using an untouched browser profile, for visual review.
{
const c=await context();const p=await c.newPage();await p.goto(base);await p.evaluate(()=>document.fonts.ready);
for(const width of [320,390,1440]){await p.setViewportSize({width,height:844});await p.screenshot({path:`test-results/final-home-${width}.png`,fullPage:true});}
await p.setViewportSize({width:390,height:844});await p.locator('.bottom-nav [data-tab=sounds]').click();await p.screenshot({path:'test-results/final-sounds-390.png',fullPage:true});await c.close();
}
writeFileSync('test-results/edge-results.json',JSON.stringify(results,null,2));await browser.close();
