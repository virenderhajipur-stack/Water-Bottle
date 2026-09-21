import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
    active: { type: Boolean, default: true },
    lastLogin: { type: Date }
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    name: this.name,
    username: this.username,
    role: this.role,
    active: this.active,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt
  };
};

export default mongoose.model('User', userSchema);