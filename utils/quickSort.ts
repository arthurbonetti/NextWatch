type RandomizedValue<T> = {
  value: T;
  key: number;
};

function quickSort<T>(values: RandomizedValue<T>[]): RandomizedValue<T>[] {
  if (values.length <= 1) return values;

  const [pivot, ...rest] = values;
  const lower = rest.filter((item) => item.key < pivot.key);
  const higher = rest.filter((item) => item.key >= pivot.key);

  return [...quickSort(lower), pivot, ...quickSort(higher)];
}

export function quickSortByRandom<T>(values: readonly T[]): T[] {
  return quickSort(values.map((value) => ({ value, key: Math.random() }))).map((item) => item.value);
}
