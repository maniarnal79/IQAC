require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const evidenceRoutes = require('./src/routes/evidenceRoutes');

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const io = new Server(server, {
  cors: corsOptions,
});

app.set('io', io);

const PORT = process.env.PORT || 5000;

app.use('/api', cors(corsOptions));
app.use(express.json());

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/evidence', evidenceRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'IQAC API is running' });
});

io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    (typeof socket.handshake.headers.authorization === 'string'
      ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
      : null);

  if (!token) {
    return next();
  }

  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  if (!socket.user) {
    return;
  }

  socket.join(`user:${socket.user.id}`);

  if (socket.user.role === 'student') {
    socket.join('students');
  }

  if (socket.user.role === 'faculty') {
    socket.join('faculty');
    socket.join('iqac');
  }

  if (socket.user.role === 'iqac_admin') {
    socket.join('iqac');
  }

  socket.on('join', (room) => {
    if (typeof room !== 'string') return;
    if (room === `user:${socket.user.id}`) {
      socket.join(room);
    }
    if (room === 'students' && socket.user.role === 'student') {
      socket.join('students');
    }
    if (room === 'faculty' && socket.user.role === 'faculty') {
      socket.join('faculty');
    }
    if (
      room === 'iqac' &&
      (socket.user.role === 'iqac_admin' || socket.user.role === 'faculty')
    ) {
      socket.join('iqac');
    }
  });

  socket.on('trigger_pulse_survey', (payload = {}) => {
    if (socket.user.role !== 'iqac_admin') return;
    const audience =
      payload.audience === 'Faculty' || payload.audience === 'faculty'
        ? 'faculty'
        : 'students';
    io.to(audience).emit('pulse_survey', {
      audience,
      template: payload.template,
      triggeredAt: new Date().toISOString(),
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
