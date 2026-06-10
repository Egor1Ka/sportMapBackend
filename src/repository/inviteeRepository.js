import Invitee from "../models/Invitee.js";
import { toInviteeDto } from "../dto/inviteeDto.js";

const findOrCreateInvitee = async ({ name, email, phone, phoneCountry, timezone }) => {
  const filter = email ? { email } : { phone };
  const update = {
    name,
    ...(email && { email }),
    ...(phone && { phone }),
    ...(phoneCountry && { phoneCountry }),
    ...(timezone && { timezone }),
  };
  const doc = await Invitee.findOneAndUpdate(filter, update, {
    upsert: true,
    new: true,
  });
  return toInviteeDto(doc);
};

export { findOrCreateInvitee };
