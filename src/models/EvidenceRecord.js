const mongoose = require('mongoose');

const evidenceRecordSchema = new mongoose.Schema(
  {
    criterionId: {
      type: String,
      required: true,
      trim: true,
    },
    objective: {
      type: String,
      required: true,
      trim: true,
    },
    activity: {
      type: String,
      required: true,
      trim: true,
    },
    kpiValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    documentUrl: {
      type: String,
      trim: true,
    },
    outcome: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['submitted', 'verified', 'approved', 'rejected'],
      default: 'submitted',
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EvidenceRecord', evidenceRecordSchema);
