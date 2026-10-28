"""Report configuration booleans only. Never print resolved Compose config or secrets."""
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def command(args, env=None):
    try:
        result = subprocess.run(args, cwd=ROOT, env=env, capture_output=True, text=True, timeout=15)
        return result.stdout if result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def check():
    result = {'shell_key_configured': bool(os.getenv('OPENAI_API_KEY', '').strip()),
              'root_env_exists': (ROOT / '.env').is_file(),
              'docker_cli_available': bool(shutil.which('docker')),
              'real_ai_api_tested': False}
    if not result['docker_cli_available']:
        return result
    # Captured output can contain secrets: reduce to booleans, never forward it.
    raw = command(['docker', 'compose', 'config', '--format', 'json'])
    result['compose_config_valid'] = raw is not None
    if raw:
        try:
            services = json.loads(raw)['services']
            backend = services['backend'].get('environment', {})
            frontend = services['frontend'].get('environment', {})
            result.update(compose_backend_key_configured=bool(str(backend.get('OPENAI_API_KEY') or '').strip()),
                          frontend_receives_key=bool(frontend.get('OPENAI_API_KEY')),
                          backend_model_configured=bool(str(backend.get('OPENAI_MODEL') or '').strip()),
                          backend_output_limit_configured=str(backend.get('AI_MAX_OUTPUT_TOKENS') or '').isdigit(),
                          demo_seeding_enabled=str(backend.get('SEED_DEMO_DATA', 'true')).lower() == 'true',
                          postgres_driver_configured=str(backend.get('DATABASE_URL', '')).startswith('postgresql+psycopg2://'))
        except (ValueError, KeyError, TypeError):
            result['compose_config_valid'] = False
    result['docker_daemon_accessible'] = command(['docker', 'info', '--format', '{{.ServerVersion}}']) is not None
    if result['docker_daemon_accessible']:
        # Inspect only already running services; never start containers or seed a database.
        for name, args in {
            'running_backend_key_configured': ['docker','compose','exec','-T','backend','python','-c',
                                              'import os; print(bool(os.getenv("OPENAI_API_KEY", "").strip()))'],
            'running_postgres_ready': ['docker','compose','exec','-T','db','sh','-c',
                                      'pg_isready -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
        }.items():
            output = command(args)
            result[name] = (output is not None and (output.strip() == 'True' if 'key' in name else True))
    return result


if __name__ == '__main__':
    print(json.dumps(check(), ensure_ascii=False, indent=2))
