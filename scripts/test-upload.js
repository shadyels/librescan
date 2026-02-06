import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';

const API_URL = 'http://localhost:3000/api/upload-image';
// Use process.cwd() to correctly locate the file in the project root
const IMAGE_PATH = path.join(process.cwd(), 'test-image.jpg');

async function testUpload() {
  console.log('🚀 Starting Upload Test...');

  if (!fs.existsSync(IMAGE_PATH)) {
    console.error(`❌ Error: Test image not found at ${IMAGE_PATH}`);
    process.exit(1);
  }

  try {
    const form = new FormData();
    
    // FIX: Read file as a Buffer instead of a Stream
    // This allows form-data to calculate the Content-Length automatically,
    // preventing the "Transfer-Encoding: chunked" error in Vercel.
    const fileBuffer = fs.readFileSync(IMAGE_PATH);
    
    form.append('image', fileBuffer, {
      filename: 'test-image.jpg',
      contentType: 'image/jpeg',
    });
    
    form.append('device_id', '361ae423-0fc4-41e4-8bc9-465552e7abf0');

    console.log(`📸 Uploading ${path.basename(IMAGE_PATH)} (${fileBuffer.length} bytes)...`);

    const response = await fetch(API_URL, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(), // Still required for boundary
    });

    // Handle response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      
      if (response.ok) {
        console.log('\n✅ TEST PASSED!');
        console.log('--------------------------------------------------');
        console.log(`Scan ID:   ${data.scan_id}`);
        console.log(`Books:     ${data.recognized_books?.books?.length || 0} found`);
        console.log('--------------------------------------------------');
      } else {
        console.error('\n❌ Server Error:', data);
      }
    } else {
      console.error(`\n❌ Unexpected Response: ${response.status} ${response.statusText}`);
      console.error(await response.text());
    }

  } catch (error) {
    console.error('\n❌ Script Error:', error.message);
  }
}

testUpload();