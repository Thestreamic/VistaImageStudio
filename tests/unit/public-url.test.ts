import { afterEach, describe, expect, it } from 'vitest'
import {
  absolutePublicHref,
  inferPublicBasePath,
  publicUrl,
  setPublicBasePath,
} from '@/lib/public-url'

afterEach(() => {
  setPublicBasePath(null)
})

describe('inferPublicBasePath', () => {
  it('stays empty on localhost', () => {
    expect(
      inferPublicBasePath({
        protocol: 'http:',
        hostname: 'localhost',
        pathname: '/models/modnet.onnx',
      }),
    ).toBe('')
  })

  it('reads the repo folder from a GitHub Pages worker URL', () => {
    expect(
      inferPublicBasePath({
        protocol: 'https:',
        hostname: 'alice.github.io',
        pathname: '/VistaImageStudio/_next/static/chunks/ai.worker.js',
      }),
    ).toBe('/VistaImageStudio')
  })

  it('reads the repo folder from a GitHub Pages window URL', () => {
    expect(
      inferPublicBasePath({
        protocol: 'https:',
        hostname: 'alice.github.io',
        pathname: '/VistaImageStudio/',
      }),
    ).toBe('/VistaImageStudio')
  })

  it('stays empty on a user GitHub Pages root site', () => {
    expect(
      inferPublicBasePath({
        protocol: 'https:',
        hostname: 'alice.github.io',
        pathname: '/index.html',
      }),
    ).toBe('')
  })

  it('ignores file:// Electron paths', () => {
    expect(
      inferPublicBasePath({
        protocol: 'file:',
        hostname: '',
        pathname: '/C:/app/out/_next/static/chunks/ai.worker.js',
      }),
    ).toBe('')
  })
})

describe('publicUrl', () => {
  it('prefixes model paths when a runtime base is set', () => {
    setPublicBasePath('/VistaImageStudio')
    expect(publicUrl('/models/modnet.onnx')).toBe('/VistaImageStudio/models/modnet.onnx')
    expect(publicUrl('/ort/')).toBe('/VistaImageStudio/ort/')
  })

  it('does not double-prefix', () => {
    setPublicBasePath('/VistaImageStudio')
    expect(publicUrl('/VistaImageStudio/models/lama.onnx')).toBe(
      '/VistaImageStudio/models/lama.onnx',
    )
  })

  it('uses an explicit location when env and override are empty', () => {
    expect(
      publicUrl('/models/lama.onnx', {
        protocol: 'https:',
        hostname: 'alice.github.io',
        pathname: '/VistaImageStudio/',
      }),
    ).toBe('/VistaImageStudio/models/lama.onnx')
  })

  it('does not prefix models on a custom domain even if env is set', () => {
    const prev = process.env.NEXT_PUBLIC_BASE_PATH
    process.env.NEXT_PUBLIC_BASE_PATH = '/VistaImageStudio'
    try {
      expect(
        publicUrl('/models/modnet.onnx', {
          protocol: 'https:',
          hostname: 'vistaimagestudio.thestreamic.in',
          pathname: '/',
        }),
      ).toBe('/models/modnet.onnx')
    } finally {
      if (prev == null) delete process.env.NEXT_PUBLIC_BASE_PATH
      else process.env.NEXT_PUBLIC_BASE_PATH = prev
    }
  })
})

describe('absolutePublicHref', () => {
  it('resolves blob workers against the page origin on localhost', () => {
    expect(
      absolutePublicHref('/models/modnet.onnx', {
        protocol: 'blob:',
        href: 'blob:http://localhost:3000/abc',
        origin: 'http://localhost:3000',
      }),
    ).toBe('http://localhost:3000/models/modnet.onnx')
  })

  it('keeps the GitHub Pages repo prefix for blob workers', () => {
    setPublicBasePath('/VistaImageStudio')
    expect(
      absolutePublicHref('/models/lama.onnx', {
        protocol: 'blob:',
        href: 'blob:https://alice.github.io/abc',
        origin: 'https://alice.github.io',
      }),
    ).toBe('https://alice.github.io/VistaImageStudio/models/lama.onnx')
  })

  it('resolves the packaged Electron lumen:// origin', () => {
    expect(
      absolutePublicHref('/models/modnet.onnx', {
        protocol: 'lumen:',
        hostname: 'app',
        origin: 'lumen://app',
        href: 'lumen://app/index.html',
        pathname: '/index.html',
      }),
    ).toBe('lumen://app/models/modnet.onnx')
  })
})
