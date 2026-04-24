const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
  console.log('Page loaded');
  
  try {
    // Click 'Register to Vote' button
    await page.click('button:has-text("Register to Vote")');
    console.log('Clicked Register');
    await page.waitForTimeout(1000);
    
    // Check if view changed
    const isRegisterVisible = await page.isVisible('#view-register');
    const isChatVisible = await page.isVisible('#view-chat');
    console.log('Register visible:', isRegisterVisible);
    console.log('Chat visible:', isChatVisible);
  } catch (err) {
    console.error('Test error:', err);
  }

  await browser.close();
})();
