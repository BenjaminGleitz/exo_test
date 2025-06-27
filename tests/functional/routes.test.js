const request = require('supertest');
const app = require('../../src/index.js');

describe('Tests Fonctionnels - Routes API', () => {
    beforeAll(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterAll((done) => {
        jest.restoreAllMocks();
        if (app && typeof app.close === 'function') {
            app.close(done);
        } else {
            done();
        }
    });

    describe('GET /', () => {
        test('should return API information', async () => {
            const res = await request(app).get('/');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('name', 'API de conversion');
        });
    });

    describe('GET /convert', () => {
        test('should return 200 and correct conversion EUR to USD', async () => {
            const res = await request(app)
                .get('/convert?from=EUR&to=USD&amount=100');

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/json/);
            expect(res.body).toEqual({
                from: 'EUR',
                to: 'USD',
                originalAmount: 100,
                convertedAmount: 110
            });
        });

        test('should return 200 and correct conversion USD to GBP', async () => {
            const res = await request(app)
                .get('/convert?from=USD&to=GBP&amount=100');

            expect(res.status).toBe(200);
            expect(res.body.convertedAmount).toBe(80);
        });

        test('should return 400 for missing parameters', async () => {
            const res = await request(app)
                .get('/convert?from=EUR&to=USD');

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Paramètres manquants: from, to, amount');
        });

        test('should return 400 for invalid amount', async () => {
            const res = await request(app)
                .get('/convert?from=EUR&to=USD&amount=-100');

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Montant invalide');
        });

        test('should return 400 for unsupported conversion', async () => {
            const res = await request(app)
                .get('/convert?from=EUR&to=JPY&amount=100');

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Conversion non supportée');
        });

        test('should handle case insensitive currencies', async () => {
            const res = await request(app)
                .get('/convert?from=eur&to=usd&amount=100');

            expect(res.status).toBe(200);
            expect(res.body.from).toBe('EUR');
            expect(res.body.to).toBe('USD');
        });
    });

    describe('GET /tva', () => {
        test('should return 200 and correct TTC calculation', async () => {
            const res = await request(app)
                .get('/tva?ht=100&taux=20');

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/json/);
            expect(res.body).toEqual({
                ht: 100,
                taux: 20,
                ttc: 120
            });
        });

        test('should return 200 for 0% VAT', async () => {
            const res = await request(app)
                .get('/tva?ht=100&taux=0');

            expect(res.status).toBe(200);
            expect(res.body.ttc).toBe(100);
        });

        test('should return 400 for missing parameters', async () => {
            const res = await request(app)
                .get('/tva?ht=100');

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Paramètres manquants: ht, taux');
        });

        test('should return 400 for invalid VAT rate', async () => {
            const res = await request(app)
                .get('/tva?ht=100&taux=-5');

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Taux de TVA invalide');
        });

        test('should return 400 for non-numeric VAT rate', async () => {
            const res = await request(app)
                .get('/tva?ht=100&taux=abc');

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Taux de TVA invalide');
        });
    });

    describe('GET /remise', () => {
        test('should return 200 and correct discount calculation', async () => {
            const res = await request(app)
                .get('/remise?prix=100&pourcentage=10');

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/json/);
            expect(res.body).toEqual({
                prixInitial: 100,
                pourcentage: 10,
                prixFinal: 90
            });
        });

        test('should return 200 for 0% discount', async () => {
            const res = await request(app)
                .get('/remise?prix=100&pourcentage=0');

            expect(res.status).toBe(200);
            expect(res.body.prixFinal).toBe(100);
        });

        test('should return 200 for 100% discount', async () => {
            const res = await request(app)
                .get('/remise?prix=100&pourcentage=100');

            expect(res.status).toBe(200);
            expect(res.body.prixFinal).toBe(0);
        });

        test('should return 400 for missing parameters', async () => {
            const res = await request(app)
                .get('/remise?prix=100');

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Paramètres manquants: prix, pourcentage');
        });

        test('should return 400 for invalid percentage', async () => {
            const res = await request(app)
                .get('/remise?prix=100&pourcentage=150');

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Pourcentage invalide (0-100)');
        });

        test('should return 400 for negative percentage', async () => {
            const res = await request(app)
                .get('/remise?prix=100&pourcentage=-10');

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Pourcentage invalide (0-100)');
        });
    });

    describe('HTTP Headers and Response Format', () => {
        test('should return correct content-type for all endpoints', async () => {
            const endpoints = [
                '/convert?from=EUR&to=USD&amount=100',
                '/tva?ht=100&taux=20',
                '/remise?prix=100&pourcentage=10'
            ];

            for (const endpoint of endpoints) {
                const res = await request(app).get(endpoint);
                expect(res.headers['content-type']).toMatch(/json/);
            }
        });

        test('should handle decimal precision correctly', async () => {
            const res1 = await request(app).get('/convert?from=EUR&to=USD&amount=99.99');
            expect(res1.body.convertedAmount).toBe(109.99);

const res2 = await request(app).get('/tva?ht=99.99&taux=20');
expect(res2.body.ttc).toBe(119.99);

const res3 = await request(app).get('/remise?prix=99.99&pourcentage=10');
expect(res3.body.prixFinal).toBe(89.99);
});
});
});