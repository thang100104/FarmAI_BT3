from datetime import datetime, timedelta
from unittest.mock import patch
import json
import pytest
from fastapi.testclient import TestClient
from test_ai_chat import session, user
from app import main as m
from app.ai.analytics import snapshot, growth, bounded_context


def populate(s):
    now=datetime.utcnow()
    s.add_all([m.Vaccination(animal_id=1,vaccine='Quá hạn',scheduled_at=now-timedelta(days=2)),m.Vaccination(animal_id=1,vaccine='Sắp tới',scheduled_at=now+timedelta(days=3)),m.Vaccination(animal_id=1,vaccine='Đã tiêm',scheduled_at=now-timedelta(days=5),status='da_tiem'),m.FeedType(name='Cám kiểm thử',stock=12,unit='kg'),m.GrowthMeasurement(animal_id=1,weight=60,measured_at=now-timedelta(days=10)),m.GrowthMeasurement(animal_id=1,weight=55,measured_at=now)])
    s.commit()


def test_alerts_priority_and_real_growth(session):
    populate(session)
    data=snapshot(session)
    alerts=data['alerts']
    assert alerts[0]['type']=='vaccine' and alerts[0]['animal_code']=='VN001'
    assert any(a['type']=='vaccine_upcoming' for a in alerts)
    assert any(a['type']=='feed' and '12 kg' in a['message'] for a in alerts)
    g=growth(session,1)
    assert g['change_kg']==-5 and g['days']==10 and g['daily_change_kg']==-.5 and g['trend']=='decreasing'
    assert data['vaccines_completed']==1
    encoded=bounded_context(data,3000)
    assert len(encoded)<=3000 and json.loads(encoded)['counts']['animals']==1


def test_growth_empty_and_zero_interval(session):
    assert growth(session,1)['trend']=='insufficient_data'
    now=datetime.utcnow()
    session.add_all([m.GrowthMeasurement(animal_id=1,weight=50,measured_at=now),m.GrowthMeasurement(animal_id=1,weight=52,measured_at=now)])
    session.commit()
    assert growth(session,1)['daily_change_kg'] is None


@pytest.mark.parametrize('error',[m.ai_provider.ProviderError('openai_quota','secret',429),TimeoutError('secret'),m.ai_provider.ProviderError('openai_model','secret')])
def test_fallback_provider_failure_and_private_conversations(session,error):
    populate(session)
    with patch('app.main.check_ai_rate_limit'),patch('app.main.ai_provider.OPENAI_API_KEY','configured'),patch('app.main.call_openai',side_effect=error):
        result=m.ai_analyze(m.AIIn(prompt='Vaccine nào quá hạn?',conversation_id='chat-1'),user(),session)
    assert result['mode']=='fallback' and 'VN001' in result['answer'] and 'secret' not in result['answer']
    assert any(r['conversation_id']=='chat-1' for r in m.ai_history(user(),session))
    assert not any(r['conversation_id']=='chat-1' for r in m.ai_history(user(id=2),session))
    assert m.delete_ai_conversation('chat-1',user(id=2),session)['deleted']==0
    assert m.delete_ai_conversation('chat-1',user(),session)['deleted']==1


def test_new_endpoints_auth_validation_and_admin_crud(session):
    populate(session)
    client=TestClient(m.app)
    for path in ['/api/ai/alerts','/api/ai/growth/1']:
        assert client.get(path).status_code==401
    m.app.dependency_overrides[m.current]=lambda:user()
    m.app.dependency_overrides[m.db]=lambda:session
    try:
        assert client.get('/api/ai/alerts').json()['total']>=3
        assert client.get('/api/ai/growth/1').json()['change_kg']==-5
        assert client.get('/api/ai/growth/999').status_code==404
        assert client.post('/api/ai/analyze',json={'prompt':'x'*4001}).status_code==422
        with patch('app.main.check_ai_rate_limit'),patch('app.main.ai_provider.OPENAI_API_KEY',''):
            result=client.post('/api/ai/summary').json()
        assert result['mode']=='fallback' and result['summary']==result['answer']
        assert client.get('/api/users').status_code==200
        barn=client.post('/api/barns',json={'name':'Chuồng mới','capacity':20}).json()
        assert client.get('/api/barns').status_code==200
        assert client.delete('/api/barns/'+str(barn['id'])).status_code==200
    finally:m.app.dependency_overrides.clear()


def test_context_redacts_secrets_and_keeps_aggregates(session):
    session.add(m.FeedType(name='password=private',stock=1))
    session.commit()
    value=bounded_context(snapshot(session),1500)
    assert 'password=private' not in value
    assert json.loads(value)['active_animals']==1


def test_month_revenue_uses_local_month_boundaries(session):
    from zoneinfo import ZoneInfo
    from datetime import timezone
    local=datetime.now(ZoneInfo('Asia/Ho_Chi_Minh'))
    start=local.replace(day=1,hour=0,minute=0,second=0,microsecond=0).astimezone(timezone.utc).replace(tzinfo=None)
    session.query(m.ExportBill).delete()
    session.add_all([m.ExportBill(animal_id=1,total=1234,weight=10,exported_at=start),m.ExportBill(animal_id=1,total=9999,exported_at=start-timedelta(seconds=1))])
    session.commit()
    data=snapshot(session)
    assert data['month_revenue']==1234 and data['total_revenue']==11233


def test_summary_limits_and_no_business_writes(session):
    populate(session)
    session.add_all([m.Vaccination(animal_id=1,vaccine='Lịch '+str(i),scheduled_at=datetime.utcnow()-timedelta(days=i+1)) for i in range(8)])
    session.commit()
    before={model.__tablename__:session.query(model).count() for model in (m.Animal,m.Barn,m.Vaccination,m.GrowthMeasurement,m.FeedType,m.ExportBill)}
    with patch('app.main.check_ai_rate_limit'),patch('app.main.ai_provider.OPENAI_API_KEY',''):
        result=m.ai_summary(user(),session)
    section=result['answer'].split('🚨 CẢNH BÁO ƯU TIÊN\n')[1].split('\n\n📈')[0]
    assert sum(line[:1].isdigit() for line in section.splitlines())==5
    assert before=={model.__tablename__:session.query(model).count() for model in (m.Animal,m.Barn,m.Vaccination,m.GrowthMeasurement,m.FeedType,m.ExportBill)}


def test_growth_by_code_without_key_and_prompt_secrets(session):
    populate(session)
    with patch('app.main.check_ai_rate_limit'),patch('app.main.ai_provider.OPENAI_API_KEY',''):
        r=m.ai_analyze(m.AIIn(prompt='Con VN001 tăng trưởng thế nào?'),user(),session)
        assert '-5.00 kg' in r['answer'] and r['mode']=='fallback'
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as error:
            m.ai_analyze(m.AIIn(prompt='password=do-not-store'),user(),session)
        assert error.value.status_code==422
        answer=m.ai_analyze(m.AIIn(prompt='Doanh thu tháng trước?'),user(),session)['answer']
        assert 'chưa hỗ trợ' in answer and '800' not in answer
