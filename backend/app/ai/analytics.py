"""Read-only farm analytics; all arithmetic is performed on database records."""
import json
import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy import func
from .guardrails import normalize_question, sanitize_output, SECRET_PATTERNS

MISSING = 'Hệ thống chưa có đủ dữ liệu để kết luận.'


def growth(session, animal_id, animal=None, records=None):
    from ..main import Animal, GrowthMeasurement
    animal = animal or session.get(Animal, animal_id)
    if animal is None:
        raise HTTPException(404, 'Không tìm thấy vật nuôi')
    if records is None:
        records = session.query(GrowthMeasurement).filter_by(animal_id=animal_id).order_by(GrowthMeasurement.measured_at, GrowthMeasurement.id).all()
    valid = [r for r in records if r.weight is not None]
    first, last = (valid[0], valid[-1]) if valid else (None, None)
    days = (last.measured_at-first.measured_at).total_seconds()/86400 if first else 0
    change = last.weight-first.weight if first else None
    daily = change/days if days > 0 else None
    # No universal biological target across species: slow_growth means no recorded gain.
    trend = 'insufficient_data' if len(valid)<2 or days<=0 else 'decreasing' if change<0 else 'slow_growth' if change==0 else 'stable_growth'
    analysis = MISSING if trend=='insufficient_data' else f'{animal.code}: thay đổi {change:+.2f} kg trong {days:.2f} ngày; trung bình {daily:+.3f} kg/ngày. Đây là biến động ghi nhận, không phải chẩn đoán hay kết luận đạt chuẩn tăng trưởng.'
    return dict(animal_id=animal.id, code=animal.code, species=animal.species, first_weight=first.weight if first else None, latest_weight=last.weight if last else None, change_kg=change, days=round(days,3), daily_change_kg=round(daily,4) if daily is not None else None, trend=trend, analysis=analysis, history=[dict(id=r.id, weight=r.weight, measured_at=r.measured_at.isoformat()) for r in records])


