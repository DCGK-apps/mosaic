import { expect, test, type Page } from '@playwright/test';
import { addPhotos, box, cells, dividers, getDoc, inPanel, mouseDrag, openApp, touchDrag, undoButton } from './fixtures';

/** 2×2 grid: two rows, each split in the middle – the edges form a cross. */
test.beforeEach(async ({ page }) => {
  await openApp(page);
  await addPhotos(page, ['landscape', 'portrait', 'square', 'wide']);
  await inPanel(page, () => page.getByTestId('mode-grid').click());
});

/** Cell rectangles by photo, in the order of the photos – the DOM order follows the tree, which changes. */
async function cellBoxes(page: Page): Promise<DOMRect[]> {
  const all = await cells(page).evaluateAll((els) =>
    els.map((e) => ({ id: (e as HTMLElement).dataset.photoId!, r: e.getBoundingClientRect().toJSON() as DOMRect })),
  );
  const order = ((await getDoc(page)).photos as { id: string }[]).map((p) => p.id);
  return order.map((id) => all.find((c) => c.id === id)!.r);
}
const horizontal = async (page: Page) => box(dividers(page, 'H').first());

test('the left half of a crossed edge moves on its own; undo restores it in one step', async ({ page }) => {
  const before = await cellBoxes(page);
  const h = await horizontal(page);
  const from = { x: h.x + h.width * 0.2, y: h.y + h.height / 2 };
  await mouseDrag(page, from, { x: from.x, y: from.y + 40 });

  const after = await cellBoxes(page);
  // Top-left taller, bottom-left shorter, the right column untouched.
  expect(after[0]!.height).toBeGreaterThan(before[0]!.height + 30);
  expect(after[2]!.height).toBeLessThan(before[2]!.height - 30);
  expect(after[1]).toEqual(before[1]);
  expect(after[3]).toEqual(before[3]);
  // Now the right half can go the other way.
  await expect(dividers(page, 'H')).toHaveCount(2);
  const right = await box(dividers(page, 'H').nth(1));
  const r = { x: right.x + right.width / 2, y: right.y + right.height / 2 };
  await mouseDrag(page, r, { x: r.x, y: r.y - 30 });
  const moved = await cellBoxes(page);
  expect(moved[1]!.height).toBeLessThan(before[1]!.height - 20);
  expect(moved[0]).toEqual(after[0]);

  await undoButton(page).click();
  await undoButton(page).click();
  await expect.poll(() => cellBoxes(page)).toEqual(before);
});

test('an edge snaps to the one in line with it (Shift: no snapping)', async ({ page }) => {
  const top = await box(dividers(page, 'V').first());
  const c = { x: top.x + top.width / 2, y: top.y + top.height / 2 };
  await mouseDrag(page, c, { x: c.x + 60, y: c.y });
  const moved = (await getDoc(page)).tree.a.frac;
  expect(moved).toBeGreaterThan(0.55);
  // Back to 3 px short of the edge below: snaps into line with it.
  const back = { x: c.x + 60, y: c.y };
  await mouseDrag(page, back, { x: c.x + 3, y: c.y });
  let doc = await getDoc(page);
  expect(doc.tree.a.frac).toBe(doc.tree.b.frac);
  // With Shift it stays where the mouse left it.
  await mouseDrag(page, { x: c.x, y: c.y }, { x: c.x + 40, y: c.y });
  await page.keyboard.down('Shift');
  await mouseDrag(page, { x: c.x + 40, y: c.y }, { x: c.x + 3, y: c.y });
  await page.keyboard.up('Shift');
  doc = await getDoc(page);
  expect(doc.tree.a.frac).not.toBe(doc.tree.b.frac);
});

