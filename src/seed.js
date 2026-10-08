require('dotenv').config();

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const EvidenceRecord = require('./models/EvidenceRecord');

const TEST_PASSWORD = 'password123';

async function dropCollection(model) {
  try {
    await model.collection.drop();
  } catch (error) {
    if (error.code !== 26) {
      throw error;
    }
  }
}

async function seed() {
  await connectDB();

  await dropCollection(User);
  await dropCollection(EvidenceRecord);

  const password = await bcrypt.hash(TEST_PASSWORD, 10);

  const [student, faculty, iqacAdmin] = await User.create([
    {
      name: 'Test Student',
      email: 'student@test.edu',
      password,
      role: 'student',
    },
    {
      name: 'Test Faculty',
      email: 'faculty@test.edu',
      password,
      role: 'faculty',
    },
    {
      name: 'IQAC Admin',
      email: 'iqac@test.edu',
      password,
      role: 'iqac_admin',
    },
  ]);

  await EvidenceRecord.create([
    {
      criterionId: '1.5',
      objective: 'Build food-safety competence through certified practical training',
      activity: 'HACCP Food Safety Practical Certification',
      kpiValue: 40,
      documentUrl: 'https://example.edu/evidence/haccp-cert.pdf',
      outcome: 'Student earned HACCP practical certification',
      status: 'submitted',
      submittedBy: student._id,
    },
    {
      criterionId: '2.3',
      objective: 'Strengthen experiential teaching-learning with industry exposure',
      activity: 'Industry Practical Workshop',
      kpiValue: 16,
      documentUrl: 'https://example.edu/evidence/industry-workshop.pdf',
      outcome: 'Completed industry-led practical workshop hours',
      status: 'verified',
      submittedBy: student._id,
    },
    {
      criterionId: '2.9',
      objective: 'Map formative assessments to course and programme outcomes',
      activity: 'Formative Assessment Outcome Mapping',
      kpiValue: 82,
      documentUrl: 'https://example.edu/evidence/co-po-mapping.xlsx',
      outcome: 'CO-PO attainment mapped for the current cycle',
      status: 'approved',
      submittedBy: student._id,
    },
    {
      criterionId: '3.2',
      objective: 'Publish applied research on kitchen sustainability',
      activity: 'Scopus Paper: Sustainable Waste in Commercial Kitchens',
      kpiValue: 1,
      documentUrl: 'https://example.edu/evidence/scopus-waste-kitchens.pdf',
      outcome: 'Scopus-indexed paper submitted on commercial kitchen waste',
      status: 'verified',
      submittedBy: faculty._id,
    },
    {
      criterionId: '4.2',
      objective: 'Upskill faculty in ICT-enabled teaching methods',
      activity: 'FDP on ICT-Enabled Pedagogy',
      kpiValue: 5,
      documentUrl: 'https://example.edu/evidence/fdp-ict-pedagogy.pdf',
      outcome: 'Completed five-day FDP on ICT-enabled pedagogy',
      status: 'approved',
      submittedBy: faculty._id,
    },
  ]);

  console.log('Seed complete');
  console.log('Users: student@test.edu, faculty@test.edu, iqac@test.edu');
  console.log('Password: password123');
  console.log('Evidence records: 5');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(async (error) => {
  console.error('Seed failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
