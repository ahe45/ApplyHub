import { templateEditorObjectMinimumSize } from "./object-toolbar-constants.js";

export function normalizeObjectTableSegmentSizes(sizes, targetSize, minimumSize = templateEditorObjectMinimumSize) {
  const itemCount = Math.max(1, sizes.length);
  const safeMinimumSize = Math.max(1, Math.round(minimumSize) || 1);
  const safeTargetSize = Math.max(safeMinimumSize * itemCount, Math.round(targetSize) || 0);
  const normalizedSizes = sizes.map((size) => Math.max(safeMinimumSize, Math.round(Number(size) || 0)));

  if (sizes.length === 0) {
    return [];
  }

  const isEvenSource =
    normalizedSizes.length > 0 &&
    Math.max(...normalizedSizes) - Math.min(...normalizedSizes) <= 1;

  if (isEvenSource) {
    const baseSize = Math.max(safeMinimumSize, Math.floor(safeTargetSize / itemCount));
    let remainder = safeTargetSize - baseSize * itemCount;

    return Array.from({ length: itemCount }, () => {
      const nextSize = baseSize + (remainder > 0 ? 1 : 0);

      remainder -= 1;
      return Math.max(safeMinimumSize, nextSize);
    });
  }

  const extraSizes = normalizedSizes.map((size) => Math.max(0, size - safeMinimumSize));
  const totalExtraSize = extraSizes.reduce((sum, size) => sum + size, 0);
  const targetExtraSize = safeTargetSize - safeMinimumSize * itemCount;
  let usedSize = 0;
  const nextSizes = normalizedSizes.map((_size, index) => {
    const isLast = index === normalizedSizes.length - 1;
    const nextSize = isLast
      ? safeTargetSize - usedSize
      : safeMinimumSize +
        Math.round(targetExtraSize * (totalExtraSize > 0 ? extraSizes[index] / totalExtraSize : 1 / itemCount));

    usedSize += nextSize;
    return Math.max(safeMinimumSize, nextSize);
  });
  let overflow = nextSizes.reduce((sum, size) => sum + size, 0) - safeTargetSize;

  for (let index = nextSizes.length - 1; index >= 0 && overflow > 0; index -= 1) {
    const reduction = Math.min(overflow, Math.max(0, nextSizes[index] - safeMinimumSize));

    nextSizes[index] -= reduction;
    overflow -= reduction;
  }

  const deficit = safeTargetSize - nextSizes.reduce((sum, size) => sum + size, 0);

  if (deficit > 0) {
    nextSizes[nextSizes.length - 1] += deficit;
  }

  return nextSizes;
}
