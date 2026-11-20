import { useMemo, useState } from 'react';

import { AnimatedModalShell } from '@/components/atoms/AnimatedModalShell';
import { TitleDetailCard } from '@/components/organisms/TitleDetailCard';
import { MediaTitle } from '@/constants/catalog';
import { Subscription } from '@/constants/subscriptions';

type Props = {
  title: MediaTitle | null;
  visible: boolean;
  activeSubscriptions: Subscription[];
  duration?: string;
  trailerUrl?: string | null;
  saved: boolean;
  eyebrow?: string;
  onClose: () => void;
  onWatch?: () => void;
  onToggleSave: () => void;
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
  activeSubscriptions,
  duration,
  trailerUrl,
  saved,
  eyebrow = 'PARA ASSISTIR HOJE',
  onClose,
  onWatch,
  onToggleSave,
  onSaveChange,
  onDrawAnother,
}: Props) {
  const [cachedTitle, setCachedTitle] = useState<MediaTitle | null>(title);

  if (title && title !== cachedTitle) {
    setCachedTitle(title);
  }

  const activeTitle = title ?? cachedTitle;
  const filteredSubscriptions = useMemo(
    () => activeSubscriptions.filter((subscription) => subscription.active),
    [activeSubscriptions],
  );

  if (!activeTitle) return null;

  return (
    <AnimatedModalShell
      visible={visible}
      onClose={onClose}
      variant="center"
      maxWidth={460}
      maxHeight="90%"
      backdropAccessibilityLabel="Fechar detalhes">
      <TitleDetailCard
        title={activeTitle}
        duration={duration}
        trailerUrl={trailerUrl}
        saved={saved}
        eyebrow={eyebrow}
        activeSubscriptions={filteredSubscriptions}
        onClose={onClose}
        onWatch={onWatch ?? onClose}
        onToggleSave={onToggleSave}
        onSaveChange={onSaveChange}
        onDrawAnother={onDrawAnother}
      />
    </AnimatedModalShell>
  );
}
