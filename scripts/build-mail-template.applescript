-- Переносит готовое письмо в Apple Mail (macOS) БЕЗ copy-paste из браузера.
--
-- Проблема, которую решает этот скрипт: при копировании HTML-файла из
-- браузера Mail иногда обрезает часть абзацев письма («пропала половина
-- текста»). Здесь письмо импортируется напрямую как .eml — содержимое
-- переносится целиком, включая баннер (inline-MIME cid:) и подпись.
--
-- Использование (в Терминале на Mac, из корня папки проекта):
--   npm run build-eml
--   osascript scripts/build-mail-template.applescript "$(pwd)/dist/powerhv-introduction.eml"
--
-- Что происходит:
--   1. Скрипт открывает .eml в Mail (письмо появится в новом окне/предпросмотре).
--   2. В этом письме нажмите «Переслать» (Forward, Cmd+Shift+F) — все
--      абзацы и картинка сохранятся полностью.
--   3. Исправьте тему на "Высоковольтные испытательные и измерительные
--      системы PowerHV", подставьте имя получателя вместо токенов
--      {{firstName}} {{lastName}} (если они остались) и адрес в поле «Кому».
--   4. Сохраните как шаблон: Файл > Сохранить как шаблон (ящик Templates).
-- Дальнейшие рассылки: Файл > Создать на основе шаблона.

on run argv
        if (count argv) < 1 then
                error "Usage: osascript build-mail-template.applescript /absolute/path/to/message.eml"
        end if
        set emlPath to item 1 of argv

        tell application "Mail"
                activate
                open emlPath
        end tell
end run
