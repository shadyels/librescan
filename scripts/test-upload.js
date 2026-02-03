import axios from "axios";
import FormData from "form-data";
import fs from "fs";

async function testUpload() {
  const imagePath = "./test-image.jpg";

  // Check if test image exists
  if (!fs.existsSync(imagePath)) {
    console.error("ERROR: test-image.jpg not found in project root");
    console.error("Please add a test image file and try again");
    return;
  }

  console.log("Creating form data...");
  const form = new FormData();
  form.append("image", fs.createReadStream(imagePath));

  console.log("Sending upload request...");

  try {
    const response = await axios.post(
      "http://localhost:3000/api/upload-image",
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
      },
    );

    console.log(`Response status: ${response.status}`);
    console.log("Response data:", JSON.stringify(response.data, null, 2));

    if (response.data.success) {
      console.log("\n✅ Upload successful!");
      console.log(`Scan ID: ${response.data.scan_id}`);
      console.log(`File: ${response.data.file.filename}`);
      console.log(`Size: ${(response.data.file.size / 1024).toFixed(2)} KB`);
    } else {
      console.log("\n❌ Upload failed!");
      console.log(`Error: ${response.data.error}`);
    }
  } catch (error) {
    console.error("\n❌ Request failed!");

    if (error.response) {
      // Server responded with error status
      console.error(`Status: ${error.response.status}`);
      console.error("Response:", JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // Request made but no response
      console.error("No response received from server");
      console.error("Make sure Vercel dev is running on port 3001");
    } else {
      // Error setting up request
      console.error("Error:", error.message);
    }
  }
}

testUpload();
