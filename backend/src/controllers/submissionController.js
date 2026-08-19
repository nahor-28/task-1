import { listForAssignment, getMine, submit, confirm } from '../services/submissionService.js';

const ERROR_RESPONSES = {
  ASSIGNMENT_NOT_FOUND: [404, 'Assignment not found'],
  SUBMISSION_NOT_FOUND: [404, 'Submission not found'],
  FORBIDDEN: [403, 'Forbidden'],
  INVALID_STATE: [409, 'Submission is not in the expected state for this action'],
};

function sendSubmissionError(res, code) {
  const [status, message] = ERROR_RESPONSES[code];
  res.status(status).json({ error: { message, code } });
}

export async function list(req, res, next) {
  try {
    const result = await listForAssignment(req.query.assignmentId, req.user.id);
    if (result.error) {
      return sendSubmissionError(res, result.error);
    }
    res.json(result.submissions);
  } catch (err) {
    next(err);
  }
}

export async function mine(req, res, next) {
  try {
    const result = await getMine(req.query.assignmentId, req.user.id);
    if (result.error) {
      return sendSubmissionError(res, result.error);
    }
    res.json(result.submission);
  } catch (err) {
    next(err);
  }
}

export async function submitHandler(req, res, next) {
  try {
    const result = await submit(req.params.id, req.user.id);
    if (result.error) {
      return sendSubmissionError(res, result.error);
    }
    res.json({ status: result.status });
  } catch (err) {
    next(err);
  }
}

export async function confirmHandler(req, res, next) {
  try {
    const result = await confirm(req.params.id, req.user.id);
    if (result.error) {
      return sendSubmissionError(res, result.error);
    }
    res.json({ status: result.status });
  } catch (err) {
    next(err);
  }
}
