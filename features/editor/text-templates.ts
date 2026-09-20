import type { TextLayerData } from './types'
import { defaultTextData } from './types'

export interface TextTemplate {
  id: string
  label: string
  /** Small inline preview swatch styling, shown on the template button itself. */
  preview: { fontFamily: string; fontWeight: number; fontSize: number; uppercase?: boolean }
  /** A distinct accent color per template so the grid reads as colorful choices, not identical grey buttons. */
  accent: string
  data: () => TextLayerData
}

/**
 * The handful of title/caption styles that cover most social posts: a bold
 * hero headline, a clean subtitle, a pull-quote, and two "sticker" style
 * highlight captions Canva made ubiquitous on Reels/Stories.
 */
export const TEXT_TEMPLATES: TextTemplate[] = [
  {
    id: 'bold-headline',
    accent: '#ff5ea6',
    label: 'Bold Headline',
    preview: { fontFamily: 'Inter', fontWeight: 800, fontSize: 15 },
    data: () => defaultTextData({
      content: 'BOLD HEADLINE',
      fontFamily: 'Inter',
      fontWeight: 800,
      fontSize: 88,
      uppercase: true,
      letterSpacing: -1,
    }),
  },
  {
    id: 'elegant-subtitle',
    accent: '#7c5cff',
    label: 'Elegant Subtitle',
    preview: { fontFamily: 'Playfair Display', fontWeight: 500, fontSize: 15 },
    data: () => defaultTextData({
      content: 'Elegant Subtitle',
      fontFamily: 'Playfair Display',
      fontWeight: 500,
      fontSize: 52,
      letterSpacing: 0.5,
    }),
  },
  {
    id: 'quote',
    accent: '#4f9dff',
    label: 'Pull Quote',
    preview: { fontFamily: 'Georgia', fontWeight: 400, fontSize: 15 },
    data: () => defaultTextData({
      content: '“Your quote\ngoes here”',
      fontFamily: 'Georgia',
      fontWeight: 400,
      fontSize: 46,
      lineHeight: 1.3,
    }),
  },
  {
    id: 'highlight-caption',
    accent: '#ffb020',
    label: 'Highlight Caption',
    preview: { fontFamily: 'Poppins', fontWeight: 700, fontSize: 15 },
    data: () => defaultTextData({
      content: 'TAP TO SHOP',
      fontFamily: 'Poppins',
      fontWeight: 700,
      fontSize: 40,
      uppercase: true,
      color: '#14161c',
      backgroundColor: '#ffe066',
    }),
  },
  {
    id: 'story-sticker',
    accent: '#22c99e',
    label: 'Story Sticker',
    preview: { fontFamily: 'Montserrat', fontWeight: 600, fontSize: 15 },
    data: () => defaultTextData({
      content: 'NEW POST 🔥',
      fontFamily: 'Montserrat',
      fontWeight: 600,
      fontSize: 36,
      color: '#ffffff',
      backgroundColor: 'rgba(20,22,28,0.72)',
    }),
  },
  {
    id: 'minimal-caption',
    accent: '#f97362',
    label: 'Minimal Caption',
    preview: { fontFamily: 'Inter', fontWeight: 400, fontSize: 15 },
    data: () => defaultTextData({
      content: 'Add a caption',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      color: '#ffffff',
      strokeColor: 'rgba(0,0,0,0.6)',
      strokeWidth: 4,
    }),
  },
]

export interface QuickStartTemplate {
  id: string
  label: string
  width: number
  height: number
  accent: string
  /** Text preset dropped onto the new canvas immediately, positioned like a real post. */
  textTemplateId: string
}

/**
 * One-click "post" starters — the combination Canva's home screen leans on
 * hardest: pick a real post format, land with title text already placed,
 * so a creator is styling copy in seconds instead of staring at a blank
 * canvas and hunting for the right pixel size first.
 */
export const QUICK_START_TEMPLATES: QuickStartTemplate[] = [
  { id: 'ig-announcement', label: 'Instagram Announcement', width: 1080, height: 1080, accent: '#ff5ea6', textTemplateId: 'bold-headline' },
  { id: 'yt-thumbnail', label: 'YouTube Thumbnail', width: 1280, height: 720, accent: '#f97362', textTemplateId: 'highlight-caption' },
  { id: 'linkedin-update', label: 'LinkedIn Update', width: 1200, height: 627, accent: '#4f9dff', textTemplateId: 'elegant-subtitle' },
  { id: 'story-post', label: 'Instagram / TikTok Story', width: 1080, height: 1920, accent: '#22c99e', textTemplateId: 'story-sticker' },
]

export interface SizeTemplate {
  id: string
  label: string
  width: number
  height: number
  group: 'Social' | 'Print & Web'
}

/** Canvas-size presets covering the formats social media users reach for most. */
export const SIZE_TEMPLATES: SizeTemplate[] = [
  { id: 'ig-post', label: 'Instagram Post', width: 1080, height: 1080, group: 'Social' },
  { id: 'ig-story', label: 'Instagram Story / Reel', width: 1080, height: 1920, group: 'Social' },
  { id: 'ig-portrait', label: 'Instagram Portrait', width: 1080, height: 1350, group: 'Social' },
  { id: 'fb-post', label: 'Facebook Post', width: 1200, height: 630, group: 'Social' },
  { id: 'x-post', label: 'X / Twitter Post', width: 1600, height: 900, group: 'Social' },
  { id: 'yt-thumb', label: 'YouTube Thumbnail', width: 1280, height: 720, group: 'Social' },
  { id: 'pinterest', label: 'Pinterest Pin', width: 1000, height: 1500, group: 'Social' },
  { id: 'tiktok', label: 'TikTok Video Cover', width: 1080, height: 1920, group: 'Social' },
  { id: 'a4', label: 'A4 Document (300dpi)', width: 2480, height: 3508, group: 'Print & Web' },
  { id: 'hd', label: 'HD Wallpaper', width: 1920, height: 1080, group: 'Print & Web' },
]
