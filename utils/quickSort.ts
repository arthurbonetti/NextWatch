/**
 * Embaralha uma coleção em tempo O(n) utilizando o algoritmo Fisher-Yates,
 * sem alocações recursivas ou objetos intermediários na memória.
 */
export function quickSortByRandom<T>(values: readonly T[]): T[] {
  const result = values.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}
