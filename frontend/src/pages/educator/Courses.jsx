import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../hooks/useConfirm.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';

export function Courses() {
  const { token } = useAuth();
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const { confirm, dialogProps } = useConfirm();

  async function load() {
    setCourses(await api.get('/courses/mine', token));
  }

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createCourse() {
    try {
      await api.post('/courses', { title, description: description || undefined }, token);
      toast.success('Course created.');
      setTitle('');
      setDescription('');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function toggleActive(course) {
    try {
      await api.put(`/courses/${course.id}`, { active: !course.active }, token);
      toast.success(course.active ? 'Course deactivated.' : 'Course activated.');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <ConfirmDialog {...dialogProps} />
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Your Courses</h1>
      <ul className="space-y-2 mb-6">
        {courses.map((c) => (
          <li key={c.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <Link to={`/educator/courses/${c.id}`} className="flex-1 hover:text-gray-900">
              <p className="font-medium text-gray-900">
                {c.title}
                {!c.active ? ' (inactive)' : ''}
              </p>
              {c.description && <p className="text-sm text-gray-500">{c.description}</p>}
            </Link>
            <button
              onClick={() =>
                confirm(
                  c.active ? 'Deactivate course?' : 'Activate course?',
                  `${c.active ? 'Hide' : 'Show'} "${c.title}" ${c.active ? 'from' : 'to'} students browsing to enroll?`,
                  () => toggleActive(c),
                )
              }
              className="text-xs text-gray-600 underline ml-4"
            >
              {c.active ? 'Deactivate' : 'Activate'}
            </button>
          </li>
        ))}
        {courses.length === 0 && <p className="text-sm text-gray-500">No courses yet.</p>}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          confirm('Create course?', `Create "${title}"?`, createCourse);
        }}
        className="bg-white border border-gray-200 rounded-lg p-4 max-w-md"
      >
        <label className="block text-sm text-gray-600 mb-1">Title</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-3 text-sm"
        />
        <label className="block text-sm text-gray-600 mb-1">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-3 text-sm"
        />
        <button type="submit" className="bg-gray-900 text-white text-sm rounded px-4 py-2">
          Create course
        </button>
      </form>
    </div>
  );
}
