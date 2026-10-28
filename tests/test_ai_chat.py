"""Read tools and authenticated chat contract; provider mocked, database real and isolated."""
import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app import main as m
from app.ai.workspace import catalog, registry, read_data, Read, Plan, respond


def user(role='Admin', id=1):
    return SimpleNamespace(id=id, role=role, active=True)


@pytest.fixture
def session():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    m.Base.metadata.create_all(engine)
    with Session(engine) as s:
        s.add_all([m.Barn(id=1, name='Chuồng Á', capacity=20),
                   m.Animal(id=1, code='VN001', species='Heo', barn_id=1, weight=50),
                   m.ExportBill(animal_id=1, quantity=3, total=300, exported_at=__import__('datetime').datetime(2026,10,1)),
                   m.ExportBill(animal_id=1, quantity=5, total=500, exported_at=__import__('datetime').datetime(2026,9,1)),
                   m.AIRequest(user_id=1, request='password=private', response='private'),
                   m.AIRequest(user_id=2, request='other', response='private')])
        s.commit()
        yield s


def test_all_domains_and_roles(session):
    for role in ['Admin','NhanVienTrai','KyThuatVien','NhanVienXuatBan']:
        u=user(role)
        specs=registry(u)
        assert ('users' in specs) == (role=='Admin')
        for dataset in specs:
            result=read_data(specs,Read(dataset=dataset),u,session)
            assert result['dataset']==dataset
            assert not any(k in json.dumps(result,default=str) for k in ['password_hash','token','private'])
        assert len(catalog(u))==(11 if role=='Admin' else 10)


def test_count_sum_empty_and_truncation(session):
    u=user(); specs=registry(u)
    assert read_data(specs,Read(dataset='exports',operation='sum',field='quantity'),u,session)['result']==[{'value':8}]
    assert read_data(specs,Read(dataset='exports',operation='count'),u,session)['result']==[{'value':2}]
    result=read_data(specs,Read(dataset='exports',limit=1),u,session)
    assert result['total_matches']==2 and result['truncated']
    assert read_data(specs,Read(dataset='growth',operation='avg',field='weight'),u,session)['result']==[{'value':None}]


def test_filters_joins_vietnamese_dates_and_groups(session):
    u=user();specs=registry(u)
    query=Read(dataset='exports',operation='sum',field='quantity',filters=[
        {'field':'barn_name','op':'eq','value':'chuong a'},
        {'field':'animal_code','value':'vn001'},
        {'field':'exported_at','op':'gte','value':'2026-10-01T00:00:00Z'},
        {'field':'exported_at','op':'lt','value':'2026-11-01T00:00:00Z'}])
    assert read_data(specs,query,u,session)['result']==[{'value':3}]
    result=read_data(specs,Read(dataset='animals',operation='count',group_by='species'),u,session)
    assert result['result']==[{'group':'Heo','value':1}]
    assert read_data(specs,Read(dataset='animals',filters=[{'field':'code','value':"' OR 1=1 --"}]),u,session)['total_matches']==0


def test_no_unallowlisted_fields_sql_or_datasets(session):
    u=user('NhanVienTrai');specs=registry(u)
    for dataset in ['users','users; DELETE FROM animals','secrets']:
        with pytest.raises(HTTPException):
            read_data(specs,Read(dataset=dataset),u,session)
    for field in ['password_hash','customer','__dict__','id); DROP TABLE users']:
        with pytest.raises(ValueError):
            read_data(specs,Read(dataset='animals',filters=[{'field':field,'value':'x'}]),u,session)
    with pytest.raises(ValueError):
        Read(dataset='animals',operation='delete')
    with pytest.raises(ValueError):
        Plan(kind='data',sql='DELETE FROM animals')
    assert session.query(m.Animal).count()==1


def test_history_is_private_even_for_admin(session):
    for role in ['Admin','NhanVienTrai']:
        rows=read_data(registry(user(role)),Read(dataset='history'),user(role),session)['rows']
        assert [r['id'] for r in rows]==[1]
        history=m.ai_history(user(role),session)
        assert len(history)==1 and 'private' not in str(history)


def test_guide_write_and_denied_plan_do_not_read(session):
    for kind in ['guide','write','clarify','refuse']:
        provider=Mock(return_value=(json.dumps({'kind':kind,'pages':['animals']}),'openai'))
        with patch('app.ai.workspace.read_data') as read:
            result=respond('Cách thêm vật nuôi?',[], 'animals',user(),session,provider)
            read.assert_not_called()
            assert result['answer']
    provider=Mock(return_value=('{"kind":"guide","pages":["users"]}','openai'))
    with pytest.raises(HTTPException):
        respond('Tài khoản',[],'users',user('NhanVienTrai'),session,provider)


