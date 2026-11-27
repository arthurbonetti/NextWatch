import { useMemo, useState } from 'react';

import { AnimatedModalShell } from '@/components/atoms/AnimatedModalShell';
import { TitleDetailCard } from '@/components/organisms/TitleDetailCard';
import type { MediaTitle } from '@/types/media';
import type { Subscription } from '@/types/subscription';
import type { TitleRatingSummary } from '@/utils/titleRating';

type TitleDetailsModalProps = {
  title: MediaTitle | null;
  visible: boolean;
  activeSubscriptions: Subscription[];
  duration?: string;
  trailerUrl?: string | null;
  saved: boolean;
  watched?: boolean;
  userRatingSummary?: TitleRatingSummary | null;
  personalRating?: number | null;
  canRate?: boolean;
  eyebrow?: string;
  onClose: () => void;
  onWatch?: () => void;
  onToggleSave: () => void;
  onPressRate?: () => void;
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
  watched = false,
  userRatingSummary,
  personalRating = null,
  canRate = false,
  eyebrow = 'PARA ASSISTIR HOJE',
  onClose,
  onWatch,
  onToggleSave,
  onPressRate,
  onSaveChange,
  onDrawAnother,
}: TitleDetailsModalProps) {
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
        watched={watched}
        userRatingSummary={userRatingSummary}
        personalRating={personalRating}
        canRate={canRate}
        eyebrow={eyebrow}
        activeSubscriptions={filteredSubscriptions}
        onClose={onClose}
        onWatch={onWatch ?? onClose}
        onToggleSave={onToggleSave}
        onPressRate={onPressRate}
        onSaveChange={onSaveChange}
        onDrawAnother={onDrawAnother}
      />
    </AnimatedModalShell>
  );
}
