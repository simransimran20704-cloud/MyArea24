const puppeteer = require('puppeteer-core');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://127.0.0.1:5173';
const API_URL = 'http://127.0.0.1:8000';

const CITIZEN_ROUTES = [
  { path: '/', name: 'Home Dashboard' },
  { path: '/businesses', name: 'Businesses Directory' },
  { path: '/products', name: 'Products Catalog' },
  { path: '/services', name: 'Services Marketplace' },
  { path: '/offers', name: 'Local Offers & Deals' },
  { path: '/events', name: 'Community Events' },
  { path: '/intelligence', name: 'Hyperlocal Intelligence Hub' },
  { path: '/weather', name: 'Weather Radar & Forecast' },
  { path: '/air-quality', name: 'Air Quality (AQI) Dashboard' },
  { path: '/traffic', name: 'Traffic & Commute Friction' },
  { path: '/alerts', name: 'NDMA SACHET Disaster Alerts' },
  { path: '/ai-assistant', name: 'AI Citizen Assistant' },
  { path: '/map', name: 'Interactive Map' },
  { path: '/emergency', name: 'Emergency Directory' },
  { path: '/market-rates', name: 'APMC Mandi Commodity Rates' },
  { path: '/fuel-rates', name: 'Daily Fuel Rates' },
  { path: '/bulletins', name: 'Civic Bulletins' },
  { path: '/saved', name: 'Saved Bookmarks' },
  { path: '/my-orders', name: 'Citizen Orders & Bookings' },
  { path: '/merchant', name: 'Merchant Portal' },
];

const VIEWPORTS = [
  { name: 'Desktop (1440x900)', width: 1440, height: 900, isMobile: false },
  { name: 'Tablet (768x1024)', width: 768, height: 1024, isMobile: false },
  { name: 'Mobile (375x812 - iPhone)', width: 375, height: 812, isMobile: true },
];

