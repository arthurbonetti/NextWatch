import { FONT_FAMILIES } from '@/constants/typography';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedThemeMode = 'light' | 'dark';

export type ThemeColors = {
  // Tokens semânticos principais
  bgPrimary: string;
  bgSurface: string;
  bgSurfaceAlt: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Destaque e identidade
  accentPrimary: string;
  textOnAccent: string;
  accentLink: string;
  heroBg: string;
  heroBorder: string;
  heroGlow: string;

  // Chips (inativos e selecionados)
  chipBg: string;
  chipBorder: string;
  chipText: string;
  chipIcon: string;
  chipSelectedBg: string;
  chipSelectedBorder: string;
  chipSelectedText: string;
  chipSelectedIcon: string;

  // Favorito / salvo
  savedActiveBg: string;
  savedActiveBorder: string;
  savedActiveIcon: string;
  savedActiveText: string;

  // Ações destrutivas
  dangerText: string;
  dangerIconBg: string;
  dangerBorder: string;
  dangerSolidBg: string;

  // Barra de navegação inferior flutuante
  tabBarBg: string;
  tabBarBorder: string;
  tabBarShadow: string;
  tabBarActiveBg: string;
  tabBarActiveBorder: string;
  tabBarActiveTint: string;
  tabBarInactiveTint: string;

  // Formulários, botões e avatares
  primaryButtonBg: string;
  primaryButtonText: string;
  borderFocused: string;
  avatarBg: string;
  avatarBorder: string;
  avatarText: string;

  // Tokens de compatibilidade e auxiliares
  bgCanvas: string;
  bgCard: string;
  bgSubtle: string;
  bgWarm: string;
  bgHighlight: string;
  bgWarning: string;
  bgSuccess: string;
  bgDanger: string;
  navy: string;
  navyElevated: string;
  navyMuted: string;
  borderDark: string;
  borderLight: string;
  borderMedium: string;
  borderWarm: string;
  borderWarning: string;
  borderSuccess: string;
  borderDanger: string;
  handle: string;
  gold: string;
  goldLight: string;
  accent: string;
  accentDeep: string;
  accentText: string;
  textStrongBody: string;
  textBody: string;
  textSubtle: string;
  textWarm: string;
  textWarmMuted: string;
  textOnNavy: string;
  textOnNavyMuted: string;
  mcGreen: string;
  mcYellow: string;
  mcRed: string;
  successText: string;
  skeletonBase: string;
  skeletonHighlight: string;
  backdropOverlay: string;
  backdropDark: string;
  closeOverlay: string;
  posterScrim: string;
  cardOverlaySubtle: string;
  cardBorderOverlay: string;
  cardFadeTransparent: string;
  cardFadeMid: string;
  canvasFadeTransparent: string;
  canvasFadeMid: string;
  transparent: string;
};

const sharedMetrics = {
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
    backdropFadeMs: 180,
    modalExitMs: 150,
    disclosureOpenMs: 250,
    disclosureCloseMs: 195,
    centerEnterSpring: { damping: 24, stiffness: 360, mass: 0.78 },
    sheetEnterSpring: { damping: 26, stiffness: 340, mass: 0.8 },
    sheetDragSnapSpring: { damping: 28, stiffness: 360 },
    layoutSpring: { damping: 30, stiffness: 360, mass: 0.75 },
    switchDurationMs: 160,
    chipColorDurationMs: 120,
    pressDurationMs: 85,
  },
} as const;

