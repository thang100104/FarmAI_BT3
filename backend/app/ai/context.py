"""Build a compact AI context from the authenticated user's system data."""
from datetime import datetime, timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session


def build_farm_context(s: Session, data=None) -> str:
    from .analytics import snapshot, bounded_context
    data = data if data is not None else snapshot(s)
    return f"- Tổng doanh thu: {data['total_revenue']:g} đồng\n- Khối lượng trung bình hiện tại: {data['average_weight']:.2f} kg\n- Tổng số con đã xuất bán theo tất cả phiếu xuất bán: {data['sold_quantity']:g}\n- Tổng vật nuôi: {data['active_animals']}\n- Tổng bản ghi vật nuôi (không gồm đã xóa): {data['total_animals']}\n" + bounded_context(data, 9300)




def answer_sales_count(prompt: str, s: Session):
    """Answer an unfiltered sales count from recorded bill quantities, not bill count."""
    import re
    from .guardrails import normalize_question
    from ..main import ExportBill
    question = normalize_question(prompt)
    if not (re.search(r"\bban\b", question) and re.search(r"bao nhieu con|so (?:luong )?con|may con", question)):
        return None
    # Do not present an all-time total as a filtered count.
    if re.search(r"hom|ngay|tuan|thang|nam|quy|chuong|lon|heo|bo|ga|vit|de|tu |den |khach", question):
        return "Bạn muốn xem số con đã bán theo khoảng thời gian, loài hoặc chuồng nào? Hiện mình chỉ có thể trả lời tự động tổng số con đã bán của toàn trang trại."
    quantity = s.query(func.coalesce(func.sum(ExportBill.quantity), 0)).scalar() or 0
    return f"Trang trại đã xuất bán tổng cộng {int(quantity)} con, tính theo số lượng trên tất cả phiếu xuất bán đã ghi nhận trong hệ thống."


