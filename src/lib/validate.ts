// Contact-form validation for the booking wizard. Messages are Hebrew and
// say what to do, not just what is wrong.

/** Israeli mobile: 05X-XXXXXXX, with or without dash/spaces, or +972 5X… */
export function normalizeIsraeliMobile(raw: string): string | null {
  const digits = raw.replace(/[\s\-().]/g, '');
  const m = digits.match(/^(?:\+?972|0)(5\d)(\d{7})$/);
  return m ? `0${m[1]}-${m[2]}` : null;
}

export function validateName(v: string): string | null {
  const t = v.trim();
  if (!t) return 'נשמח לדעת איך לפנות אליכם.';
  if (t.length < 2) return 'השם קצר מדי.';
  return null;
}

export function validatePhone(v: string): string | null {
  if (!v.trim()) return 'נצטרך טלפון כדי לאשר את ההזמנה.';
  return normalizeIsraeliMobile(v) ? null : 'מספר נייד ישראלי, למשל 050-1234567.';
}

export function validateEmail(v: string): string | null {
  const t = v.trim();
  if (!t) return 'נשלח לכאן את אישור ההזמנה.';
  // Pragmatic check: something@something.tld, no spaces
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) ? null : 'כתובת המייל לא נראית תקינה, למשל name@gmail.com.';
}