def snapshot(session):
    from ..main import Animal, Barn, FeedType, Vaccination, GrowthMeasurement, CareLog, ExportBill
    now = datetime.utcnow()
    active = session.query(Animal).filter_by(status='dang_nuoi').all()
    barns = session.query(Barn).order_by(Barn.id).all()
    names = {b.id:b.name for b in barns}
    animals = [dict(id=a.id, code=a.code, species=a.species, weight=a.weight, health=a.health, barn_id=a.barn_id, barn_name=names.get(a.barn_id)) for a in active]
    counts = dict(session.query(Animal.barn_id,func.count(Animal.id)).filter_by(status='dang_nuoi').group_by(Animal.barn_id).all())
    barn_data = [dict(id=b.id,name=b.name,zone=b.zone,capacity=b.capacity,current_count=counts.get(b.id,0)) for b in barns]
    vaccines = [dict(id=v.id,animal_id=a.id,animal_code=a.code,vaccine=v.vaccine,status=v.status,scheduled_at=v.scheduled_at.isoformat()) for v,a in session.query(Vaccination,Animal).join(Animal,Vaccination.animal_id==Animal.id).filter(Animal.status=='dang_nuoi').order_by(Vaccination.scheduled_at).all()]
    feeds = [dict(id=f.id,name=f.name,stock=f.stock,unit=f.unit) for f in session.query(FeedType).filter_by(active=True).order_by(FeedType.id)]
    measured={a.id:[] for a in active}
    for measurement in session.query(GrowthMeasurement).join(Animal,GrowthMeasurement.animal_id==Animal.id).filter(Animal.status=='dang_nuoi').order_by(GrowthMeasurement.measured_at,GrowthMeasurement.id):
        measured[measurement.animal_id].append(measurement)
    growth_data = [growth(session,a.id,a,measured[a.id]) for a in active]
    recent_growth = [dict(id=r.id,animal_id=r.animal_id,weight=r.weight,measured_at=r.measured_at.isoformat()) for r in session.query(GrowthMeasurement).order_by(GrowthMeasurement.measured_at.desc()).limit(20)]
    care = [dict(animal_id=r.animal_id,action=sanitize_output(r.action) if r.action else '',note=sanitize_output(r.note) if r.note else '',created_at=r.created_at.isoformat()) for r in session.query(CareLog).order_by(CareLog.created_at.desc()).limit(15)]
    local = datetime.now(ZoneInfo('Asia/Ho_Chi_Minh'))
    start = local.replace(day=1,hour=0,minute=0,second=0,microsecond=0).astimezone(timezone.utc).replace(tzinfo=None)
    end = (local.replace(day=28)+timedelta(days=4)).replace(day=1,hour=0,minute=0,second=0,microsecond=0).astimezone(timezone.utc).replace(tzinfo=None)
    totals = session.query(func.sum(ExportBill.weight),func.sum(ExportBill.total)).one()
    revenue_month = session.query(func.sum(ExportBill.total)).filter(ExportBill.exported_at>=start,ExportBill.exported_at<end).scalar() or 0
    sales = [dict(id=e.id,animal_id=e.animal_id,quantity=e.quantity,weight=e.weight,total=e.total,exported_at=e.exported_at.isoformat()) for e in session.query(ExportBill).order_by(ExportBill.exported_at.desc()).limit(15)]
    alerts=[]
    def add(level,kind,title,message,**kw):
        alerts.append(dict(level=level,type=kind,title=title,message=message,**kw))
    for v in vaccines:
        if v['status']!='chua_tiem': continue
        due=datetime.fromisoformat(v['scheduled_at'])
        if due<now:
            add('high','vaccine','Vaccine quá hạn',f"{v['animal_code']}: {v['vaccine']} quá hạn {(now-due).days} ngày",animal_id=v['animal_id'],animal_code=v['animal_code'],priority=0)
        elif due<=now+timedelta(days=7):
            add('low','vaccine_upcoming','Vaccine sắp đến hạn',f"{v['animal_code']}: {v['vaccine']} vào {due:%d/%m/%Y}",animal_id=v['animal_id'],animal_code=v['animal_code'],priority=5)
    for a in animals:
        if a['health']!='binh_thuong': add('high','health','Sức khỏe cần theo dõi',f"{a['code']}: trạng thái {a['health']}; cần kỹ thuật viên kiểm tra",animal_id=a['id'],animal_code=a['code'],priority=1)
    for g in growth_data:
        if g['trend'] in ('decreasing','slow_growth'):
            add('medium','growth', 'Giảm cân' if g['trend']=='decreasing' else 'Chưa ghi nhận tăng cân',g['analysis'],animal_id=g['animal_id'],animal_code=g['code'],priority=2 if g['trend']=='decreasing' else 3)
    for f in feeds:
        if f['stock']<50: add('medium','feed','Thức ăn tồn thấp',f"{f['name']}: {f['stock']:g} {f['unit']} (ngưỡng cảnh báo dưới 50 {f['unit']})",feed_id=f['id'],priority=4)
    for b in barn_data:
        if b['capacity']>0 and b['current_count']>=b['capacity']*.9: add('low','barn','Chuồng gần đạt sức chứa',f"{b['name']}: {b['current_count']}/{b['capacity']} con (từ 90%)",barn_id=b['id'],priority=6)
    for alert in alerts:
        alert['message']=sanitize_output(alert['message'])
    alerts.sort(key=lambda a:({'high':0,'medium':1,'low':2}[a['level']],a['priority']))
    return dict(retrieved_at=now.isoformat(),total_animals=session.query(Animal).filter(Animal.status!='da_xoa').count(),active_animals=len(active),animals=animals,barns=barn_data,vaccines=vaccines,vaccines_completed=sum(v['status']=='da_tiem' for v in vaccines),feeds=feeds,growth=growth_data,recent_growth=recent_growth,care=care,sold_quantity=session.query(func.sum(ExportBill.quantity)).scalar() or 0,care_count=session.query(CareLog).count(),growth_count=session.query(GrowthMeasurement).count(),average_weight=session.query(func.avg(Animal.weight)).filter_by(status='dang_nuoi').scalar() or 0,total_export_weight=totals[0] or 0,total_revenue=totals[1] or 0,month=local.strftime('%m/%Y'),month_revenue=revenue_month,recent_sales=sales,alerts=alerts)


def bounded_context(data, maximum=10000):
    """Valid JSON, explicit truncation and complete aggregates even for large farms."""
    def clean(value):
        if isinstance(value,str):
            for pattern in SECRET_PATTERNS: value=pattern.sub('[đã ẩn thông tin xác thực]',value)
            return value
        if isinstance(value,list): return [clean(x) for x in value]
        if isinstance(value,dict): return {k:clean(v) for k,v in value.items()}
        return value
    data=clean(data)
    compact={k:v for k,v in data.items() if k not in ('growth',)}
    compact['growth']=[{k:v for k,v in g.items() if k!='history'} for g in data['growth']]
    compact['counts']={k:len(v) for k,v in compact.items() if isinstance(v,list)}
    compact['truncated']=False
    while len(json.dumps(compact,ensure_ascii=False,default=str))>maximum:
        arrays=[k for k,v in compact.items() if isinstance(v,list) and v]
        if not arrays: break
        largest=max(arrays,key=lambda k:len(json.dumps(compact[k],ensure_ascii=False,default=str)))
        compact[largest]=compact[largest][:-1]
        compact['truncated']=True
    return json.dumps(compact,ensure_ascii=False,default=str)


