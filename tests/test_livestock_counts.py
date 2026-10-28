"""Selling an animal updates the current herd without deleting sales history."""
import sys
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import Session as LivestockSession

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app.main import Base, Animal, Barn, ExportBill, ExportIn, add_export, dashboard, list_barns, health_report, growth_report
from app.ai.context import build_farm_context


class Admin:
    role = 'Admin'


def test_export_reduces_current_herd_everywhere_and_preserves_history():
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine)
    with LivestockSession(engine) as session:
        barn = Barn(name='Chuồng kiểm thử', capacity=10, status='dang_nuoi')
        session.add(barn)
        session.flush()
        animal = Animal(code='TEST1', species='Heo', weight=80, health='benh', barn_id=barn.id)
        session.add(animal)
        session.commit()
        assert dashboard(Admin(), session)['total_animals'] == 1
        assert dashboard(Admin(), session)['sick_animals'] == 1
        add_export(ExportIn(animal_id=animal.id, quantity=1, weight=80, total=1000000), Admin(), session)
        result = dashboard(Admin(), session)
        assert result['total_animals'] == 0
        assert result['sick_animals'] == 0
        assert result['revenue'] == 1000000
        assert list_barns(Admin(), session)[0]['animal_count'] == 0
        assert health_report(Admin(), session) == []
        assert growth_report(Admin(), session) == []
        context = build_farm_context(session)
        assert '- Tổng vật nuôi: 0\n' in context
        assert 'Khối lượng trung bình hiện tại: 0.00 kg' in context
        assert 'Tổng số con đã xuất bán theo tất cả phiếu xuất bán: 1' in context
        assert session.get(Animal, animal.id).status == 'da_xuat_ban'
        assert session.query(ExportBill).count() == 1


def test_offline_answers_are_focused_and_unknown_questions_do_not_dump_context():
    from app.ai.context import answer_farm_question
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine)
    with LivestockSession(engine) as session:
        session.add(Barn(name='Chuồng A', capacity=10))
        session.add(Animal(code='TEST2', species='Heo', weight=60))
        session.add(ExportBill(animal_id=99, quantity=2, total=2000000))
        session.commit()
        assert answer_farm_question('Còn bao nhiêu con?', session) == 'Hiện trang trại còn 1 con đang nuôi.'
        assert answer_farm_question('Có bao nhiêu chuồng?', session) == 'Trang trại có 1 chuồng.'
        revenue = answer_farm_question('Doanh thu bao nhiêu?', session)
        assert revenue == 'Tổng doanh thu xuất bán đã ghi nhận là 2.000.000 đồng.'
        sold = answer_farm_question('Đã bán đi bao nhiêu con?', session)
        assert '2 con' in sold
        assert 'doanh thu' not in sold
        vaccine = answer_farm_question('Có lịch vaccine nào sắp đến hạn?', session)
        assert '0 lịch vaccine' in vaccine
        assert 'chuồng' not in vaccine
        weight = answer_farm_question('Cân nặng trung bình?', session)
        assert weight == 'Cân nặng trung bình của đàn đang nuôi là 60.00 kg.'
        unknown = answer_farm_question('Tư vấn thiết kế chuồng', session)
        assert unknown.startswith('Mình chưa biết')
        assert 'Tổng vật nuôi:' not in unknown
        summary = answer_farm_question('Tổng hợp tình hình trang trại', session)
        assert 'Tổng vật nuôi:' in summary
        assert 'Tổng doanh thu' in summary


def test_herd_hides_sold_and_deleted_animals_but_exports_keep_details():
    from app.main import list_animals, list_exports, delete_animal
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine)
    with LivestockSession(engine) as session:
        barn = Barn(name='Chuồng lịch sử', capacity=10)
        session.add(barn)
        session.flush()
        current = Animal(code='CURRENT', species='Heo', barn_id=barn.id)
        sold = Animal(code='SOLD', species='Heo', status='da_xuat_ban', barn_id=barn.id)
        deleted = Animal(code='DELETED', species='Heo', status='da_xoa', barn_id=barn.id)
        session.add_all([current, sold, deleted])
        session.flush()
        session.add(ExportBill(animal_id=sold.id, quantity=1, total=1000000))
        session.commit()
        result = list_animals(page=1, limit=100, user=Admin(), s=session)
        assert result['total'] == 1
        assert [a['code'] for a in result['data']] == ['CURRENT']
        assert list_animals(status='da_xuat_ban', page=1, limit=100, user=Admin(), s=session)['total'] == 0
        delete_animal(sold.id, Admin(), session)
        history = list_exports(Admin(), session)
        assert len(history) == 1
        assert history[0]['animal_code'] == 'SOLD'
        assert history[0]['barn_name'] == 'Chuồng lịch sử'
        assert history[0]['species'] == 'Heo'
        assert list_animals(page=1, limit=100, user=Admin(), s=session)['total'] == 1