def answer_farm_question(prompt: str, s: Session) -> str:
    """Return only requested facts offline; never dump context for an unknown intent."""
    import re
    from .guardrails import normalize_question
    from ..main import Animal, Barn, FeedType, Vaccination, GrowthMeasurement, ExportBill
    q = normalize_question(prompt)
    if re.search(r'tong (?:hop|quan)|tom tat|toan bo|tinh hinh (?:dan|trang trai)', q):
        return "Tình hình trang trại hiện tại:\n" + build_farm_context(s)

    # Avoid silently answering filtered questions with whole-farm statistics.
    if re.search(r'\b(?:hom nay|hom qua|thang|nam|quy|tuan truoc|chuong\s+[a-z0-9]|vn\d+)\b', q):
        return "Mình chưa xác định được dữ liệu cho điều kiện bạn hỏi. Bạn có thể xem bộ lọc trong mục tương ứng hoặc nêu rõ thời gian và mã chuồng/vật nuôi."
    sold = answer_sales_count(prompt, s)
    if sold:
        return sold
    responses = []
    active = s.query(Animal).filter(Animal.status == 'dang_nuoi')
    if re.search(r'doanh thu|tien ban|thu duoc|ban.*bao nhieu tien', q):
        revenue = s.query(func.coalesce(func.sum(ExportBill.total), 0)).scalar() or 0
        amount = f'{float(revenue):,.0f}'.replace(',', '.')
        responses.append(f"Tổng doanh thu xuất bán đã ghi nhận là {amount} đồng.")
    if re.search(r'chuong', q):
        if re.search(r'bao nhieu|may|so (?:luong )?chuong|con trong|dang nuoi', q):
            total = s.query(Barn).count()
            occupied = s.query(Barn).filter(Barn.status == 'dang_nuoi').count()
            if re.search(r'con trong|chuong trong', q):
                responses.append(f"Có {total - occupied} chuồng trống.")
            elif 'dang nuoi' in q:
                responses.append(f"Có {occupied} chuồng đang nuôi vật nuôi.")
            else:
                responses.append(f"Trang trại có {total} chuồng.")
    if re.search(r'vaccine|vac xin|tiem phong|tiem', q):
        now = datetime.utcnow()
        scheduled = s.query(Vaccination).join(Animal, Vaccination.animal_id == Animal.id).filter(Animal.status == 'dang_nuoi', Vaccination.status == 'chua_tiem')
        if re.search(r'qua (?:han|lich)|tre', q):
            count = scheduled.filter(Vaccination.scheduled_at < now).count()
            responses.append(f"Có {count} lịch vaccine quá hạn chưa tiêm cho vật nuôi đang nuôi.")
        elif re.search(r'sap|den han|7 ngay|tuan toi', q):
            count = scheduled.filter(Vaccination.scheduled_at >= now, Vaccination.scheduled_at <= now + timedelta(days=7)).count()
            responses.append(f"Có {count} lịch vaccine chưa tiêm trong 7 ngày tới cho vật nuôi đang nuôi.")
        elif re.search(r'bao nhieu|chua tiem|lich', q):
            responses.append(f"Có {scheduled.count()} lịch vaccine chưa tiêm cho vật nuôi đang nuôi.")
    if re.search(r'thuc an|ton kho', q):
        if re.search(r'sap het|thap|duoi 50|can nhap|thieu', q):
            feeds = s.query(FeedType).filter(FeedType.active == True, FeedType.stock < 50).all()
            responses.append("Không có loại thức ăn nào tồn dưới 50 đơn vị." if not feeds else "Thức ăn tồn dưới 50 đơn vị:\n" + '\n'.join(f"- {f.name}: {f.stock:g} {f.unit}" for f in feeds))
        elif re.search(r'bao nhieu|ton kho|con lai', q):
            feeds = s.query(FeedType).filter(FeedType.active == True).all()
            responses.append("Chưa có loại thức ăn đang sử dụng trong kho." if not feeds else "Tồn kho thức ăn hiện tại:\n" + '\n'.join(f"- {f.name}: {f.stock:g} {f.unit}" for f in feeds))
    if re.search(r'suc khoe|benh|om|can theo doi', q):
        if re.search(r'bao nhieu|may con|so con|tinh hinh|phan tich', q):
            condition = Animal.health == 'benh' if re.search(r'benh|om', q) else Animal.health != 'binh_thuong'
            count = active.filter(condition).count()
            description = 'bị bệnh' if re.search(r'benh|om', q) else 'cần theo dõi sức khỏe'
            responses.append(f"Trong đàn đang nuôi có {count} con {description}.")
    if re.search(r'can nang|khoi luong|tang truong', q):
        if re.search(r'tang truong', q):
            measurements = s.query(GrowthMeasurement).join(Animal, GrowthMeasurement.animal_id == Animal.id).filter(Animal.status == 'dang_nuoi')
            count = measurements.count()
            weight = measurements.with_entities(func.avg(GrowthMeasurement.weight)).scalar()
            responses.append("Chưa có lần đo tăng trưởng nào cho đàn đang nuôi; mình chưa thể đánh giá tăng trưởng." if not count or weight is None else f"Có {count} lần đo của đàn đang nuôi, khối lượng trung bình các lần đo là {float(weight):.2f} kg. Cần so sánh các lần đo của từng con để đánh giá tăng trưởng.")
        elif 'trung binh' in q:
            weight = active.with_entities(func.avg(Animal.weight)).scalar()
            responses.append("Hiện không có vật nuôi đang nuôi để tính cân nặng trung bình." if weight is None else f"Cân nặng trung bình của đàn đang nuôi là {float(weight):.2f} kg.")
    if not responses and re.search(r'bao nhieu con|may con|tong (?:dan|vat nuoi)|so (?:luong )?vat nuoi', q):
        # Species-specific counts use actual records rather than the total herd.
        species = next((name for name in ('heo', 'lon', 'bo', 'ga', 'vit', 'de') if re.search(r'\b' + name + r'\b', q)), None)
        if species:
            names = ('heo', 'lon', 'lợn') if species in ('heo', 'lon') else {'bo': ('bo', 'bò'), 'ga': ('ga', 'gà'), 'vit': ('vit', 'vịt'), 'de': ('de', 'dê')}[species]
            count = active.filter(func.lower(Animal.species).in_(names)).count()
            responses.append(f"Hiện còn {count} con {dict(heo='heo', lon='lợn', bo='bò', ga='gà', vit='vịt', de='dê')[species]} đang nuôi.")
        else:
            responses.append(f"Hiện trang trại còn {active.count()} con đang nuôi.")
    return '\n'.join(responses) if responses else "Mình chưa biết câu trả lời chính xác cho yêu cầu này khi chưa kết nối AI. Bạn muốn hỏi số lượng đàn, số chuồng, lịch vaccine, tồn kho thức ăn, cân nặng hay doanh thu?"
