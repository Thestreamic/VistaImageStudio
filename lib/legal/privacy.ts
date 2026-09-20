import { EULA_CONTACT, EULA_LICENSOR, EULA_SITE_PRIMARY, EULA_SITE_PUBLISHER } from '@/lib/legal/eula'

export const PRIVACY_TITLE = 'Privacy Policy'
export const PRIVACY_VERSION = '2026-09-20'
export const PRIVACY_LAST_UPDATED = 'September 20, 2026'
export const PRIVACY_SHORT =
  'Your photos stay on your device. Vista Image Studio does not require an account, does not upload your images, and does not send telemetry by default.'

export type PrivacySection = {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    heading: '1. Who we are',
    paragraphs: [
      `Vista Image Studio is published by ${EULA_LICENSOR} (“we”, “us”). This Privacy Policy describes the desktop application and the web app at ${EULA_SITE_PRIMARY.replace('https://', '')} (together, the “Software”). The publisher site is ${EULA_SITE_PUBLISHER.replace('https://', '')}.`,
      `Contact: ${EULA_CONTACT}.`,
    ],
  },
  {
    heading: '2. Short version',
    paragraphs: [
      PRIVACY_SHORT,
      'Editing, export, and on-device AI features (background removal, inpainting, depth/bokeh, and similar tools) run locally in the app process or a local Web Worker. We do not operate servers that receive, store, or view your photos.',
    ],
  },
  {
    heading: '3. What we do not collect',
    paragraphs: ['The Software is designed so that the following never leave your device as part of core editing:'],
    bullets: [
      'The photos, images, or files you open, edit, or export',
      'The pixels of any layer, adjustment, collage, or AI operation',
      'Your file-system paths, except as shown to you in the in-app Privacy Centre on this device',
      'An account, advertising identifier, or analytics profile',
    ],
  },
  {
    heading: '4. What stays on your device',
    paragraphs: [
      'Preferences, theme, first-run state, EULA acceptance, command-chat text, and project autosave are stored locally (browser localStorage / IndexedDB on the web; the operating system application-data folder on desktop). Command chat stores text only — never pixels or file paths.',
      'Canvas export rebuilds the bitmap, so camera EXIF is not copied into exported images.',
      'Uninstalling the desktop app or clearing this site’s data in your browser removes that locally stored information. We have no server-side copy to export or delete.',
    ],
  },
  {
    heading: '5. Privacy Centre',
    paragraphs: [
      'The in-app Privacy Centre lists the current host (desktop or web), the Content Security Policy connect-src value, analytics = off, and — on desktop — the user-data and autosave paths on this computer. It is a local status panel, not a cloud dashboard.',
    ],
  },
  {
    heading: '6. Network, telemetry, and AI',
    paragraphs: [
      'Production Content Security Policy for the Software uses connect-src \'self\' blob: data:. The app does not call a photo-upload API and does not use a cloud LLM.',
      'Analytics and crash reporting are off by default. There is no telemetry SDK in the editor.',
      'On-device model files (for example MODNet, LaMa, and MiDaS, where bundled) are loaded from local folders such as /models. They are not uploaded with your images. See the Third-party notices file shipped with the Software for licenses.',
    ],
  },
  {
    heading: '7. Optional contact',
    paragraphs: [
      `If you email ${EULA_CONTACT} for support or feedback, we receive whatever you choose to send (for example your address, message, and any attachments) so we can reply. We do not use that correspondence to build a marketing profile.`,
    ],
  },
  {
    heading: '8. Marketing pages',
    paragraphs: [
      'Standalone marketing HTML (for example a landing page) is not the editor. That page is not shipped inside the desktop app and may request public information such as GitHub Releases. Visiting it is separate from using the Software.',
    ],
  },
  {
    heading: '9. Children',
    paragraphs: [
      'The Software is not directed at children, and we do not knowingly collect personal information from children through the Software.',
    ],
  },
  {
    heading: '10. Your choices and rights',
    paragraphs: [
      'Because core use does not require an account and does not transmit your photos to us, there is typically no personal data held by us to access, correct, or erase. You can stop local storage by uninstalling the desktop app or clearing site data.',
      'If you have contacted us by email, you may ask us to delete that correspondence. If you are in the EEA/UK, you may also have rights of access, rectification, erasure, restriction, and objection, and a right to lodge a complaint with a supervisory authority (in Ireland, the Data Protection Commission).',
    ],
  },
  {
    heading: '11. Changes',
    paragraphs: [
      `We may update this Privacy Policy. Material changes will be indicated by an updated “Last updated” date (${PRIVACY_LAST_UPDATED} for this version). Where a new EULA version is published, the app may ask you to accept it again before use.`,
    ],
  },
  {
    heading: '12. Contact',
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
