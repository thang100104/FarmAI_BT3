"""Configuration diagnostics must never forward captured secrets into stdout."""
import importlib.util
import json
from pathlib import Path
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('ai_config_check',Path(__file__).resolve().parents[1]/'scripts/check_ai_config.py')
checker=importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


def test_diagnostic_redacts_resolved_configuration():
    secret='test-value-never-printed'
    config={'services':{'backend':{'environment':{'OPENAI_API_KEY':secret,'DATABASE_URL':'postgresql+psycopg2://user:'+secret+'@db/test'}},'frontend':{}}}
    def run(args,env=None):
        if 'config' in args:return json.dumps(config)
        return None
    with patch.object(checker,'command',side_effect=run),patch.object(checker.shutil,'which',return_value='/usr/bin/docker'):
        result=checker.check()
    assert result['compose_backend_key_configured'] is True
    assert result['frontend_receives_key'] is False
    assert secret not in json.dumps(result)
    assert result['real_ai_api_tested'] is False


def test_bad_compose_output_is_reported_without_exception_details():
    with patch.object(checker,'command',return_value='bad-output-with-private-data'),patch.object(checker.shutil,'which',return_value='/usr/bin/docker'):
        result=checker.check()
    assert result['compose_config_valid'] is False
    assert 'private' not in json.dumps(result)
