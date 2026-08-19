import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useConfirm } from '../../hooks/useConfirm.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';

export function AssignmentForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', onedriveLink: '' });
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { confirm, dialogProps } = useConfirm();

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/assignments/${id}`, token).then((a) =>
      setForm({
        title: a.title,
        description: a.description,
        dueDate: a.dueDate.slice(0, 10),
        onedriveLink: a.onedriveLink || '',
      }),
    );
  }, [id, isEdit, token]);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (isEdit) {
      save();
    } else {
      confirm('Create assignment?', `Create "${form.title}"?`, save);
    }
  }

  async function save() {
    setError('');
    setLoading(true);
    try {
      const payload = { ...form, onedriveLink: form.onedriveLink || undefined };
      const assignmentId = isEdit
        ? id
        : (await api.post('/assignments', payload, token)).assignmentId;
      if (isEdit) await api.put(`/assignments/${id}`, payload, token);
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        await api.upload(`/assignments/${assignmentId}/attachment`, formData, token);
      }
      navigate(`/educator/assignments/${assignmentId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 max-w-lg">
      <ConfirmDialog {...dialogProps} />
      <h1 className="text-lg font-semibold text-gray-900 mb-4">{isEdit ? 'Edit Assignment' : 'New Assignment'}</h1>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <label className="block text-sm text-gray-600 mb-1">Title</label>
      <input required value={form.title} onChange={update('title')} className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm" />
      <label className="block text-sm text-gray-600 mb-1">Description</label>
      <textarea required value={form.description} onChange={update('description')} rows={4} className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm" />
      <label className="block text-sm text-gray-600 mb-1">Due date</label>
      <input required type="date" value={form.dueDate} onChange={update('dueDate')} className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm" />
      <label className="block text-sm text-gray-600 mb-1">OneDrive link (optional)</label>
      <input value={form.onedriveLink} onChange={update('onedriveLink')} className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm" />
      <label className="block text-sm text-gray-600 mb-1">Attachment (PDF/DOCX, optional)</label>
      <input type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files[0])} className="w-full text-sm mb-6" />
      <button type="submit" disabled={loading} className="bg-gray-900 text-white text-sm rounded px-4 py-2 disabled:opacity-50">
        {loading ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
