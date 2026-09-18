import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    r = client.get('/api/health')
    assert r.status_code == 200
    assert r.json()['status'] == 'ok'


def test_login_and_ai_history_is_authenticated():
    r = client.post('/api/auth/login', json={'username':'admin','password':'admin123'})
    assert r.status_code == 200
    token = r.json()['access_token']
    h = client.get('/api/ai/history', headers={'Authorization':f'Bearer {token}'})
    assert h.status_code == 200
    assert isinstance(h.json(), list)
