import { ValidationError } from './meeting.js';

export const VALID_SOURCE_TYPES = ['subscription', 'manual_import', 'local'];
export const VALID_SYNC_STATUSES = ['ok', 'error'];
export const DEFAULT_SOURCE_COLOR = '#3b82f6';

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function validateCalendarSourceData(data = {}, { isPartial = false } = {}) {
  const result = {};

  if (!isPartial) {
    // 1. Name is mandatory
    if (typeof data.name !== 'string' || data.name.trim().length === 0) {
      throw new ValidationError('CalendarSource name is required and cannot be empty.');
    }
    result.name = data.name.trim();

    // 2. Type is mandatory
    if (!VALID_SOURCE_TYPES.includes(data.type)) {
      throw new ValidationError(`CalendarSource type must be one of: ${VALID_SOURCE_TYPES.join(', ')}.`);
    }
    result.type = data.type;

    // 3. URL is mandatory for 'subscription'
    if (result.type === 'subscription') {
      if (typeof data.url !== 'string' || data.url.trim().length === 0) {
        throw new ValidationError('CalendarSource url is required for subscription type.');
      }
      result.url = data.url.trim();
    } else {
      result.url = data.url ? String(data.url).trim() : null;
    }

    // 4. Color defaults to DEFAULT_SOURCE_COLOR
    const color = data.color ? String(data.color).trim() : DEFAULT_SOURCE_COLOR;
    if (!HEX_COLOR_REGEX.test(color)) {
      throw new ValidationError(`CalendarSource color must be a valid hex color code (e.g., #3b82f6), received "${color}".`);
    }
    result.color = color;

    // 5. Enabled defaults to 1
    if (data.enabled !== undefined) {
      result.enabled = data.enabled === 0 || data.enabled === false || data.enabled === '0' ? 0 : 1;
    } else {
      result.enabled = 1;
    }

    // 6. Sync status defaults to 'ok'
    const syncStatus = data.syncStatus || data.sync_status || 'ok';
    if (!VALID_SYNC_STATUSES.includes(syncStatus)) {
      throw new ValidationError(`CalendarSource syncStatus must be one of: ${VALID_SYNC_STATUSES.join(', ')}.`);
    }
    result.syncStatus = syncStatus;

    // 7. Sync error
    result.syncError = typeof (data.syncError ?? data.sync_error) === 'string'
      ? (data.syncError ?? data.sync_error).trim()
      : '';

    return result;
  }

  // Partial validation for PATCH
  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.trim().length === 0) {
      throw new ValidationError('CalendarSource name cannot be empty.');
    }
    result.name = data.name.trim();
  }

  if (data.type !== undefined) {
    if (!VALID_SOURCE_TYPES.includes(data.type)) {
      throw new ValidationError(`CalendarSource type must be one of: ${VALID_SOURCE_TYPES.join(', ')}.`);
    }
    result.type = data.type;
  }

  if (data.url !== undefined) {
    result.url = data.url ? String(data.url).trim() : null;
  }

  if (data.color !== undefined) {
    const color = String(data.color).trim();
    if (!HEX_COLOR_REGEX.test(color)) {
      throw new ValidationError(`CalendarSource color must be a valid hex color code, received "${color}".`);
    }
    result.color = color;
  }

  if (data.enabled !== undefined) {
    result.enabled = data.enabled === 0 || data.enabled === false || data.enabled === '0' ? 0 : 1;
  }

  const rawSyncStatus = data.syncStatus !== undefined ? data.syncStatus : data.sync_status;
  if (rawSyncStatus !== undefined) {
    if (!VALID_SYNC_STATUSES.includes(rawSyncStatus)) {
      throw new ValidationError(`CalendarSource syncStatus must be one of: ${VALID_SYNC_STATUSES.join(', ')}.`);
    }
    result.syncStatus = rawSyncStatus;
  }

  const rawSyncError = data.syncError !== undefined ? data.syncError : data.sync_error;
  if (rawSyncError !== undefined) {
    result.syncError = typeof rawSyncError === 'string' ? rawSyncError.trim() : '';
  }

  return result;
}
