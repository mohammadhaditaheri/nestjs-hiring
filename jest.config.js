const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig');

module.exports = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: 'src',
    testRegex: '.*\\.spec\\.ts$',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    collectCoverageFrom: ['**/*.(t|j)s'],
    coverageDirectory: '../coverage',
    testEnvironment: 'node',
    transformIgnorePatterns: [
        'node_modules/(?!(uuid)/)',
    ],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^@/config/(.*)$': '<rootDir>/config/$1',
        '^@/modules/(.*)$': '<rootDir>/modules/$1',
        '^@/shared/(.*)$': '<rootDir>/shared/$1',
    },
};