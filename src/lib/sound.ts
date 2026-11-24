import { settings } from './settings.svelte';

/** Petits sons synthétisés (aucun fichier à télécharger), désactivables dans les réglages. */
export type SoundName = 'tap' | 'start' | 'tick' | 'end' | 'pop' | 'message' | 'join';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Une note : fréquence (Hz), début (s), durée (s), volume, forme d'onde. */
type Note = [number, number, number, number?, OscillatorType?];

const SOUNDS: Record<SoundName, Note[]> = {
  tap: [[660, 0, 0.05, 0.08]],
  start: [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.2]],
  tick: [[880, 0, 0.04, 0.06, 'square']],
  end: [[784, 0, 0.12], [523, 0.12, 0.25]],
  pop: [[500, 0, 0.06, 0.12], [900, 0.04, 0.08, 0.1]],
  message: [[740, 0, 0.08, 0.1], [988, 0.08, 0.12, 0.1]],
  join: [[392, 0, 0.1, 0.1], [587, 0.09, 0.16, 0.1]],
};

export function play(name: SoundName): void {
  if (!settings.sound) return;
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.01;
  for (const [freq, start, dur, vol = 0.12, type = 'sine'] of SOUNDS[name]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0 + start);
    gain.gain.linearRampToValueAtTime(vol, t0 + start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0 + start);
    osc.stop(t0 + start + dur + 0.02);
  }
}
