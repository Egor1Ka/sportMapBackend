import {
  createBooking,
  getBookingsByStaff,
  cancelBookingById,
  cancelBookingByToken,
  getBookingById,
  updateBookingStatus as updateBookingStatusService,
  rescheduleBookingById,
} from "../services/bookingServices.js";
import { toBookingCreatedDto } from "../dto/bookingDto.js";
import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";
import { validateSchema } from "../shared/utils/validation/requestValidation.js";
import { isValidObjectId } from "../shared/utils/validation/validators.js";
import { isValidTimezone, parseWallClockToUtc } from "../shared/utils/timezone.js";
import { resolveStaffTimezone } from "../services/scheduleServices.js";

const createBookingSchema = {
  eventTypeId: { type: "string", required: true },
  staffId: { type: "string", required: true },
  startAt: { type: "string", required: true },
  timezone: { type: "string", required: true },
  invitee: {
    type: "object",
    required: true,
    properties: {
      name: { type: "string", required: true },
      email: { type: "string", required: false },
      phone: { type: "string", required: false },
    },
  },
  customFieldValues: {
    type: "array",
    required: false,
    items: {
      type: "object",
      properties: {
        fieldId: { type: "string", required: true },
        label: { type: "string", required: true },
        value: { type: "string", required: true },
      },
    },
  },
};

const handleCreateBooking = async (req, res) => {
  try {
    const validated = validateSchema(createBookingSchema, req.body);
    if (validated.errors) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: validated.errors });
    }

    const result = await createBooking(req.body);
    if (result.error === "eventType_not_found") {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }
    if (result.error === "template_not_found") {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }
    const dto = await toBookingCreatedDto(result.raw, result.eventType);
    return httpResponse(res, generalStatus.CREATED, dto);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleGetBookingsByStaff = async (req, res) => {
  try {
    const { staffId, dateFrom, dateTo, locationId, orgId, status } = req.query;

    if (!staffId || !isValidObjectId(staffId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    if (!dateFrom || !dateTo) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const timezone = await resolveStaffTimezone({
      staffId,
      orgId: orgId || null,
      locationId: locationId || null,
    });
    if (!timezone || !isValidTimezone(timezone)) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: { timezone: "not_configured_for_staff" } });
    }

    const statuses = status ? status.split(",") : undefined;

    const dateFromUtc = parseWallClockToUtc(`${dateFrom}T00:00:00`, timezone);
    const dateToUtc = parseWallClockToUtc(`${dateTo}T23:59:59.999`, timezone);

    const bookings = await getBookingsByStaff({
      staffId,
      dateFrom: dateFromUtc,
      dateTo: dateToUtc,
      locationId: locationId || undefined,
      orgId: orgId ? orgId : null,
      statuses,
    });

    return httpResponse(res, generalStatus.SUCCESS, bookings);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleDeleteBooking = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const reason = req.body ? req.body.reason : undefined;
    const booking = await cancelBookingById(req.params.id, reason);
    if (!booking) return httpResponse(res, generalStatus.NOT_FOUND);

    return httpResponse(res, generalStatus.SUCCESS, booking);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const cancelByTokenSchema = {
  cancelToken: { type: "string", required: true },
  reason: { type: "string", required: false },
};

const handleCancelByToken = async (req, res) => {
  try {
    const validated = validateSchema(cancelByTokenSchema, req.body);
    if (validated.errors) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: validated.errors });
    }

    const booking = await cancelBookingByToken(req.body.cancelToken, req.body.reason);
    if (!booking) return httpResponse(res, generalStatus.NOT_FOUND);

    return httpResponse(res, generalStatus.SUCCESS, booking);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleGetBookingById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    const booking = await getBookingById(req.params.id);
    if (!booking) return httpResponse(res, generalStatus.NOT_FOUND);
    return httpResponse(res, generalStatus.SUCCESS, booking);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleUpdateStatus = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    const { statusId } = req.body;
    if (!statusId || !isValidObjectId(statusId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const existing = await getBookingById(req.params.id);
    if (!existing) return httpResponse(res, generalStatus.NOT_FOUND);

    // Свободные переходы — валидируем только что statusId существует и не архивирован
    const { findById } = await import("../repository/bookingStatusRepository.js");
    const targetStatus = await findById(statusId);
    if (!targetStatus || targetStatus.isArchived) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const updated = await updateBookingStatusService(req.params.id, statusId);
    return httpResponse(res, generalStatus.SUCCESS, updated);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleReschedule = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    const { startAt } = req.body;
    if (!startAt) return httpResponse(res, generalStatus.BAD_REQUEST);

    const result = await rescheduleBookingById(req.params.id, startAt);
    if (result && result.error === "booking_not_found") {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }
    if (result && result.error === "eventType_not_found") {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }
    if (result && result.error === "template_not_found") {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }
    return httpResponse(res, generalStatus.SUCCESS, result);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export {
  handleCreateBooking,
  handleGetBookingsByStaff,
  handleDeleteBooking,
  handleCancelByToken,
  handleGetBookingById,
  handleUpdateStatus,
  handleReschedule,
};
