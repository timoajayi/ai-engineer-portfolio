"""Test-only JSON-lines bridge to REAL ASGI guards and disposable SQLite.

No listening socket, environment files, real credentials or provider access.
The only identity resolver is the existing test fixture, never production code.
"""
import argparse
from datetime import timedelta
import json
from pathlib import Path
import sys

from offline_backend_guard import install


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--backend', required=True, type=Path)
    args = parser.parse_args()
    backend = args.backend.resolve()
    install(Path(__file__).resolve().parents[2], backend)
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(backend))
    import httpx
    from src.bot_verification import TurnstileAdapter, VerifiedSessionService
    from src.reliability import RateLimiter
    from tests.test_session_chat_http import HTTPFixture
    from tests.test_authenticated_session_chat import KEY, POLICY

    fixture = None
    verification_calls = 0

    def reset():
        nonlocal fixture, verification_calls
        if fixture is not None:
            fixture.doCleanups()
        fixture = HTTPFixture()
        fixture.setUp()
        fixture.configure(bot_verification_enabled=True, session_issuance_enabled=True,
                          bot_secret='offline-verification-secret', bot_hostnames=('portfolio.example.test',),
                          bot_action='portfolio_session')
        fixture.api.app.state.session_chat_pipeline = fixture.pipeline
        # Use the configured aggregate/peer limits, not the fixture's enlarged
        # limits for isolated unit probes. The actual session/IP/global gates stay.
        fixture.controls.authenticated_budget = RateLimiter(fixture.settings.staging_budget_requests, 60, 1)
        fixture.controls.rate_limiter = RateLimiter(fixture.settings.rate_requests, 60, 1024)
        fixture.controls.authenticated_budget.clock = lambda: fixture.now.timestamp()
        fixture.controls.rate_limiter.clock = lambda: fixture.now.timestamp()
        verification_calls = 0

        def verify(request):
            nonlocal verification_calls
            from urllib.parse import parse_qs
            verification_calls += 1
            proof = parse_qs(request.content.decode()).get('response', [''])[0]
            assert str(request.url) == 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
            valid = proof.startswith('proof-valid-')
            challenged = fixture.now - timedelta(seconds=301) if proof == 'proof-expired' else fixture.now
            return httpx.Response(200, json={
                'success': valid or proof == 'proof-expired', 'hostname': 'portfolio.example.test',
                'action': 'portfolio_session', 'challenge_ts': challenged.isoformat(), 'error-codes': [],
            })

        adapter = TurnstileAdapter(fixture.settings, transport=httpx.MockTransport(verify), clock=lambda: fixture.now)
        fixture.api.app.state.verification_service = VerifiedSessionService(adapter)
        return {'now': int(fixture.now.timestamp() * 1000), 'key': KEY.hex(), 'policy': POLICY}

    def dispatch(value):
        if value['action'] == 'reset':
            return reset()
        if value['action'] == 'advance':
            fixture.now += timedelta(seconds=value['seconds'])
            return {'now': int(fixture.now.timestamp() * 1000)}
        if value['action'] == 'stats':
            try:
                ledger = fixture.ledger.status()
            except Exception:
                ledger = {'unavailable': True}
            return {'generation': fixture.models.generate_content.call_count,
                    'embedding': fixture.models.embed_content.call_count,
                    'verification': verification_calls, 'ledger': ledger}
        if value['action'] == 'disable':
            fixture.ledger.set_disabled(True)
            return {'disabled': True}
        if value['action'] == 'request':
            allowed = {'/internal/verified-sessions', '/internal/session-chat', '/chat', '/chat/', '/internal/sessions'}
            if value['path'] not in allowed:
                raise ValueError('Test path outside allowlist')
            response = fixture.http.request(value.get('method', 'POST'), value['path'],
                content=value.get('body', '').encode('utf-8'), headers=value.get('headers', {}), follow_redirects=False)
            return {'status': response.status_code, 'headers': dict(response.headers), 'body': response.text}
        raise ValueError('Unknown test action')

    try:
        for line in sys.stdin:
            message = json.loads(line)
            try:
                result = dispatch(message)
                print(json.dumps({'id': message['id'], 'result': result}), flush=True)
            except Exception as error:
                print(json.dumps({'id': message['id'], 'error': type(error).__name__}), flush=True)
    finally:
        if fixture is not None:
            fixture.doCleanups()


if __name__ == '__main__':
    main()
