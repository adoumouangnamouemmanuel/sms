export const PERSON_SEX_VALUES = ['M', 'F', 'AUTRE'] as const;
export type PersonSex = (typeof PERSON_SEX_VALUES)[number];

export const GUARDIAN_RELATIONSHIP_TYPES = ['PERE', 'MERE', 'TUTEUR', 'AUTRE'] as const;
export type GuardianRelationshipType = (typeof GUARDIAN_RELATIONSHIP_TYPES)[number];
