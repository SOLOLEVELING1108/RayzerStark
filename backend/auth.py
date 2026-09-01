"""Single-admin JWT auth (Bearer). Admin credentials come from env."""
import os
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import Request, HTTPException

JWT_ALGO = "HS256"
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"].strip().lower()
_admin_hash = bcrypt.hashpw(os.environ["ADMIN_PASSWORD"].encode("utf-8"), bcrypt.gensalt())


def verify_credentials(email: str, password: str) -> bool:
    if (email or "").strip().lower() != ADMIN_EMAIL:
        return False
    try:
        return bcrypt.checkpw((password or "").encode("utf-8"), _admin_hash)
    except Exception:
        return False


def create_token(email: str) -> str:
    payload = {
        "sub": email, "role": "admin", "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGO)


def require_admin(request: Request):
    header = request.headers.get("Authorization", "")
    token = header[7:] if header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Sem permissão")
    return {"email": payload.get("sub"), "role": "admin"}
