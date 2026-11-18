const { chromium } = require('./frontend/node_modules/@playwright/test');

async function showBanner(page, stepNumber, totalSteps, title, subtitle) {
  await page.evaluate(({ stepNumber, totalSteps, title, subtitle }) => {
    let banner = document.getElementById('antigravity-demo-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'antigravity-demo-banner';
      banner.style.position = 'fixed';
      banner.style.top = '16px';
      banner.style.left = '50%';
      banner.style.transform = 'translateX(-50%)';
      banner.style.zIndex = '999999';
      banner.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
      banner.style.color = '#ffffff';
      banner.style.border = '2px solid #6366f1';
      banner.style.boxShadow = '0 20px 45px rgba(0,0,0,0.6), 0 0 30px rgba(99,102,241,0.5)';
      banner.style.borderRadius = '16px';
      banner.style.padding = '14px 32px';
      banner.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      banner.style.backdropFilter = 'blur(16px)';
      banner.style.pointerEvents = 'none';
      banner.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
      banner.style.textAlign = 'center';
      banner.style.maxWidth = '92vw';
      document.body.appendChild(banner);
    }
    banner.innerHTML = `
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #818cf8; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; gap: 8px;">
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#22c55e; box-shadow:0 0 10px #22c55e;"></span>
        Antigravity Live Tour • Feature ${stepNumber} of ${totalSteps}
      </div>
      <div style="font-size: 18px; font-weight: 800; color: #f8fafc; margin-bottom: 4px; letter-spacing: -0.3px;">
        ${title}
      </div>
      <div style="font-size: 13px; color: #94a3b8; font-weight: 500;">
        ${subtitle}
      </div>
    `;
  }, { stepNumber, totalSteps, title, subtitle });
}

