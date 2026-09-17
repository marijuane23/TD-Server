import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TeacherExcelService } from '../src/services/teacherExcel.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateTemplateFile() {
  const templatesDir = path.resolve(__dirname, '../templates');
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }

  const buffer = await TeacherExcelService.generateTemplateBuffer();
  const filePath = path.join(templatesDir, 'teacher-import-template.xlsx');
  fs.writeFileSync(filePath, buffer);
  console.log(` Saved template file to: ${filePath}`);
}

generateTemplateFile();
