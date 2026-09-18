"""Build a compact AI context from the authenticated user's system data."""
from datetime import datetime, timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session
from .guardrails import limit_context


def build_farm_context(s: Session) -> str:
    # Import models lazily to avoid a circular import with the existing monolithic main.py.
    from ..main import Animal, Barn, FeedType, Vaccination, GrowthMeasurement, ExportBill

    now = datetime.utcnow()
    week = now + timedelta(days=7)
    total = s.query(Animal).filter(Animal.status != "da_xoa").count()
    active = s.query(Animal).filter(Animal.status == "dang_nuoi").count()
    sick = s.query(Animal).filter(Animal.health != "binh_thuong", Animal.status != "da_xoa").count()
    avg_weight = s.query(func.avg(Animal.weight)).filter(Animal.status != "da_xoa").scalar() or 0
    barns = s.query(Barn).count()
    occupied = s.query(Barn).filter(Barn.status == "dang_nuoi").count()
    vaccines = s.query(Vaccination).filter(
        Vaccination.status == "chua_tiem",
        Vaccination.scheduled_at >= now,
        Vaccination.scheduled_at <= week,
    ).count()
    overdue = s.query(Vaccination).filter(
        Vaccination.status == "chua_tiem",
        Vaccination.scheduled_at < now,
    ).count()
    feed_low = s.query(FeedType).filter(FeedType.active == True, FeedType.stock < 50).count()
    avg_recent_growth = s.query(func.avg(GrowthMeasurement.weight)).scalar() or 0
    revenue = s.query(func.coalesce(func.sum(ExportBill.total), 0)).scalar() or 0

    health_rows = s.query(Animal.health, func.count(Animal.id)).filter(
        Animal.status != "da_xoa"
    ).group_by(Animal.health).all()
    health_text = ", ".join(f"{h}: {c}" for h, c in health_rows) or "chưa có dữ liệu"

    context = (
        f"- Tổng vật nuôi: {total}\n"
        f"- Đang nuôi: {active}\n"
        f"- Cần theo dõi sức khỏe: {sick}\n"
        f"- Phân bố sức khỏe: {health_text}\n"
        f"- Khối lượng trung bình hiện tại: {float(avg_weight):.2f} kg\n"
        f"- Số chuồng: {barns}; chuồng đang có vật nuôi: {occupied}\n"
        f"- Vaccine chưa tiêm trong 7 ngày tới: {vaccines}\n"
        f"- Vaccine đã quá lịch nhưng chưa tiêm: {overdue}\n"
        f"- Loại thức ăn đang tồn dưới 50 đơn vị: {feed_low}\n"
        f"- Khối lượng trung bình của các lần đo tăng trưởng: {float(avg_recent_growth):.2f} kg\n"
        f"- Tổng doanh thu phiếu xuất bán: {float(revenue):.2f}\n"
    )
    return limit_context(context)
