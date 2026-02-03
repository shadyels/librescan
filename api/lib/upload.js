import multer from 'multer'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

/**
 * Configure multer storage
 * Files are saved to /tmp directory with unique names
 */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // /tmp is the only writable directory in Vercel serverless
    cb(null, '/tmp')
  },
  filename: function (req, file, cb) {
    // Generate unique filename: uuid + original extension
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  }
})

/**
 * File filter to only accept images
 * Validates file type before saving
 */
const fileFilter = function (req, file, cb) {
  // Allowed MIME types
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic']
  
  if (allowedTypes.includes(file.mimetype)) {
    // Accept file
    cb(null, true)
  } else {
    // Reject file with error
    cb(new Error(`Invalid file type. Only JPEG, PNG, and HEIC are allowed. Received: ${file.mimetype}`), false)
  }
}

/**
 * Create multer upload instance with configuration
 */
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB in bytes
  }
})

export default upload