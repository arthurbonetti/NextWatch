import type { AvatarPresetId, AvatarType } from '@/constants/avatars';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  avatarType: AvatarType;
  avatarPreset: AvatarPresetId | null;
  avatarPath: string | null;
  avatarUrl: string | null;
};

export type AuthStatus = 'idle' | 'loading' | 'success' | 'error';

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

export type PendingAvatarUpload = {
  uri: string;
  bytes: Uint8Array;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
};

export type UpdateProfilePayload = {
  name: string;
  avatarType: AvatarType;
  avatarPreset: AvatarPresetId | null;
  pendingUpload?: PendingAvatarUpload | null;
};

export type UpdatePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export const MIN_NAME_LENGTH = 2;
export const MIN_PASSWORD_LENGTH = 8;
export const MIN_LOGIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_NAME_LENGTH = 80;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(trimmed);
}

export function isStrongPassword(password: string): boolean {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }
  return /[a-zA-Z]/.test(password) && /\d/.test(password);
}

export function isValidAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AuthUser>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    candidate.id.length <= 128 &&
    typeof candidate.email === 'string' &&
    isValidEmail(candidate.email) &&
    typeof candidate.name === 'string' &&
    candidate.name.length > 0 &&
    candidate.name.length <= MAX_NAME_LENGTH &&
    typeof candidate.createdAt === 'string'
  );
}
