import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../hooks/useConfirm.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';

export function Groups() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [memberId, setMemberId] = useState('');
  const { confirm, dialogProps } = useConfirm();

  async function loadGroups() {
    const list = await api.get('/groups/mine', token);
    setGroups(list);
  }

  useEffect(() => {
    loadGroups().catch((err) => toast.error(err.message));
    api.get('/users?role=student', token).then(setAllStudents).catch((err) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function openGroup(id) {
    setMemberId('');
    try {
      const detail = await api.get(`/groups/${id}`, token);
      setSelected(detail);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function createGroup() {
    try {
      await api.post('/groups', { name: newGroupName }, token);
      toast.success('Group created.');
      setNewGroupName('');
      await loadGroups();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function addMember() {
    try {
      await api.post(`/groups/${selected.id}/members`, { studentId: memberId }, token);
      toast.success('Member added.');
      setMemberId('');
      await openGroup(selected.id);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function removeMember(studentId) {
    try {
      await api.del(`/groups/${selected.id}/members/${studentId}`, token);
      toast.success('Member removed.');
      await openGroup(selected.id);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function deleteGroup() {
    try {
      await api.del(`/groups/${selected.id}`, token);
      toast.success('Group deleted.');
      setSelected(null);
      await loadGroups();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const isLeader = selected?.members?.find((m) => m.id === user.id)?.role === 'leader';
  const nonMembers = allStudents.filter(
    (s) => !selected?.members?.some((m) => m.id === s.id),
  );
  const memberName = nonMembers.find((s) => s.id === memberId)?.name;

  return (
    <div className="grid grid-cols-2 gap-6">
      <ConfirmDialog {...dialogProps} />
      <div>
        <h1 className="text-lg font-semibold text-gray-900 mb-4">Your Groups</h1>
        <ul className="space-y-2 mb-6">
          {groups.map((g) => (
            <li key={g.id}>
              <button
                onClick={() => openGroup(g.id)}
                className="w-full text-left bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-400"
              >
                {g.name}
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirm('Create group?', `Create "${newGroupName}"?`, createGroup);
          }}
          className="flex gap-2"
        >
          <input
            required
            placeholder="New group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-gray-900 text-white text-sm rounded px-4 py-2">Create</button>
        </form>
      </div>

      {selected && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-gray-900">{selected.name}</h2>
            {isLeader && (
              <button
                onClick={() => confirm('Delete group?', `Delete "${selected.name}" and remove all its members? This cannot be undone.`, deleteGroup)}
                className="text-xs text-red-600"
              >
                Delete group
              </button>
            )}
          </div>
          <ul className="space-y-1 mb-4">
            {selected.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm text-gray-700">
                <span>{m.name}{m.role === 'leader' ? ' (leader)' : ''}</span>
                {isLeader && m.role !== 'leader' && (
                  <button
                    onClick={() => confirm('Remove member?', `Remove ${m.name} from this group?`, () => removeMember(m.id))}
                    className="text-xs text-red-600"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          {isLeader && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                confirm('Add member?', `Add ${memberName} to this group?`, addMember);
              }}
              className="flex gap-2"
            >
              <select
                required
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="" disabled>Select a student</option>
                {nonMembers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button type="submit" className="bg-gray-900 text-white text-sm rounded px-4 py-2">Add</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
