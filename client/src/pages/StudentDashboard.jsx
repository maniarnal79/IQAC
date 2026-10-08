import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  AlertTriangle,
  Award,
  Bell,
  Clock3,
  GraduationCap,
  Link as LinkIcon,
  LogOut,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const CRITERIA_OPTIONS = [
  { id: '1.1', label: '1.1 Curriculum Design' },
  { id: '1.2', label: '1.2 Academic Flexibility' },
  { id: '1.3', label: '1.3 Curriculum Enrichment' },
  { id: '1.4', label: '1.4 Feedback on Curriculum' },
  { id: '1.5', label: '1.5 Experiential Learning' },
  { id: '2.1', label: '2.1 Student Enrolment' },
  { id: '2.2', label: '2.2 Student Diversity' },
  { id: '2.3', label: '2.3 Teaching-Learning Process' },
  { id: '2.4', label: '2.4 Teacher Profile' },
  { id: '2.5', label: '2.5 Evaluation Process' },
  { id: '2.6', label: '2.6 Student Performance' },
  { id: '2.7', label: '2.7 Student Satisfaction' },
  { id: '2.8', label: '2.8 Mentorship' },
  { id: '2.9', label: '2.9 CO-PO Attainment' },
  { id: '2.10', label: '2.10 Student Feedback Surveys' },
];

const emptyStats = {
  experientialHours: 0,
  experientialApproved: 0,
  experientialLogged: 0,
  copoApproved: 0,
  copoLogged: 0,
  mentorshipApproved: 0,
  mentorshipLogged: 0,
};

function countFromSummary(rows, ids, field) {
  return rows
    .filter((row) => ids.includes(row.criterionId))
    .reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
}

function statsFromSummary(rows) {
  const experientialIds = ['1.5', '2.3'];
  const submitted15 = countFromSummary(rows, experientialIds, 'submitted');
  const approved15 = countFromSummary(rows, experientialIds, 'approved');
  const copoSubmitted = countFromSummary(rows, ['2.9'], 'submitted');
  const copoApproved = countFromSummary(rows, ['2.9'], 'approved');
  const mentorSubmitted = countFromSummary(rows, ['2.8'], 'submitted');
  const mentorApproved = countFromSummary(rows, ['2.8'], 'approved');

  return {
    experientialHours: 0,
    experientialApproved: approved15,
    experientialLogged: submitted15 + approved15,
    copoApproved,
    copoLogged: copoSubmitted + copoApproved,
    mentorshipApproved: mentorApproved,
    mentorshipLogged: mentorSubmitted + mentorApproved,
  };
}

function applyStatusUpdate(prev, record) {
  const next = { ...prev };

  if (record.criterionId === '1.5' || record.criterionId === '2.3') {
    if (record.status === 'approved') {
      next.experientialApproved += 1;
    }
  }

  if (record.criterionId === '2.9' && record.status === 'approved') {
    next.copoApproved += 1;
  }

  if (record.criterionId === '2.8' && record.status === 'approved') {
    next.mentorshipApproved += 1;
  }

  return next;
}

const initialForm = {
  criterionId: '1.5',
  objective: '',
  activity: '',
  kpiValue: '',
  documentUrl: '',
};

