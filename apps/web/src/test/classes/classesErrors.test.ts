import { describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import {
  ClassesApiError,
  resolveClassesErrorMessageKey,
} from '../../modules/classes/classesErrors';

describe('resolveClassesErrorMessageKey', () => {
  it('maps known API error codes to their i18n keys', () => {
    expect(resolveClassesErrorMessageKey(new ClassesApiError('CAPACITY_EXCEEDED', 'x', 409))).toBe(
      'classes.errors.capacityExceeded'
    );
    expect(resolveClassesErrorMessageKey(new ClassesApiError('VERSION_CONFLICT', 'x', 409))).toBe(
      'classes.errors.versionConflict'
    );
    expect(
      resolveClassesErrorMessageKey(new ClassesApiError('INVALID_ACCESS_TOKEN', 'x', 401))
    ).toBe('classes.errors.sessionExpired');
    expect(resolveClassesErrorMessageKey(new ClassesApiError('FORBIDDEN', 'x', 403))).toBe(
      'classes.errors.forbidden'
    );
  });

  it('maps a route-miss 404 to the actionable service-update message', () => {
    expect(
      resolveClassesErrorMessageKey(
        new ClassesApiError('ROUTE_NOT_FOUND', 'Route GET:/subjects not found', 404)
      )
    ).toBe('classes.errors.serviceUpdate');
  });

  it('falls back to the generic key for unknown API codes and non-API errors', () => {
    expect(resolveClassesErrorMessageKey(new ClassesApiError('WHATEVER', 'x', 500))).toBe(
      'classes.errors.generic'
    );
    expect(resolveClassesErrorMessageKey(new Error('boom'))).toBe('classes.errors.generic');
  });

  it('never renders a raw i18n key for any mapped error (all keys translate)', () => {
    const codes = [
      'ACADEMIC_YEAR_NOT_FOUND',
      'CAPACITY_EXCEEDED',
      'CLASSROOM_CODE_EXISTS',
      'CLASSROOM_NOT_FOUND',
      'CLASS_SUBJECT_NOT_FOUND',
      'CLASS_SUBJECT_PAIR_EXISTS',
      'CLASS_SUBJECT_REQUIRED_LINK',
      'ENROLLMENT_NOT_FOUND',
      'FORBIDDEN',
      'ROUTE_NOT_FOUND',
      'STUDENT_ALREADY_ENROLLED',
      'STUDENT_NOT_FOUND',
      'SUBJECT_CODE_EXISTS',
      'SUBJECT_NOT_FOUND',
      'TEACHER_NOT_FOUND',
      'VERSION_CONFLICT',
      'INVALID_ACCESS_TOKEN',
      'LOCAL_SERVICE_UNAVAILABLE',
      'UNKNOWN_ERROR',
      'VALIDATION_ERROR',
    ];

    for (const code of codes) {
      const key = resolveClassesErrorMessageKey(new ClassesApiError(code, 'x', 500));
      const rendered = i18n.t(key);
      expect(rendered).not.toBe(key);
      expect(rendered.trim().length).toBeGreaterThan(0);
    }
  });
});
