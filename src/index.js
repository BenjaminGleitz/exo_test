const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const exchangeRates = {
    EUR: { USD: 1.1 },
    USD: { GBP: 0.8, EUR: 1/1.1 },
    GBP: { USD: 1/0.8, EUR: 1/(1.1*0.8) }
};

function validateAmount(amount) {
    const num = parseFloat(amount);
    if (isNaN(num) || num < 0) {
        throw new Error('Montant invalide');
    }
    return num;
}

app.get('/', (req, res) => {
    res.json({
        name: 'API de conversion'
    });
});

app.get('/convert', (req, res) => {
    try {
        const { from, to, amount } = req.query;

        if (!from || !to || !amount) {
            return res.status(400).json({
                error: 'Paramètres manquants: from, to, amount'
            });
        }

        const originalAmount = validateAmount(amount);
        const fromCurrency = from.toUpperCase();
        const toCurrency = to.toUpperCase();

        if (!exchangeRates[fromCurrency] || !exchangeRates[fromCurrency][toCurrency]) {
            return res.status(400).json({
                error: 'Conversion non supportée'
            });
        }

        const rate = exchangeRates[fromCurrency][toCurrency];
        const convertedAmount = Math.round(originalAmount * rate * 100) / 100;

        res.json({
            from: fromCurrency,
            to: toCurrency,
            originalAmount: originalAmount,
            convertedAmount: convertedAmount
        });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/tva', (req, res) => {
    try {
        const { ht, taux } = req.query;

        if (!ht || !taux) {
            return res.status(400).json({
                error: 'Paramètres manquants: ht, taux'
            });
        }

        const htAmount = validateAmount(ht);
        const tauxTva = parseFloat(taux);

        if (isNaN(tauxTva) || tauxTva < 0) {
            return res.status(400).json({
                error: 'Taux de TVA invalide'
            });
        }

        const ttc = Math.round(htAmount * (1 + tauxTva / 100) * 100) / 100;

        res.json({
            ht: htAmount,
            taux: tauxTva,
            ttc: ttc
        });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/remise', (req, res) => {
    try {
        const { prix, pourcentage } = req.query;

        if (!prix || !pourcentage) {
            return res.status(400).json({
                error: 'Paramètres manquants: prix, pourcentage'
            });
        }

        const prixInitial = validateAmount(prix);
        const pourcentageRemise = parseFloat(pourcentage);

        if (isNaN(pourcentageRemise) || pourcentageRemise < 0 || pourcentageRemise > 100) {
            return res.status(400).json({
                error: 'Pourcentage invalide (0-100)'
            });
        }

        const prixFinal = Math.round(prixInitial * (1 - pourcentageRemise / 100) * 100) / 100;

        res.json({
            prixInitial: prixInitial,
            pourcentage: pourcentageRemise,
            prixFinal: prixFinal
        });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;