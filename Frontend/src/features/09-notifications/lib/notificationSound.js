let context = null;

const getContext = () => {
  if (!context) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  return context;
};

// Browsers only allow sound after the person has interacted with the page
const unlock = () => getContext()?.resume?.().catch(() => {});
['pointerdown', 'keydown'].forEach((name) => window.addEventListener(name, unlock, { once: true }));

/**
 * A short two-tone chime. Fails silently when the browser blocks audio.
 */
export const playNotificationSound = async () => {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    master.connect(ctx.destination);

    [523.25, 659.25].forEach((frequency, index) => {
      const start = now + index * 0.02;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, now);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(1, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.14);
    });
  } catch {
    // Audio is a nicety; never let it break anything
  }
};

export default playNotificationSound;
