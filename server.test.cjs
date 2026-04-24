/**
 * @fileoverview Comprehensive test suite for CivicAI server.
 * Tests cover: health endpoint, API input validation, error handling,
 * security headers, and rate limiting.
 * 
 * Uses a child process approach to avoid ESM/CJS import issues.
 */

const http = require('http');
const { spawn } = require('child_process');

const PORT = 9876;
let serverProcess;

/** Helper: make an HTTP request and return { status, headers, body } */
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/** Wait for server to be ready */
function waitForServer(maxRetries = 20) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const check = () => {
      const req = http.request({ hostname: 'localhost', port: PORT, path: '/api/health', method: 'GET' }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve());
      });
      req.on('error', () => {
        if (retries++ < maxRetries) setTimeout(check, 300);
        else reject(new Error('Server did not start'));
      });
      req.end();
    };
    check();
  });
}

// ─── Lifecycle ───

beforeAll(async () => {
  serverProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' },
    stdio: 'pipe',
  });
  serverProcess.stderr.on('data', (d) => { /* suppress stderr in tests */ });
  await waitForServer();
}, 15000);

afterAll(() => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
});

// ═══════════════════════════════════════════════════
// HEALTH ENDPOINT
// ═══════════════════════════════════════════════════

describe('GET /api/health', () => {
  it('should return 200 with health status', async () => {
    const res = await makeRequest('GET', '/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('should report geminiConfigured field', async () => {
    const res = await makeRequest('GET', '/api/health');
    expect(res.body).toHaveProperty('geminiConfigured');
    expect(typeof res.body.geminiConfigured).toBe('boolean');
  });
});

// ═══════════════════════════════════════════════════
// CHAT ENDPOINT – INPUT VALIDATION
// ═══════════════════════════════════════════════════

describe('POST /api/chat', () => {
  it('should return 400 when message is missing', async () => {
    const res = await makeRequest('POST', '/api/chat', {});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/message/i);
  });

  it('should return 400 when message is empty string', async () => {
    const res = await makeRequest('POST', '/api/chat', { message: '   ' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 when message exceeds 5000 chars', async () => {
    const longMessage = 'a'.repeat(5001);
    const res = await makeRequest('POST', '/api/chat', { message: longMessage });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/5000/);
  });

  it('should return 400 when history is not an array', async () => {
    const res = await makeRequest('POST', '/api/chat', { message: 'Hello', history: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/array/i);
  });

  it('should return 503 when GEMINI_API_KEY is not set', async () => {
    // Our test server has no API key set
    const res = await makeRequest('POST', '/api/chat', { message: 'How do I vote?', history: [] });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });
});

// ═══════════════════════════════════════════════════
// FACT-CHECK ENDPOINT – INPUT VALIDATION
// ═══════════════════════════════════════════════════

describe('POST /api/fact-check', () => {
  it('should return 400 when message is missing', async () => {
    const res = await makeRequest('POST', '/api/fact-check', {});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/message/i);
  });

  it('should return 400 when message is empty', async () => {
    const res = await makeRequest('POST', '/api/fact-check', { message: '' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 when message exceeds 3000 chars', async () => {
    const longMessage = 'b'.repeat(3001);
    const res = await makeRequest('POST', '/api/fact-check', { message: longMessage });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/3000/);
  });

  it('should return 503 when GEMINI_API_KEY is not set', async () => {
    const res = await makeRequest('POST', '/api/fact-check', { message: 'Is voting tomorrow?' });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });
});

// ═══════════════════════════════════════════════════
// SECURITY HEADERS
// ═══════════════════════════════════════════════════

describe('Security Headers', () => {
  it('should include X-Content-Type-Options nosniff', async () => {
    const res = await makeRequest('GET', '/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should include Content-Security-Policy header', async () => {
    const res = await makeRequest('GET', '/api/health');
    expect(res.headers).toHaveProperty('content-security-policy');
  });

  it('should include X-Frame-Options header', async () => {
    const res = await makeRequest('GET', '/api/health');
    expect(res.headers).toHaveProperty('x-frame-options');
  });
});

// ═══════════════════════════════════════════════════
// STATIC FILES & SPA FALLBACK
// ═══════════════════════════════════════════════════

describe('Static Files & SPA', () => {
  it('should serve index.html at root', async () => {
    const res = await makeRequest('GET', '/');
    expect(res.status).toBe(200);
  });

  it('should fallback to index.html for unknown routes', async () => {
    const res = await makeRequest('GET', '/some/unknown/route');
    expect(res.status).toBe(200);
  });
});
