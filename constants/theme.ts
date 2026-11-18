import { FONT_FAMILIES } from '@/constants/typography';

export const THEME = {
  colors: {
    bgCanvas: '#f7f5f0',
    bgCard: '#fffdf8',
    bgSubtle: '#f1eee7',
    bgWarm: '#f1e8d7',
    bgHighlight: '#fff2d8',
    bgWarning: '#f6ebd4',
    bgSuccess: '#e5efe7',
    bgDanger: '#fdecea',
    navy: '#182230',
    navyElevated: '#223246',
    navyMuted: '#263b50',
    borderDark: '#263442',
    borderLight: '#e8e2d5',
    borderMedium: '#ded8cd',
    borderWarm: '#e5dac3',
    borderWarning: '#ebd9b3',
    borderSuccess: '#b8dac0',
    borderDanger: '#f5c6c2',
    handle: '#d8d3c9',
    gold: '#f3b43f',
    goldLight: '#f8cb6b',
    accent: '#e58c34',
    accentDeep: '#d77c29',
    accentText: '#a3520d',
    textPrimary: '#182230',
    textStrongBody: '#2f3742',
    textSecondary: '#5e5c57',
    textBody: '#565d63',
    textMuted: '#687078',
    textSubtle: '#7b7b78',
    textWarm: '#6b5943',
    textWarmMuted: '#8d7a61',
    textOnNavy: '#fffdf8',
    textOnNavyMuted: '#bdc6ce',
    mcGreen: '#2e8b57',
    mcYellow: '#d49b27',
    mcRed: '#c0392b',
    successText: '#216941',
    skeletonBase: '#e8e2d5',
    skeletonHighlight: '#f3efe6',
    backdropOverlay: 'rgba(24, 34, 48, 0.58)',
    backdropDark: 'rgba(9, 15, 23, 0.84)',
    closeOverlay: 'rgba(15, 20, 28, 0.56)',
    posterScrim: 'rgba(9, 15, 23, 0.48)',
    cardOverlaySubtle: 'rgba(255, 253, 248, 0.16)',
    cardBorderOverlay: 'rgba(255, 253, 248, 0.24)',
    cardFadeTransparent: 'rgba(255, 253, 248, 0)',
    cardFadeMid: 'rgba(255, 253, 248, 0.72)',
    canvasFadeTransparent: 'rgba(247, 245, 240, 0)',
    canvasFadeMid: 'rgba(247, 245, 240, 0.78)',
    transparent: 'transparent',
  },
  spacing: {
    none: 0,
    xxs: 2,
    xs: 4,
    sm: 6,
    md: 8,
    base: 10,
    lg: 12,
    xl: 14,
    xxl: 16,
    s18: 18,
    s20: 20,
    s22: 22,
    s24: 24,
    s28: 28,
    s32: 32,
  },
  radius: {
    xs: 8,
    sm: 10,
    md: 12,
    lg: 14,
    xl: 16,
    pill: 18,
    xxl: 20,
    card: 24,
    sheet: 26,
    full: 999,
  },
  touchTarget: {
    min: 44,
    button: 50,
    cta: 52,
  },
  fonts: FONT_FAMILIES,
  fontSizes: {
    xs: 10,
    sm: 11,
    caption: 12,
    bodySm: 13,
    bodyMd: 14,
    body: 15,
    sub: 17,
    titleSm: 19,
    title: 22,
    titleLg: 25,
  },
  lineHeights: {
    xs: 13,
    sm: 15,
    caption: 17,
    bodySm: 18,
    bodyMd: 20,
    body: 22,
    sub: 24,
    title: 27,
    titleLg: 30,
  },
  motion: {
    backdropFadeMs: 160,
    centerEnterSpring: { damping: 24, stiffness: 360, mass: 0.78 },
    sheetEnterSpring: { damping: 26, stiffness: 340, mass: 0.8 },
    sheetDragSnapSpring: { damping: 28, stiffness: 360 },
    layoutSpring: { damping: 30, stiffness: 360, mass: 0.75 },
    switchDurationMs: 160,
    chipColorDurationMs: 120,
    pressDurationMs: 85,
  },
} as const;

const SAFE_HEX_REGEX = /^#([0-9a-fA-F]{6})$/;

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = SAFE_HEX_REGEX.exec(hex.trim());
  if (!match) return null;
  const raw = match[1]!;
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
}

/**
 * Converte uma cor hex #RRGGBB em rgba com transparência controlada.
 */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return `rgba(229, 140, 52, ${alpha})`;
  const clamped = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamped})`;
}

/**
 * Resolve a cor de destaque derivada da cor dominante do pôster,
 * garantindo contraste mínimo sobre o card creme ou fallback para o dourado do tema.
 */
export function resolveTitleAccentColor(color?: string | null): string {
  if (!color) return THEME.colors.accent;
  const rgb = parseHexRgb(color);
  if (!rgb) return THEME.colors.accent;

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  const maxChannel = Math.max(rgb.r, rgb.g, rgb.b);
  const minChannel = Math.min(rgb.r, rgb.g, rgb.b);
  const saturation = maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;

  if (luminance > 0.78 || luminance < 0.12 || saturation < 0.12) {
    return THEME.colors.gold;
  }

  return color;
}
