import { unlink } from 'node:fs/promises';
import {
  createAssignment,
  listAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
  setAttachment,
} from '../services/assignmentService.js';

const ERROR_RESPONSES = {
  NOT_FOUND: [404, 'Assignment not found'],
  FORBIDDEN: [403, 'You do not own this assignment'],
  HAS_SUBMISSIONS: [409, 'Cannot delete an assignment with existing submissions - archive instead'],
};

function sendAssignmentError(res, code) {
  const [status, message] = ERROR_RESPONSES[code];
  res.status(status).json({ error: { message, code } });
}

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
      return sendAssignmentError(res, 'NOT_FOUND');
    }
    res.json(assignment);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const result = await updateAssignment(req.params.id, req.user.id, req.body);
    if (result.error) {
      return sendAssignmentError(res, result.error);
    }
    res.json(result.assignment);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await deleteAssignment(req.params.id, req.user.id);
    if (result.error) {
      return sendAssignmentError(res, result.error);
    }
    res.json({});
  } catch (err) {
    next(err);
  }
}

export async function attachment(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: { message: 'No file uploaded', code: 'VALIDATION_ERROR' },
      });
    }

    const result = await setAttachment(req.params.id, req.user.id, `/uploads/${req.file.filename}`);
    if (result.error) {
      await unlink(req.file.path).catch(() => {});
      return sendAssignmentError(res, result.error);
    }

    res.json({ attachmentUrl: result.attachmentUrl });
  } catch (err) {
    next(err);
  }
}
