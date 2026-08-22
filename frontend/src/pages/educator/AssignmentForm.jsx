import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useConfirm } from '../../hooks/useConfirm.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export function AssignmentForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const { token } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({
    courseId: searchParams.get('courseId') || '',
    title: '',
    description: '',
    dueDate: '',
    onedriveLink: '',
    type: 'individual',
    numGroups: '',
  });
  const [status, setStatus] = useState('draft');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const { confirm, dialogProps } = useConfirm();

  useEffect(() => {
    api.get('/courses/mine', token).then(setCourses).catch((err) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/assignments/${id}`, token)
      .then((a) => {
        setForm({
          courseId: a.courseId,
          title: a.title,
          description: a.description,
          dueDate: a.dueDate.slice(0, 10),
          onedriveLink: a.onedriveLink || '',
          type: a.type,
          numGroups: a.numGroups || '',
        });
        setStatus(a.status);
      })
      .catch((err) => toast.error(err.message));
  }, [id, isEdit, token]);

  const isPublished = isEdit && status === 'published';

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (isEdit) {
      save();
    } else {
      confirm('Create assignment?', `Create "${form.title}" as a draft?`, save);
    }
  }

  async function save() {
    setLoading(true);
    try {
      const payload = {
        courseId: form.courseId,
        title: form.title,
        description: form.description,
        dueDate: form.dueDate,
        onedriveLink: form.onedriveLink || undefined,
        type: form.type,
        numGroups: form.type === 'group' ? Number(form.numGroups) : undefined,
      };
      const assignmentId = isEdit ? id : (await api.post('/assignments', payload, token)).assignmentId;
      if (isEdit) await api.put(`/assignments/${id}`, payload, token);
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        await api.upload(`/assignments/${assignmentId}/attachment`, formData, token);
      }
      toast.success(isEdit ? 'Assignment updated.' : 'Assignment created as a draft.');
      navigate(`/educator/assignments/${assignmentId}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 max-w-lg">
      <ConfirmDialog {...dialogProps} />
      <h1 className="text-lg font-semibold text-gray-900 mb-4">{isEdit ? 'Edit Assignment' : 'New Assignment'}</h1>

      <label className="block text-sm text-gray-600 mb-1">Course</label>
      <select
        required
        disabled={isEdit}
        value={form.courseId}
        onChange={update('courseId')}
        className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm disabled:bg-gray-100"
      >
        <option value="" disabled>Select a course</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>{c.title}</option>
        ))}
      </select>

      <label className="block text-sm text-gray-600 mb-1">Title</label>
      <input required value={form.title} onChange={update('title')} className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm" />
      <label className="block text-sm text-gray-600 mb-1">Description</label>
      <textarea required value={form.description} onChange={update('description')} rows={4} className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm" />
      <label className="block text-sm text-gray-600 mb-1">Due date</label>
      <input required type="date" value={form.dueDate} onChange={update('dueDate')} className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm" />
      <label className="block text-sm text-gray-600 mb-1">OneDrive link (optional)</label>
      <input value={form.onedriveLink} onChange={update('onedriveLink')} className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm" />

      <label className="block text-sm text-gray-600 mb-1">Type</label>
      <select
        disabled={isPublished}
        value={form.type}
        onChange={update('type')}
        className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm disabled:bg-gray-100"
      >
        <option value="individual">Individual</option>
        <option value="group">Group</option>
      </select>
      {form.type === 'group' && (
        <>
          <label className="block text-sm text-gray-600 mb-1">Number of groups</label>
          <input
            required
            disabled={isPublished}
            type="number"
            min="1"
            value={form.numGroups}
            onChange={update('numGroups')}
            className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm disabled:bg-gray-100"
          />
        </>
      )}
      {isPublished && <p className="text-xs text-gray-500 mb-4">Type and group count are locked after publishing.</p>}

      <label className="block text-sm text-gray-600 mb-1">Attachment (PDF/DOCX, optional)</label>
      <input type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files[0])} className="w-full text-sm mb-6" />
      <button type="submit" disabled={loading} className="bg-gray-900 text-white text-sm rounded px-4 py-2 disabled:opacity-50">
        {loading ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
