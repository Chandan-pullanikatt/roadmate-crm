require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const connectDB = require('./config/db');
const { verifyToken } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const User = require('./models/User');

const authRouter = require('./routes/auth');
const leadsRouter = require('./routes/leads');
const attendanceRouter = require('./routes/attendance');
const leaveRouter = require('./routes/leave');
const dashboardRouter = require('./routes/dashboard');
const usersRouter = require('./routes/users');
const statsRouter = require('./routes/stats');


const initCronJobs = require('./scripts/cronJobs');

const app = express();
const server = http.createServer(app);

// Connect to Database
connectDB();

// Middleware
app.use(helmet());
app.use(cors({ 
  origin: [
    process.env.CLIENT_URL, 
    'http://localhost:5173', 
    'http://localhost:5175',
    'http://localhost:5174',
    'https://roadmate-crm.netlify.app'
  ].filter(Boolean), 
  credentials: true 
}));
app.use(morgan('dev'));
app.use(express.json());

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL, 
      'http://localhost:5173', 
      'http://localhost:5175',
      'http://localhost:5174',
      'https://roadmate-crm.netlify.app'
    ].filter(Boolean),
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.set('io', io);

// Init Cron Jobs — must run after io is created so the sweep cron can send notifications
initCronJobs(io);

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Health Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/leave', leaveRouter);
app.use('/api/leaves', leaveRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/users', usersRouter);
app.use('/api/stats', statsRouter);
app.use('/api/search', require('./routes/search'));
app.use('/api/targets', require('./routes/targets'));

app.use('/api/upload', require('./routes/upload'));
app.use('/api/config', require('./routes/config'));
app.use('/api/notifications', require('./routes/notifications'));

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
