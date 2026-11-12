/**
 * Run: node --test backend/features/mandatory-fields/domain/__tests__/catalog.coverage.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  explainCatalogProblems,
  listMandatoryEligibleFields,
  listRegisteredFieldKeys,
  PROFILE_FIELD_CATALOG,
} from '../fieldRegistry.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(here, '../../../../prisma/schema.prisma');
const editorsPath = path.resolve(here, '../../../../../frontend/src/features/mandatory-fields/domain/fieldEditors.js');
const adminServicePath = path.resolve(here, '../../mandatoryFields.service.js');
const memberFillPath = path.resolve(here, '../../../../../frontend/src/features/mandatory-fields/components/MandatoryFieldFill.jsx');

function teamTableColumns(schemaText) {
  const start = schemaText.indexOf('model team_table {');
  const end = schemaText.indexOf('\nmodel ', start + 10);
  const body = schemaText.slice(start, end);
  const columns = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@') || trimmed.startsWith('model ')) continue;
    if (trimmed.includes('@relation')) continue;
    const match = trimmed.match(/^(\w+)\s+(\w+)(\[\])?/);
    if (!match || match[3]) continue;
    columns.push(match[1]);
  }
  return columns;
}

function editorKeys(source) {
  const start = source.indexOf('export const FIELD_EDITORS');
  const end = source.indexOf('};', start);
  const body = source.slice(start, end);
  return [...body.matchAll(/^\s{2}(\w+):\s*\{/gm)].map((match) => match[1]);
}

describe('profile field catalog coverage', () => {
  const columns = teamTableColumns(fs.readFileSync(schemaPath, 'utf8'));

  it('classifies every team_table column and no extra column', () => {
    assert.deepEqual(explainCatalogProblems(PROFILE_FIELD_CATALOG, columns), []);
  });

  it('rejects a new column with no eligibility, a duplicate, and an eligible field with no editor', () => {
    const missing = explainCatalogProblems(PROFILE_FIELD_CATALOG, [...columns, 'NewProfileValue']);
    assert.ok(missing.some((item) => item.includes('NewProfileValue')));
    const duplicate = explainCatalogProblems([
      ...PROFILE_FIELD_CATALOG,
      { ...PROFILE_FIELD_CATALOG[0], fieldKey: 'name-copy' },
    ], columns);
    assert.ok(duplicate.some((item) => item.includes('duplicate')));
    const noEditor = explainCatalogProblems([
      { fieldKey: 'fresh', column: 'Fresh', mandatoryEligible: true },
    ], ['Fresh']);
    assert.ok(noEditor.some((item) => item.includes('no editor')));
    assert.ok(noEditor.some((item) => item.includes('no save')));
    assert.ok(noEditor.some((item) => item.includes('no isFilled')));
    const noReason = explainCatalogProblems([
      { fieldKey: 'secret', column: 'Secret', mandatoryEligible: false },
    ], ['Secret']);
    assert.ok(noReason.some((item) => item.includes('no ineligible reason')));
  });

  it('shows only eligible fields to admin and member editors', () => {
    const eligible = listMandatoryEligibleFields().map((entry) => entry.fieldKey);
    assert.deepEqual(eligible, listRegisteredFieldKeys());
    assert.equal(eligible.includes('Password'), false);
    assert.equal(PROFILE_FIELD_CATALOG.some((entry) => entry.column === 'Password' && entry.mandatoryEligible === false), true);
    const editorSource = fs.readFileSync(editorsPath, 'utf8');
    assert.deepEqual(editorKeys(editorSource), eligible);
    const adminSource = fs.readFileSync(adminServicePath, 'utf8');
    assert.match(adminSource, /fieldRegistry\.js/);
    assert.doesNotMatch(adminSource, /secondFieldRegistry|profileFieldRegistry2/);
    const fillSource = fs.readFileSync(memberFillPath, 'utf8');
    assert.match(fillSource, /fieldEditors/);
  });
});
