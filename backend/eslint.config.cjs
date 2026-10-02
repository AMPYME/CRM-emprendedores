/**
 * @fileoverview ESLint flat config — frontera de base de datos.
 * - @prisma/client solo en infrastructure/database y config/database (legacy bridge)
 * - Prohibido $queryRawUnsafe / $executeRawUnsafe
 */
const dbBoundaryFiles = [
  'src/infrastructure/database/**/*.ts',
  'src/config/database.ts',
  'src/config/soft-delete.ts',
];

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  {
    files: ['src/**/*.ts'],
    ignores: dbBoundaryFiles,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              message:
                'Importe solo desde src/infrastructure/database. El Backend no debe usar Prisma Client fuera de la frontera DB.',
            },
          ],
          patterns: [
            {
              group: ['**/config/database', '**/config/database.ts'],
              message: 'Use src/infrastructure/database en lugar de config/database.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='$queryRawUnsafe']",
          message: 'Prohibido $queryRawUnsafe. Use $queryRaw parametrizado vía infrastructure/database.',
        },
        {
          selector: "MemberExpression[property.name='$executeRawUnsafe']",
          message: 'Prohibido $executeRawUnsafe. Use $executeRaw parametrizado vía infrastructure/database.',
        },
      ],
    },
  },
  {
    files: dbBoundaryFiles,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='$queryRawUnsafe']",
          message: 'Prohibido $queryRawUnsafe incluso en la frontera DB.',
        },
        {
          selector: "MemberExpression[property.name='$executeRawUnsafe']",
          message: 'Prohibido $executeRawUnsafe incluso en la frontera DB.',
        },
      ],
    },
  },
];
