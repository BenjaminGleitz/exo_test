const request = require('supertest');

describe('Server Tests', () => {
    let server;
    let app;

    beforeAll(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        app = require('../../src/index.js');
    });

    afterAll((done) => {
        jest.restoreAllMocks();
        if (server && server.listening) {
            server.close(done);
        } else {
            done();
        }
    });

    test('should start server on specified port', (done) => {
        const PORT = 3001;

        server = app.listen(PORT, () => {
            expect(server.listening).toBe(true);
            expect(server.address().port).toBe(PORT);
            done();
        });
    });

    test('should respond to health check', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('API de conversion');
    });
});