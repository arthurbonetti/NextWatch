export type TitleRatingSummary = {
  titleId: string;
  sum: number;
  count: number;
  average: number | null;
};

export function createEmptyRatingSummary(titleId = ''): TitleRatingSummary {
  return {
    titleId,
    sum: 0,
    count: 0,
    average: null,
  };
}

/** Normaliza notas pessoais para inteiros na escala de 0 a 5 estrelas. */
export function normalizeUserStarRating(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value > 5) {
    return Math.max(0, Math.min(5, Math.round(value / 2)));
  }
  const rounded = Math.round(value);
  return rounded >= 0 && rounded <= 5 ? rounded : null;
}

/** Atualiza localmente a média agregada dos usuários após alteração da nota pessoal. */
export function applyOptimisticRatingSummary(params: {
  current?: TitleRatingSummary;
  titleId: string;
  previousUserRating: number | null;
  nextUserRating: number | null;
}): TitleRatingSummary {
  const base = params.current ?? createEmptyRatingSummary(params.titleId);
  const prevRating = normalizeUserStarRating(params.previousUserRating);
  const nextRating = normalizeUserStarRating(params.nextUserRating);

  let nextSum = Math.max(0, base.sum);
  let nextCount = Math.max(0, base.count);

  if (prevRating === null && nextRating !== null) {
    nextSum += nextRating;
    nextCount += 1;
  } else if (prevRating !== null && nextRating === null) {
    nextSum = Math.max(0, nextSum - prevRating);
    nextCount = Math.max(0, nextCount - 1);
  } else if (prevRating !== null && nextRating !== null) {
    nextSum = Math.max(0, nextSum + (nextRating - prevRating));
  }

  return {
    titleId: params.titleId,
    sum: nextSum,
    count: nextCount,
    average: nextCount > 0 ? Math.round((nextSum / nextCount) * 100) / 100 : null,
  };
}

export function formatUserRatingAverage(
  summary?: Pick<TitleRatingSummary, 'average' | 'count'> | null,
): string {
  if (!summary || summary.count <= 0 || summary.average === null || !Number.isFinite(summary.average)) {
    return 'N/A';
  }
  return summary.average.toFixed(1).replace('.', ',');
}

export function formatUserRatingOutOfFive(
  summary?: Pick<TitleRatingSummary, 'average' | 'count'> | null,
): string {
  const formatted = formatUserRatingAverage(summary);
  return formatted === 'N/A' ? 'N/A' : `${formatted}/5`;
}

export function formatUserRatingCount(count: number): string {
  if (count <= 0) return 'Sem avaliações';
  return count === 1 ? '1 avaliação' : `${count} avaliações`;
}

export function getStarQualityLabel(rating: number | null): string {
  switch (rating) {
    case 0:
      return 'Não recomendo';
    case 1:
      return 'Fraco';
    case 2:
      return 'Regular';
    case 3:
      return 'Bom';
    case 4:
      return 'Muito bom';
    case 5:
      return 'Obra-prima';
    default:
      return 'Toque nas estrelas para avaliar';
  }
}
