# DreamPics API — Implementation Guide

## Use this as a prompt for an AI coding assistant

> Implement a Dart HTTP client in my Flutter app that integrates with the
> DreamPics backend API described below. Use the `http` (or `dio`) package and
> model classes with `json_serializable` if available. Include a service class,
> proper error handling for the JSON error shapes, and a widget that loads and
> renders the Trending Photos grid with thumbnails.

---

## Base URL

```
https://dreambackend-27pn.onrender.com
```

All public endpoints below require **no API key**. Use `application/json` for
request bodies.

---

## Public endpoints

### 1. Health check

```
GET /health
```

| Field | Type |
|-------|------|
| `status` | string (`"ok"`) |

### 2. Validate a prompt (OpenAI Moderation)

```
POST /api/v1/prompts/validate
```

**Request body**

| Field | Type | Rule |
|-------|------|------|
| `prompt` | string | required, 1–4000 chars |

```json
{
  "prompt": "A couple on a beach at sunset"
}
```

**Response (safe)**

```json
{
  "success": true,
  "allowed": true,
  "flagged": false,
  "message": "Prompt is safe."
}
```

**Response (flagged/unsafe)**

```json
{
  "success": true,
  "allowed": false,
  "flagged": true,
  "categories": { "sexual": false, "hate": false, "harassment": true, "..." : false },
  "scores": { "sexual": 0.001, "hate": 0.02, "harassment": 0.9, "..." : 0.01 },
  "message": "Prompt violates safety policy."
}
```

