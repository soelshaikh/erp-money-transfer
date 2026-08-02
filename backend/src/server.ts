import http from 'http';
import mongoose from 'mongoose';
import { Server as SocketServer } from 'socket.io';
import env from './config/env';
import logger from './config/logger';
import buildContainer from './container';
import createApp from './app';
import DeviceSessionModel from './infrastructure/db/models/DeviceSession.model';
import { DEVICE_STATUS } from './config/constants';

async function start() {
  // Connect to MongoDB Atlas
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  logger.info('MongoDB connected');

  // Create HTTP server + Socket.IO
  const httpServer = http.createServer();
  const io = new SocketServer(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket'],
  });

  // Wire all dependencies
  const container = buildContainer(io);
  const app = createApp(container);
  httpServer.on('request', app);

  // Socket.IO — join users to their rooms on connect; re-check session status on every connect/reconnect
  io.on('connection', async (socket) => {
    const { tenantId, userId, role, branchId, deviceId } = socket.handshake.auth;
    if (!tenantId || !userId) {
      socket.disconnect(true);
      return;
    }

    // If the device sends its deviceId, verify the session is still approved.
    // This fires on every reconnect, catching suspensions that happened while offline.
    if (deviceId) {
      try {
        const session = await DeviceSessionModel.findOne(
          { tenantId, userId, deviceId },
          'status',
        ).lean();
        if (session?.status === DEVICE_STATUS.SUSPENDED) {
          socket.emit('force_logout');
          socket.disconnect(true);
          return;
        }
      } catch (err) {
        logger.warn({ err, userId }, 'Device session check failed on socket connect');
      }
    }

    socket.join(`tenant:${tenantId}`);
    socket.join(`${tenantId}:role:${role}`);
    socket.join(`${tenantId}:user:${userId}`);
    if (branchId) socket.join(`${tenantId}:branch:${branchId}`);
    logger.debug({ userId, role, tenantId, deviceId }, 'Socket connected');

    socket.on('disconnect', () => {
      logger.debug({ userId }, 'Socket disconnected');
    });
  });

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, `Server listening`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully');
    httpServer.close(async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
      process.exit(0);
    });
    // Force exit after 10s if connections don't drain
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
