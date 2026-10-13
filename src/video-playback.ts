export type PlaybackState = 'paused' | 'starting' | 'playing' | 'blocked' | 'error';

// Keep native play requests separate from React renders and observer callbacks.
// An interrupted request can reject after visibility or a user pause has changed.
export function manageVideoPlayback(video: HTMLVideoElement, options: {
  canPlay: () => boolean;
  onState: (state: PlaybackState) => void;
}) {
  let disposed = false;
  let pending = false;
  let blocked = false;
  let attempts = 0;
  let generation = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let startup: ReturnType<typeof setTimeout> | undefined;

  const clearTimers = () => {
    clearTimeout(retry);
    clearTimeout(startup);
    retry = startup = undefined;
  };
  const state = (value: PlaybackState) => { if (!disposed) options.onState(value); };
  const eligible = () => !disposed && options.canPlay();

  const watchStartup = () => {
    clearTimeout(startup);
    const previousTime = video.currentTime;
    startup = setTimeout(() => {
      startup = undefined;
      if (!eligible()) return;
      if (video.currentTime !== previousTime) { playing(); return; }
      // A play promise may remain pending while a cold load buffers. Retry a
      // bounded number of times without reloading the file or seeking the loop.
      pending = false;
      generation++;
      if (attempts < 4) start(true);
      else { blocked = true; state('blocked'); }
    }, 3500);
  };

  function start(retryStalled = false) {
    if (!eligible() || blocked || pending) return;
    if (!retryStalled && !video.paused && video.readyState >= 2 && video.currentTime > 0) {
      state('playing');
      return;
    }
    if (attempts >= 4) { blocked = true; state('blocked'); return; }
    clearTimers();
    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = 'auto';
    attempts++;
    pending = true;
    const request = ++generation;
    state('starting');
    watchStartup();
    try {
      Promise.resolve(video.play()).then(() => {
        if (disposed || request !== generation) return;
        pending = false;
        if (!eligible()) { sync(); return; }
        if (!video.paused && video.readyState >= 2) playing();
      }, error => {
        if (disposed || request !== generation) return;
        pending = false;
        clearTimers();
        if (!eligible()) return;
        if (error?.name === 'NotAllowedError') { blocked = true; state('blocked'); }
        else if (error?.name === 'NotSupportedError') { blocked = true; state('error'); }
        else if (attempts < 4) retry = setTimeout(() => { retry = undefined; start(); }, 300 * attempts);
        else { blocked = true; state('blocked'); }
      });
    } catch {
      pending = false;
      clearTimers();
      blocked = true;
      state('error');
    }
  }

  function sync() {
    if (disposed) return;
    if (!eligible()) {
      clearTimers();
      generation++;
      pending = false;
      attempts = 0;
      video.autoplay = false;
      video.pause();
      state('paused');
      return;
    }
    start();
  }
  function playing() {
    if (!eligible()) { sync(); return; }
    clearTimers();
    pending = false;
    blocked = false;
    attempts = 0;
    state('playing');
  }
  const error = () => { clearTimers(); blocked = true; state('error'); };
  const waiting = () => { if (eligible() && !blocked && !startup) watchStartup(); };
  const events: [string, EventListener][] = [
    ['loadeddata', sync], ['canplay', sync], ['playing', playing],
    ['pause', sync], ['stalled', waiting], ['waiting', waiting], ['error', error]
  ];
  events.forEach(([name, listener]) => video.addEventListener(name, listener));
  sync();

  return {
    sync,
    resume() {
      clearTimers();
      generation++;
      pending = false;
      blocked = false;
      attempts = 0;
      if (video.error) video.load();
      sync();
    },
    dispose() {
      disposed = true;
      generation++;
      clearTimers();
      events.forEach(([name, listener]) => video.removeEventListener(name, listener));
    }
  };
}
