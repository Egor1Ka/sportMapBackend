import crypto from "crypto";
import mongoose from "mongoose";

import User from "../modules/user/model/User.js";
import Organization from "../models/Organization.js";
import Position from "../models/Position.js";
import Location from "../models/Location.js";
import Membership from "../models/Membership.js";
import EventType from "../models/EventType.js";
import ScheduleTemplate from "../models/ScheduleTemplate.js";
import Booking from "../models/Booking.js";
import Invitee from "../models/Invitee.js";

const DB_URI = "mongodb://localhost:27017/myDatabase";

// ---------------------------------------------------------------------------
// Pure data builders
// ---------------------------------------------------------------------------

const buildOrganizationData = () => ({
  name: "Барбершоп Чемпіон",
  timezone: "Europe/Kyiv",
  settings: {
    defaultCountry: "UA",
    brandColor: "#1a1a2e",
  },
});

const buildLocationData = (orgId) => ({
  orgId,
  name: "Центр",
  address: {
    street: "вул. Хрещатик 22",
    city: "Київ",
    country: "UA",
  },
  timezone: "Europe/Kyiv",
  active: true,
});

const buildPositionsData = (orgId) => [
  { orgId, name: "Senior Barber", level: 2, color: "#8B5CF6", active: true },
  { orgId, name: "Barber", level: 1, color: "#06B6D4", active: true },
  { orgId, name: "Junior Barber", level: 0, color: "#F59E0B", active: true },
];

const buildUsersData = () => [
  {
    name: "Іван Петров",
    email: "ivan@champion-barber.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ivan",
  },
  {
    name: "Олексій Коваленко",
    email: "oleksiy@champion-barber.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Oleksiy",
  },
  {
    name: "Дмитро Шевченко",
    email: "dmytro@champion-barber.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Dmytro",
  },
  {
    name: "Анна Тренер",
    email: "trainer@example.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Anna",
  },
];

const buildMembershipsData = (users, orgId, positions, locationId) => {
  const [ivan, oleksiy, dmytro] = users;
  const [seniorBarber, barber, juniorBarber] = positions;

  return [
    {
      userId: ivan._id,
      orgId,
      role: "owner",
      positionId: seniorBarber._id,
      locationIds: [locationId],
      status: "active",
    },
    {
      userId: oleksiy._id,
      orgId,
      role: "member",
      positionId: barber._id,
      locationIds: [locationId],
      status: "active",
    },
    {
      userId: dmytro._id,
      orgId,
      role: "member",
      positionId: juniorBarber._id,
      locationIds: [locationId],
      status: "active",
    },
  ];
};

const buildOrgEventTypesData = (orgId) => [
  {
    userId: null,
    orgId,
    slug: "haircut",
    name: "Стрижка",
    durationMin: 60,
    type: "org",
    staffPolicy: "any",
    active: true,
    color: "#8B5CF6",
    price: { amount: 500, currency: "uah" },
    bufferAfter: 15,
    minNotice: 60,
    slotStepMin: 30,
  },
  {
    userId: null,
    orgId,
    slug: "coloring",
    name: "Фарбування",
    durationMin: 120,
    type: "org",
    staffPolicy: "any",
    active: true,
    color: "#EC4899",
    price: { amount: 1200, currency: "uah" },
    bufferAfter: 15,
    minNotice: 120,
    slotStepMin: 30,
  },
  {
    userId: null,
    orgId,
    slug: "styling",
    name: "Укладка",
    durationMin: 45,
    type: "org",
    staffPolicy: "any",
    active: true,
    color: "#06B6D4",
    price: { amount: 350, currency: "uah" },
    bufferAfter: 10,
    minNotice: 60,
    slotStepMin: 15,
  },
  {
    userId: null,
    orgId,
    slug: "beard-trim",
    name: "Стрижка бороди",
    durationMin: 30,
    type: "org",
    staffPolicy: "any",
    active: true,
    color: "#F59E0B",
    price: { amount: 300, currency: "uah" },
    bufferAfter: 10,
    minNotice: 30,
    slotStepMin: 15,
  },
];

