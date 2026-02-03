import { IncomingForm } from 'formidable'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  const form = new IncomingForm({
    uploadDir: '/tmp',
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024,
  })

  return new Promise((resolve) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error('Form parse error:', err)
        res.status(400).json({
          success: false,
          error: err.message
        })
        return resolve()
      }

      const uploadedFile = files.image?.[0] || files.image

      if (!uploadedFile) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded'
        })
        return resolve()
      }

      const scanId = uuidv4()
      
      res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        scan_id: scanId,
        file: {
          filename: path.basename(uploadedFile.filepath),
          size: uploadedFile.size,
          mimetype: uploadedFile.mimetype
        }
      })
      resolve()
    })
  })
}