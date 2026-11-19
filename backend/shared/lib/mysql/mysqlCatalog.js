import { Prisma } from '@prisma/client';

let catalog;

export function getCatalog() {
  if (catalog) return catalog;
  const tables = new Map();
  for (const model of Prisma.dmmf.datamodel.models) {
    const fields = new Map();
    const pk = [];
    for (const field of model.fields) {
      if (field.kind !== 'scalar' && field.kind !== 'enum') continue;
      fields.set(field.name, {
        name: field.name,
        type: field.type,
        nativeType: field.nativeType?.[0] || null,
        isId: field.isId,
        defaultName: field.default?.name || null,
      });
      if (field.isId) pk.push(field.name);
    }
    tables.set(model.name, { name: model.name, fields, pk });
  }
  catalog = tables;
  return catalog;
}
