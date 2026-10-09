import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  Activity,
  Check,
  ExternalLink,
  Radio,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config/api';
import BrandHeader from '../components/BrandHeader';

const ANNUAL_TARGETS = {
  1: 24,
  2: 36,
  3: 18,
  4: 12,
  5: 16,
};

const CRITERION_META = {
  1: { title: 'Curricular Aspects', tone: 'bg-indigo-500' },
  2: { title: 'Teaching-Learning', tone: 'bg-violet-500' },
  3: { title: 'Research & Extension', tone: 'bg-sky-500' },
  4: { title: 'Infrastructure', tone: 'bg-emerald-500' },
  5: { title: 'Student Support', tone: 'bg-amber-500' },
};

const SURVEY_TEMPLATES = [
  'Criteria 5.10 Teaching Support',
  'Criteria 2.10 Student Satisfaction',
  'Criteria 2.7 Feedback Pulse',
  'Criteria 1.4 Curriculum Feedback',
];

const emptyCounts = () => ({ submitted: 0, verified: 0, approved: 0 });

function criterionGroup(criterionId) {
  const group = Number(String(criterionId || '').split('.')[0]);
  return group >= 1 && group <= 5 ? group : null;
}

function matrixFromSummary(rows) {
  const matrix = { 1: emptyCounts(), 2: emptyCounts(), 3: emptyCounts(), 4: emptyCounts(), 5: emptyCounts() };
  rows.forEach((row) => {
    const group = criterionGroup(row.criterionId);
    if (!group) return;
    matrix[group].submitted += Number(row.submitted) || 0;
    matrix[group].verified += Number(row.verified) || 0;
    matrix[group].approved += Number(row.approved) || 0;
  });
  return matrix;
}

function bumpMatrix(prev, group, field, delta) {
  if (!group) return prev;
  const next = { ...prev, [group]: { ...prev[group] } };
  next[group][field] = Math.max(0, next[group][field] + delta);
  return next;
}

function recordId(record) {
  return record._id || record.id;
}

function submitterName(record) {
  return record.submittedBy?.name || 'Unknown';
}

