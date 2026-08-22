import { listOpenGroups, joinGroup, confirmAllForGroup } from '../services/groupService.js';

const ERROR_RESPONSES = {
  ASSIGNMENT_NOT_FOUND: [404, 'Assignment not found'],
  FORBIDDEN: [403, 'You do not have access to this assignment'],
  GROUP_NOT_FOUND: [404, 'Group not found'],
  ALREADY_IN_GROUP: [409, 'You are already in a group for this assignment'],
  NOT_LEADER: [403, 'You must be the group leader to do this'],
};

function sendGroupError(res, code) {
  const [status, message] = ERROR_RESPONSES[code];
  res.status(status).json({ error: { message, code } });
}

export async function listGroups(req, res, next) {
  try {
    const result = await listOpenGroups(req.params.id, req.user);
    if (result.error) {
      return sendGroupError(res, result.error);
    }
    res.json(result.groups);
  } catch (err) {
    next(err);
  }
}

export async function join(req, res, next) {
  try {
    const result = await joinGroup(req.params.id, req.params.groupId, req.user.id);
    if (result.error) {
      return sendGroupError(res, result.error);
    }
    res.status(201).json({});
  } catch (err) {
    next(err);
  }
}

export async function confirmAll(req, res, next) {
  try {
    const result = await confirmAllForGroup(req.params.id, req.user.id);
    if (result.error) {
      return sendGroupError(res, result.error);
    }
    res.json({ updatedCount: result.updatedCount, notSubmittedStudentIds: result.notSubmittedStudentIds });
  } catch (err) {
    next(err);
  }
}
