import { ValidationError, getTodayDateString } from './meeting.js';

export const VALID_ANALYSIS_MODES = ['LLM_CLOUD', 'HEURISTIC_LOCAL'];
const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function validateBriefingItem(data = {}) {
  const {
    title,
    url,
    source,
    publishedAt,
    summary,
    commentary,
    analysisMode,
    briefingDate
  } = data;

  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new ValidationError('BriefingItem title is required and cannot be empty.');
  }

  if (typeof url !== 'string' || url.trim().length === 0) {
    throw new ValidationError('BriefingItem url is required and cannot be empty.');
  }

  if (typeof source !== 'string' || source.trim().length === 0) {
    throw new ValidationError('BriefingItem source is required and cannot be empty.');
  }

  if (typeof publishedAt !== 'string' || publishedAt.trim().length === 0) {
    throw new ValidationError('BriefingItem publishedAt is required and cannot be empty.');
  }

  if (typeof summary !== 'string' || summary.trim().length === 0) {
    throw new ValidationError('BriefingItem summary ("Resumen a leer") is required and cannot be empty.');
  }

  if (typeof commentary !== 'string' || commentary.trim().length === 0) {
    throw new ValidationError('BriefingItem commentary ("Comentarios al respecto") is required and cannot be empty.');
  }

  if (!VALID_ANALYSIS_MODES.includes(analysisMode)) {
    throw new ValidationError(`BriefingItem analysisMode must be one of: ${VALID_ANALYSIS_MODES.join(', ')}.`);
  }

  const effectiveDate = briefingDate ? String(briefingDate).trim() : getTodayDateString();
  if (!DATE_REGEX.test(effectiveDate)) {
    throw new ValidationError('BriefingItem briefingDate must be in valid format YYYY-MM-DD.');
  }

  return {
    title: title.trim(),
    url: url.trim(),
    source: source.trim(),
    publishedAt: publishedAt.trim(),
    summary: summary.trim(),
    commentary: commentary.trim(),
    analysisMode,
    briefingDate: effectiveDate
  };
}
