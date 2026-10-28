// Sends a booking as a lead to Google Apps Script → Google Sheets (CLAUDE.md appendix A).
// Content-Type text/plain avoids a CORS preflight, which Apps Script can't answer.

import type { Quote } from './pricing';
import { shekels } from './pricing';

export interface LeadPayload {
  name: string;
  phone: string;
  email: string;
  suite: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  addons: { name: string; qty: number; total: number }[];
  coupon: string;
  lodging: number;
  discount: number;
  addonsTotal: number;
  total: number;
  vat: number;
  notes: string;
}

export function buildPayload(
  q: Quote,
  d: { name: string; phone: string; email: string; notes: string; suiteName: string; guests: number; coupon: string; checkIn: string },
): LeadPayload {
  return {
    name: d.name.trim(),
    phone: d.phone,
    email: d.email.trim(),
    suite: d.suiteName,
    checkIn: d.checkIn,
    checkOut: q.checkOut,
    nights: q.nights.length,
    guests: d.guests,
    addons: q.addons.map((a) => ({ name: a.name, qty: a.qty, total: shekels(a.total) })),
    coupon: q.couponApplied ? d.coupon.trim().toUpperCase() : '',
    lodging: shekels(q.lodging),
    discount: shekels(q.discount),
    addonsTotal: shekels(q.addonsTotal),
    total: shekels(q.total),
    vat: shekels(q.vat),
    notes: d.notes.trim(),
  };
}

const ENDPOINT = import.meta.env.PUBLIC_LEAD_ENDPOINT as string | undefined;

export async function sendLead(payload: LeadPayload, timeoutMs = 25000): Promise<void> {
  if (!ENDPOINT) {
    // Local development without an endpoint: simulate success so the flow can be tested.
    if (import.meta.env.DEV) {
      await new Promise((r) => setTimeout(r, 900));
      console.info('[lead] PUBLIC_LEAD_ENDPOINT not set; simulated send', payload);
      return;
    }
    throw new Error('missing-endpoint');
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`http-${res.status}`);
    const data = await res.json().catch(() => ({ ok: true }));
    if (data && data.ok === false) throw new Error(data.error === 'taken' ? 'taken' : 'rejected');
  } finally {
    clearTimeout(timer);
  }
}
