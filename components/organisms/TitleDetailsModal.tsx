import { useMemo } from 'react';

import { AnimatedModalShell } from '@/components/atoms/AnimatedModalShell';
import { TitleDetailCard } from '@/components/organisms/TitleDetailCard';
import { MediaTitle } from '@/constants/catalog';
import { useSubscriptions } from '@/contexts/SubscriptionsContext';

type Props = {
  title: MediaTitle | null;
  visible: boolean;
  eyebrow?: string;
  onClose: () => void;
  onWatch?: () => void;
  onSaveChange?: (saved: boolean) => void;
  onDrawAnother?: () => void;
};

/**
 * Modal de detalhes de um título ("Para assistir hoje"), utilizando o mesmo visual
 * editorial do resultado do sorteio dentro do container global AnimatedModalShell.
 */
export function TitleDetailsModal({
  title,
  visible,
  eyebrow = 'PARA ASSISTIR HOJE',
  onClose,
  onWatch,
  onSaveChange,
  onDrawAnother,
}: Props) {
  const { subscriptions } = useSubscriptions();
  const activeSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => subscription.active),
    [subscriptions],
  );

  if (!title) return null;

  return (
    <AnimatedModalShell
      visible={visible}
      onClose={onClose}
      variant="center"
      maxWidth={460}
      maxHeight="90%"
      backdropAccessibilityLabel="Fechar detalhes">
      <TitleDetailCard
        title={title}
        eyebrow={eyebrow}
        activeSubscriptions={activeSubscriptions}
        onClose={onClose}
        onWatch={onWatch ?? onClose}
        onSaveChange={onSaveChange}
        onDrawAnother={onDrawAnother}
      />
    </AnimatedModalShell>
  );
}
