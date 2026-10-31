export function PackageIllustration({ bulky = false }: { bulky?: boolean }) {
  return <svg viewBox="0 0 120 100" aria-hidden="true" focusable="false">
    {bulky && <><path d="m8 81 51-15 54 17-53 16Z" fill="#8f623b"/><path d="M8 81v8l52 11v-9Z" fill="#b38550"/></>}
    <path d="M13 27 60 10 108 28 60 47Z" fill="#d9b98a"/>
    <path d="M13 27 60 47 60 94 13 73Z" fill="#b98a57"/>
    <path d="M60 47 108 28 108 74 60 94Z" fill="#c99b64"/>
    <path d="m48 14 48 19-13 5-48-19Z" fill="#ead0a7"/>
    <path d="M83 38v20l13-5V33Z" fill="#ddba86"/>
    <path d="M13 27 60 47 108 28" fill="none" stroke="#efd7af"/>
    {bulky && <path d="m33 19 43 17v45M86 19 43 35v44" stroke="#66615b" strokeWidth="3" fill="none"/>}
  </svg>
}
