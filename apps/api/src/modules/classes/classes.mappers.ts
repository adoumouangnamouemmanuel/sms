import type {
  ClassSubjectView,
  ClassroomView,
  EnrollmentResponse,
  StudentSubjectEnrollmentResponse,
  SubjectResponse,
} from '@edutrack/shared';
import type {
  ClassSubjectRecord,
  ClassEnrollmentRecord,
  StudentSubjectEnrollmentRecord,
  SubjectRecord,
  ClassroomRecord,
  StudentRecord,
  ClassLevelRecord,
  AcademicYearRecord,
  TeacherRecord,
} from '@edutrack/db';

export function toSubjectResponse(subject: SubjectRecord): SubjectResponse {
  return {
    id: subject.id,
    schoolId: subject.schoolId,
    code: subject.code,
    name: subject.name,
    nameEn: subject.nameEn,
    nameAr: subject.nameAr,
    shortLabel: subject.shortLabel,
    category: subject.category,
    isActive: subject.isActive,
    recordVersion: subject.recordVersion,
  };
}

export interface ClassroomContext {
  classLevel: ClassLevelRecord;
  academicYear: AcademicYearRecord;
  activeEnrollmentCount: number;
}

export function toClassroomView(
  classroom: ClassroomRecord,
  context: ClassroomContext
): ClassroomView {
  return {
    classroom: {
      id: classroom.id,
      schoolId: classroom.schoolId,
      academicYearId: classroom.academicYearId,
      classLevelId: classroom.classLevelId,
      code: classroom.code,
      name: classroom.name,
      capacity: classroom.capacity,
      isActive: classroom.isActive,
      recordVersion: classroom.recordVersion,
    },
    classLevelCode: context.classLevel.code,
    classLevelName: context.classLevel.name,
    isExamYear: context.classLevel.isExamYear,
    academicYearLabel: context.academicYear.label,
    activeEnrollmentCount: context.activeEnrollmentCount,
  };
}

export interface ClassSubjectContext {
  subject: SubjectRecord;
  teacher: TeacherRecord | null;
}

export function toClassSubjectView(
  classSubject: ClassSubjectRecord,
  context: ClassSubjectContext
): ClassSubjectView {
  return {
    classSubject: {
      id: classSubject.id,
      schoolId: classSubject.schoolId,
      classroomId: classSubject.classroomId,
      subjectId: classSubject.subjectId,
      coefficient: classSubject.coefficient,
      isRequired: classSubject.isRequired,
      teacherId: classSubject.teacherId,
      isActive: classSubject.isActive,
      recordVersion: classSubject.recordVersion,
    },
    subjectCode: context.subject.code,
    subjectName: context.subject.name,
    subjectCategory: context.subject.category,
    teacherName: context.teacher
      ? `${context.teacher.firstName} ${context.teacher.lastName}`
      : null,
  };
}

export function toEnrollmentResponse(enrollment: ClassEnrollmentRecord): EnrollmentResponse {
  return {
    id: enrollment.id,
    schoolId: enrollment.schoolId,
    studentId: enrollment.studentId,
    classroomId: enrollment.classroomId,
    academicYearId: enrollment.academicYearId,
    status: enrollment.status,
    enrollmentDate: enrollment.enrollmentDate,
    exitDate: enrollment.exitDate,
    reason: enrollment.reason,
    recordVersion: enrollment.recordVersion,
  };
}

export function toStudentSubjectEnrollmentResponse(
  enrollment: StudentSubjectEnrollmentRecord
): StudentSubjectEnrollmentResponse {
  return {
    id: enrollment.id,
    schoolId: enrollment.schoolId,
    classEnrollmentId: enrollment.classEnrollmentId,
    classSubjectId: enrollment.classSubjectId,
    isActive: enrollment.isActive,
    recordVersion: enrollment.recordVersion,
  };
}

export interface RosterStudent {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  sex: string | null;
  dateOfBirth: string | null;
}

export function toRosterStudent(student: StudentRecord): RosterStudent {
  return {
    id: student.id,
    code: student.code,
    firstName: student.firstName,
    lastName: student.lastName,
    sex: student.sex,
    dateOfBirth: student.dateOfBirth,
  };
}
