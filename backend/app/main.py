from datetime import datetime, timedelta
import os
import uuid
from typing import Optional, Literal

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, ForeignKey, func, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./livestock.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+psycopg2" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()
SECRET = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
CORS_ORIGINS = [x.strip() for x in os.getenv("CORS_ORIGINS", "*").split(",") if x.strip()]
ALLOW_PUBLIC_REGISTER = os.getenv("ALLOW_PUBLIC_REGISTER", "false").lower() == "true"
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# -------------------- Models --------------------
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(30), nullable=False)
    active = Column(Boolean, default=True)

class Barn(Base):
    __tablename__ = "barns"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    capacity = Column(Integer, default=0)
    status = Column(String(30), default="trong")
    zone = Column(String(50), default="Khu A")

class Animal(Base):
    __tablename__ = "animals"
    id = Column(Integer, primary_key=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    species = Column(String(50), nullable=False)
    origin = Column(String(100), default="")
    weight = Column(Float, default=0)
    health = Column(String(50), default="binh_thuong")
    status = Column(String(30), default="dang_nuoi")
    barn_id = Column(Integer, ForeignKey("barns.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class CareLog(Base):
    __tablename__ = "care_logs"
    id = Column(Integer, primary_key=True)
    animal_id = Column(Integer, ForeignKey("animals.id"), nullable=False)
    action = Column(String(100), nullable=False)
    note = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

class FeedType(Base):
    __tablename__ = "feed_types"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    unit = Column(String(30), default="kg")
    stock = Column(Float, default=0)
    description = Column(String(300), default="")
    active = Column(Boolean, default=True)

class BarnFeedStock(Base):
    __tablename__ = "barn_feed_stocks"
    id = Column(Integer, primary_key=True)
    barn_id = Column(Integer, ForeignKey("barns.id"), nullable=False)
    feed_type_id = Column(Integer, ForeignKey("feed_types.id"), nullable=False)
    quantity = Column(Float, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow)

class FeedTransfer(Base):
    __tablename__ = "feed_transfers"
    id = Column(Integer, primary_key=True)
    from_barn_id = Column(Integer, ForeignKey("barns.id"), nullable=False)
    to_barn_id = Column(Integer, ForeignKey("barns.id"), nullable=False)
    feed_type_id = Column(Integer, ForeignKey("feed_types.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

class FeedNorm(Base):
    __tablename__ = "feed_norms"
    id = Column(Integer, primary_key=True)
    species = Column(String(50), nullable=False)
    min_weight = Column(Float, default=0)
    max_weight = Column(Float, default=999999)
    daily_kg = Column(Float, default=0)
    feed_type_id = Column(Integer, ForeignKey("feed_types.id"), nullable=False)

class Vaccination(Base):
    __tablename__ = "vaccinations"
    id = Column(Integer, primary_key=True)
    animal_id = Column(Integer, ForeignKey("animals.id"), nullable=False)
    vaccine = Column(String(100), nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    status = Column(String(30), default="chua_tiem")
    note = Column(String(300), default="")

class GrowthMeasurement(Base):
    __tablename__ = "growth_measurements"
    id = Column(Integer, primary_key=True)
    animal_id = Column(Integer, ForeignKey("animals.id"), nullable=False)
    measured_at = Column(DateTime, default=datetime.utcnow)
    weight = Column(Float)
    note = Column(String(300), default="")

class ExportBill(Base):
    __tablename__ = "export_bills"
    id = Column(Integer, primary_key=True)
    animal_id = Column(Integer, ForeignKey("animals.id"), nullable=False)
    quantity = Column(Integer, default=1)
    weight = Column(Float, default=0)
    total = Column(Float, default=0)
    customer = Column(String(100), default="")
    exported_at = Column(DateTime, default=datetime.utcnow)

class AIRequest(Base):
    __tablename__ = "ai_requests"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    request = Column(String(4000), nullable=False)
    response = Column(String(8000), nullable=False)
    mode = Column(String(30), default="fallback")
    model = Column(String(100), default="")
    query_type = Column(String(40), default="analyze")
    conversation_id = Column(String(36), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(engine)

# Lightweight schema migration for older demo databases.
try:
    barn_columns = {c["name"] for c in inspect(engine).get_columns("barns")}
    if "zone" not in barn_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE barns ADD COLUMN zone VARCHAR(50) DEFAULT 'Khu A'"))
except Exception as exc:
    print("Schema migration warning:", exc)

# Additive migration for AI audit metadata; existing records are retained.
with engine.begin() as conn:
    ai_columns = {c['name'] for c in inspect(engine).get_columns('ai_requests')}
    for column, default in [('model', ''), ('query_type', 'analyze'), ('conversation_id', '')]:
        if column not in ai_columns:
            conn.execute(text(f"ALTER TABLE ai_requests ADD COLUMN {column} VARCHAR(100) DEFAULT '{default}'"))

# -------------------- Schemas --------------------
class Login(BaseModel):
    username: str
    password: str

class AnimalIn(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    species: str = Field(min_length=1, max_length=50)
    origin: str = ""
    weight: float = Field(ge=0)
    health: str = "binh_thuong"
    status: str = "dang_nuoi"
    barn_id: Optional[int] = None

class BarnIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    capacity: int = Field(ge=0)
    status: str = "trong"
    zone: str = Field(default="Khu A", min_length=1, max_length=50)

class CareIn(BaseModel):
    animal_id: int
    action: str = Field(min_length=1, max_length=100)
    note: str = ""

class FeedTypeIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    unit: str = "kg"
    stock: float = Field(ge=0)
    description: str = ""
    active: bool = True

class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=100)
    role: str = "NhanVienTrai"

class ResetPasswordIn(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    new_password: str = Field(min_length=6, max_length=100)

class UserUpdateIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    role: str
    active: bool = True

class AdminResetPasswordIn(BaseModel):
    new_password: str = Field(min_length=6, max_length=100)

class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=100)
    new_password: str = Field(min_length=6, max_length=100)

class BarnFeedIn(BaseModel):
    barn_id: int
    feed_type_id: int
    quantity: float = Field(gt=0)

class FeedTransferIn(BaseModel):
    from_barn_id: int
    to_barn_id: int
    feed_type_id: int
    quantity: float = Field(gt=0)

class FeedNormIn(BaseModel):
    species: str
    min_weight: float = Field(ge=0)
    max_weight: float = Field(ge=0)
    daily_kg: float = Field(ge=0)
    feed_type_id: int

class VaccineIn(BaseModel):
    animal_id: int
    vaccine: str
    scheduled_at: datetime
    status: str = "chua_tiem"
    note: str = ""

class GrowthIn(BaseModel):
    animal_id: int
    measured_at: datetime = Field(default_factory=datetime.utcnow)
    weight: float = Field(ge=0)
    note: str = ""

class ExportIn(BaseModel):
    animal_id: int
    quantity: int = Field(gt=0)
    weight: float = Field(ge=0)
    total: float = Field(ge=0)
    customer: str = ""

class AIMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)

class AIIn(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    messages: list[AIMessage] = Field(default_factory=list, max_length=10)
    page: str = Field(default="dashboard", max_length=40)
    conversation_id: Optional[str] = Field(default=None, pattern=r"^[a-zA-Z0-9-]{1,36}$")

# -------------------- DB/Auth --------------------
def db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()

def seed(s: Session):
    if s.query(User).count() == 0:
        users = [
            ("Quản trị viên", "admin", "admin123", "Admin"),
            ("Nhân viên trại", "nhanvientrai1", "staff123", "NhanVienTrai"),
            ("Kỹ thuật viên", "kythuatvien1", "tech123", "KyThuatVien"),
            ("Nhân viên xuất bán", "xuatban1", "sale123", "NhanVienXuatBan"),
        ]
        for name, username, password, role in users:
            s.add(User(name=name, username=username, password_hash=pwd.hash(password), role=role, active=True))
        s.commit()

    if s.query(Barn).count() == 0:
        for i in range(1, 6):
            s.add(Barn(name=f"Chuồng {i}", capacity=20, status="trong", zone=f"Khu {chr(64 + ((i-1)%3)+1)}"))
        s.commit()

    if s.query(FeedType).count() == 0:
        for name, unit, stock in [("Cám heo tổng hợp", "kg", 500), ("Cám tăng trưởng", "kg", 350), ("Thức ăn bổ sung", "kg", 100)]:
            s.add(FeedType(name=name, unit=unit, stock=stock))
        s.commit()

    if s.query(Animal).count() == 0:
        for i in range(1, 11):
            s.add(Animal(code=f"VN{i:03}", species="Heo", origin="Trang trại", weight=50+i, health="binh_thuong", status="dang_nuoi", barn_id=((i-1)%5)+1))
        s.commit()

    if s.query(FeedNorm).count() == 0:
        for ft in s.query(FeedType).all():
            s.add(FeedNorm(species="Heo", min_weight=0, max_weight=999, daily_kg=2.0, feed_type_id=ft.id))
        s.commit()

    refresh_barn_status(s)

def refresh_barn_status(s: Session):
    for b in s.query(Barn).all():
        count = s.query(Animal).filter(Animal.barn_id == b.id, Animal.status == "dang_nuoi").count()
        b.status = "dang_nuoi" if count else "trong"
    s.commit()

# Disable demo seeding when verifying an existing database; no business-data writes at startup.
if os.getenv("SEED_DEMO_DATA", "true").lower() == "true":
    with SessionLocal() as s:
        seed(s)

def auth(token: str, s: Session):
    try:
        p = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
        u = s.get(User, int(p["sub"]))
        if not u or not u.active:
            raise Exception()
        return u
    except Exception:
        raise HTTPException(401, "Chưa đăng nhập")

def current(token=Depends(oauth), s=Depends(db)):
    return auth(token, s)

def role(user, allowed):
    if user.role != "Admin" and user.role not in allowed:
        raise HTTPException(403, "Bạn không có quyền thực hiện thao tác này")

# -------------------- App --------------------
app = FastAPI(title="Smart Livestock API", version="2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=False if CORS_ORIGINS == ["*"] else True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"application": "Smart Livestock System", "version": "2.0", "status": "running", "docs": "/docs"}

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.post("/api/auth/register")
def register(x:RegisterIn, s:Session=Depends(db)):
    if not ALLOW_PUBLIC_REGISTER:
        raise HTTPException(403, "Đăng ký công khai đã tắt. Vui lòng liên hệ Admin để tạo tài khoản.")
    username=x.username.strip()
    if s.query(User).filter_by(username=username).first():
        raise HTTPException(400,"Tên đăng nhập đã tồn tại")
    allowed={"NhanVienTrai","KyThuatVien","NhanVienXuatBan"}
    role_value=x.role if x.role in allowed else "NhanVienTrai"
    u=User(name=x.name.strip(),username=username,password_hash=pwd.hash(x.password),role=role_value,active=True)
    s.add(u); s.commit(); s.refresh(u)
    return {"message":"Đăng ký tài khoản thành công","user":{"id":u.id,"name":u.name,"username":u.username,"role":u.role}}

@app.post("/api/auth/change-password")
def change_password(x:ChangePasswordIn, user=Depends(current), s:Session=Depends(db)):
    if not pwd.verify(x.current_password, user.password_hash):
        raise HTTPException(400, "Mật khẩu hiện tại không đúng")
    user.password_hash = pwd.hash(x.new_password)
    s.commit()
    return {"message":"Đổi mật khẩu thành công"}

@app.post("/api/auth/login")
def login(x: Login, s: Session = Depends(db)):
    u = s.query(User).filter_by(username=x.username).first()
    if not u or not pwd.verify(x.password, u.password_hash):
        raise HTTPException(401, "Sai tài khoản hoặc mật khẩu")
    if not u.active:
        raise HTTPException(401, "Tài khoản đã bị khóa")
    token = jwt.encode({"sub": str(u.id), "role": u.role, "exp": datetime.utcnow()+timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)}, SECRET, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer", "user": {"id":u.id,"name":u.name,"username":u.username,"role":u.role}}

@app.get("/api/auth/me")
def me(user=Depends(current)):
    return {"id":user.id,"name":user.name,"username":user.username,"role":user.role,"active":user.active}

@app.get("/api/users")
def list_users(user=Depends(current), s:Session=Depends(db)):
    role(user, [])
    return [{"id":u.id,"name":u.name,"username":u.username,"role":u.role,"active":u.active} for u in s.query(User).order_by(User.id).all()]

@app.post("/api/users")
def create_user(x:RegisterIn, user=Depends(current), s:Session=Depends(db)):
    role(user, [])
    username=x.username.strip()
    if s.query(User).filter_by(username=username).first():
        raise HTTPException(400,"Tên đăng nhập đã tồn tại")
    allowed={"Admin","NhanVienTrai","KyThuatVien","NhanVienXuatBan"}
    if x.role not in allowed: raise HTTPException(400,"Vai trò không hợp lệ")
    u=User(name=x.name.strip(),username=username,password_hash=pwd.hash(x.password),role=x.role,active=True)
    s.add(u); s.commit(); s.refresh(u)
    return {"message":"Đã tạo tài khoản","user":{"id":u.id,"name":u.name,"username":u.username,"role":u.role,"active":u.active}}

@app.put("/api/users/{id}")
def update_user(id:int, x:UserUpdateIn, user=Depends(current), s:Session=Depends(db)):
    role(user, [])
    u=s.get(User,id)
    if not u: raise HTTPException(404,"Không tìm thấy tài khoản")
    allowed={"Admin","NhanVienTrai","KyThuatVien","NhanVienXuatBan"}
    if x.role not in allowed: raise HTTPException(400,"Vai trò không hợp lệ")
    if u.id == user.id and not x.active:
        raise HTTPException(400,"Không thể tự khóa tài khoản đang đăng nhập")
    u.name=x.name.strip(); u.role=x.role; u.active=x.active
    s.commit()
    return {"message":"Đã cập nhật tài khoản"}

@app.post("/api/users/{id}/reset-password")
def admin_reset_password(id:int, x:AdminResetPasswordIn, user=Depends(current), s:Session=Depends(db)):
    role(user, [])
    u=s.get(User,id)
    if not u: raise HTTPException(404,"Không tìm thấy tài khoản")
    u.password_hash=pwd.hash(x.new_password)
    s.commit()
    return {"message":"Đã đặt lại mật khẩu cho tài khoản"}

@app.get("/api/dashboard")
def dashboard(user=Depends(current), s: Session=Depends(db)):
    total = s.query(Animal).filter(Animal.status == "dang_nuoi").count()
    barns = s.query(Barn).count()
    occupied = s.query(Barn).filter_by(status="dang_nuoi").count()
    sick = s.query(Animal).filter(Animal.health != "binh_thuong", Animal.status == "dang_nuoi").count()
    revenue = s.query(func.coalesce(func.sum(ExportBill.total),0)).scalar() or 0
    now = datetime.utcnow()
    upcoming_vaccines = s.query(Vaccination).filter(Vaccination.status=="chua_tiem", Vaccination.scheduled_at >= now, Vaccination.scheduled_at <= now + timedelta(days=7)).count()
    overdue_vaccines = s.query(Vaccination).filter(Vaccination.status=="chua_tiem", Vaccination.scheduled_at < now).count()
    low_feed = s.query(FeedType).filter(FeedType.active==True, FeedType.stock < 50).count()
    return {"total_animals":total,"total_barns":barns,"occupied_barns":occupied,"sick_animals":sick,"occupancy_rate":round(occupied/barns*100,2) if barns else 0,"revenue":float(revenue),"upcoming_vaccines":upcoming_vaccines,"overdue_vaccines":overdue_vaccines,"low_feed_types":low_feed}

# -------------------- Generic serializers --------------------
def animal_out(a):
    return {"id":a.id,"code":a.code,"species":a.species,"origin":a.origin,"weight":a.weight,"health":a.health,"status":a.status,"barn_id":a.barn_id,"created_at":a.created_at}

def barn_out(b):
    return {"id":b.id,"name":b.name,"capacity":b.capacity,"status":b.status,"zone":getattr(b,"zone","Khu A")}

# -------------------- Barn CRUD --------------------
@app.get("/api/barns")
def list_barns(user=Depends(current), s:Session=Depends(db)):
    return [barn_out(b) | {"animal_count":s.query(Animal).filter(Animal.barn_id==b.id, Animal.status=="dang_nuoi").count()} for b in s.query(Barn).order_by(Barn.id).all()]

@app.post("/api/barns")
def add_barn(x:BarnIn,user=Depends(current),s:Session=Depends(db)):
    role(user, [])
    b=Barn(**x.model_dump()); s.add(b); s.commit(); s.refresh(b); return barn_out(b)

@app.put("/api/barns/{id}")
def update_barn(id:int,x:BarnIn,user=Depends(current),s:Session=Depends(db)):
    role(user, []); b=s.get(Barn,id)
    if not b: raise HTTPException(404,"Không tìm thấy chuồng")
    for k,v in x.model_dump().items(): setattr(b,k,v)
    s.commit(); return barn_out(b)

@app.delete("/api/barns/{id}")
def delete_barn(id:int,user=Depends(current),s:Session=Depends(db)):
    role(user, []); b=s.get(Barn,id)
    if not b: raise HTTPException(404,"Không tìm thấy chuồng")
    if s.query(Animal).filter(Animal.barn_id==id,Animal.status!="da_xoa").count(): raise HTTPException(400,"Không thể xóa chuồng đang có vật nuôi")
    s.delete(b); s.commit(); return {"message":"Đã xóa chuồng"}

# -------------------- Animal CRUD --------------------
@app.get("/api/animals")
def list_animals(keyword:Optional[str]=None,status:Optional[str]=None,page:int=Query(1,ge=1),limit:int=Query(20,ge=1,le=100),user=Depends(current),s:Session=Depends(db)):
    q=s.query(Animal).filter(Animal.status=="dang_nuoi")
    if keyword: q=q.filter((Animal.code.ilike(f"%{keyword}%"))|(Animal.origin.ilike(f"%{keyword}%"))|(Animal.species.ilike(f"%{keyword}%")))
    if status: q=q.filter(Animal.status==status)
    total=q.count(); items=q.order_by(Animal.id.desc()).offset((page-1)*limit).limit(limit).all()
    return {"total":total,"page":page,"limit":limit,"total_pages":(total+limit-1)//limit,"data":[animal_out(a) for a in items]}

@app.get("/api/animals/{id}")
def get_animal(id:int,user=Depends(current),s:Session=Depends(db)):
    a=s.get(Animal,id)
    if not a or a.status=="da_xoa": raise HTTPException(404,"Không tìm thấy vật nuôi")
    return animal_out(a)

@app.post("/api/animals")
def add_animal(x:AnimalIn,user=Depends(current),s:Session=Depends(db)):
    role(user,["NhanVienTrai"])
    if s.query(Animal).filter_by(code=x.code).first(): raise HTTPException(400,"Mã vật nuôi đã tồn tại")
    if x.barn_id is not None and not s.get(Barn,x.barn_id): raise HTTPException(400,"Chuồng không tồn tại")
    a=Animal(**x.model_dump()); s.add(a); s.commit(); s.refresh(a); refresh_barn_status(s); return animal_out(a)

@app.put("/api/animals/{id}")
def update_animal(id:int,x:AnimalIn,user=Depends(current),s:Session=Depends(db)):
    role(user,["NhanVienTrai"]); a=s.get(Animal,id)
    if not a or a.status=="da_xoa": raise HTTPException(404,"Không tìm thấy vật nuôi")
    dup=s.query(Animal).filter(Animal.code==x.code,Animal.id!=id).first()
    if dup: raise HTTPException(400,"Mã vật nuôi đã tồn tại")
    if x.barn_id is not None and not s.get(Barn,x.barn_id): raise HTTPException(400,"Chuồng không tồn tại")
    for k,v in x.model_dump().items(): setattr(a,k,v)
    s.commit(); refresh_barn_status(s); return animal_out(a)

@app.delete("/api/animals/{id}")
def delete_animal(id:int,user=Depends(current),s:Session=Depends(db)):
    role(user,[]); a=s.get(Animal,id)
    if not a: raise HTTPException(404,"Không tìm thấy vật nuôi")
    a.status="da_xoa"; s.commit(); refresh_barn_status(s); return {"message":"Đã xóa mềm"}

# -------------------- Care CRUD --------------------
@app.get("/api/care")
def list_care(user=Depends(current),s:Session=Depends(db)):
    return [{"id":c.id,"animal_id":c.animal_id,"action":c.action,"note":c.note,"created_at":c.created_at} for c in s.query(CareLog).order_by(CareLog.id.desc()).all()]

@app.post("/api/care")
def add_care(x:CareIn,user=Depends(current),s:Session=Depends(db)):
    role(user,["NhanVienTrai"]); a=s.get(Animal,x.animal_id)
    if not a or a.status=="da_xoa": raise HTTPException(404,"Không tìm thấy vật nuôi")
    s.add(CareLog(**x.model_dump())); s.commit(); return {"message":"Đã ghi nhận chăm sóc"}

@app.delete("/api/care/{id}")
def delete_care(id:int,user=Depends(current),s:Session=Depends(db)):
    role(user,[]); c=s.get(CareLog,id)
    if not c: raise HTTPException(404,"Không tìm thấy nhật ký")
    s.delete(c); s.commit(); return {"message":"Đã xóa nhật ký"}

# -------------------- Feed CRUD --------------------
@app.get("/api/feed-types")
def list_feed(user=Depends(current),s:Session=Depends(db)):
    return [{"id":f.id,"name":f.name,"unit":f.unit,"stock":f.stock,"description":f.description,"active":f.active} for f in s.query(FeedType).order_by(FeedType.id).all()]

@app.post("/api/feed-types")
def add_feed(x:FeedTypeIn,user=Depends(current),s:Session=Depends(db)):
    role(user,[]); f=FeedType(**x.model_dump()); s.add(f); s.commit(); s.refresh(f); return {"id":f.id,"name":f.name,"unit":f.unit,"stock":f.stock,"description":f.description,"active":f.active}

@app.put("/api/feed-types/{id}")
def update_feed(id:int,x:FeedTypeIn,user=Depends(current),s:Session=Depends(db)):
    role(user,[]); f=s.get(FeedType,id)
    if not f: raise HTTPException(404,"Không tìm thấy thức ăn")
    for k,v in x.model_dump().items(): setattr(f,k,v)
    s.commit(); return {"message":"Đã cập nhật"}

@app.delete("/api/feed-types/{id}")
def delete_feed(id:int,user=Depends(current),s:Session=Depends(db)):
    role(user,[]); f=s.get(FeedType,id)
    if not f: raise HTTPException(404,"Không tìm thấy thức ăn")
    s.delete(f); s.commit(); return {"message":"Đã xóa thức ăn"}

@app.get("/api/barn-feeds")
def list_barn_feeds(barn_id:Optional[int]=None,user=Depends(current),s:Session=Depends(db)):
    q=s.query(BarnFeedStock).order_by(BarnFeedStock.barn_id, BarnFeedStock.feed_type_id)
    if barn_id: q=q.filter(BarnFeedStock.barn_id==barn_id)
    out=[]
    for x in q.all():
        b=s.get(Barn,x.barn_id); f=s.get(FeedType,x.feed_type_id)
        out.append({"id":x.id,"barn_id":x.barn_id,"barn_name":b.name if b else "","feed_type_id":x.feed_type_id,"feed_name":f.name if f else "","unit":f.unit if f else "kg","quantity":x.quantity,"updated_at":x.updated_at})
    return out

@app.post("/api/barn-feeds")
def add_barn_feed(x:BarnFeedIn,user=Depends(current),s:Session=Depends(db)):
    role(user,["NhanVienTrai"]); b=s.get(Barn,x.barn_id); f=s.get(FeedType,x.feed_type_id)
    if not b or not f: raise HTTPException(404,"Chuồng hoặc loại thức ăn không tồn tại")
    if f.stock < x.quantity: raise HTTPException(400,"Kho tổng không đủ thức ăn")
    row=s.query(BarnFeedStock).filter_by(barn_id=x.barn_id,feed_type_id=x.feed_type_id).first()
    if not row: row=BarnFeedStock(barn_id=x.barn_id,feed_type_id=x.feed_type_id,quantity=0); s.add(row)
    row.quantity += x.quantity; row.updated_at=datetime.utcnow(); f.stock -= x.quantity
    s.commit(); return {"message":"Đã cấp thức ăn cho chuồng"}

@app.post("/api/barn-feeds/transfer")
def transfer_feed(x:FeedTransferIn,user=Depends(current),s:Session=Depends(db)):
    role(user,["NhanVienTrai"]);
    if x.from_barn_id==x.to_barn_id: raise HTTPException(400,"Chuồng nguồn và chuồng đích phải khác nhau")
    src=s.query(BarnFeedStock).filter_by(barn_id=x.from_barn_id,feed_type_id=x.feed_type_id).first()
    if not src or src.quantity < x.quantity: raise HTTPException(400,"Chuồng nguồn không đủ thức ăn")
    if not s.get(Barn,x.to_barn_id) or not s.get(FeedType,x.feed_type_id): raise HTTPException(404,"Dữ liệu không tồn tại")
    dst=s.query(BarnFeedStock).filter_by(barn_id=x.to_barn_id,feed_type_id=x.feed_type_id).first()
    if not dst: dst=BarnFeedStock(barn_id=x.to_barn_id,feed_type_id=x.feed_type_id,quantity=0); s.add(dst)
    src.quantity -= x.quantity; dst.quantity += x.quantity; src.updated_at=dst.updated_at=datetime.utcnow()
    s.add(FeedTransfer(from_barn_id=x.from_barn_id,to_barn_id=x.to_barn_id,feed_type_id=x.feed_type_id,quantity=x.quantity,user_id=user.id))
    s.commit(); return {"message":"Đã chuyển thức ăn thành công"}

@app.get("/api/feed-transfers")
def list_transfers(user=Depends(current),s:Session=Depends(db)):
    rows=s.query(FeedTransfer).order_by(FeedTransfer.id.desc()).limit(100).all(); out=[]
    for x in rows:
        fb=s.get(Barn,x.from_barn_id); tb=s.get(Barn,x.to_barn_id); f=s.get(FeedType,x.feed_type_id)
        out.append({"id":x.id,"from_barn":fb.name if fb else "","to_barn":tb.name if tb else "","feed_name":f.name if f else "","quantity":x.quantity,"created_at":x.created_at})
    return out

@app.get("/api/feed-norms")
def list_norms(user=Depends(current),s:Session=Depends(db)):
    return [{"id":n.id,"species":n.species,"min_weight":n.min_weight,"max_weight":n.max_weight,"daily_kg":n.daily_kg,"feed_type_id":n.feed_type_id} for n in s.query(FeedNorm).all()]

@app.post("/api/feed-norms")
def add_norm(x:FeedNormIn,user=Depends(current),s:Session=Depends(db)):
    role(user,[])
    if x.max_weight < x.min_weight: raise HTTPException(400,"Khối lượng tối đa phải lớn hơn hoặc bằng tối thiểu")
    if not s.get(FeedType,x.feed_type_id): raise HTTPException(400,"Loại thức ăn không tồn tại")
    n=FeedNorm(**x.model_dump()); s.add(n); s.commit(); s.refresh(n); return {"id":n.id}

# -------------------- Vaccination CRUD --------------------
@app.get("/api/vaccinations")
def list_vaccines(user=Depends(current),s:Session=Depends(db)):
    return [{"id":v.id,"animal_id":v.animal_id,"vaccine":v.vaccine,"scheduled_at":v.scheduled_at,"status":v.status,"note":v.note} for v in s.query(Vaccination).order_by(Vaccination.scheduled_at).all()]

@app.post("/api/vaccinations")
def add_vaccine(x:VaccineIn,user=Depends(current),s:Session=Depends(db)):
    role(user,["KyThuatVien"]); a=s.get(Animal,x.animal_id)
    if not a or a.status=="da_xoa": raise HTTPException(404,"Không tìm thấy vật nuôi")
    v=Vaccination(**x.model_dump()); s.add(v); s.commit(); s.refresh(v); return {"id":v.id,"message":"Đã tạo lịch tiêm"}

@app.put("/api/vaccinations/{id}")
def update_vaccine(id:int,x:VaccineIn,user=Depends(current),s:Session=Depends(db)):
    role(user,["KyThuatVien"]); v=s.get(Vaccination,id)
    if not v: raise HTTPException(404,"Không tìm thấy lịch tiêm")
    for k,val in x.model_dump().items(): setattr(v,k,val)
    s.commit(); return {"message":"Đã cập nhật lịch tiêm"}

@app.delete("/api/vaccinations/{id}")
def delete_vaccine(id:int,user=Depends(current),s:Session=Depends(db)):
    role(user,[]); v=s.get(Vaccination,id)
    if not v: raise HTTPException(404,"Không tìm thấy lịch tiêm")
    s.delete(v); s.commit(); return {"message":"Đã xóa lịch tiêm"}

# -------------------- Growth CRUD --------------------
@app.get("/api/growth")
def list_growth(animal_id:Optional[int]=None,user=Depends(current),s:Session=Depends(db)):
    q=s.query(GrowthMeasurement).order_by(GrowthMeasurement.measured_at)
    if animal_id: q=q.filter(GrowthMeasurement.animal_id==animal_id)
    return [{"id":g.id,"animal_id":g.animal_id,"measured_at":g.measured_at,"weight":g.weight,"note":g.note} for g in q.all()]

@app.post("/api/growth")
def add_growth(x:GrowthIn,user=Depends(current),s:Session=Depends(db)):
    role(user,["NhanVienTrai","KyThuatVien"]); a=s.get(Animal,x.animal_id)
    if not a or a.status=="da_xoa": raise HTTPException(404,"Không tìm thấy vật nuôi")
    g=GrowthMeasurement(**x.model_dump()); a.weight=x.weight; s.add(g); s.commit(); return {"message":"Đã ghi nhận tăng trưởng"}

@app.delete("/api/growth/{id}")
def delete_growth(id:int,user=Depends(current),s:Session=Depends(db)):
    role(user,[]); g=s.get(GrowthMeasurement,id)
    if not g: raise HTTPException(404,"Không tìm thấy dữ liệu")
    s.delete(g); s.commit(); return {"message":"Đã xóa"}

# -------------------- Export CRUD --------------------
@app.get("/api/exports")
def list_exports(user=Depends(current),s:Session=Depends(db)):
    rows = s.query(ExportBill, Animal, Barn).outerjoin(Animal, ExportBill.animal_id == Animal.id).outerjoin(Barn, Animal.barn_id == Barn.id).order_by(ExportBill.id.desc()).all()
    return [{"id": e.id, "animal_id": e.animal_id, "animal_code": a.code if a else str(e.animal_id), "species": a.species if a else "", "barn_id": a.barn_id if a else None, "barn_name": b.name if b else "", "quantity": e.quantity, "weight": e.weight, "total": e.total, "customer": e.customer, "exported_at": e.exported_at} for e, a, b in rows]

@app.post("/api/exports")
def add_export(x:ExportIn,user=Depends(current),s:Session=Depends(db)):
    role(user,["NhanVienXuatBan"]); a=s.get(Animal,x.animal_id)
    if not a or a.status in ["da_xuat_ban","da_xoa"]: raise HTTPException(400,"Vật nuôi không hợp lệ")
    e=ExportBill(**x.model_dump()); a.status="da_xuat_ban"; s.add(e); s.commit(); refresh_barn_status(s); return {"message":"Đã lập phiếu xuất bán"}

# -------------------- Reports --------------------
@app.get("/api/reports/health")
def health_report(user=Depends(current),s:Session=Depends(db)):
    rows=s.query(Animal.health,func.count(Animal.id)).filter(Animal.status=="dang_nuoi").group_by(Animal.health).all()
    return [{"health":h,"count":c} for h,c in rows]

@app.get("/api/reports/growth")
def growth_report(user=Depends(current),s:Session=Depends(db)):
    rows=s.query(Animal.species,func.avg(Animal.weight),func.count(Animal.id)).filter(Animal.status=="dang_nuoi").group_by(Animal.species).all()
    return [{"species":sp,"average_weight":round(float(avg or 0),2),"count":count} for sp,avg,count in rows]

@app.get("/api/reports/sales")
def sales_report(user=Depends(current),s:Session=Depends(db)):
    total=s.query(func.coalesce(func.sum(ExportBill.total),0)).scalar() or 0
    weight=s.query(func.coalesce(func.sum(ExportBill.weight),0)).scalar() or 0
    bills=s.query(ExportBill).count()
    return {"bills":bills,"weight":float(weight),"revenue":float(total)}

# -------------------- AI --------------------
from .ai.guardrails import sanitize_prompt, sanitize_output, normalize_question
from .ai.llm import call_openai

# Lightweight per-user cooldown to protect the provider and demonstrate rate-limit handling.
_ai_last_request = {}
AI_COOLDOWN_SECONDS = float(os.getenv("AI_COOLDOWN_SECONDS", "2"))

def check_ai_rate_limit(user_id: int):
    now = datetime.utcnow().timestamp()
    last = _ai_last_request.get(user_id, 0)
    if now - last < AI_COOLDOWN_SECONDS:
        raise HTTPException(429, f"Vui lòng chờ {AI_COOLDOWN_SECONDS:g} giây trước khi gửi yêu cầu AI tiếp theo")
    _ai_last_request[user_id] = now

from .ai.workspace import catalog as ai_catalog, respond as workspace_respond
from .ai import llm as ai_provider
from .ai.reports import is_report_request, system_report

@app.get("/api/ai/capabilities")
def ai_capabilities(user=Depends(current)):
    return {"configured": bool(ai_provider.OPENAI_API_KEY), "read_only": True, "system_reports": True,
            "pages": ai_catalog(user)}

from .ai.analytics import snapshot as farm_snapshot, growth as farm_growth, answer as farm_answer, bounded_context
from .ai.prompts import SYSTEM_PROMPT, build_analyze_prompt
from .ai.context import build_farm_context

@app.get("/api/ai/alerts")
def ai_alerts(user=Depends(current), s:Session=Depends(db)):
    ai_catalog(user)
    alerts = farm_snapshot(s)['alerts']
    return {"total":len(alerts), "alerts":alerts}

@app.get("/api/ai/growth/{animal_id}")
def ai_growth(animal_id:int, user=Depends(current), s:Session=Depends(db)):
    ai_catalog(user)
    return farm_growth(s, animal_id)

@app.post("/api/ai/summary")
def ai_summary(user=Depends(current), s:Session=Depends(db)):
    result = ai_analyze(AIIn(prompt="Tóm tắt hôm nay", page="dashboard"), user, s, summary=True)
    return {**result, "summary":result['answer']}

@app.post("/api/ai/analyze")
def ai_analyze(x:AIIn, user=Depends(current), s:Session=Depends(db), summary:bool=False):
    ai_catalog(user)
    check_ai_rate_limit(user.id)
    try:
        question = sanitize_prompt(x.prompt)
        history = [{"role":m.role, "content":sanitize_prompt(m.content) if m.role=='user' else sanitize_output(m.content)} for m in x.messages]
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    data = farm_snapshot(s)
    internal = farm_answer(question, data, s, summary=summary or 'tom tat' in normalize_question(question))
    result = {"answer":internal, "mode":"fallback", "sources":[p for p in ai_catalog(user) if p['page']=='reports']}
    # Structured, bounded facts only; arithmetic and fallback never depend on a model.
    context = build_farm_context(s, data)
    if ai_provider.OPENAI_API_KEY:
        try:
            normalized = normalize_question(question)
            if summary or any(term in normalized for term in ('tom tat', 'uu tien', 'bao cao')) or ('tang truong' in normalized and 'bao nhieu' not in normalized):
                response, _ = call_openai(SYSTEM_PROMPT, build_analyze_prompt(context, question) + "\nPHÂN TÍCH NỘI BỘ ĐÃ TÍNH:\n" + internal)
                result.update(answer=sanitize_output(response), mode='ai')
            else:
                planned = workspace_respond(question, history, x.page, user, s, call_openai)
                if planned['mode'] == 'openai':
                    result.update(planned, mode='ai')
                elif planned['mode'] in ('guide', 'clarify'):
                    result.update(planned, mode='fallback')

        except (ai_provider.ProviderError, ai_provider.openai.APIError, TimeoutError, ValueError):
            pass
    query_type = 'summary' if summary else 'analyze'
    s.add(AIRequest(user_id=user.id, request=question, response=result['answer'], mode=result['mode'], model=ai_provider.OPENAI_MODEL if result['mode']=='ai' else 'rules-v1', query_type=query_type, conversation_id=x.conversation_id or uuid.uuid4().hex))
    s.commit()
    return {**result, "context_chars":len(context), "query_type":query_type}

@app.get("/api/ai/history")
def ai_history(user=Depends(current), s:Session=Depends(db)):
    # Every role, including Admin, sees only its own audit entries.
    q = s.query(AIRequest).filter(AIRequest.user_id == user.id)
    rows = q.order_by(AIRequest.id.desc()).limit(100).all()
    return [{"id":r.id,"user_id":r.user_id,"request":sanitize_output(r.request) if r.model else "Yêu cầu cũ (không lưu nội dung)","prompt":sanitize_output(r.request) if r.model else "Yêu cầu cũ (không lưu nội dung)","response":sanitize_output(r.response) if r.model else "Không hiển thị nội dung hội thoại cũ","mode":r.mode,"status":"success" if r.mode=='ai' else 'fallback',"model":r.model,"query_type":r.query_type,"conversation_id":r.conversation_id or str(r.id),"created_at":r.created_at} for r in rows]

@app.delete("/api/ai/conversations/{conversation_id}")
def delete_ai_conversation(conversation_id:str, user=Depends(current), s:Session=Depends(db)):
    ai_catalog(user)
    removed=s.query(AIRequest).filter(AIRequest.user_id==user.id, AIRequest.conversation_id==conversation_id).delete(synchronize_session=False)
    s.commit()
    return {"deleted":removed}
