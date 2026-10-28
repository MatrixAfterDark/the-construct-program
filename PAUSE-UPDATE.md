# Page lifecycle update

Only the separate GitHub test site changes. Approved Version 225, the original Sites project, Invite repository and the v225-test release remain unchanged.

The deployment verifies the original ZIP and all 499 files, runs the lifecycle regression test, checks 11 tracked text override hashes, then applies those overrides. Media, approved catalogue, styling, gains, timing durations and event countdown remain unchanged.

Page hiding / leaving pauses media, WebAudio contexts, script timers, canvas clocks and CSS animations. Returning resumes only playback that was active or requested while hidden. User-paused media and mute/volume settings are preserved. BFCache pagehide/pageshow is supported. A Resume Program control appears only if the browser blocks automatic playback. A complete navigation or browser termination may require a fresh visit; no persistence across a destroyed page is added.

Timer bindings in the existing nine JS modules use a shared pausable monotonic clock. Date.now remains real time so the party countdown stays correct. GIF files are preserved unchanged; their native frame clocks are not seekable. Timers/DOM/media and WebAudio behaviour are covered with deterministic mocks, not a phone-device acceptance claim.

No analytics, guest-name logging, completion email, RSVP or third-party tracking has been added. Completion email functionality remains a separate proposal needing a disclosed event and an email backend. Viewing the details is not confirmation of attendance.
