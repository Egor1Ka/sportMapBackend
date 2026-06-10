import { resolveCurrency } from "../services/currencyResolver.js";

const toHostDto = (host) => ({
  userId: host.userId.toString(),
  role: host.role,
});

const toInviteeSnapshotDto = (snapshot) => ({
  name: snapshot.name,
  email: snapshot.email,
  phone: snapshot.phone,
});

const toPaymentDto = (payment, currency) => ({
  status: payment.status,
  amount: payment.amount,
  currency,
});

const toCustomFieldValueDto = (entry) => ({
  fieldId: entry.fieldId,
  label: entry.label,
  value: entry.value,
});

const extractId = (field) =>
  field && field._id ? field._id.toString() : field.toString();

const toStatusDto = (statusId) => {
  if (statusId && statusId._id) {
    return {
      id: statusId._id.toString(),
      label: statusId.label,
      color: statusId.color,
      actions: statusId.actions,
      isDefault: statusId.isDefault,
    };
  }
  return { id: statusId ? statusId.toString() : null };
};

const resolveCurrencyForBooking = async (doc) => {
  const orgId = doc.orgId ?? null;
  const userId = !orgId && doc.hosts && doc.hosts[0] ? doc.hosts[0].userId : null;
  return resolveCurrency({ orgId, userId });
};

const toBookingDto = async (doc) => {
  const currency = await resolveCurrencyForBooking(doc);
  return {
    id: doc._id.toString(),
    eventTypeId: extractId(doc.eventTypeId),
    hosts: doc.hosts.map(toHostDto),
    inviteeId: doc.inviteeId.toString(),
    orgId: doc.orgId ? doc.orgId.toString() : null,
    locationId: doc.locationId ? doc.locationId.toString() : null,
    startAt: doc.startAt,
    endAt: doc.endAt,
    timezone: doc.timezone,
    statusId: doc.statusId ? doc.statusId.toString() : null,
    status: toStatusDto(doc.statusId),
    inviteeSnapshot: toInviteeSnapshotDto(doc.inviteeSnapshot),
    clientNotes: doc.clientNotes,
    customFieldValues: Array.isArray(doc.customFieldValues)
      ? doc.customFieldValues.map(toCustomFieldValueDto)
      : [],
    payment: toPaymentDto(doc.payment, currency),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

const toBookingCreatedDto = async (doc, eventType) => {
  const currency = await resolveCurrencyForBooking(doc);
  return {
    id: doc._id.toString(),
    eventTypeId: extractId(doc.eventTypeId),
    eventTypeName: eventType.name,
    staffId: doc.hosts[0].userId.toString(),
    startAt: doc.startAt,
    endAt: doc.endAt,
    timezone: doc.timezone,
    locationId: doc.locationId ? doc.locationId.toString() : null,
    statusId: doc.statusId ? doc.statusId.toString() : null,
    status: toStatusDto(doc.statusId),
    cancelToken: doc.cancelToken,
    invitee: toInviteeSnapshotDto(doc.inviteeSnapshot),
    payment: toPaymentDto(doc.payment, currency),
    createdAt: doc.createdAt,
  };
};

export { toBookingDto, toBookingCreatedDto };
