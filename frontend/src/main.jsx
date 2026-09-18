import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';

const API='http://localhost:8000/api';

const menu=[
  ['dashboard','⌂','Tổng quan'],
  ['animals','🐄','Đàn vật nuôi'],
  ['barns','⌂','Chuồng trại'],
  ['feeds','🌾','Thức ăn'],
  ['vacc','💉','Vaccine'],
  ['growth','↗','Tăng trưởng'],
  ['exports','🚚','Xuất bán'],
  ['reports','▥','Báo cáo'],
  ['ai','✦','Trợ lý AI'],
  ['care','✚','Chăm sóc']
];

function App(){
  const [token,setToken]=useState(localStorage.getItem('token')||sessionStorage.getItem('token'));
  const [user,setUser]=useState(
    JSON.parse(localStorage.getItem('user')||sessionStorage.getItem('user')||'null')
  );

  const [tab,setTab]=useState('dashboard');
  const [data,setData]=useState({});
  const [msg,setMsg]=useState('');

  const call=async(path,opts={})=>{
    const r=await fetch(API+path,{
      ...opts,
      headers:{
        'Content-Type':'application/json',
        Authorization:token?`Bearer ${token}`:'',
        ...(opts.headers||{})
      }
    });

    const b=await r.json().catch(()=>({}));

    if(!r.ok){
      throw Error(b.detail||'Có lỗi xảy ra');
    }

    return b;
  };

  const load=async()=>{
    if(!token) return;

    try{
      const [
        dash,
        animals,
        barns,
        care,
        vacc,
        growth,
        feeds,
        barnFeeds,
        feedTransfers,
        exports,
        ai
      ]=await Promise.all([
        call('/dashboard'),
        call('/animals?limit=100'),
        call('/barns'),
        call('/care'),
        call('/vaccinations'),
        call('/growth'),
        call('/feed-types'),
        call('/barn-feeds'),
        call('/feed-transfers'),
        call('/exports'),
        call('/ai/history')
      ]);

      setData({
        dash,
        animals:animals.data,
        barns,
        care,
        vacc,
        growth,
        feeds,
        barnFeeds,
        feedTransfers,
        exports,
        ai
      });

      setMsg('Dữ liệu đã cập nhật');

      setTimeout(()=>setMsg(''),2500);

    }catch(e){
      setMsg(e.message);
    }
  };

  useEffect(()=>{
    load();
  },[token]);

  if(!token){
    return (
      <Login
        onLogin={(t,u,remember=true)=>{
          if(remember){
            localStorage.setItem('token',t);
            localStorage.setItem('user',JSON.stringify(u));
          } else {
            sessionStorage.setItem('token',t);
            sessionStorage.setItem('user',JSON.stringify(u));
          }
          setToken(t);
          setUser(u);
        }}
      />
    );
  }

  const logout=()=>{
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const current=menu.find(x=>x[0]===tab);

  return (
    <div className="app">

      <aside className="sidebar">
        <div className="brand">
          <div className="brandmark">🐄</div>
          <div>
            <b>FarmAI</b>
            <span>Smart Livestock Management</span>
          </div>
          <button className="sidebar-collapse" type="button">‹‹</button>
        </div>

        <nav className="main-nav">
          {menu.map(([k,ic,v])=>(
            <button key={k} className={tab===k?'navactive':''} onClick={()=>setTab(k)}>
              <i>{ic}</i>
              <span>{v}</span>
              {['animals','barns','feeds','vacc'].includes(k) && <b className="nav-chevron">⌄</b>}
              {k==='ai'&&<em>AI</em>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="farm-footer-icon">⌁</div>
          <div><b>Nông nghiệp thông minh</b><small>Vì một tương lai bền vững</small></div>
        </div>
        <button className="logout" onClick={logout}>↪ Đăng xuất</button>
      </aside>

      <main>
        <header className="topbar">
          <div className="searchbox">
            <span>⌕</span><input aria-label="Tìm kiếm" placeholder="Tìm kiếm nhanh..." />
          </div>
          <div className="top-actions">
            <button className="notification" type="button">♧<b>3</b></button>
            <div className="top-profile">
              <div className="avatar">{(user?.name||'A').slice(0,1).toUpperCase()}</div>
              <div><strong>{user?.username||'admin'}</strong><small>Quản lý trang trại</small></div>
              <span>⌄</span>
            </div>
          </div>
        </header>

        {msg&&(
          <div className="toast">
            ✓ {msg}
          </div>
        )}

        {tab==='dashboard'&&
          <Dashboard
            d={data.dash}
            animals={data.animals||[]}
            barns={data.barns||[]}
            feeds={data.feeds||[]}
            barnFeeds={data.barnFeeds||[]}
            care={data.care||[]}
            vacc={data.vacc||[]}
            exports={data.exports||[]}
            setTab={setTab}
          />
        }

        {tab==='animals'&&
          <Animals
            rows={data.animals||[]}
            reload={load}
            call={call}
            user={user}
          />
        }

        {tab==='barns'&&
          <Barns rows={data.barns||[]} animals={data.animals||[]} call={call} reload={load} user={user}/>
        }

        {tab==='care'&&
  <Care
    rows={data.care||[]}
    animals={data.animals||[]}
    reload={load}
    call={call}
    user={user}
  />
}

{tab==='vacc'&&
  <Vacc
    rows={data.vacc||[]}
    animals={data.animals||[]}
    reload={load}
    call={call}
    user={user}
  />
}

{tab==='growth'&&
  <Growth
    rows={data.growth||[]}
    animals={data.animals||[]}
    reload={load}
    call={call}
    user={user}
  />
}

        {tab==='feeds'&&
          <Feeds rows={data.feeds||[]} barns={data.barns||[]} animals={data.animals||[]} barnFeeds={data.barnFeeds||[]} feedTransfers={data.feedTransfers||[]} call={call} reload={load} user={user}/>
        }

        {tab==='exports'&&
          <Exports rows={data.exports||[]} barns={data.barns||[]} animals={data.animals||[]} call={call} reload={load} user={user}/>
        }

        {tab==='ai'&&
          <AI
            rows={data.ai||[]}
            call={call}
            reload={load}
          />
        }

        {tab==='reports'&&
          <Reports data={{...data,dashboard:data.dash}} call={call}/>
        }

      </main>

    </div>
  );
}


/* =========================
   LOGIN
========================= */

function Login({onLogin}){
  const [mode,setMode]=useState('login'); const [u,setU]=useState('admin'); const [p,setP]=useState('admin123');
  const [name,setName]=useState(''); const [role,setRole]=useState('NhanVienTrai'); const [newP,setNewP]=useState('');
  const [err,setErr]=useState(''); const [ok,setOk]=useState(''); const [showPassword,setShowPassword]=useState(false); const [remember,setRemember]=useState(true); const [loading,setLoading]=useState(false);
  const reset=()=>{setErr('');setOk('');setMode('login')};
  const submit=async e=>{e.preventDefault();setErr('');setOk('');setLoading(true);try{
    if(mode==='register'){
      const r=await fetch(API+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),username:u.trim(),password:p,role})}); const b=await r.json().catch(()=>({})); if(!r.ok) throw Error(b.detail||'Không thể đăng ký'); setOk('Đăng ký thành công. Bạn có thể đăng nhập ngay.'); setMode('login'); setP('');
    } else if(mode==='forgot'){
      const r=await fetch(API+'/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u.trim(),new_password:newP})}); const b=await r.json().catch(()=>({})); if(!r.ok) throw Error(b.detail||'Không thể đặt lại mật khẩu'); setOk(b.message||'Đã đặt lại mật khẩu'); setMode('login'); setP('');
    } else {
      const r=await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u.trim(),password:p})}); const b=await r.json().catch(()=>({})); if(!r.ok) throw Error(b.detail||'Tài khoản hoặc mật khẩu không đúng'); onLogin(b.access_token,b.user,remember);
    }
  }catch(e){setErr(e.message||'Có lỗi xảy ra')}finally{setLoading(false)}};
  const title=mode==='login'?'Chào mừng trở lại!':mode==='register'?'Tạo tài khoản mới':'Khôi phục mật khẩu';
  return <div className="login-page"><section className="login-showcase"><div className="showcase-orb orb-one"/><div className="showcase-orb orb-two"/><div className="showcase-orb orb-three"/><div className="showcase-content"><div className="showcase-logo"><div className="showcase-logo-mark">🐖</div><div><b>SMART LIVESTOCK</b><span>AI MANAGEMENT</span></div></div><div className="showcase-copy"><div className="showcase-label">NỀN TẢNG QUẢN LÝ CHĂN NUÔI</div><h2>Quản lý trang trại<br/><strong>thông minh hơn với AI</strong></h2><p>Theo dõi đàn vật nuôi, chuồng trại, chăm sóc, tiêm phòng, tăng trưởng và xuất bán trên một nền tảng.</p></div><div className="showcase-features"><span>✓ Dữ liệu tập trung</span><span>✓ AI hỗ trợ phân tích</span><span>✓ Phân quyền người dùng</span></div><div className="showcase-footer">ICTU • Nhóm 17 • 2026</div></div></section><section className="login-panel"><form className="login-form" onSubmit={submit}><div className="mobile-brand"><div className="showcase-logo-mark">🐖</div><b>Smart Livestock</b></div><div className="form-kicker">SMART LIVESTOCK AI</div><h1>{title}</h1><p className="login-subtitle">{mode==='login'?'Đăng nhập để tiếp tục quản lý trang trại của bạn.':mode==='register'?'Đăng ký tài khoản để sử dụng hệ thống.':'Nhập tài khoản và mật khẩu mới để khôi phục.'}</p>
  {mode==='register'&&<><label>Họ và tên</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nhập họ và tên" required/><label>Vai trò</label><select value={role} onChange={e=>setRole(e.target.value)}><option value="NhanVienTrai">Nhân viên trại</option><option value="KyThuatVien">Kỹ thuật viên</option><option value="NhanVienXuatBan">Nhân viên xuất bán</option></select></>}
  <label>Tên đăng nhập</label><input value={u} onChange={e=>setU(e.target.value)} placeholder="Tên đăng nhập" autoComplete="username" required/>
  {mode!=='forgot'&&<><label>Mật khẩu</label><div className="password-wrap"><input value={p} onChange={e=>setP(e.target.value)} type={showPassword?'text':'password'} placeholder="Nhập mật khẩu" required/><button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)}>{showPassword?'🙈':'👁'}</button></div></>}
  {mode==='forgot'&&<><label>Mật khẩu mới</label><div className="password-wrap"><input value={newP} onChange={e=>setNewP(e.target.value)} type={showPassword?'text':'password'} placeholder="Tối thiểu 6 ký tự" minLength="6" required/></div></>}
  {mode==='login'&&<div className="login-options"><label className="remember-label"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/><span>Ghi nhớ đăng nhập</span></label><button type="button" className="forgot-button" onClick={()=>{setMode('forgot');setErr('');setOk('')}}>Quên mật khẩu?</button></div>}
  <button className="login-submit" disabled={loading}>{loading?'ĐANG XỬ LÝ...':mode==='login'?'ĐĂNG NHẬP':mode==='register'?'ĐĂNG KÝ':'ĐẶT LẠI MẬT KHẨU'}</button>
  {err&&<div className="login-error">⚠ {err}</div>}{ok&&<div className="login-success">✓ {ok}</div>}
  {mode==='login'?<><div className="login-links"><span>Chưa có tài khoản?</span><button type="button" onClick={()=>{setMode('register');setErr('');setOk('')}}>Đăng ký ngay</button></div><div className="demo-note"><span>Tài khoản demo</span><b>admin / admin123</b></div></>:<div className="login-links"><button type="button" onClick={reset}>← Quay lại đăng nhập</button></div>}
  <div className="login-copyright">© 2026 Smart Livestock • ICTU</div></form></section></div>
}

