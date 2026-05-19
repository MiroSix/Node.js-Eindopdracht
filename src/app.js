const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const AppError = require('./errors/AppError');

// Alle routes importeren
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const teamRoutes = require('./routes/teams');
const tournamentRoutes = require('./routes/tournaments');
const matchRoutes = require('./routes/matches');

const app = express();

// Voegt security headers toe aan alle responses
app.use(helmet());

// Logging middleware, alleen in development
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use(express.json({ limit: '10kb' })); // Veiligheidsmaatregel tegen grote payloads
app.use(express.urlencoded({ extended: false }));

// Routes registreren
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/matches', matchRoutes);


app.get('/', (req, res) => {
  res.send('API is running');
});

app.use((req, res, next) => {
  next(new AppError(`Cannot ${req.method} ${req.originalUrl}`, 404));
});

// Globale error handler 
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const status = statusCode >= 500 ? 'error' : 'fail';

  // Mongoose validatiefouten netjes terugmelden
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ status: 'fail', message: messages });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({ status: 'fail', message: `This ${field} is already taken.` });
  }

  res.status(statusCode).json({ status, message: err.message || 'Something went wrong' });
});

module.exports = app;