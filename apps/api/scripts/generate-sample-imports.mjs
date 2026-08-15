/**
 * Generates the sample .xlsx files committed under docs/import-templates so the
 * school master can confirm the Phase 3.4 import flow manually without building
 * a file by hand. Run from apps/api: `node scripts/generate-sample-imports.mjs`.
 *
 * Produces:
 *  - eleves_modele.xlsx / professeurs_modele.xlsx   (headers + README + examples)
 *  - eleves_exemple.xlsx / professeurs_exemple.xlsx (valid rows, ready to import)
 *  - eleves_avec_erreurs.xlsx                      (rows with errors to demo the report)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputDir = join(scriptDir, '..', '..', '..', 'docs', 'import-templates');

const STUDENT_COLUMNS = [
  'Code',
  'Prénom',
  'Nom',
  'Sexe',
  'Date de naissance',
  'Nationalité',
  'Téléphone',
  'Email',
  'Adresse',
];
const TEACHER_COLUMNS = [
  'Code',
  'Prénom',
  'Nom',
  'Spécialité',
  "Date d'embauche",
  'Téléphone',
  'Email',
  'Adresse',
];

const STUDENT_DESCRIPTIONS = [
  "Optionnel. Laissé vide, un code est généré automatiquement ({code de l'école}-{année}-{séquence}).",
  'Requis.',
  'Requis.',
  'M, F ou AUTRE.',
  'JJ/MM/AAAA ou AAAA-MM-JJ.',
  'Optionnel.',
  'Optionnel.',
  'Optionnel.',
  'Optionnel.',
];
const TEACHER_DESCRIPTIONS = [
  "Optionnel. Laissé vide, un code est généré automatiquement ({code de l'école}-{année}-{séquence}).",
  'Requis.',
  'Requis.',
  'Optionnel.',
  'JJ/MM/AAAA ou AAAA-MM-JJ.',
  'Optionnel.',
  'Optionnel.',
  'Optionnel.',
];
const GUARDIAN_COLUMNS = ['Prénom', 'Nom', 'Téléphone', 'Email', 'Adresse', 'Code élève'];
const GUARDIAN_DESCRIPTIONS = [
  'Requis.',
  'Requis.',
  'Optionnel.',
  'Optionnel.',
  'Optionnel.',
  "Optionnel. Lie automatiquement le responsable à l'élève portant ce code (importé avant ou déjà présent dans l'école).",
];

mkdirSync(outputDir, { recursive: true });

writeModeles();
writeExemples();
writeAvecErreurs();
console.log(`Sample files written to ${outputDir}`);

function writeModeles() {
  const studentExampleRows = [
    [
      null,
      'Aminata',
      'Mahamat',
      'F',
      '14/03/2012',
      'Tchadienne',
      '+23566000001',
      'aminata.mahamat@exemple.td',
      'N Djamena',
    ],
    [
      'NDS-DEMO-2026-X00001',
      'Ibrahim',
      'Ousmane',
      'M',
      '2010-11-02',
      'Tchadienne',
      '+23566000002',
      null,
      null,
    ],
  ];
  const teacherExampleRows = [
    [
      null,
      'Jean',
      'Nguet',
      'Mathematiques',
      '01/09/2015',
      '+23566000010',
      'j.nguet@exemple.td',
      null,
    ],
    [
      'NDS-DEMO-2026-T00001',
      'Fatime',
      'Abakar',
      'Physique',
      '2016-10-01',
      '+23566000011',
      null,
      null,
    ],
  ];

  writeWorkbook(
    'eleves_modele.xlsx',
    STUDENT_COLUMNS,
    [],
    studentExampleRows,
    STUDENT_DESCRIPTIONS
  );
  writeWorkbook(
    'professeurs_modele.xlsx',
    TEACHER_COLUMNS,
    [],
    teacherExampleRows,
    TEACHER_DESCRIPTIONS
  );

  const guardianExampleRows = [
    [
      'Fatime',
      'Abakar',
      '+23566000020',
      'fatime.abakar@exemple.td',
      'N Djamena',
      'NDS-DEMO-2026-X00001',
    ],
    ['Mahamat', 'Ousmane', '+23566000021', null, null, null],
  ];
  writeWorkbook(
    'responsables_modele.xlsx',
    GUARDIAN_COLUMNS,
    [],
    guardianExampleRows,
    GUARDIAN_DESCRIPTIONS
  );
}

function writeExemples() {
  writeWorkbook(
    'eleves_exemple.xlsx',
    STUDENT_COLUMNS,
    [
      [
        null,
        'Aminata',
        'Mahamat',
        'F',
        '14/03/2012',
        'Tchadienne',
        '+23566000001',
        'aminata.mahamat@exemple.td',
        'N Djamena',
      ],
      [null, 'Ibrahim', 'Ousmane', 'M', '2010-11-02', 'Tchadienne', '+23566000002', null, null],
      [
        'NDS-DEMO-2026-X00001',
        'Ali',
        'Ahmat',
        'M',
        '12/01/2011',
        'Camerounaise',
        '+23566000003',
        null,
        null,
      ],
      [null, 'Fatime', 'Abakar', 'F', '25/07/2013', 'Tchadienne', '+23566000004', null, null],
      [null, 'Mahamat', 'Issa', 'M', '03/09/2012', 'Tchadienne', null, null, null],
      [
        null,
        'Aicha',
        'Brahim',
        'F',
        '30/11/2010',
        'Soudanaise',
        '+23566000005',
        'aicha.brahim@exemple.td',
        null,
      ],
    ],
    [],
    STUDENT_DESCRIPTIONS
  );

  writeWorkbook(
    'professeurs_exemple.xlsx',
    TEACHER_COLUMNS,
    [
      [
        null,
        'Jean',
        'Nguet',
        'Mathematiques',
        '01/09/2015',
        '+23566000010',
        'j.nguet@exemple.td',
        null,
      ],
      [null, 'Fatime', 'Abakar', 'Physique', '2016-10-01', '+23566000011', null, null],
      [
        'NDS-DEMO-2026-T00001',
        'Moussa',
        'Djaou',
        'Francais',
        '02/09/2018',
        '+23566000012',
        null,
        null,
      ],
      [
        null,
        'Clarisse',
        'Nadjita',
        'Anglais',
        '15/01/2020',
        '+23566000013',
        'c.nadjita@exemple.td',
        null,
      ],
    ],
    [],
    TEACHER_DESCRIPTIONS
  );

  writeWorkbook(
    'responsables_exemple.xlsx',
    GUARDIAN_COLUMNS,
    [
      [
        'Aminata',
        'Mahamat',
        '+23566000030',
        'aminata.mahamat@exemple.td',
        'N Djamena',
        'NDS-DEMO-2026-X00001',
      ],
      ['Ibrahim', 'Ousmane', '+23566000031', null, null, null],
      ['Fatime', 'Abakar', '+23566000032', null, null, null],
    ],
    [],
    GUARDIAN_DESCRIPTIONS
  );
}

function writeAvecErreurs() {
  writeWorkbook(
    'eleves_avec_erreurs.xlsx',
    STUDENT_COLUMNS,
    [
      [null, 'Aminata', 'Mahamat', 'F', '14/03/2012', 'Tchadienne', '+23566000001'],
      [null, '', 'Ousmane', 'M'], // missing first name
      ['NDS-DEMO-2026-X00002', 'Ali', 'Ahmat', 'XX'], // invalid sex
      ['NDS-DEMO-2026-X00002', 'Fatime', 'Ousmane', 'F'], // duplicate code
      [null, 'Mahamat', 'Issa', 'M', '03/09/2012'],
      [null, 'Aicha', 'Brahim', 'F', '30/11/2010'],
    ],
    [],
    STUDENT_DESCRIPTIONS
  );
}

function writeWorkbook(filename, columns, dataRows, exampleRows, descriptions) {
  const workbook = XLSX.utils.book_new();
  const dataSheet = XLSX.utils.aoa_to_sheet([columns, ...dataRows]);
  dataSheet['!cols'] = columns.map((label) => ({ wch: Math.max(label.length + 4, 18) }));
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Donnees');

  const readmeRows = [
    ['Colonne', 'Requis', 'Description'],
    ...columns.map((label, index) => [label, descriptions[index], descriptions[index] ?? '']),
    [],
    ['Remarques'],
    ['- Ne modifiez pas la premiere ligne : elle contient les en-tetes.'],
    ['- Ajoutez une ligne par personne a partir de la ligne 2 ; les lignes vides sont ignorees.'],
    ["- Les dates s'ecrivent JJ/MM/AAAA (ex. 14/03/2012) ou AAAA-MM-JJ (ex. 2012-03-14)."],
    ['- Sexe : M, F ou AUTRE.'],
    ['- Code : optionnel. Laisses vide, un code est genere automatiquement.'],
    ["- Un code utilise deux fois dans le fichier (ou deja present dans l'ecole) est refuse."],
    ["- Ligne d'exemple : voir la feuille « Exemples » (non importee)."],
  ];
  const readmeSheet = XLSX.utils.aoa_to_sheet(readmeRows);
  readmeSheet['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, readmeSheet, 'Mode d emploi');

  const examplesSheet = XLSX.utils.aoa_to_sheet([columns, ...exampleRows]);
  examplesSheet['!cols'] = dataSheet['!cols'];
  XLSX.utils.book_append_sheet(workbook, examplesSheet, 'Exemples');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  writeFileSync(join(outputDir, filename), buffer);
}