export const lightColors: ThemeColors = {
  bgPrimary: '#FAF7F2',
  bgSurface: '#FFFFFF',
  bgSurfaceAlt: '#F3EFEA',
  borderSubtle: '#E8E2D5',
  textPrimary: '#182230',
  textSecondary: '#5E5C57',
  textMuted: '#687078',

  accentPrimary: '#F3B43F',
  textOnAccent: '#182230',
  accentLink: '#9C5A14',
  heroBg: '#182230',
  heroBorder: '#263442',
  heroGlow: '#223246',

  chipBg: '#FFFFFF',
  chipBorder: '#DED8CD',
  chipText: '#5E5C57',
  chipIcon: '#6B5943',
  chipSelectedBg: '#182230',
  chipSelectedBorder: '#182230',
  chipSelectedText: '#FFFDF8',
  chipSelectedIcon: '#F3B43F',

  savedActiveBg: '#FFF2D8',
  savedActiveBorder: '#E58C34',
  savedActiveIcon: '#E58C34',
  savedActiveText: '#9C5A14',

  dangerText: '#C0392B',
  dangerIconBg: '#FDECEA',
  dangerBorder: '#F1D6D3',
  dangerSolidBg: '#C0392B',

  tabBarBg: '#182230',
  tabBarBorder: '#263442',
  tabBarShadow: 'rgba(24, 34, 48, 0.24)',
  tabBarActiveBg: 'rgba(243, 180, 63, 0.15)',
  tabBarActiveBorder: '#F3B43F',
  tabBarActiveTint: '#F3B43F',
  tabBarInactiveTint: '#A9B1B8',

  primaryButtonBg: '#182230',
  primaryButtonText: '#FFFDF8',
  borderFocused: '#182230',
  avatarBg: '#182230',
  avatarBorder: '#E8E2D5',
  avatarText: '#F3B43F',

  bgCanvas: '#FAF7F2',
  bgCard: '#FFFFFF',
  bgSubtle: '#F3EFEA',
  bgWarm: '#F1E8D7',
  bgHighlight: '#FFF2D8',
  bgWarning: '#F6EBD4',
  bgSuccess: '#E5EFE7',
  bgDanger: '#FDECEA',
  navy: '#182230',
  navyElevated: '#223246',
  navyMuted: '#263B50',
  borderDark: '#263442',
  borderLight: '#E8E2D5',
  borderMedium: '#DED8CD',
  borderWarm: '#E5DAC3',
  borderWarning: '#EBD9B3',
  borderSuccess: '#B8DAC0',
  borderDanger: '#F5C6C2',
  handle: '#D8D3C9',
  gold: '#F3B43F',
  goldLight: '#F8CB6B',
  accent: '#E58C34',
  accentDeep: '#D77C29',
  accentText: '#9C5A14',
  textStrongBody: '#2F3742',
  textBody: '#565D63',
  textSubtle: '#7B7B78',
  textWarm: '#6B5943',
  textWarmMuted: '#8D7A61',
  textOnNavy: '#FFFDF8',
  textOnNavyMuted: '#BDC6CE',
  mcGreen: '#2E8B57',
  mcYellow: '#D49B27',
  mcRed: '#C0392B',
  successText: '#216941',
  skeletonBase: '#E8E2D5',
  skeletonHighlight: '#F3EFE6',
  backdropOverlay: 'rgba(24, 34, 48, 0.58)',
  backdropDark: 'rgba(9, 15, 23, 0.84)',
  closeOverlay: 'rgba(15, 20, 28, 0.56)',
  posterScrim: 'rgba(9, 15, 23, 0.48)',
  cardOverlaySubtle: 'rgba(255, 253, 248, 0.16)',
  cardBorderOverlay: 'rgba(255, 253, 248, 0.24)',
  cardFadeTransparent: 'rgba(255, 255, 255, 0)',
  cardFadeMid: 'rgba(255, 255, 255, 0.72)',
  canvasFadeTransparent: 'rgba(250, 247, 242, 0)',
  canvasFadeMid: 'rgba(250, 247, 242, 0.78)',
  transparent: 'transparent',
};

