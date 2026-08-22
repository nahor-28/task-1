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
  const [error, setError] = useState('');
  const { confirm, dialogProps } = useConfirm();

  async function load() {
    try {
      setGroups(await api.get(`/assignments/${id}/groups`, token));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  async function join(groupId) {
    try {
      await api.post(`/assignments/${id}/groups/${groupId}/join`, undefined, token);
      toast.success('Joined group.');
      await load();
    } catch (err) {
      toast.error(err.message);
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

  if (error) return <p className="text-sm text-red-600">{error}</p>;

  const myGroup = groups.find((g) => g.members.some((m) => m.id === user.id));
  const myRole = myGroup?.members.find((m) => m.id === user.id)?.role;

  return (
    <div>
      <ConfirmDialog {...dialogProps} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Groups</h1>
        <Link to={`/student/assignments/${id}`} className="text-sm text-gray-600 underline">
          Back to assignment
        </Link>
      </div>

      {myGroup && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-800 mb-2">
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
              className="bg-gray-900 text-white text-sm rounded px-4 py-2"
            >
              Confirm all submissions
            </button>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {groups.map((g) => (
          <li key={g.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-gray-900">{g.name}</p>
              {!myGroup && (
                <button onClick={() => join(g.id)} className="bg-gray-900 text-white text-sm rounded px-3 py-1">
                  Join
                </button>
              )}
            </div>
            <ul className="text-sm text-gray-600">
              {g.members.map((m) => (
                <li key={m.id}>
                  {m.name}
                  {m.role === 'leader' ? ' (leader)' : ''}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
