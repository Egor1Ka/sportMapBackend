import mongoose from "mongoose";
import ScheduleOverride from "../models/ScheduleOverride.js";
import User from "../modules/user/model/User.js";

const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/myDatabase";

const run = async () => {
  await mongoose.connect(DB_URL);
  const all = await ScheduleOverride.find({}).lean();
  console.log(`Total overrides in DB: ${all.length}`);
  for (const o of all) {
    const user = await User.findById(o.staffId).lean().catch(() => null);
    console.log(JSON.stringify({
      _id: o._id.toString(),
      staffId: o.staffId.toString(),
      staffName: user ? user.name : null,
      staffEmail: user ? user.email : null,
      orgId: o.orgId ? o.orgId.toString() : null,
      locationId: o.locationId ? o.locationId.toString() : null,
      date: o.date,
      enabled: o.enabled,
      slots: o.slots,
      reason: o.reason,
    }, null, 2));
  }
  await mongoose.disconnect();
};
run().catch((e) => { console.error(e); process.exit(1); });
