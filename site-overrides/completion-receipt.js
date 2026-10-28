/* One silent receipt when the final page is reached; no scroll or RSVP required. */
(() => {
'use strict';
const endpoint = 'https://formsubmit.co/ajax/steven.cuzzillo@gmail.com';
const sent = new Set(), pending = new Set();
const timers = window.ProgramLifecycle || window;
const later = (fn, ms) => timers.setTimeout(fn, ms);
const guestName = name => String(name || 'OPERATIVE').replace(/[\r\n\u0000-\u001f\u007f]/g, '').trim().slice(0,32).toUpperCase() || 'OPERATIVE';
const keyFor = name => 'matrix-after-dark:2026-11-07:details-viewed:v1:' + encodeURIComponent(name);
function wasSent(name) {
  if (sent.has(name)) return true;
  try { return window.localStorage.getItem(keyFor(name)) === 'sent'; } catch { return false; }
}
function remember(name) { sent.add(name); try { window.localStorage.setItem(keyFor(name), 'sent'); } catch {} }
async function deliver(name, attempt = 0) {
  if (wasSent(name) || pending.has(name)) return;
  pending.add(name);
  let delivered = false;
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json'}, keepalive: true,
      body: JSON.stringify({name, activity: 'DETAILS VIEWED', event: 'The Matrix After Dark — 7 November 2026', viewed_at: new Date().toISOString(),
        _subject: 'Matrix Construct — details viewed — ' + name, _template: 'table', _captcha: 'false'})
    });
    if (response.ok) { const result = await response.json(); delivered = result.success === true || result.success === 'true'; }
  } catch {} finally { pending.delete(name); }
  if (delivered) remember(name);
  else if (attempt === 0) later(() => deliver(name, 1), 5000);
}
function reached({panel, name}) {
  name = guestName(name);
  let cancelled = false;
  function stop() { cancelled = true; document.removeEventListener('visibilitychange', check); }
  function check() {
    if (cancelled || document.hidden || !panel || panel.closest?.('[hidden]')) return;
    stop(); deliver(name);
  }
  document.addEventListener('visibilitychange',check);
  check(); return stop;
}
window.CompletionReceipt = Object.freeze({reached});
})();
