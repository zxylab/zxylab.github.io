import { readBox, pluck } from '../repair/music-state.js';

const button = document.getElementById('window-tune');
const quiet = document.getElementById('quiet');
const idleLabel = '听窗边的八音盒';
let audio, output, timer;

function stop() {
  clearTimeout(timer);
  timer = null;
  if (output) {
    output.gain.setTargetAtTime(0, audio.currentTime, .012);
    const finished = output;
    setTimeout(() => finished.disconnect(), 90);
    output = null;
  }
  button.textContent=idleLabel;
  button.setAttribute('aria-pressed','false');
}
function refresh() { button.hidden = !readBox().home; }
button.addEventListener('click', () => {
  if (timer) { stop(); return; }
  const box=readBox();
  if (!box.home) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume().catch(stop);
    if (quiet.getAttribute('aria-pressed')!=='true') quiet.click();
    output=audio.createGain(); output.connect(audio.destination);
    box.pitches.forEach((pitch,i) => pluck(audio,output,pitch,audio.currentTime+.035+i*.4));
    button.textContent='停下八音盒';
    button.setAttribute('aria-pressed','true');
    timer=setTimeout(stop,3750);
  } catch { stop(); document.getElementById('message').textContent='这台设备暂时无法播放声音。'; }
});
new MutationObserver(()=>{if(quiet.getAttribute('aria-pressed')==='false') stop();}).observe(quiet,{attributes:true,attributeFilter:['aria-pressed']});
addEventListener('pagehide',stop);
document.addEventListener('visibilitychange',()=>{if(document.hidden) stop();});
addEventListener('pageshow',refresh);
addEventListener('storage',refresh);
refresh();
if (!button.hidden && location.hash==='#music-box') document.getElementById('message').textContent='八音盒已经摆在窗边了。点一下，听听你留在里面的旋律。';
