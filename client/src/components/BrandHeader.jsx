import { LogOut, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ROLE_LABELS = {
  student: 'Student',
  faculty: 'Faculty',
  iqac_admin: 'IQAC Admin',
};

export default function BrandHeader({ notice }) {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleSwitchRole = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/icon.png"
            alt="Dr. M.G.R. Educational and Research Institute crest"
            className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-slate-900 sm:text-base">
              Dr. M.G.R. Educational and Research Institute
            </p>
            <p className="truncate text-xs text-slate-500 sm:text-sm">
              Internal Quality Assurance Cell (IQAC) | NAAC A+
            </p>
          </div>
        </div>

        {isAuthenticated ? (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {notice ? (
              <div className="max-w-full text-xs font-medium text-emerald-700 sm:max-w-xs">
                {notice}
              </div>
            ) : null}
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
              {ROLE_LABELS[user?.role] || user?.role}
            </span>
            <button
              type="button"
              onClick={handleSwitchRole}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Switch role
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
