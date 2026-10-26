import { Page } from '@playwright/test'
import {
  test,
  expect,
  gotoApp,
  clickFileNode,
  expectEditor,
  expectEditorValue,
  fillEditor,
  readEditorValue,
  submitPassword,
} from './helpers'

const FILE = 'welcome.md.age'
const PASSWORD = 'demo-password'

async function unlockRepo(page: Page): Promise<void> {
  await page.getByTestId('repo-lock-toggle').click()
  await submitPassword(page, 'unlock', PASSWORD)
  await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
    'data-repo-status',
    'unlocked'
  )
}

/** Opens the demo file in an unlocked repository, ready for typing. */
async function openFile(page: Page): Promise<void> {
  await gotoApp(page)
  await unlockRepo(page)
  await clickFileNode(page, FILE)
  await expectEditor(page, FILE)
}

test.describe('Live preview editor', () => {
  test('renders headings, emphasis and links while the cursor is elsewhere', async ({
    page,
  }) => {
    await openFile(page)
    const markdown =
      '# Live title\n\nSome **bold**, *em* and [docs](https://example.com).\n'
    await fillEditor(page, markdown)

    // The cursor sits on the empty last line, so no markup is revealed.
    await expect(page.locator('.cm-lp-h1')).toHaveText('Live title')
    await expect(page.locator('.cm-lp-strong')).toHaveText('bold')
    await expect(page.locator('.cm-lp-em')).toHaveText('em')
    await expect(page.locator('.cm-lp-link')).toHaveText('docs')
    await expect(page.locator('.cm-content')).not.toContainText('**')
    await expect(page.locator('.cm-content')).not.toContainText('https://example.com')

    // Rendering never changes the document itself.
    await expectEditorValue(page, markdown)
  })

  test('reveals the source of a span when the cursor enters it', async ({ page }) => {
    await openFile(page)
    await fillEditor(page, '# Live title\n\nSome **bold** text.\n')

    await page.locator('.cm-lp-strong').click()
    await expect(page.locator('.cm-line', { hasText: 'Some' })).toHaveText(
      'Some **bold** text.'
    )
    await expect(page.locator('.cm-lp-h1')).toHaveText('Live title')
    await expect(page.locator('.cm-content')).not.toContainText('# Live title')
  })

  test('renders each construct as it is typed, one keystroke at a time', async ({ page }) => {
    await openFile(page)
    await fillEditor(page, '')
    await page.locator('.cm-content').click()

    await page.keyboard.type('# Typed')
    // The heading line holds the cursor, so its marker is still shown.
    await expect(page.locator('.cm-lp-h1')).toHaveText('# Typed')

    await page.keyboard.press('Enter')
    await expect(page.locator('.cm-lp-h1')).toHaveText('Typed')

    await page.keyboard.type('Some **bo')
    // Unclosed emphasis is plain text.
    await expect(page.locator('.cm-lp-strong')).toHaveCount(0)

    await page.keyboard.type('ld**')
    await expect(page.locator('.cm-lp-strong')).toHaveText('**bold**')

    await page.keyboard.press('Enter')
    await expect(page.locator('.cm-lp-strong')).toHaveText('bold')
    await expectEditorValue(page, '# Typed\nSome **bold**\n')
  })

  test('draws bullets and block quotes without their markers', async ({ page }) => {
    await openFile(page)
    await fillEditor(page, '- one\n- two\n\n> quoted line\n\nend\n')

    await expect(page.locator('.cm-lp-bullet')).toHaveCount(2)
    await expect(page.locator('.cm-lp-quote')).toHaveText('quoted line')
    await expect(page.locator('.cm-content')).not.toContainText('> quoted')
    await expectEditorValue(page, '- one\n- two\n\n> quoted line\n\nend\n')
  })

  test('toggles task checkboxes by changing the source', async ({ page }) => {
    await openFile(page)
    await fillEditor(page, '- [ ] buy milk\n- [x] ship it\n\nend\n')

    const boxes = page.locator('.cm-lp-checkbox')
    await expect(boxes).toHaveCount(2)
    await expect(boxes.nth(0)).not.toBeChecked()
    await expect(boxes.nth(1)).toBeChecked()

    await boxes.nth(0).click()
    await expectEditorValue(page, '- [x] buy milk\n- [x] ship it\n\nend\n')

    await boxes.nth(1).click()
    await expectEditorValue(page, '- [x] buy milk\n- [ ] ship it\n\nend\n')
    await expect(boxes.nth(1)).not.toBeChecked()
  })

  test('continues a list when Enter is pressed on a list item', async ({ page }) => {
    await openFile(page)
    await fillEditor(page, '')
    await page.locator('.cm-content').click()

    await page.keyboard.type('- first')
    await page.keyboard.press('Enter')
    await page.keyboard.type('second')

    await expectEditorValue(page, '- first\n- second')
  })

  test('hides code fences until the cursor enters the block', async ({ page }) => {
    await openFile(page)
    await fillEditor(page, '```js\nconst x = 1\n```\n\nafter\n')

    await expect(page.locator('.cm-line.cm-lp-codeblock', { hasText: 'const x = 1' })).toHaveCount(1)
    await expect(page.locator('.cm-content')).not.toContainText('```')

    await page.locator('.cm-line.cm-lp-codeblock', { hasText: 'const x = 1' }).click()
    await expect(page.locator('.cm-content')).toContainText('```js')
    await expectEditorValue(page, '```js\nconst x = 1\n```\n\nafter\n')
  })

  test('never fetches remote images and shows their alt text instead', async ({ page }) => {
    const requested: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('example.invalid')) requested.push(request.url())
    })

    await openFile(page)
    await fillEditor(page, '![cat photo](https://example.invalid/cat.png)\n\nend\n')

    await expect(page.locator('.cm-lp-image')).toHaveText('cat photo')
    await expect(page.locator('.cm-content')).not.toContainText('example.invalid')
    expect(requested).toEqual([])
  })

  test('Mod-b wraps the selection in bold and toggles it back', async ({ page }) => {
    await openFile(page)
    await fillEditor(page, 'hello')
    await page.locator('.cm-content').click()
    await page.keyboard.press('ControlOrMeta+a')

    await page.keyboard.press('ControlOrMeta+b')
    await expectEditorValue(page, '**hello**')

    await page.keyboard.press('ControlOrMeta+b')
    await expectEditorValue(page, 'hello')
  })

  test('undo reverts the last edit', async ({ page }) => {
    await openFile(page)
    await fillEditor(page, 'first')
    // Edits typed in separate pauses are separate undo steps.
    await page.waitForTimeout(700)
    await fillEditor(page, 'second')
    await expectEditorValue(page, 'second')

    await page.locator('.cm-content').click()
    await page.keyboard.press('ControlOrMeta+z')
    await expectEditorValue(page, 'first')
  })

  test('switches a Markdown file between rendered and source views', async ({ page }) => {
    await openFile(page)
    const markdown = '# Live title\n\nSome **bold** text.\n'
    await fillEditor(page, markdown)
    await expect(page.locator('.cm-lp-h1')).toHaveText('Live title')

    // The toggle sits left of Save and starts in the rendered view.
    const toggle = page.getByTestId('view-mode-toggle')
    await expect(toggle).toHaveAttribute('data-mode', 'rendered')
    const toggleBox = await toggle.boundingBox()
    const saveBox = await page.getByTestId('save-button').boundingBox()
    expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual(saveBox!.x)

    await toggle.click()
    await expect(toggle).toHaveAttribute('data-mode', 'source')
    await expect(page.locator('.cm-lp-h1')).toHaveCount(0)
    await expect(page.locator('.cm-content')).toContainText('# Live title')
    await expect(page.locator('.cm-content')).toContainText('**bold**')
    await expect(page.locator('.cm-editor')).toHaveClass(/cm-lp-source/)
    await expectEditorValue(page, markdown)

    await toggle.click()
    await expect(toggle).toHaveAttribute('data-mode', 'rendered')
    await expect(page.locator('.cm-lp-h1')).toHaveText('Live title')
    await expect(page.locator('.cm-editor')).not.toHaveClass(/cm-lp-source/)
    await expectEditorValue(page, markdown)
  })

  test('keeps the cursor and undo history when switching views', async ({ page }) => {
    await openFile(page)
    await fillEditor(page, 'first')
    await page.waitForTimeout(700)
    await fillEditor(page, 'second')

    await page.getByTestId('view-mode-toggle').click()
    await page.locator('.cm-content').click()
    await page.keyboard.press('ControlOrMeta+z')
    await expectEditorValue(page, 'first')
  })

  test('shows non-Markdown files as source only, with no view toggle', async ({ page }) => {
    await openFile(page)
    await page.getByTestId('new-file-button').click()
    await page.getByTestId('new-file-input').fill('draft.txt')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('selected-file-path')).toHaveText('draft.txt')

    await expect(page.getByTestId('view-mode-toggle')).toHaveCount(0)
    await fillEditor(page, '# not a heading in a text file\n')
    await expect(page.locator('.cm-lp-h1')).toHaveCount(0)
    await expect(page.locator('.cm-content')).toContainText('# not a heading')
    await expectEditorValue(page, '# not a heading in a text file\n')
  })

  test('saves the raw Markdown exactly as typed', async ({ page }) => {
    const markdown = [
      '# Saved title',
      '',
      'Some **bold**, *em*, ~~gone~~ and `code`.',
      '',
      '- [ ] open task',
      '- [x] done task',
      '',
      '> a quote',
      '',
      '```ts',
      'const n: number = 1',
      '```',
      '',
    ].join('\n')

    await openFile(page)
    await fillEditor(page, markdown)
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId('editor-status')).toHaveAttribute('data-status', 'saved')

    // A fresh page load decrypts the stored file; it must be the same text.
    await page.reload()
    await gotoApp(page)
    await unlockRepo(page)
    await clickFileNode(page, FILE)
    await expectEditor(page, FILE)
    await expect.poll(() => readEditorValue(page)).toBe(markdown)
  })
})