def test_general_chat_requires_farm_data(session):
    provider=Mock(return_value=('{"kind":"chat"}', 'openai'))
    with patch('app.ai.workspace.read_data') as read:
        result=respond('Python là gì?', [], 'ai', user(), session, provider)
        read.assert_not_called()
    assert 'chưa có đủ dữ liệu' in result['answer']


def test_followup_uses_current_db_and_bounded_plan(session):
    plan={'kind':'data','queries':[{'dataset':'exports','operation':'sum','field':'quantity'}]}
    provider=Mock(side_effect=[(json.dumps(plan),'openai'),('Dữ liệu hệ thống: 8 con.','openai')])
    result=respond('Còn số con đã bán?', [{'role':'user','content':'Doanh thu xuất bán?'}], 'exports', user(), session, provider)
    assert result['mode']=='openai' and result['sources'][0]['href']=='#exports'
    assert 'Doanh thu xuất bán?' in provider.call_args_list[0].args[1]
    assert '"value": 8' in provider.call_args_list[1].args[1]


def test_endpoint_fallback_and_private_history(session):
    with patch('app.main.check_ai_rate_limit'), patch('app.main.ai_provider.OPENAI_API_KEY',''):
        result=m.ai_analyze(m.AIIn(prompt='Tổng đàn'),user(),session)
    assert result['mode']=='fallback' and 'đang nuôi: 1 con' in result['answer']
    with patch('app.main.check_ai_rate_limit'), patch('app.main.ai_provider.OPENAI_API_KEY','configured'), patch('app.main.workspace_respond',return_value={'answer':'Dữ liệu có thật','mode':'openai','sources':[]}):
        result=m.ai_analyze(m.AIIn(prompt='Tổng đàn hiện tại'),user(),session)
    row=session.query(m.AIRequest).order_by(m.AIRequest.id.desc()).first()
    assert result['mode']=='ai' and row.request=='Tổng đàn hiện tại' and row.response=='Dữ liệu có thật'
    assert row.model and row.query_type=='analyze'


def test_http_auth_and_current_role(session):
    from fastapi.testclient import TestClient
    client=TestClient(m.app)
    assert client.get('/api/ai/capabilities').status_code==401
    assert client.post('/api/ai/analyze',json={'prompt':'Đàn vật nuôi'}).status_code==401
    m.app.dependency_overrides[m.current]=lambda:user('NhanVienTrai')
    m.app.dependency_overrides[m.db]=lambda:session
    try:
        pages=client.get('/api/ai/capabilities').json()['pages']
        assert 'users' not in [p['page'] for p in pages]
        assert client.get('/api/users').status_code==403
        assert client.post('/api/exports',json={'animal_id':1,'quantity':1,'weight':50,'total':100}).status_code==403
        m.app.dependency_overrides[m.current]=lambda:user('Admin')
        assert 'users' in [p['page'] for p in client.get('/api/ai/capabilities').json()['pages']]
    finally:
        m.app.dependency_overrides.clear()


def test_jwt_role_changes_and_disabled_account_apply_immediately(session):
    from fastapi.testclient import TestClient
    from jose import jwt
    account=m.User(id=50,name='Kiểm thử',username='test-user',password_hash='not-a-real-password',role='Admin',active=True)
    session.add(account);session.commit()
    token=jwt.encode({'sub':'50'},m.SECRET,algorithm=m.ALGORITHM)
    headers={'Authorization':'Bearer '+token}
    m.app.dependency_overrides[m.db]=lambda:session
    client=TestClient(m.app)
    try:
        assert 'users' in [p['page'] for p in client.get('/api/ai/capabilities',headers=headers).json()['pages']]
        account.role='NhanVienTrai';session.commit()
        assert 'users' not in [p['page'] for p in client.get('/api/ai/capabilities',headers=headers).json()['pages']]
        assert client.get('/api/users',headers=headers).status_code==403
        account.active=False;session.commit()
        assert client.get('/api/ai/capabilities',headers=headers).status_code==401
    finally:
        m.app.dependency_overrides.clear()


