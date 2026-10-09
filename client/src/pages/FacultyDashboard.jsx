import { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  Check,
  ClipboardList,
  ExternalLink,
  FileText,
  GraduationCap,
  LogOut,
  Radio,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config/api';

const FACULTY_CRITERIA = [
  { id: '3.2', label: '3.2 Research publications' },
  { id: '4.2', label: '4.2 FDP participation' },
];

const emptyFacultyForm = {
  criterionId: '3.2',
  objective: '',
  activity: '',
  kpiValue: '',
  documentUrl: '',
  outcome: '',
};

function studentName(record) {
  return record.submittedBy?.name || 'Unknown student';
}

function studentEmail(record) {
  return record.submittedBy?.email || '—';
}

function recordId(record) {
  return record._id || record.id;
}

export default function FacultyDashboard() {
  const { token, logout } = useAuth();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [liveNote, setLiveNote] = useState('');
  const [form, setForm] = useState(emptyFacultyForm);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    axios
      .get('/evidence', { params: { status: 'submitted', role: 'student' } })
      .then(({ data }) => {
        if (!cancelled) setQueue(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setQueue([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token) return undefined;

    const socket = io(API_URL, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join', 'iqac');
      socket.emit('join', 'faculty');
    });

    socket.on('pulse_survey', (payload) => {
      const body = payload?.template || 'A new IQAC pulse survey is available';
      setLiveNote(body);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('IQAC Pulse Survey', { body });
      }
    });

    socket.on('new_evidence_logged', (record) => {
      if (!record || record.status !== 'submitted') return;
      const submitterRole = record.submittedBy?.role;
      if (submitterRole && submitterRole !== 'student') return;

      setQueue((prev) => {
        const id = recordId(record);
        if (prev.some((item) => recordId(item) === id)) return prev;
        return [record, ...prev];
      });
      setLiveNote(
        `New log from ${studentName(record)} · ${record.criterionId}`
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (!liveNote) return undefined;
    const timer = setTimeout(() => setLiveNote(''), 3500);
    return () => clearTimeout(timer);
  }, [liveNote]);

  const updateStatus = async (id, status) => {
    setActingId(id);
    try {
      await axios.patch(`/evidence/${id}/status`, { status });
      setQueue((prev) => prev.filter((item) => recordId(item) !== id));
    } catch {
      setLiveNote('Could not update evidence status');
    } finally {
      setActingId(null);
    }
  };

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const submitFacultyEvidence = async (event) => {
    event.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      await axios.post('/evidence', {
        criterionId: form.criterionId,
        objective: form.objective,
        activity: form.activity,
        kpiValue: form.kpiValue,
        documentUrl: form.documentUrl,
        outcome: form.outcome,
      });
      setForm(emptyFacultyForm);
      setFormSuccess('Evidence submitted');
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not submit evidence');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-svh bg-slate-100 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Faculty workspace
            </p>
            <h1 className="text-xl font-semibold text-slate-900">
              Verification queue
            </h1>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-semibold text-slate-900">
                Student submissions
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {queue.length} pending
              </span>
            </div>
            {liveNote ? (
              <p className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <Radio className="h-3.5 w-3.5" />
                {liveNote}
              </p>
            ) : (
              <p className="text-xs text-slate-400">Listening for new logs</p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Student</th>
                  <th className="px-5 py-3 font-medium">Criterion</th>
                  <th className="px-5 py-3 font-medium">Activity</th>
                  <th className="px-5 py-3 font-medium">Document</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                      Loading queue…
                    </td>
                  </tr>
                ) : null}
                {!loading && queue.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                      No submitted student evidence yet.
                    </td>
                  </tr>
                ) : null}
                {queue.map((record) => {
                  const id = recordId(record);
                  return (
                    <tr key={id} className="align-top hover:bg-slate-50/80">
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">{studentName(record)}</p>
                        <p className="text-xs text-slate-500">{studentEmail(record)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                          {record.criterionId}
                        </span>
                      </td>
                      <td className="max-w-xs px-5 py-4 text-slate-700">
                        {record.activity}
                      </td>
                      <td className="px-5 py-4">
                        {record.documentUrl ? (
                          <a
                            href={record.documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open
                          </a>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={actingId === id}
                            onClick={() => updateStatus(id, 'verified')}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={actingId === id}
                            onClick={() => updateStatus(id, 'rejected')}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="h-fit rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-violet-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Faculty evidence logging
            </h2>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Record research publications (3.2) or FDP participation (4.2) using the
            five-component IQAC model.
          </p>

          <form onSubmit={submitFacultyEvidence} className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Criterion
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={form.criterionId}
                onChange={updateField('criterionId')}
                required
              >
                {FACULTY_CRITERIA.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Objective
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                rows={2}
                value={form.objective}
                onChange={updateField('objective')}
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Activity
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                rows={2}
                value={form.activity}
                onChange={updateField('activity')}
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Metric
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={form.kpiValue}
                onChange={updateField('kpiValue')}
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                Document URL
              </span>
              <input
                type="url"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={form.documentUrl}
                onChange={updateField('documentUrl')}
                placeholder="https://"
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Outcome
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                rows={2}
                value={form.outcome}
                onChange={updateField('outcome')}
                required
              />
            </label>

            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            {formSuccess ? (
              <p className="text-sm text-emerald-600">{formSuccess}</p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit evidence'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
