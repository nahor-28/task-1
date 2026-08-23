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
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const { confirm, dialogProps } = useConfirm();

  async function load() {
    setCourses(await api.get('/courses/mine', token));
    setLoaded(true);
  }

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createCourse() {
    setCreating(true);
    try {
      await api.post('/courses', { title, description: description || undefined }, token);
      toast.success('Course created.');
      setTitle('');
      setDescription('');
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
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
    <div className="space-y-8">
      <ConfirmDialog {...dialogProps} />

      <div>
        <h1 className="text-xl font-semibold text-base-content mb-4">Your courses</h1>
        {!loaded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-32 rounded-box" />
            ))}
          </div>
        )}
        {loaded && courses.length === 0 && <p className="text-sm text-base-content/60">No courses yet.</p>}
        {loaded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {courses.map((c) => (
              <div key={c.id} className="card bg-base-100 shadow-sm border border-base-300">
                <div className="card-body">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/educator/courses/${c.id}`} className="card-title text-base hover:text-primary">
                      {c.title}
                    </Link>
                    {!c.active && <span className="badge badge-ghost badge-sm">Inactive</span>}
                  </div>
                  {c.description && <p className="text-sm text-base-content/60 line-clamp-2">{c.description}</p>}
                  <div className="card-actions justify-end mt-2">
                    <button
                      onClick={() =>
                        confirm(
                          c.active ? 'Deactivate course?' : 'Activate course?',
                          `${c.active ? 'Hide' : 'Show'} "${c.title}" ${c.active ? 'from' : 'to'} students browsing to enroll?`,
                          () => toggleActive(c),
                        )
                      }
                      className="btn btn-ghost btn-xs"
                    >
                      {c.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card bg-base-100 shadow-sm border border-base-300 max-w-md">
        <div className="card-body">
          <h2 className="font-medium text-base-content mb-2">Create a course</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirm('Create course?', `Create "${title}"?`, createCourse);
            }}
            className="flex flex-col gap-4"
          >
            <div>
              <label className="label" htmlFor="course-title">Title</label>
              <input
                id="course-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input validator w-full"
              />
              <p className="validator-hint">Title is required</p>
            </div>
            <div>
              <label className="label" htmlFor="course-description">Description (optional)</label>
              <textarea
                id="course-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="textarea w-full"
              />
            </div>
            <button type="submit" disabled={creating} className="btn btn-primary self-start">
              {creating && <span className="loading loading-spinner loading-sm" />}
              Create course
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
