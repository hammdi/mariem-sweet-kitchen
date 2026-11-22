/**
 * Un seul service en ligne : le serveur API sert aussi l'interface (SPA).
 * Pas de base de données nécessaire.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';

describe('interface servie par le serveur (SERVE_FRONTEND)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-dist-'));
  let app: any;

  beforeAll(() => {
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><div id="root"></div>');
    fs.writeFileSync(path.join(dir, 'assets', 'index-abc.js'), 'console.log(1)');
    process.env.SERVE_FRONTEND = '1';
    process.env.SERVE_FRONTEND_DIR = dir;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-de-plus-de-32-caracteres-ok';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      app = require('../app').default;
    });
  });

  afterAll(() => {
    delete process.env.SERVE_FRONTEND;
    delete process.env.SERVE_FRONTEND_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('pages du site (accueil, catalogue, admin) → la page de l’application', async () => {
    for (const url of ['/', '/recipes/123', '/admin/packaging', '/auth/login']) {
      const res = await request(app).get(url);
      expect([url, res.status, res.text.includes('id="root"')]).toEqual([url, 200, true]);
      expect(res.headers['cache-control']).toBe('no-cache');
    }
  });

  it('fichiers versionnés : cache long ; API toujours prioritaire', async () => {
    const js = await request(app).get('/assets/index-abc.js');
    expect(js.status).toBe(200);
    expect(js.headers['cache-control']).toContain('immutable');
    const api = await request(app).get('/api/health');
    expect(api.body.success).toBe(true);
    expect((await request(app).get('/api/inconnue')).status).toBe(404);
  });

  it('politique de contenu : carte OpenStreetMap et polices autorisées, rien d’autre', async () => {
    const csp = (await request(app).get('/')).headers['content-security-policy'];
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain('https://*.tile.openstreetmap.org');
    expect(csp).toContain('https://nominatim.openstreetmap.org');
    expect(csp).toContain('https://fonts.gstatic.com');
  });
});
