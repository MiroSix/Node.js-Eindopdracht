const express = require('express');

// Alle routes importeren
const authRoutes = require('./routes/auth');
//const userRoutes = require('./routes/users');
//const teamRoutes = require('./routes/teams');
//const tournamentRoutes = require('./routes/tournaments');
const matchRoutes = require('./routes/matches');

const app = express();

app.use(express.json());

app.use(express.json({ limit: '10kb' })); // Veiligheidsmaatregel tegen grote payloads
app.use(express.urlencoded({ extended: false }));

// Routes registreren
app.use('/api/auth', authRoutes);
//app.use('/api/users', userRoutes);
//app.use('/api/teams', teamRoutes);
//app.use('/api/tournaments', tournamentRoutes);
app.use('/api/matches', matchRoutes);



app.get('/', (req, res) => {
  res.send('API is running');
});

module.exports = app;