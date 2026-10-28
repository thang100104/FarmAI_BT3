"""OpenAI Responses integration. Only safe, categorized errors cross the API boundary."""
import os
from copy import deepcopy
from typing import Tuple
import openai
from openai import OpenAI
from .guardrails import sanitize_output

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '').strip()
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-5').strip()
AI_TIMEOUT_SECONDS = float(os.getenv('AI_TIMEOUT_SECONDS', '25'))
AI_MAX_OUTPUT_TOKENS = int(os.getenv('AI_MAX_OUTPUT_TOKENS', '4096'))


class ProviderError(Exception):
    def __init__(self, code, message, status=502, retryable=False):
        super().__init__(message)
        self.status = status
        self.detail = {'code': code, 'message': message, 'retryable': retryable}


def provider_error(exc):
    # Never forward str(exc), response body, headers, request data or credentials.
    code = getattr(exc, 'code', None)
    if isinstance(exc, openai.AuthenticationError):
        return ProviderError('openai_authentication', 'OpenAI từ chối xác thực API key. Quản trị viên cần kiểm tra khóa tại backend.')
    if isinstance(exc, openai.PermissionDeniedError):
        return ProviderError('openai_permission', 'API key không có quyền truy cập tài nguyên hoặc model OpenAI đã cấu hình. Kiểm tra quyền project và OPENAI_MODEL.')
    if isinstance(exc, openai.NotFoundError) or code in ('model_not_found', 'unsupported_model'):
        return ProviderError('openai_model', 'Không tìm thấy model OpenAI hoặc tài khoản chưa được cấp quyền. Kiểm tra OPENAI_MODEL ở backend.')
    if isinstance(exc, openai.RateLimitError):
        if code in ('insufficient_quota', 'billing_hard_limit_reached', 'credit_balance_exhausted', 'organization_usage_limit_exceeded'):
            return ProviderError('openai_quota', 'OpenAI báo hết hạn mức hoặc tín dụng API. Quản trị viên cần kiểm tra billing và ngân sách project.', 429)
        return ProviderError('openai_rate_limit', 'OpenAI đang giới hạn tần suất yêu cầu. Vui lòng chờ rồi gửi lại.', 429, True)
    if isinstance(exc, (openai.APITimeoutError, TimeoutError)):
        return ProviderError('openai_timeout', 'Kết nối OpenAI quá thời gian chờ. Vui lòng thử lại hoặc kiểm tra AI_TIMEOUT_SECONDS.', 504, True)
    if isinstance(exc, openai.APIConnectionError):
        return ProviderError('openai_connection', 'Backend không kết nối được OpenAI. Kiểm tra mạng, proxy hoặc TLS của máy chủ.', 502, True)
    if isinstance(exc, openai.BadRequestError):
        if getattr(exc, 'param', None) == 'model':
            return ProviderError('openai_model', 'Model OpenAI đã cấu hình không hợp lệ hoặc không hỗ trợ yêu cầu này. Kiểm tra OPENAI_MODEL.')
        return ProviderError('openai_invalid_request', 'OpenAI từ chối định dạng hoặc tham số yêu cầu. Quản trị viên cần kiểm tra cấu hình tích hợp.')
    return ProviderError('openai_unavailable', 'Dịch vụ OpenAI đang gặp lỗi. Vui lòng thử lại sau.', 502, True)


def strict_schema(schema):
    schema = deepcopy(schema)
    def visit(node):
        if isinstance(node, dict):
            node.pop('default', None)
            if node.get('type') == 'object':
                node['additionalProperties'] = False
                node['required'] = list(node.get('properties', {}))
            for value in node.values():
                visit(value)
        elif isinstance(node, list):
            for value in node:
                visit(value)
    visit(schema)
    return schema


def call_openai(system_prompt: str, user_prompt: str, *, response_schema=None) -> Tuple[str, str]:
    if not OPENAI_API_KEY:
        raise ProviderError('ai_not_configured', 'Backend chưa có OPENAI_API_KEY. Bạn vẫn có thể hỏi “hãy cho tôi xem báo cáo” để đọc số liệu hệ thống.', 503)
    if not OPENAI_MODEL:
        raise ProviderError('openai_model', 'Backend chưa cấu hình OPENAI_MODEL.', 503)
    try:
        with OpenAI(api_key=OPENAI_API_KEY, timeout=AI_TIMEOUT_SECONDS, max_retries=0) as client:
            options = {'text': {'format': {'type':'json_schema', 'name':'farm_read_plan', 'strict':True, 'schema':strict_schema(response_schema)}}} if response_schema is not None else {}
            response = client.responses.create(
                model=OPENAI_MODEL, instructions=system_prompt, input=user_prompt,
                store=False, max_output_tokens=AI_MAX_OUTPUT_TOKENS, **options,
            )
    except (openai.APIError, TimeoutError) as exc:
        raise provider_error(exc) from None
    if getattr(response, 'status', 'completed') == 'incomplete':
        raise ProviderError('openai_incomplete', 'OpenAI chưa hoàn thành câu trả lời trong giới hạn xử lý. Hãy thu hẹp câu hỏi hoặc kiểm tra AI_MAX_OUTPUT_TOKENS.')
    if getattr(response, 'status', 'completed') != 'completed':
        raise ProviderError('openai_failed', 'OpenAI không hoàn thành yêu cầu. Vui lòng thử lại.', 502, True)
    try:
        return sanitize_output(response.output_text), 'openai'
    except ValueError:
        raise ProviderError('openai_empty_response', 'OpenAI trả về nội dung rỗng. Vui lòng thử lại hoặc kiểm tra cấu hình model.', 502, True) from None
