const mongoose = require('mongoose');

// Model voor 1 bepaalde match in het bracket
const bracketMatchSchema = new mongoose.Schema(
  {
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
    },
    teamA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    teamB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'ongoing', 'completed'],
      default: 'pending',
    },
  },
  { _id: true }
);

const roundSchema = new mongoose.Schema(
  {
    roundNumber: { type: Number, required: true },
    name: { type: String, required: true }, // bv. "Quarter Final", "Semi Final", "Final"
    matches: [bracketMatchSchema],
  },
  { _id: false }
);

const tournamentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tournament name is required'],
      trim: true,
      minlength: [3, 'Name must be at least 3 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    game: {
      type: String,
      required: [true, 'Game name is required'],
      trim: true,
      maxlength: [50, 'Game name cannot exceed 50 characters'],
    },
    format: {
      type: String,
      enum: {
        values: ['single_elimination', 'double_elimination', 'round_robin'],
        message: 'Format must be single_elimination, double_elimination, or round_robin',
      },
      default: 'single_elimination',
    },
    status: {
      type: String,
      enum: ['registration', 'ongoing', 'completed', 'cancelled'],
      default: 'registration',
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    registeredTeams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
      },
    ],
    settings: {
      maxTeams: {
        type: Number,
        required: [true, 'Maximum number of teams is required'],
        min: [2, 'Tournament must allow at least 2 teams'],
        max: [64, 'Tournament cannot exceed 64 teams'],
      },
      prizePool: {
        type: String,
        default: 'No prize',
        maxlength: [100, 'Prize pool description cannot exceed 100 characters'],
      },
      startDate: {
        type: Date,
        required: [true, 'Start date is required'],
      },
      description: {
        type: String,
        maxlength: [1000, 'Description cannot exceed 1000 characters'],
        default: '',
      },
    },
    
    rounds: [roundSchema],

    champion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
  },
  { timestamps: true }
);

const Tournament = mongoose.model('Tournament', tournamentSchema);
module.exports = Tournament;
