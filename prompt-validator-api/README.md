# AI Prompt Validation API + Trend Photos Admin

Backend for the **DreamPics AI Photo Generator** Flutter app. Provides:
1. Prompt safety validation via the OpenAI Moderation API.
2. Trend Photos management (CRUD, publish/unpublish, reorder, categories) for a private admin dashboard.

The backend **does not generate images** — image generation happens client-side via Stability AI.

---

## Tech Stack

- **Node.js** (LTS, v20+)
- **Express.js**
- **MongoDB** (official driver, `mongodb`)
- **OpenAI Official SDK**
- **Joi** — request validation
- **Winston** — logging
- **Helmet**, **CORS**, **express-rate-limit** — security
- **Morgan** — HTTP request logging
- **Nodemon** — development auto-restart

---

## Installation

```bash
git clone <repo-url>
cd prompt-validator-api
npm install
```

---

## Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

| Variable                 | Required | Default | Description                                                                 |
| ------------------------ | -------- | ------- | --------------------------------------------------------------------------- |
| `PORT`                   | No       | `3000`  | Server port                                                                 |
| `OPENAI_API_KEY`         | Yes      | —       | OpenAI API key with moderation access                                       |
| `ADMIN_API_KEY`          | Yes*     | —       | Secret key for the private admin dashboard (`X-Admin-Key` header)           |
| `MONGODB_URI`            | Yes*     | —       | MongoDB connection string (e.g. from Atlas free tier M0)                    |
| `MONGODB_DB`             | No       | `dreampics` | Database name                                                           |
| `RATE_LIMIT_MAX`         | No       | `30`    | Prompt validation rate limit per minute                                     |
| `TREND_RATE_LIMIT_MAX`   | No       | `120`   | Public trend read rate limit per minute                                     |
| `ADMIN_RATE_LIMIT_MAX`   | No       | `60`    | Admin endpoint rate limit per minute                                        |
| `CORS_ORIGIN`            | No       | `*`     | Allowed CORS origin                                                         |

\* Required when using the Trend Photos / admin features.

---

## Run Locally

```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

---

## API Endpoint

### `POST /api/v1/prompts/validate`

#### Request Body

```json
{
  "prompt": "A beautiful mountain landscape"
}
```

| Field    | Type   | Required | Constraints            |
| -------- | ------ | -------- | ---------------------- |
| `prompt` | string | Yes      | 1–4000 characters, trimmed |

#### Success — Safe Prompt

```json
{
  "success": true,
  "allowed": true,
  "flagged": false,
  "message": "Prompt is safe."
}
```

#### Success — Flagged Prompt

```json
{
  "success": true,
  "allowed": false,
  "flagged": true,
  "categories": {
    "sexual": false,
    "hate": false,
    "harassment": true,
    "self-harm": false,
    "sexual/minors": false,
    "hate/threatening": false,
    "violence/graphic": false,
    "self-harm/intent": false,
    "self-harm/instructions": false,
    "harassment/threatening": true,
    "violence": true
  },
  "scores": {
    "sexual": 3.5762786865234375e-7,
    "hate": 1.3234889836413472e-6,
    "harassment": 0.7394838333129883,
    "self-harm": 4.172325134277344e-7,
    "sexual/minors": 9.313225746154785e-8,
    "hate/threatening": 7.450580596923828e-8,
    "violence/graphic": 0.0002384185791015625,
    "self-harm/intent": 1.862645149230957e-7,
    "self-harm/instructions": 0,
    "harassment/threatening": 0.7492156624794006,
    "violence": 0.8196884989738464
  },
  "message": "Prompt violates safety policy."
}
```

#### Validation Error (400)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "prompt is required"
  ]
}
```

#### Rate Limited (429)

```json
{
  "success": false,
  "message": "Too many requests. Please try again later."
}
```

#### Server Error (500)

```json
{
  "success": false,
  "message": "Failed to validate prompt. Please try again."
}
```

---

## Trend Photos API

### Private admin dashboard

Served at **`/dashboard/`** on the same host. Opens with a login screen
where you enter the `ADMIN_API_KEY`. It talks only to the `/api/v1/admin/trends`
endpoints below, sending the key as the `X-Admin-Key` header.

### Admin endpoints (all require `X-Admin-Key`)

| Method | Path                              | Description                        |
| ------ | --------------------------------- | ---------------------------------- |
| GET    | `/api/v1/admin/trends`            | List all trends (incl. drafts)     |
| POST   | `/api/v1/admin/trends`            | Create a trend                     |
| PUT    | `/api/v1/admin/trends/:id`        | Update a trend (partial)           |
| PATCH  | `/api/v1/admin/trends/:id/status` | Publish / unpublish (`{ isPublished }`) |
| PATCH  | `/api/v1/admin/trends/reorder`    | Reorder (`{ ids: [id, id, …] }`)   |
| DELETE | `/api/v1/admin/trends/:id`        | Delete a trend                     |
| GET    | `/api/v1/admin/trends/categories` | List admin categories              |
| POST   | `/api/v1/admin/trends/categories` | Add category (`{ name }`)          |
| DELETE | `/api/v1/admin/trends/categories/:name` | Remove category               |

Creating/updating a trend re-uses the **same OpenAI moderation check** as
`/api/v1/prompts/validate`; flagged prompts are rejected with 400.

