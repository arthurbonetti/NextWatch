import { TitleDetailCard } from '@/components/organisms/TitleDetailCard';
import { MediaTitle } from '@/constants/catalog';
import { Subscription } from '@/constants/subscriptions';

type DrawResultPhaseProps = {
  title: MediaTitle;
  duration?: string;
  trailerUrl?: string | null;
  saved: boolean;
  activeSubscriptions: Subscription[];
  enabledServices: string[];
  canDrawAnother: boolean;
  onClose: () => void;
  onWatch: () => void;
  onToggleSave: () => void;
  onMarkWatched: () => void;
  onSaveChange?: (saved: boolean) => void;
  onDrawAnother: () => void;
};

/**
 * Tela 3 do fluxo de sorteio: reutiliza TitleDetailCard com o contexto do sorteio
 * (motivo da escolha, confete na primeira revelação, marcar como assistido e sortear outro).
 */
export function DrawResultPhase({
  title,
  duration,
  trailerUrl,
  saved,
  activeSubscriptions,
  enabledServices,
  canDrawAnother,
  onClose,
  onWatch,
  onToggleSave,
  onMarkWatched,
  onSaveChange,
  onDrawAnother,
}: DrawResultPhaseProps) {
  return (
    <TitleDetailCard
      title={title}
      duration={duration}
      trailerUrl={trailerUrl}
      saved={saved}
      eyebrow="SORTEADO PARA VOCÊ"
      activeSubscriptions={activeSubscriptions}
      enabledServices={enabledServices}
      showWhyReason
      showConfetti
      onClose={onClose}
      onWatch={onWatch}
      onToggleSave={onToggleSave}
      onMarkWatched={onMarkWatched}
      onSaveChange={onSaveChange}
      onDrawAnother={canDrawAnother ? onDrawAnother : undefined}
    />
  );
}