**Validation error (HTTP 400)**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": ["prompt is required"]
}
```

Only send a prompt to your image generator when `allowed` is `true`.

---

### 3. List published trends

```
GET /api/v1/trends/
```

**Response (HTTP 200)**

```json
{
  "success": true,
  "data": [
    {
      "id": "fbbf8864-faad-42ae-bd84-4c7c8750c78a",
      "title": "Sunset Couple",
      "description": "",
      "category": "Couple",
      "thumbnailUrl": "/api/v1/trends/fbbf8864-faad-42ae-bd84-4c7c8750c78a/image",
      "prompt": "A couple holding hands on a beach at sunset",
      "negativePrompt": "",
      "requiresPhoto": true,
      "allowCustomPrompt": false,
      "aspectRatio": "1:1",
      "sortOrder": 1,
      "createdAt": "2026-09-13T14:12:05.000Z",
      "updatedAt": "2026-09-13T14:12:05.000Z"
    }
  ]
}
```

Notes:
- Only published trends are returned, sorted by `sortOrder` (then `createdAt`).
- `thumbnailUrl` is a **relative path** — prefix it with the base URL to load
  the image.

### 4. Trend thumbnail image

```
GET /api/v1/trends/:id/image
```

Returns the raw image binary (`Content-Type: image/jpeg|png|webp`),
cacheable for 1 day. Returns HTTP 404 when the image is missing.

### 5. Single published trend

```
GET /api/v1/trends/:id
```

**Response**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "title": "Sunset Couple",
    "description": "",
    "category": "Couple",
    "thumbnailUrl": "/api/v1/trends/.../image",
    "prompt": "A couple holding hands on a beach at sunset",
    "negativePrompt": "",
    "requiresPhoto": true,
    "allowCustomPrompt": false,
    "aspectRatio": "1:1",
    "sortOrder": 1,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

Returns HTTP 404 for unknown ids or non-published trends.

### 6. Trend categories

```
GET /api/v1/trends/categories
```

**Response**

```json
{
  "success": true,
  "data": ["Couple", "Wedding", "Bollywood"]
}
```

Derived from published trends only.

### 7. Generate an image from a photo + prompt

```
POST /api/v1/images/generate
```

Takes the user's photo plus an editing prompt and generates a new image via
OpenAI Images Edit (`gpt-image-1` by default). The prompt is checked by the
OpenAI moderation API first.

**Request body**

| Field | Type | Rule |
|-------|------|------|
| `prompt` | string | required, 1–32000 chars |
| `image` | string | required, base64 data URL (`data:image/jpeg\|png\|webp;base64,...`), jpeg/png/webp, < 25MB |
| `size` | string | optional: `1024x1024` (square), `1536x1024` (landscape), `1024x1536` (portrait); defaults to `auto` |

```json
{
  "prompt": "Transform this person into a professional studio portrait",
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "size": "1024x1536"
}
```

**Response (HTTP 200)**

```json
{
  "success": true,
  "data": {
    "b64_json": "iVBORw0KGgo...",
    "revised_prompt": "optional rewritten prompt"
  }
}
```

`b64_json` is the generated image (PNG) encoded in base64 — decode it to bytes
in the app.

**Error responses**

```json
{
  "success": false,
  "message": "Prompt violates safety policy.",
  "errors": ["optional detail array"]
}
```

- `400` — validation failure or an unsafe prompt.
- `429` — OpenAI rate limit / server rate limit (10 req/min default).
- `500/503` — backend failure.

---

## Error shape (all endpoints)

Non-2xx responses wrap errors consistently:

```json
{
  "success": false,
  "message": "Human-readable message",
  "errors": ["optional detail array"]
}
```

Status codes you may see: `400` (validation), `404` (not found), `429` (rate
limited), `503` (backend not configured / MongoDB unavailable).

---

## Flutter/Dart implementation sketch

```dart
// lib/services/api_client.dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiClient {
  ApiClient(this.baseUrl);

  final String baseUrl;

  Future<Map<String, dynamic>> _get(String path) async {
    final res = await http.get(Uri.parse('$baseUrl$path'));
    return _decode(res.body, res.statusCode);
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    return _decode(res.body, res.statusCode);
  }

  Map<String, dynamic> _decode(String raw, int status) {
    final json = jsonDecode(raw) as Map<String, dynamic>;
    if (status < 200 || status >= 300) {
      throw ApiException(
        status,
        json['message'] as String? ?? 'Request failed',
        (json['errors'] as List?)?.cast<String>() ?? const [],
      );
    }
    return json;
  }

  Future<bool> validatePrompt(String prompt) async {
    final res = await _post('/api/v1/prompts/validate', {'prompt': prompt});
    return res['allowed'] == true;
  }

  Future<List<Map<String, dynamic>>> fetchTrends() async {
    final res = await _get('/api/v1/trends');
    return (res['data'] as List).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> generateImage({
    required String prompt,
    required Uint8List imageBytes,
    String mime = 'image/jpeg',
    String? size,
  }) async {
    final base64Image = base64Encode(imageBytes);
    final body = <String, dynamic>{
      'prompt': prompt,
      'image': 'data:$mime;base64,$base64Image',
      if (size != null) 'size': size,
    };
    final res = await _post('/api/v1/images/generate', body);
    final data = res['data'] as Map<String, dynamic>? ?? const {};
    return {
      'bytes': base64Decode(data['b64_json'] as String? ?? ''),
      'revisedPrompt': data['revised_prompt'],
    };
  }

  String imageUrl(String relative) => relative.startsWith('http')
      ? relative
      : '$baseUrl$relative';
}

class ApiException implements Exception {
  ApiException(this.statusCode, this.message, [this.errors = const []]);

  final int statusCode;
  final String message;
  final List<String> errors;

  @override
  String toString() => message;
}
```

```dart
// Grid usage
final trends = await api.fetchTrends();
// image: Image.network(api.imageUrl(trend['thumbnailUrl']))
// aspectRatio: use trend['aspectRatio'] ('1:1','16:9','9:16','4:5','3:4')
// requiresPhoto / allowCustomPrompt drive the photoreal generator flow.
```

---

## Workflow integration (full feature prompt)

Integrate validation + trend templates into the generation flow:

1. On app open, call `GET /api/v1/trends/` and show the grid filtered by
   `category` (use `GET /api/v1/trends/categories` for the chips).
2. When the user taps a trend, build the image request with its `prompt`
   (replace placeholders with user input when `allowCustomPrompt` is true),
   prepend the user photo when `requiresPhoto` is true.
3. Before sending to the image API, call `POST /api/v1/prompts/validate` with
   the final prompt. If `allowed` is `false`, block the request and show the
   flagged categories to the user.
4. Generate the final image by calling `POST /api/v1/images/generate` with the
   user photo and the final prompt (the server re-checks moderation and returns
   the generated image as `b64_json`).
5. Never cache images longer than the server `Cache-Control` max-age; rely on
   the `/:id/image` endpoint for thumbnails.