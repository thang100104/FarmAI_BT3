"""Deterministic report using the existing authorized read tools, with or without OpenAI."""
import re
from datetime import datetime, timezone
from .guardrails import normalize_question, sanitize_output
from .workspace import catalog, registry, read_data, Read


def is_report_request(question):
    q = re.sub(r'[^a-z0-9 ]', ' ', normalize_question(question))
    q = ' '.join(q.split())
    return bool(re.fullmatch(
        r'(?:(?:hay |vui long |ban |giup toi |cho toi |toi muon |cho minh |minh muon |xem |mo |hien thi |doc |tong hop |tom tat )*)'
        r'bao cao(?: tong hop| he thong| trang trai| hien tai| chan nuoi)?(?: giup toi| cho toi| nhe)?', q))


def system_report(user, session):
    pages = {p['page']: p for p in catalog(user)}
    specs = registry(user)  # Same role checks and field allowlists as model-driven retrieval.
    evidence = []
    def query(dataset, operation='count', **kwargs):
        data = read_data(specs, Read(dataset=dataset, operation=operation, **kwargs), user, session)
        evidence.append(data)
        return data['result'] if kwargs.get('group_by') else data['result'][0]['value']
    active = [{'field':'status','value':'dang_nuoi'}]
    active_related = [{'field':'animal_status','value':'dang_nuoi'}]
    animals = query('animals', filters=active)
    health = query('animals', filters=active, group_by='health')
    weight = query('animals', 'avg', field='weight', filters=active)
    barns = query('barns')
    capacity = query('barns', 'sum', field='capacity')
    low_feed = query('feed_types', filters=[{'field':'active','value':True},{'field':'stock','op':'lt','value':50}])
    care = query('care')
    vaccines = query('vaccinations', filters=active_related+[{'field':'status','value':'chua_tiem'}])
    growth = query('growth', filters=active_related)
    bills = query('exports')
    sold = query('exports', 'sum', field='quantity')
    revenue = query('exports', 'sum', field='total')
    def number(value):
        return 'chưa có dữ liệu' if value is None else f'{value:,.0f}'.replace(',', '.')
    health_labels = {'binh_thuong':'bình thường','benh':'bệnh','can_theo_doi':'cần theo dõi'}
    health_text = ', '.join(f"{health_labels.get(r['group'],r['group'] or 'chưa phân loại')}: {r['value']} con" for r in health) or 'chưa có dữ liệu'
    if evidence[1]['truncated']:
        health_text += ' (chỉ hiển thị một phần các nhóm)'
    answer = (
        'BÁO CÁO TỪ DỮ LIỆU HỆ THỐNG\n'
        'Phạm vi: đàn đang nuôi tại thời điểm tra cứu; chăm sóc và xuất bán tính toàn bộ lịch sử đã ghi nhận.\n\n'
        f'Đàn vật nuôi: {number(animals)} con đang nuôi.\n'
        f'Sức khỏe: {health_text}.\n'
        f"Khối lượng trung bình đàn đang nuôi: {'chưa có dữ liệu' if weight is None else f'{weight:.2f} kg'}.\n"
        f'Chuồng trại: {number(barns)} chuồng; sức chứa đã khai báo: {number(capacity)} con.\n'
        f'Thức ăn: {number(low_feed)} loại đang hoạt động có tồn kho dưới 50 đơn vị của từng loại.\n'
        f'Chăm sóc: {number(care)} nhật ký đã ghi nhận.\n'
        f'Vaccine: {number(vaccines)} lịch chưa tiêm cho đàn đang nuôi.\n'
        f'Tăng trưởng: {number(growth)} lần đo cho đàn đang nuôi; số lần đo không phải mức tăng cân.\n'
        f'Xuất bán: {number(bills)} phiếu; '
        f"{'chưa có dữ liệu số con bán' if sold is None else number(sold)+' con theo tổng quantity'}.\n"
        f"Doanh thu xuất bán: {'chưa có dữ liệu' if revenue is None else number(revenue)+' đồng'}.\n\n"
        'Đây là báo cáo do bộ xử lý dữ liệu hệ thống tạo, không phải câu trả lời do mô hình AI sinh. '
        'Mở trang Báo cáo để xem chi tiết và in / xuất PDF.'
    )
    return {'answer':sanitize_output(answer), 'mode':'system_report', 'sources':[pages['reports']],
            'retrieved_at_utc':datetime.now(timezone.utc).isoformat(), 'context_chars':0}
