const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');

    // Check if admin already exists
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      console.log('Admin user already exists:', adminExists.email);
      process.exit(0);
    }

    // Create default admin
    const defaultAdmin = new User({
      username: 'admin',
      email: 'admin@busylayout.com',
      password: 'admin123',
      role: 'admin'
    });

    await defaultAdmin.save();
    console.log('✅ Default admin created successfully!');
    console.log('Email: admin@busylayout.com');
    console.log('Password: admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
};

createAdmin();