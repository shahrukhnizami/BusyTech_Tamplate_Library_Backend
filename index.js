const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Layout = require('./models/Layout');
const User = require('./models/User');
const authRoutes = require('./routes/auth');
const { authenticateToken, requireAdmin } = require('./middleware/auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Simple CORS configuration
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Other middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root route
app.get('/library', (req, res) => {
  res.send('Server is running');
});

// Serve static files
app.use('/library/uploads', express.static(path.join(__dirname, 'uploads')));

// Download route with forced download headers
app.get('/library/api/download/:filename', cors('*'), (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'uploads', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Extract original filename (remove timestamp prefix)
    const originalName = filename.replace(/^\d+-/, '');
    
    // Set headers to force download
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // Send file
    res.download(filePath, originalName);
  } catch (error) {
    console.error('Download Error:', error);
    res.status(500).json({ message: 'Download failed' });
  }
});

// Auth routes
app.use('/library/api/auth', cors('*'), authRoutes);

// Create default admin user if none exists
const createDefaultAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const defaultAdmin = new User({
        username: 'admin',
        email: 'admin@busylayout.com',
        password: 'admin123',
        role: 'admin'
      });
      await defaultAdmin.save();
      console.log('Default admin created: admin@busylayout.com / admin123');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
};

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/busy_layout')
  .then(() => {
    console.log('MongoDB Connected');
    createDefaultAdmin();
  })
  .catch(err => console.error('MongoDB Connection Error:', err));

// Multer Setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Clean filename and add timestamp
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, Date.now() + '-' + originalName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Routes

// Upload Layout/Section (Authenticated users)
app.post('/library/api/upload', cors('*'), authenticateToken, upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'file', maxCount: 10 }]), async (req, res) => {
  try {
    const { title, type, description } = req.body;
    
    let techStack = req.body.techStack || [];
    if (techStack && !Array.isArray(techStack)) {
      techStack = [techStack];
    }

    if (!req.files || !req.files['thumbnail'] || !req.files['file']) {
      return res.status(400).json({ message: 'Thumbnail and File are required' });
    }

    const thumbnailPath = req.files['thumbnail'][0].filename;
    // Map all files to their filenames
    const filePaths = req.files['file'].map(file => file.filename);

    const newLayout = new Layout({
      title,
      type,
      description,
      techStack,
      thumbnail: thumbnailPath,
      file: filePaths,
      createdBy: req.user._id
    });

    await newLayout.save();
    res.status(201).json({ message: 'Upload successful', data: newLayout });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Fetch All Layouts/Sections (Authenticated users)
app.get('/library/api/layouts', cors('*'),authenticateToken, async (req, res) => {
  try {
    const { type } = req.query;
    let query = {};
    if (type && type !== 'All' && type !== 'Archive') {
      query.type = type;
      query.archived = false;
    } else if (type === 'Archive') {
      query.archived = true;
    } else {
      query.archived = false;
    }
    
    const layouts = await Layout.find(query)
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 });
    res.status(200).json(layouts);
  } catch (error) {
    console.error('Fetch Error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Fetch Single Layout/Section by ID (Authenticated users)
app.get('/library/api/layouts/:id', cors('*'), authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const layout = await Layout.findById(id).populate('createdBy', 'username email');
    
    if (!layout) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    res.status(200).json(layout);
  } catch (error) {
    console.error('Fetch Single Item Error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Fetch Only Archived Items (Authenticated users)
app.get('/library/api/archived', cors('*'), authenticateToken, async (req, res) => {
  try {
    const archivedLayouts = await Layout.find({ archived: true })
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 });
    res.status(200).json(archivedLayouts);
  } catch (error) {
    console.error('Fetch Archived Items Error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Update Layout/Section (Admin only)
app.patch('/library/api/layouts/:id', cors('*'), authenticateToken, requireAdmin, upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'file', maxCount: 10 }]), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, description, category, techStack } = req.body;

    const updateData = {
      title,
      type,
      description,
      category: category || 'General',
      techStack: techStack || []
    };

    // Handle new thumbnail if uploaded
    if (req.files && req.files['thumbnail']) {
      updateData.thumbnail = req.files['thumbnail'][0].filename;
    }

    // Handle new files if uploaded
    if (req.files && req.files['file']) {
      updateData.file = req.files['file'].map(file => file.filename);
    }

    const updatedLayout = await Layout.findByIdAndUpdate(id, updateData, { new: true })
      .populate('createdBy', 'username email');

    if (!updatedLayout) {
      return res.status(404).json({ message: 'Layout not found' });
    }

    res.status(200).json({ message: 'Layout updated successfully', data: updatedLayout });
  } catch (error) {
    console.error('Update Layout Error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Archive a layout/section (Authenticated users)
app.patch('/library/api/layouts/:id/archive', cors('*'), authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Layout.findByIdAndUpdate(id, { archived: true }, { new: true });
    if (!updated) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.status(200).json({ message: 'Item archived', data: updated });
  } catch (error) {
    console.error('Archive Error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Restore a layout/section (Authenticated users)
app.patch('/library/api/layouts/:id/restore', cors('*'), authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Layout.findByIdAndUpdate(id, { archived: false }, { new: true });
    if (!updated) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.status(200).json({ message: 'Item restored', data: updated });
  } catch (error) {
    console.error('Restore Error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Permanently delete a layout/section (Admin only)
app.delete('/library/api/layouts/:id/permanent', cors('*'), authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the layout first to get file paths
    const layout = await Layout.findById(id);
    if (!layout) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Delete files from filesystem
    try {
      // Delete thumbnail
      if (layout.thumbnail) {
        const thumbnailPath = path.join(__dirname, 'uploads', layout.thumbnail);
        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
        }
      }

      // Delete all files
      if (layout.file && Array.isArray(layout.file)) {
        layout.file.forEach(filename => {
          const filePath = path.join(__dirname, 'uploads', filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
      }
    } catch (fileError) {
      console.error('Error deleting files:', fileError);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await Layout.findByIdAndDelete(id);
    
    res.status(200).json({ message: 'Item permanently deleted' });
  } catch (error) {
    console.error('Permanent Delete Error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS enabled: All origins allowed`);
});