import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Собирает HTML для импорта в менеджр писем Apple Mail (macOS).
//
// Использование:
//   node scripts/build-mail-template.mjs [выходной_файл]
//
// Результат: preview/mail-template.html — письмо с base64-баннером
// (data: URI). Такой HTML можно открыть в браузере, скопировать из него
// отрендеренное содержимое и вставить в новое сообщение Apple Mail —
// картинка перенесётся в письмо вместе с форматированием.
// Токены персонализации {{firstName}} {{lastName}} остаются в тексте:
// подставьте имя получателя перед каждой отправкой.

const projectRoot = resolve(import.meta.dirname, '..');
const htmlPath = resolve(projectRoot, 'src/email-responsive.html');
const outputPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(projectRoot, 'preview/mail-template.html');

const sourceHtml = readFileSync(htmlPath, 'utf8');
if (!sourceHtml.includes('data:image/jpeg;base64,')) {
  throw new Error(`Base64 banner not found in ${htmlPath}`);
}

// Баннер уже встроен как data: URI — копируем исходный HTML без изменений.
const mailHtml = sourceHtml;

mkdirSync(resolve(outputPath, '..'), { recursive: true });
writeFileSync(outputPath, mailHtml, 'utf8');
console.log(`Mail template written to ${outputPath}`);
