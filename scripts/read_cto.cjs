const XLSX = require('xlsx');
const path = 'C:\\Users\\Mario\\Downloads\\INVENTARIO GRUPO IMU QEB DIGITAL CON CTO (2).xlsx';
const wb = XLSX.readFile(path);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { defval: null });

const ctos = new Set();
let withCto = 0;
let withoutCto = 0;
for (const row of data) {
  const cto = row['CTO '] || row['CTO'];
  if (cto) {
    ctos.add(cto);
    withCto++;
  } else {
    withoutCto++;
  }
}
console.log('Total rows:', data.length);
console.log('With CTO:', withCto);
console.log('Without CTO:', withoutCto);
console.log('Unique CTO values:', Array.from(ctos).sort());
console.log('\nSample codigo_unico -> CTO:');
for (let i = 0; i < 10 && i < data.length; i++) {
  console.log('  ', data[i]['codigo_unico '], '->', data[i]['CTO '] || data[i]['CTO']);
}
