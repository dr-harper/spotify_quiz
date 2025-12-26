import { test } from '@playwright/test'
import path from 'path'

/**
 * Screenshot tests for demo pages
 * These tests capture screenshots for the README and documentation
 *
 * Run with: npx playwright test tests/screenshots.spec.ts
 * Screenshots are saved to: screenshots/
 */

const screenshotsDir = path.join(__dirname, '..', 'screenshots')

// Helper to remove Next.js error indicators before screenshot
async function removeNextJsIndicators(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    // Remove nextjs-portal elements (contains error toasts)
    document.querySelectorAll('nextjs-portal').forEach(el => el.remove())
  })
}

test.describe('Demo Page Screenshots', () => {
  test('Home Page - Desktop', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'Desktop Chrome') {
      test.skip()
      return
    }

    await page.goto('/demo/home')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    await removeNextJsIndicators(page)

    await page.screenshot({
      path: path.join(screenshotsDir, 'home-desktop.png'),
      fullPage: false,
    })
  })

  test('Home Page - Mobile', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'Mobile Safari') {
      test.skip()
      return
    }

    await page.goto('/demo/home')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    await removeNextJsIndicators(page)

    await page.screenshot({
      path: path.join(screenshotsDir, 'home-mobile.png'),
      fullPage: false,
    })
  })

  test('Lobby Page - Desktop', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'Desktop Chrome') {
      test.skip()
      return
    }

    await page.goto('/demo/lobby')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    await removeNextJsIndicators(page)

    await page.screenshot({
      path: path.join(screenshotsDir, 'lobby-desktop.png'),
      fullPage: false,
    })
  })

  test('Lobby Page - Mobile', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'Mobile Safari') {
      test.skip()
      return
    }

    await page.goto('/demo/lobby')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    await removeNextJsIndicators(page)

    await page.screenshot({
      path: path.join(screenshotsDir, 'lobby-mobile.png'),
      fullPage: false,
    })
  })

  test('Song Selection Page - Desktop', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'Desktop Chrome') {
      test.skip()
      return
    }

    await page.goto('/demo/submission')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    await removeNextJsIndicators(page)

    await page.screenshot({
      path: path.join(screenshotsDir, 'submission-desktop.png'),
      fullPage: false,
    })
  })

  test('Song Selection Page - Mobile', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'Mobile Safari') {
      test.skip()
      return
    }

    await page.goto('/demo/submission')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    await removeNextJsIndicators(page)

    await page.screenshot({
      path: path.join(screenshotsDir, 'submission-mobile.png'),
      fullPage: false,
    })
  })

  test('Quiz Intro Page - Desktop', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'Desktop Chrome') {
      test.skip()
      return
    }

    await page.goto('/demo/intro')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    await removeNextJsIndicators(page)
    // Hide demo controls for clean screenshot
    await page.evaluate(() => {
      document.querySelector('.fixed.top-4.left-4')?.remove()
    })

    await page.screenshot({
      path: path.join(screenshotsDir, 'intro-desktop.png'),
      fullPage: false,
    })
  })

  test('Quiz Intro Page - Mobile', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'Mobile Safari') {
      test.skip()
      return
    }

    await page.goto('/demo/intro')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    await removeNextJsIndicators(page)
    // Hide demo controls for clean screenshot
    await page.evaluate(() => {
      document.querySelector('.fixed.top-4.left-4')?.remove()
    })

    await page.screenshot({
      path: path.join(screenshotsDir, 'intro-mobile.png'),
      fullPage: false,
    })
  })

  test('Favourites Page - Desktop', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'Desktop Chrome') {
      test.skip()
      return
    }

    await page.goto('/demo/favourites')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    await removeNextJsIndicators(page)

    await page.screenshot({
      path: path.join(screenshotsDir, 'favourites-desktop.png'),
      fullPage: false,
    })
  })

  test('Favourites Page - Mobile', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'Mobile Safari') {
      test.skip()
      return
    }

    await page.goto('/demo/favourites')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    await removeNextJsIndicators(page)

    await page.screenshot({
      path: path.join(screenshotsDir, 'favourites-mobile.png'),
      fullPage: false,
    })
  })

  test('Processing Results - Loading State', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'Desktop Chrome') {
      test.skip()
      return
    }

    await page.goto('/demo/processing')
    await page.waitForLoadState('networkidle')
    // Click loading state button
    await page.click('button:has-text("Loading State")')
    await page.waitForTimeout(500)
    await removeNextJsIndicators(page)
    // Hide demo controls
    await page.evaluate(() => {
      document.querySelector('.fixed.top-4.right-4')?.remove()
    })

    await page.screenshot({
      path: path.join(screenshotsDir, 'processing-loading.png'),
      fullPage: false,
    })
  })

  test('Processing Results - Narrative Reveal', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'Desktop Chrome') {
      test.skip()
      return
    }

    await page.goto('/demo/processing')
    await page.waitForLoadState('networkidle')
    // Click narrative state button
    await page.click('button:has-text("Narrative State")')
    // Wait for all paragraphs to reveal (4 paragraphs * 4 seconds + buffer)
    await page.waitForTimeout(18000)
    await removeNextJsIndicators(page)
    // Hide demo controls
    await page.evaluate(() => {
      document.querySelector('.fixed.top-4.right-4')?.remove()
    })

    await page.screenshot({
      path: path.join(screenshotsDir, 'processing-narrative.png'),
      fullPage: false,
    })
  })

  test('Processing Results - Mobile', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'Mobile Safari') {
      test.skip()
      return
    }

    await page.goto('/demo/processing')
    await page.waitForLoadState('networkidle')
    // Wait for paragraphs to reveal
    await page.waitForTimeout(18000)
    await removeNextJsIndicators(page)
    // Hide demo controls
    await page.evaluate(() => {
      document.querySelector('.fixed.top-4.right-4')?.remove()
    })

    await page.screenshot({
      path: path.join(screenshotsDir, 'processing-mobile.png'),
      fullPage: false,
    })
  })
})