A trend payload:

```json
{
  "title": "Neon Portrait",
  "description": "Bold studio look",
  "category": "Fashion",
  "thumbnailBase64": "data:image/jpeg;base64,....",
  "prompt": "A neon-lit fashion portrait, studio quality",
  "negativePrompt": "blur, low quality",
  "allowCustomPrompt": false,
  "requiresPhoto": true,
  "aspectRatio": "1:1",
  "isPublished": false,
  "sortOrder": 1
}
```

- `thumbnailBase64` (≤ 8 MB JPEG/PNG/WebP) is stored as a binary inside
  MongoDB and served via `GET /api/v1/trends/:id/image`. You may alternatively
  pass `thumbnailUrl` to point at an external image.
- `aspectRatio`: `1:1`, `16:9`, `9:16`, `4:5`, `3:4`.

### Public endpoints (consumed by the Flutter app)

| Method | Path                           | Description                                 |
| ------ | ------------------------------ | ------------------------------------------- |
| GET    | `/api/v1/trends`               | All published trends, sorted by `sortOrder` |
| GET    | `/api/v1/trends/:id`           | A single published trend                    |
| GET    | `/api/v1/trends/:id/image`     | Trend thumbnail (binary JPEG/PNG/WebP)      |
| GET    | `/api/v1/trends/categories`    | Distinct categories from published trends   |

Public responses only expose user-safe fields (`id`, `title`, `description`,
`category`, `thumbnailUrl`, `prompt`, `negativePrompt`, `requiresPhoto`,
`allowCustomPrompt`, `aspectRatio`, `sortOrder`). The binary `thumbnail` field
is stripped from all JSON responses and only available via the image endpoint.

Trends, categories, and thumbnail binaries are all stored in MongoDB
(collections `trend_prompts` and `trend_categories`). No external file storage
is needed — an Atlas free-tier M0 cluster is sufficient.

---

## Folder Structure

```
prompt-validator-api/
├── public/
│   └── dashboard/                 # Private admin dashboard (vanilla HTML/CSS/JS)
├── src/
│   ├── config/
│   │   └── openai.js              # OpenAI SDK client
│   ├── controllers/
│   │   ├── prompt.controller.js   # Prompt validation handler
│   │   ├── trend.controller.js    # Public trend endpoints
│   │   └── adminTrend.controller.js # Admin trend + category endpoints
│   ├── middleware/
│   │   ├── errorHandler.js         # Global error handler
│   │   ├── validateRequest.js      # Joi validation (prompts)
│   │   ├── validateTrendRequest.js # Joi validation (trends)
│   │   └── adminAuth.js            # X-Admin-Key middleware
│   ├── routes/
│   │   ├── prompt.routes.js        # Route definitions
│   │   ├── trend.routes.js         # Public trend routes
│   │   └── adminTrend.routes.js    # Admin trend routes
│   ├── services/
│   │   ├── moderation.service.js   # OpenAI moderation logic
│   │   ├── trendModel.js           # Pure trend domain helpers
│   │   └── trendStore.js           # MongoDB store (trends + categories + thumbnails)
│   ├── utils/
│   │   ├── logger.js               # Winston logger
│   │   ├── httpError.js            # httpError(statusCode, message)
│   │   └── base64Image.js          # Base64 image data-URL parsing
│   └── app.js                      # Express app setup
├── test/                           # node --test unit tests
│   ├── adminAuth.test.js
│   ├── adminTrend.controller.test.js
│   ├── base64Image.test.js
│   ├── trendModel.test.js
│   └── validateTrendRequest.test.js
├── server.js                       # Entry point
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

Run the test suite (no external services required):

```bash
npm test
```

---

## Troubleshooting

| Issue                        | Likely Cause                    | Solution                                     |
| ---------------------------- | ------------------------------- | -------------------------------------------- |
| `401 Invalid API key`        | Missing or wrong `OPENAI_API_KEY` | Check `.env` file and verify the key in OpenAI dashboard |
| `429 Too many requests`      | Exceeded rate limit             | Wait or increase `RATE_LIMIT_MAX` in `.env`  |
| `ECONNREFUSED` at startup    | Port in use                     | Change `PORT` in `.env` or kill the process  |
| `503 Trend store is not configured` | `MONGODB_URI` missing     | Add your MongoDB connection string to `.env` |
| `503 Failed to connect to MongoDB` | Wrong URI / network / auth | Verify the URI, whitelist your IP, and check Atlas credentials |
| OpenAI returns an error      | Quota / billing issue           | Verify OpenAI account has billing enabled    |

---

## Deployment

### Render / Railway / Fly.io

1. Push the repo to GitHub.
2. Create a new web service pointing at the repo.
3. Set the start command: `npm start`.
4. Add environment variables in the dashboard:
   - `OPENAI_API_KEY`
   - `ADMIN_API_KEY`
   - `MONGODB_URI` — from MongoDB Atlas (Database → Connect → Drivers → copy the
     connection string, then replace `<password>`).

### MongoDB Atlas (free tier)

1. Create a free M0 cluster at https://www.mongodb.com/atlas.
2. Create a database user (read/write) and allow network access to
   `0.0.0.0/0` (or a specific deployment IP) under Network Access.
3. Copy the `mongodb+srv://…` connection string into `MONGODB_URI`.

### Docker (optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## License

MIT
