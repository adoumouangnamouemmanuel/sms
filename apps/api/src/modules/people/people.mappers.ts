import type { GuardianRecord, StudentGuardianLinkRecord, StudentRecord } from '@edutrack/db';
import type {
  GuardianResponse,
  StudentGuardianLinkResponse,
  StudentResponse,
} from '@edutrack/shared';

/** Drops repository-only columns (e.g. deletedAt) from the public student shape. */
export function toStudentResponse(student: StudentRecord): StudentResponse {
  return {
    id: student.id,
    schoolId: student.schoolId,
    code: student.code,
    firstName: student.firstName,
    lastName: student.lastName,
    sex: student.sex,
    dateOfBirth: student.dateOfBirth,
    placeOfBirth: student.placeOfBirth,
    nationality: student.nationality,
    photoUrl: student.photoUrl,
    phone: student.phone,
    email: student.email,
    address: student.address,
    isActive: student.isActive,
    recordVersion: student.recordVersion,
  };
}

export function toGuardianResponse(guardian: GuardianRecord): GuardianResponse {
  return {
    id: guardian.id,
    schoolId: guardian.schoolId,
    firstName: guardian.firstName,
    lastName: guardian.lastName,
    phone: guardian.phone,
    email: guardian.email,
    address: guardian.address,
    isActive: guardian.isActive,
    recordVersion: guardian.recordVersion,
  };
}

export function toLinkResponse(link: StudentGuardianLinkRecord): StudentGuardianLinkResponse {
  return {
    id: link.id,
    studentId: link.studentId,
    guardianId: link.guardianId,
    relationshipType: link.relationshipType,
    isPrimary: link.isPrimary,
    isEmergency: link.isEmergency,
    notes: link.notes,
    recordVersion: link.recordVersion,
  };
}