export const darkColors: ThemeColors = {
  bgPrimary: '#0F141B',
  bgSurface: '#171E28',
  bgSurfaceAlt: '#212A38',
  borderSubtle: '#263040',
  textPrimary: '#F4F1EA',
  textSecondary: '#9AA4B2',
  textMuted: '#647082',

  accentPrimary: '#F2AE30',
  textOnAccent: '#12171F',
  accentLink: '#E59838',
  heroBg: '#1C2533',
  heroBorder: '#2E3B4E',
  heroGlow: '#243144',

  chipBg: '#212A38',
  chipBorder: '#263040',
  chipText: '#9AA4B2',
  chipIcon: '#9AA4B2',
  chipSelectedBg: '#F2AE30',
  chipSelectedBorder: '#F2AE30',
  chipSelectedText: '#12171F',
  chipSelectedIcon: '#12171F',

  savedActiveBg: '#2E2416',
  savedActiveBorder: '#F2AE30',
  savedActiveIcon: '#F2AE30',
  savedActiveText: '#F2AE30',

  dangerText: '#F87171',
  dangerIconBg: '#2A181B',
  dangerBorder: '#442328',
  dangerSolidBg: '#DC2626',

  tabBarBg: '#1C2430',
  tabBarBorder: '#2D3748',
  tabBarShadow: 'rgba(0, 0, 0, 0.52)',
  tabBarActiveBg: 'rgba(242, 174, 48, 0.14)',
  tabBarActiveBorder: '#F2AE30',
  tabBarActiveTint: '#F2AE30',
  tabBarInactiveTint: '#9AA4B2',

  primaryButtonBg: '#F2AE30',
  primaryButtonText: '#12171F',
  borderFocused: '#F2AE30',
  avatarBg: '#212A38',
  avatarBorder: '#2E3B4E',
  avatarText: '#F2AE30',

  bgCanvas: '#0F141B',
  bgCard: '#171E28',
  bgSubtle: '#212A38',
  bgWarm: '#1E2530',
  bgHighlight: '#2E2416',
  bgWarning: '#2D2316',
  bgSuccess: '#172C22',
  bgDanger: '#2A181B',
  navy: '#1C2533',
  navyElevated: '#243144',
  navyMuted: '#28364A',
  borderDark: '#2E3B4E',
  borderLight: '#263040',
  borderMedium: '#2E3A4D',
  borderWarm: '#3D3222',
  borderWarning: '#4B3920',
  borderSuccess: '#27533B',
  borderDanger: '#53282E',
  handle: '#3A4659',
  gold: '#F2AE30',
  goldLight: '#F5C45E',
  accent: '#E59838',
  accentDeep: '#E59838',
  accentText: '#E59838',
  textStrongBody: '#DCE1E8',
  textBody: '#B8C0CC',
  textSubtle: '#828E9F',
  textWarm: '#D6B07A',
  textWarmMuted: '#9E8D76',
  textOnNavy: '#F4F1EA',
  textOnNavyMuted: '#9AA4B2',
  mcGreen: '#2E8B57',
  mcYellow: '#D49B27',
  mcRed: '#DC2626',
  successText: '#4ADE80',
  skeletonBase: '#1E2734',
  skeletonHighlight: '#2A3648',
  backdropOverlay: 'rgba(5, 8, 13, 0.72)',
  backdropDark: 'rgba(4, 7, 11, 0.88)',
  closeOverlay: 'rgba(10, 14, 20, 0.72)',
  posterScrim: 'rgba(6, 10, 16, 0.56)',
  cardOverlaySubtle: 'rgba(244, 241, 234, 0.10)',
  cardBorderOverlay: 'rgba(244, 241, 234, 0.16)',
  cardFadeTransparent: 'rgba(23, 30, 40, 0)',
  cardFadeMid: 'rgba(23, 30, 40, 0.76)',
  canvasFadeTransparent: 'rgba(15, 20, 27, 0)',
  canvasFadeMid: 'rgba(15, 20, 27, 0.78)',
  transparent: 'transparent',
};

export type Theme = typeof sharedMetrics & {
  mode: ResolvedThemeMode;
  isDark: boolean;
  colors: ThemeColors;
};

export const lightTheme: Theme = {
  ...sharedMetrics,
  mode: 'light',
  isDark: false,
  colors: lightColors,
};

export const darkTheme: Theme = {
  ...sharedMetrics,
  mode: 'dark',
  isDark: true,
  colors: darkColors,
};

export const THEME = lightTheme;

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
 * garantindo contraste mínimo sobre a superfície do tema ativo ou fallback para o dourado.
 */
export function resolveTitleAccentColor(color?: string | null, isDark = false): string {
  const fallback = isDark ? darkColors.accentPrimary : lightColors.accent;
  if (!color) return fallback;
  const rgb = parseHexRgb(color);
  if (!rgb) return fallback;

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  const maxChannel = Math.max(rgb.r, rgb.g, rgb.b);
  const minChannel = Math.min(rgb.r, rgb.g, rgb.b);
  const saturation = maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;

  if (isDark) {
    if (luminance < 0.38 || luminance > 0.90 || saturation < 0.14) {
      return darkColors.accentPrimary;
    }
    return color;
  }

  if (luminance > 0.78 || luminance < 0.12 || saturation < 0.12) {
    return lightColors.gold;
  }

  return color;
}
