import dotenv from 'dotenv';
import app from './app.js';
import { connectDB } from './config/db.js';
import { seedSuperAdmin, seedGroups } from './config/seed.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    await seedGroups();
    await seedSuperAdmin();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
  }
};

startServer();