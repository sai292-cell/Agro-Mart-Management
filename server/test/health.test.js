import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import http from 'node:http';

describe('Health and Readiness Endpoints', () => {
  let server;
  let baseUrl;

  // Spin up an isolated in-memory HTTP server instance for testing
  it('should start test server on dynamic port', async () => {
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
        resolve();
      });
    });
    assert.ok(baseUrl);
  });

  it('GET /health (Liveness) should always return 200 with service metadata', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'operational');
    assert.equal(body.data.service, 'Shivshree Agro Mart OS API');
    assert.ok(body.data.database);
    assert.equal(typeof body.data.database.connected, 'boolean');

    // Security check: Must never leak credentials or passwords
    const stringified = JSON.stringify(body);
    assert.equal(stringified.includes('mongodb+srv://'), false);
    assert.equal(stringified.includes('password'), false);
  });

  it('GET /health/ready (Readiness) should return 200 or 503 depending on database connection', async () => {
    const res = await fetch(`${baseUrl}/health/ready`);
    // Status must be either 200 (if Atlas is connected) or 503 (if DB is disconnected)
    assert.ok([200, 503].includes(res.status), `Readiness returned unexpected status code: ${res.status}`);

    const body = await res.json();
    if (res.status === 200) {
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'ready');
      assert.equal(body.data.database.connected, true);
    } else {
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'DATABASE_UNAVAILABLE');
      assert.equal(body.error.database.connected, false);
    }

    // Security check: Never leak secrets
    const stringified = JSON.stringify(body);
    assert.equal(stringified.includes('mongodb+srv://'), false);
    assert.equal(stringified.includes('password'), false);
  });

  it('should close test server cleanly', async () => {
    await new Promise((resolve) => server.close(resolve));
  });
});
