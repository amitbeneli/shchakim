import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { navigate } from 'astro:transitions/client';
import Calendar from './Calendar';
import { addons as ADDONS, suites as SUITES, getSuite, pricingConfig as PRICING, type SuiteSlug } from '../../data/pricing';
import { isBooked, isStayFree, loadAvailability } from '../../data/booked';
import { addDays, diffDays, formatDateHe, isISODate, todayInIsrael, type ISODate } from '../../lib/dates';
import { checkCoupon, couponError, findCoupon, normalizeCoupon, quote, shekels, stayError, type Quote } from '../../lib/pricing';
import { isDarkNight, moonAge } from '../../lib/moon';
import { normalizeIsraeliMobile, validateEmail, validateName, validatePhone } from '../../lib/validate';
import { buildPayload, sendLead } from '../../lib/lead';
import { photos, src } from '../../data/images';

/* ─────────────── State ─────────────── */

interface State {
  step: number;
  checkIn: ISODate | null;
  checkOut: ISODate | null;
  guests: number;
  suite: SuiteSlug | null;
  addons: Record<string, number>;
  addonsTouched: boolean; // once the guest edits quantities we stop auto-syncing them
  name: string;
  phone: string;
  email: string;
  notes: string;
  coupon: string; // applied coupon (validated)
}

const KEY = 'shchakim-booking-v1';
const STEPS = ['תאריכים', 'אורחים וסוויטה', 'תוספות', 'פרטים', 'סיכום'];

const initial: State = {
  step: 0,
  checkIn: null,
  checkOut: null,
  guests: 2,
  suite: null,
  addons: {},
  addonsTouched: false,
  name: '',
  phone: '',
  email: '',
  notes: '',
  coupon: '',
};

// sessionStorage can throw (private mode, blocked storage): never let it break the wizard
const load = (): Partial<State> => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
};
const save = (s: State) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};

/** ?suite=…&date=YYYY-MM-DD&nights=N&guests=N pre-fill (from suite pages and the moon calendar) */
function fromQuery(today: ISODate): Partial<State> {
  const p = new URLSearchParams(location.search);
  const out: Partial<State> = {};
  const s = p.get('suite');
  if (s && getSuite(s)) out.suite = s as SuiteSlug;
  const d = p.get('date');
  const g = Number(p.get('guests'));
  if (Number.isInteger(g) && g >= 1 && g <= 4) out.guests = g;
  if (isISODate(d) && d >= today) {
    // ?nights=N from the home booking bar; otherwise pick the shortest valid stay
    const n = Number(p.get('nights'));
    const nights = Number.isInteger(n) && n >= 1 && !stayError(d, n) ? n : stayError(d, 1) ? 2 : 1;
    out.checkIn = d;
    out.checkOut = addDays(d, nights);
    out.step = 0;
  }
  return out;
}

/* ─────────────── Helpers ─────────────── */

const ils = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const ils2 = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Whole shekels show without decimals; anything with agorot always shows two (4,442.40, not 4,442.4)
const money = (agorot: number) => `${(agorot % 100 ? ils2 : ils).format(shekels(agorot))} ₪`;
const Money = ({ v, neg }: { v: number; neg?: boolean }) => (
  <bdi class="bk-money" dir="ltr">
    {neg ? '−' : ''}
    {money(v)}
  </bdi>
);

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
/** "יום ה׳, 12.11" for the check-in / check-out strip */
const DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const shortDate = (d: ISODate) => {
  const [, m, day] = d.split('-').map(Number);
  return `יום ${DAY_SHORT[new Date(`${d}T00:00:00Z`).getUTCDay()]}, ${day}.${m}`;
};
const Check = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" class="bk-ico">
    <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
);
const darkNight = (d: ISODate) => isDarkNight(moonAge(new Date(`${d}T20:00:00Z`))); // 22:00 Israel ≈ 20:00 UTC

/* ─────────────── Component ─────────────── */

