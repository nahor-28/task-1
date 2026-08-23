import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../hooks/useConfirm.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';

export function Groups() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [joiningId, setJoiningId] = useState(null);
  const { confirm, dialogProps } = useConfirm();

  async function load() {
    try {
      setGroups(await api.get(`/assignments/${id}/groups`, token));
      setLoaded(true);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  async function join(groupId) {
    setJoiningId(groupId);
    try {
      await api.post(`/assignments/${id}/groups/${groupId}/join`, undefined, token);
      toast.success('Joined group.');
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setJoiningId(null);
    }
  }

  async function confirmAll(groupId) {
    try {
      const result = await api.post(`/groups/${groupId}/confirm-all`, undefined, token);
      if (result.notSubmittedStudentIds?.length > 0) {
        toast.error(`Confirmed anyway — ${result.notSubmittedStudentIds.length} member(s) had not submitted.`);
      } else {
        toast.success('All submissions confirmed.');
      }
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (error) return <div className="alert alert-error"><span>{error}</span></div>;

  if (!loaded) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-32 rounded-box" />
        ))}
      </div>
    );
  }

  const myGroup = groups.find((g) => g.members.some((m) => m.id === user.id));
  const myRole = myGroup?.members.find((m) => m.id === user.id)?.role;

  return (
    <div>
      <ConfirmDialog {...dialogProps} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-base-content">Groups</h1>
        <Link to={`/student/assignments/${id}`} className="link link-primary text-sm">
          Back to assignment
        </Link>
      </div>

      {myGroup && (
        <div className="alert alert-info alert-soft mb-6 items-start">
          <div className="flex-1">
            <p className="text-sm mb-2">
              You're in <span className="font-medium">{myGroup.name}</span>
              {myRole === 'leader' ? ' as leader' : ''}.
            </p>
            {myRole === 'leader' && (
              <button
                onClick={() =>
                  confirm(
                    'Confirm all submissions?',
                    "This confirms every member's submission, including anyone who hasn't submitted yet. This cannot be undone.",
                    () => confirmAll(myGroup.id),
                  )
                }
                className="btn btn-primary btn-sm"
              >
                Confirm all submissions
              </button>
            )}
          </div>
        </div>
      )}

      {groups.length === 0 && <p className="text-sm text-base-content/60">No groups yet.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {groups.map((g) => (
          <div key={g.id} className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="card-title text-base">{g.name}</h3>
                {!myGroup && (
                  <button onClick={() => join(g.id)} disabled={joiningId === g.id} className="btn btn-primary btn-sm">
                    {joiningId === g.id && <span className="loading loading-spinner loading-xs" />}
                    Join
                  </button>
                )}
              </div>
              <ul className="flex flex-col gap-1">
                {g.members.map((m) => (
                  <li key={m.id} className="text-sm text-base-content/80 flex items-center gap-2">
                    {m.name}
                    {m.role === 'leader' && <span className="badge badge-primary badge-soft badge-sm">Leader</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