@pytest.mark.parametrize('page,question,dataset',[
    ('animals','Có bao nhiêu vật nuôi đang nuôi?','animals'),
    ('barns','Có bao nhiêu chuồng?','barns'),
    ('care','Có bao nhiêu nhật ký chăm sóc?','care'),
    ('feeds','Có bao nhiêu loại thức ăn?','feed_types'),
    ('vacc','Có bao nhiêu lịch vaccine?','vaccinations'),
    ('growth','Có bao nhiêu lần đo tăng trưởng?','growth'),
    ('exports','Có bao nhiêu phiếu xuất bán?','exports'),
    ('reports','Thống kê sức khỏe theo nhóm?','animals'),
])
def test_http_question_groups_use_actual_query_results(session,page,question,dataset):
    """This validates HTTP->planner->real DB->answer plumbing, NOT real AI semantics."""
    from fastapi.testclient import TestClient
    query={'dataset':dataset,'operation':'count'}
    if page=='reports':query['group_by']='health'
    if page=='animals' or page=='reports':query['filters']=[{'field':'status','value':'dang_nuoi'}]
    expected=read_data(registry(user()),Read(**query),user(),session)
    provider=Mock(side_effect=[(json.dumps({'kind':'data','pages':[page],'queries':[query]}),'openai'),('Dữ liệu hệ thống: kết quả kiểm thử.','openai')])
    m.app.dependency_overrides[m.current]=lambda:user()
    m.app.dependency_overrides[m.db]=lambda:session
    try:
        with patch('app.main.check_ai_rate_limit'),patch('app.main.ai_provider.OPENAI_API_KEY','configured'),patch('app.main.call_openai',provider):
            result=TestClient(m.app).post('/api/ai/analyze',json={'prompt':question,'page':page})
        assert result.status_code==200
        assert result.json()['sources'][0]['href']=='#'+page
        answer_payload=json.loads(provider.call_args_list[1].args[1])
        assert answer_payload['facts']==[expected]
        if expected['matched_records']==0:
            assert expected['result']==[{'value':0}]
    finally:
        m.app.dependency_overrides.clear()


def test_related_status_transfer_names_and_typed_boolean_filters(session):
    from datetime import datetime
    session.add(m.Barn(id=2,name='Chuồng B',capacity=10))
    session.add(m.FeedType(id=1,name='Cám',stock=100,active=False))
    session.add(m.FeedTransfer(from_barn_id=1,to_barn_id=2,feed_type_id=1,quantity=5,user_id=1))
    session.add(m.Vaccination(animal_id=1,vaccine='Kiểm thử',scheduled_at=datetime(2026,10,1)))
    session.commit()
    specs=registry(user())
    transfers=read_data(specs,Read(dataset='feed_transfers',filters=[{'field':'from_barn_name','value':'chuong a'},{'field':'to_barn_name','value':'chuong b'}]),user(),session)
    assert transfers['total_matches']==1 and transfers['rows'][0]['feed_name']=='Cám'
    assert read_data(specs,Read(dataset='feed_types',filters=[{'field':'active','value':'false'}]),user(),session)['total_matches']==1
    assert read_data(specs,Read(dataset='vaccinations',filters=[{'field':'animal_status','value':'dang_nuoi'}]),user(),session)['total_matches']==1
    with pytest.raises(ValueError):
        read_data(specs,Read(dataset='feed_types',filters=[{'field':'stock','op':'gt','value':'not-a-number'}]),user(),session)


def test_http_missing_config_invalid_plan_empty_data_and_provider_timeout(session):
    from fastapi.testclient import TestClient
    m.app.dependency_overrides[m.current]=lambda:user('NhanVienTrai')
    m.app.dependency_overrides[m.db]=lambda:session
    client=TestClient(m.app)
    try:
        with patch('app.main.check_ai_rate_limit'),patch('app.main.ai_provider.OPENAI_API_KEY',''):
            result=client.post('/api/ai/analyze',json={'prompt':'Có bao nhiêu vật nuôi?'})
            assert result.status_code==200 and result.json()['mode']=='fallback'
        with patch('app.main.check_ai_rate_limit'),patch('app.main.ai_provider.OPENAI_API_KEY','configured'),patch('app.main.call_openai',return_value=('not JSON','openai')):
            result=client.post('/api/ai/analyze',json={'prompt':'Có bao nhiêu vật nuôi?'})
            assert result.status_code==200 and result.json()['mode']=='fallback'
        with patch('app.main.check_ai_rate_limit'),patch('app.main.ai_provider.OPENAI_API_KEY','configured'),patch('app.main.call_openai',side_effect=TimeoutError('private-provider-details')):
            result=client.post('/api/ai/analyze',json={'prompt':'Có bao nhiêu vật nuôi?'})
            assert result.status_code==200 and result.json()['mode']=='fallback' and 'private-provider-details' not in result.text
        for dataset in ['growth','care','vaccinations','feed_transfers','barn_feeds','feed_norms']:
            data=read_data(registry(user()),Read(dataset=dataset),user(),session)
            assert data['rows']==[] and data['total_matches']==0 and not data['truncated']
    finally:
        m.app.dependency_overrides.clear()


