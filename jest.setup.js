// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// WAŻNE: Mock next/headers MUSI być na samym początku, przed wszystkimi importami
// które mogą używać cookies()
jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(() => undefined),
    set: jest.fn(() => {}),
    delete: jest.fn(() => {}),
    getAll: jest.fn(() => []),
  })),
}));

// Ustaw zmienne środowiskowe Supabase dla testów
// (zapobiega błędom "supabaseUrl is required" w testach PDF/email)
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";

// Polyfill for TextEncoder/TextDecoder (needed by undici)
const { TextEncoder, TextDecoder } = require('util')
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Polyfill for ReadableStream (needed by undici)
if (typeof global.ReadableStream === 'undefined') {
  try {
    global.ReadableStream = require('stream/web').ReadableStream
  } catch (e) {
    // ReadableStream może być już dostępny w Node.js 18+
  }
}

// Polyfill for HTMLCanvasElement (needed by jsPDF)
if (typeof global.HTMLCanvasElement === 'undefined') {
  global.HTMLCanvasElement = class HTMLCanvasElement {
    getContext() {
      // Zwróć prosty mock context dla jsPDF
      return {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        fillRect: jest.fn(),
        strokeRect: jest.fn(),
        clearRect: jest.fn(),
        getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
        putImageData: jest.fn(),
        createImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
        setTransform: jest.fn(),
        drawImage: jest.fn(),
        save: jest.fn(),
        restore: jest.fn(),
        beginPath: jest.fn(),
        closePath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        bezierCurveTo: jest.fn(),
        quadraticCurveTo: jest.fn(),
        arc: jest.fn(),
        arcTo: jest.fn(),
        rect: jest.fn(),
        fill: jest.fn(),
        stroke: jest.fn(),
        clip: jest.fn(),
        isPointInPath: jest.fn(),
        scale: jest.fn(),
        rotate: jest.fn(),
        translate: jest.fn(),
        transform: jest.fn(),
        setLineDash: jest.fn(),
        getLineDash: jest.fn(() => []),
        measureText: jest.fn(() => ({ width: 0 })),
        set textAlign(value) {},
        set textBaseline(value) {},
        set direction(value) {},
        set font(value) {},
        set globalAlpha(value) {},
        set globalCompositeOperation(value) {},
        set imageSmoothingEnabled(value) {},
        set imageSmoothingQuality(value) {},
      };
    }
  };
}

// Polyfill for Web APIs (Request, Response, etc.) needed for Next.js 16
const { Request, Response, Headers } = require('undici')

global.Request = Request
global.Response = Response
global.Headers = Headers

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    }
  },
  usePathname() {
    return '/'
  },
  useSearchParams() {
    return new URLSearchParams()
  },
}))

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    replace: jest.fn(),
    href: 'http://localhost:3000',
  },
  writable: true,
})

// Mock fetch globally
global.fetch = jest.fn()

// Mock toast from sonner
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}))

// Mock jsPDF - całkowicie zmockuj przed importem
jest.mock('jspdf', () => {
  return {
    jsPDF: jest.fn().mockImplementation(() => {
      const mockDoc = {
        setFontSize: jest.fn().mockReturnThis(),
        setFont: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        splitTextToSize: jest.fn((text) => [text]),
        setFillColor: jest.fn().mockReturnThis(),
        rect: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        output: jest.fn((format) => {
          if (format === 'arraybuffer') {
            return new ArrayBuffer(100)
          }
          return Buffer.from('mock-pdf-data')
        }),
      }
      return mockDoc
    }),
  }
})
