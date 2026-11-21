import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  type AvatarPresetId,
  type AvatarType,
  isAvatarPresetId,
  isAvatarType,
} from '@/constants/avatars';
import { hasSupabaseConfig, supabase } from '@/services/supabase';
import {
  MAX_NAME_LENGTH,
  MIN_NAME_LENGTH,
  type PendingAvatarUpload,
} from '@/types/auth';
import {
  buildAvatarStoragePath,
  sanitizeAvatarPath,
  toExactArrayBuffer,
  validateAvatarBytes,
} from '@/utils/avatarImage';

const TABLE_NAME = 'user_profiles';
const AVATARS_BUCKET = 'avatars';
const SELECT_COLUMNS = 'user_id,display_name,avatar_type,avatar_preset,avatar_path,updated_at';
const PROFILE_CACHE_PREFIX = '@nextwatch/profile:';

type DbUserProfileRow = {
  user_id: string;
  display_name: string;
  avatar_type: string;
  avatar_preset: string | null;
  avatar_path: string | null;
  updated_at: string;
};

export type UserProfileRecord = {
  userId: string;
  displayName: string;
  avatarType: AvatarType;
  avatarPreset: AvatarPresetId | null;
  avatarPath: string | null;
  avatarUrl: string | null;
  updatedAt: string;
};

export type UpsertUserProfileInput = {
  displayName: string;
  avatarType: AvatarType;
  avatarPreset: AvatarPresetId | null;
  avatarPath: string | null;
};

function getProfileCacheKey(userId: string): string {
  return `${PROFILE_CACHE_PREFIX}${userId}`;
}

export function getPublicAvatarUrl(avatarPath: string | null | undefined): string | null {
  if (!supabase || !hasSupabaseConfig()) return null;
  const cleanPath = sanitizeAvatarPath(avatarPath);
  if (!cleanPath) return null;
  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(cleanPath);
  return data?.publicUrl || null;
}

function normalizeProfileFields(input: {
  displayName: string;
  avatarType: unknown;
  avatarPreset: unknown;
  avatarPath: unknown;
}): {
  displayName: string;
  avatarType: AvatarType;
  avatarPreset: AvatarPresetId | null;
  avatarPath: string | null;
  avatarUrl: string | null;
} {
  const displayName = input.displayName.trim().slice(0, MAX_NAME_LENGTH);
  const rawType = isAvatarType(input.avatarType) ? input.avatarType : 'initials';
  const rawPreset = isAvatarPresetId(input.avatarPreset) ? input.avatarPreset : null;
  const rawPath = sanitizeAvatarPath(input.avatarPath);

  if (rawType === 'preset' && rawPreset) {
    return {
      displayName,
      avatarType: 'preset',
      avatarPreset: rawPreset,
      avatarPath: null,
      avatarUrl: null,
    };
  }

  if (rawType === 'custom' && rawPath) {
    return {
      displayName,
      avatarType: 'custom',
      avatarPreset: null,
      avatarPath: rawPath,
      avatarUrl: getPublicAvatarUrl(rawPath),
    };
  }

  return {
    displayName,
    avatarType: 'initials',
    avatarPreset: null,
    avatarPath: null,
    avatarUrl: null,
  };
}

function mapDbRowToProfile(row: Partial<DbUserProfileRow> | null | undefined): UserProfileRecord | null {
  if (!row || typeof row.user_id !== 'string' || !row.user_id) return null;
  if (typeof row.display_name !== 'string') return null;

  const normalized = normalizeProfileFields({
    displayName: row.display_name,
    avatarType: row.avatar_type,
    avatarPreset: row.avatar_preset,
    avatarPath: row.avatar_path,
  });

  if (normalized.displayName.length < MIN_NAME_LENGTH) return null;

  return {
    userId: row.user_id,
    displayName: normalized.displayName,
    avatarType: normalized.avatarType,
    avatarPreset: normalized.avatarPreset,
    avatarPath: normalized.avatarPath,
    avatarUrl: normalized.avatarUrl,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(),
  };
}

