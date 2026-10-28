"""Actual OpenAI SDK with HTTPX MockTransport: no network or real API calls."""
import json
from unittest.mock import patch
import httpx
import openai
import pytest
from app.ai import llm


def payload(text='Dữ liệu hệ thống: đàn đang nuôi.',status='completed'):
    return {'id':'resp_test','created_at':0,'object':'response','model':'test-model','status':status,
            'output':[{'type':'message','id':'msg_test','role':'assistant','status':'completed',
                       'content':[{'type':'output_text','text':text,'annotations':[]}]}]}


def run_provider(handler, response_schema=None):
    def factory(**kwargs):
        return openai.OpenAI(**kwargs,http_client=httpx.Client(transport=httpx.MockTransport(handler)))
    with patch.object(llm,'OPENAI_API_KEY','test-backend-key'),patch.object(llm,'OPENAI_MODEL','test-model'),patch.object(llm,'OpenAI',side_effect=factory):
        return llm.call_openai('Chỉ dùng dữ liệu thật','Câu hỏi tiếng Việt và lịch sử',response_schema=response_schema)


def test_responses_request_uses_backend_model_and_no_storage():
    def handler(request):
        body=json.loads(request.content)
        assert request.url.path=='/v1/responses'
        assert request.headers['Authorization']=='Bearer test-backend-key'
        assert body['model']=='test-model' and body['store'] is False
        assert body['instructions']=='Chỉ dùng dữ liệu thật'
        assert 'tiếng Việt' in body['input'] and body['max_output_tokens']==4096
        return httpx.Response(200,json=payload())
    assert run_provider(handler)==('Dữ liệu hệ thống: đàn đang nuôi.','openai')


@pytest.mark.parametrize('status,code,param,expected,http_status',[
    (401,'invalid_api_key',None,'openai_authentication',502),
    (403,'permission_denied',None,'openai_permission',502),
    (404,'model_not_found',None,'openai_model',502),
    (400,'invalid_value','model','openai_model',502),
    (400,'invalid_request_error',None,'openai_invalid_request',502),
    (429,'insufficient_quota',None,'openai_quota',429),
    (429,'rate_limit_exceeded',None,'openai_rate_limit',429),
    (500,'server_error',None,'openai_unavailable',502),
])
def test_sdk_errors_are_specific_and_never_echo_provider_secrets(status,code,param,expected,http_status):
    def handler(request):
        return httpx.Response(status,json={'error':{'message':'private-key-and-request-body','type':'test_error','code':code,'param':param}})
    with pytest.raises(llm.ProviderError) as exc:
        run_provider(handler)
    assert exc.value.detail['code']==expected
    assert exc.value.status==http_status
    assert 'private-key' not in str(exc.value) and 'test-backend-key' not in str(exc.value.detail)


@pytest.mark.parametrize('error,expected,status',[(httpx.ConnectError,'openai_connection',502),(httpx.ReadTimeout,'openai_timeout',504)])
def test_connection_and_timeout_errors(error,expected,status):
    def handler(request):raise error('private-request-details',request=request)
    with pytest.raises(llm.ProviderError) as exc:run_provider(handler)
    assert exc.value.detail['code']==expected and exc.value.status==status
    assert 'private' not in str(exc.value)


@pytest.mark.parametrize('text,status,code',[('','completed','openai_empty_response'),('partial','incomplete','openai_incomplete'),('','failed','openai_failed')])
def test_invalid_response_does_not_look_like_success(text,status,code):
    with pytest.raises(llm.ProviderError) as exc:run_provider(lambda request:httpx.Response(200,json=payload(text,status)))
    assert exc.value.detail['code']==code


def test_missing_key_or_model_never_opens_connection():
    with patch.object(llm,'OPENAI_API_KEY',''),patch.object(llm,'OpenAI') as client:
        with pytest.raises(llm.ProviderError) as exc:llm.call_openai('system','user')
        assert exc.value.detail['code']=='ai_not_configured';client.assert_not_called()
    with patch.object(llm,'OPENAI_API_KEY','test'),patch.object(llm,'OPENAI_MODEL',''),patch.object(llm,'OpenAI') as client:
        with pytest.raises(llm.ProviderError) as exc:llm.call_openai('system','user')
        assert exc.value.detail['code']=='openai_model';client.assert_not_called()


def test_planner_uses_strict_structured_output_without_mutating_schema():
    from app.ai.workspace import Plan
    schema=Plan.model_json_schema()
    original=json.dumps(schema,sort_keys=True)
    def handler(request):
        body=json.loads(request.content)
        format=body['text']['format']
        assert format['type']=='json_schema' and format['strict'] is True
        assert set(format['schema']['required'])==set(format['schema']['properties'])
        assert format['schema']['additionalProperties'] is False
        assert 'default' not in format['schema']['properties']['pages']
        assert set(format['schema']['$defs']['Read']['required'])==set(format['schema']['$defs']['Read']['properties'])
        return httpx.Response(200,json=payload('{"kind":"clarify"}'))
    run_provider(handler,response_schema=schema)
    assert json.dumps(schema,sort_keys=True)==original
