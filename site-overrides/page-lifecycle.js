/* Pause this experience's clocks and playback while its page is away. */
(() => {
'use strict';
const nativeNow = performance.now.bind(performance);
const nativeTimeout = window.setTimeout.bind(window);
const nativeClear = window.clearTimeout.bind(window);
const nativeFrame = window.requestAnimationFrame.bind(window);
const nativeCancelFrame = window.cancelAnimationFrame.bind(window);
let pageAway = false, paused = document.hidden, stoppedAt = paused ? nativeNow() : 0, elapsedAway = 0;
const now = () => (paused ? stoppedAt : nativeNow()) - elapsedAway;
let nextId = 0;
const timers = new Map(), frames = new Map(), contexts = new Map(), media = new Map(), animations = new Set();
let resumeButton = null;
const away = () => pageAway || document.hidden;
function scheduleTimer(task) {
  if (paused || !timers.has(task.id)) return;
  task.native = nativeTimeout(() => {
    task.native = 0;
    if (paused || !timers.has(task.id)) return;
    if (task.repeat) task.due = now() + task.delay;
    else timers.delete(task.id);
    try { task.callback(...task.args); }
    finally { if (task.repeat) scheduleTimer(task); }
  }, Math.max(0, task.due - now()));
}
function timer(callback, delay, repeat, args) {
  if (typeof callback !== 'function') throw new TypeError('Program timer requires a function');
  delay = Math.min(2147483647, Math.max(repeat ? 1 : 0, Number(delay) || 0));
  const task = {id: ++nextId, callback, delay, repeat, args, due: now() + delay, native: 0};
  timers.set(task.id, task); scheduleTimer(task); return task.id;
}
function clearTimer(id) { const task = timers.get(id); if (task) { nativeClear(task.native); timers.delete(id); } }
function scheduleFrame(task) {
  if (paused || !frames.has(task.id)) return;
  task.native = nativeFrame(() => {
    task.native = 0;
    if (paused || !frames.has(task.id)) return;
    frames.delete(task.id); task.callback(now());
  });
}
function requestFrame(callback) { const task = {id: ++nextId, callback, native: 0}; frames.set(task.id, task); scheduleFrame(task); return task.id; }
function cancelFrame(id) { const task = frames.get(id); if (task) { nativeCancelFrame(task.native); frames.delete(id); } }
window.ProgramLifecycle = Object.freeze({
  now, setTimeout: (fn, ms, ...args) => timer(fn, ms, false, args), clearTimeout: clearTimer,
  setInterval: (fn, ms, ...args) => timer(fn, ms, true, args), clearInterval: clearTimer,
  requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame,
  get paused() { return paused; }
});
function showResume() {
  if (away() || resumeButton) return;
  resumeButton = document.createElement('button');
  resumeButton.type = 'button'; resumeButton.textContent = '[ RESUME PROGRAM ]';
  resumeButton.setAttribute('aria-label', 'Resume paused program sound and video');
  resumeButton.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;padding:14px 20px;background:#06120b;color:#a8ffbd;border:1px solid #56cf75;font:14px monospace;cursor:pointer';
  resumeButton.addEventListener('click', () => { const b = resumeButton; resumeButton = null; b.remove(); resumePlayback(); });
  (document.body || document.documentElement).append(resumeButton);
}
const mediaProto = window.HTMLMediaElement?.prototype;
const nativePlay = mediaProto?.play, nativePause = mediaProto?.pause;
function mediaRecord(element) {
  let record = media.get(element);
  if (!record) { record = {element, source: element.currentSrc || element.src, waiting: [], attempting: false}; media.set(element, record); }
  return record;
}
if (mediaProto && nativePlay && nativePause) {
  mediaProto.play = function (...args) {
    if (!away()) return nativePlay.apply(this, args);
    const record = mediaRecord(this); record.source = this.currentSrc || this.src;
    return new Promise((resolve, reject) => record.waiting.push({resolve, reject}));
  };
  mediaProto.pause = function (...args) {
    const record = media.get(this); media.delete(this);
    for (const pending of record?.waiting || []) pending.reject(new DOMException('Playback cancelled while page was away', 'AbortError'));
    return nativePause.apply(this, args);
  };
  document.addEventListener('play', event => {
    if (away() && event.target instanceof window.HTMLMediaElement) {
      mediaRecord(event.target); nativePause.call(event.target);
    }
  }, true);
}
function suspendMedia() {
  for (const element of document.querySelectorAll('audio, video')) {
    if (!element.paused && !element.ended) { mediaRecord(element); nativePause?.call(element); }
  }
}
const patched = new Set();
for (const key of ['AudioContext', 'webkitAudioContext']) {
  const Native = window[key]; if (!Native) continue;
  const proto = Native.prototype;
  if (!patched.has(proto)) {
    patched.add(proto);
    const resume = proto.resume, suspend = proto.suspend;
    proto.resume = function (...args) {
      let record = contexts.get(this);
      if (!record) { record = {context: this, resume, suspend, wants: false}; contexts.set(this, record); }
      if (away()) { record.wants = true; return Promise.resolve(); }
      return resume.apply(this, args);
    };
    proto.suspend = function (...args) { const record = contexts.get(this); if (record) record.wants = false; return suspend.apply(this, args); };
    window[key] = new Proxy(Native, {construct(target, args, newTarget) {
      const context = Reflect.construct(target, args, newTarget);
      const record = {context, resume, suspend, wants: false}; contexts.set(context, record);
      if (away() && context.state === 'running') suspendContext(record);
      return context;
    }});
  } else {
    // Safari aliases can share the same prototype; keep construction tracking.
    const other = key === 'webkitAudioContext' ? window.AudioContext : window.webkitAudioContext;
    if (other?.prototype === proto) window[key] = other;
  }
}
function suspendContext(record) {
  if (record.context.state === 'interrupted') { record.wants = true; return; }
  if (record.context.state !== 'running') return;
  record.wants = true;
  Promise.resolve(record.suspend.call(record.context)).then(() => {
    // A quick return can arrive before the asynchronous suspension finishes.
    if (!away() && record.wants) resumeContext(record);
  }).catch(() => {});
}
function resumeContext(record) {
  if (!record.wants || record.context.state === 'closed' || away()) return;
  return Promise.resolve(record.resume.call(record.context)).then(() => {
    if (away()) suspendContext(record);
    else if (record.context.state === 'running') record.wants = false;
    else showResume();
  }).catch(showResume);
}
function pauseAnimations() {
  if (!paused) return;
  for (const animation of document.getAnimations?.() || []) {
    if (animation.playState === 'running') { animations.add(animation); animation.pause(); }
  }
}
function resumePlayback() {
  if (away()) return;
  for (const record of contexts.values()) resumeContext(record);
  for (const record of media.values()) {
    const element = record.element;
    if (record.attempting) continue;
    if (element.ended || (!record.waiting.length && (element.currentSrc || element.src) !== record.source)) { media.delete(element); continue; }
    record.attempting = true;
    Promise.resolve(nativePlay.call(element)).then(() => {
      record.attempting = false;
      if (media.get(element) !== record) return;
      if (away()) { nativePause.call(element); return; }
      if (media.get(element) === record) media.delete(element);
      record.waiting.forEach(p => p.resolve()); record.waiting = [];
    }).catch(error => {
      record.attempting = false;
      if (media.get(element) !== record) return;
      if (away()) return;
      if (error.name === 'NotAllowedError') showResume();
      else { media.delete(element); record.waiting.forEach(p => p.reject(error)); record.waiting = []; }
    });
  }
}
function update() {
  const next = away(); if (next === paused) return;
  if (next) {
    stoppedAt = nativeNow(); paused = true;
    for (const task of timers.values()) { nativeClear(task.native); task.native = 0; }
    for (const task of frames.values()) { nativeCancelFrame(task.native); task.native = 0; }
    suspendMedia(); for (const record of contexts.values()) suspendContext(record); pauseAnimations();
  } else {
    elapsedAway += nativeNow() - stoppedAt; paused = false;
    resumePlayback();
    for (const animation of animations) if (animation.playState === 'paused') animation.play();
    animations.clear();
    for (const task of timers.values()) scheduleTimer(task);
    for (const task of frames.values()) scheduleFrame(task);
  }
}
document.addEventListener('visibilitychange', update, true);
window.addEventListener('pagehide', () => { pageAway = true; update(); }, true);
window.addEventListener('pageshow', () => { pageAway = false; update(); }, true);
new MutationObserver(() => { if (paused) { suspendMedia(); pauseAnimations(); } }).observe(document.documentElement, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class']});
})();
