// Load environment variables from .env file
require("dotenv").config();

// Import necessary modules
const express = require("express"); // Express framework for building web applications
const multer = require("multer"); // Middleware for handling file uploads
const cors = require("cors"); // Middleware to allow cross-origin requests
const mongoose = require("mongoose"); // MongoDB ODM (Object Data Modeling) library
const path = require("path"); // Built-in Node.js module for handling file paths
const fs = require("fs"); // File system module for handling file operations

const app = express(); // Initialize Express app
const PORT = process.env.PORT || 5001; // Define server port (default: 5001)
const CONNECTION_STRING = process.env.MONGO_URI; // MongoDB connection string from environment variables

// Ensure 'uploads/' directory exists to store uploaded files
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir); // Create directory if it does not exist
}

// Function to connect to MongoDB database
const connectToDatabase = async () => {
    try {
        await mongoose.connect(CONNECTION_STRING, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("✅ Connected to MongoDB");
    } catch (error) {
        console.error("❌ Error connecting to MongoDB:", error);
        process.exit(1); // Exit process if connection fails
    }
};
connectToDatabase(); // Call function to establish database connection

// Define a schema for storing image metadata in MongoDB
const ImageSchema = new mongoose.Schema({
    name: { type: String, required: true }, // User's name
    email: { type: String, required: true }, // User's email
    imageUrl: { type: String, required: true }, // URL of uploaded image
}, { timestamps: true, versionKey: false }); // Automatically add createdAt & updatedAt timestamps

const ImageModel = mongoose.model("Image", ImageSchema); // Create Mongoose model from schema

// Configure Multer storage settings for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, "uploads");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir); // Ensure upload directory exists
        }
        cb(null, uploadDir); // Save files in 'uploads/' directory
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Rename file with timestamp
    },
});

// File filter function to allow only image uploads
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/; // Allowed file extensions
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);
    // mimetype is a property of uploaded files in Multer, and it represents the MIME (Multipurpose Internet Mail Extensions) type of the file. This helps the server identify what type of file is being uploaded.

    if (extName && mimeType) {
        return cb(null, true); // Accept file if valid
    } else {
        return cb(new Error("Only .jpg, .jpeg, and .png files are allowed!"));
    }
};

// Initialize Multer with storage, size limit, and file filter
const upload = multer({ 
    storage, 
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
    fileFilter
});

// Middleware setup
app.use(cors()); // Enable CORS for frontend access
app.use(express.json()); // Parse incoming JSON requests
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data
app.use("/uploads", express.static(uploadDir)); // Serve uploaded files statically

// API endpoint to handle image uploads
app.post("/upload", upload.single("image"), async (req, res) => {
    const { name, email } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: "Name and email are required!" });
    }

    const existingUser = await ImageModel.findOne({ email });
    if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
    }

    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded!" });
    }

    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    try {
        const newImage = new ImageModel({ name, email, imageUrl });
        await newImage.save();
        res.json({ message: "File uploaded and saved!", name, email, imageUrl });
    } catch (error) {
        res.status(500).json({ error: "Database error", details: error.message });
    }
});


// API endpoint to fetch all uploaded images
app.get("/images", async (req, res) => {
    try {
        const images = await ImageModel.find(); // Fetch all images from database
        res.json(images); // Respond with images data
    } catch (error) {
        res.status(500).json({ error: "Database error", details: error.message }); // Handle errors
    }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
