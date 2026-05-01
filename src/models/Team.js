const mongoose = require('mongoose');


// Schema voor een teamlid binnen een team
const memberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['captain', 'member'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);


// Schema voor een bepaald team, veel validaties.
const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Team name must be at least 2 characters'],
      maxlength: [50, 'Team name cannot exceed 50 characters'],
    },
    tag: {
      type: String,
      required: [true, 'Team tag is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [2, 'Tag must be at least 2 characters'],
      maxlength: [5, 'Tag cannot exceed 5 characters'],
      match: [/^[A-Z0-9]+$/, 'Tag can only contain letters and numbers'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },

    // Referentie naar de captain van het team
    captain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    members: [memberSchema],

    // Gewoon wat statistieken bijhouden voor het team, kunnen worden bijgewerkt na elke match
    stats: {
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      tournamentsPlayed: { type: Number, default: 0 },
      matchesPlayed: { type: Number, default: 0 },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Een virtual om makelijk het aantal leden in een team te krijgen
teamSchema.virtual('memberCount').get(function () {
  return this.members.length;
});

teamSchema.set('toJSON', { virtuals: true });

const Team = mongoose.model('Team', teamSchema);
module.exports = Team;
