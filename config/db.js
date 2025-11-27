import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const connectB = async () => {
    try {
        if (!process.env.DATABASE) {
            throw new Error('MONGODB URI is not defined in the env');
        }

        await mongoose.connect(process.env.DATABASE, {
            serverSelectionTimeoutMS: 5000,
        });

        console.log('Connected to MongoDB Atlas');
    } catch (error) {
        console.error('DB connection error:', error);
        process.exit(1);
    }
};
export default connectB;
