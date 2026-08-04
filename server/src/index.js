require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const { verifyToken } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

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

// Global API rate limiter — 300 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' },
});

// Middleware
app.use(helmet());
app.use('/api/', apiLimiter);
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
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));

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
app.use('/api/tasks',   require('./routes/tasks'));

app.use('/api/upload', require('./routes/upload'));
app.use('/api/config', require('./routes/config'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/sop', require('./routes/sop'));

// Global Error Handler
app.use(errorHandler);

// Fail fast if a lead status exists that no dashboard bucket counts.
const { assertGroupsCoverEnum } = require('./constants/leadStatusGroups');
assertGroupsCoverEnum(require('./models/Lead').schema.path('status').enumValues);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