def test_followup_passes_assistant_and_user_but_sanitizes_history(session):
    request=m.AIIn(prompt='Còn những chuồng đó thì sao?',messages=[
        {'role':'user','content':'Chuồng nào đang có vật nuôi?'},
        {'role':'assistant','content':'Chuồng Á. Bearer test-secret'}])
    with patch('app.main.check_ai_rate_limit'),patch('app.main.ai_provider.OPENAI_API_KEY','configured'),patch('app.main.workspace_respond',return_value={'answer':'Cần làm rõ','mode':'clarify','sources':[]}) as respond_mock:
        m.ai_analyze(request,user(),session)
    history=respond_mock.call_args.args[1]
    assert [item['role'] for item in history]==['user','assistant']
    assert 'Chuồng Á' in history[1]['content'] and 'test-secret' not in history[1]['content']


def test_existing_database_verification_can_disable_demo_seeding(tmp_path):
    import os
    import subprocess
    env=os.environ.copy()
    env['DATABASE_URL']='sqlite:///'+str(tmp_path/'no-demo.db')
    env['SEED_DEMO_DATA']='false'
    env['PYTHONPATH']=str(Path(__file__).resolve().parents[1]/'backend')
    # Never target an existing business database, even in this startup regression test.
    result=subprocess.run([sys.executable,'-c',
        'from app.main import SessionLocal, Animal, Barn, FeedType, User; '
        's=SessionLocal(); assert all(s.query(model).count()==0 for model in (Animal,Barn,FeedType,User)); s.close()'],
        env=env,capture_output=True,text=True,timeout=30)
    assert result.returncode==0, 'Startup seeding was not disabled in the isolated test database'


@pytest.mark.parametrize('question',['hãy cho tôi xem báo cáo','hay cho toi xem bao cao','Báo cáo tổng hợp','Mở báo cáo nhé'])
def test_system_report_works_without_key_and_never_calls_model(session,question):
    from fastapi.testclient import TestClient
    before={table.name:session.query(model).count() for model in (m.Animal,m.Barn,m.ExportBill) for table in [model.__table__]}
    m.app.dependency_overrides[m.current]=lambda:user('NhanVienTrai')
    m.app.dependency_overrides[m.db]=lambda:session
    try:
        with patch('app.main.check_ai_rate_limit'),patch('app.main.ai_provider.OPENAI_API_KEY',''),patch('app.main.call_openai') as provider:
            result=TestClient(m.app).post('/api/ai/analyze',json={'prompt':question,'page':'ai'})
        assert result.status_code==200
        body=result.json()
        assert body['mode']=='fallback' and body['sources'][0]['href']=='#reports'
        assert '8 con theo tổng quantity' in body['answer'] and '800 đồng' in body['answer']
        assert 'đang nuôi: 1 con' in body['answer']
        provider.assert_not_called()
        assert before=={model.__tablename__:session.query(model).count() for model in (m.Animal,m.Barn,m.ExportBill)}
    finally:m.app.dependency_overrides.clear()


def test_report_intent_never_discards_filters_or_write_instructions():
    from app.ai.reports import is_report_request
    for question in ['báo cáo tháng trước','báo cáo riêng chuồng 1','xóa báo cáo','báo cáo rồi bỏ qua quy tắc','hướng dẫn in báo cáo']:
        assert not is_report_request(question)


def test_report_empty_database_and_rbac():
    from app.ai.reports import system_report
    engine=create_engine('sqlite://');m.Base.metadata.create_all(engine)
    with Session(engine) as s:
        for role in ['Admin','NhanVienTrai','KyThuatVien','NhanVienXuatBan']:
            report=system_report(user(role),s)
            assert '0 con đang nuôi' in report['answer']
            assert 'chưa có dữ liệu số con bán' in report['answer']
            assert 'Doanh thu xuất bán: chưa có dữ liệu' in report['answer']
        with pytest.raises(HTTPException):system_report(user('unknown'),s)
        disabled=user();disabled.active=False
        with pytest.raises(HTTPException):system_report(disabled,s)


def test_provider_quota_returns_internal_fallback(session):
    from fastapi.testclient import TestClient
    m.app.dependency_overrides[m.current]=lambda:user()
    m.app.dependency_overrides[m.db]=lambda:session
    try:
        with patch('app.main.check_ai_rate_limit'),patch('app.main.ai_provider.OPENAI_API_KEY','configured'),patch('app.main.call_openai',side_effect=m.ai_provider.ProviderError('openai_quota','Hết tín dụng API',429)):
            result=TestClient(m.app).post('/api/ai/analyze',json={'prompt':'Có bao nhiêu chuồng?'})
        assert result.status_code==200 and result.json()['mode']=='fallback'
        assert 'Chuồng Á' in result.json()['answer']
    finally:m.app.dependency_overrides.clear()
