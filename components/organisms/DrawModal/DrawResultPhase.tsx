import { TitleDetailCard } from '@/components/organisms/TitleDetailCard';
import type { MediaTitle } from '@/types/media';
import type { Subscription } from '@/types/subscription';

type DrawResultPhaseProps = {
  title: MediaTitle;
  duration?: string;
  trailerUrl?: string | null;
  saved: boolean;
  watched: boolean;
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
  watched,
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
      watched={watched}
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
