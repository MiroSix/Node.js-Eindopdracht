const mongoose = require('mongoose');

// Schema voor een bepaald event tijdens een match 
const eventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['kill', 'objective', 'round_win', 'penalty', 'custom'],
      required: true,
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    description: {
      type: String,
      maxlength: [200, 'Event description cannot exceed 200 characters'],
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const eventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['kill', 'objective', 'round_win', 'penalty', 'custom'],
      required: true,
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    description: {
      type: String,
      maxlength: [200, 'Event description cannot exceed 200 characters'],
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// Schema voor een match tussen twee teams in een toernooi
const matchSchema = new mongoose.Schema(
  {
    // Referentie naar het toernooi waartoe deze match behoort
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
    },
    round: {
      type: Number,
      required: true,
      min: [1, 'Round must be at least 1'],
    },
    roundName: {
      type: String,
      default: '',
    },

    // Referenties naar de teams die spelen
    teamA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    teamB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },

    // Scores van beide teams, kunnen worden bijgewerkt tijdens de match
    scores: {
      teamAScore: { type: Number, default: 0, min: 0 },
      teamBScore: { type: Number, default: 0, min: 0 },
    },

    // Soort van log van belangrijke gebeurtenissen tijdens de match, zoals kills, objectives, etc.
    events: [eventSchema],

    status: {
      type: String,
      enum: ['scheduled', 'ongoing', 'completed', 'forfeit'],
      default: 'scheduled',
    },
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },
  },
  { timestamps: true }
);

// Zorgt ervoor dat een team niet tegen zichzelf kan spelen
matchSchema.pre('save', function (next) {
  if (this.teamA.equals(this.teamB)) {
    return next(new Error('A team cannot play against itself'));
  }
  next();
});

const Match = mongoose.model('Match', matchSchema);
module.exports = Match;
