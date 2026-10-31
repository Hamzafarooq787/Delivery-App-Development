export type LocationSettingsGuide = {
  device: string
  steps: string[]
  systemSettingsUrl?: string
  helpUrl: string
}

/** Only documented settings schemes. Native iOS/Android app APIs are not web links. */
export function locationSettingsGuide(userAgent: string, maxTouchPoints = 0): LocationSettingsGuide {
  const ios = /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  if (ios) {
    const chrome = /CriOS/.test(userAgent)
    const safari = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent)
    return {
      device: chrome ? 'Chrome on iPhone / iPad' : 'iPhone / iPad',
      steps: chrome ? [
        'Open iPhone Settings and find Chrome. Open Location and choose While Using the App.',
        'Return to GoDrop and tap Use my location. Choose Allow if Chrome asks.',
      ] : [
        'Open Settings → Privacy & Security → Location Services. Turn it on and allow location for your browser.',
        safari ? 'In Safari, open the page menu → Website Settings → Location, then choose Ask or Allow.' : 'Open your browser’s site permissions and allow Location for GoDrop.',
        'Return here and tap Use my location.',
      ],
      helpUrl: chrome ? 'https://support.google.com/chrome/answer/142065?co=GENIE.Platform%3DiOS&hl=en' : 'https://support.apple.com/en-us/102515',
    }
  }
  if (/Android/i.test(userAgent)) return {
    device: 'Android',
    steps: [
      'Open your browser’s site controls beside the address → Permissions → Location → Allow. In Chrome you can also use Settings → Site settings → Location.',
      'If needed, turn on phone Location and allow your browser in Android Settings → Apps → Permissions → Location.',
      'Return here and tap Use my location.',
    ],
    helpUrl: 'https://support.google.com/chrome/answer/114662?co=GENIE.Platform%3DAndroid&hl=en',
  }
  const windows = /Windows/i.test(userAgent)
  return {
    device: windows ? 'Windows' : /Macintosh|Mac OS X/.test(userAgent) ? 'Mac' : 'Desktop browser',
    steps: [
      'Open site controls beside the address bar and set Location to Ask or Allow for GoDrop.',
      windows ? 'If Windows location is off, open Windows Location Settings below and enable Location services and desktop app access.' : 'If device location is off, enable Location Services and allow your browser in your system’s privacy settings.',
      'Return here and tap Use my location.',
    ],
    ...(windows ? { systemSettingsUrl: 'ms-settings:privacy-location' } : {}),
    helpUrl: /Firefox/.test(userAgent) ? 'https://support.mozilla.org/en-US/kb/does-firefox-share-my-location-websites' : /Safari/.test(userAgent) && !/Chrome|Chromium|Edg/.test(userAgent) ? 'https://support.apple.com/guide/safari/customize-settings-per-website-ibrw7f78f7fe/mac' : 'https://support.google.com/chrome/answer/142065?co=GENIE.Platform%3DDesktop&hl=en',
  }
}
