import { EULA_CONTACT, EULA_LICENSOR, EULA_SITE_PRIMARY, EULA_SITE_PUBLISHER } from '@/lib/legal/eula'

export const PRIVACY_TITLE = 'Privacy Policy'
export const PRIVACY_VERSION = '2026-09-30'
export const PRIVACY_LAST_UPDATED = 'September 30, 2026'
export const PRIVACY_SHORT =
  'Vista Image Studio does not require an account. Editing and AI tools run in your browser or desktop app. The web app needs a network connection to load the Software and its assets. We do not operate a photo-storage or photo-viewing service for your library. The public web app uses Umami, a cookie-free analytics service, to count visits; it never receives your photos. The desktop app has no analytics.'

export type PrivacySection = {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    heading: '1. Who we are',
    paragraphs: [
      `Vista Image Studio is published by ${EULA_LICENSOR} (“we”, “us”). This Privacy Policy describes the desktop application and the web app at ${EULA_SITE_PRIMARY.replace('https://', '')} (together, the “Software”). The publisher and marketing sites include ${EULA_SITE_PUBLISHER.replace('https://', '')} and related pages such as vistaimage.thestreamic.in.`,
      `Contact: ${EULA_CONTACT}.`,
    ],
  },
  {
    heading: '2. Short version',
    paragraphs: [
      PRIVACY_SHORT,
      'Image editing, export, and AI-assisted features (background removal, inpainting, depth/bokeh, and similar tools) are designed to run in the Software on your device — in the app process or a Web Worker in your browser or desktop runtime. We do not operate a service whose purpose is to receive, store, or view your photo library for editing.',
    ],
  },
  {
    heading: '3. Network access (important)',
    paragraphs: [
      'The web application requires network access to load and update HTML, scripts, styles, fonts, WASM runtimes, model files, and other assets from the hosting infrastructure that serves the Software. Without a network connection, the web app generally cannot start or reload those assets.',
      'Desktop builds may still use the network for first-time downloads, updates, or optional features that are disclosed when used. Once models and assets are on disk, many desktop editing flows can continue without further network use, but that is a product characteristic — not a guarantee that every build or session is offline.',
      'Ordinary hosting, CDN, DNS, TLS, and browser or ISP logs may record technical information about requests to load the Software (for example IP address, user-agent, URLs of assets fetched, and timestamps). That infrastructure logging is separate from uploading your photo library to us for editing, and it is not something we hold out as a private, offline product.',
    ],
  },
  {
    heading: '4. What we do not operate',
    paragraphs: [
      'As designed for core editing, the Software does not require you to create an account with us, and it does not include a photo-upload API whose purpose is to send your images to us for cloud editing, cloud storage, or cloud AI inference.',
    ],
    bullets: [
      'No account creation is required to open and edit images in the Software',
      'No advertising identifier, cookie, or personal analytics profile is created. The public web app counts anonymous visits with Umami (see section 7); the desktop app has no analytics',
      'We do not market the Software as a cloud photo library or cloud photo-hosting product',
    ],
  },
  {
    heading: '5. Where your working files are stored',
    paragraphs: [
      'Preferences, theme, first-run state, EULA acceptance, command-chat text, and project autosave are stored locally (browser localStorage / IndexedDB on the web; the operating system application-data folder on desktop). Command chat stores text only — not image pixels or file paths.',
      'Imported photos and thumbnails stay in this browser’s IndexedDB, database vista-media-library, store imports. On Windows that folder is inside the browser profile: %LOCALAPPDATA%\\Google\\Chrome\\User Data\\<Profile>\\IndexedDB\\https_vistaimagestudio.thestreamic.in_0.indexeddb.leveldb, plus the matching .indexeddb.blob folder beside it. Microsoft Edge uses %LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\<Profile>\\IndexedDB\\ with the same site folder name. <Profile> is usually Default, or Profile 1 for another browser profile. The edited project, including processed pixels, is the localStorage key vista-autosave in that same profile under Local Storage. While you edit, the working image is held in memory. A separate file is written only when you export to a folder you choose.',
      'On the desktop app the same data stays under %APPDATA%\\Vista Image Studio\\ (on Windows, C:\\Users\\<you>\\AppData\\Roaming\\Vista Image Studio\\). The last project is autosave\\recovery.lumen in that folder. Imported photos are in the IndexedDB folder inside it, for the lumen://app origin.',
      'Canvas export rebuilds the bitmap, so camera EXIF is not copied into exported images.',
      'Uninstalling the desktop app or clearing this site’s data in your browser removes that locally stored information. We do not provide a server-side user library from which those Local Copies can be recovered after you delete them.',
    ],
  },
  {
    heading: '6. Privacy Centre',
    paragraphs: [
      'The in-app Privacy Centre is a local status panel. It lists the current host (desktop or web), the Content Security Policy connect-src value reported by the build, whether analytics is on (Umami, on the public web app only), and — on desktop — the user-data and autosave paths on that computer. It is not a cloud dashboard and does not imply that the web app works without network access.',
    ],
  },
  {
    heading: '7. Analytics, AI models, and processing',
    paragraphs: [
      'Web analytics. The public web app at vistaimagestudio.thestreamic.in loads Umami Cloud (umami.is), a privacy-focused analytics service, so we can count how many people visit and use the Software. Umami does not use cookies and does not ask for your name or email. For each visit it records the page address, the referring site, browser, operating system, device type, screen size, language, and approximate country. Umami works out the country from your IP address and states that it does not store IP addresses. We also count clicks on a few kinds of links (downloads, legal pages, the guide, and GitHub) by event name only.',
      'We use these counts only to understand how many people use the Software. We do not use them for advertising or to identify you, and analytics never receives your photos, edits, or file names. Analytics does not run in the desktop app, on localhost, or on any other address, and browser content blockers usually block it. Where the GDPR applies, we rely on our legitimate interest in measuring use of the Software in a privacy-friendly way; you can object by emailing us or by using a content blocker.',
      'The desktop app sets a Content Security Policy of connect-src \'self\' blob: data:, so the editor there cannot send data to third-party servers. The editor is not designed to call a third-party cloud LLM or a photo-upload API for core editing.',
      'Crash reporting is off. No crash-reporting SDK is bundled with the Software.',
      'Model files (for example MODNet, LaMa, and MiDaS, where bundled or served with the Software) are loaded as application assets. On the web they are typically fetched over the network like other static assets; on desktop they may already be on disk. They are used to process images in the Software runtime. See the Third-party notices file shipped with the Software for licenses.',
    ],
  },
  {
    heading: '8. Optional contact',
    paragraphs: [
      `If you email ${EULA_CONTACT} for support or feedback, or if you use an optional feedback form that opens your mail client, we receive whatever you choose to send (for example your address, message, and any attachments) so we can reply. We do not use that correspondence to build an advertising profile.`,
    ],
  },
  {
    heading: '9. Marketing pages',
    paragraphs: [
      'Standalone marketing HTML (for example vistaimage.thestreamic.in) is not the editor. That page is not shipped inside the desktop app and may request public information such as GitHub Releases. Visiting marketing pages is separate from editing photos in the Software.',
    ],
  },
  {
    heading: '10. Children',
    paragraphs: [
      'The Software is not directed at children, and we do not knowingly collect personal information from children through the Software.',
    ],
  },
  {
    heading: '11. Your choices and rights',
    paragraphs: [
      'Because core editing does not require an account with us and is not designed to transmit your photo library to a Streamic-operated photo service, there is typically no photo library held by us to access, correct, or erase. You can remove local storage by uninstalling the desktop app or clearing site data in your browser.',
      'If you have contacted us by email, you may ask us to delete that correspondence. If you are in the EEA/UK, you may also have rights of access, rectification, erasure, restriction, and objection, and a right to lodge a complaint with a supervisory authority (in Ireland, the Data Protection Commission).',
    ],
  },
  {
    heading: '12. Changes',
    paragraphs: [
      `We may update this Privacy Policy. Material changes will be indicated by an updated “Last updated” date (${PRIVACY_LAST_UPDATED} for this version). Where a new EULA version is published, the app may ask you to accept it again before use.`,
    ],
  },
  {
    heading: '13. Contact',
    paragraphs: [
      `Questions about this Privacy Policy: ${EULA_CONTACT}.`,
    ],
  },
]

export const PRIVACY_TEXT = [
  `${PRIVACY_TITLE}`,
  `Vista Image Studio`,
  ``,
  `Last updated: ${PRIVACY_LAST_UPDATED}`,
  ``,
  PRIVACY_SHORT,
  ``,
  ...PRIVACY_SECTIONS.flatMap((section) => [
    section.heading,
    '',
    ...section.paragraphs,
    ...(section.bullets?.map((item) => `• ${item}`) ?? []),
    '',
  ]),
].join('\n').trim()
