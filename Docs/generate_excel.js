const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'kpi_mass_import_sample_30.csv');
const xlsxPath = path.join(__dirname, 'kpi_mass_import_sample_30.xlsx');

const csvText = fs.readFileSync(csvPath, 'utf-8');
const lines = csvText.trim().split('\n');
const data = lines.map(line => line.split(','));

const ws = XLSX.utils.aoa_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'KPIs');
XLSX.writeFile(wb, xlsxPath);
console.log('Excel file created at:', xlsxPath);