const buildSoloEventTypesData = (trainerId) => [
  {
    userId: trainerId,
    orgId: null,
    slug: "personal-training",
    name: "Персональне тренування",
    durationMin: 60,
    type: "solo",
    staffPolicy: "any",
    active: true,
    color: "#10B981",
    price: { amount: 800, currency: "uah" },
    bufferAfter: 15,
    minNotice: 60,
    slotStepMin: 30,
  },
  {
    userId: trainerId,
    orgId: null,
    slug: "group-training",
    name: "Групове тренування",
    durationMin: 90,
    type: "solo",
    staffPolicy: "any",
    active: true,
    color: "#6366F1",
    price: { amount: 500, currency: "uah" },
    bufferAfter: 15,
    minNotice: 120,
    slotStepMin: 30,
  },
  {
    userId: trainerId,
    orgId: null,
    slug: "consultation",
    name: "Консультація",
    durationMin: 30,
    type: "solo",
    staffPolicy: "any",
    active: true,
    color: "#F97316",
    price: { amount: 400, currency: "uah" },
    bufferAfter: 10,
    minNotice: 30,
    slotStepMin: 15,
  },
];

const buildWeeklyHours = () => [
  { day: "mon", enabled: true, slots: [{ start: "09:00", end: "18:00" }] },
  { day: "tue", enabled: true, slots: [{ start: "09:00", end: "18:00" }] },
  { day: "wed", enabled: true, slots: [{ start: "09:00", end: "18:00" }] },
  { day: "thu", enabled: true, slots: [{ start: "09:00", end: "18:00" }] },
  { day: "fri", enabled: true, slots: [{ start: "09:00", end: "18:00" }] },
  { day: "sat", enabled: true, slots: [{ start: "10:00", end: "15:00" }] },
  { day: "sun", enabled: false, slots: [] },
];

const buildBarberSchedule = (staffId, orgId, locationId) => ({
  staffId,
  orgId,
  locationId,
  weeklyHours: buildWeeklyHours(),
  timezone: "Europe/Kyiv",
  slotMode: "fixed",
  slotStepMin: 30,
  validFrom: new Date("2026-01-01"),
  validTo: null,
});

const buildTrainerSchedule = (staffId) => ({
  staffId,
  orgId: null,
  locationId: null,
  weeklyHours: buildWeeklyHours(),
  timezone: "Europe/Kyiv",
  slotMode: "fixed",
  slotStepMin: 30,
  validFrom: new Date("2026-01-01"),
  validTo: null,
});

const buildInviteesData = () => [
  {
    name: "Марія Сидоренко",
    email: "maria@example.com",
    phone: "+380501234567",
    timezone: "Europe/Kyiv",
  },
  {
    name: "Олена Бондаренко",
    email: "olena@example.com",
    phone: "+380671234567",
    timezone: "Europe/Kyiv",
  },
  {
    name: "Катерина Мельник",
    email: "kateryna@example.com",
    phone: "+380931234567",
    timezone: "Europe/Kyiv",
  },
  {
    name: "Софія Кравченко",
    email: "sofia@example.com",
    phone: "+380661234567",
    timezone: "Europe/Kyiv",
  },
  {
    name: "Тетяна Лисенко",
    email: "tetyana@example.com",
    phone: "+380991234567",
    timezone: "Europe/Kyiv",
  },
];

// ---------------------------------------------------------------------------
// Time helpers — pure functions
// ---------------------------------------------------------------------------

const makeToday = () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
};

const makeTomorrow = (today) => {
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1); // tz-ok: seed script, UTC-midnight Date advanced by 1 day for test fixture only
  return tomorrow;
};

const makeTime = (baseDate, hours, minutes) =>
  new Date(new Date(baseDate).setUTCHours(hours, minutes, 0, 0));

const generateCancelToken = () => crypto.randomBytes(32).toString("hex");
const generateRescheduleToken = () => crypto.randomBytes(32).toString("hex");

const buildBooking = (eventType, hostUserId, invitee, orgId, locationId, startAt, endAt) => ({
  eventTypeId: eventType._id,
  hosts: [{ userId: hostUserId, role: "lead" }],
  inviteeId: invitee._id,
  orgId: orgId ?? null,
  locationId: locationId ?? null,
  startAt,
  endAt,
  timezone: "Europe/Kyiv",
  status: "confirmed",
  inviteeSnapshot: {
    name: invitee.name,
    email: invitee.email,
    phone: invitee.phone,
  },
  payment: { status: "none", amount: 0, currency: "uah" },
  cancelToken: generateCancelToken(),
  rescheduleToken: generateRescheduleToken(),
});

