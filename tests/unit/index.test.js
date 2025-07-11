const request = require('supertest');
const app = require('../../src/index.js');

describe('Tests', () => {
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

    test('should validate positive amounts and reject invalid ones', async () => {
        const valid = await request(app).get('/convert?from=EUR&to=USD&amount=100');
        expect(valid.status).toBe(200);
        expect(valid.body.originalAmount).toBe(100);

        const invalid = await request(app).get('/convert?from=EUR&to=USD&amount=-100');
        expect(invalid.status).toBe(400);
        expect(invalid.body.error).toBe('Montant invalide');
    });

    test('should convert EUR to USD with correct rate (1.1)', async () => {
        const res = await request(app).get('/convert?from=EUR&to=USD&amount=100');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            from: 'EUR',
            to: 'USD',
            originalAmount: 100,
            convertedAmount: 110
        });
    });

    test('should convert USD to GBP with correct rate (0.8)', async () => {
        const res = await request(app).get('/convert?from=USD&to=GBP&amount=100');

        expect(res.status).toBe(200);
        expect(res.body.convertedAmount).toBe(80);
    });

    test('should reject unsupported currency conversions', async () => {
        const res = await request(app).get('/convert?from=EUR&to=JPY&amount=100');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Conversion non supportée');
    });

    test('should calculate TTC with 20% VAT', async () => {
        const res = await request(app).get('/tva?ht=100&taux=20');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            ht: 100,
            taux: 20,
            ttc: 120
        });
    });

    test('should reject invalid VAT rates', async () => {
        const res = await request(app).get('/tva?ht=100&taux=-5');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Taux de TVA invalide');
    });

    test('should calculate 10% discount correctly', async () => {
        const res = await request(app).get('/remise?prix=100&pourcentage=10');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            prixInitial: 100,
            pourcentage: 10,
            prixFinal: 90
        });
    });

    test('should reject invalid discount percentages', async () => {
        const res = await request(app).get('/remise?prix=100&pourcentage=150');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Pourcentage invalide (0-100)');
    });

    test('should reject missing parameters', async () => {
        const convert = await request(app).get('/convert?from=EUR&to=USD');
        expect(convert.status).toBe(400);
        expect(convert.body.error).toBe('Paramètres manquants: from, to, amount');

        const tva = await request(app).get('/tva?ht=100');
        expect(tva.status).toBe(400);
        expect(tva.body.error).toBe('Paramètres manquants: ht, taux');

        const remise = await request(app).get('/remise?prix=100');
        expect(remise.status).toBe(400);
        expect(remise.body.error).toBe('Paramètres manquants: prix, pourcentage');
    });

    test('should maintain proper financial precision with rounding', async () => {
        const convert = await request(app).get('/convert?from=EUR&to=USD&amount=99.99');
        expect(convert.body.convertedAmount).toBe(109.99);

        const tva = await request(app).get('/tva?ht=99.99&taux=20');
        expect(tva.body.ttc).toBe(119.99);

        const remise = await request(app).get('/remise?prix=99.99&pourcentage=10');
        expect(remise.body.prixFinal).toBe(89.99);
    });

    // Tests supplémentaires pour 100% de couverture
    test('should return API information on root endpoint', async () => {
        const res = await request(app).get('/');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('name', 'API de conversion');
    });

    test('should handle invalid amount formats', async () => {
        const res = await request(app).get('/convert?from=EUR&to=USD&amount=abc');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Montant invalide');
    });

    test('should handle case insensitive currencies', async () => {
        const res = await request(app).get('/convert?from=eur&to=usd&amount=100');
        expect(res.status).toBe(200);
        expect(res.body.from).toBe('EUR');
        expect(res.body.to).toBe('USD');
    });

    test('should handle invalid VAT amount', async () => {
        const res = await request(app).get('/tva?ht=abc&taux=20');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Montant invalide');
    });

    test('should handle invalid discount amount', async () => {
        const res = await request(app).get('/remise?prix=abc&pourcentage=10');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Montant invalide');
    });

    test('should handle invalid VAT rate format', async () => {
        const res = await request(app).get('/tva?ht=100&taux=abc');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Taux de TVA invalide');
    });

    test('should handle zero amounts', async () => {
        const convert = await request(app).get('/convert?from=EUR&to=USD&amount=0');
        expect(convert.status).toBe(200);
        expect(convert.body.convertedAmount).toBe(0);

        const tva = await request(app).get('/tva?ht=0&taux=20');
        expect(tva.status).toBe(200);
        expect(tva.body.ttc).toBe(0);

        const remise = await request(app).get('/remise?prix=0&pourcentage=10');
        expect(remise.status).toBe(200);
        expect(remise.body.prixFinal).toBe(0);
    });
});