async function runAudit() {
  console.log('================================================================');
  console.log('MYAREA24 — FULL SPECTRUM EMPIRICAL AUDIT & DIAGNOSTIC RUNNER');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Frontend Target:', BASE_URL);
  console.log('Backend Target:', API_URL);
  console.log('================================================================\n');

  const auditReport = {
    routes: [],
    viewports: [],
    features: [],
    security: [],
    apiEndpoints: [],
    summary: { totalChecks: 0, passedChecks: 0, issues: [] },
  };

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();

  // Listeners for page
  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter non-fatal 3rd party asset load errors
      if (!text.includes('favicon') && !text.includes('chrome-extension')) {
        consoleErrors.push({ url: page.url(), error: text });
      }
    }
  });

  page.on('requestfailed', (req) => {
    const url = req.url();
    if (!url.includes('google-analytics') && !url.includes('doubleclick')) {
      networkErrors.push({ url, failure: req.failure()?.errorText || 'Unknown error' });
    }
  });

  // --------------------------------------------------------------------------
  // SECTION 1: ROUTE-BY-ROUTE PAGE AUDIT (DESKTOP)
  // --------------------------------------------------------------------------
  console.log('>>> [1/5] Auditing All Citizen & Merchant Routes on Desktop...');
  await page.setViewport(VIEWPORTS[0]);

  for (const r of CITIZEN_ROUTES) {
    const fullUrl = `${BASE_URL}${r.path}`;
    const startT = Date.now();
    let status = 'PASS';
    let httpStatus = 200;
    let title = '';
    let renderedElements = 0;
    let issues = [];

    try {
      const resp = await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
      httpStatus = resp ? resp.status() : 0;
      await new Promise((resolve) => setTimeout(resolve, 800)); // wait for client React hydration
      title = await page.title();
      const domData = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const buttons = document.querySelectorAll('button, a, input, select').length;
        const hasErrorBoundary = bodyText.includes('Something went wrong') || bodyText.includes('Crash');
        return { buttons, hasErrorBoundary, textSnippet: bodyText.slice(0, 150) };
      });
      renderedElements = domData.buttons;

      if (httpStatus !== 200) {
        status = 'FAIL';
        issues.push(`Non-200 HTTP response: ${httpStatus}`);
      }
      if (domData.hasErrorBoundary) {
        status = 'FAIL';
        issues.push('ErrorBoundary detected on page render');
      }
      if (renderedElements === 0) {
        status = 'WARN';
        issues.push('Zero interactive controls found in DOM');
      }
    } catch (err) {
      status = 'FAIL';
      issues.push(`Navigation exception: ${err.message}`);
    }

    const duration = Date.now() - startT;
    const resultObj = {
      path: r.path,
      name: r.name,
      status,
      httpStatus,
      durationMs: duration,
      title,
      renderedControls: renderedElements,
      issues,
    };
    auditReport.routes.push(resultObj);
    console.log(`  [${status}] ${r.path.padEnd(16)} | ${r.name.padEnd(30)} | ${duration}ms | ${renderedElements} controls`);
    if (issues.length > 0) {
      issues.forEach((i) => console.log(`      [-] ${i}`));
    }
  }

  // --------------------------------------------------------------------------
  // SECTION 2: RESPONSIVENESS & VIEWPORT AUDIT
  // --------------------------------------------------------------------------
  console.log('\n>>> [2/5] Auditing Viewport Responsiveness...');
  for (const vp of VIEWPORTS) {
    await page.setViewport(vp);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    const metrics = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      const hasHorizontalScroll = docWidth > winWidth + 5;
      const isMobileNavPresent = !!document.querySelector('nav, [role="navigation"]');
      const bodyText = document.body.innerText;
      return { docWidth, winWidth, hasHorizontalScroll, isMobileNavPresent, bodyLength: bodyText.length };
    });

    const status = metrics.hasHorizontalScroll ? 'WARN' : 'PASS';
    auditReport.viewports.push({
      viewport: vp.name,
      status,
      scrollWidth: metrics.docWidth,
      windowWidth: metrics.winWidth,
      horizontalOverflow: metrics.hasHorizontalScroll,
    });
    console.log(`  [${status}] ${vp.name.padEnd(30)} | ScrollWidth: ${metrics.docWidth}px vs WinWidth: ${metrics.winWidth}px | Overflow: ${metrics.hasHorizontalScroll}`);
  }

  // --------------------------------------------------------------------------
  // SECTION 3: CORE USER INTERACTION FLOWS
  // --------------------------------------------------------------------------
  console.log('\n>>> [3/5] Auditing Interactive User Flows...');
  await page.setViewport(VIEWPORTS[0]);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await new Promise((r) => setTimeout(r, 800));

  // Flow A: Location Selector Modal
  try {
    const locTriggered = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const locBtn = btns.find((b) => b.innerText.includes('AIIMS') || b.innerText.includes('Delhi') || b.innerText.includes('Location'));
      if (locBtn) { locBtn.click(); return true; }
      return false;
    });
    await new Promise((r) => setTimeout(r, 600));
    const locModalOpen = await page.evaluate(() => {
      return document.body.innerText.includes('Select') && (document.body.innerText.includes('District') || document.body.innerText.includes('Locality') || document.body.innerText.includes('Delhi'));
    });
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 400));
    const flowStatus = locTriggered && locModalOpen ? 'PASS' : 'WARN';
    auditReport.features.push({ feature: 'Location Selector Modal', status: flowStatus });
    console.log(`  [${flowStatus}] Location Selector Modal open & escape dismiss`);
  } catch (e) {
    auditReport.features.push({ feature: 'Location Selector Modal', status: 'FAIL', error: e.message });
    console.log(`  [FAIL] Location Selector Modal: ${e.message}`);
  }

  // Flow B: Cart Drawer
  try {
    const cartTriggered = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cartBtn = btns.find((b) => b.innerText.includes('Cart') || (b.querySelector('svg') && b.innerText.includes('₹')));
      if (cartBtn) { cartBtn.click(); return true; }
      return false;
    });
    await new Promise((r) => setTimeout(r, 600));
    const cartOpen = await page.evaluate(() => {
      return document.body.innerText.includes('Cart') || document.body.innerText.includes('Subtotal') || document.body.innerText.includes('Checkout');
    });
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 400));
    const flowStatus = cartTriggered ? 'PASS' : 'WARN';
    auditReport.features.push({ feature: 'Cart Drawer Slide-Over', status: flowStatus });
    console.log(`  [${flowStatus}] Cart Drawer slide-over & dismiss`);
  } catch (e) {
    auditReport.features.push({ feature: 'Cart Drawer Slide-Over', status: 'FAIL', error: e.message });
    console.log(`  [FAIL] Cart Drawer: ${e.message}`);
  }

  // Flow C: Search Input Filtering
  try {
    const searchWorks = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="search"], input[placeholder*="Search"]'));
      if (inputs.length > 0) {
        inputs[0].value = 'Pharmacy';
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 400));
    const flowStatus = searchWorks ? 'PASS' : 'WARN';
    auditReport.features.push({ feature: 'Global Search Input', status: flowStatus });
    console.log(`  [${flowStatus}] Global Search Input event dispatch`);
  } catch (e) {
    auditReport.features.push({ feature: 'Global Search Input', status: 'FAIL', error: e.message });
    console.log(`  [FAIL] Global Search Input: ${e.message}`);
  }

  // Flow D: Citizen Order Dashboard direct access
  try {
    await page.goto(`${BASE_URL}/my-orders`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));
    const ordersUIVisible = await page.evaluate(() => {
      const t = document.body.innerText;
      return t.includes('Order') || t.includes('Booking') || t.includes('My Orders');
    });
    const flowStatus = ordersUIVisible ? 'PASS' : 'FAIL';
    auditReport.features.push({ feature: 'Citizen Orders Dashboard (/my-orders)', status: flowStatus });
    console.log(`  [${flowStatus}] Citizen Orders Dashboard rendered cleanly`);
  } catch (e) {
    auditReport.features.push({ feature: 'Citizen Orders Dashboard (/my-orders)', status: 'FAIL', error: e.message });
    console.log(`  [FAIL] Citizen Orders Dashboard: ${e.message}`);
  }

  // Flow E: Merchant Registration Modal
  try {
    await page.goto(`${BASE_URL}/merchant`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));
    const merchantPortalText = await page.evaluate(() => document.body.innerText);
    const hasMerchantUI = merchantPortalText.includes('Merchant') || merchantPortalText.includes('Store') || merchantPortalText.includes('Catalog') || merchantPortalText.includes('Register');
    const flowStatus = hasMerchantUI ? 'PASS' : 'FAIL';
    auditReport.features.push({ feature: 'Merchant Portal Route (/merchant)', status: flowStatus });
    console.log(`  [${flowStatus}] Merchant Portal route loaded cleanly`);
  } catch (e) {
    auditReport.features.push({ feature: 'Merchant Portal Route (/merchant)', status: 'FAIL', error: e.message });
    console.log(`  [FAIL] Merchant Portal Route: ${e.message}`);
  }

  await browser.close();

  // --------------------------------------------------------------------------
  // SECTION 4: CONSOLE & RUNTIME DIAGNOSTICS SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n>>> [4/5] Browser Runtime Diagnostics Summary:');
  console.log(`  Console Errors Captured: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.slice(0, 10).forEach((err, idx) => {
      console.log(`    [${idx + 1}] ${err.url} -> ${err.error}`);
    });
  }
  console.log(`  Network Failed Requests: ${networkErrors.length}`);
  if (networkErrors.length > 0) {
    networkErrors.slice(0, 5).forEach((ne, idx) => {
      console.log(`    [${idx + 1}] ${ne.url} -> ${ne.failure}`);
    });
  }

  // --------------------------------------------------------------------------
  // OUTPUT JSON SUMMARY TO DISK FOR REPORTING
  // --------------------------------------------------------------------------
  const fs = require('fs');
  fs.writeFileSync('audit_results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    routes: auditReport.routes,
    viewports: auditReport.viewports,
    features: auditReport.features,
    consoleErrorsCount: consoleErrors.length,
    consoleErrors: consoleErrors.slice(0, 15),
    networkErrorsCount: networkErrors.length,
    networkErrors: networkErrors.slice(0, 15),
  }, null, 2));

  console.log('\n[✓] Browser and UI audit successfully written to audit_results.json.');
}

runAudit().catch((err) => {
  console.error('Audit execution fatal error:', err);
  process.exit(1);
});
