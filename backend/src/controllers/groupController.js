import {
  createGroup,
  isMemberOrGroupExists,
  listMyGroups,
  addMember,
  removeMember,
  deleteGroup,
} from '../services/groupService.js';

const ERROR_RESPONSES = {
  NOT_FOUND: [404, 'Group not found'],
  FORBIDDEN: [403, 'You must be the group leader to do this'],
  STUDENT_NOT_FOUND: [404, 'Student not found'],
  ALREADY_MEMBER: [409, 'Student is already a member of this group'],
  NOT_MEMBER: [404, 'Student is not a member of this group'],
};

function sendGroupError(res, code) {
  const [status, message] = ERROR_RESPONSES[code];
  res.status(status).json({ error: { message, code } });
}

export async function create(req, res, next) {
  try {
    const { groupId } = await createGroup({ name: req.body.name, createdBy: req.user.id });
    res.status(201).json({ groupId });
  } catch (err) {
    next(err);
  }
}

export async function detail(req, res, next) {
  try {
    const result = await isMemberOrGroupExists(req.params.id, req.user);
    if (result.error) {
      return sendGroupError(res, result.error);
    }
    res.json(result.group);
  } catch (err) {
    next(err);
  }
}

export async function mine(req, res, next) {
  try {
    res.json(await listMyGroups(req.user.id));
  } catch (err) {
    next(err);
  }
}

export async function addMemberHandler(req, res, next) {
  try {
    const result = await addMember(req.params.id, req.user.id, req.body.studentId);
    if (result.error) {
      return sendGroupError(res, result.error);
    }
    res.status(201).json({ memberId: result.memberId });
  } catch (err) {
    next(err);
  }
}

export async function removeMemberHandler(req, res, next) {
  try {
    const result = await removeMember(req.params.id, req.user.id, req.params.studentId);
    if (result.error) {
      return sendGroupError(res, result.error);
    }
    res.json({});
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await deleteGroup(req.params.id, req.user.id);
    if (result.error) {
      return sendGroupError(res, result.error);
    }
    res.json({});
  } catch (err) {
    next(err);
  }
}
