const express = require('express');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const {
  createEvidence,
  updateEvidenceStatus,
  getEvidenceSummary,
  listEvidence,
} = require('../controllers/evidenceController');

const router = express.Router();

router.post(
  '/',
  authenticate,
  authorizeRoles('student', 'faculty'),
  createEvidence
);

router.patch(
  '/:id/status',
  authenticate,
  authorizeRoles('faculty', 'iqac_admin'),
  updateEvidenceStatus
);

router.get('/summary', authenticate, getEvidenceSummary);

router.get(
  '/',
  authenticate,
  authorizeRoles('faculty', 'iqac_admin'),
  listEvidence
);

module.exports = router;
