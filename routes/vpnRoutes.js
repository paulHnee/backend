const express = require('express');
const router = express.Router();

router.get('/vpn', (req, res) => {
    res.send('Hello VPN!');
});

router.get('/public_key', (req, res) => {
    res.send(`Hello VPN pubkey!`);
});

router.get('/list', (req, res) => {
    res.send(`A List!`);
});

module.exports = router;