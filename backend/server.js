require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const connectDB = require('./src/config/database');
const { setIo } = require('./src/services/notification.service');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
    },
  });

  // Inject io into notification service
  setIo(io);

  io.on('connection', (socket) => {
    // Client joins their personal room after login
    socket.on('join', (userId) => {
      socket.join(`user:${userId}`);
    });

    socket.on('disconnect', () => {});
  });

  httpServer.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
