const toInviteeDto = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  email: doc.email,
  phone: doc.phone,
  phoneCountry: doc.phoneCountry,
  timezone: doc.timezone,
});

export { toInviteeDto };
