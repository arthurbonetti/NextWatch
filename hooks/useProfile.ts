import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { type AvatarPresetId, type AvatarType, isAvatarPresetId } from '@/constants/avatars';
import { useAuth } from '@/contexts/AuthContext';
import { updateAuthDisplayName } from '@/services/authService';
import { queryKeys } from '@/services/queryKeys';
import {
  deleteCustomAvatar,
  fetchUserProfile,
  readCachedUserProfile,
  uploadCustomAvatar,
  upsertUserProfile,
  type UserProfileRecord,
  writeCachedUserProfile,
} from '@/services/repositories/profileRepo';
import {
  MAX_NAME_LENGTH,
  MIN_NAME_LENGTH,
  type PendingAvatarUpload,
  type UpdateProfilePayload,
} from '@/types/auth';
import { decodeBase64ToBytes, validateAvatarBytes } from '@/utils/avatarImage';

export type SelectedAvatarAsset = {
  uri?: string | null;
  base64?: string | null;
};

export type PrepareAvatarUploadResult =
  | { ok: true; upload: PendingAvatarUpload }
  | { ok: false; error: string };

/**
 * Decodifica e valida uma imagem selecionada da galeria, preparando o payload de upload do avatar.
 */
export async function prepareAvatarUpload(
  asset: SelectedAvatarAsset | null | undefined,
): Promise<PrepareAvatarUploadResult> {
  if (!asset?.uri) {
    return { ok: false, error: 'Não foi possível ler a imagem selecionada.' };
  }

  let bytes: Uint8Array;
  if (typeof asset.base64 === 'string' && asset.base64.length > 0) {
    bytes = decodeBase64ToBytes(asset.base64);
  } else {
    const response = await fetch(asset.uri);
    const arrayBuffer = await response.arrayBuffer();
    bytes = new Uint8Array(arrayBuffer);
  }

  const validation = validateAvatarBytes(bytes);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  return {
    ok: true,
    upload: {
      uri: asset.uri,
      bytes,
      contentType: validation.contentType,
      extension: validation.extension,
    },
  };
}

export type UserProfile = {
  userId: string;
  name: string;
  avatarType: AvatarType;
  avatarPreset: AvatarPresetId | null;
  avatarPath: string | null;
  avatarUrl: string | null;
  updatedAt: string | null;
};

type ValidatedProfileMutation = {
  normalizedName: string;
  nextType: AvatarType;
  nextPreset: AvatarPresetId | null;
  previousPath: string | null;
  previousAvatarUrl: string | null;
  previousName: string;
  pendingUpload: UpdateProfilePayload['pendingUpload'];
};

function validateProfilePayload(
  payload: UpdateProfilePayload,
  currentProfile: UserProfile | null,
  fallbackName: string,
): ValidatedProfileMutation {
  const normalizedName = payload.name.trim().slice(0, MAX_NAME_LENGTH);
  if (normalizedName.length < MIN_NAME_LENGTH) {
    throw new Error(`Informe um nome com pelo menos ${MIN_NAME_LENGTH} caracteres.`);
  }

  const previousPath = currentProfile?.avatarPath ?? null;
  const previousAvatarUrl = currentProfile?.avatarUrl ?? null;
  const previousName = currentProfile?.name ?? fallbackName;

  if (payload.avatarType === 'custom') {
    if (!payload.pendingUpload && !previousPath) {
      throw new Error('Selecione uma imagem para fazer upload.');
    }
    return {
      normalizedName,
      nextType: 'custom',
      nextPreset: null,
      previousPath,
      previousAvatarUrl,
      previousName,
      pendingUpload: payload.pendingUpload ?? null,
    };
  }

  if (payload.avatarType === 'preset') {
    if (!isAvatarPresetId(payload.avatarPreset)) {
      throw new Error('Selecione um ícone válido.');
    }
    return {
      normalizedName,
      nextType: 'preset',
      nextPreset: payload.avatarPreset,
      previousPath,
      previousAvatarUrl,
      previousName,
      pendingUpload: null,
    };
  }

  return {
    normalizedName,
    nextType: 'initials',
    nextPreset: null,
    previousPath,
    previousAvatarUrl,
    previousName,
    pendingUpload: null,
  };
}

