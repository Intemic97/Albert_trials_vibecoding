/**
 * Exporta entities del seed de planta de plastico (Repsol)
 * a un JSON importable por el Use Case Importer.
 *
 * Uso:
 *   node server/export-repsol-entities.js
 *   node server/export-repsol-entities.js ./ruta/salida.json
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const seedPath = path.resolve(__dirname, 'seed-plastics-plant.js');
const defaultOut = path.resolve(__dirname, 'repsol-entities-package.json');
const outPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : defaultOut;

function extractConstArray(source, constName) {
  const token = `const ${constName} =`;
  const start = source.indexOf(token);
  if (start === -1) {
    throw new Error(`No se encontro "${token}" en seed-plastics-plant.js`);
  }

  const arrayStart = source.indexOf('[', start);
  if (arrayStart === -1) {
    throw new Error(`No se encontro inicio de array para "${constName}"`);
  }

  let depth = 0;
  let inString = false;
  let stringQuote = '';
  let escaped = false;
  let end = -1;

  for (let i = arrayStart; i < source.length; i++) {
    const ch = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringQuote = ch;
      continue;
    }

    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error(`No se pudo cerrar el array "${constName}"`);
  }

  const literal = source.slice(arrayStart, end + 1);
  return vm.runInNewContext(`(${literal})`);
}

function main() {
  if (!fs.existsSync(seedPath)) {
    throw new Error(`No existe ${seedPath}`);
  }

  const source = fs.readFileSync(seedPath, 'utf8');
  const entities = extractConstArray(source, 'entities');

  const pkg = {
    name: 'Entities Repsol - Planta Plastico',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    entities,
    records: []
  };

  fs.writeFileSync(outPath, JSON.stringify(pkg, null, 2), 'utf8');

  console.log(`Export completado en: ${outPath}`);
  console.log(`Entities exportadas: ${entities.length}`);
}

main();
