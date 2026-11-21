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

export type AvatarPresetOption = {
  id: AvatarPresetId;
  label: string;
  accentColor: string;
  source: number;
};

const PRESET_ID_SET = new Set<string>(AVATAR_PRESET_IDS);

export const AVATAR_PRESETS: readonly AvatarPresetOption[] = [
  {
    id: 'matrix',
    label: 'Matrix',
    accentColor: '#1DB954',
    source: require('@/assets/images/avatars/matrix.png'),
  },
  {
    id: 'kill-bill',
    label: 'Kill Bill',
    accentColor: '#F3B43F',
    source: require('@/assets/images/avatars/kill-bill.png'),
  },
  {
    id: 'godfather',
    label: 'Chefão',
    accentColor: '#C53030',
    source: require('@/assets/images/avatars/godfather.png'),
  },
  {
    id: 'batman',
    label: 'Batman',
    accentColor: '#2563EB',
    source: require('@/assets/images/avatars/batman.png'),
  },
  {
    id: 'interstellar',
    label: 'Interestelar',
    accentColor: '#8B5CF6',
    source: require('@/assets/images/avatars/interstellar.png'),
  },
  {
    id: 'jurassic',
    label: 'Jurassic',
    accentColor: '#0D9488',
    source: require('@/assets/images/avatars/jurassic.png'),
  },
  {
    id: 'naruto',
    label: 'Naruto',
    accentColor: '#F97316',
    source: require('@/assets/images/avatars/naruto.png'),
  },
  {
    id: 'fullmetal',
    label: 'Fullmetal',
    accentColor: '#94A3B8',
    source: require('@/assets/images/avatars/fullmetal.png'),
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
