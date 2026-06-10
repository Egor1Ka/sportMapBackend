import mongoose from "mongoose";
import User from "../modules/user/model/User.js";
import Membership from "../models/Membership.js";
import Organization from "../models/Organization.js";

const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/myDatabase";

const formatUser = (u) => ({
  _id:            u._id.toString(),
  name:           u.name,
  email:          u.email,
  telegramChatId: u.telegramChatId || null,
});

const formatMembership = (m) => ({
  userId:   m.userId.toString(),
  orgId:    m.orgId.toString(),
  role:     m.role,
  status:   m.status,
});

const run = async () => {
  await mongoose.connect(DB_URL);

  const users = await User.find({}).select("_id name email telegramChatId").lean();
  console.log(`\n=== USERS (${users.length}) ===`);
  users.map(formatUser).forEach((u) => console.log(u));

  const orgs = await Organization.find({}).select("_id name").lean();
  console.log(`\n=== ORGS (${orgs.length}) ===`);
  orgs.forEach((o) => console.log({ _id: o._id.toString(), name: o.name }));

  const memberships = await Membership.find({ status: "active", role: { $in: ["owner", "admin"] } }).lean();
  console.log(`\n=== ACTIVE OWNER/ADMIN MEMBERSHIPS (${memberships.length}) ===`);
  memberships.map(formatMembership).forEach((m) => console.log(m));

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
