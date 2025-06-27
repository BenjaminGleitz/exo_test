const request = require('supertest');
const app = require('../../src/index.js');

describe('Tests d\'Intégration - API avec services externes', () => {
    beforeAll(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe('Simulation de services externes', () => {
        test('should simulate external API success', async () => {
            const mockExternalService = {
                getRates: jest.fn().mockResolvedValue({
                    EUR: { USD: 1.12 },
                    USD: { GBP: 0.82, EUR: 1/1.12 }
                })
            };

            const rates = await mockExternalService.getRates();
            expect(mockExternalService.getRates).toHaveBeenCalled();
            expect(rates.EUR.USD).toBe(1.12);
        });

        test('should simulate external API failure and fallback', async () => {
            const mockExternalService = {
                getRates: jest.fn().mockRejectedValue(new Error('Service unavailable')),
                getFallbackRates: jest.fn().mockReturnValue({
                    EUR: { USD: 1.1 },
                    USD: { GBP: 0.8, EUR: 1/1.1 }
                })
            };

            let rates;
            try {
                rates = await mockExternalService.getRates();
            } catch (error) {
                rates = mockExternalService.getFallbackRates();
            }

            expect(mockExternalService.getRates).toHaveBeenCalled();
            expect(mockExternalService.getFallbackRates).toHaveBeenCalled();
            expect(rates.EUR.USD).toBe(1.1);
        });
    });

    describe('Scénarios d\'intégration complets', () => {
        test('should handle conversion + TVA + remise sequence', async () => {
            const convert = await request(app)
                .get('/convert?from=EUR&to=USD&amount=100');
            expect(convert.status).toBe(200);
            expect(convert.body.convertedAmount).toBe(110);

            const tva = await request(app)
                .get(`/tva?ht=${convert.body.convertedAmount}&taux=20`);
            expect(tva.status).toBe(200);
            expect(tva.body.ttc).toBe(132);

            const remise = await request(app)
                .get(`/remise?prix=${tva.body.ttc}&pourcentage=10`);
            expect(remise.status).toBe(200);
            expect(remise.body.prixFinal).toBe(118.8);
        });

        test('should handle multiple currency conversions chain', async () => {
            const eurToUsd = await request(app)
                .get('/convert?from=EUR&to=USD&amount=100');
            expect(eurToUsd.body.convertedAmount).toBe(110);

            const usdToGbp = await request(app)
                .get(`/convert?from=USD&to=GBP&amount=${eurToUsd.body.convertedAmount}`);
            expect(usdToGbp.body.convertedAmount).toBe(88);

            const gbpToUsd = await request(app)
                .get(`/convert?from=GBP&to=USD&amount=${usdToGbp.body.convertedAmount}`);
            expect(gbpToUsd.body.convertedAmount).toBe(110);
        });

        test('should handle concurrent API calls', async () => {
            const promises = [
                request(app).get('/convert?from=EUR&to=USD&amount=100'),
                request(app).get('/convert?from=USD&to=GBP&amount=100'),
                request(app).get('/tva?ht=100&taux=20'),
                request(app).get('/remise?prix=100&pourcentage=10')
            ];

            const results = await Promise.all(promises);

            results.forEach(res => {
                expect(res.status).toBe(200);
            });

            expect(results[0].body.convertedAmount).toBe(110);
            expect(results[1].body.convertedAmount).toBe(80);
            expect(results[2].body.ttc).toBe(120);
            expect(results[3].body.prixFinal).toBe(90);
        });

        test('should maintain data consistency across operations', async () => {
            const amount = 100;

            const eurToUsd = await request(app)
                .get(`/convert?from=EUR&to=USD&amount=${amount}`);

            const usdToEur = await request(app)
                .get(`/convert?from=USD&to=EUR&amount=${eurToUsd.body.convertedAmount}`);

            expect(usdToEur.body.convertedAmount).toBeCloseTo(amount, 2);
        });
    });

    describe('Tests de performance et charge', () => {
        test('should handle multiple requests efficiently', async () => {
            const numberOfRequests = 10;
            const promises = [];

            for (let i = 0; i < numberOfRequests; i++) {
                promises.push(
                    request(app).get('/convert?from=EUR&to=USD&amount=100')
                );
            }

            const startTime = Date.now();
            const results = await Promise.all(promises);
            const endTime = Date.now();

            results.forEach(res => {
                expect(res.status).toBe(200);
                expect(res.body.convertedAmount).toBe(110);
            });

            expect(endTime - startTime).toBeLessThan(1000);
        });

        test('should handle edge cases in integration', async () => {
            const small = await request(app)
                .get('/convert?from=EUR&to=USD&amount=0.01');
            expect(small.status).toBe(200);
            expect(small.body.convertedAmount).toBe(0.01);

            const large = await request(app)
                .get('/convert?from=EUR&to=USD&amount=1000000');
            expect(large.status).toBe(200);
            expect(large.body.convertedAmount).toBe(1100000);

            const decimal = await request(app)
                .get('/convert?from=EUR&to=USD&amount=123.456');
            expect(decimal.status).toBe(200);
            expect(decimal.body.convertedAmount).toBe(135.8);
        });
    });

    describe('Gestion d\'erreurs en chaîne', () => {
        test('should stop execution on first error in sequence', async () => {
            const convert = await request(app)
                .get('/convert?from=EUR&to=USD&amount=100');
            expect(convert.status).toBe(200);

            const tva = await request(app)
                .get(`/tva?ht=${convert.body.convertedAmount}&taux=-5`);
            expect(tva.status).toBe(400);
            expect(tva.body.error).toBe('Taux de TVA invalide');
        });

        test('should handle error recovery in business logic', async () => {
            let finalAmount = 100;

            const invalidConvert = await request(app)
                .get('/convert?from=EUR&to=JPY&amount=100');

            if (invalidConvert.status !== 200) {
                const validConvert = await request(app)
                    .get('/convert?from=EUR&to=USD&amount=100');
                finalAmount = validConvert.body.convertedAmount;
            }

            expect(finalAmount).toBe(110);
        });
    });

    describe('Simulation de services métier', () => {
        test('should simulate database operations', async () => {
            const mockDB = {
                saveTransaction: jest.fn().mockResolvedValue({
                    id: 1,
                    timestamp: new Date(),
                    status: 'saved'
                }),
                getTransactionHistory: jest.fn().mockResolvedValue([
                    { id: 1, amount: 110, type: 'conversion' },
                    { id: 2, amount: 132, type: 'tva' }
                ])
            };

            const saved = await mockDB.saveTransaction({
                from: 'EUR',
                to: 'USD',
                amount: 110
            });
            expect(mockDB.saveTransaction).toHaveBeenCalled();
            expect(saved.status).toBe('saved');

            const history = await mockDB.getTransactionHistory();
            expect(mockDB.getTransactionHistory).toHaveBeenCalled();
            expect(history).toHaveLength(2);
        });

        test('should simulate audit logging', async () => {
            const mockAudit = {
                logOperation: jest.fn(),
                logError: jest.fn()
            };

            const res = await request(app)
                .get('/convert?from=EUR&to=USD&amount=100');

            if (res.status === 200) {
                mockAudit.logOperation('CONVERSION_SUCCESS', {
                    from: res.body.from,
                    to: res.body.to,
                    amount: res.body.originalAmount,
                    result: res.body.convertedAmount
                });
            }

            expect(mockAudit.logOperation).toHaveBeenCalledWith('CONVERSION_SUCCESS', {
                from: 'EUR',
                to: 'USD',
                amount: 100,
                result: 110
            });
        });

        test('should simulate notification service', async () => {
            const mockNotification = {
                sendAlert: jest.fn().mockResolvedValue({ sent: true }),
                sendEmail: jest.fn().mockResolvedValue({ emailId: 'email_123' })
            };

            const largeAmount = await request(app)
                .get('/convert?from=EUR&to=USD&amount=10000');

            if (largeAmount.body.convertedAmount > 10000) {
                await mockNotification.sendAlert({
                    type: 'HIGH_AMOUNT_CONVERSION',
                    amount: largeAmount.body.convertedAmount
                });
            }

            expect(mockNotification.sendAlert).toHaveBeenCalledWith({
                type: 'HIGH_AMOUNT_CONVERSION',
                amount: 11000
            });
        });
    });
});