export const generalStatus = {
  SUCCESS: { status: 200, message: "success" },
  CREATED: { status: 201, message: "created" },
  BAD_REQUEST: { status: 400, message: "badRequest" },
  UNAUTHORIZED: { status: 401, message: "unauthorized" },
  FORBIDDEN: { status: 403, message: "forbidden" },
  NOT_FOUND: { status: 404, message: "notFound" },
  ERROR: { status: 500, message: "serverError" },
};

export const userStatus = {
  DELETED:          { status: 200, message: "userDeleted" },
  VALIDATION_ERROR: { status: 400, message: "validationError" },
  NOTHING_TO_UPDATE:{ status: 400, message: "nothingToUpdate" },
};

export const billingStatus = {
  FEATURE_LOCKED: { status: 403, message: "featureLocked" },
  PLAN_REQUIRED:  { status: 403, message: "planRequired" },
};

export const bookingStatus = {
  SLOT_TAKEN: { status: 409, message: "slotTaken" },
};
