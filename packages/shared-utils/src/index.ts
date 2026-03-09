import type { ProjectDocument, ThemeValue } from '@procedural-web-composer/shared-types'

export const DEFAULT_THEME: ThemeValue = {
  colors: {
    background: '#f6f1e8',
    surface: '#fffaf1',
    text: '#1f1b17',
    accent: '#c96f36',
  },
  typography: {
    fontFamily: '"Space Grotesk", "IBM Plex Sans", "Avenir Next", sans-serif',
    headingScale: 1.18,
    bodySize: '1rem',
  },
}

export function createId(prefix = 'id'): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export function nowIsoString(): string {
  return new Date().toISOString()
}

export function cloneProjectDocument(project: ProjectDocument): ProjectDocument {
  return structuredClone(project)
}

export function normalizeThemeValue(input: unknown): ThemeValue {
  if (!isRecord(input)) {
    return DEFAULT_THEME
  }

  const colors = isRecord(input.colors) ? input.colors : {}
  const typography = isRecord(input.typography) ? input.typography : {}

  return {
    colors: {
      background: asString(colors.background, DEFAULT_THEME.colors.background),
      surface: asString(colors.surface, DEFAULT_THEME.colors.surface),
      text: asString(colors.text, DEFAULT_THEME.colors.text),
      accent: asString(colors.accent, DEFAULT_THEME.colors.accent),
    },
    typography: {
      fontFamily: asString(typography.fontFamily, DEFAULT_THEME.typography.fontFamily),
      headingScale: asNumber(typography.headingScale, DEFAULT_THEME.typography.headingScale),
      bodySize: asString(typography.bodySize, DEFAULT_THEME.typography.bodySize),
    },
  }
}

export function formatCssUnit(value: unknown, fallback = '0px'): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}px`
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }

  return fallback
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
