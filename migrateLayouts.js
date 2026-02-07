const mongoose = require('mongoose');
const Layout = require('./models/Layout');
const User = require('./models/User');
require('dotenv').config();

const migrateLayouts = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');

    // Find admin user to assign as creator for existing layouts
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('No admin user found. Please create an admin user first.');
      process.exit(1);
    }

    // Update all layouts without createdBy field
    const result = await Layout.updateMany(
      { createdBy: { $exists: false } },
      { $set: { createdBy: adminUser._id } }
    );

    console.log(`✅ Migration completed!`);
    console.log(`Updated ${result.modifiedCount} layouts with createdBy field`);
    console.log(`Assigned to admin user: ${adminUser.username} (${adminUser.email})`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrateLayouts();