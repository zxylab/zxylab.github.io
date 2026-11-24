const key = 'zxylab-music-box-v1';
const original = [0, 2, 4, 2, 1, 3, 5, 3];
export const notes = ['C5','D5','E5','F5','G5','A5','B5','C6'];
const semitones = [0,2,4,5,7,9,11,12];
let memory = { pitches: original.slice(), home: false };

export function readBox() {
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    if (stored && Array.isArray(stored.pitches) && stored.pitches.length === 8 &&
        stored.pitches.every(n => Number.isInteger(n) && n >= 0 && n < 8)) {
      memory = { pitches: stored.pitches, home: stored.home === true };
    }
  } catch { /* The current page still holds the instrument. */ }
  return { pitches: [...memory.pitches], home: memory.home };
}

export function changeBox(edit) {
  const next = readBox();
  edit(next);
  memory = next;
  try { localStorage.setItem(key, JSON.stringify(next)); return true; }
  catch { return false; }
}

// Both rooms use the same short strike and the longer ringing fundamental.
export function pluck(audio, destination, pitch, when = audio.currentTime) {
  const hz = 523.251 * 2 ** (semitones[pitch] / 12);
  for (const [multiple, level, decay] of [[1,.17,.92],[2,.052,.36],[4.12,.018,.12]]) {
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    oscillator.frequency.value = hz * multiple;
    envelope.gain.setValueAtTime(.0001, when);
    envelope.gain.exponentialRampToValueAtTime(level, when+.005);
    envelope.gain.exponentialRampToValueAtTime(.0001, when+decay);
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.start(when);
    oscillator.stop(when+decay+.015);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
}