/* =========================
   DASHBOARD
========================= */

function Dashboard({d,animals,barns,feeds,barnFeeds,care,vacc,exports,setTab}){
  const health=useMemo(()=>({
    normal:animals.filter(x=>x.health==='binh_thuong').length,
    watch:animals.filter(x=>x.health==='can_theo_doi').length,
    sick:animals.filter(x=>x.health==='benh').length
  }),[animals]);

  const species=useMemo(()=>{
    const map={};
    animals.filter(x=>x.status!=='da_xoa').forEach(x=>{map[x.species]=(map[x.species]||0)+1});
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5);
  },[animals]);

  const activities=useMemo(()=>{
    const rows=[];
    care.slice(0,3).forEach(x=>rows.push({icon:'🌿',title:'Nhật ký chăm sóc',sub:`Vật nuôi #${x.animal_id} – ${x.action}`,time:x.created_at}));
    vacc.slice(0,3).forEach(x=>rows.push({icon:'💉',title:'Tiêm vaccine',sub:`Vật nuôi #${x.animal_id} – ${x.vaccine}`,time:x.scheduled_at}));
    exports.slice(0,3).forEach(x=>rows.push({icon:'🚚',title:'Xuất bán',sub:`Phiếu #${x.id} – ${Number(x.weight||0).toLocaleString()} kg`,time:x.exported_at}));
    return rows.slice(0,5);
  },[care,vacc,exports]);

  const fmtTime=(v)=>{
    if(!v)return 'Gần đây';
    const d=new Date(v); if(Number.isNaN(d.getTime())) return 'Gần đây';
    const mins=Math.max(0,Math.floor((Date.now()-d.getTime())/60000));
    if(mins<60)return `${Math.max(1,mins)} phút trước`;
    const h=Math.floor(mins/60); if(h<24)return `${h} giờ trước`;
    return `${Math.floor(h/24)} ngày trước`;
  };

  const totalFeed=barnFeeds.reduce((sum,x)=>sum+Number(x.quantity||0),0);
  const maxSpecies=Math.max(1,...species.map(x=>x[1]));

  return (
    <div className="dashboard-page">
      <div className="hero hero-reference">
        <div className="hero-copy">
          <span className="pill">◉ TRANG TRẠI ĐANG HOẠT ĐỘNG</span>
          <h2>Xin chào, admin 👋</h2>
          <p>Chào mừng bạn đến với hệ thống quản lý chăn nuôi thông minh!</p>
          <div className="hero-status">✓ Trang trại của bạn đang hoạt động tốt</div>
        </div>
        <div className="hero-illustration" aria-hidden="true"><span>☁</span><span>🐄</span><span>🌳</span></div>
      </div>

      <div className="stats reference-stats">
        <Stat icon="🐄" label="Tổng đàn" value={d?.total_animals??0} note="con" trend="↑ 2 hôm qua" />
        <Stat icon="⌂" label="Chuồng trại" value={d?.total_barns??0} note={`${d?.occupied_barns??0} đang nuôi`} trend="↑ 0 hôm qua" />
        <Stat icon="♥" label="Cần theo dõi" value={d?.sick_animals??0} note="trường hợp" alert trend="↓ 0 hôm qua" />
        <Stat icon="₫" label="Doanh thu" value={`${Number(d?.revenue??0).toLocaleString()} đ`} note="tổng xuất bán" trend="↑ 12% so với tuần trước" />
      </div>

      <div className="dashboard-grid reference-grid-top">
        <section className="panel health-panel">
          <div className="panel-head"><div><h3>Tình trạng sức khỏe đàn</h3><p>Tổng quan sức khỏe vật nuôi hiện tại</p></div><button onClick={()=>setTab('animals')}>Chi tiết →</button></div>
          <div className="health health-reference">
            <div className="health-ring"><strong>{animals.length}</strong><small>tổng đàn</small></div>
            <div className="legend">
              <Legend dot="normal" text="Bình thường" val={health.normal} />
              <Legend dot="watch" text="Cần theo dõi" val={health.watch} />
              <Legend dot="sick" text="Bệnh" val={health.sick} />
            </div>
          </div>
        </section>

        <section className="panel activity-panel">
          <div className="panel-head"><div><h3>Hoạt động gần đây</h3></div><button onClick={()=>setTab('care')}>Xem tất cả →</button></div>
          <div className="activity-list">
            {activities.length ? activities.map((x,i)=><div className="activity-row" key={i}><span className="activity-icon">{x.icon}</span><div><b>{x.title}</b><small>{x.sub}</small></div><time>{fmtTime(x.time)}</time></div>) : <div className="empty-box">Chưa có hoạt động gần đây.</div>}
          </div>
        </section>

        <section className="panel quick-panel">
          <div className="panel-head"><div><h3>Thao tác nhanh</h3></div></div>
          <div className="quick-grid reference-quick">
            <Quick icon="🐄" title="Quản lý vật nuôi" sub="Thêm / sửa / xóa" onClick={()=>setTab('animals')} />
            <Quick icon="⌂" title="Quản lý chuồng" sub="Xem thông tin chuồng" onClick={()=>setTab('barns')} />
            <Quick icon="🌾" title="Quản lý thức ăn" sub="Nhập / chuyển thức ăn" onClick={()=>setTab('feeds')} />
            <Quick icon="💉" title="Quản lý vaccine" sub="Lịch tiêm / nhắc nhở" onClick={()=>setTab('vacc')} />
            <Quick icon="▥" title="Xem báo cáo" sub="Thống kê chi tiết" onClick={()=>setTab('reports')} />
            <Quick icon="✦" title="Trợ lý AI" sub="Hỏi đáp thông minh" onClick={()=>setTab('ai')} />
          </div>
        </section>
      </div>

      <div className="dashboard-grid reference-grid-bottom">
        <section className="panel species-panel">
          <div className="panel-head"><div><h3>Thống kê đàn theo loại</h3><p>Biểu đồ số lượng vật nuôi</p></div></div>
          <div className="species-chart">
            {species.map(([name,count])=><div className="species-bar" key={name}><span>{count}</span><div style={{height:`${Math.max(8,(count/maxSpecies)*100)}%`}}></div><small>{name}</small></div>)}
            {!species.length && <div className="empty-box">Chưa có dữ liệu.</div>}
          </div>
        </section>

        <section className="panel feed-summary-panel">
          <div className="panel-head"><div><h3>Thức ăn theo chuồng</h3><p>Lượng thức ăn còn lại (kg)</p></div><button onClick={()=>setTab('feeds')}>Xem tất cả →</button></div>
          <div className="feed-summary-table"><div className="feed-row feed-head"><span>Chuồng</span><span>Thức ăn chính</span><span>Còn lại</span></div>
            {barns.slice(0,5).map(b=>{const rows=barnFeeds.filter(x=>x.barn_id===b.id); const first=rows[0]; const qty=rows.reduce((a,x)=>a+Number(x.quantity||0),0); const pct=Math.min(100,qty/3); return <div className="feed-row" key={b.id}><span>{b.name}</span><span>{first?.feed_name||'Chưa cấp thức ăn'}</span><strong>{qty.toLocaleString()} kg</strong><i><b style={{width:`${Math.max(8,pct)}%`}}/></i></div>})}
            {!barns.length && <div className="empty-box">Chưa có chuồng.</div>}
          </div>
          <div className="feed-total">Tổng thức ăn đang cấp: <b>{totalFeed.toLocaleString()} kg</b></div>
        </section>

        <section className="panel ai-mini-panel">
          <div className="panel-head"><div><h3>Trợ lý AI</h3></div><span className="ai-online">● Online</span></div>
          <div className="ai-mini-body"><div className="ai-mini-avatar">✦</div><p>Tôi có thể hỗ trợ bạn về các vấn đề liên quan đến hệ thống chăn nuôi. Hãy đặt câu hỏi!</p></div>
          <button className="ai-open" onClick={()=>setTab('ai')}>Hỏi Trợ lý AI →</button>
          <div className="ai-suggestions"><button onClick={()=>setTab('ai')}>Chuồng 01 có những con nào?</button><button onClick={()=>setTab('ai')}>Còn bao nhiêu thức ăn?</button><button onClick={()=>setTab('ai')}>Lịch tiêm vaccine sắp tới?</button></div>
        </section>
      </div>
    </div>
  );
}


