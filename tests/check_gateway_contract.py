"""Optional offline Node gateway -> Python verifier regression check.

Uses public synthetic fixtures only; requires an explicit backend checkout path.
No API, environment files, SQLite, providers or network are used.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys


def guard(event, args):
    if event in ('socket.connect', 'socket.getaddrinfo', 'sqlite3.connect'):
        raise RuntimeError('Offline contract check')
    if event == 'open' and isinstance(args[0], (str, bytes)):
        name = Path(args[0].decode() if isinstance(args[0], bytes) else args[0]).name
        if name == '.env' or name.startswith('.env.'):
            raise RuntimeError('Environment files forbidden')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend', required=True, type=Path)
    args = parser.parse_args()
    sys.addaudithook(guard)
    backend = args.backend.resolve()
    sys.path.insert(0, str(backend))
    from src.gateway_assertions import GatewayAssertionVerifier, VerificationKey, AssertionError as Rejected
    tests = Path(__file__).resolve().parent
    fixture_path = tests / 'fixtures/gateway_assertions_v1.json'
    f = json.loads(fixture_path.read_text())
    assert fixture_path.read_bytes() == (backend / 'tests/fixtures/gateway_assertions_v1.json').read_bytes()
    key = f['policy']['currentKey']
    verifier = GatewayAssertionVerifier(issuer=f['policy']['issuer'], audience=f['policy']['audience'],
        ip_source=f['policy']['ipSource'], current_key=VerificationKey(key['kid'], bytes.fromhex(key['secret_hex']),
        key['notBefore'], key['notAfter']))
    output = subprocess.run(['node', str(tests / 'helpers/gateway-contract-capture.mjs')],
                            capture_output=True, text=True, check=True, timeout=15)
    result = json.loads(output.stdout)
    checks, nonces = 0, set()
    for capture in result['captures']:
        headers = capture['headers']
        body = base64.b64decode(capture['body_base64'])
        compact = headers['X-Portfolio-Gateway-Assertion']
        assert capture['url'] == 'https://backend.example.test/internal/session-chat'
        assert set(headers) == {'Authorization', 'Content-Type', 'X-Portfolio-Session', 'X-Portfolio-Gateway-Assertion'}
        assert headers['Authorization'] == 'Bearer ' + 'c' * 43
        options = dict(session_token=headers['X-Portfolio-Session'], body=body,
                       method='POST', path='/internal/session-chat', now=f['now'])
        verified = verifier.verify(compact, **options)
        assert verified.body_sha256 == hashlib.sha256(body).hexdigest()
        nonces.add(verified.nonce)
        checks += 1
        for mismatch in ({'body': body+b' '}, {'session_token': base64.urlsafe_b64encode(b'Z'*32).rstrip(b'=').decode()},
                         {'method': 'GET'}, {'path': '/chat'}, {'now': f['now']+30}):
            try:
                verifier.verify(compact, **{**options, **mismatch})
            except Rejected:
                pass
            else:
                raise AssertionError('Binding did not fail closed')
            checks += 1
    assert len(nonces) == len(result['captures'])
    print(f"PASS: {result['negative']} independent Node negatives; {len(nonces)} gateway assertions verified by Python; {checks} contract checks.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
