import { notes, readBox, changeBox } from './music-state.js';

export function openWorkshop({ strike, enableSound, repaired, repair }) {
  const byId = id => document.getElementById(id);
  const stage = byId('music-stage');
  const roll = byId('note-roll');
  const listen = byId('listen-turn');
  const take = byId('take-home');
  const message = byId('music-message');
  let state = readBox(), model, turns = -1/64, active = true;
  let lastStep = -1, lastHit = -Infinity, raf = 0, automatic, pointer;
  const sliders = notes.map((_, step) => {
    const column = document.createElement('button');
    column.type = 'button';
    column.className = 'pin-track';
    column.setAttribute('role','slider');
    column.setAttribute('aria-label','第'+(step+1)+'拍音高');
    column.setAttribute('aria-orientation','vertical');
    column.setAttribute('aria-valuemin','0');
    column.setAttribute('aria-valuemax','7');
    column.innerHTML = '<span class="pin"></span>';
    const pitchAt = e => {
      const rect = column.getBoundingClientRect();
      return Math.max(0, Math.min(7, 7 - Math.floor((e.clientY-rect.top)/rect.height*8)));
    };
    function edit(pitch) {
      if (state.pitches[step] === pitch) return;
      const saved = changeBox(s => { s.pitches[step] = pitch; });
      state = readBox();
      updateRoll();
      strike(pitch);
      draw(performance.now());
      message.textContent = '第'+(step+1)+'拍 · '+notes[pitch]+(saved?'':'（仅本页保留）');
    }
    column.onpointerdown = e => {
      if (e.button !== 0) return;
      column.setPointerCapture(e.pointerId);
      edit(pitchAt(e));
    };
    column.onpointermove = e => { if (column.hasPointerCapture(e.pointerId)) edit(pitchAt(e)); };
    column.onkeydown = e => {
      const pitch = state.pitches[step];
      const next = {ArrowUp:pitch+1, ArrowDown:pitch-1, Home:0, End:7}[e.key];
      if (next !== undefined) { e.preventDefault(); edit(Math.max(0,Math.min(7,next))); }
    };
    roll.append(column);
    return column;
  });
  function updateRoll() {
    sliders.forEach((column, i) => {
      const pitch = state.pitches[i];
      column.style.setProperty('--row',7-pitch);
      column.setAttribute('aria-valuenow',pitch);
      column.setAttribute('aria-valuetext',notes[pitch]);
      column.title = '第'+(i+1)+'拍 · '+notes[pitch];
    });
  }
  function draw(now) {
    const t = now-lastHit;
    const strength = t >= 0 && t < 240 ? Math.exp(-t/62)*Math.cos(t*.11) : 0;
    const pitch = lastStep < 0 ? -1 : state.pitches[lastStep];
    model?.render(turns,state.pitches,pitch,strength);
    sliders.forEach((el,i) => el.classList.toggle('sounding', i===lastStep && t<240));
  }
  function advance(next, now) {
    const from = turns*8, to = next*8, forward = to >= from;
    let boundary = forward ? Math.floor(from)+1 : Math.ceil(from)-1;
    while (forward ? boundary<=to : boundary>=to) {
      lastStep = (boundary%8+8)%8;
      strike(state.pitches[lastStep]);
      lastHit = now;
      boundary += forward ? 1 : -1;
    }
    turns = next;
  }
  function frame(now) {
    raf = 0;
    if (!active || document.hidden) return;
    if (automatic) {
      const fraction = Math.min(1,(now-automatic.start)/3200);
      advance(automatic.from+fraction,now);
      if (fraction===1) stop();
    }
    draw(now);
    if (automatic || now-lastHit<250) schedule();
  }
  function schedule() { if (!raf && active) raf=requestAnimationFrame(frame); }
  function stop() { automatic=null; pointer=null; listen.textContent='试听一圈'; }
  function turnOneStep() { stop(); advance(turns+1/8,performance.now()); schedule(); }
  listen.onclick = () => {
    if (automatic) { stop(); return; }
    enableSound();
    automatic={from:turns,start:performance.now()};
    listen.textContent='停一下';
    schedule();
  };
  byId('step-turn').onclick = turnOneStep;
  stage.onpointerdown = e => {
    if (e.button !== 0 || pointer) return;
    stop();
    const rect=stage.getBoundingClientRect();
    const fx=(e.clientX-rect.left)/rect.width, fy=(e.clientY-rect.top)/rect.height;
    pointer={id:e.pointerId, x:e.clientX, angle:fx>.64 && model?.crankAngle ? model.crankAngle(fx,fy) : null};
    stage.setPointerCapture(e.pointerId);
  };
  stage.onpointermove = e => {
    if (pointer?.id!==e.pointerId) return;
    const r=stage.getBoundingClientRect();
    let delta=(e.clientX-pointer.x)/(r.width*.54);
    if (pointer.angle!==null) {
      const next=model.crankAngle((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);
      delta=Math.atan2(Math.sin(next-pointer.angle),Math.cos(next-pointer.angle))/(2*Math.PI);
      pointer.angle=next;
    }
    pointer.x=e.clientX;
    advance(turns+delta,performance.now());
    draw(performance.now()); schedule();
  };
  stage.onlostpointercapture=() => {pointer=null;};
  take.onclick=() => {
    if (!repaired()) { repair(); return; }
    const saved = changeBox(s=>{s.home=true;});
    if (saved) location.assign('/home/#music-box');
    else message.textContent='浏览器未能保存八音盒。这一页仍可继续试听和调音。';
  };
  function refresh() {
    state=readBox(); updateRoll();
    take.textContent=!repaired()?'装好传动齿轮':state.home?'去窗边听听':'带回小家';
    draw(performance.now());
  }
  // A second canvas keeps the diagram available even when WebGL initialization fails.
  model = flatModel(byId('music-flat'));
  refresh();
  let alive=true;
  import('./music-model.js').then(({createMusicModel})=>{
    if (!alive) return;
    try {
      const three=createMusicModel(byId('music-three'));
      model.dispose(); model=three;
      stage.classList.add('has-model'); refresh();
    } catch { /* The editable drum diagram remains interactive. */ }
  }).catch(()=>{});
  const storage = () => {if(active) refresh();};
  const visibility = () => {if(document.hidden) stop();};
  addEventListener('pageshow', storage);
  addEventListener('storage', storage);
  addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange',visibility);
  return {
    show(on) {
      active=on; stop();
      if (on) refresh();
      else if (raf) {cancelAnimationFrame(raf); raf=0;}
    },
    dispose() {
      alive=false; active=false; stop(); cancelAnimationFrame(raf); model.dispose();
      removeEventListener('storage',storage); removeEventListener('pageshow',storage);
      removeEventListener('pagehide',stop); document.removeEventListener('visibilitychange',visibility);
    }
  };
}

function flatModel(canvas) {
  const ctx=canvas.getContext('2d');
  function render(turns, pitches, last, strength) {
    const {width:w,height:h}=canvas.getBoundingClientRect();
    if(!w || !h) return;
    const ratio=Math.min(devicePixelRatio,2);
    if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){
      canvas.width=Math.round(w*ratio); canvas.height=Math.round(h*ratio);
    }
    ctx.setTransform(canvas.width/600,0,0,canvas.height/330,0,0);
    ctx.clearRect(0,0,600,330);
    const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
    const circle=(x,y,r,color)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();};
    rect(48,51,459,234,'#805239');rect(56,59,443,218,'#bb8a62');rect(68,70,419,192,'#514a37');
    const gold=ctx.createLinearGradient(0,88,0,168);gold.addColorStop(0,'#aa8243');gold.addColorStop(.36,'#fae0a0');gold.addColorStop(1,'#a97938');
    rect(103,90,340,82,gold);
    for(let i=0;i<8;i++){
      const x=130+i*40;
      rect(x-11,165,22,73-i*3+(i===last?strength*4:0),'#d1ccc1');
      circle(x,226-i*3,3,'#766b57');
      const angle=2*Math.PI*(turns-i/8);
      if(Math.cos(angle+.8)>.02)circle(130+pitches[i]*40,132+38*Math.cos(angle),4,'#fff1b6');
    }
    rect(443,120,68,9,'#ad8b4f');
    const a=turns*2*Math.PI,dy=Math.cos(a)*35,dx=Math.sin(a)*18;
    ctx.strokeStyle='#b59652';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(510,124);ctx.lineTo(510+dx,124+dy);ctx.stroke();circle(515+dx,124+dy,10,'#443128');
  }
  return {render,dispose(){}};
}
