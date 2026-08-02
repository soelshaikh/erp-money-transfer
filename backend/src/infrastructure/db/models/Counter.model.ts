import mongoose from 'mongoose';

const CounterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

export const CounterModel = mongoose.model('Counter', CounterSchema);
