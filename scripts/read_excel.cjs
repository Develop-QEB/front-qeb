const XLSX = require('xlsx');
const path = 'C:\\Users\\Mario\\Downloads\\INVENTARIO GRUPO IMU QEB DIGITAL CON CTO (2).xlsx';
const wb = XLSX.readFile(path);
console.log('Sheets:', wb.SheetNames);
for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  console.log('\n=== Sheet:', sheetName, '===');
  console.log('Total rows:', data.length);
  if (data.length > 0) {
    console.log('Headers (row 1):');
    console.log(JSON.stringify(data[0], null, 2));
    if (data.length > 1) {
      console.log('\nSample row 2:');
      console.log(JSON.stringify(data[1], null, 2));
    }
    if (data.length > 2) {
      console.log('\nSample row 3:');
      console.log(JSON.stringify(data[2], null, 2));
    }
  }
}