export function useProfile() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.profile(userId), [userId]);

  const query = useQuery<UserProfileRecord | null>({
    queryKey,
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (!userId) return null;

      const cached = await readCachedUserProfile(userId);
      if (cached && queryClient.getQueryData<UserProfileRecord | null>(queryKey) === undefined) {
        queryClient.setQueryData<UserProfileRecord | null>(queryKey, cached);
      }

      const remote = await fetchUserProfile(userId);
      if (remote) {
        void writeCachedUserProfile(userId, remote);
        return remote;
      }

      return cached;
    },
  });

  const profile = useMemo<UserProfile | null>(() => {
    if (!user) return null;
    const record = query.data;
    return {
      userId: user.id,
      name: record?.displayName || user.name,
      avatarType: record?.avatarType ?? 'initials',
      avatarPreset: record?.avatarPreset ?? null,
      avatarPath: record?.avatarPath ?? null,
      avatarUrl: record?.avatarUrl ?? null,
      updatedAt: record?.updatedAt ?? null,
    };
  }, [query.data, user]);

  const mutation = useMutation<
    UserProfileRecord,
    Error,
    UpdateProfilePayload,
    { previous: UserProfileRecord | null | undefined; hadPrevious: boolean }
  >({
    onMutate: async (payload) => {
      if (!user || !userId) {
        return { previous: undefined, hadPrevious: false };
      }

      let validated: ValidatedProfileMutation;
      try {
        validated = validateProfilePayload(payload, profile, user.name);
      } catch {
        return { previous: undefined, hadPrevious: false };
      }

      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<UserProfileRecord | null>(queryKey);
      const optimisticRecord: UserProfileRecord = {
        userId,
        displayName: validated.normalizedName,
        avatarType: validated.nextType,
        avatarPreset: validated.nextPreset,
        avatarPath: validated.nextType === 'custom' ? validated.previousPath : null,
        avatarUrl:
          validated.nextType === 'custom'
            ? (validated.pendingUpload?.uri ?? validated.previousAvatarUrl)
            : null,
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<UserProfileRecord | null>(queryKey, optimisticRecord);
      return { previous, hadPrevious: true };
    },
    mutationFn: async (payload) => {
      if (!user || !userId) {
        throw new Error('Sua sessão expirou. Faça login novamente.');
      }

      const validated = validateProfilePayload(payload, profile, user.name);
      let nextPath: string | null = null;
      let newlyUploadedPath: string | null = null;

      if (validated.nextType === 'custom') {
        if (validated.pendingUpload) {
          const uploaded = await uploadCustomAvatar(userId, validated.pendingUpload);
          newlyUploadedPath = uploaded.path;
          nextPath = uploaded.path;
        } else {
          nextPath = validated.previousPath;
        }
      }

      let savedProfile: UserProfileRecord;
      try {
        savedProfile = await upsertUserProfile(userId, {
          displayName: validated.normalizedName,
          avatarType: validated.nextType,
          avatarPreset: validated.nextPreset,
          avatarPath: nextPath,
        });
      } catch (error) {
        if (newlyUploadedPath) {
          await deleteCustomAvatar(newlyUploadedPath);
        }
        throw error;
      }

      if (validated.previousPath && validated.previousPath !== savedProfile.avatarPath) {
        void deleteCustomAvatar(validated.previousPath);
      }

      await writeCachedUserProfile(userId, savedProfile);

      if (validated.normalizedName !== validated.previousName) {
        await updateAuthDisplayName(validated.normalizedName).catch(() => {});
      }

      return savedProfile;
    },
    onSuccess: (savedProfile) => {
      queryClient.setQueryData<UserProfileRecord | null>(queryKey, savedProfile);
    },
    onError: (_error, _payload, context) => {
      if (context?.hadPrevious) {
        queryClient.setQueryData<UserProfileRecord | null>(queryKey, context.previous ?? null);
      }
    },
    onSettled: () => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const updateProfile = useCallback(
    async (payload: UpdateProfilePayload) => {
      await mutation.mutateAsync(payload);
    },
    [mutation],
  );

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    await query.refetch();
  }, [query, userId]);

  return {
    profile,
    isLoading: query.isLoading,
    isUpdatingProfile: mutation.isPending,
    updateProfile,
    refreshProfile,
    prepareAvatarUpload,
  };
}
