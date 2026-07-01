# AI Prompt Validation API

Validates user prompts using the **OpenAI Moderation API** before they are sent to Stability AI (or any image generation service). Designed as a lightweight, secure middleware between a Flutter frontend and Stability AI.

## Flow

```
Flutter App → POST /api/v1/prompts/validate → OpenAI Moderation API → Result → Flutter decides to call Stability AI
```

The backend **does not generate images**. It only validates prompts.

---

## Tech Stack

- **Node.js** (LTS, v20+)
- **Express.js**
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

| Variable         | Required | Default | Description                         |
| ---------------- | -------- | ------- | ----------------------------------- |
| `PORT`           | No       | `3000`  | Server port                         |
| `OPENAI_API_KEY` | Yes      | —       | OpenAI API key with moderation access |

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

## Folder Structure

```
prompt-validator-api/
├── src/
│   ├── config/
│   │   └── openai.js              # OpenAI SDK client
│   ├── controllers/
│   │   └── prompt.controller.js   # Request handler
│   ├── middleware/
│   │   ├── errorHandler.js         # Global error handler
│   │   └── validateRequest.js      # Joi validation
│   ├── routes/
│   │   └── prompt.routes.js        # Route definitions
│   ├── services/
│   │   └── moderation.service.js   # OpenAI moderation logic
│   ├── utils/
│   │   └── logger.js               # Winston logger
│   └── app.js                      # Express app setup
├── server.js                       # Entry point
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Troubleshooting

| Issue                        | Likely Cause                    | Solution                                     |
| ---------------------------- | ------------------------------- | -------------------------------------------- |
| `401 Invalid API key`        | Missing or wrong `OPENAI_API_KEY` | Check `.env` file and verify the key in OpenAI dashboard |
| `429 Too many requests`      | Exceeded rate limit             | Wait or increase `RATE_LIMIT_MAX` in `.env`  |
| `ECONNREFUSED` at startup    | Port in use                     | Change `PORT` in `.env` or kill the process  |
| OpenAI returns an error      | Quota / billing issue           | Verify OpenAI account has billing enabled    |

---

## Deployment

### Render / Railway / Fly.io

1. Push the repo to GitHub.
2. Create a new web service pointing at the repo.
3. Set the start command: `npm start`.
4. Add `OPENAI_API_KEY` as an environment variable in the dashboard.

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
