import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * Ensure baseline records exist (default admin/staff users, default settings).
 * Runs on every server start.
 * Custom admin credentials can be set via ADMIN_USERNAME / ADMIN_PASSWORD env vars.
 */
export async function ensureDefaults() {
  const User = mongoose.model('User');
  const Setting = mongoose.model('Setting');

  const uname = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const pass = process.env.ADMIN_PASSWORD || 'admin123';

  let admin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
  if (!admin) {
    admin = await User.create({
      name: uname.substring(0, 1).toUpperCase() + uname.substring(1),
      username: uname,
      passwordHash: await bcrypt.hash(pass, 10),
      role: 'admin'
    });
    console.log(`Admin created (username: ${uname}). Password is at your configured value.`);
  } else if (admin.username !== uname || !(await bcrypt.compare(pass, admin.passwordHash))) {
    admin.name = uname.substring(0, 1).toUpperCase() + uname.substring(1);
    admin.username = uname;
    admin.passwordHash = await bcrypt.hash(pass, 10);
    admin.active = true;
    await admin.save();
    console.log(`Existing admin was updated to use username: ${uname}.`);
  }

  const staffCount = await User.countDocuments({ role: 'staff' });
  if (staffCount === 0) {
    await User.create({
      name: 'Staff',
      username: 'staff',
      passwordHash: await bcrypt.hash('staff123', 10),
      role: 'staff'
    });
    console.log('Default staff created (username: staff, password: staff123).');
  }

  const s = await Setting.findOne();
  if (!s) {
    await Setting.create({});
    console.log('Default settings created.');
  }
}