const buildBarberBookingsData = (users, orgId, locationId, eventTypes, invitees, today, tomorrow) => {
  const [ivan, oleksiy, dmytro] = users;
  const [maria, olena, kateryna, sofia, tetyana] = invitees;

  const haircutType = eventTypes.find(isHaircut);
  const coloringType = eventTypes.find(isColoring);
  const stylingType = eventTypes.find(isStyling);
  const beardTrimType = eventTypes.find(isBeardTrim);

  return [
    buildBooking(
      haircutType,
      ivan._id,
      maria,
      orgId,
      locationId,
      makeTime(today, 10, 0),
      makeTime(today, 11, 0),
    ),
    buildBooking(
      coloringType,
      ivan._id,
      olena,
      orgId,
      locationId,
      makeTime(today, 14, 0),
      makeTime(today, 16, 0),
    ),
    buildBooking(
      stylingType,
      oleksiy._id,
      kateryna,
      orgId,
      locationId,
      makeTime(today, 11, 0),
      makeTime(today, 11, 45),
    ),
    buildBooking(
      beardTrimType,
      dmytro._id,
      sofia,
      orgId,
      locationId,
      makeTime(today, 10, 0),
      makeTime(today, 10, 30),
    ),
    buildBooking(
      stylingType,
      ivan._id,
      tetyana,
      orgId,
      locationId,
      makeTime(tomorrow, 12, 0),
      makeTime(tomorrow, 12, 45),
    ),
    buildBooking(
      haircutType,
      oleksiy._id,
      maria,
      orgId,
      locationId,
      makeTime(tomorrow, 15, 0),
      makeTime(tomorrow, 16, 0),
    ),
  ];
};

const buildTrainerBookingsData = (trainer, soloEventTypes, invitees, today, tomorrow) => {
  const [, olena, kateryna, sofia] = invitees;

  const personalTraining = soloEventTypes.find(isPersonalTraining);
  const consultation = soloEventTypes.find(isConsultation);
  const groupTraining = soloEventTypes.find(isGroupTraining);

  return [
    buildBooking(
      personalTraining,
      trainer._id,
      sofia,
      null,
      null,
      makeTime(today, 10, 0),
      makeTime(today, 11, 0),
    ),
    buildBooking(
      consultation,
      trainer._id,
      olena,
      null,
      null,
      makeTime(today, 14, 0),
      makeTime(today, 14, 30),
    ),
    buildBooking(
      groupTraining,
      trainer._id,
      kateryna,
      null,
      null,
      makeTime(tomorrow, 11, 0),
      makeTime(tomorrow, 12, 30),
    ),
  ];
};

// ---------------------------------------------------------------------------
// Event type finders — named predicates (no inline lambdas)
// ---------------------------------------------------------------------------

const isHaircut = (et) => et.slug === "haircut";
const isColoring = (et) => et.slug === "coloring";
const isStyling = (et) => et.slug === "styling";
const isBeardTrim = (et) => et.slug === "beard-trim";
const isPersonalTraining = (et) => et.slug === "personal-training";
const isConsultation = (et) => et.slug === "consultation";
const isGroupTraining = (et) => et.slug === "group-training";

// ---------------------------------------------------------------------------
// Drop collections — isolated side effect
// ---------------------------------------------------------------------------

const dropCollections = async () => {
  const collections = [
    Booking, Invitee, ScheduleTemplate, EventType,
    Membership, Position, Location, Organization, User,
  ];

  const dropOne = (model) => model.deleteMany({});
  await Promise.all(collections.map(dropOne));
  console.log("Collections dropped.");
};

// ---------------------------------------------------------------------------
// Seed steps — isolated side effects
// ---------------------------------------------------------------------------

const seedOrganization = async () => {
  const org = await Organization.create(buildOrganizationData());
  console.log(`Organization created: ${org._id}`);
  return org;
};

const seedLocation = async (orgId) => {
  const location = await Location.create(buildLocationData(orgId));
  console.log(`Location created: ${location._id}`);
  return location;
};

const seedPositions = async (orgId) => {
  const positions = await Position.insertMany(buildPositionsData(orgId));
  console.log(`Positions created: ${positions.map(byId).join(", ")}`);
  return positions;
};