function Stat({icon,label,value,note,alert,trend}){

  return (

    <div className="stat">

      <div className={'stat-icon '+(alert?'danger':'')}>
        {icon}
      </div>

      <div>

        <span>{label}</span>

        <strong>{value}</strong>

        <small>{note}</small>
        {trend&&<small className="trend">{trend}</small>}

      </div>

    </div>

  );
}


function Legend({dot,text,val}){

  return (

    <div>

      <i className={dot}></i>

      <span>{text}</span>

      <b>{val}</b>

    </div>

  );
}


function Quick({icon,title,sub,onClick}){

  return (

    <button
      className="quick-item"
      onClick={onClick}
      type="button"
    >

      <div>{icon}</div>

      <span>

        <b>{title}</b>

        <small>{sub}</small>

      </span>

      <b>→</b>

    </button>

  );
}


/* =========================
   TABLE
========================= */

function Table({cols,rows}) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c[0]}>
                {c[1]}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows && rows.length > 0 ? (
            rows.map((r, i) => (
              <tr key={r.id ?? i}>
                {cols.map((c) => {
                  const value = r[c[0]];

                  return (
                    <td key={c[0]}>
                      {c[0] === 'health' ? (
                        <Health v={value} />
                      ) : c[0] === 'status' ? (
                        <Badge v={value} />
                      ) : (
                        String(value ?? '')
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td
                className="empty"
                colSpan={cols.length}
              >
                Chưa có dữ liệu
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}


function Health({v}){

  const m={
    binh_thuong:['Bình thường','ok'],
    can_theo_doi:['Theo dõi','warn'],
    benh:['Bệnh','bad']
  };

  const x=m[v]||[v,''];

  return (
    <span className={'tag '+x[1]}>
      {x[0]}
    </span>
  );
}


function Badge({v}){

  return (
    <span className="tag">
      {String(v||'').replaceAll('_',' ')}
    </span>
  );
}


/* =========================
   VẬT NUÔI
   THÊM / SỬA / XÓA
========================= */

function Animals({rows, reload, call, user}) {
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);

  // FORM THÊM / SỬA
  const [form, setForm] = useState({
    code: '',
    species: 'Heo',
    origin: '',
    weight: 0,
    health: 'binh_thuong',
    status: 'dang_nuoi',
    barn_id: ''
  });

  // FORM BÁN
  const [showSell, setShowSell] = useState(false);
  const [sellAnimal, setSellAnimal] = useState(null);

  const [sellForm, setSellForm] = useState({
    quantity: 1,
    weight: '',
    price: '',
    customer: ''
  });

  // =========================
  // RESET FORM
  // =========================
  const resetForm = () => {
    setForm({
      code: '',
      species: 'Heo',
      origin: '',
      weight: 0,
      health: 'binh_thuong',
      status: 'dang_nuoi',
      barn_id: ''
    });

    setEditId(null);
    setShow(false);
  };

  // =========================
  // THÊM / SỬA
  // =========================
  const save = async () => {
    if (!form.code.trim()) {
      alert('Vui lòng nhập mã vật nuôi');
      return;
    }

    if (Number(form.weight) < 0) {
      alert('Khối lượng không được âm');
      return;
    }

    try {
      const body = {
        code: form.code.trim(),
        species: form.species,
        origin: form.origin.trim(),
        weight: Number(form.weight),
        health: form.health,
        status: form.status,
        barn_id: form.barn_id
          ? Number(form.barn_id)
          : null
      };

      if (editId) {
        await call(`/animals/${editId}`, {
          method: 'PUT',
          body: JSON.stringify(body)
        });

        alert('✅ Đã sửa vật nuôi');
      } else {
        await call('/animals', {
          method: 'POST',
          body: JSON.stringify(body)
        });

        alert('✅ Đã thêm vật nuôi');
      }

      resetForm();
      await reload();

    } catch (e) {
      alert('❌ ' + e.message);
    }
  };

  // =========================
  // MỞ FORM SỬA
  // =========================
  const edit = (r) => {
    setForm({
      code: r.code || '',
      species: r.species || 'Heo',
      origin: r.origin || '',
      weight: r.weight || 0,
      health: r.health || 'binh_thuong',
      status: r.status || 'dang_nuoi',
      barn_id: r.barn_id || ''
    });

    setEditId(r.id);
    setShow(true);
  };

  // =========================
  // XÓA
  // =========================
  const remove = async (id) => {
    if (user?.role !== 'Admin') {
      alert('⚠️ Chỉ Admin mới được xóa vật nuôi');
      return;
    }

    if (!window.confirm(
      'Bạn có chắc muốn xóa vật nuôi này?'
    )) {
      return;
    }

    try {
      await call(`/animals/${id}`, {
        method: 'DELETE'
      });

      alert('✅ Đã xóa vật nuôi');
      await reload();

    } catch (e) {
      alert('❌ ' + e.message);
    }
  };

  // =========================
  // MỞ FORM BÁN
  // =========================
  const openSell = (animal) => {

    if (animal.status !== 'dang_nuoi') {
      alert('⚠️ Vật nuôi này đã xuất bán hoặc không còn trong đàn');
      return;
    }

    setSellAnimal(animal);

    setSellForm({
      quantity: 1,
      weight: animal.weight || '',
      price: '',
      customer: ''
    });

    setShowSell(true);
  };

  // =========================
  // XÁC NHẬN BÁN
  // =========================
  const sell = async () => {

    if (!sellAnimal) {
      alert('Không tìm thấy vật nuôi');
      return;
    }

    if (!sellForm.quantity || Number(sellForm.quantity) <= 0) {
      alert('Vui lòng nhập số lượng hợp lệ');
      return;
    }

    if (!sellForm.weight || Number(sellForm.weight) <= 0) {
      alert('Vui lòng nhập khối lượng');
      return;
    }

    if (!sellForm.price || Number(sellForm.price) <= 0) {
      alert('Vui lòng nhập đơn giá');
      return;
    }

    const total =
      Number(sellForm.weight) *
      Number(sellForm.price);

    try {

      await call('/exports', {
        method: 'POST',
        body: JSON.stringify({
          animal_id: sellAnimal.id,
          quantity: Number(sellForm.quantity),
          weight: Number(sellForm.weight),
          total: total,
          customer: sellForm.customer.trim()
        })
      });

      alert(
        `✅ Xuất bán thành công!\n\n` +
        `Vật nuôi: ${sellAnimal.code}\n` +
        `Tổng tiền: ${total.toLocaleString('vi-VN')} đ`
      );

      setShowSell(false);
      setSellAnimal(null);

      setSellForm({
        quantity: 1,
        weight: '',
        price: '',
        customer: ''
      });

      await reload();

    } catch (e) {
      alert('❌ ' + e.message);
    }
  };

  // =========================
  // TỔNG TIỀN
  // =========================
  const sellTotal =
    Number(sellForm.weight || 0) *
    Number(sellForm.price || 0);

  return (
    <div>

      {/* =========================
          TIÊU ĐỀ
      ========================= */}
      <div className="section-intro">

        <div>
          <h2>🐖 Quản lý vật nuôi</h2>

          <p>
            Quản lý danh sách vật nuôi trong trang trại.
          </p>
        </div>

        <button
          className="add-button"
          onClick={() => {
            setEditId(null);

            setForm({
              code: '',
              species: 'Heo',
              origin: '',
              weight: 0,
              health: 'binh_thuong',
              status: 'dang_nuoi',
              barn_id: ''
            });

            setShow(true);
          }}
        >
          ＋ Thêm mới
        </button>

      </div>


      {/* =========================
          FORM THÊM / SỬA
      ========================= */}
      {show && (

        <div className="form-card">

          <h3>
            {editId
              ? '✏️ Sửa thông tin vật nuôi'
              : '➕ Thêm vật nuôi mới'}
          </h3>

          <input
            placeholder="Mã vật nuôi"
            value={form.code}
            onChange={(e) =>
              setForm({
                ...form,
                code: e.target.value
              })
            }
          />

          <input
            placeholder="Loài"
            value={form.species}
            onChange={(e) =>
              setForm({
                ...form,
                species: e.target.value
              })
            }
          />

          <input
            placeholder="Nguồn gốc"
            value={form.origin}
            onChange={(e) =>
              setForm({
                ...form,
                origin: e.target.value
              })
            }
          />

          <input
            type="number"
            min="0"
            placeholder="Khối lượng (kg)"
            value={form.weight}
            onChange={(e) =>
              setForm({
                ...form,
                weight: e.target.value
              })
            }
          />

          <select
            value={form.health}
            onChange={(e) =>
              setForm({
                ...form,
                health: e.target.value
              })
            }
          >
            <option value="binh_thuong">
              Bình thường
            </option>

            <option value="can_theo_doi">
              Cần theo dõi
            </option>

            <option value="benh">
              Bệnh
            </option>
          </select>

          <select
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value
              })
            }
          >
            <option value="dang_nuoi">
              Đang nuôi
            </option>

            <option value="da_xuat_ban">
              Đã xuất bán
            </option>
          </select>

          <input
            type="number"
            min="1"
            placeholder="ID chuồng"
            value={form.barn_id}
            onChange={(e) =>
              setForm({
                ...form,
                barn_id: e.target.value
              })
            }
          />

          <div
            style={{
              display: 'flex',
              gap: '10px',
              marginTop: '10px'
            }}
          >

            <button
              className="save-button"
              onClick={save}
            >
              💾 Lưu
            </button>

            <button
              className="cancel-button"
              onClick={resetForm}
            >
              Hủy
            </button>

          </div>

        </div>
      )}


      {/* =========================
          FORM BÁN
      ========================= */}
      {showSell && sellAnimal && (

        <div className="form-card">

          <h3>
            💰 Xuất bán vật nuôi
          </h3>

          <div
            style={{
              background: '#f4f7fb',
              padding: '15px',
              borderRadius: '12px',
              marginBottom: '15px'
            }}
          >

            <strong>
              Vật nuôi: {sellAnimal.code}
            </strong>

            <br />

            Loài: {sellAnimal.species}

            <br />

            Khối lượng hiện tại:
            {' '}
            {sellAnimal.weight} kg

          </div>


          <label>Số lượng</label>

          <input
            type="number"
            min="1"
            value={sellForm.quantity}
            onChange={(e) =>
              setSellForm({
                ...sellForm,
                quantity: e.target.value
              })
            }
          />


          <label>Khối lượng bán (kg)</label>

          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="Ví dụ: 85"
            value={sellForm.weight}
            onChange={(e) =>
              setSellForm({
                ...sellForm,
                weight: e.target.value
              })
            }
          />


          <label>Đơn giá (đ/kg)</label>

          <input
            type="number"
            min="0"
            placeholder="Ví dụ: 65000"
            value={sellForm.price}
            onChange={(e) =>
              setSellForm({
                ...sellForm,
                price: e.target.value
              })
            }
          />


          <label>Khách hàng</label>

          <input
            placeholder="Tên khách hàng"
            value={sellForm.customer}
            onChange={(e) =>
              setSellForm({
                ...sellForm,
                customer: e.target.value
              })
            }
          />


          {/* TỔNG TIỀN */}
          <div
            style={{
              marginTop: '15px',
              padding: '15px',
              borderRadius: '12px',
              background: '#eaf8f1',
              fontSize: '18px',
              fontWeight: '700'
            }}
          >

            💵 Tổng tiền:

            {' '}

            {sellTotal.toLocaleString('vi-VN')} đ

          </div>


          <div
            style={{
              display: 'flex',
              gap: '10px',
              marginTop: '15px'
            }}
          >

            <button
              className="save-button"
              onClick={sell}
            >
              💰 Xác nhận bán
            </button>

            <button
              className="cancel-button"
              onClick={() => {
                setShowSell(false);
                setSellAnimal(null);
              }}
            >
              Hủy
            </button>

          </div>

        </div>
      )}


      {/* =========================
          DANH SÁCH VẬT NUÔI
      ========================= */}
      <div className="tablewrap">

        <table>

          <thead>

            <tr>

              <th>ID</th>
              <th>Mã</th>
              <th>Loài</th>
              <th>Nguồn gốc</th>
              <th>Khối lượng</th>
              <th>Sức khỏe</th>
              <th>Trạng thái</th>
              <th>Chuồng</th>
              <th>Thao tác</th>

            </tr>

          </thead>


          <tbody>

            {rows.length > 0 ? (

              rows.map((r) => (

                <tr key={r.id}>

                  <td>{r.id}</td>

                  <td>
                    <b>{r.code}</b>
                  </td>

                  <td>
                    {r.species}
                  </td>

                  <td>
                    {r.origin || '-'}
                  </td>

                  <td>
                    {r.weight} kg
                  </td>

                  <td>
                    <Health v={r.health} />
                  </td>

                  <td>
                    <Badge v={r.status} />
                  </td>

                  <td>
                    {r.barn_id || '-'}
                  </td>

                  <td>

                    <button
                      className="edit-button"
                      onClick={() => edit(r)}
                    >
                      ✏️ Sửa
                    </button>


                    {user?.role === 'Admin' && (

                      <button
                        className="delete-button"
                        onClick={() => remove(r.id)}
                      >
                        🗑️ Xóa
                      </button>

                    )}


                    {r.status === 'dang_nuoi' && (

                      <button
                        className="save-button"
                        style={{
                          marginLeft: '6px'
                        }}
                        onClick={() => openSell(r)}
                      >
                        💰 Bán
                      </button>

                    )}

                  </td>

                </tr>

              ))

            ) : (

              <tr>

                <td
                  colSpan="9"
                  className="empty"
                >
                  Chưa có dữ liệu vật nuôi
                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}
/* =========================
   CHĂM SÓC
========================= */
function Care({rows,animals,reload,call}){
  const [show,setShow]=useState(false);
  const [form,setForm]=useState({animal_id:'',action:'',note:''});
  const save=async()=>{
    if(!form.animal_id || !form.action.trim()) return alert('Vui lòng chọn vật nuôi và nhập nội dung chăm sóc');
    try{
      await call('/care',{method:'POST',body:JSON.stringify({animal_id:Number(form.animal_id),action:form.action,note:form.note})});
      setShow(false); setForm({animal_id:'',action:'',note:''}); await reload();
    }catch(e){alert(e.message)}
  };
  const remove=async(id)=>{if(!confirm('Xóa nhật ký chăm sóc này?'))return; try{await call(`/care/${id}`,{method:'DELETE'});await reload()}catch(e){alert(e.message)}};
  return <div>
    <div className="section-intro"><div><h2>🩺 Chăm sóc vật nuôi</h2><p>Ghi nhận các hoạt động chăm sóc và theo dõi lịch sử theo từng vật nuôi.</p></div><button className="primary-btn" onClick={()=>setShow(true)}>＋ Ghi nhận chăm sóc</button></div>
    <Table cols={[["animal_id","Vật nuôi"],["action","Nội dung chăm sóc"],["note","Ghi chú"],["created_at","Thời gian"]]} rows={(rows||[]).map(r=>({...r,animal_id:animals.find(a=>a.id===r.animal_id)?.code||r.animal_id}))}/>
    {rows?.length>0&&<div className="module-actions"><span>{rows.length} nhật ký</span></div>}
    {show&&<div className="modal-backdrop" onClick={()=>setShow(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><h3>Ghi nhận chăm sóc</h3><button onClick={()=>setShow(false)}>✕</button></div><label>Vật nuôi</label><select value={form.animal_id} onChange={e=>setForm({...form,animal_id:e.target.value})}><option value="">Chọn vật nuôi</option>{animals.filter(a=>a.status==='dang_nuoi').map(a=><option key={a.id} value={a.id}>{a.code} — {a.species}</option>)}</select><label>Nội dung chăm sóc</label><input value={form.action} onChange={e=>setForm({...form,action:e.target.value})} placeholder="Ví dụ: Vệ sinh chuồng, kiểm tra sức khỏe..."/><label>Ghi chú</label><textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Ghi chú thêm"/><button className="primary-btn full" onClick={save}>Lưu nhật ký</button></div></div>}
  </div>;
}

/* =========================
   TIÊM PHÒNG
========================= */
function Vacc({rows,animals,reload,call}){
  const [show,setShow]=useState(false);
  const [form,setForm]=useState({animal_id:'',vaccine:'',scheduled_at:'',status:'chua_tiem',note:''});
  const save=async()=>{
    if(!form.animal_id || !form.vaccine.trim() || !form.scheduled_at) return alert('Vui lòng nhập đủ vật nuôi, vaccine và ngày tiêm');
    try{
      await call('/vaccinations',{method:'POST',body:JSON.stringify({...form,animal_id:Number(form.animal_id),scheduled_at:new Date(form.scheduled_at).toISOString()})});
      setShow(false); setForm({animal_id:'',vaccine:'',scheduled_at:'',status:'chua_tiem',note:''}); await reload();
    }catch(e){alert(e.message)}
  };
  const update=async(r,status)=>{try{await call(`/vaccinations/${r.id}`,{method:'PUT',body:JSON.stringify({animal_id:r.animal_id,vaccine:r.vaccine,scheduled_at:r.scheduled_at,status,note:r.note||''})});await reload()}catch(e){alert(e.message)}};
  const remove=async(id)=>{if(!confirm('Xóa lịch tiêm này?'))return;try{await call(`/vaccinations/${id}`,{method:'DELETE'});await reload()}catch(e){alert(e.message)}};
  const display=(rows||[]).map(r=>({...r,animal_id:animals.find(a=>a.id===r.animal_id)?.code||r.animal_id,status:<span className="status-pill">{r.status==='da_tiem'?'Đã tiêm':'Chưa tiêm'}</span>,scheduled_at:r.scheduled_at?new Date(r.scheduled_at).toLocaleString('vi-VN'):''}));
  return <div>
    <div className="section-intro"><div><h2>💉 Tiêm phòng</h2><p>Quản lý lịch vaccine, trạng thái tiêm và các ghi chú theo từng vật nuôi.</p></div><button className="primary-btn" onClick={()=>setShow(true)}>＋ Thêm lịch vaccine</button></div>
    <Table cols={[["animal_id","Vật nuôi"],["vaccine","Vaccine"],["scheduled_at","Lịch tiêm"],["status","Trạng thái"],["note","Ghi chú"]]} rows={display}/>
    {!!rows?.length&&<div className="module-actions"><span>Nhấn thao tác trong dữ liệu để cập nhật trạng thái.</span></div>}
    {show&&<div className="modal-backdrop" onClick={()=>setShow(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><h3>Thêm lịch vaccine</h3><button onClick={()=>setShow(false)}>✕</button></div><label>Vật nuôi</label><select value={form.animal_id} onChange={e=>setForm({...form,animal_id:e.target.value})}><option value="">Chọn vật nuôi</option>{animals.filter(a=>a.status==='dang_nuoi').map(a=><option key={a.id} value={a.id}>{a.code} — {a.species}</option>)}</select><label>Tên vaccine</label><input value={form.vaccine} onChange={e=>setForm({...form,vaccine:e.target.value})} placeholder="Tên vaccine"/><label>Ngày giờ tiêm</label><input type="datetime-local" value={form.scheduled_at} onChange={e=>setForm({...form,scheduled_at:e.target.value})}/><label>Ghi chú</label><textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/><button className="primary-btn full" onClick={save}>Lưu lịch vaccine</button></div></div>}
  </div>;
}

/* =========================
   TĂNG TRƯỞNG
========================= */
function Growth({rows,animals,reload,call}){
  const [show,setShow]=useState(false);
  const [form,setForm]=useState({animal_id:'',measured_at:'',weight:'',note:''});
  const save=async()=>{
    if(!form.animal_id || form.weight==='') return alert('Vui lòng chọn vật nuôi và nhập cân nặng');
    try{
      await call('/growth',{method:'POST',body:JSON.stringify({animal_id:Number(form.animal_id),measured_at:form.measured_at?new Date(form.measured_at).toISOString():new Date().toISOString(),weight:Number(form.weight),note:form.note})});
      setShow(false); setForm({animal_id:'',measured_at:'',weight:'',note:''}); await reload();
    }catch(e){alert(e.message)}
  };
  const remove=async(id)=>{if(!confirm('Xóa bản ghi tăng trưởng này?'))return;try{await call(`/growth/${id}`,{method:'DELETE'});await reload()}catch(e){alert(e.message)}};
  const display=(rows||[]).map(r=>({...r,animal_id:animals.find(a=>a.id===r.animal_id)?.code||r.animal_id,measured_at:r.measured_at?new Date(r.measured_at).toLocaleDateString('vi-VN'):''}));
  return <div>
    <div className="section-intro"><div><h2>📈 Theo dõi tăng trưởng</h2><p>Ghi nhận cân nặng theo thời gian để theo dõi quá trình phát triển của vật nuôi.</p></div><button className="primary-btn" onClick={()=>setShow(true)}>＋ Ghi nhận cân nặng</button></div>
    <Table cols={[["animal_id","Vật nuôi"],["measured_at","Ngày đo"],["weight","Cân nặng (kg)"],["note","Ghi chú"]]} rows={display}/>
    {show&&<div className="modal-backdrop" onClick={()=>setShow(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><h3>Ghi nhận tăng trưởng</h3><button onClick={()=>setShow(false)}>✕</button></div><label>Vật nuôi</label><select value={form.animal_id} onChange={e=>setForm({...form,animal_id:e.target.value})}><option value="">Chọn vật nuôi</option>{animals.filter(a=>a.status==='dang_nuoi').map(a=><option key={a.id} value={a.id}>{a.code} — {a.species}</option>)}</select><label>Ngày giờ đo</label><input type="datetime-local" value={form.measured_at} onChange={e=>setForm({...form,measured_at:e.target.value})}/><label>Cân nặng (kg)</label><input type="number" min="0" step="0.1" value={form.weight} onChange={e=>setForm({...form,weight:e.target.value})}/><label>Ghi chú</label><textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/><button className="primary-btn full" onClick={save}>Lưu kết quả</button></div></div>}
  </div>;
}

/* =========================
   CÁC MODULE QUẢN LÝ
========================= */

function Simple({title, sub, rows, cols}) {
  return (
    <>
      <div className="section-intro">
        <div>
          <h2>{title}</h2>
          <p>{sub}</p>
        </div>

        <span className="count">
          {rows?.length || 0} bản ghi
        </span>
      </div>

      <Table
        cols={cols}
        rows={rows || []}
      />
    </>
  );
}


/* =========================
   CHUỒNG TRẠI
========================= */

function Barns({rows,animals,call,reload,user}){
 const [selected,setSelected]=useState(null); const [show,setShow]=useState(false); const [form,setForm]=useState({name:'',capacity:20,status:'trong'}); const [editId,setEditId]=useState(null);
 const save=async()=>{if(!form.name.trim())return alert('Nhập tên chuồng');try{await call(editId?`/barns/${editId}`:'/barns',{method:editId?'PUT':'POST',body:JSON.stringify({...form,capacity:Number(form.capacity)})});setShow(false);setEditId(null);await reload()}catch(e){alert(e.message)}};
 return <div><div className="section-intro"><div><h2>🏠 Chuồng trại</h2><p>Bấm vào từng chuồng để xem vật nuôi đang ở trong chuồng.</p></div><button className="primary-btn" onClick={()=>{setForm({name:'',capacity:20,status:'trong'});setEditId(null);setShow(true)}}>＋ Thêm chuồng</button></div>
 <div className="barn-grid">{rows.map(b=><div className="barn-card clickable" key={b.id} onClick={()=>setSelected(b)}><div className="barn-card-top"><span className="barn-icon">🏠</span><span className="status-pill">{b.status==='dang_nuoi'?'Đang nuôi':'Trống'}</span></div><h3>{b.name}</h3><p>Sức chứa: {b.capacity} con</p><p className="barn-count">🐖 {animals.filter(a=>a.barn_id===b.id&&a.status!=='da_xuat_ban'&&a.status!=='da_xoa').length} vật nuôi</p><div className="barn-actions"><button onClick={e=>{e.stopPropagation();setEditId(b.id);setForm({name:b.name,capacity:b.capacity,status:b.status});setShow(true)}}>Sửa</button><button onClick={e=>e.stopPropagation()} >Xem chi tiết →</button></div></div>)}</div>
 {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><div className="modal-card wide" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>{selected.name}</h3><p>Danh sách vật nuôi trong chuồng</p></div><button onClick={()=>setSelected(null)}>✕</button></div><div className="detail-table"><table><thead><tr><th>Mã</th><th>Loài</th><th>Cân nặng</th><th>Sức khỏe</th><th>Trạng thái</th></tr></thead><tbody>{animals.filter(a=>a.barn_id===selected.id&&a.status!=='da_xuat_ban'&&a.status!=='da_xoa').map(a=><tr key={a.id}><td>{a.code}</td><td>{a.species}</td><td>{a.weight} kg</td><td>{a.health}</td><td>{a.status}</td></tr>)}</tbody></table></div></div></div>}
 {show&&<div className="modal-backdrop" onClick={()=>setShow(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><h3>{editId?'Sửa chuồng':'Thêm chuồng'}</h3><button onClick={()=>setShow(false)}>✕</button></div><label>Tên chuồng</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><label>Sức chứa</label><input type="number" value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})}/><button className="primary-btn full" onClick={save}>Lưu</button></div></div>}
 </div>
}

/* =========================
   THỨC ĂN
========================= */

function Feeds({rows,barns,barnFeeds,feedTransfers,call,reload}){
 const [barnId,setBarnId]=useState(barns[0]?.id||''); const [show,setShow]=useState(false); const [form,setForm]=useState({feed_type_id:'',quantity:''}); const [transfer,setTransfer]=useState({from_barn_id:'',to_barn_id:'',feed_type_id:'',quantity:''});
 const selectedFeeds=barnFeeds.filter(x=>String(x.barn_id)===String(barnId));
 const add=async()=>{try{await call('/barn-feeds',{method:'POST',body:JSON.stringify({barn_id:Number(barnId),feed_type_id:Number(form.feed_type_id),quantity:Number(form.quantity)})});setShow(false);setForm({feed_type_id:'',quantity:''});await reload();}catch(e){alert(e.message)}};
 const move=async()=>{try{await call('/barn-feeds/transfer',{method:'POST',body:JSON.stringify({...transfer,from_barn_id:Number(transfer.from_barn_id),to_barn_id:Number(transfer.to_barn_id),feed_type_id:Number(transfer.feed_type_id),quantity:Number(transfer.quantity)})});alert('Đã chuyển thức ăn');await reload();}catch(e){alert(e.message)}};
 return <div><div className="section-intro"><div><h2>🌾 Thức ăn theo chuồng</h2><p>Mỗi chuồng có lượng thức ăn riêng; có thể cấp thêm hoặc chuyển giữa các chuồng.</p></div></div><div className="feed-toolbar"><select value={barnId} onChange={e=>setBarnId(e.target.value)}>{barns.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><button className="primary-btn" onClick={()=>setShow(true)}>＋ Cấp thức ăn</button></div><div className="feed-cards">{selectedFeeds.length?selectedFeeds.map(f=><div className="feed-card" key={f.id}><b>🌾 {f.feed_name}</b><strong>{f.quantity} {f.unit}</strong><span>Cập nhật: {String(f.updated_at||'').slice(0,10)}</span></div>):<div className="empty-box">Chuồng này chưa có thức ăn được phân bổ.</div>}</div><div className="transfer-box"><h3>↔ Chuyển thức ăn giữa các chuồng</h3><div className="transfer-grid"><select value={transfer.from_barn_id} onChange={e=>setTransfer({...transfer,from_barn_id:e.target.value})}><option value="">Chuồng nguồn</option>{barns.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><select value={transfer.to_barn_id} onChange={e=>setTransfer({...transfer,to_barn_id:e.target.value})}><option value="">Chuồng đích</option>{barns.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><select value={transfer.feed_type_id} onChange={e=>setTransfer({...transfer,feed_type_id:e.target.value})}><option value="">Loại thức ăn</option>{rows.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><input type="number" min="0.1" value={transfer.quantity} onChange={e=>setTransfer({...transfer,quantity:e.target.value})} placeholder="Số lượng (kg)"/><button className="primary-btn" onClick={move}>Chuyển</button></div></div><div className="transfer-history"><h3>Lịch sử chuyển thức ăn</h3><Table cols={[["from_barn","Từ chuồng"],["to_barn","Đến chuồng"],["feed_name","Thức ăn"],["quantity","Số lượng"],["created_at","Thời gian"]]} rows={feedTransfers}/></div>{show&&<div className="modal-backdrop" onClick={()=>setShow(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><h3>Cấp thức ăn cho chuồng</h3><button onClick={()=>setShow(false)}>✕</button></div><p>Chuồng: <b>{barns.find(b=>String(b.id)===String(barnId))?.name}</b></p><select value={form.feed_type_id} onChange={e=>setForm({...form,feed_type_id:e.target.value})}><option value="">Chọn thức ăn</option>{rows.map(f=><option key={f.id} value={f.id}>{f.name} — kho tổng {f.stock} {f.unit}</option>)}</select><input type="number" min="0.1" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} placeholder="Số lượng"/><button className="primary-btn full" onClick={add}>Xác nhận</button></div></div>}</div>
}

function Exports({rows,barns,animals,call,reload,user}){
 const [barnId,setBarnId]=useState(barns[0]?.id||''); const [animal,setAnimal]=useState(null); const [form,setForm]=useState({weight:'',total:'',customer:''});
 const list=animals.filter(a=>String(a.barn_id)===String(barnId)&&a.status==='dang_nuoi'); const sell=async()=>{try{await call('/exports',{method:'POST',body:JSON.stringify({animal_id:animal.id,quantity:1,weight:Number(form.weight),total:Number(form.total),customer:form.customer})});setAnimal(null);await reload();}catch(e){alert(e.message)}};
 return <div><div className="section-intro"><div><h2>🚚 Xuất bán theo chuồng</h2><p>Chọn chuồng → chọn từng con → lập phiếu xuất bán.</p></div></div><div className="feed-toolbar"><select value={barnId} onChange={e=>setBarnId(e.target.value)}>{barns.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div><div className="animal-sale-grid">{list.map(a=><div className="sale-animal" key={a.id} onClick={()=>{setAnimal(a);setForm({weight:a.weight,total:'',customer:''})}}><div>🐖</div><b>{a.code}</b><span>{a.species} • {a.weight} kg</span><small>Nhấn để xuất bán →</small></div>)}{!list.length&&<div className="empty-box">Chuồng này không còn vật nuôi đang nuôi.</div>}</div><h3 className="sub-heading">Lịch sử xuất bán</h3><Table cols={[["id","ID"],["barn_id","Chuồng"],["animal_id","Vật nuôi"],["weight","Kg"],["total","Tổng tiền"],["customer","Khách hàng"],["exported_at","Ngày xuất"]]} rows={rows}/>{animal&&<div className="modal-backdrop" onClick={()=>setAnimal(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>Xuất bán {animal.code}</h3><p>{animal.species} • Chuồng {animal.barn_id}</p></div><button onClick={()=>setAnimal(null)}>✕</button></div><label>Khối lượng (kg)</label><input type="number" value={form.weight} onChange={e=>setForm({...form,weight:e.target.value})}/><label>Giá bán / tổng tiền</label><input type="number" value={form.total} onChange={e=>setForm({...form,total:e.target.value})}/><label>Khách hàng</label><input value={form.customer} onChange={e=>setForm({...form,customer:e.target.value})}/><button className="primary-btn full" onClick={sell}>Xác nhận xuất bán</button></div></div>}</div>
}

/* =========================
   AI
========================= */

function AI({rows,call,reload}){

  const [input,setInput]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [messages,setMessages]=useState([
    {
      role:'assistant',
      text:'Xin chào! Tôi là Smart Livestock AI. Tôi có thể hỗ trợ bạn phân tích đàn vật nuôi, chăm sóc, tăng trưởng, vaccine và các báo cáo từ dữ liệu hệ thống.'
    }
  ]);

  const suggestions=[
    'Tổng hợp tình hình đàn hiện tại',
    'Có lịch vaccine nào sắp đến hạn?',
    'Phân tích tình hình tăng trưởng',
    'Những việc cần ưu tiên hôm nay?'
  ];

  const send=async(text=input)=>{
    const question=(text||'').trim();
    if(!question || busy) return;

    setInput('');
    setError('');
    setBusy(true);
    setMessages(prev=>[...prev,{role:'user',text:question}]);

    try{
      const r=await call('/ai/analyze',{
        method:'POST',
        body:JSON.stringify({prompt:question})
      });

      setMessages(prev=>[
        ...prev,
        {
          role:'assistant',
          text:r.answer || 'AI chưa trả về nội dung.',
          mode:r.mode,
          contextChars:r.context_chars || 0
        }
      ]);
      if(reload) reload();
    }catch(e){
      const msg=e.message || 'Không thể xử lý yêu cầu AI';
      setError(msg);
      setMessages(prev=>[
        ...prev,
        {role:'assistant',text:'Mình chưa thể xử lý yêu cầu này. Bạn hãy kiểm tra kết nối AI hoặc thử lại sau.'}
      ]);
    }finally{
      setBusy(false);
    }
  };

  const onKeyDown=e=>{
    if(e.key==='Enter' && !e.shiftKey){
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="ai-page ai-chat-page">

      <div className="ai-chat-header">
        <div className="ai-avatar large">✦</div>
        <div>
          <h2>Trợ lý AI</h2>
          <p>Hỏi đáp trực tiếp với dữ liệu hệ thống chăn nuôi</p>
        </div>
        <span className="ai-status"><i/> Đang hoạt động</span>
      </div>

      <div className="ai-chat-shell">
        <div className="ai-chat-messages">
          {messages.map((m,i)=>(
            <div className={`chat-message ${m.role}`} key={i}>
              {m.role==='assistant' && <div className="chat-message-avatar">✦</div>}
              <div className="chat-bubble-wrap">
                <div className="chat-name">{m.role==='assistant'?'Smart Livestock AI':'Bạn'}</div>
                <div className="chat-bubble">
                  {m.text}
                </div>
                {m.role==='assistant' && m.mode && (
                  <small className="chat-meta">
                    {m.mode==='openai'?'OpenAI':'AI dự phòng'}
                    {m.contextChars ? ` • ${m.contextChars} ký tự dữ liệu hệ thống` : ''}
                  </small>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="chat-message assistant">
              <div className="chat-message-avatar">✦</div>
              <div className="chat-bubble-wrap">
                <div className="chat-name">Smart Livestock AI</div>
                <div className="chat-bubble typing"><span/><span/><span/></div>
              </div>
            </div>
          )}
        </div>

        {messages.length===1 && (
          <div className="chat-suggestions">
            <div className="chat-suggestion-title">Bạn có thể hỏi:</div>
            <div className="chat-suggestion-list">
              {suggestions.map((s,i)=>(
                <button key={i} onClick={()=>send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {error && <div className="chat-error">⚠️ {error}</div>}

        <div className="chat-composer">
          <textarea
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Nhập câu hỏi cho Smart Livestock AI..."
            rows="1"
          />
          <button className="chat-send" onClick={()=>send()} disabled={busy || !input.trim()}>
            {busy?'…':'➤'}
          </button>
        </div>
        <div className="chat-hint">Enter để gửi • Shift + Enter để xuống dòng</div>
      </div>

      <div className="ai-chat-note">
        <span>🔒</span>
        <div><b>AI hỗ trợ, không thay thế chuyên môn</b><br/>Kết quả AI được tạo từ dữ liệu được phép truy cập và cần được kiểm tra trước khi đưa ra quyết định nghiệp vụ.</div>
      </div>
    </div>
  );
}


/* =========================
   REPORTS
========================= */

function Reports({data,call}){
 const [date,setDate]=useState(new Date().toISOString().slice(0,10)); const d=data.dashboard||{}; const animals=data.animals||[]; const barns=data.barns||[]; const feeds=data.barnFeeds||[]; const exportsData=data.exports||[];
 const print=()=>window.print();
 return <div className="report-page"><div className="report-toolbar"><div><h2>📊 Báo cáo quản lý chăn nuôi</h2><p>Báo cáo trình bày theo dạng văn bản, phù hợp xem/in như Word.</p></div><button className="primary-btn" onClick={print}>🖨️ In / Xuất PDF</button></div><article className="word-report"><header><div className="report-school">TRƯỜNG ĐẠI HỌC CNTT & TRUYỀN THÔNG – ICTU</div><h1>BÁO CÁO TỔNG HỢP QUẢN LÝ CHĂN NUÔI</h1><p>HỆ THỐNG QUẢN LÝ CHĂN NUÔI CÓ TÍCH HỢP AI</p><div className="report-date">Ngày lập báo cáo: {date}</div></header><section><h2>I. TỔNG QUAN</h2><div className="report-kpis"><div><b>{d.total_animals||animals.length}</b><span>Tổng vật nuôi</span></div><div><b>{d.total_barns||barns.length}</b><span>Tổng số chuồng</span></div><div><b>{d.sick_animals||0}</b><span>Trường hợp cần chú ý</span></div><div><b>{Number(d.revenue||0).toLocaleString('vi-VN')} đ</b><span>Doanh thu</span></div></div></section><section><h2>II. THỐNG KÊ THEO CHUỒNG</h2><table><thead><tr><th>STT</th><th>Chuồng</th><th>Số vật nuôi</th><th>Sức chứa</th><th>Thức ăn phân bổ</th></tr></thead><tbody>{barns.map((b,i)=><tr key={b.id}><td>{i+1}</td><td>{b.name}</td><td>{animals.filter(a=>a.barn_id===b.id&&a.status==='dang_nuoi').length}</td><td>{b.capacity}</td><td>{feeds.filter(f=>f.barn_id===b.id).reduce((x,f)=>x+Number(f.quantity||0),0)} kg</td></tr>)}</tbody></table></section><section><h2>III. DANH SÁCH VẬT NUÔI</h2><table><thead><tr><th>Mã</th><th>Loài</th><th>Chuồng</th><th>Cân nặng</th><th>Sức khỏe</th></tr></thead><tbody>{animals.filter(a=>a.status!=='da_xoa').map(a=><tr key={a.id}><td>{a.code}</td><td>{a.species}</td><td>{barns.find(b=>b.id===a.barn_id)?.name||'-'}</td><td>{a.weight} kg</td><td>{a.health}</td></tr>)}</tbody></table></section><section><h2>IV. TÌNH HÌNH XUẤT BÁN</h2><table><thead><tr><th>ID</th><th>Chuồng</th><th>Vật nuôi</th><th>Khối lượng</th><th>Doanh thu</th><th>Khách hàng</th></tr></thead><tbody>{exportsData.map(e=><tr key={e.id}><td>{e.id}</td><td>{barns.find(b=>b.id===e.barn_id)?.name||'-'}</td><td>{animals.find(a=>a.id===e.animal_id)?.code||e.animal_id}</td><td>{e.weight} kg</td><td>{Number(e.total||0).toLocaleString('vi-VN')} đ</td><td>{e.customer||'-'}</td></tr>)}</tbody></table></section><section><h2>V. NHẬN XÉT VÀ HỖ TRỢ AI</h2><p>AI hỗ trợ tổng hợp dữ liệu đàn, chuồng, thức ăn, vaccine, tăng trưởng và xuất bán trong phạm vi dữ liệu người dùng được phép truy cập. Kết quả AI cần được kiểm tra trước khi sử dụng cho quyết định nghiệp vụ.</p></section><footer>Người lập báo cáo: Người dùng hệ thống &nbsp;&nbsp;&nbsp; | &nbsp;&nbsp;&nbsp; Smart Livestock AI</footer></article></div>
}


/* =========================
   RENDER APP
========================= */

const root = document.getElementById('root');
createRoot(root).render(<App />);
