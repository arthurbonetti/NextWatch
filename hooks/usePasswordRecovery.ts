import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  type RecoverySessionHandle,
  validateAndPrepareRecoverySession,
} from '@/services/recoveryService';
import {
  buildRecoveryPayloadKey,
  clearPendingRecoveryParams,
  hasRecoveryPayload,
  parseRecoveryUrlParams,
  peekPendingRecoveryParams,
  type RecoveryUrlParams,
} from '@/utils/recoveryUrl';

const DEFAULT_EXPIRED_LINK_MESSAGE =
  'Este link de recuperação expirou ou já foi utilizado. Solicite um novo envio na tela de login.';

function stripRecoveryParamsFromWebUrl(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    if (window.location.hash || window.location.search) {
      window.history.replaceState(null, '', window.location.pathname || '/reset-password');
    }
  } catch {
    // Ignora falha ao limpar histórico
  }
}

export type UsePasswordRecoveryResult = {
  sessionReady: boolean;
  checkingLink: boolean;
  linkErrorMessage: string;
  getRecoveryHandle: () => RecoverySessionHandle | null;
  clearRecoveryState: () => void;
};

export function usePasswordRecovery(): UsePasswordRecoveryResult {
  const { isPasswordRecovery, beginPasswordRecoveryLock } = useAuth();
  const params = useLocalSearchParams<{ code?: string; token_hash?: string; type?: string }>();
  const incomingUrl = Linking.useURL();

  const [sessionReady, setSessionReady] = useState(isPasswordRecovery);
  const [checkingLink, setCheckingLink] = useState(!isPasswordRecovery);
  const [linkErrorMessage, setLinkErrorMessage] = useState('');

  const recoveryHandleRef = useRef<RecoverySessionHandle | null>(
    isPasswordRecovery ? { kind: 'main-recovery' } : null,
  );
  const isMountedRef = useRef(true);
  const inFlightKeyRef = useRef<string | null>(null);
  const completedKeyRef = useRef<string | null>(null);
  const validationSeqRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const handoffParams = peekPendingRecoveryParams();
    const webHref =
      Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null;
    const parsedFromUrls = {
      ...parseRecoveryUrlParams(webHref),
      ...parseRecoveryUrlParams(incomingUrl),
    };

    const merged: RecoveryUrlParams = {
      ...(handoffParams ?? {}),
      ...parsedFromUrls,
      ...(typeof params.code === 'string' && params.code ? { code: params.code } : {}),
      ...(typeof params.token_hash === 'string' && params.token_hash
        ? { tokenHash: params.token_hash }
        : {}),
      ...(typeof params.type === 'string' && params.type ? { type: params.type } : {}),
    };

    const hasPayload = hasRecoveryPayload(merged);
    if (!hasPayload) {
      if (inFlightKeyRef.current !== null) {
        return;
      }
      if (recoveryHandleRef.current !== null) {
        setSessionReady(true);
        setCheckingLink(false);
        return;
      }
      if (completedKeyRef.current !== null && completedKeyRef.current !== '__empty__') {
        setCheckingLink(false);
        return;
      }
    }

    const payloadKey = hasPayload
      ? buildRecoveryPayloadKey(merged)
      : isPasswordRecovery
        ? '__main_recovery__'
        : '__empty__';

    if (inFlightKeyRef.current === payloadKey) {
      return;
    }
    if (completedKeyRef.current === payloadKey) {
      setCheckingLink(false);
      return;
    }

    if (handoffParams) {
      clearPendingRecoveryParams();
    }
    if (hasPayload) {
      stripRecoveryParamsFromWebUrl();
    }

    inFlightKeyRef.current = payloadKey;
    const seq = ++validationSeqRef.current;

    setCheckingLink(true);
    setLinkErrorMessage('');

    void validateAndPrepareRecoverySession(merged, {
      allowExistingRecoverySession: isPasswordRecovery,
      onRequireMainRecoveryLock: beginPasswordRecoveryLock,
    })
      .then((result) => {
        if (!isMountedRef.current || validationSeqRef.current !== seq) return;
        inFlightKeyRef.current = null;
        completedKeyRef.current = payloadKey;
        if (result.ok) {
          recoveryHandleRef.current = result.handle;
          setSessionReady(true);
          setLinkErrorMessage('');
        } else {
          recoveryHandleRef.current = null;
          setSessionReady(false);
          setLinkErrorMessage(result.errorMessage);
        }
      })
      .catch(() => {
        if (!isMountedRef.current || validationSeqRef.current !== seq) return;
        inFlightKeyRef.current = null;
        completedKeyRef.current = payloadKey;
        recoveryHandleRef.current = null;
        setSessionReady(false);
        setLinkErrorMessage(DEFAULT_EXPIRED_LINK_MESSAGE);
      })
      .finally(() => {
        if (!isMountedRef.current || validationSeqRef.current !== seq) return;
        setCheckingLink(false);
      });
  }, [
    beginPasswordRecoveryLock,
    incomingUrl,
    isPasswordRecovery,
    params.code,
    params.token_hash,
    params.type,
  ]);

  const getRecoveryHandle = useCallback(() => recoveryHandleRef.current, []);

  const clearRecoveryState = useCallback(() => {
    recoveryHandleRef.current = null;
    inFlightKeyRef.current = null;
    completedKeyRef.current = null;
    validationSeqRef.current += 1;
    clearPendingRecoveryParams();
    stripRecoveryParamsFromWebUrl();
  }, []);

  return {
    sessionReady,
    checkingLink,
    linkErrorMessage,
    getRecoveryHandle,
    clearRecoveryState,
  };
}
