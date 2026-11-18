const { chromium } = require('./frontend/node_modules/@playwright/test');

async function launchInteractiveChromeWithDevTools() {
  console.log('>>> Launching Chrome with DevTools (Inspect Element) auto-opened...');
  
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    devtools: true, // This automatically opens the DevTools / Inspect panel!
    args: [
      '--start-maximized',
      '--auto-open-devtools-for-tabs'
    ]
  });

  const context = await browser.newContext({
    viewport: null
  });
  
  const page = await context.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  console.log('>>> [SUCCESS] Chrome is now wide open with DevTools Inspection panel!');
  console.log('>>> Target URL: http://localhost:5173/');
  
  // Keep alive so browser never closes
  await new Promise(() => {});
}

launchInteractiveChromeWithDevTools().catch(console.error);