export async function fetchUserProfile(userId: string): Promise<UserProfileRecord | null> {
  if (!userId || !supabase || !hasSupabaseConfig()) return null;

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(SELECT_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return mapDbRowToProfile(data as Partial<DbUserProfileRow>);
  } catch {
    return null;
  }
}

export async function upsertUserProfile(
  userId: string,
  input: UpsertUserProfileInput,
): Promise<UserProfileRecord> {
  if (!userId || !supabase || !hasSupabaseConfig()) {
    throw new Error('Serviço de perfil indisponível no momento.');
  }

  const normalized = normalizeProfileFields({
    displayName: input.displayName,
    avatarType: input.avatarType,
    avatarPreset: input.avatarPreset,
    avatarPath: input.avatarPath,
  });

  if (normalized.displayName.length < MIN_NAME_LENGTH) {
    throw new Error(`Informe um nome com pelo menos ${MIN_NAME_LENGTH} caracteres.`);
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(
      {
        user_id: userId,
        display_name: normalized.displayName,
        avatar_type: normalized.avatarType,
        avatar_preset: normalized.avatarPreset,
        avatar_path: normalized.avatarPath,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error('Não foi possível salvar seu perfil no servidor. Tente novamente.');
  }

  const mapped = mapDbRowToProfile(data as Partial<DbUserProfileRow>);
  if (!mapped) {
    throw new Error('Resposta inválida ao salvar seu perfil.');
  }

  return mapped;
}

export async function uploadCustomAvatar(
  userId: string,
  upload: PendingAvatarUpload,
): Promise<{ path: string; publicUrl: string }> {
  if (!userId || !supabase || !hasSupabaseConfig()) {
    throw new Error('Serviço de armazenamento indisponível no momento.');
  }

  const validation = validateAvatarBytes(upload.bytes);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const storagePath = buildAvatarStoragePath(userId, validation.extension);
  const arrayBuffer = toExactArrayBuffer(upload.bytes);

  const { data, error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: validation.contentType,
      upsert: false,
      cacheControl: '31536000',
    });

  if (error) {
    throw new Error('Não foi possível enviar sua foto de perfil. Verifique a conexão e tente novamente.');
  }

  const uploadedPath = sanitizeAvatarPath(data?.path ?? storagePath);
  if (!uploadedPath) {
    throw new Error('Caminho inválido retornado após o envio da imagem.');
  }

  const publicUrl = getPublicAvatarUrl(uploadedPath);
  if (!publicUrl) {
    throw new Error('Não foi possível gerar o endereço da foto enviada.');
  }

  return { path: uploadedPath, publicUrl };
}

export async function deleteCustomAvatar(avatarPath: string | null | undefined): Promise<void> {
  const cleanPath = sanitizeAvatarPath(avatarPath);
  if (!cleanPath || !supabase || !hasSupabaseConfig()) return;

  try {
    await supabase.storage.from(AVATARS_BUCKET).remove([cleanPath]);
  } catch {
    // Limpeza best-effort de arquivos antigos no Storage
  }
}

export async function readCachedUserProfile(userId: string): Promise<UserProfileRecord | null> {
  if (!userId) return null;

  try {
    const raw = await AsyncStorage.getItem(getProfileCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserProfileRecord>;
    if (!parsed || parsed.userId !== userId || typeof parsed.displayName !== 'string') {
      return null;
    }

    const normalized = normalizeProfileFields({
      displayName: parsed.displayName,
      avatarType: parsed.avatarType,
      avatarPreset: parsed.avatarPreset,
      avatarPath: parsed.avatarPath,
    });

    if (normalized.displayName.length < MIN_NAME_LENGTH) return null;

    return {
      userId,
      displayName: normalized.displayName,
      avatarType: normalized.avatarType,
      avatarPreset: normalized.avatarPreset,
      avatarPath: normalized.avatarPath,
      avatarUrl: normalized.avatarUrl,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function writeCachedUserProfile(
  userId: string,
  profile: UserProfileRecord,
): Promise<void> {
  if (!userId) return;

  try {
    await AsyncStorage.setItem(getProfileCacheKey(userId), JSON.stringify(profile));
  } catch {
    // Ignora falha de escrita no cache local
  }
}
