// Business facts — the ONLY numbers/claims allowed on the site (see CLAUDE.md §2)
export const site = {
  name: 'שחקים',
  nameEn: 'SHCHAKIM',
  tagline: 'לודג׳ תצפית כוכבים על שפת מכתש רמון',
  address: 'דרך בראשית, מצפה רמון',
  phone: '08-0000000',
  phoneHref: 'tel:+97280000000',
  // dummy, like the phone: the business is fictional
  accessibilityEmail: 'access@shchakim.co.il',
  geo: { lat: 30.61, lng: 34.8 },
  openedYear: 2022,
  stats: {
    suites: 9,
    suiteTypes: 3,
    clearNights: 300,
    guests: 4200,
    rating: 4.9,
    reviews: 380,
  },
} as const;

export const nav = [
  { href: '/suites', label: 'הסוויטות' },
  { href: '/experiences', label: 'חוויות' },
  { href: '/story', label: 'הסיפור' },
] as const;