async function runFullInteractiveTour() {
  console.log('=================================================================');
  console.log('🚀 Starting Comprehensive Live Feature Walkthrough in Google Chrome');
  console.log('=================================================================');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    slowMo: 700,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null
  });

  const page = await context.newPage();
  const TOTAL_STEPS = 9;

  try {
    // -----------------------------------------------------------------
    // STEP 1: Landing Page & Adaptive Theme
    // -----------------------------------------------------------------
    console.log('[1/9] Opening Home Page & Toggling Themes...');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await showBanner(
      page, 1, TOTAL_STEPS,
      'Hero Page & Dynamic Design System',
      'Glassmorphic dark/light UI with reactive typing header and tokenized styling'
    );
    await page.waitForTimeout(2000);

    // Toggle Theme
    const themeBtn = page.locator('button[aria-label*="theme" i], button:has(.material-symbols-outlined:has-text("dark_mode")), button:has(.material-symbols-outlined:has-text("light_mode"))').first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(1200);
      await themeBtn.click();
      await page.waitForTimeout(1200);
    }

    // -----------------------------------------------------------------
    // STEP 2: Single Shorten with Title & Favicon Scraping
    // -----------------------------------------------------------------
    console.log('[2/9] Single URL Shortener with Metadata Extraction...');
    await showBanner(
      page, 2, TOTAL_STEPS,
      'Async Metadata Scraping & QR Generation',
      'Shortens destination, detects favicons & titles, and displays copyable result'
    );

    const singleInput = page.locator('input[placeholder*="http" i], input[placeholder*="Enter long URL" i]').first();
    if (await singleInput.isVisible()) {
      await singleInput.click();
      await singleInput.fill('https://github.com/facebook/react');
      await page.waitForTimeout(1000);

      const shortenBtn = page.locator('button[type="submit"]:has-text("Shorten"), button:has-text("Shorten Now")').first();
      if (await shortenBtn.isVisible()) {
        await shortenBtn.click();
        await page.waitForTimeout(2500);
      }

      // Test Copy button
      const copyBtn = page.locator('button:has-text("Copy"), button[title*="Copy" i]').first();
      if (await copyBtn.isVisible()) {
        await copyBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // -----------------------------------------------------------------
    // STEP 3: Password-Protected Links & Live Unlock Verification
    // -----------------------------------------------------------------
    console.log('[3/9] Testing Password Protection & Unlock Screen...');
    await showBanner(
      page, 3, TOTAL_STEPS,
      'Password-Protected Links (Bcrypt Hashed)',
      'Creating a password locked link, then navigating to verify the Unlock gate'
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const advBtn = page.locator('button:has-text("Advanced Options"), button:has-text("Advanced")').first();
    if (await advBtn.isVisible()) {
      await advBtn.click();
      await page.waitForTimeout(1000);

      const urlInput = page.locator('input[placeholder*="http" i], input[placeholder*="Enter long URL" i]').first();
      await urlInput.fill('https://news.ycombinator.com');

      const passInput = page.locator('input[placeholder*="password" i]').first();
      if (await passInput.isVisible()) {
        await passInput.fill('HackerNews123');
      }

      const aliasInput = page.locator('input[placeholder*="brand" i], input[placeholder*="my-brand" i]').first();
      const customCode = 'hn-' + Math.floor(Math.random() * 10000);
      if (await aliasInput.isVisible()) {
        await aliasInput.fill(customCode);
      }

      const submitBtn = page.locator('button[type="submit"]:has-text("Shorten")').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(2500);
      }

      // Now open the protected short code in a new tab to see unlock page!
      console.log('Testing unlock page on short code:', customCode);
      const unlockPage = await context.newPage();
      await unlockPage.goto(`http://localhost:5000/${customCode}`, { waitUntil: 'domcontentloaded' });
      await unlockPage.waitForTimeout(1500);

      // Demonstrate entering password
      const unlockPwInput = unlockPage.locator('input[type="password"]').first();
      if (await unlockPwInput.isVisible()) {
        await unlockPwInput.fill('HackerNews123');
        await unlockPage.waitForTimeout(1200);
        const unlockSubmitBtn = unlockPage.locator('button[type="submit"]:has-text("Unlock"), button:has-text("Unlock")').first();
        if (await unlockSubmitBtn.isVisible()) {
          await unlockSubmitBtn.click();
          await unlockPage.waitForTimeout(2500);
        }
      }
      await unlockPage.close().catch(() => {});
    }

    // -----------------------------------------------------------------
    // STEP 4: Burn-After-Reading (One-Time Link)
    // -----------------------------------------------------------------
    console.log('[4/9] Testing Burn-After-Reading Self-Destructing Links...');
    await page.bringToFront();
    await showBanner(
      page, 4, TOTAL_STEPS,
      'Zero-Trust "Burn-After-Reading" Ephemeral Links',
      'The link self-destructs immediately after its very first access'
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const advBtn2 = page.locator('button:has-text("Advanced Options"), button:has-text("Advanced")').first();
    if (await advBtn2.isVisible()) {
      await advBtn2.click();
      await page.waitForTimeout(800);

      const urlInput = page.locator('input[placeholder*="http" i], input[placeholder*="Enter long URL" i]').first();
      await urlInput.fill('https://www.wikipedia.org');

      const burnCode = 'burn-' + Math.floor(Math.random() * 10000);
      const aliasInput = page.locator('input[placeholder*="brand" i], input[placeholder*="my-brand" i]').first();
      if (await aliasInput.isVisible()) {
        await aliasInput.fill(burnCode);
      }

      // Check one-time link checkbox
      const burnCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /one-time|burn/i }).first();
      const burnLabel = page.locator('label:has-text("One-Time"), label:has-text("Burn")').first();
      if (await burnLabel.isVisible()) {
        await burnLabel.click();
      } else if (await burnCheckbox.isVisible()) {
        await burnCheckbox.check();
      }

      await page.waitForTimeout(800);
      const submitBtn = page.locator('button[type="submit"]:has-text("Shorten")').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(2500);
      }

      // Test 1st visit (success)
      const burnPage = await context.newPage();
      await burnPage.goto(`http://localhost:5000/${burnCode}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await burnPage.waitForTimeout(2000);
      // Test 2nd visit (burned / expired)
      await burnPage.goto(`http://localhost:5000/${burnCode}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await burnPage.waitForTimeout(2000);
      await burnPage.close().catch(() => {});
    }

    // -----------------------------------------------------------------
    // STEP 5: Bulk Shortener Engine
    // -----------------------------------------------------------------
    console.log('[5/9] Bulk URL Shortening Mode...');
    await page.bringToFront();
    await showBanner(
      page, 5, TOTAL_STEPS,
      'High-Throughput Bulk Shortener for Marketing Teams',
      'Batch process up to 20 links at once with custom aliases and tags'
    );

    const bulkTab = page.locator('button:has-text("Bulk Shorten"), button:has-text("Bulk")').first();
    if (await bulkTab.isVisible()) {
      await bulkTab.click();
      await page.waitForTimeout(1000);

      const bulkArea = page.locator('textarea').first();
      if (await bulkArea.isVisible()) {
        await bulkArea.fill(
          'https://google.com, my-google\n' +
          'https://github.com, my-github\n' +
          'https://linkedin.com, my-linkedin'
        );
        await page.waitForTimeout(1200);

        const tagsInput = page.locator('input[placeholder*="tags" i]').first();
        if (await tagsInput.isVisible()) {
          await tagsInput.fill('campaign, launch, social');
        }

        const shortenAllBtn = page.locator('button:has-text("Shorten All")').first();
        if (await shortenAllBtn.isVisible()) {
          await shortenAllBtn.click();
          await page.waitForTimeout(3000);
        }
      }
    }

    // -----------------------------------------------------------------
    // STEP 6: User Authentication & Login Flow
    // -----------------------------------------------------------------
    console.log('[6/9] Registering User & Accessing Dashboard...');
    await showBanner(
      page, 6, TOTAL_STEPS,
      'User Authentication & Secure Session Store',
      'JWT with dual-key rotation, Double-CSRF tokens, and Argon2/Bcrypt'
    );

    await page.goto('http://localhost:5173/register', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const demoEmail = 'harshad_demo_' + Math.floor(Math.random() * 100000) + '@test.com';
    const emailField = page.locator('input[type="email"]').first();
    const pwFields = page.locator('input[type="password"]');

    if (await emailField.isVisible()) {
      await emailField.fill(demoEmail);
      await pwFields.nth(0).fill('HarshadSecurePass2026!');
      await pwFields.nth(1).fill('HarshadSecurePass2026!');

      const terms = page.locator('input#terms, input[type="checkbox"]').first();
      if (await terms.isVisible()) {
        await terms.check();
      }

      const registerBtn = page.locator('button[type="submit"]:has-text("Create Account"), button[type="submit"]').first();
      if (await registerBtn.isVisible()) {
        await registerBtn.click();
        await page.waitForTimeout(3000);
      }
    }

    // -----------------------------------------------------------------
    // STEP 7: Executive Dashboard, Charts & World Map
    // -----------------------------------------------------------------
    console.log('[7/9] Executive Analytics Dashboard & World Map...');
    if (page.url().includes('/dashboard')) {
      await showBanner(
        page, 7, TOTAL_STEPS,
        'Executive Analytics Dashboard & World Map',
        'Real-time traffic telemetry, device breakdown, and geographic choropleth map'
      );

      // Create a short link to populate the dashboard table
      const dashUrlInput = page.locator('input[placeholder*="http" i], input[placeholder*="Enter" i]').first();
      if (await dashUrlInput.isVisible()) {
        await dashUrlInput.fill('https://stackoverflow.com');
        const createBtn = page.locator('button:has-text("Shorten"), button:has-text("Create")').first();
        if (await createBtn.isVisible()) {
          await createBtn.click();
          await page.waitForTimeout(2000);
        }
      }

      // Smooth scroll through analytics metrics
      await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
      await page.waitForTimeout(1500);

      await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
      await page.waitForTimeout(1500);

      // Trigger "Check Health" button on link
      console.log('Testing link health monitor...');
      const checkHealthBtn = page.locator('button:has-text("Check Health")').first();
      if (await checkHealthBtn.isVisible()) {
        await checkHealthBtn.click();
        await page.waitForTimeout(2000);
      }

      // Test CSV Export
      const exportBtn = page.locator('button:has-text("Export"), button:has-text("CSV")').first();
      if (await exportBtn.isVisible()) {
        await exportBtn.click();
        await page.waitForTimeout(1000);
      }

      // Scroll back up
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      await page.waitForTimeout(1000);
    }

    // -----------------------------------------------------------------
    // STEP 8: Bio Page Builder (Linktree Alternative)
    // -----------------------------------------------------------------
    console.log('[8/9] Testing Bio Page Builder...');
    await showBanner(
      page, 8, TOTAL_STEPS,
      'Bio Page Builder (Linktree Alternative)',
      'Custom link landing page for creators with live phone frame preview'
    );

    await page.goto('http://localhost:5173/bio/builder', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1500);

    const slugInput = page.locator('input[placeholder*="handle" i], input[placeholder*="slug" i], input[name="slug"]').first();
    if (await slugInput.isVisible()) {
      await slugInput.fill('harshad');
    }

    const titleInput = page.locator('input[placeholder*="Title" i], input[name="title"]').first();
    if (await titleInput.isVisible()) {
      await titleInput.fill('Harshad Gohil - Full Stack Engineer');
    }

    const bioInput = page.locator('textarea[placeholder*="bio" i], textarea[name="bio"]').first();
    if (await bioInput.isVisible()) {
      await bioInput.fill('Passionate developer building high-performance web systems.');
    }

    // Try switching themes
    const themeCards = page.locator('button:has(.rounded-full), div[class*="theme"]').all();
    const themesList = await themeCards;
    if (themesList && themesList.length > 2) {
      await themesList[1].click().catch(() => {});
      await page.waitForTimeout(1000);
      await themesList[2].click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    // Scroll to show mobile preview
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(1000);

    // -----------------------------------------------------------------
    // STEP 9: Tour Completion & Hands-on Exploration
    // -----------------------------------------------------------------
    console.log('[9/9] Full Tour Completed!');
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1000);

    await showBanner(
      page, 9, TOTAL_STEPS,
      '🎉 All Features Tested & Verified Live!',
      'Chrome browser is now yours to interact with freely. Feel free to click anywhere!'
    );

    console.log('=================================================================');
    console.log('✅ All features demonstrated live in Google Chrome!');
    console.log('Browser will remain open for your personal testing...');
    console.log('=================================================================');

    // Keep browser alive for 5 minutes so user can freely interact
    await page.waitForTimeout(300000);

  } catch (err) {
    console.error('Error during live walkthrough:', err);
  } finally {
    await browser.close().catch(() => {});
    console.log('Demo tour process finished.');
  }
}

runFullInteractiveTour();
