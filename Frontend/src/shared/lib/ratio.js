const trimmed = (value) => String(Math.round(value * 100) / 100);

/**
 * A ratio always reads with 1 on the left, so 10:326 shows as 1:32.6 and 3:90 as 1:30.
 * Nothing on the left (0) cannot be scaled, so it stays as entered.
 */
export const ratioText = (numerator, denominator) => {
  const left = Number(numerator);
  const right = Number(denominator);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return '-';
  if (left === 0) return `0:${trimmed(right)}`;
  return `1:${trimmed(right / left)}`;
};

export default ratioText;
