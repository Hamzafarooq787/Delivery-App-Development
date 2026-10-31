# Booking location permission recovery

Collect & Deliver uses a real browser-controlled `<geolocation>` element when `HTMLGeolocationElement` is available (Chrome 144+). Clicking it opens the browser's permission or recovery flow and returns a position through the `location` event. The position goes directly to the selected pickup, delivery or live destination action; no second GPS request is needed. The browser owns the button wording and permission decision.

Unsupported browsers keep `getCurrentPosition`, called synchronously from the user's action. A previous persistent denial cannot be overridden by this API. A failed explicit request opens one shared dialog, preserving both addresses. Its guidance distinguishes iOS, Android and desktop. Windows has the documented `ms-settings:privacy-location` link; other platforms receive official help links rather than unsupported settings URI schemes. Native iOS/Android app APIs do not provide a universal website settings link.

The shared dialog suspends the three background native controls, since Chromium limits the number of permission elements to three. Native elements remain visible, with sufficient color contrast; no hidden controls or programmatic consent clicks are used. Background live-sharing failures retain a compact status instead of repeatedly interrupting the user.

## Validation

- Repair suite: 38 passing tests, including device-specific settings guidance, GPS denial, timeout, retry and address-independent positioning helpers.
- Headless Chromium 153: real native elements are valid and return the test device position after browser permission is granted. Verified pickup/delivery isolation, reuse of the returned position, live-sharing start/stop with a mocked server acknowledgement, recovery-dialog control limits, and rejection of a delayed GPS result after a newer manual address edit.
- Responsive checks: 393×700, 360×640 and 1440×900; no document horizontal overflow, actions inside the viewport.
- Unsupported-browser fallback tested in Chromium with the feature disabled and an iPhone user agent: real denied permission produces one dialog, retains both addresses, requests from an active user gesture, and fills the intended address after permission changes to granted.
- Actual browser chrome/OS permission dialogs, physical iPhone/Android GPS and opening Windows Settings still require device testing. Headless tests do not verify those interfaces.

Sources: [Chrome implementation](https://developer.chrome.com/blog/geolocation-html-element), [MDN compatibility and restrictions](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/geolocation), [Windows settings URIs](https://learn.microsoft.com/en-us/windows/apps/develop/launch/launch-settings).
