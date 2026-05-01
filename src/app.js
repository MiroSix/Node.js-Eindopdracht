const express = require('express');

// Alle routes importeren
const matchRoutes = require('./routes/matches');

const app = express();

app.use(express.json());

app.use(express.json({ limit: '10kb' })); // Veiligheidsmaatregel tegen grote payloads
app.use(express.urlencoded({ extended: false }));

// Routes registreren
app.use('/api/matches', matchRoutes);



app.get('/', (req, res) => {
  res.send('API is running');
});

module.exports = app;