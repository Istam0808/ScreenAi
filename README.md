# ScreenAI

Десктопное приложение: скриншот по горячим клавишам и анализ через Google AI (Gemini).

- **Next.js** — интерфейс и API
- **Electron** — окно и глобальные горячие клавиши
- **SASS** — стили

## Требования

- Node.js 18+
- API-ключ [Google AI Studio](https://aistudio.google.com/apikey)

## Установка

```bash
npm install
cp .env.example .env.local
```

В `.env.local` укажите:

```
GOOGLE_GENAI_API_KEY=ваш_ключ
```

## Разработка

В одном терминале:

```bash
npm run dev
```

В другом:

```bash
npm run electron:dev
```

По умолчанию горячие клавиши: **Ctrl+Shift+S** (или Cmd+Shift+S на macOS). Нажатие открывает окно, делает скриншот экрана и отправляет его в Google AI; ответ отображается в приложении.

Настройки (другая комбинация клавиш) — страница «Настройки» в приложении.

## Сборка

```bash
npm run build
npm run electron:build
```

Установщик появится в папке `dist/`.

Перед запуском собранного приложения нужно поднять Next.js-сервер в каталоге приложения (где есть `.next` и `node_modules`):

```bash
npm run start
```

После этого запускайте приложение ScreenAI — оно откроет окно на `http://localhost:3000`.