const seedUsers = async () => {
  const users = await User.insertMany(buildUsersData());
  console.log(`Users created: ${users.map(byId).join(", ")}`);
  return users;
};

const seedMemberships = async (users, orgId, positions, locationId) => {
  const memberships = await Membership.insertMany(
    buildMembershipsData(users, orgId, positions, locationId),
  );
  console.log(`Memberships created: ${memberships.map(byId).join(", ")}`);
  return memberships;
};

const seedOrgEventTypes = async (orgId) => {
  const eventTypes = await EventType.insertMany(buildOrgEventTypesData(orgId));
  console.log(`Org event types created: ${eventTypes.map(byId).join(", ")}`);
  return eventTypes;
};

const seedSoloEventTypes = async (trainerId) => {
  const eventTypes = await EventType.insertMany(buildSoloEventTypesData(trainerId));
  console.log(`Solo event types created: ${eventTypes.map(byId).join(", ")}`);
  return eventTypes;
};

const seedSchedules = async (users, orgId, locationId, trainer) => {
  const [ivan, oleksiy, dmytro] = users;

  const schedules = await ScheduleTemplate.insertMany([
    buildBarberSchedule(ivan._id, orgId, locationId),
    buildBarberSchedule(oleksiy._id, orgId, locationId),
    buildBarberSchedule(dmytro._id, orgId, locationId),
    buildTrainerSchedule(trainer._id),
  ]);
  console.log(`Schedules created: ${schedules.map(byId).join(", ")}`);
  return schedules;
};

const seedInvitees = async () => {
  const invitees = await Invitee.insertMany(buildInviteesData());
  console.log(`Invitees created: ${invitees.map(byId).join(", ")}`);
  return invitees;
};

const seedBookings = async (users, orgId, locationId, orgEventTypes, soloEventTypes, invitees, trainer) => {
  const today = makeToday();
  const tomorrow = makeTomorrow(today);

  const barberBookings = buildBarberBookingsData(
    users, orgId, locationId, orgEventTypes, invitees, today, tomorrow,
  );

  const trainerBookings = buildTrainerBookingsData(
    trainer, soloEventTypes, invitees, today, tomorrow,
  );

  const bookings = await Booking.insertMany([...barberBookings, ...trainerBookings]);
  console.log(`Bookings created: ${bookings.map(byId).join(", ")}`);
  return bookings;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const byId = (doc) => String(doc._id);

// ---------------------------------------------------------------------------
// Summary logger — isolated side effect
// ---------------------------------------------------------------------------

const logSummary = (org, users, trainer) => {
  const [ivan, oleksiy, dmytro] = users;

  console.log(`
=== Seed Complete ===

Organization: "${org.name}"
  Org page: /org/${org._id}
  Admin page: /staff/org/${org._id}

Staff:
  Іван Петров (Senior Barber): /book/${ivan._id}
  Олексій Коваленко (Barber): /book/${oleksiy._id}
  Дмитро Шевченко (Junior Barber): /book/${dmytro._id}

Solo Trainer:
  Анна Тренер: /book/${trainer._id}
  Schedule: /staff/schedule (log in as trainer@example.com)
`);
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const seed = async () => {
  await mongoose.connect(DB_URI);
  console.log("Connected to MongoDB.");

  await dropCollections();

  const org = await seedOrganization();
  const location = await seedLocation(org._id);
  const positions = await seedPositions(org._id);
  const allUsers = await seedUsers();

  const barbers = allUsers.slice(0, 3);
  const trainer = allUsers[3];

  await seedMemberships(barbers, org._id, positions, location._id);

  const orgEventTypes = await seedOrgEventTypes(org._id);
  const soloEventTypes = await seedSoloEventTypes(trainer._id);

  await seedSchedules(barbers, org._id, location._id, trainer);

  const invitees = await seedInvitees();

  await seedBookings(barbers, org._id, location._id, orgEventTypes, soloEventTypes, invitees, trainer);

  logSummary(org, barbers, trainer);

  await mongoose.disconnect();
  console.log("Disconnected. Seed complete.");
};

seed().catch((error) => {
  console.error("Seed failed:", error);
  mongoose.disconnect();
  process.exit(1);
});
