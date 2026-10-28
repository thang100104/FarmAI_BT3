"""Every pytest run is isolated, even when the developer has real keys/database env vars."""
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))

_database = tempfile.TemporaryDirectory(prefix='farmai-tests-')
os.environ['DATABASE_URL'] = 'sqlite:///' + str(Path(_database.name) / 'test.db')
os.environ['OPENAI_API_KEY'] = ''  # No paid/provider calls from automated tests.
os.environ['SEED_DEMO_DATA'] = 'true'  # Demo records exist only inside this disposable test database.
