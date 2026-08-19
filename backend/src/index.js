import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import assignmentsRouter from './routes/assignments.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_ORIGIN }));
app.use(express.json());

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/assignments', assignmentsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
