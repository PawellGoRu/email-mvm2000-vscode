-- Открывает готовый HTML-шаблон письма в новом окне compose Apple Mail (macOS).
--
-- Использование (в Терминале на Mac, из корня папки проекта):
--   node scripts/build-mail-template.mjs
--   open -a "Mail" --args ...   -- НЕ подходит; вместо этого:
--   osascript scripts/build-mail-template.applescript "$(pwd)/preview/mail-template.html"
--
-- Аргумент: абсолютный путь к preview/mail-template.html (обязательный).
--
-- Что происходит дальше (вручную, один раз):
--   1. Mail откроет файл в окне предпросмотра/составления — проверьте, что
--      баннер и текст отображаются корректно.
--   2. Выделите всё (Cmd+A), скопируйте (Cmd+C).
--   3. Файл > Новое сообщение (Cmd+N) -> Вставьте (Cmd+V) в тело письма.
--   4. Заполните тему: "Высоковольтные испытательные и измерительные системы PowerHV".
--   5. Сохраните как шаблон: перетащите письмо в ящик "Шаблоны" (или
--      Файл > Сохранить как... -> выберите ящик шаблонов). Mail хранит
--      шаблоны в ~/Library/Mail Templates / ящике «Templates».
--
-- Перед каждой рассылкой: Файл > Создать на основе шаблона, подставьте
-- имя получателя вместо {{firstName}} {{lastName}} и адрес в поле Кому.

on run argv
	if (count argv) < 1 then
		error "Usage: osascript build-mail-template.applescript /absolute/path/to/mail-template.html"
	end if
	set htmlPath to item 1 of argv

	tell application "Finder"
		open POSIX file htmlPath
	end tell
	tell application "Mail" to activate
end run