export default function IqacCommandCenter() {
  const { token } = useAuth();
  const [matrix, setMatrix] = useState(matrixFromSummary([]));
  const [queue, setQueue] = useState([]);
  const [audience, setAudience] = useState('Students');
  const [template, setTemplate] = useState(SURVEY_TEMPLATES[0]);
  const [broadcastNote, setBroadcastNote] = useState('');
  const [liveNote, setLiveNote] = useState('');
  const [actingId, setActingId] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    axios
      .get('/evidence/summary')
      .then(({ data }) => {
        if (Array.isArray(data)) setMatrix(matrixFromSummary(data));
      })
      .catch(() => {});

    axios
      .get('/evidence', { params: { status: 'verified' } })
      .then(({ data }) => setQueue(Array.isArray(data) ? data : []))
      .catch(() => setQueue([]));
  }, []);

  useEffect(() => {
    if (!token) return undefined;

    const nextSocket = io(API_URL, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    nextSocket.on('connect', () => {
      nextSocket.emit('join', 'iqac');
    });

    nextSocket.on('new_evidence_logged', (record) => {
      const group = criterionGroup(record?.criterionId);
      setMatrix((prev) => bumpMatrix(prev, group, 'submitted', 1));
      setLiveNote(`New research/log · Criterion ${record?.criterionId}`);
    });

    nextSocket.on('evidence_status_updated', (record) => {
      const group = criterionGroup(record?.criterionId);
      if (record.status === 'verified') {
        setMatrix((prev) =>
          bumpMatrix(bumpMatrix(prev, group, 'submitted', -1), group, 'verified', 1)
        );
        setQueue((prev) => {
          const id = recordId(record);
          if (prev.some((item) => recordId(item) === id)) return prev;
          return [record, ...prev];
        });
        setLiveNote(`Faculty verified Criterion ${record.criterionId}`);
      }
      if (record.status === 'approved') {
        setMatrix((prev) =>
          bumpMatrix(bumpMatrix(prev, group, 'verified', -1), group, 'approved', 1)
        );
        setQueue((prev) => prev.filter((item) => recordId(item) !== recordId(record)));
      }
      if (record.status === 'rejected') {
        setMatrix((prev) => bumpMatrix(prev, group, 'submitted', -1));
      }
    });

    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [token]);

  useEffect(() => {
    if (!liveNote) return undefined;
    const timer = setTimeout(() => setLiveNote(''), 3500);
    return () => clearTimeout(timer);
  }, [liveNote]);

  const bars = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((id) => {
        const counts = matrix[id];
        const target = ANNUAL_TARGETS[id];
        const approvedPct = Math.min(100, Math.round((counts.approved / target) * 100));
        const verifiedPct = Math.min(
          100 - approvedPct,
          Math.round((counts.verified / target) * 100)
        );
        return { id, ...CRITERION_META[id], counts, target, approvedPct, verifiedPct };
      }),
    [matrix]
  );

  const triggerSurvey = () => {
    if (!socket) {
      setBroadcastNote('Socket is not connected');
      return;
    }
    socket.emit('trigger_pulse_survey', { audience, template });
    setBroadcastNote(`Pulse survey sent to ${audience}`);
    setTimeout(() => setBroadcastNote(''), 3200);
  };

  const finalApprove = async (id) => {
    setActingId(id);
    try {
      await axios.patch(`/evidence/${id}/status`, { status: 'approved' });
      const record = queue.find((item) => recordId(item) === id);
      const group = criterionGroup(record?.criterionId);
      setQueue((prev) => prev.filter((item) => recordId(item) !== id));
      setMatrix((prev) =>
        bumpMatrix(bumpMatrix(prev, group, 'verified', -1), group, 'approved', 1)
      );
    } catch {
      setLiveNote('Could not final-approve this record');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="min-h-svh bg-slate-100 text-slate-800">
      <BrandHeader
        notice={
          liveNote ? (
            <span className="inline-flex items-center gap-1">
              <Radio className="h-3.5 w-3.5" />
              {liveNote}
            </span>
          ) : null
        }
      />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <h1 className="sr-only">Command Center</h1>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-6">
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-semibold text-slate-900">
                Live accreditation health matrix
              </h2>
            </div>
            <div className="space-y-4">
              {bars.map((bar) => (
                <div key={bar.id}>
                  <div className="mb-1 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Criterion {bar.id} · {bar.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {bar.counts.approved} approved · {bar.counts.verified} verified
                        · target {bar.target}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{bar.approvedPct}%</p>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="flex h-full">
                      <div
                        className={`h-full ${bar.tone} transition-all`}
                        style={{ width: `${bar.approvedPct}%` }}
                      />
                      <div
                        className="h-full bg-slate-300 transition-all"
                        style={{ width: `${bar.verifiedPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-semibold text-slate-900">Master audit queue</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {queue.length} verified
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Submitter</th>
                    <th className="px-5 py-3 font-medium">Criterion</th>
                    <th className="px-5 py-3 font-medium">Activity</th>
                    <th className="px-5 py-3 font-medium">Document</th>
                    <th className="px-5 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queue.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                        No verified records awaiting final approval.
                      </td>
                    </tr>
                  ) : null}
                  {queue.map((record) => {
                    const id = recordId(record);
                    return (
                      <tr key={id} className="align-top">
                        <td className="px-5 py-4">
                          <p className="font-medium text-slate-900">{submitterName(record)}</p>
                          <p className="text-xs text-slate-500">
                            {record.submittedBy?.email || record.submittedBy?.role}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                            {record.criterionId}
                          </span>
                        </td>
                        <td className="max-w-xs px-5 py-4 text-slate-700">{record.activity}</td>
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
                          <button
                            type="button"
                            disabled={actingId === id}
                            onClick={() => finalApprove(id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Final Approve
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <aside className="h-fit rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-center gap-2">
            <Send className="h-5 w-5 text-violet-600" />
            <h2 className="text-base font-semibold text-slate-900">Survey broadcast engine</h2>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Push a live pulse survey to connected student or faculty PWA clients.
          </p>

          <label className="mb-3 block text-sm font-medium text-slate-700">
            Target audience
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
            >
              <option>Students</option>
              <option>Faculty</option>
            </select>
          </label>

          <label className="mb-4 block text-sm font-medium text-slate-700">
            Template
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              value={template}
              onChange={(event) => setTemplate(event.target.value)}
            >
              {SURVEY_TEMPLATES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={triggerSurvey}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white"
          >
            <Radio className="h-4 w-4" />
            Trigger Live Pulse Survey
          </button>
          {broadcastNote ? (
            <p className="mt-3 text-sm text-emerald-600">{broadcastNote}</p>
          ) : null}
        </aside>
        </div>
      </main>
    </div>
  );
}
