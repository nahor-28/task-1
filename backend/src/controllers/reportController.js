import { getStudentReport, getGroupReport, getDashboard } from '../services/reportService.js';

const ERROR_RESPONSES = {
  NOT_FOUND: [404, 'Group not found'],
  FORBIDDEN: [403, 'Forbidden'],
};

function sendReportError(res, code) {
  const [status, message] = ERROR_RESPONSES[code];
  res.status(status).json({ error: { message, code } });
}

export async function get(req, res, next) {
  try {
    const { studentId, groupId } = req.query;
    const result = studentId
      ? await getStudentReport(studentId, req.user)
      : await getGroupReport(groupId, req.user);

    if (result.error) {
      return sendReportError(res, result.error);
    }
    res.json(result.report);
  } catch (err) {
    next(err);
  }
}

export async function dashboard(req, res, next) {
  try {
    res.json(await getDashboard(req.user.id));
  } catch (err) {
    next(err);
  }
}
