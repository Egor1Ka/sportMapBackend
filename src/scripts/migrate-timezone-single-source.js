import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.DB_URL);
  console.log("Connected to MongoDB");

  const result = await mongoose.connection.db.collection("scheduletemplates").updateMany(
    { orgId: { $ne: null } },
    { $unset: { timezone: "" } }
  );

  console.log(`Updated ${result.modifiedCount} org schedule templates (removed timezone field)`);

  const remaining = await mongoose.connection.db.collection("scheduletemplates").countDocuments({
    orgId: { $ne: null },
    timezone: { $exists: true },
  });
  console.log(`Remaining org templates with timezone: ${remaining} (should be 0)`);

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
