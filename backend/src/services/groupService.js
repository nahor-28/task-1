import { pool } from '../db/pool.js';

export async function createGroup({ name, createdBy }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING id',
      [name, createdBy],
    );
    const groupId = rows[0].id;
    await client.query(
      `INSERT INTO group_members (group_id, student_id, role) VALUES ($1, $2, 'leader')`,
      [groupId, createdBy],
    );
    await client.query('COMMIT');
    return { groupId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getGroup(id) {
  const { rows } = await pool.query('SELECT id, name, created_by, created_at FROM groups WHERE id = $1', [id]);
  if (!rows[0]) return null;

  const members = await pool.query(
    `SELECT u.id, u.name, u.email, gm.role
     FROM group_members gm JOIN users u ON u.id = gm.student_id
     WHERE gm.group_id = $1 ORDER BY gm.joined_at`,
    [id],
  );
  return { ...rows[0], members: members.rows };
}

export async function listMyGroups(studentId) {
  const { rows } = await pool.query(
    `SELECT g.id, g.name
     FROM groups g JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.student_id = $1 ORDER BY g.created_at DESC`,
    [studentId],
  );
  return rows;
}

async function getMembership(groupId, studentId) {
  const { rows } = await pool.query(
    'SELECT role FROM group_members WHERE group_id = $1 AND student_id = $2',
    [groupId, studentId],
  );
  return rows[0] ?? null;
}

export async function isMemberOrGroupExists(groupId, user) {
  const group = await getGroup(groupId);
  if (!group) return { error: 'NOT_FOUND' };
  if (user.role === 'educator') return { group };
  const membership = await getMembership(groupId, user.id);
  if (!membership) return { error: 'FORBIDDEN' };
  return { group };
}

async function requireLeader(groupId, requesterId) {
  const group = await getGroup(groupId);
  if (!group) return { error: 'NOT_FOUND' };
  const membership = await getMembership(groupId, requesterId);
  if (!membership || membership.role !== 'leader') {
    return { error: 'FORBIDDEN' };
  }
  return { group };
}

export async function addMember(groupId, requesterId, studentId) {
  const leader = await requireLeader(groupId, requesterId);
  if (leader.error) return leader;

  const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [studentId]);
  if (!rows[0] || rows[0].role !== 'student') {
    return { error: 'STUDENT_NOT_FOUND' };
  }

  const existing = await getMembership(groupId, studentId);
  if (existing) {
    return { error: 'ALREADY_MEMBER' };
  }

  const { rows: inserted } = await pool.query(
    'INSERT INTO group_members (group_id, student_id) VALUES ($1, $2) RETURNING student_id',
    [groupId, studentId],
  );
  return { memberId: inserted[0].student_id };
}

export async function removeMember(groupId, requesterId, studentId) {
  const leader = await requireLeader(groupId, requesterId);
  if (leader.error) return leader;

  const existing = await getMembership(groupId, studentId);
  if (!existing) {
    return { error: 'NOT_MEMBER' };
  }

  await pool.query('DELETE FROM group_members WHERE group_id = $1 AND student_id = $2', [groupId, studentId]);
  return { success: true };
}

export async function deleteGroup(groupId, requesterId) {
  const leader = await requireLeader(groupId, requesterId);
  if (leader.error) return leader;

  await pool.query('DELETE FROM groups WHERE id = $1', [groupId]);
  return { success: true };
}
