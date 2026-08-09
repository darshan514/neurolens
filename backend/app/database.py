import socket
from urllib.parse import urlsplit

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


def _ipv4_hostaddr(url: str) -> str | None:
    """Resolve the URL host to an IPv4 address, preferring A records.

    Supabase hosts frequently publish AAAA (IPv6) records first; containers
    (Render, etc.) often lack IPv6, so psycopg would pick the unreachable
    address. Passing `hostaddr` pins the connection to IPv4.
    """
    try:
        host = urlsplit(url).hostname
        if not host:
            return None
        infos = socket.getaddrinfo(host, None, socket.AF_INET, socket.SOCK_STREAM)
        return infos[0][4][0]
    except Exception:
        return None


_connect_args: dict = {}
if settings.database_url.startswith("postgresql+psycopg:"):
    _connect_args = {"sslmode": "require", "connect_timeout": 15}
    addr = _ipv4_hostaddr(settings.database_url)
    if addr:
        _connect_args["hostaddr"] = addr

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    connect_args=_connect_args,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
