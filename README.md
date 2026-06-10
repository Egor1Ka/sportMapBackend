# Basketball Backend

Node.js (ES modules) API для баскетбольного приложения: авторизация через Google OAuth и хранение истории сессий аналитики бросков.

## Структура

- **Точка входа:** `src/app.js` — Express, CORS, cookie-parser, `connectDB()`, роуты, `listen`.
- **Роуты:** `src/routes/routes.js` подключает подроуты из `src/routes/subroutes/` (auth, sessions). Опционально префикс `API_PREFIX`.
- **Middleware:** `src/middleware/auth.js` — проверка JWT (cookie или `Authorization: Bearer`), запись пользователя в `req.user`.
- **Контроллеры:** `src/controllers/` — парсят `req`, вызывают сервисы, отдают ответ через `httpResponse` / `httpResponseError`.
- **Сервисы:** `src/services/` — бизнес-логика, вызов репозиториев и утилит.
- **Репозитории:** `src/repository/` — только вызовы Mongoose.
- **Модели:** `src/models/` — User, RefreshToken, Session.
- **DTO:** `src/dto/` — toDTO(doc), toEntity(dto).
- **Утилиты:** `src/utils/http/` — httpResponse, httpResponseError, httpStatus, parseAuthToken, HttpError, DomainError.

## Запуск

```bash
cp .env.example .env
# Заполнить .env (DB_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET и т.д.)
npm install
npm run dev
```

## API

### Авторизация

- **GET** `/auth/google` — редирект на Google OAuth (state в httpOnly cookie).
- **GET** `/auth/google/callback` — обработка callback, установка access/refresh в httpOnly cookies, редирект на `FRONTEND_URL`.
- **POST** `/auth/refresh` — по refresh cookie выдать новый access и обновить access cookie; в теле можно вернуть данные пользователя.

Фронт должен ходить с `credentials: true`. Доступ по cookie `accessToken` или заголовку `Authorization: Bearer <token>`.

### Сессии (все под auth)

- **POST** `/sessions` — тело: `{ source, shots_made, shots_total, accuracy, zones }`. Создать сессию для текущего пользователя.
- **GET** `/sessions` — список сессий пользователя (по убыванию timestamp).
- **GET** `/sessions/:id` — одна сессия (404, если не своя).
- **DELETE** `/sessions/:id` — удалить сессию (только своя).

`zones` — объект: ключи — строки зон (например `left_corner_three`), значения — `{ attempts, makes, accuracy_pct }`.

## Переменные окружения

См. `.env.example`. Обязательны: `DB_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`.

## Локальный webhook Creem (ngrok)

Чтобы Creem мог слать события на твой локальный бэкенд:

1. **Установи ngrok** (один раз):
   ```bash
   # macOS (Homebrew)
   brew install ngrok
   # или скачай с https://ngrok.com/download
   ```

2. **Запусти бэкенд** в одном терминале:
   ```bash
   npm run dev
   ```
   Должен слушать порт 9000.

3. **Подними туннель** в другом терминале:
   ```bash
   ngrok http 9000
   ```

4. **Скопируй HTTPS-URL** из вывода ngrok (например `https://a1b2c3d4.ngrok-free.app`).

5. **В Creem Dashboard** (Developers → Webhooks): создай webhook с URL:
   ```
   https://ТВОЙ_NGROK_URL/webhooks/creem
   ```
   Пример: `https://a1b2c3d4.ngrok-free.app/webhooks/creem`. Сохрани webhook и скопируй **Signing secret** в `.env` как `CREEM_WEBHOOK_SECRET`.

6. Пока окно ngrok открыто, запросы Creem будут идти на твой localhost:9000. При перезапуске ngrok URL поменяется — обнови URL в Creem (бесплатный план даёт новый адрес каждый раз).
