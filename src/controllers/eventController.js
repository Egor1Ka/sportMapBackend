import { ok, created, httpResponseError } from '../utils/http/httpResponse.js';
import * as eventService from '../services/eventService.js';

export async function list(req, res) {
  try {
    const result = await eventService.listEventsByPlayground(
      req.user,
      req.params?.playgroundId,
      req.query ?? {}
    );
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function getById(req, res) {
  try {
    const result = await eventService.getEventById(req.user, req.params?.id);
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function create(req, res) {
  try {
    const result = await eventService.createEvent(
      req.user,
      req.params?.playgroundId,
      req.body ?? {}
    );
    created(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function update(req, res) {
  try {
    const result = await eventService.updateEvent(
      req.user,
      req.params?.id,
      req.body ?? {}
    );
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function cancel(req, res) {
  try {
    const result = await eventService.cancelEvent(req.user, req.params?.id);
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function rsvp(req, res) {
  try {
    const result = await eventService.rsvpToEvent(req.user, req.params?.id);
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function unrsvp(req, res) {
  try {
    const result = await eventService.unrsvpFromEvent(req.user, req.params?.id);
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}
