import mongoose from 'mongoose';
const counterSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    seq: {
        type: Number,
    },
});

const Counter = mongoose.model('Counter', counterSchema);
export default Counter;
