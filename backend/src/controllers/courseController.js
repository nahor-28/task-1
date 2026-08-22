import {
  createCourse,
  listMine,
  listActive,
  getCourseDetail,
  enrollStudent,
  updateCourse,
} from '../services/courseService.js';

const ERROR_RESPONSES = {
  NOT_FOUND: [404, 'Course not found'],
  FORBIDDEN: [403, 'You do not own this course'],
  NOT_ENROLLED: [403, 'You must be enrolled to view this course'],
  ALREADY_ENROLLED: [409, 'Already enrolled in this course'],
  COURSE_INACTIVE: [409, 'This course is not open for enrollment'],
};

function sendCourseError(res, code) {
  const [status, message] = ERROR_RESPONSES[code];
  res.status(status).json({ error: { message, code } });
}

export async function create(req, res, next) {
  try {
    const { courseId } = await createCourse({ ...req.body, createdBy: req.user.id });
    res.status(201).json({ courseId });
  } catch (err) {
    next(err);
  }
}

export async function mine(req, res, next) {
  try {
    res.json(await listMine(req.user));
  } catch (err) {
    next(err);
  }
}

export async function browse(req, res, next) {
  try {
    res.json(await listActive());
  } catch (err) {
    next(err);
  }
}

export async function detail(req, res, next) {
  try {
    const result = await getCourseDetail(req.params.id, req.user);
    if (result.error) {
      return sendCourseError(res, result.error);
    }
    res.json(result.course);
  } catch (err) {
    next(err);
  }
}

export async function enroll(req, res, next) {
  try {
    const result = await enrollStudent(req.params.id, req.user.id);
    if (result.error) {
      return sendCourseError(res, result.error);
    }
    res.status(201).json({});
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const result = await updateCourse(req.params.id, req.user.id, req.body);
    if (result.error) {
      return sendCourseError(res, result.error);
    }
    res.json(result.course);
  } catch (err) {
    next(err);
  }
}