def answer(question, data, session, summary=False):
    q=normalize_question(question)
    alerts=data['alerts']
    selected=alerts
    detail=[]
    unsupported = re.search(r'thang (?:truoc|[0-9])|nam (?:truoc|[0-9])|hom qua|tuan truoc|quy|tu ngay|den ngay',q)
    if unsupported:
        return sanitize_output(MISSING + '\nBộ phân tích nội bộ chưa hỗ trợ bộ lọc thời gian này. Chưa có kết quả cho phạm vi bạn hỏi; hãy dùng bộ lọc ở trang Báo cáo.')
    if 'cham soc' in q:
        detail=[f"Đã ghi nhận {data['care_count']} nhật ký chăm sóc."]+[f"Vật nuôi ID {r['animal_id']}: {r['action']} — {r['created_at']}" for r in data['care']]
    elif 'phieu' in q and 'xuat ban' in q:
        detail=[f"Có {len(data['recent_sales'])} phiếu gần đây được hiển thị; tổng số con đã bán theo quantity: {data['sold_quantity']:g}."]
    elif 'tang truong' in q and 'bao nhieu' in q:
        detail=[f"Có {data['growth_count']} lần đo tăng trưởng đã ghi nhận."]
    elif 'tang truong' in q or 'can nang' in q:
        matches=[a for a in data['animals'] if re.search(r'(?<!\w)'+re.escape(normalize_question(a['code']))+r'(?!\w)',q)]
        detail=[growth(session,a['id'])['analysis'] for a in matches] or ['Vui lòng cung cấp mã vật nuôi để phân tích tăng trưởng.']
        selected=[a for a in alerts if a['type']=='growth' and (not matches or a.get('animal_id') in [m['id'] for m in matches])]
    elif 'vaccine' in q or 'vac xin' in q or 'tiem' in q:
        upcoming=any(w in q for w in ('sap','toi','den han'))
        selected=[a for a in alerts if a['type']==('vaccine_upcoming' if upcoming else 'vaccine')]
        detail=[f"Có {len(selected)} lịch vaccine {'trong 7 ngày tới' if upcoming else 'quá hạn' }."]
    elif 'thuc an' in q or 'ton kho' in q:
        selected=[a for a in alerts if a['type']=='feed']
        detail=[f"{f['name']}: {f['stock']:g} {f['unit']}" for f in data['feeds']]
    elif 'chuong' in q:
        selected=[a for a in alerts if a['type']=='barn']
        detail=[f"{b['name']} ({b['zone']}): {b['current_count']}/{b['capacity']} con" for b in data['barns']]
    elif 'theo doi' in q or 'suc khoe' in q:
        selected=[a for a in alerts if a['type']=='health']
        detail=[f'Có {len(selected)} vật nuôi có trạng thái sức khỏe bất thường.']
    elif 'doanh thu' in q:
        detail=[f"Doanh thu tháng {data['month']}: {data['month_revenue']:,.0f} đồng." if 'thang nay' in q else f"Tổng doanh thu đã ghi nhận: {data['total_revenue']:,.0f} đồng. Tổng khối lượng xuất bán: {data['total_export_weight']:g} kg."]
    elif not any(w in q for w in ('tong','dan','vat nuoi','bao cao','uu tien','hom nay','tom tat')):
        detail=[MISSING, 'Chế độ nội bộ hỗ trợ tổng đàn, vaccine, sức khỏe, tăng trưởng, chuồng, thức ăn và doanh thu.']
    shown=selected[:5] if summary else selected[:30]
    warning='\n'.join(f"{i+1}. {a['message']}" for i,a in enumerate(shown)) or 'Không có cảnh báo thuộc phạm vi tra cứu.'
    if len(selected)>len(shown): warning+=f'\nHiển thị {len(shown)}/{len(selected)} cảnh báo.'
    recommendations=list(dict.fromkeys({'vaccine':'Kiểm tra và bố trí lịch tiêm bù với kỹ thuật viên.','health':'Nhờ kỹ thuật viên kiểm tra các vật nuôi có trạng thái bất thường.','growth':'Kiểm tra lại phép đo, khẩu phần và điều kiện chăm sóc.','feed':'Kiểm tra nhu cầu và bổ sung kho thức ăn.','vaccine_upcoming':'Chuẩn bị vaccine và lịch tiêm trong 7 ngày tới.','barn':'Rà soát sức chứa trước khi nhập thêm vật nuôi.'}[a['type']] for a in shown))[:5]
    return sanitize_output(f"📊 TÓM TẮT\nTổng vật nuôi (không gồm đã xóa): {data['total_animals']}; đang nuôi: {data['active_animals']} con.\n\n🚨 CẢNH BÁO ƯU TIÊN\n{warning}\n\n📈 PHÂN TÍCH\n"+'\n'.join(detail or [f"Có {len(alerts)} cảnh báo từ dữ liệu hiện tại.",f"Xuất bán: {data['sold_quantity']:g} con theo tổng quantity; doanh thu {data['total_revenue']:g} đồng; tổng khối lượng {data['total_export_weight']:g} kg."])+"\n\n✅ KHUYẾN NGHỊ\n"+'\n'.join(recommendations or ['Tiếp tục cập nhật dữ liệu theo dõi định kỳ.'])+"\nKhông chẩn đoán bệnh; không thay thế bác sĩ thú y hoặc kỹ thuật viên.\n\nℹ️ DỮ LIỆU CẦN BỔ SUNG\nCần ít nhất hai lần đo khác thời điểm và định mức theo loài/tuổi để đánh giá chuẩn tăng trưởng.")
