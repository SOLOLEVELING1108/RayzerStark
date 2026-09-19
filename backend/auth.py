"""Supabase-integrated JWT auth (Bearer)."""
import os
from datetime import datetime, timezone, timedelta
import jwt
from fastapi import Request, HTTPException

# 🔴 Importamos a ligação ao Supabase que já existe no teu projeto!
from supa import supabase

JWT_ALGO = "HS256"
JWT_SECRET = os.environ.get("JWT_SECRET", "chave_secreta_super_segura_rayzer_stark_2026")

def verify_credentials(email: str, password: str) -> bool:
    """A validação agora é feita DIRETAMENTE no banco de dados do Supabase!"""
    try:
        # Tenta fazer login na Autenticação Oficial do Supabase
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        
        # Se o Supabase devolver os dados do utilizador, a senha está correta!
        if response.user:
            # Fazemos logout imediato na API (pois só queríamos validar se a senha estava certa)
            supabase.auth.sign_out()
            return True
        return False
    except Exception as e:
        print(f"Erro de login (Acesso Negado): {e}")
        return False

def create_token(email: str) -> str:
    payload = {
        "sub": email, "role": "admin", "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def create_affiliate_token(affiliate_id: str, name: str) -> str:
    payload = {
        "sub": f"affiliate:{affiliate_id}", "role": "affiliate",
        "affiliate_id": str(affiliate_id), "name": name, "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def decode_token(request: Request) -> dict:
    header = request.headers.get("Authorization", "")
    token = header[7:] if header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

def require_admin(request: Request):
    header = request.headers.get("Authorization", "")
    token = header[7:] if header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Sem permissão")
    return {"email": payload.get("sub"), "role": "admin"}