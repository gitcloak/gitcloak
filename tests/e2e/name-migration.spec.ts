import {
  test,
  expect,
  gotoApp,
  selectRepo,
  clickFileByName,
  expectEditor,
  submitPassword,
  fetchMockState,
} from './helpers'

const REPO = 'mockuser/legacy-notes'
const PASSWORD = 'legacy-password'

test.describe('Encrypting old file names', () => {
  test('unlocking renames plain names, keeps the content and upgrades .gitcloak', async ({
    page,
    request,
  }) => {
    const before = (await fetchMockState(request))[REPO]
    expect(before['welcome.md.age']).toBeDefined()
    expect(before['.gitcloak']).not.toContain('nameKey')

    await gotoApp(page)
    await selectRepo(page, REPO)

    // Locked: the old names are still what GitHub has.
    await expect(
      page.locator('[data-testid="file-node"][data-name="welcome.md.age"]')
    ).toBeVisible()

    await page.getByTestId('repo-lock-toggle').click()
    await submitPassword(page, 'unlock', PASSWORD)

    await expect(page.getByTestId('notice')).toContainText('is now unlocked')
    await expect(page.getByTestId('notice')).toContainText('Encrypted 2 file names')

    // GitHub no longer has the plain names; the same bytes are under new ones.
    const after = (await fetchMockState(request))[REPO]
    expect(after['welcome.md.age']).toBeUndefined()
    expect(after['ideas.md.age']).toBeUndefined()
    const encrypted = Object.keys(after).filter((path) => path.endsWith('.age'))
    expect(encrypted).toHaveLength(2)
    expect(encrypted.every((path) => !path.includes('welcome') && !path.includes('ideas'))).toBe(
      true
    )
    expect(Object.values(after).sort()).toEqual(
      expect.arrayContaining([before['welcome.md.age'], before['ideas.md.age']])
    )
    expect(after['.gitcloak']).toContain('"nameKey"')
    expect(after['.gitcloak']).toContain('"version": "1.1"')

    // The tree shows the plain names, and the file opens with its content.
    await clickFileByName(page, 'welcome.md')
    await expectEditor(page, 'welcome.md', /Written before encrypted file names/)
    await expect(
      page.locator('[data-testid="file-node"][data-name="ideas.md"]')
    ).toBeVisible()
  })

  test('a second unlock finds nothing left to rename', async ({ page, request }) => {
    await gotoApp(page)
    await selectRepo(page, REPO)

    await page.getByTestId('repo-lock-toggle').click()
    await submitPassword(page, 'unlock', PASSWORD)
    await expect(page.getByTestId('notice')).toContainText('Encrypted 2 file names')
    const once = await fetchMockState(request)

    await page.getByTestId('repo-lock-toggle').click()
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'locked'
    )
    await page.getByTestId('repo-lock-toggle').click()
    await submitPassword(page, 'unlock', PASSWORD)
    await expect(page.getByTestId('notice')).toContainText('is now unlocked')
    await expect(page.getByTestId('notice')).not.toContainText('Encrypted')

    expect(await fetchMockState(request)).toEqual(once)
  })
})
