import os
from fastapi import Request, HTTPException
import jwt


SUPABASE_JWKS = {
    "keys": [
        {
            "x": "c2B19uCoenDmiTWnrCSUelIvsaHgK03IpPRKrJ13NlQ",
            "y": "CnMz6g_LzjoyrN2FSZ3h_RpgtffIIa5ha2LOg8qZHNA",
            "alg": "ES256",
            "crv": "P-256",
            "ext": True,
            "kid": "b8e21536-cf32-4ab7-9901-c42afcc2cae2",
            "kty": "EC",
            "key_ops": ["verify"],
        }
    ]
}

_jwk_client = jwt.PyJWKSet.from_dict(SUPABASE_JWKS)


def _get_signing_key(token: str):
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    for key in _jwk_client.keys:
        if key.key_id == kid:
            return key
    raise jwt.InvalidTokenError(f"No matching key found for kid: {kid}")


async def get_current_user(request: Request) -> str:
    """Extract and validate Supabase JWT. Returns user_id."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = auth_header.split(" ", 1)[1]

    try:
        signing_key = _get_signing_key(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no sub claim")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
