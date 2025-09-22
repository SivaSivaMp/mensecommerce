import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const connectB = async () => {
    try {
        await mongoose.connect(process.env.DATABASE_LOCAL);
        if (!process.env.DATABASE_LOCAL) {
            throw new Error('MONGODB URI notdefined in the env');
        }
        console.log('Database connected succesfully');
    } catch (error) {
        console.log('Error while connecting to database :', error);
        process.exit(1);
    }
};
export default connectB;
