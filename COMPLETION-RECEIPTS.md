# Final page completion receipts

The separate Construct Program test site sends a background FormSubmit receipt to steven.cuzzillo@gmail.com when the final page character reveal finishes and the visitor reaches the final screen, before scrolling to the title/name or party details. It does not require a scroll or button, add RSVP, change party copy or add a notice/popup.

Subject: Matrix Construct — details viewed — NAME. Payload: personalised display name (same 32-character uppercase value as the experience), DETAILS VIEWED, event name/date, and timestamp. It does not claim ATTENDING, prove reading, or validate who used a personalised link. OPERATIVE is used for unnamed links.

Trigger waits if the page is hidden and cancels on reset. One receipt is remembered per event/name/browser after a successful service acknowledgement, with in-memory fallback when localStorage is unavailable. Concurrent sends in a single page are suppressed. One silent retry follows failure. Separate browsers or cleared storage can produce another receipt. Delivery is best-effort, not proof of attendance.

Reuses the same FormSubmit AJAX endpoint found in MatrixAfterDark/Invite, without changing that repository. A clearly labelled SETUP TEST — NOT A GUEST submission was acknowledged successfully by FormSubmit. Inbox receipt/spam filtering has not been independently verified. No API secret is stored in the client. The older RSVP payload/ATTENDING response was not reused.

Deployment checks the untouched original release ZIP and all 499 baseline file hashes, runs both lifecycle and completion regression tests, verifies 12 override hashes, then applies the tracked text overrides. Approved media, catalogue and original Sites project are unchanged.
