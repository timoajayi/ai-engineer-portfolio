"""Test-only boundary: no network, real dotenv files or persistent databases."""
from pathlib import Path
import sys
import tempfile
from urllib.parse import unquote


def install(frontend, backend):
    protected = (Path(frontend).resolve(), Path(backend).resolve())
    temporary = Path(tempfile.gettempdir()).resolve()

    def guard(event, args):
        if event in ('socket.connect', 'socket.getaddrinfo'):
            raise RuntimeError('Offline security test: network forbidden')
        if event == 'open' and isinstance(args[0], (str, bytes)):
            path = Path(args[0].decode() if isinstance(args[0], bytes) else args[0]).resolve()
            if (path.name == '.env' or path.name.startswith('.env.')) and any(
                    path == root or root in path.parents for root in protected):
                raise RuntimeError('Offline security test: environment files forbidden')
        if event == 'sqlite3.connect':
            name = str(args[0])
            if name == ':memory:':
                return
            if name.startswith('file:'):
                name = unquote(name[5:].split('?', 1)[0])
            path = Path(name).resolve()
            if temporary not in path.parents:
                raise RuntimeError('Offline security test: persistent database forbidden')
    sys.addaudithook(guard)
