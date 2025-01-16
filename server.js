const express = require('express');
const loginRoutes = require('./routes/loginRoutes');
const vpnRoutes = require('./routes/vpnRoutes');

const app = express();
const port = process.env.PORT || 5000;


app.use(express.json());
app.use('/api', loginRoutes);
app.use('/vpn', vpnRoutes);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    });