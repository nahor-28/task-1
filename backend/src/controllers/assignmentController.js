import {
  createAssignment,
  listAssignments,
  getAssignment,
  updateAssignment,
} from '../services/assignmentService.js';

export async function create(req, res, next) {
  try {
    const { assignmentId } = await createAssignment({
      ...req.body,
      createdBy: req.user.id,
    });
    res.status(201).json({ assignmentId });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    res.json(await listAssignments(req.user));
  } catch (err) {
    next(err);
  }
}

export async function detail(req, res, next) {
  try {
    const assignment = await getAssignment(req.params.id);
    if (!assignment) {
      return res.status(404).json({
        error: { message: 'Assignment not found', code: 'NOT_FOUND' },
      });
    }
    res.json(assignment);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const result = await updateAssignment(req.params.id, req.user.id, req.body);

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({
        error: { message: 'Assignment not found', code: 'NOT_FOUND' },
      });
    }
    if (result.error === 'FORBIDDEN') {
      return res.status(403).json({
        error: { message: 'You do not own this assignment', code: 'FORBIDDEN' },
      });
    }

    res.json(result.assignment);
  } catch (err) {
    next(err);
  }
}
