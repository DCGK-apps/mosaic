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

test('at the crossing the direction of the drag picks the edge', async ({ page }) => {
  const h = await horizontal(page);
  const v = await box(dividers(page, 'V').first());
  const cross = { x: v.x + v.width / 2, y: h.y + h.height / 2 };
  const before = await getDoc(page);
  await mouseDrag(page, cross, { x: cross.x, y: cross.y + 40 });
  const down = await getDoc(page);
  // The whole horizontal edge moved (the crossing is not cut).
  expect(down.tree.frac).toBeGreaterThan(before.tree.frac);
  expect(down.tree.dir).toBe('H');
  const h2 = await horizontal(page);
  const cross2 = { x: cross.x, y: h2.y + h2.height / 2 };
  await mouseDrag(page, cross2, { x: cross2.x + 40, y: cross2.y });
  const side = await getDoc(page);
  expect(side.tree.frac).toBe(down.tree.frac);
  expect(Math.max(side.tree.a.frac, side.tree.b.frac)).toBeGreaterThan(0.5);
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
