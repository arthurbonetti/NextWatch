import { TitleDetailCard } from '@/components/organisms/TitleDetailCard';
import { MediaTitle } from '@/constants/catalog';
import { Subscription } from '@/constants/subscriptions';

type DrawResultPhaseProps = {
  title: MediaTitle;
  activeSubscriptions: Subscription[];
  enabledServices: string[];
  canDrawAnother: boolean;
  onClose: () => void;
  onWatch: () => void;
  onMarkWatched: () => void;
  onSaveChange: (saved: boolean) => void;
  onDrawAnother: () => void;
};

/**
 * Tela 3 do fluxo de sorteio: reutiliza TitleDetailCard com o contexto do sorteio
 * (motivo da escolha, confete na primeira revelação, marcar como assistido e sortear outro).
 */
export function DrawResultPhase({
  title,
  activeSubscriptions,
  enabledServices,
  canDrawAnother,
  onClose,
  onWatch,
  onMarkWatched,
  onSaveChange,
  onDrawAnother,
}: DrawResultPhaseProps) {
  return (
    <TitleDetailCard
      title={title}
      eyebrow="SORTEADO PARA VOCÊ"
      activeSubscriptions={activeSubscriptions}
      enabledServices={enabledServices}
      showWhyReason
      showConfetti
      onClose={onClose}
      onWatch={onWatch}
      onMarkWatched={onMarkWatched}
      onSaveChange={onSaveChange}
      onDrawAnother={canDrawAnother ? onDrawAnother : undefined}
    />
  );
}