export default function StudentDashboard() {
  const { user, token, logout } = useAuth();
  const [stats, setStats] = useState(emptyStats);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showSurveyBanner, setShowSurveyBanner] = useState(true);

  const copoPercent = useMemo(() => {
    if (!stats.copoLogged) return 0;
    return Math.min(100, Math.round((stats.copoApproved / stats.copoLogged) * 100));
  }, [stats.copoApproved, stats.copoLogged]);

  useEffect(() => {
    let cancelled = false;

    axios
      .get('/evidence/summary')
      .then(({ data }) => {
        if (!cancelled && Array.isArray(data)) {
          setStats(statsFromSummary(data));
        }
      })
      .catch(() => {
        if (!cancelled) setStats(emptyStats);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token || !user?.id) return undefined;

    const socket = io({
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join', `user:${user.id}`);
      socket.emit('join', 'students');
    });

    socket.on('pulse_survey', (payload) => {
      const body = payload?.template || 'A new IQAC pulse survey is available';
      setToast(body);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('IQAC Pulse Survey', { body });
      }
    });

    socket.on('evidence_status_updated', (record) => {
      if (!record?.criterionId) return;
      setStats((prev) => applyStatusUpdate(prev, record));
      setToast(
        record.status === 'approved'
          ? `Evidence ${record.criterionId} approved`
          : `Evidence ${record.criterionId} ${record.status}`
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [token, user?.id]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const payload = {
        criterionId: form.criterionId,
        objective: form.objective,
        activity: form.activity,
        kpiValue: form.kpiValue === '' ? undefined : Number.isNaN(Number(form.kpiValue))
          ? form.kpiValue
          : Number(form.kpiValue),
        documentUrl: form.documentUrl,
      };

      await axios.post('/evidence', payload);

      setStats((prev) => {
        const next = { ...prev };
        if (form.criterionId === '1.5' || form.criterionId === '2.3') {
          next.experientialLogged += 1;
          const hours = Number(form.kpiValue);
          if (Number.isFinite(hours)) next.experientialHours += hours;
        }
        if (form.criterionId === '2.9') next.copoLogged += 1;
        if (form.criterionId === '2.8') next.mentorshipLogged += 1;
        return next;
      });

      setForm(initialForm);
      setModalOpen(false);
      setToast('Activity logged');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit evidence');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-svh bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
              Student portal
            </p>
            <h1 className="text-lg font-semibold text-slate-900">Live IQAC counters</h1>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-28 pt-4">
        {showSurveyBanner ? (
          <div className="mb-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Bell className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-sm font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                Action required
              </p>
              <p className="mt-1 text-sm leading-5 text-amber-800">
                Pending student feedback surveys for Criteria 2.10 &amp; 5.10. Complete them
                to keep your IQAC record current.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSurveyBanner(false)}
              className="h-8 w-8 shrink-0 rounded-full text-amber-700"
              aria-label="Dismiss banner"
            >
              <X className="mx-auto h-4 w-4" />
            </button>
          </div>
        ) : null}

        <section className="grid gap-3">
          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-indigo-600">Criteria 1.5 &amp; 2.3</p>
                <h2 className="mt-1 text-base font-semibold text-slate-900">
                  Experiential Learning Hours
                </h2>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Clock3 className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              {stats.experientialHours}
              <span className="ml-1 text-sm font-medium text-slate-500">hrs</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {stats.experientialApproved} approved · {stats.experientialLogged} logged
            </p>
          </article>

          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-violet-600">Criteria 2.9</p>
                <h2 className="mt-1 text-base font-semibold text-slate-900">
                  CO-PO Attainment Progress
                </h2>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <GraduationCap className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              {copoPercent}
              <span className="ml-1 text-sm font-medium text-slate-500">%</span>
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-violet-500 transition-all"
                style={{ width: `${copoPercent}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {stats.copoApproved} of {stats.copoLogged || 0} outcomes approved
            </p>
          </article>

          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-emerald-600">Criteria 2.8</p>
                <h2 className="mt-1 text-base font-semibold text-slate-900">
                  Mentorship Status
                </h2>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Users className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              {stats.mentorshipApproved}
              <span className="ml-1 text-sm font-medium text-slate-500">sessions</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {stats.mentorshipLogged} logged · awaiting faculty verification
            </p>
          </article>
        </section>
      </main>

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          <Award className="h-4 w-4" />
          {toast}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setError('');
          setModalOpen(true);
        }}
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30"
      >
        <Plus className="h-5 w-5" />
        + Log Activity
      </button>

      {modalOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
          <div
            className="absolute inset-0"
            onClick={() => !submitting && setModalOpen(false)}
          />
          <form
            onSubmit={handleSubmit}
            className="relative z-10 max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Log activity</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mb-3 block text-left text-sm font-medium text-slate-700">
              Criterion (Criteria 1 &amp; 2)
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
                value={form.criterionId}
                onChange={updateField('criterionId')}
                required
              >
                {CRITERIA_OPTIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mb-3 block text-left text-sm font-medium text-slate-700">
              Objective
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
                rows={2}
                value={form.objective}
                onChange={updateField('objective')}
                required
              />
            </label>

            <label className="mb-3 block text-left text-sm font-medium text-slate-700">
              Activity
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
                rows={2}
                value={form.activity}
                onChange={updateField('activity')}
                required
              />
            </label>

            <label className="mb-3 block text-left text-sm font-medium text-slate-700">
              KPI metric
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
                value={form.kpiValue}
                onChange={updateField('kpiValue')}
                placeholder="Hours, score, or count"
              />
            </label>

            <label className="mb-4 block text-left text-sm font-medium text-slate-700">
              <span className="inline-flex items-center gap-1">
                <LinkIcon className="h-3.5 w-3.5" />
                Document link / URL
              </span>
              <input
                type="url"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
                value={form.documentUrl}
                onChange={updateField('documentUrl')}
                placeholder="https://"
              />
            </label>

            {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {submitting ? 'Submitting…' : 'Submit evidence'}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
