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
    <div className="card bg-base-100 shadow-sm border border-base-300 max-w-lg">
      <div className="card-body">
        <ConfirmDialog {...dialogProps} />
        <h1 className="text-lg font-semibold text-base-content mb-4">{isEdit ? 'Edit Assignment' : 'New Assignment'}</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="a-course">Course</label>
            <select
              id="a-course"
              required
              disabled={isEdit}
              value={form.courseId}
              onChange={update('courseId')}
              className="select w-full"
            >
              <option value="" disabled>Select a course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="a-title">Title</label>
            <input id="a-title" required value={form.title} onChange={update('title')} className="input validator w-full" />
            <p className="validator-hint">Title is required</p>
          </div>

          <div>
            <label className="label" htmlFor="a-description">Description</label>
            <textarea
              id="a-description"
              required
              value={form.description}
              onChange={update('description')}
              rows={4}
              className="textarea w-full"
            />
          </div>

          <div>
            <label className="label" htmlFor="a-due">Due date</label>
            <input id="a-due" required type="date" value={form.dueDate} onChange={update('dueDate')} className="input w-full" />
          </div>

          <div>
            <label className="label" htmlFor="a-onedrive">OneDrive link (optional)</label>
            <input
              id="a-onedrive"
              type="url"
              value={form.onedriveLink}
              onChange={update('onedriveLink')}
              className="input validator w-full"
              placeholder="https://..."
            />
            <p className="validator-hint">Enter a valid URL</p>
          </div>

          <div>
            <label className="label" htmlFor="a-type">Type</label>
            <div className="join w-full" id="a-type">
              <button
                type="button"
                disabled={isPublished}
                className={`btn join-item flex-1 ${form.type === 'individual' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setForm({ ...form, type: 'individual' })}
              >
                Individual
              </button>
              <button
                type="button"
                disabled={isPublished}
                className={`btn join-item flex-1 ${form.type === 'group' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setForm({ ...form, type: 'group' })}
              >
                Group
              </button>
            </div>
          </div>

          {form.type === 'group' && (
            <div>
              <label className="label" htmlFor="a-numgroups">Number of groups</label>
              <input
                id="a-numgroups"
                required
                disabled={isPublished}
                type="number"
                min="1"
                value={form.numGroups}
                onChange={update('numGroups')}
                className="input w-full"
              />
            </div>
          )}
          {isPublished && <p className="text-xs text-base-content/60">Type and group count are locked after publishing.</p>}

          <div>
            <label className="label" htmlFor="a-file">Attachment (PDF/DOCX, optional)</label>
            <input
              id="a-file"
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => setFile(e.target.files[0])}
              className="file-input w-full"
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary self-start">
            {loading && <span className="loading loading-spinner loading-sm" />}
            {loading ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}
