import mongoose from "mongoose";
import Booking from "../models/Booking.js";

const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/myDatabase";

const formatBooking = (b) => {
  const startAt = b.startAt ? new Date(b.startAt) : null;
  const endAt = b.endAt ? new Date(b.endAt) : null;
  const durationMin = startAt && endAt ? (endAt.getTime() - startAt.getTime()) / 60000 : null;
  return {
    _id: b._id.toString(),
    status: b.status,
    paymentStatus: b.payment?.status,
    amount: b.payment?.amount,
    startAt: startAt ? startAt.toISOString() : null,
    endAt: endAt ? endAt.toISOString() : null,
    durationMin,
    timezone: b.timezone,
    eventTypeId: b.eventTypeId ? b.eventTypeId.toString() : null,
    hosts: (b.hosts || []).map((h) => ({ userId: h.userId.toString(), role: h.role })),
    orgId: b.orgId ? b.orgId.toString() : null,
    createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
  };
};

const run = async () => {
  await mongoose.connect(DB_URL);

  const total = await Booking.countDocuments();
  console.log(`\n=== TOTAL BOOKINGS: ${total} ===\n`);

  const recent = await Booking.find({}).sort({ createdAt: -1 }).limit(10).lean();
  console.log(`=== LAST ${recent.length} BOOKINGS (by createdAt desc) ===`);
  recent.map(formatBooking).forEach((b) => console.log(b));

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
