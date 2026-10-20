const ils = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 });

/** "1,450 ₪" — callers wrap in <bdi> so the number never flips inside Hebrew text. */
export const formatPrice = (shekels: number) => `${ils.format(shekels)} ₪`;

export const formatNumber = (n: number) => ils.format(n);
