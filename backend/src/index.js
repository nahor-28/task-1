import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import assignmentsRouter from './routes/assignments.js';
import groupsRouter from './routes/groups.js';
import submissionsRouter from './routes/submissions.js';
import reportsRouter from './routes/reports.js';

const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_ORIGIN }));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/assignments', assignmentsRouter);
app.use('/api/v1/groups', groupsRouter);
app.use('/api/v1/submissions', submissionsRouter);
app.use('/api/v1/reports', reportsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
