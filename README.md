# IRCTC Extension + Auth Server

## What was added
- Password-protected extension flow (register/login/logout in popup).
- Token verification against backend server before extension features are shown.
- Small Node.js server for registration/login/token-verify.
- Separate web frontend to manually test auth API.

## Run auth server
```bash
cd server
npm install
npm start
```

Server runs on `http://localhost:3000` by default.

## API endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/verify` (Bearer token)
- `GET /health`

## Extension setup
1. Start the server.
2. Load extension in Chrome (`chrome://extensions` -> Load unpacked).
3. Open extension popup, register, then login.
4. After login, normal extension features appear.

## Production notes
- Change `JWT_SECRET` using environment variable.
- Update `API_BASE_URL` in `popupAuth.js` and `host_permissions` in `manifest.json` to your deployed domain.
