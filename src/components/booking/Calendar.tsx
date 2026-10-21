import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { addDays, diffDays, toUTC, weekday, type ISODate } from '../../lib/dates';

// Range calendar for the booking wizard.
// - RTL: days are in DOM order Sunday → Saturday, so Sunday lands on the right.
// - A "night" is the date you sleep; check-out is the morning after the last night,
//   so the check-out date itself may be a night someone else has booked.
// - Keyboard: roving tabindex; arrows move by day/week (left = next day in RTL),
//   Home/End jump to week start/end, Enter/Space selects.

interface Props {
  start: ISODate | null;
  end: ISODate | null;
  min: ISODate;
  max: ISODate;
  isBlocked: (d: ISODate) => boolean;
  isDark: (d: ISODate) => boolean;
  /** nightly price shown under the date (hotel-engine style); null hides it */
  price?: (d: ISODate) => string | null;
  /** what the prices refer to, for the legend */
  priceNote?: string;
  onChange: (start: ISODate | null, end: ISODate | null, note?: string) => void;
}

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const monthStart = (d: ISODate) => `${d.slice(0, 7)}-01`;
const addMonths = (m: ISODate, n: number): ISODate => {
  const [y, mo] = m.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1 + n, 1));
  return t.toISOString().slice(0, 10);
};
const daysInMonth = (m: ISODate) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
};

export default function Calendar({ start, end, min, max, isBlocked, isDark, price, priceNote, onChange }: Props) {
  const [view, setView] = useState<ISODate>(monthStart(start ?? min));
  const [focus, setFocus] = useState<ISODate>(start ?? min);
  const gridRef = useRef<HTMLDivElement>(null);
  const keyNav = useRef(false);

  const months = [view, addMonths(view, 1)];
  const canPrev = toUTC(view) > toUTC(monthStart(min));
  const canNext = toUTC(addMonths(view, 1)) < toUTC(monthStart(max));

  // After keyboard navigation, move real DOM focus to the new day
  useEffect(() => {
    if (!keyNav.current) return;
    keyNav.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)?.focus();
  }, [focus, view]);

  const disabled = (d: ISODate) => toUTC(d) < toUTC(min) || toUTC(d) > toUTC(max);

  const pick = (d: ISODate) => {
    if (disabled(d)) return;
    // Picking a check-out: after the start, and every night in between is free
    if (start && !end && toUTC(d) > toUTC(start)) {
      for (let i = 0; i < diffDays(start, d); i++) {
        if (isBlocked(addDays(start, i))) {
          if (isBlocked(d)) return onChange(start, null, 'יש לילה תפוס בטווח. אפשר לבחור תאריך עזיבה מוקדם יותר.');
          return onChange(d, null, 'יש לילה תפוס בטווח, אז התחלנו מחדש מהתאריך שבחרתם.');
        }
      }
      return onChange(start, d);
    }
    if (isBlocked(d)) return onChange(start, end, 'הלילה הזה תפוס. אפשר לבחור לילה אחר.');
    onChange(d, null);
  };

  const moveFocus = (d: ISODate) => {
    if (disabled(d)) return;
    keyNav.current = true;
    setFocus(d);
    if (monthStart(d) !== view && monthStart(d) !== months[1]) setView(monthStart(d));
    else if (monthStart(d) === months[1] && window.matchMedia('(max-width: 767px)').matches) setView(monthStart(d));
  };

  const onKey = (e: KeyboardEvent, d: ISODate) => {
    const map: Record<string, number> = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: 7, ArrowUp: -7 };
    if (e.key in map) {
      e.preventDefault();
      moveFocus(addDays(d, map[e.key]));
    } else if (e.key === 'Home') {
      e.preventDefault();
      moveFocus(addDays(d, -weekday(d)));
    } else if (e.key === 'End') {
      e.preventDefault();
      moveFocus(addDays(d, 6 - weekday(d)));
    }
  };

  const inRange = (d: ISODate) => start && end && toUTC(d) > toUTC(start) && toUTC(d) < toUTC(end);

  const label = useMemo(
    () => (d: ISODate) => {
      const [y, m, day] = d.split('-').map(Number);
      const parts = [`יום ${DAY_NAMES[weekday(d)]}, ${day} ב${MONTHS[m - 1]} ${y}`];
      if (d === start) parts.push('הגעה');
      if (d === end) parts.push('עזיבה');
      if (isBlocked(d)) parts.push('תפוס');
      if (isDark(d)) parts.push('לילה מומלץ לתצפית');
      return parts.join(', ');
    },
    [start, end, isBlocked, isDark],
  );

  return (
    <div class="cal">
      <div class="cal__nav">
        <button type="button" class="cal__arrow" onClick={() => setView(addMonths(view, -1))} disabled={!canPrev} aria-label="החודש הקודם">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
        <button type="button" class="cal__arrow" onClick={() => setView(addMonths(view, 1))} disabled={!canNext} aria-label="החודש הבא">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
      </div>

      <div class="cal__months" ref={gridRef}>
        {months.map((m, mi) => {
          const [y, mo] = m.split('-').map(Number);
          const lead = weekday(m);
          const n = daysInMonth(m);
          return (
            <div class={`cal__month${mi === 1 ? ' cal__month--second' : ''}`} key={m}>
              <p class="cal__title" aria-live={mi === 0 ? 'polite' : undefined}>
                {MONTHS[mo - 1]} {y}
              </p>
              <div class="cal__grid" role="grid" aria-label={`${MONTHS[mo - 1]} ${y}`}>
                <div class="cal__row" role="row">
                  {DAYS.map((d, i) => (
                    <span class="cal__dow" role="columnheader" aria-label={DAY_NAMES[i]} key={d}>
                      {d}
                    </span>
                  ))}
                </div>
                {Array.from({ length: Math.ceil((lead + n) / 7) }, (_, w) => (
                  <div class="cal__row" role="row" key={w}>
                    {Array.from({ length: 7 }, (_, c) => {
                      const dayNum = w * 7 + c - lead + 1;
                      if (dayNum < 1 || dayNum > n) return <span class="cal__pad" role="gridcell" key={c} />;
                      const d = addDays(m, dayNum - 1);
                      const off = disabled(d);
                      const blocked = !off && isBlocked(d);
                      const cls = [
                        'cal__day',
                        d === start && 'is-start',
                        d === end && 'is-end',
                        inRange(d) && 'is-range',
                        blocked && 'is-blocked',
                        isDark(d) && !off && 'is-dark',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <span role="gridcell" key={c} aria-selected={d === start || d === end || !!inRange(d)}>
                          <button
                            type="button"
                            class={cls}
                            data-date={d}
                            disabled={off}
                            tabIndex={d === focus ? 0 : -1}
                            aria-label={label(d)}
                            aria-disabled={blocked || undefined}
                            onClick={() => {
                              setFocus(d);
                              pick(d);
                            }}
                            onKeyDown={(e) => onKey(e as KeyboardEvent, d)}
                          >
                            <span>{dayNum}</span>
                            {price && !off && !blocked && (() => {
                              const pr = price(d);
                              return pr ? <small class="cal__price" aria-hidden="true">{pr}</small> : null;
                            })()}
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p class="cal__legend">
        <span class="cal__key cal__key--dark" aria-hidden="true" /> לילה מומלץ לתצפית (סביב מולד הירח)
        <span class="cal__key cal__key--blocked" aria-hidden="true" /> תפוס
        {priceNote && <span class="cal__pnote">{priceNote}</span>}
      </p>
    </div>
  );
}
