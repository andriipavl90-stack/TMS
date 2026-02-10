// import dotenv from 'dotenv';
// import app from './app.js';
// import { connectDB } from './config/db.js';
// import { seedSuperAdmin } from './config/seed.js';

// dotenv.config();

// const PORT = process.env.PORT || 3000;

// // Connect to database and seed
// const startServer = async () => {
//   try {
//     // Connect to database
//     await connectDB();
    
//     // Seed super admin if no users exist
//     await seedSuperAdmin();
    
//     // Start server
//     app.listen(PORT, () => {
//       console.log(`🚀 Server running on http://localhost:${PORT}`);
//       console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
//     });
//   } catch (error) {
//     console.error('❌ Failed to start server:', error);
//     process.exit(1);
//   }
// };

// startServer();

import dotenv from 'dotenv';
import app from './app.js';
import { connectDB } from './config/db.js';
import { seedSuperAdmin } from './config/seed.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
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