export default function Wizard() {
  const today = useMemo(() => todayInIsrael(), []);
  const maxDate = useMemo(() => addDays(today, 365), [today]);
  const [s, setS] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  const [calNote, setCalNote] = useState('');
  const [tried, setTried] = useState<Record<number, boolean>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [couponInput, setCouponInput] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState<'idle' | 'sending' | 'error' | 'taken'>('idle');
  const [sheet, setSheet] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  // Live availability from the owner's sheet; bumps a version so the calendar redraws
  const [availVersion, setAvailVersion] = useState(0);
  useEffect(() => {
    loadAvailability().then((changed) => changed && setAvailVersion((v) => v + 1));
  }, []);

  // Hydrate: saved progress, then URL params on top
  useEffect(() => {
    const saved = load();
    const q = fromQuery(today);
    const merged = { ...initial, ...saved, ...q };
    if (merged.checkIn && merged.checkIn < today) Object.assign(merged, { checkIn: null, checkOut: null, step: 0 });
    // Arriving from a suite's "book" button with saved dates that suite can't take: don't carry
    // the dates (and a price) into it. Back to the calendar, which now shows that suite's free nights.
    if (q.suite && merged.checkIn && merged.checkOut && !isStayFree(q.suite, merged.checkIn, diffDays(merged.checkIn, merged.checkOut))) {
      Object.assign(merged, { checkIn: null, checkOut: null, step: 0 });
      setCalNote(`${getSuite(q.suite)!.name} תפוסה בתאריכים שבחרתם קודם. בלוח מסומנים הלילות הפנויים שלה.`);
    }
    setS(merged);
    setCouponInput(merged.coupon);
    // URL params are a one-time pre-fill: drop them so a reload resumes saved progress
    if (location.search) history.replaceState(history.state, '', location.pathname);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) save(s);
  }, [s, ready]);

  // Move focus to the step title on step change (screen readers announce it)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headRef.current?.focus();
    headRef.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [s.step]);

  const set = (patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch }));
  const nights = s.checkIn && s.checkOut ? diffDays(s.checkIn, s.checkOut) : 0;

  // Per-person add-ons follow the guest count until the guest edits them
  // (edited or not, a per-person add-on never counts more people than the stay has)
  useEffect(() => {
    const next: Record<string, number> = {};
    for (const a of ADDONS) {
      const qty = s.addons[a.id];
      if (!qty) continue;
      next[a.id] = a.pricing !== 'perPerson' ? 1 : s.addonsTouched ? Math.min(qty, s.guests) : s.guests;
    }
    set({ addons: next });
  }, [s.guests]);

  /* ── Availability ── */
  // Nightly price in the calendar: the chosen suite, or "from" the most affordable one.
  // Thursday and Friday nights carry the weekend surcharge, so the calendar shows it.
  const priceSuite = s.suite ? getSuite(s.suite)! : SUITES.reduce((a, b) => (a.nightly <= b.nightly ? a : b));
  const nightPrice = (d: ISODate) => {
    const base = priceSuite.nightly;
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    const v = PRICING.surchargeWeekdays.includes(wd) ? Math.round(base * (1 + PRICING.surchargeRate)) : base;
    return ils.format(v);
  };
  const priceNote = s.suite ? `המחירים בלוח: ללילה ב${priceSuite.name}, בש״ח` : `המחירים בלוח: החל מ־, ללילה ב${priceSuite.name}, בש״ח`;
  const suiteFree = (slug: SuiteSlug) => (s.checkIn && nights ? isStayFree(slug, s.checkIn, nights) : true);
  // Before a suite is chosen a night is only blocked if every suite is taken
  const blocked = useMemo(
    () => (d: ISODate) => (s.suite ? isBooked(s.suite, d) : SUITES.every((x) => isBooked(x.slug, d))),
    [s.suite, availVersion],
  );

  /* ── Live quote ── */
  const q: Quote | null = useMemo(() => {
    if (!s.checkIn || !nights || !s.suite) return null;
    const r = quote({
      suite: s.suite,
      checkIn: s.checkIn,
      nights,
      guests: Math.min(s.guests, getSuite(s.suite)!.maxGuests),
      addons: Object.entries(s.addons).map(([id, qty]) => ({ id: id as never, qty })),
      coupon: s.coupon,
    });
    return r.ok ? r.quote : null;
  }, [s.checkIn, nights, s.suite, s.guests, s.addons, s.coupon]);

  /* ── Per-step validation ── */
  const dateErr = !s.checkIn || !s.checkOut ? 'יש לבחור תאריך הגעה ותאריך עזיבה.' : stayError(s.checkIn, nights);
  const dateAvailErr =
    !dateErr && s.checkIn && !SUITES.some((x) => isStayFree(x.slug, s.checkIn!, nights))
      ? 'אין סוויטה פנויה לכל הלילות בטווח. נסו טווח אחר.'
      : null;
  const fieldErr = {
    name: validateName(s.name),
    phone: validatePhone(s.phone),
    email: validateEmail(s.email),
  };
  const suiteErr = !s.suite
    ? 'יש לבחור סוויטה.'
    : s.guests > getSuite(s.suite)!.maxGuests
      ? `${getSuite(s.suite)!.name} מתאימה לעד ${getSuite(s.suite)!.maxGuests} אורחים.`
      : !suiteFree(s.suite)
        ? 'הסוויטה תפוסה בחלק מהלילות שבחרתם.'
        : null;

  const stepValid = [
    !dateErr && !dateAvailErr,
    !suiteErr,
    true,
    !fieldErr.name && !fieldErr.phone && !fieldErr.email,
    !!q,
  ];

  const go = (step: number) => set({ step });
  const next = () => {
    setTried((t) => ({ ...t, [s.step]: true }));
    if (stepValid[s.step]) go(s.step + 1);
    else {
      // Focus the first invalid field on the details step
      if (s.step === 3) {
        const first = (['name', 'phone', 'email'] as const).find((f) => fieldErr[f]);
        if (first) document.getElementById(`bk-${first}`)?.focus();
      }
    }
  };
  const back = () => go(Math.max(0, s.step - 1));

  // Errors show on blur, and live after the first "continue" attempt on that step
  const showErr = (f: keyof typeof fieldErr) => (touched[f] || tried[3]) && fieldErr[f];

  /* ── Coupon ── */
  const couponRef = useRef<HTMLInputElement>(null);
  const applyCoupon = () => {
    // Read the field itself, not state: a paste followed by an instant tap can
    // run before Preact re-renders, and state would still hold the old value
    const value = couponRef.current?.value ?? couponInput;
    setCouponInput(value);
    const c = checkCoupon(value);
    if (c === 'none') {
      set({ coupon: '' });
      setCouponMsg(null);
    } else if (c === 'valid') {
      set({ coupon: value });
      setCouponMsg({ ok: true, text: `הקוד הופעל: ${Math.round((findCoupon(value)?.rate ?? 0) * 100)}% הנחה על הלינה.` });
    } else {
      set({ coupon: '' });
      setCouponMsg({ ok: false, text: couponError });
    }
  };

  /* ── Submit ── */
  const submit = async () => {
    if (!q || !s.suite || !s.checkIn || sending === 'sending') return;
    setSending('sending');
    try {
      const payload = buildPayload(q, {
        name: s.name,
        phone: normalizeIsraeliMobile(s.phone) ?? s.phone,
        email: s.email,
        notes: s.notes,
        suiteName: getSuite(s.suite)!.name,
        guests: s.guests,
        coupon: s.coupon,
        checkIn: s.checkIn,
      });
      await sendLead(payload);
      try {
        sessionStorage.setItem(
          'shchakim-last-booking',
          JSON.stringify({ name: payload.name, suite: payload.suite, slug: s.suite, checkIn: payload.checkIn, checkOut: payload.checkOut, nights: payload.nights, guests: payload.guests, total: q.total, email: payload.email }),
        );
        sessionStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      navigate('/thanks');
    } catch (err) {
      // the owner's sheet says one of the nights is closed (checked again on the server, so a
      // night closed after the calendar loaded can't be booked)
      setSending(err instanceof Error && err.message === 'taken' ? 'taken' : 'error');
    }
  };

  if (!ready) return <div class="bk bk--loading" aria-busy="true" />;

  const suite = s.suite ? getSuite(s.suite)! : null;

  /* ─────────────── Summary (sidebar / bottom sheet) ─────────────── */
  const summary = (
    <div class="bk-sum__body">
      {/* The stay, the way a hotel confirms it: the room, then the two dates */}
      <figure class="bk-sum__media">
        <img src={src(suite ? suite.photo : photos.lodgeExterior, 800)} alt="" loading="lazy" width="800" height="533" />
        <figcaption>{suite ? suite.name : 'שחקים, שפת מכתש רמון'}</figcaption>
      </figure>
      <div class="bk-stay">
        <div>
          <span>צ׳ק־אין</span>
          <strong>{s.checkIn ? shortDate(s.checkIn) : 'בחרו תאריך'}</strong>
          <small>מ־15:00</small>
        </div>
        <div class="bk-stay__n" aria-label={nights ? `${nights} לילות` : undefined}>
          {nights ? (nights === 1 ? 'לילה אחד' : `${nights} לילות`) : ''}
        </div>
        <div>
          <span>צ׳ק־אאוט</span>
          <strong>{s.checkOut ? shortDate(s.checkOut) : '—'}</strong>
          <small>עד 11:00</small>
        </div>
      </div>
      <dl class="bk-sum__facts">
        <div>
          <dt>אורחים</dt>
          <dd>{s.guests === 1 ? 'אורח אחד' : `${s.guests} אורחים`}</dd>
        </div>
      </dl>
      {q ? (
        <>
          <ul class="bk-sum__lines" role="list">
            {q.nights.map((n) => (
              <li key={n.date}>
                <span>
                  לילה {DAY_NAMES[n.weekday]}
                  {n.surcharge > 0 && <small> (+20%)</small>}
                </span>
                <Money v={n.total} />
              </li>
            ))}
            {q.discount > 0 && (
              <li class="bk-sum__disc">
                <span>הנחת {normalizeCoupon(s.coupon)} על הלינה</span>
                <Money v={q.discount} neg />
              </li>
            )}
            {q.addons.map((a) => (
              <li key={a.id}>
                <span>
                  {a.name}
                  {a.perPerson && <small> × {a.qty}</small>}
                </span>
                <Money v={a.total} />
              </li>
            ))}
          </ul>
          <p class="bk-sum__total">
            <span>סה״כ לתשלום</span>
            <Money v={q.total} />
          </p>
          <p class="bk-sum__vat">
            <span>מתוכם מע״מ (18%)</span>
            <Money v={q.vat} />
          </p>
        </>
      ) : (
        <p class="bk-sum__empty">המחיר יופיע כאן אחרי שתבחרו תאריכים וסוויטה.</p>
      )}
      <ul class="bk-trust" role="list">
        <li>
          <Check /> לא גובים תשלום עכשיו
        </li>
        <li>
          <Check /> ביטול ללא עלות עד 14 יום לפני ההגעה
        </li>
        <li>
          <Check /> נחזור אליכם לאישור תוך יום
        </li>
        <li class="bk-trust__terms">
          <a href="/terms">התקנון המלא</a>
        </li>
      </ul>
    </div>
  );

  /* ─────────────── Steps ─────────────── */
  const steps = [
    // 1. Dates
    <div class="bk-step">
      <Calendar
        start={s.checkIn}
        end={s.checkOut}
        min={today}
        max={maxDate}
        isBlocked={blocked}
        isDark={darkNight}
        price={nightPrice}
        priceNote={priceNote}
        onChange={(a, b, note) => {
          set({ checkIn: a, checkOut: b });
          setCalNote(note ?? '');
        }}
      />
      <div class="bk-msgs" aria-live="polite">
        {/* what the next tap does, until both dates are set */}
        {!s.checkIn && <p class="bk-msg">בחרו את לילה ההגעה.</p>}
        {s.checkIn && !s.checkOut && <p class="bk-msg">עכשיו בחרו את יום העזיבה.</p>}
        {calNote && <p class="bk-msg">{calNote}</p>}
        {s.checkIn && s.checkOut && !dateErr && (
          <p class="bk-msg bk-msg--ok">
            {nights} {nights === 1 ? 'לילה' : 'לילות'}: {formatDateHe(s.checkIn)} עד {formatDateHe(s.checkOut)}
          </p>
        )}
        {(tried[0] || (s.checkIn && s.checkOut)) && (dateErr || dateAvailErr) && <p class="bk-msg bk-msg--err">{dateErr || dateAvailErr}</p>}
      </div>
      <p class="bk-hint">לילות חמישי ושישי בתוספת 20%, והזמנה שכוללת אותם היא לפחות שני לילות. עד 7 לילות בהזמנה.</p>
      {!s.suite && (
        <p class="bk-hint">עוד לא בחרתם סוויטה, ולכן פתוח כל לילה שיש בו סוויטה פנויה אחת לפחות. בשלב הבא תראו אילו סוויטות פנויות בתאריכים שבחרתם.</p>
      )}
    </div>,

    // 2. Guests + suite
    <div class="bk-step">
      <div class="bk-guests">
        <span id="bk-guests-label">כמה אורחים?</span>
        <div class="bk-stepper" role="group" aria-labelledby="bk-guests-label">
          <button type="button" onClick={() => set({ guests: Math.min(4, s.guests + 1) })} disabled={s.guests >= 4} aria-label="אורח נוסף">
            +
          </button>
          <output aria-live="polite">{s.guests}</output>
          <button type="button" onClick={() => set({ guests: Math.max(1, s.guests - 1) })} disabled={s.guests <= 1} aria-label="אורח אחד פחות">
            −
          </button>
        </div>
      </div>
      <fieldset class="bk-suites">
        <legend class="visually-hidden">בחירת סוויטה</legend>
        {SUITES.filter((x) => x.maxGuests >= s.guests).map((x) => {
          const free = suiteFree(x.slug);
          return (
            <label class={`bk-suite${s.suite === x.slug ? ' is-on' : ''}${free ? '' : ' is-off'}`} key={x.slug}>
              <input
                type="radio"
                name="suite"
                value={x.slug}
                checked={s.suite === x.slug}
                disabled={!free}
                onChange={() => set({ suite: x.slug })}
              />
              <span class="bk-suite__media">
                <img src={src(x.photo, 800)} alt="" loading="lazy" width="800" height="533" />
                {s.suite === x.slug && (
                  <span class="bk-suite__badge">
                    <Check /> נבחרה
                  </span>
                )}
              </span>
              <span class="bk-suite__text">
                <strong>{x.name}</strong>
                <span>{x.highlight}</span>
                <span class="bk-suite__chips">
                  {x.amenities.slice(0, 3).map((a) => (
                    <span key={a}>{a}</span>
                  ))}
                </span>
                <span class="bk-suite__meta">
                  <span>עד {x.maxGuests} אורחים</span>
                  <span>
                    <bdi dir="ltr" class="bk-suite__price">{ils.format(x.nightly)} ₪</bdi> ללילה
                  </span>
                </span>
                {!free && <em>תפוסה בתאריכים שבחרתם</em>}
              </span>
            </label>
          );
        })}
      </fieldset>
      {SUITES.some((x) => x.maxGuests < s.guests) && <p class="bk-hint">לארבעה אורחים מתאימה וילת גלקסיה בלבד.</p>}
      <div aria-live="polite">{tried[1] && suiteErr && <p class="bk-msg bk-msg--err">{suiteErr}</p>}</div>
    </div>,

    // 3. Add-ons
    <div class="bk-step">
      <ul class="bk-addons" role="list">
        {ADDONS.map((a) => {
          const qty = s.addons[a.id] ?? 0;
          const perPerson = a.pricing === 'perPerson';
          const setQty = (n: number) => {
            const next = { ...s.addons };
            if (n > 0) next[a.id] = n;
            else delete next[a.id];
            set({ addons: next, addonsTouched: true });
          };
          return (
            <li class={`bk-addon${qty ? ' is-on' : ''}`} key={a.id}>
              <img src={src(a.photo, 480)} alt="" loading="lazy" width="320" height="320" />
              <div class="bk-addon__text">
                <strong id={`bk-a-${a.id}`}>{a.name}</strong>
                <span>{a.summary}</span>
                <span class="bk-addon__meta">
                  {a.duration} · <bdi dir="ltr">{ils.format(a.price)} ₪</bdi> {perPerson ? 'לאדם' : 'להזמנה'}
                </span>
              </div>
              {perPerson ? (
                <div class="bk-stepper bk-stepper--sm" role="group" aria-labelledby={`bk-a-${a.id}`}>
                  <button type="button" onClick={() => setQty(qty === 0 ? s.guests : qty + 1)} disabled={qty >= s.guests} aria-label={`הוספת משתתף ל${a.name}`}>
                    +
                  </button>
                  <output aria-live="polite">{qty}</output>
                  <button type="button" onClick={() => setQty(qty - 1)} disabled={qty === 0} aria-label={`משתתף אחד פחות ב${a.name}`}>
                    −
                  </button>
                </div>
              ) : (
                <label class="bk-toggle">
                  <input type="checkbox" checked={qty > 0} onChange={(e) => setQty((e.target as HTMLInputElement).checked ? 1 : 0)} />
                  <span>להוסיף</span>
                </label>
              )}
            </li>
          );
        })}
      </ul>
      <p class="bk-hint">אפשר לדלג. אפשר גם להוסיף חוויות בהמשך, בשיחת האישור.</p>
    </div>,

    // 4. Details
    <div class="bk-step bk-form">
      {(
        [
          ['name', 'שם מלא', 'text', 'name', 'text'],
          ['phone', 'טלפון נייד', 'tel', 'tel', 'tel'],
          ['email', 'אימייל', 'email', 'email', 'email'],
        ] as const
      ).map(([f, label, type, ac, im]) => {
        const err = showErr(f);
        return (
          <div class={`bk-field${err ? ' is-err' : ''}`} key={f}>
            <label for={`bk-${f}`}>{label}</label>
            <input
              id={`bk-${f}`}
              type={type as 'text'}
              autoComplete={ac}
              inputMode={im}
              dir={f === 'name' ? undefined : 'ltr'}
              value={s[f]}
              aria-invalid={err ? 'true' : undefined}
              aria-describedby={err ? `bk-${f}-err` : undefined}
              onInput={(e) => set({ [f]: (e.target as HTMLInputElement).value } as Partial<State>)}
              onBlur={() => setTouched((t) => ({ ...t, [f]: true }))}
            />
            {err && (
              <p class="bk-field__err" id={`bk-${f}-err`}>
                {err}
              </p>
            )}
          </div>
        );
      })}
      <div class="bk-field">
        <label for="bk-notes">
          בקשות מיוחדות <small>(לא חובה)</small>
        </label>
        <textarea
          id="bk-notes"
          rows={3}
          value={s.notes}
          placeholder="יום הולדת, הצעת נישואין, תזונה, נגישות…"
          onInput={(e) => set({ notes: (e.target as HTMLTextAreaElement).value })}
        />
      </div>
    </div>,

    // 5. Summary + send
    <div class="bk-step">
      <div class="bk-review">
        {summary}
        <dl class="bk-review__who">
          <div>
            <dt>שם</dt>
            <dd>{s.name}</dd>
          </div>
          <div>
            <dt>טלפון</dt>
            <dd>
              <bdi dir="ltr">{normalizeIsraeliMobile(s.phone) ?? s.phone}</bdi>
            </dd>
          </div>
          <div>
            <dt>אימייל</dt>
            <dd>
              <bdi dir="ltr">{s.email}</bdi>
            </dd>
          </div>
          {s.notes && (
            <div>
              <dt>בקשות</dt>
              <dd>{s.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      <div class="bk-coupon">
        <label for="bk-coupon">קוד קופון</label>
        <div class="bk-coupon__row">
          <input
            id="bk-coupon"
            ref={couponRef}
            dir="ltr"
            value={couponInput}
            autoComplete="off"
            autoCapitalize="characters"
            spellcheck={false}
            aria-describedby={couponMsg ? 'bk-coupon-msg' : undefined}
            onInput={(e) => setCouponInput((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyCoupon())}
          />
          <button type="button" class="btn btn--ghost" onClick={applyCoupon}>
            הפעלה
          </button>
        </div>
        <div aria-live="polite">
          {couponMsg && (
            <p id="bk-coupon-msg" class={`bk-msg ${couponMsg.ok ? 'bk-msg--ok' : 'bk-msg--err'}`}>
              {couponMsg.text}
            </p>
          )}
        </div>
      </div>

      <div aria-live="assertive">
        {sending === 'error' && (
          <p class="bk-msg bk-msg--err">
            לא הצלחנו לשלוח את ההזמנה. הפרטים שלכם שמורים, אפשר לנסות שוב, או להתקשר אלינו ל־<bdi dir="ltr">08-0000000</bdi>.
          </p>
        )}
        {sending === 'taken' && (
          <p class="bk-msg bk-msg--err">
            אחד הלילות שבחרתם נתפס בינתיים בסוויטה הזו. הפרטים שלכם שמורים.{' '}
            <button
              type="button"
              class="text-link"
              onClick={() => {
                setSending('idle');
                set({ checkIn: null, checkOut: null, step: 0 });
              }}
            >
              לבחירת תאריכים אחרים
            </button>
          </p>
        )}
      </div>
    </div>,
  ];

  const last = s.step === STEPS.length - 1;

  return (
    <div class="bk">
      {/* Progress */}
      <nav class="bk-progress" aria-label="שלבי ההזמנה">
        <ol role="list">
          {STEPS.map((name, i) => {
            const done = i < s.step;
            return (
              <li class={`${done ? 'is-done' : ''}${i === s.step ? ' is-current' : ''}`} key={name}>
                {done ? (
                  <button type="button" onClick={() => go(i)}>
                    <span class="bk-progress__n" aria-hidden="true">✓</span>
                    <span class="bk-progress__name">{name}</span>
                  </button>
                ) : (
                  <span aria-current={i === s.step ? 'step' : undefined}>
                    <span class="bk-progress__n" aria-hidden="true">{i + 1}</span>
                    <span class="bk-progress__name">{name}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <div class="bk-progress__bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${(s.step + 1) / STEPS.length})` }} />
        </div>
      </nav>

      <div class={`bk-layout${last ? ' bk-layout--single' : ''}`}>
        <section class="bk-main" aria-labelledby="bk-step-title">
          <h2 id="bk-step-title" class="bk-title" tabIndex={-1} ref={headRef}>
            <span class="visually-hidden">
              שלב {s.step + 1} מתוך {STEPS.length}:{' '}
            </span>
            {['תאריכי השהייה', 'אורחים וסוויטה', 'חוויות לתוספת', 'פרטי התקשרות', 'סיכום ההזמנה'][s.step]}
          </h2>

          <div key={s.step} class="bk-anim">
            {steps[s.step]}
          </div>

          <div class="bk-nav">
            {last ? (
              <button type="button" class="btn bk-nav__next" onClick={submit} disabled={sending === 'sending' || !q} aria-busy={sending === 'sending'}>
                {sending === 'sending' ? (
                  <>
                    <span class="bk-spinner" aria-hidden="true" /> שולחים את פרטי ההזמנה…
                  </>
                ) : sending === 'error' ? (
                  'לנסות שוב'
                ) : (
                  'לשלוח את ההזמנה'
                )}
              </button>
            ) : (
              <button type="button" class="btn bk-nav__next" onClick={next}>
                המשך
                <svg class="icon-forward" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            )}
            {s.step > 0 && (
              <button type="button" class="bk-nav__back" onClick={back}>
                חזרה
              </button>
            )}
          </div>
        </section>

        {/* Desktop: sticky sidebar (the last step shows the full summary inline instead) */}
        {!last && (
          <aside class="bk-sum" aria-label="סיכום ההזמנה">
            <h2 class="bk-sum__title">ההזמנה שלכם</h2>
            {summary}
          </aside>
        )}
      </div>

      {/* Mobile: bottom bar that expands into the full breakdown */}
      <div class={`bk-bar${sheet ? ' is-open' : ''}`}>
        <div class="bk-bar__sheet" id="bk-sheet" hidden={!sheet}>
          {summary}
        </div>
        <button type="button" class="bk-bar__toggle" aria-expanded={sheet} aria-controls="bk-sheet" onClick={() => setSheet(!sheet)}>
          {suite && <img class="bk-bar__thumb" src={src(suite.photo, 480)} alt="" width="48" height="48" />}
          <span class="bk-bar__what">
            <span>{suite ? suite.name : 'ההזמנה שלכם'}</span>
            <small>{nights ? `${nights === 1 ? 'לילה אחד' : `${nights} לילות`} · ${s.guests} אורחים` : 'בחרו תאריכים וסוויטה'}</small>
          </span>
          {q && <Money v={q.total} />}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          <span class="visually-hidden">{sheet ? 'סגירת הפירוט' : 'פירוט המחיר'}</span>
        </button>
      </div>
    </div>
  );
}
