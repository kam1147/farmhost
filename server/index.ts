import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import fs from 'fs';
import path from 'path';
import { setupAuth } from './auth';
import { createTables } from './migrations';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add request logging middleware with better error handling
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Enhanced error handling for JSON parsing
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    try {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    } catch (error) {
      console.error('Error in JSON response:', error);
      return originalResJson.apply(res, [{ error: 'Internal Server Error' }]);
    }
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        } catch (error) {
          logLine += ' :: [Error serializing response]';
        }
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Function to find an available port with better error handling
async function findAvailablePort(startPort: number, maxTries = 10): Promise<number> {
  const net = await import('net');

  for (let port = startPort; port < startPort + maxTries; port++) {
    try {
      const server = net.createServer();
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '0.0.0.0', () => {
          server.once('close', resolve);
          server.close();
        });
      });
      return port;
    } catch (err) {
      console.error(`Port ${port} is not available:`, err);
      if (port === startPort + maxTries - 1) {
        throw new Error('No available ports found');
      }
      continue;
    }
  }
  throw new Error('No available ports found');
}

// Initialize database tables
createTables().catch(err => {
  console.error('Failed to create database tables:', err);
  process.exit(1);
});

(async () => {
  try {
    const server = registerRoutes(app);

    // Configure server timeouts
    server.keepAliveTimeout = 120000; // 2 minutes
    server.headersTimeout = 121000; // Slightly higher than keepAliveTimeout
    server.timeout = 180000; // 3 minutes

    // Global error handler with better error information
    app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error('Error:', {
        status,
        message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });

      res.status(status).json({ 
        message,
        status,
        timestamp: new Date().toISOString()
      });
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const preferredPort = Number(process.env.PORT) || 5000;
    const port = await findAvailablePort(preferredPort);

    // Enhanced connection error handling
    server.on('connection', (socket) => {
      socket.setKeepAlive(true, 30000); // Enable keep-alive with 30s initial delay
      socket.setTimeout(120000); // 2 minute timeout

      socket.on('error', (err) => {
        console.error('Socket error:', err);
      });

      socket.on('timeout', () => {
        console.log('Socket timeout detected');
        socket.end();
      });
    });

    server.listen(port, "0.0.0.0", () => {
      log(`Server ready and listening on port ${port}`);
      if (process.send) {
        process.send('ready');
      }
    });

    // Enhanced graceful shutdown
    const cleanup = async () => {
      console.log('Initiating graceful shutdown...');

      // Close the server first
      await new Promise<void>((resolve) => {
        server.close(() => {
          console.log('Server closed');
          resolve();
        });
      });

      // Then close the database pool
      try {
        const { pool } = require('./db');
        await pool.end();
        console.log('Database pool closed');
      } catch (error) {
        console.error('Error closing database pool:', error);
      }

      process.exit(0);
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();