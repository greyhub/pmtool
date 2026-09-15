import { test, expect } from '@playwright/test';
import { makeUser, makeOrg, makeProject, registerUser, createOrganization, createProject } from './helpers';

/** Drags a dnd-kit sortable card by dispatching real pointer events with intermediate steps, since PointerSensor requires a few pixels of movement before it starts a drag. */
async function dragCardToColumn(page: import('@playwright/test').Page, cardText: string, targetColumnTitle: string) {
  const card = page.getByText(cardText).locator('xpath=ancestor::div[contains(@class,"cursor-grab")]').first();
  const targetColumn = page.getByText(targetColumnTitle, { exact: true }).locator('xpath=ancestor::div[3]');

  const cardBox = await card.boundingBox();
  const targetBox = await targetColumn.boundingBox();
  if (!cardBox || !targetBox) throw new Error('Could not measure drag source/target');

  const startX = cardBox.x + cardBox.width / 2;
  const startY = cardBox.y + cardBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + Math.min(targetBox.height / 2, 200);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 10, startY + 5, { steps: 5 });
  await page.mouse.move(endX, endY, { steps: 15 });
  await page.mouse.move(endX, endY, { steps: 2 });
  await page.mouse.up();
}

test('dragging a task card to another column persists after reload', async ({ page }) => {
  const user = makeUser('kanban');
  await registerUser(page, user);
  const org = makeOrg('kanban');
  await createOrganization(page, org);
  const project = makeProject('KB');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tiêu đề').fill('Kéo thả thử nghiệm');
  await dialog.getByRole('button', { name: 'Tạo công việc' }).click();
  await expect(page.getByText('Kéo thả thử nghiệm')).toBeVisible();

  await page.goto(`/vi/${org.slug}/projects/${project.key}/board`);
  await expect(page.getByText('Đang thực hiện', { exact: true })).toBeVisible();
  await expect(page.getByText('Kéo thả thử nghiệm')).toBeVisible();

  await dragCardToColumn(page, 'Kéo thả thử nghiệm', 'Đang thực hiện');

  // Optimistic update should move it immediately client-side...
  const inProgressColumn = page.getByText('Đang thực hiện', { exact: true }).locator('xpath=ancestor::div[3]');
  await expect(inProgressColumn.getByText('Kéo thả thử nghiệm')).toBeVisible({ timeout: 5000 });

  // ...and the move should have actually persisted server-side.
  await page.reload();
  await expect(page.getByText('Đang thực hiện', { exact: true })).toBeVisible();
  const inProgressColumnAfterReload = page.getByText('Đang thực hiện', { exact: true }).locator('xpath=ancestor::div[3]');
  await expect(inProgressColumnAfterReload.getByText('Kéo thả thử nghiệm')).toBeVisible({ timeout: 10_000 });
});
