import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('response', response => console.log('RESPONSE:', response.status(), response.url()));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.failure().errorText, request.url()));

  try {
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle0' });
    console.log('Page loaded successfully');
  } catch (err) {
    console.error('Navigation error:', err);
  }

  await browser.close();
})();
