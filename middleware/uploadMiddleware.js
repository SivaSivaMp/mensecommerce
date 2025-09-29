import multer from 'multer';

const storage = multer.memoryStorage(); // keep in tmp before uploading to Cloudinary
const upload = multer({ storage });

export default upload;
