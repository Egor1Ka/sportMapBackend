import { generalStatus } from "./httpStatus.js";
import { DomainError, HttpError } from "./httpError.js";

export const httpResponse = (res, httpStatus, data) => {
  const { status = 200, message, appStatusCode = status } = httpStatus;
  const body = {
    ...(data !== undefined && { data }),
    statusCode: appStatusCode,
    status: message,
  };

  return res.status(status).json(body);
};

export const httpResponseError = (res, error) => {
  if (error instanceof HttpError) {
    const { status, message, appStatusCode, data } = error;
    return httpResponse(res, { status, message, appStatusCode }, data);
  }

  if (error instanceof DomainError) {
    const { status, message } = error;
    return httpResponse(res, { status, message });
  }

  if (error && typeof error.status === "number") {
    return httpResponse(res, error, error.data);
  }

  console.error(error);
  return httpResponse(res, generalStatus.ERROR);
};