const knob = (page: Page) => page.getByTestId('junction');
const knobCenter = async (page: Page) => {
  const b = await box(knob(page));
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test('a crossing has a knob with the "move" cursor; edges have resize cursors', async ({ page }) => {
  await expect(knob(page)).toHaveCount(1);
  await expect(knob(page)).toHaveCSS('cursor', 'move');
  await expect(dividers(page, 'H').first()).toHaveCSS('cursor', 'row-resize');
  await expect(dividers(page, 'V').first()).toHaveCSS('cursor', 'col-resize');
});

test('the knob moves the whole line – the direction of the drag picks which one', async ({ page }) => {
  const cross = await knobCenter(page);
  const before = await cellBoxes(page);
  await mouseDrag(page, cross, { x: cross.x, y: cross.y + 40 });
  const down = await cellBoxes(page);
  // Both top photos taller, both bottom ones shorter.
  for (const i of [0, 1]) expect(down[i]!.height).toBeGreaterThan(before[i]!.height + 30);
  for (const i of [2, 3]) expect(down[i]!.height).toBeLessThan(before[i]!.height - 30);
  const cross2 = await knobCenter(page);
  await mouseDrag(page, cross2, { x: cross2.x + 40, y: cross2.y });
  const side = await cellBoxes(page);
  // The whole vertical line moved: both left photos wider, heights unchanged.
  for (const i of [0, 2]) expect(side[i]!.width).toBeGreaterThan(down[i]!.width + 30);
  for (const i of [0, 1, 2, 3]) expect(side[i]!.height).toBeCloseTo(down[i]!.height, 0);
});

test('after cutting, the parts brought back in line move together again from the knob', async ({ page }) => {
  const h = await horizontal(page);
  const left = { x: h.x + h.width * 0.2, y: h.y + h.height / 2 };
  // Cut: the left half goes down…
  await mouseDrag(page, left, { x: left.x, y: left.y + 40 });
  await expect(dividers(page, 'H')).toHaveCount(2);
  await expect(knob(page)).toHaveCount(0); // not in line: no crossing
  // …and back up, snapping into line with the right half.
  await mouseDrag(page, { x: left.x, y: left.y + 40 }, { x: left.x, y: left.y + 2 });
  const inLine = await cellBoxes(page);
  expect(inLine[0]!.height).toBeCloseTo(inLine[1]!.height, 0);
  // The knob is back; grabbed there, the whole horizontal line moves.
  await expect(knob(page)).toHaveCount(1);
  const cross = await knobCenter(page);
  await mouseDrag(page, cross, { x: cross.x, y: cross.y + 40 });
  const after = await cellBoxes(page);
  for (const i of [0, 1]) expect(after[i]!.height).toBeGreaterThan(inLine[i]!.height + 30);
  expect(after[0]!.height).toBeCloseTo(after[1]!.height, 0);
  await expect(dividers(page, 'H')).toHaveCount(1);
});

test('touch: the knob moves the whole line', async ({ page }, info) => {
  test.skip(!info.project.use.hasTouch, 'touch-only');
  const before = await cellBoxes(page);
  const c = await knobCenter(page);
  await touchDrag(page, c, { x: c.x, y: c.y + 30 });
  await expect.poll(async () => (await cellBoxes(page))[0]!.height).toBeGreaterThan(before[0]!.height + 20);
  const after = await cellBoxes(page);
  expect(after[1]!.height).toBeCloseTo(after[0]!.height, 0);
});

test('touch: a finger moves one half of a crossed edge', async ({ page }, info) => {
  test.skip(!info.project.use.hasTouch, 'touch-only');
  const before = await cellBoxes(page);
  const h = await horizontal(page);
  const from = { x: h.x + h.width * 0.62, y: h.y + h.height / 2 };
  await touchDrag(page, from, { x: from.x, y: from.y + 30 });
  await expect.poll(async () => (await cellBoxes(page))[1]!.height).toBeGreaterThan(before[1]!.height + 20);
  const after = await cellBoxes(page);
  expect(after[0]).toEqual(before[0]);
});

test('"Układ" tool: dragging inside a photo moves its nearest edge, not the crop', async ({ page }) => {
  await page.getByTestId('tool-edges').click();
  await expect(page.getByTestId('tool-edges')).toHaveAttribute('aria-checked', 'true');
  const before = await cellBoxes(page);
  const crops = (await getDoc(page)).photos.map((p: { crop: unknown }) => p.crop);
  // Down in the bottom-right photo, near its top: the edges form a cross, so only the right half of the horizontal edge moves.
  const d = before[3]!;
  const p = { x: d.x + d.width * 0.5, y: d.y + d.height * 0.2 };
  await mouseDrag(page, p, { x: p.x + 2, y: p.y + 30 });
  const after = await cellBoxes(page);
  expect(after[3]!.height).toBeLessThan(d.height - 20);
  expect(after[1]!.height).toBeGreaterThan(before[1]!.height + 20);
  expect(after[0]).toEqual(before[0]);
  expect(after[2]).toEqual(before[2]);
  // Top-left photo, near its right side, dragged to the right: the vertical edge moves –
  // as a whole, since the horizontal halves are no longer in line (no crossing to cut at).
  const a = after[0]!;
  const from = { x: a.x + a.width * 0.8, y: a.y + a.height * 0.5 };
  await mouseDrag(page, from, { x: from.x + 40, y: from.y + 3 });
  const last = await cellBoxes(page);
  expect(last[0]!.width).toBeGreaterThan(a.width + 30);
  expect(last[1]!.width).toBeLessThan(after[1]!.width - 30);
  expect(last[2]!.width).toBeGreaterThan(after[2]!.width + 30);
  expect(last[0]!.height).toBeCloseTo(after[0]!.height, 0);
  expect((await getDoc(page)).photos.map((ph: { crop: unknown }) => ph.crop)).toEqual(crops);
});

test('touch, "Układ" tool: a finger anywhere on a photo moves the edge', async ({ page }, info) => {
  test.skip(!info.project.use.hasTouch, 'touch-only');
  await page.getByTestId('tool-edges').click();
  const before = await cellBoxes(page);
  const c = before[2]!; // bottom-left
  const from = { x: c.x + c.width * 0.5, y: c.y + c.height * 0.4 };
  await touchDrag(page, from, { x: from.x, y: from.y - 30 });
  await expect.poll(async () => (await cellBoxes(page))[2]!.height).toBeGreaterThan(c.height + 20);
  const after = await cellBoxes(page);
  expect(after[3]).toEqual(before[3]);
  // Back to the crop tool: dragging moves the photo inside again.
  await page.getByTestId('tool-crop').click();
  const crop0 = (await getDoc(page)).photos[2].crop.x;
  const cc = (await cellBoxes(page))[2]!;
  await touchDrag(page, { x: cc.x + cc.width / 2, y: cc.y + cc.height / 2 }, { x: cc.x + cc.width / 2 + 30, y: cc.y + cc.height / 2 });
  await expect.poll(async () => (await getDoc(page)).photos[2].crop.x).not.toBe(crop0);
});
