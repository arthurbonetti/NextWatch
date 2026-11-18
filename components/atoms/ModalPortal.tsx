import {
  createContext,
  PropsWithChildren,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import { BackHandler, Modal, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

type PortalEntry = {
  id: string;
  node: ReactNode;
  onBackPress?: () => void;
};

type PortalActions = {
  upsert: (id: string, node: ReactNode, onBackPress?: () => void) => void;
  remove: (id: string) => void;
};

const PortalActionsContext = createContext<PortalActions | null>(null);
const PortalEntriesContext = createContext<PortalEntry[]>([]);

/**
 * Provedor raiz para renderizar modais na mesma árvore de UI do app (evitando
 * o atraso de apresentação de janelas nativas do <Modal> no Expo Go).
 */
export function ModalPortalProvider({ children }: PropsWithChildren) {
  const [entries, setEntries] = useState<PortalEntry[]>([]);

  const upsert = useCallback((id: string, node: ReactNode, onBackPress?: () => void) => {
    setEntries((prev) => {
      const index = prev.findIndex((entry) => entry.id === id);
      if (index === -1) {
        return [...prev, { id, node, onBackPress }];
      }
      const current = prev[index]!;
      if (current.node === node && current.onBackPress === onBackPress) {
        return prev;
      }
      const next = prev.slice();
      next[index] = { id, node, onBackPress };
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((entry) => entry.id !== id);
      return next.length === prev.length ? prev : next;
    });
  }, []);

  const actions = useMemo<PortalActions>(() => ({ upsert, remove }), [remove, upsert]);

  return (
    <PortalActionsContext.Provider value={actions}>
      <PortalEntriesContext.Provider value={entries}>{children}</PortalEntriesContext.Provider>
    </PortalActionsContext.Provider>
  );
}

/**
 * Host que exibe os modais ativos acima de todas as telas e trata o botão voltar / Escape.
 */
export function ModalPortalHost() {
  const entries = useContext(PortalEntriesContext);
  const topEntry = entries.length > 0 ? entries[entries.length - 1] : undefined;
  const topOnBackPress = topEntry?.onBackPress;

  useEffect(() => {
    if (!topEntry) return;

    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          topOnBackPress?.();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      topOnBackPress?.();
      return true;
    });
    return () => subscription.remove();
  }, [topEntry, topOnBackPress]);

  if (entries.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      {entries.map((entry, index) => (
        <View
          key={entry.id}
          pointerEvents="box-none"
          style={styles.entryLayer}
          accessibilityViewIsModal={index === entries.length - 1}>
          {entry.node}
        </View>
      ))}
    </View>
  );
}

type ModalPortalProps = {
  children: ReactNode;
  onBackPress?: () => void;
};

/**
 * Teleporta o conteúdo do modal para o ModalPortalHost no layout raiz.
 */
export function ModalPortal({ children, onBackPress }: ModalPortalProps) {
  const actions = useContext(PortalActionsContext);
  const portalId = useId();

  useEffect(() => {
    if (!actions) return;
    actions.upsert(portalId, children, onBackPress);
  }, [actions, children, onBackPress, portalId]);

  useEffect(() => {
    if (!actions) return;
    return () => {
      actions.remove(portalId);
    };
  }, [actions, portalId]);

  if (!actions) {
    return (
      <Modal
        visible
        transparent
        animationType="none"
        onRequestClose={onBackPress}
        statusBarTranslucent>
        <GestureHandlerRootView style={styles.fallbackRoot}>{children}</GestureHandlerRootView>
      </Modal>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
  },
  entryLayer: {
    ...StyleSheet.absoluteFill,
  },
  fallbackRoot: {
    flex: 1,
  },
});
