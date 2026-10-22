import { expect, test } from '@playwright/test';

const routes = ['/', '/suites', '/suites/makhtesh', '/suites/kochav', '/suites/galaxia', '/experiences', '/story', '/book', '/thanks', '/accessibility', '/terms'];

for (const route of routes) {
  test(`${route}: RTL, title, no horizontal scroll, no console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      // Third-party weather API failures are handled by the widget, not page errors
      if (m.type() === 'error' && !/open-meteo|Fetch API cannot load/.test(m.text())) errors.push(m.text());
    });
    await page.goto(route);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    expect(await page.title()).not.toBe('');
    // Walk the page so scroll-driven components initialise
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 30));
      }
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test('404 page is designed and in Hebrew', async ({ page }) => {
  const res = await page.goto('/no-such-page');
  expect(res?.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('הכוכב');
});

test('booking: brief acceptance case prices correctly', async ({ page }) => {
  await page.goto('/book?suite=kochav');
  // Find a Thursday with Thursday and Friday free in Kochav, paging months if needed
  let thu: string | null = null;
  for (let k = 0; k < 8 && !thu; k++) {
    thu = await page.evaluate(() => {
      const days = [...document.querySelectorAll<HTMLButtonElement>('.cal__month:not(.cal__month--second) .cal__day[data-date]')];
      for (const d of days) {
        const date = d.dataset.date!;
        if (new Date(`${date}T00:00:00Z`).getUTCDay() !== 4 || d.disabled || d.classList.contains('is-blocked')) continue;
        const fri = document.querySelector(`[data-date="${new Date(Date.parse(date) + 864e5).toISOString().slice(0, 10)}"]`);
        if (fri && !fri.classList.contains('is-blocked')) return date;
      }
      return null;
    });
    if (!thu) await page.click('.cal__arrow[aria-label="החודש הבא"]');
  }
  expect(thu).not.toBeNull();
  const sat = new Date(Date.parse(thu!) + 2 * 864e5).toISOString().slice(0, 10);
  await page.click(`[data-date="${thu}"]`);
  await page.click(`[data-date="${sat}"]`);
  await page.click('.bk-nav__next');
  await page.click('.bk-nav__next'); // 2 guests, Kochav pre-selected
  await page.click('button[aria-label="הוספת משתתף לתצפית מודרכת עם אסטרונום"]');
  await page.click('.bk-nav__next');
  await page.click('.bk-nav__next'); // empty details → errors
  await expect(page.locator('.bk-field__err').first()).toBeVisible();
  await page.fill('#bk-name', 'בדיקה אוטומטית');
  await page.fill('#bk-phone', '0501234567');
  await page.fill('#bk-email', 'test@example.com');
  await page.click('.bk-nav__next');
  await page.fill('#bk-coupon', 'WRONG');
  await page.click('.bk-coupon .btn');
  await expect(page.locator('#bk-coupon-msg')).toContainText('לא תקף');
  await page.fill('#bk-coupon', ' stars10 ');
  await page.click('.bk-coupon .btn');
  await expect(page.locator('.bk-step .bk-sum__total')).toContainText('4,442.40');
  await expect(page.locator('.bk-step .bk-sum__vat')).toContainText('677.65');
});

test('reduced motion: hero is a static night, nothing hidden', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('[data-moonpath]')).toBeHidden();
  const hidden = await page.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).opacity === '0').length);
  expect(hidden).toBe(0);
  await ctx.close();
});

test('FAQ: a native accordion that works from the keyboard', async ({ page }) => {
  await page.goto('/');
  const first = page.locator('.r10 details').first();
  await first.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('open', '');
  await page.keyboard.press('Space');
  await expect(first).not.toHaveAttribute('open', '');
  expect(await page.locator('.r10 details').count()).toBeGreaterThanOrEqual(8);
});

test('R7: the slider moves with the keyboard and reports its value', async ({ page }) => {
  await page.goto('/');
  const handle = page.locator('[data-r7-handle]');
  await expect(handle).toHaveAttribute('role', 'slider');
  await handle.focus();
  await page.keyboard.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '0');
  await page.keyboard.press('End');
  await expect(handle).toHaveAttribute('aria-valuenow', '100');
  // RTL: the arrow follows the screen, so ArrowRight moves the divider right (less Ramon)
  await page.keyboard.press('ArrowRight');
  await expect(handle).toHaveAttribute('aria-valuenow', '95');
});

test('floating book button never doubles a booking button on screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the floating button is a phone feature');
  await page.goto('/');
  const fab = page.locator('[data-fab]');
  await page.locator('.close .btn').scrollIntoViewIfNeeded();
  await expect(fab).not.toHaveClass(/is-visible/);
  await page.locator('.site-footer').scrollIntoViewIfNeeded();
  await expect(fab).not.toHaveClass(/is-visible/);
});
