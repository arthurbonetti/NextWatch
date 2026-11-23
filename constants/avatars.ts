import { PixelRatio } from 'react-native';

export const AVATAR_PRESET_IDS = [
  'matrix',
  'kill-bill',
  'godfather',
  'batman',
  'interstellar',
  'jurassic',
  'naruto',
  'fullmetal',
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESET_IDS)[number];
export type AvatarType = 'initials' | 'preset' | 'custom';

export type AvatarPresetSources = {
  80: number;
  128: number;
  208: number;
  384: number;
};

export type AvatarPresetOption = {
  id: AvatarPresetId;
  label: string;
  accentColor: string;
  source: number;
  sources: AvatarPresetSources;
};

const PRESET_ID_SET = new Set<string>(AVATAR_PRESET_IDS);

export const AVATAR_PRESETS: readonly AvatarPresetOption[] = [
  {
    id: 'matrix',
    label: 'Matrix',
    accentColor: '#1DB954',
    source: require('@/assets/images/avatars/matrix.png'),
    sources: {
      80: require('@/assets/images/avatars/matrix-80.png'),
      128: require('@/assets/images/avatars/matrix-128.png'),
      208: require('@/assets/images/avatars/matrix-208.png'),
      384: require('@/assets/images/avatars/matrix.png'),
    },
  },
  {
    id: 'kill-bill',
    label: 'Kill Bill',
    accentColor: '#F3B43F',
    source: require('@/assets/images/avatars/kill-bill.png'),
    sources: {
      80: require('@/assets/images/avatars/kill-bill-80.png'),
      128: require('@/assets/images/avatars/kill-bill-128.png'),
      208: require('@/assets/images/avatars/kill-bill-208.png'),
      384: require('@/assets/images/avatars/kill-bill.png'),
    },
  },
  {
    id: 'godfather',
    label: 'Chefão',
    accentColor: '#C53030',
    source: require('@/assets/images/avatars/godfather.png'),
    sources: {
      80: require('@/assets/images/avatars/godfather-80.png'),
      128: require('@/assets/images/avatars/godfather-128.png'),
      208: require('@/assets/images/avatars/godfather-208.png'),
      384: require('@/assets/images/avatars/godfather.png'),
    },
  },
  {
    id: 'batman',
    label: 'Batman',
    accentColor: '#2563EB',
    source: require('@/assets/images/avatars/batman.png'),
    sources: {
      80: require('@/assets/images/avatars/batman-80.png'),
      128: require('@/assets/images/avatars/batman-128.png'),
      208: require('@/assets/images/avatars/batman-208.png'),
      384: require('@/assets/images/avatars/batman.png'),
    },
  },
  {
    id: 'interstellar',
    label: 'Interestelar',
    accentColor: '#8B5CF6',
    source: require('@/assets/images/avatars/interstellar.png'),
    sources: {
      80: require('@/assets/images/avatars/interstellar-80.png'),
      128: require('@/assets/images/avatars/interstellar-128.png'),
      208: require('@/assets/images/avatars/interstellar-208.png'),
      384: require('@/assets/images/avatars/interstellar.png'),
    },
  },
  {
    id: 'jurassic',
    label: 'Jurassic',
    accentColor: '#0D9488',
    source: require('@/assets/images/avatars/jurassic.png'),
    sources: {
      80: require('@/assets/images/avatars/jurassic-80.png'),
      128: require('@/assets/images/avatars/jurassic-128.png'),
      208: require('@/assets/images/avatars/jurassic-208.png'),
      384: require('@/assets/images/avatars/jurassic.png'),
    },
  },
  {
    id: 'naruto',
    label: 'Naruto',
    accentColor: '#F97316',
    source: require('@/assets/images/avatars/naruto.png'),
    sources: {
      80: require('@/assets/images/avatars/naruto-80.png'),
      128: require('@/assets/images/avatars/naruto-128.png'),
      208: require('@/assets/images/avatars/naruto-208.png'),
      384: require('@/assets/images/avatars/naruto.png'),
    },
  },
  {
    id: 'fullmetal',
    label: 'Fullmetal',
    accentColor: '#94A3B8',
    source: require('@/assets/images/avatars/fullmetal.png'),
    sources: {
      80: require('@/assets/images/avatars/fullmetal-80.png'),
      128: require('@/assets/images/avatars/fullmetal-128.png'),
      208: require('@/assets/images/avatars/fullmetal-208.png'),
      384: require('@/assets/images/avatars/fullmetal.png'),
    },
  },
];

export function isAvatarPresetId(value: unknown): value is AvatarPresetId {
  return typeof value === 'string' && PRESET_ID_SET.has(value);
}

export function isAvatarType(value: unknown): value is AvatarType {
  return value === 'initials' || value === 'preset' || value === 'custom';
}

export function getAvatarPresetById(id?: string | null): AvatarPresetOption | null {
  if (!isAvatarPresetId(id)) return null;
  return AVATAR_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function getAvatarPresetSource(
  preset: AvatarPresetOption,
  displaySizePx: number,
  pixelRatio = PixelRatio.get(),
): number {
  const targetPx = Math.round(Math.max(1, displaySizePx) * Math.max(1, pixelRatio));
  if (targetPx <= 60) return preset.sources[80];
  if (targetPx <= 108) return preset.sources[128];
  if (targetPx <= 192) return preset.sources[208];
  return preset.sources[384];
}
