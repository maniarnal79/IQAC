const EvidenceRecord = require('../models/EvidenceRecord');

const createEvidence = async (req, res) => {
  try {
    const { criterionId, objective, activity, kpiValue, documentUrl, outcome } = req.body;

    if (!criterionId || !objective || !activity) {
      return res.status(400).json({
        message: 'criterionId, objective, and activity are required',
      });
    }

    const record = await EvidenceRecord.create({
      criterionId,
      objective,
      activity,
      kpiValue,
      documentUrl,
      outcome,
      submittedBy: req.user.id,
    });

    const populated = await record.populate('submittedBy', 'name email role');

    const io = req.app.get('io');
    if (io) {
      io.to('iqac').emit('new_evidence_logged', populated);
    }

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateEvidenceStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['verified', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        message: 'status must be verified, approved, or rejected',
      });
    }

    const record = await EvidenceRecord.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).populate('submittedBy', 'name email role');

    if (!record) {
      return res.status(404).json({ message: 'Evidence record not found' });
    }

    const io = req.app.get('io');
    if (io) {
      const submitterId = record.submittedBy?._id || record.submittedBy;
      io.to(`user:${submitterId.toString()}`).emit(
        'evidence_status_updated',
        record
      );
      io.to('iqac').emit('evidence_status_updated', record);
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getEvidenceSummary = async (req, res) => {
  try {
    const summary = await EvidenceRecord.aggregate([
      {
        $group: {
          _id: '$criterionId',
          submitted: {
            $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] },
          },
          verified: {
            $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] },
          },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          criterionId: '$_id',
          submitted: 1,
          verified: 1,
          approved: 1,
        },
      },
      { $sort: { criterionId: 1 } },
    ]);

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const listEvidence = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const records = await EvidenceRecord.find(filter)
      .populate('submittedBy', 'name email role')
      .sort({ createdAt: -1 });

    const role = req.query.role;
    const filtered = role
      ? records.filter((record) => record.submittedBy?.role === role)
      : records;

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createEvidence,
  updateEvidenceStatus,
  getEvidenceSummary,
  listEvidence,
};
