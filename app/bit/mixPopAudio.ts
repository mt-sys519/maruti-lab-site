/**
 * MIX POP's four sounds: pouring, fizzing, ice, and drinking.
 *
 * Every clip is a CC0 recording from freesound, stored in
 * public/bit/mixpop/audio and credited on the page. What matters here is
 * which part of each recording actually gets played: a pour recording is
 * silent for its first second while the bottle is still being tilted, and the
 * fizz is loudest as it hits the glass rather than a couple of seconds later.
 * Played from the top they are inaudible next to the gulp, which is why the
 * region and the gain are written down per sound instead of trusting the file.
 */
type Region = { start?: number; starts?: number[]; end: number; level: number };

const REGION: Record<string, Region> = {
  pour: { start: 1.25, end: 3.5, level: 6 },
  fizzy: { start: 0.5, end: 3.5, level: 2.6 },
  gulp: { start: 0, end: 0.6, level: 1 },
  // Five separate cubes, each landing in its own second of the recording.
  // Taking a different one each time means six cubes going in sound like six
  // cubes rather than one cube played six times.
  ice: { starts: [0, 1.82, 3.22, 4.82, 6.0], end: 0.5, level: 1.2 },
};

const NAMES = Object.keys(REGION);
const src = (name: string) => `/bit/mixpop/audio/${name}.mp3`;

export function createMixPopAudio() {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let enabled = true;
  let active: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  let generation = 0;
  let loading: Promise<unknown> | null = null;
  const buffers = new Map<string, AudioBuffer>();
  const bytes = new Map<string, ArrayBuffer>();

  const downloads = () =>
    Promise.all(
      NAMES.map(async (name) => {
        try {
          const response = await fetch(src(name));
          if (!response.ok) throw new Error(String(response.status));
          bytes.set(name, await response.arrayBuffer());
        } catch {
          /* a sound we cannot fetch is silence, not a failure worth showing */
        }
      }),
    );

  async function ready() {
    if (!context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = enabled ? 0.65 : 0;
      master.connect(context.destination);
    }
    await context.resume();
    if (!loading) {
      loading = downloads().then(() =>
        Promise.all(
          [...bytes].map(async ([name, data]) => {
            buffers.set(name, await context!.decodeAudioData(data.slice(0)));
          }),
        ),
      );
    }
    await loading;
  }

  function stop() {
    generation++;
    if (!active || !context) return;
    const { source, gain } = active;
    active = null;
    gain.gain.cancelScheduledValues(context.currentTime);
    // A longer release than a pour strictly needs, because a hard cut at the
    // end of half a second of water reads as a glitch rather than a stop.
    gain.gain.setTargetAtTime(0, context.currentTime, 0.08);
    source.stop(context.currentTime + 0.32);
  }

  async function play(name: string, loop = false) {
    // Ice is allowed to ring over itself; everything else is the one thing the
    // glass is doing, so it takes over.
    const solo = name !== "ice";
    if (solo) stop();
    const token = generation;
    if (!enabled) return;
    try {
      await ready();
      if (token !== generation || !enabled || !context || !master) return;
      const buffer = buffers.get(name);
      if (!buffer) return;
      const region = REGION[name];
      const start = region.starts ? region.starts[Math.floor(Math.random() * region.starts.length)] : (region.start ?? 0);
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = loop;
      if (loop) {
        source.loopStart = start;
        source.loopEnd = Math.min(buffer.duration, region.end);
      }
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(region.level, context.currentTime + 0.035);
      source.connect(gain);
      gain.connect(master);
      const voice = { source, gain };
      if (solo) active = voice;
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        if (active === voice) active = null;
      };
      source.start(0, start);
      // A one-shot cut from the middle of a longer tape has to be told when to
      // stop, or it plays on into whatever was recorded next.
      if (!loop && region.starts) source.stop(context.currentTime + region.end);
    } catch {
      /* the toy works without sound; it should never break because of it */
    }
  }

  return {
    play,
    stop,
    unlock: () => ready().catch(() => {}),
    toggle() {
      enabled = !enabled;
      if (!enabled) stop();
      if (context && master) master.gain.setTargetAtTime(enabled ? 0.65 : 0, context.currentTime, 0.02);
      if (enabled) void ready().catch(() => {});
      return enabled;
    },
  };
}

export type MixPopAudio = ReturnType<typeof createMixPopAudio>;
