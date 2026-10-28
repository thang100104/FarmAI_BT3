import React,{useEffect,useMemo,useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import {canSendMessage, conversationHistory, fetchJson, resolveApiUrl} from './ai-client.js';

const API=resolveApiUrl(import.meta.env.VITE_API_URL,window.location);

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
  ['care','✚','Chăm sóc'],
  ['users','👥','Tài khoản']
];

function App(){
  const [token,setToken]=useState(localStorage.getItem('token')||sessionStorage.getItem('token'));
  const [user,setUser]=useState(
    JSON.parse(localStorage.getItem('user')||sessionStorage.getItem('user')||'null')
  );

  const [tab,setTabRaw]=useState('dashboard');
  const [aiPage,setAiPage]=useState('dashboard');
  const activeToken=useRef(token);
  activeToken.current=token;
  const setTab=(next)=>{
    if(next==='users' && user?.role!=='Admin') return;
    if(next!=='ai') setAiPage(next);
    setTabRaw(next);
    window.history.replaceState(null,'','#'+next);
  };
  useEffect(()=>{
    const navigate=()=>{
      const next=window.location.hash.slice(1);
      if(menu.some(m=>m[0]===next) && (next!=='users'||user?.role==='Admin')) {
        setTabRaw(next); if(next!=='ai') setAiPage(next);
      }
    };
    navigate(); window.addEventListener('hashchange',navigate);
    return ()=>window.removeEventListener('hashchange',navigate);
  },[user?.role]);
  const [data,setData]=useState({});
  const [msg,setMsg]=useState('');
  const [globalSearch,setGlobalSearch]=useState('');
  const [showNotice,setShowNotice]=useState(false);

  const call=(path,opts={})=>fetchJson(API+path,{
    ...opts,
    headers:{
      'Content-Type':'application/json',
      Authorization:token?`Bearer ${token}`:'',
      ...(opts.headers||{})
    }
  },path.startsWith('/ai/analyze')?65000:30000);

  const load=async()=>{
    if(!token || activeToken.current!==token) return;

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

      const users = user?.role==='Admin' ? await call('/users').catch(()=>[]) : [];

      if(activeToken.current!==token) return;
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
        ai,
        users
      });

      setMsg('Dữ liệu đã cập nhật');

      setTimeout(()=>setMsg(''),2500);

    }catch(e){
      if(activeToken.current===token) setMsg(e.message);
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
          activeToken.current=t;
          setData({});
          setToken(t);
          setUser(u);
        }}
      />
    );
  }

  const logout=()=>{
    activeToken.current=null;
    setData({});
    setMsg('');
    setGlobalSearch('');
    setShowNotice(false);
    setAiPage('dashboard');
    setTabRaw('dashboard');
    window.history.replaceState(null,'','#dashboard');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const current=menu.find(x=>x[0]===tab);
  // Operational reads are shared by all authenticated roles in the backend.
  const visibleMenu=menu.filter(x=>x[0]!=='users'||user?.role==='Admin');
  const q=globalSearch.trim().toLowerCase();
  const searchResults=q ? [
    ...(data.animals||[]).filter(a=>[a.code,a.species,a.origin].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,5).map(a=>({tab:'animals',label:`Vật nuôi ${a.code}`,sub:`${a.species} • ${a.weight} kg`})),
    ...(data.barns||[]).filter(b=>[b.name,b.zone].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,4).map(b=>({tab:'barns',label:b.name,sub:`${b.zone||'Khu A'} • sức chứa ${b.capacity}`})),
  ].slice(0,8) : [];
  const noticeCount=Number(data.dash?.sick_animals||0)+Number(data.dash?.upcoming_vaccines||0)+Number(data.dash?.overdue_vaccines||0)+Number(data.dash?.low_feed_types||0);

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
          {visibleMenu.map(([k,ic,v])=>(
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
          <div className="searchbox searchbox-live">
            <span>⌕</span><input aria-label="Tìm kiếm" value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)} placeholder="Tìm vật nuôi, chuồng..." />
            {q&&<div className="global-results">{searchResults.length?searchResults.map((r,i)=><button key={i} onClick={()=>{setTab(r.tab);setGlobalSearch('')}}><b>{r.label}</b><small>{r.sub}</small></button>):<div className="global-empty">Không có kết quả phù hợp</div>}</div>}
          </div>
          <div className="top-actions">
            <div className="notice-wrap"><button className="notification" type="button" onClick={()=>setShowNotice(v=>!v)}>🔔{noticeCount>0&&<b>{noticeCount}</b>}</button>{showNotice&&<div className="notice-panel"><strong>Cảnh báo hệ thống</strong><button onClick={()=>{setTab('animals');setShowNotice(false)}}>❤️ {data.dash?.sick_animals||0} vật nuôi cần theo dõi</button><button onClick={()=>{setTab((visibleMenu.some(x=>x[0]==='vacc'))?'vacc':'dashboard');setShowNotice(false)}}>💉 {data.dash?.upcoming_vaccines||0} lịch vaccine trong 7 ngày</button><button onClick={()=>{setTab((visibleMenu.some(x=>x[0]==='vacc'))?'vacc':'dashboard');setShowNotice(false)}}>⚠️ {data.dash?.overdue_vaccines||0} lịch vaccine quá hạn</button><button onClick={()=>{setTab((visibleMenu.some(x=>x[0]==='feeds'))?'feeds':'dashboard');setShowNotice(false)}}>🌾 {data.dash?.low_feed_types||0} loại thức ăn tồn thấp</button></div>}</div>
            <div className="top-profile">
              <div className="avatar">{(user?.name||'A').slice(0,1).toUpperCase()}</div>
              <div><strong>{user?.name||user?.username||'admin'}</strong><small>{({Admin:'Quản trị viên',NhanVienTrai:'Nhân viên trại',KyThuatVien:'Kỹ thuật viên',NhanVienXuatBan:'Nhân viên xuất bán'})[user?.role]||user?.role}</small></div>
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
            barns={data.barns||[]}
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

        {tab!=='ai' && <button className="ai-page-launch" onClick={()=>setTab('ai')}>✦ Hỏi về {current?.[2]||'trang này'}</button>}
        <div hidden={tab!=='ai'}>
          <AI
            key={user?.id}
            user={user}
            page={aiPage}
            onNavigate={setTab}
            onContext={setAiPage}
            rows={data.ai||[]}
            call={call}
            reload={load}
          />
        </div>

        {tab==='reports'&&
          <Reports data={{...data,dashboard:data.dash}} user={user}/>
        }

        {tab==='users'&&user?.role==='Admin'&&
          <Users rows={data.users||[]} currentUser={user} call={call} reload={load}/>
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
      setErr('Vì lý do bảo mật, vui lòng liên hệ Admin để được đặt lại mật khẩu.');
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
  {mode==='login'?<><div className="login-links"><span>Tài khoản được Admin cấp để đảm bảo phân quyền.</span></div><div className="demo-note"><span>Tài khoản demo</span><b>admin / admin123</b></div></>:<div className="login-links"><button type="button" onClick={reset}>← Quay lại đăng nhập</button></div>}
  <div className="login-copyright">© 2026 Smart Livestock • ICTU</div></form></section></div>
}

/* =========================
   DASHBOARD
========================= */

function Dashboard({d,animals,barns,feeds,barnFeeds,care,vacc,exports,setTab}){
  const health=useMemo(()=>({
    normal:animals.filter(x=>x.status==='dang_nuoi'&&x.health==='binh_thuong').length,
    watch:animals.filter(x=>x.status==='dang_nuoi'&&x.health==='can_theo_doi').length,
    sick:animals.filter(x=>x.status==='dang_nuoi'&&x.health==='benh').length
  }),[animals]);

  const species=useMemo(()=>{
    const map={};
    animals.filter(x=>x.status==='dang_nuoi').forEach(x=>{map[x.species]=(map[x.species]||0)+1});
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
        <Stat icon="🐄" label="Tổng đàn đang nuôi" value={d?.total_animals??0} note="con" />
        <Stat icon="⌂" label="Chuồng trại" value={d?.total_barns??0} note={`${d?.occupied_barns??0} đang nuôi`} trend="↑ 0 hôm qua" />
        <Stat icon="♥" label="Cần theo dõi" value={d?.sick_animals??0} note="trường hợp" alert trend="↓ 0 hôm qua" />
        <Stat icon="₫" label="Doanh thu" value={`${Number(d?.revenue??0).toLocaleString()} đ`} note="tổng xuất bán" trend="↑ 12% so với tuần trước" />
      </div>

      <div className="dashboard-grid reference-grid-top">
        <section className="panel health-panel">
          <div className="panel-head"><div><h3>Tình trạng sức khỏe đàn</h3><p>Tổng quan sức khỏe vật nuôi hiện tại</p></div><button onClick={()=>setTab('animals')}>Chi tiết →</button></div>
          <div className="health health-reference">
            <div className="health-ring"><strong>{d?.total_animals??animals.filter(a=>a.status==='dang_nuoi').length}</strong><small>đang nuôi</small></div>
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
                      {React.isValidElement(value) ? (
                        value
                      ) : c[0] === 'health' ? (
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

function Animals({rows, reload, call, user, barns=[]}) {
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(1);
  const pageSize=10;

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

  const filteredRows=rows.filter(r=>{
    const qq=search.trim().toLowerCase();
    const matchesText=!qq || [r.code,r.species,r.origin].some(v=>String(v||'').toLowerCase().includes(qq));
    const matchesStatus=r.status==='dang_nuoi';
    return matchesText && matchesStatus;
  });
  const totalPages=Math.max(1,Math.ceil(filteredRows.length/pageSize));
  const pagedRows=filteredRows.slice((page-1)*pageSize,page*pageSize);

  useEffect(()=>{ if(page>totalPages) setPage(totalPages); },[totalPages,page]);

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

        {['Admin','NhanVienTrai'].includes(user?.role)&&<button
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
        </button>}

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

          <select value={form.barn_id} onChange={(e)=>setForm({...form,barn_id:e.target.value})}>
            <option value="">-- Chọn chuồng --</option>
            {barns.map(b=><option key={b.id} value={b.id}>{b.name} • {b.zone||'Khu A'}</option>)}
          </select>

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
      <div className="list-toolbar"><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="🔎 Tìm theo mã, loài, nguồn gốc"/><span>{filteredRows.length} kết quả</span></div>
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

            {pagedRows.length > 0 ? (

              pagedRows.map((r) => (

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
                    {barns.find(b=>b.id===r.barn_id)?.name || r.barn_id || '-'}
                  </td>

                  <td>

                    {['Admin','NhanVienTrai'].includes(user?.role)&&<button
                      className="edit-button"
                      onClick={() => edit(r)}
                    >
                      ✏️ Sửa
                    </button>}


                    {user?.role === 'Admin' && (

                      <button
                        className="delete-button"
                        onClick={() => remove(r.id)}
                      >
                        🗑️ Xóa
                      </button>

                    )}


                    {r.status === 'dang_nuoi' && ['Admin','NhanVienXuatBan'].includes(user?.role) && (

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
      <div className="pagination"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>← Trước</button><span>Trang {page}/{totalPages}</span><button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Sau →</button></div>

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
function Vacc({rows,animals,reload,call,user}){
  const [show,setShow]=useState(false);
  const [updating,setUpdating]=useState(null);
  const canManage=['Admin','KyThuatVien'].includes(user?.role);
  const [form,setForm]=useState({animal_id:'',vaccine:'',scheduled_at:'',status:'chua_tiem',note:''});
  const save=async()=>{
    if(!form.animal_id || !form.vaccine.trim() || !form.scheduled_at) return alert('Vui lòng nhập đủ vật nuôi, vaccine và ngày tiêm');
    try{
      await call('/vaccinations',{method:'POST',body:JSON.stringify({...form,animal_id:Number(form.animal_id),scheduled_at:new Date(form.scheduled_at).toISOString()})});
      setShow(false); setForm({animal_id:'',vaccine:'',scheduled_at:'',status:'chua_tiem',note:''}); await reload();
    }catch(e){alert(e.message)}
  };
  const update=async(r,status)=>{
    if(updating!==null) return;
    setUpdating(r.id);
    try{
      await call(`/vaccinations/${r.id}`,{method:'PUT',body:JSON.stringify({animal_id:r.animal_id,vaccine:r.vaccine,scheduled_at:r.scheduled_at,status,note:r.note||''})});
      await reload();
    }catch(e){alert(e.message)}finally{setUpdating(null)}
  };
  const display=(rows||[]).map(r=>({...r,
    animal_id:animals.find(a=>a.id===r.animal_id)?.code||r.animal_id,
    status:<span className={`tag ${r.status==='da_tiem'?'ok':'warn'}`}>{r.status==='da_tiem'?'Đã tiêm':'Chưa tiêm'}</span>,
    scheduled_at:r.scheduled_at?new Date(r.scheduled_at).toLocaleString('vi-VN'):'',
    actions:<button type="button" className="vacc-status-button" disabled={updating!==null} onClick={()=>update(r,r.status==='da_tiem'?'chua_tiem':'da_tiem')}>{updating===r.id?'Đang lưu…':r.status==='da_tiem'?'Đổi thành chưa tiêm':'Đánh dấu đã tiêm'}</button>
  }));
  return <div>
    <div className="section-intro"><div><h2>💉 Tiêm phòng</h2><p>Quản lý lịch vaccine, trạng thái tiêm và các ghi chú theo từng vật nuôi.</p></div>{canManage&&<button className="primary-btn" onClick={()=>setShow(true)}>＋ Thêm lịch vaccine</button>}</div>
    <Table cols={[["animal_id","Vật nuôi"],["vaccine","Vaccine"],["scheduled_at","Lịch tiêm"],["status","Trạng thái"],["note","Ghi chú"],...(canManage?[["actions","Thao tác"]]:[])]} rows={display}/>
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
 const [selected,setSelected]=useState(null); const [show,setShow]=useState(false); const [form,setForm]=useState({name:'',capacity:20,status:'trong',zone:'Khu A'}); const [editId,setEditId]=useState(null);
 const canManage=user?.role==='Admin';
 const save=async()=>{if(!form.name.trim())return alert('Nhập tên chuồng');try{await call(editId?`/barns/${editId}`:'/barns',{method:editId?'PUT':'POST',body:JSON.stringify({...form,capacity:Number(form.capacity)})});setShow(false);setEditId(null);await reload()}catch(e){alert(e.message)}};
 const remove=async(b)=>{if(!confirm(`Xóa ${b.name}?`))return;try{await call(`/barns/${b.id}`,{method:'DELETE'});await reload()}catch(e){alert(e.message)}};
 const zones=[...new Set(rows.map(x=>x.zone||'Khu A'))].sort();
 return <div><div className="section-intro"><div><h2>🏠 Chuồng trại & khu vực</h2><p>Phân chia chuồng theo khu, sức chứa và theo dõi số vật nuôi thực tế.</p></div>{canManage&&<button className="primary-btn" onClick={()=>{setForm({name:'',capacity:20,status:'trong',zone:'Khu A'});setEditId(null);setShow(true)}}>＋ Thêm chuồng</button>}</div>
 {zones.map(zone=><section key={zone} className="zone-section"><div className="zone-title"><b>{zone}</b><span>{rows.filter(b=>(b.zone||'Khu A')===zone).length} chuồng</span></div><div className="barn-grid">{rows.filter(b=>(b.zone||'Khu A')===zone).map(b=><div className="barn-card clickable" key={b.id} onClick={()=>setSelected(b)}><div className="barn-card-top"><span className="barn-icon">🏠</span><span className="status-pill">{b.status==='dang_nuoi'?'Đang nuôi':'Trống'}</span></div><h3>{b.name}</h3><p>📍 {b.zone||'Khu A'} • Sức chứa {b.capacity} con</p><p className="barn-count">🐖 {animals.filter(a=>a.barn_id===b.id&&a.status!=='da_xuat_ban'&&a.status!=='da_xoa').length} vật nuôi</p><div className="capacity-bar"><i style={{width:`${Math.min(100,(animals.filter(a=>a.barn_id===b.id&&a.status==='dang_nuoi').length/Math.max(1,b.capacity))*100)}%`}}/></div>{canManage&&<div className="barn-actions"><button onClick={e=>{e.stopPropagation();setEditId(b.id);setForm({name:b.name,capacity:b.capacity,status:b.status,zone:b.zone||'Khu A'});setShow(true)}}>Sửa</button><button className="danger-link" onClick={e=>{e.stopPropagation();remove(b)}}>Xóa</button></div>}</div>)}</div></section>)}
 {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><div className="modal-card wide" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>{selected.name}</h3><p>{selected.zone||'Khu A'} • Danh sách vật nuôi trong chuồng</p></div><button onClick={()=>setSelected(null)}>✕</button></div><div className="detail-table"><table><thead><tr><th>Mã</th><th>Loài</th><th>Cân nặng</th><th>Sức khỏe</th><th>Trạng thái</th></tr></thead><tbody>{animals.filter(a=>a.barn_id===selected.id&&a.status!=='da_xuat_ban'&&a.status!=='da_xoa').map(a=><tr key={a.id}><td>{a.code}</td><td>{a.species}</td><td>{a.weight} kg</td><td><Health v={a.health}/></td><td><Badge v={a.status}/></td></tr>)}</tbody></table></div></div></div>}
 {show&&<div className="modal-backdrop" onClick={()=>setShow(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><h3>{editId?'Sửa chuồng':'Thêm chuồng'}</h3><button onClick={()=>setShow(false)}>✕</button></div><label>Tên chuồng</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><label>Phân chia khu vực</label><select value={form.zone} onChange={e=>setForm({...form,zone:e.target.value})}><option>Khu A</option><option>Khu B</option><option>Khu C</option><option>Khu cách ly</option></select><label>Sức chứa</label><input type="number" min="0" value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})}/><button className="primary-btn full" onClick={save}>Lưu</button></div></div>}
 </div>
}

/* =========================
   THỨC ĂN
========================= */

function Feeds({rows,barns,barnFeeds,feedTransfers,call,reload,user}){
 const [barnId,setBarnId]=useState(barns[0]?.id||''); const [show,setShow]=useState(false); const [form,setForm]=useState({feed_type_id:'',quantity:''}); const [transfer,setTransfer]=useState({from_barn_id:'',to_barn_id:'',feed_type_id:'',quantity:''});
 const [typeModal,setTypeModal]=useState(false); const [typeEdit,setTypeEdit]=useState(null); const [typeForm,setTypeForm]=useState({name:'',unit:'kg',stock:0,description:'',active:true});
 const selectedFeeds=barnFeeds.filter(x=>String(x.barn_id)===String(barnId)); const canManage=user?.role==='Admin';
 const add=async()=>{try{await call('/barn-feeds',{method:'POST',body:JSON.stringify({barn_id:Number(barnId),feed_type_id:Number(form.feed_type_id),quantity:Number(form.quantity)})});setShow(false);setForm({feed_type_id:'',quantity:''});await reload();}catch(e){alert(e.message)}};
 const move=async()=>{try{await call('/barn-feeds/transfer',{method:'POST',body:JSON.stringify({...transfer,from_barn_id:Number(transfer.from_barn_id),to_barn_id:Number(transfer.to_barn_id),feed_type_id:Number(transfer.feed_type_id),quantity:Number(transfer.quantity)})});alert('Đã chuyển thức ăn');await reload();}catch(e){alert(e.message)}};
 const saveType=async()=>{if(!typeForm.name.trim())return alert('Nhập tên thức ăn');try{await call(typeEdit?`/feed-types/${typeEdit}`:'/feed-types',{method:typeEdit?'PUT':'POST',body:JSON.stringify({...typeForm,stock:Number(typeForm.stock)})});setTypeModal(false);setTypeEdit(null);await reload()}catch(e){alert(e.message)}};
 const delType=async(id)=>{if(!confirm('Xóa loại thức ăn này?'))return;try{await call(`/feed-types/${id}`,{method:'DELETE'});await reload()}catch(e){alert(e.message)}};
 return <div><div className="section-intro"><div><h2>🌾 Quản lý thức ăn</h2><p>Quản lý kho tổng, cấp thức ăn theo chuồng và điều chuyển nội bộ.</p></div>{canManage&&<button className="primary-btn" onClick={()=>{setTypeEdit(null);setTypeForm({name:'',unit:'kg',stock:0,description:'',active:true});setTypeModal(true)}}>＋ Loại thức ăn</button>}</div>
 <div className="inventory-grid">{rows.map(f=><div className="inventory-card" key={f.id}><div><b>{f.name}</b><small>{f.description||'Thức ăn chăn nuôi'}</small></div><strong className={Number(f.stock)<50?'stock-low':''}>{f.stock} {f.unit}</strong><span>Kho tổng</span>{canManage&&<div className="inventory-actions"><button onClick={()=>{setTypeEdit(f.id);setTypeForm({name:f.name,unit:f.unit,stock:f.stock,description:f.description||'',active:f.active!==false});setTypeModal(true)}}>Sửa</button><button onClick={()=>delType(f.id)}>Xóa</button></div>}</div>)}</div>
 <h3 className="sub-heading">Phân bổ theo chuồng</h3><div className="feed-toolbar"><select value={barnId} onChange={e=>setBarnId(e.target.value)}>{barns.map(b=><option key={b.id} value={b.id}>{b.name} • {b.zone||'Khu A'}</option>)}</select><button className="primary-btn" onClick={()=>setShow(true)}>＋ Cấp thức ăn</button></div><div className="feed-cards">{selectedFeeds.length?selectedFeeds.map(f=><div className="feed-card" key={f.id}><b>🌾 {f.feed_name}</b><strong>{f.quantity} {f.unit}</strong><span>Cập nhật: {String(f.updated_at||'').slice(0,10)}</span></div>):<div className="empty-box">Chuồng này chưa có thức ăn được phân bổ.</div>}</div>
 <div className="transfer-box"><h3>↔ Chuyển thức ăn giữa các chuồng</h3><div className="transfer-grid"><select value={transfer.from_barn_id} onChange={e=>setTransfer({...transfer,from_barn_id:e.target.value})}><option value="">Chuồng nguồn</option>{barns.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><select value={transfer.to_barn_id} onChange={e=>setTransfer({...transfer,to_barn_id:e.target.value})}><option value="">Chuồng đích</option>{barns.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><select value={transfer.feed_type_id} onChange={e=>setTransfer({...transfer,feed_type_id:e.target.value})}><option value="">Loại thức ăn</option>{rows.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><input type="number" min="0.1" value={transfer.quantity} onChange={e=>setTransfer({...transfer,quantity:e.target.value})} placeholder="Số lượng (kg)"/><button className="primary-btn" onClick={move}>Chuyển</button></div></div>
 <div className="transfer-history"><h3>Lịch sử chuyển thức ăn</h3><Table cols={[["from_barn","Từ chuồng"],["to_barn","Đến chuồng"],["feed_name","Thức ăn"],["quantity","Số lượng"],["created_at","Thời gian"]]} rows={feedTransfers}/></div>
 {show&&<div className="modal-backdrop" onClick={()=>setShow(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><h3>Cấp thức ăn cho chuồng</h3><button onClick={()=>setShow(false)}>✕</button></div><p>Chuồng: <b>{barns.find(b=>String(b.id)===String(barnId))?.name}</b></p><select value={form.feed_type_id} onChange={e=>setForm({...form,feed_type_id:e.target.value})}><option value="">Chọn thức ăn</option>{rows.filter(f=>f.active!==false).map(f=><option key={f.id} value={f.id}>{f.name} — kho tổng {f.stock} {f.unit}</option>)}</select><input type="number" min="0.1" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} placeholder="Số lượng"/><button className="primary-btn full" onClick={add}>Xác nhận</button></div></div>}
 {typeModal&&<div className="modal-backdrop" onClick={()=>setTypeModal(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><h3>{typeEdit?'Sửa loại thức ăn':'Thêm loại thức ăn'}</h3><button onClick={()=>setTypeModal(false)}>✕</button></div><label>Tên thức ăn</label><input value={typeForm.name} onChange={e=>setTypeForm({...typeForm,name:e.target.value})}/><label>Đơn vị</label><input value={typeForm.unit} onChange={e=>setTypeForm({...typeForm,unit:e.target.value})}/><label>Tồn kho tổng</label><input type="number" min="0" value={typeForm.stock} onChange={e=>setTypeForm({...typeForm,stock:e.target.value})}/><label>Mô tả</label><input value={typeForm.description} onChange={e=>setTypeForm({...typeForm,description:e.target.value})}/><button className="primary-btn full" onClick={saveType}>Lưu</button></div></div>}</div>
}


function Exports({rows,barns,animals,call,reload,user}){
 const [barnId,setBarnId]=useState(barns[0]?.id||''); const [animal,setAnimal]=useState(null); const [form,setForm]=useState({weight:'',total:'',customer:''});
 const list=animals.filter(a=>String(a.barn_id)===String(barnId)&&a.status==='dang_nuoi'); const sell=async()=>{try{await call('/exports',{method:'POST',body:JSON.stringify({animal_id:animal.id,quantity:1,weight:Number(form.weight),total:Number(form.total),customer:form.customer})});setAnimal(null);await reload();}catch(e){alert(e.message)}};
 return <div><div className="section-intro"><div><h2>🚚 Xuất bán theo chuồng</h2><p>Chọn chuồng → chọn từng con → lập phiếu xuất bán.</p></div></div><div className="feed-toolbar"><select value={barnId} onChange={e=>setBarnId(e.target.value)}>{barns.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div><div className="animal-sale-grid">{list.map(a=><div className="sale-animal" key={a.id} onClick={()=>{setAnimal(a);setForm({weight:a.weight,total:'',customer:''})}}><div>🐖</div><b>{a.code}</b><span>{a.species} • {a.weight} kg</span><small>Nhấn để xuất bán →</small></div>)}{!list.length&&<div className="empty-box">Chuồng này không còn vật nuôi đang nuôi.</div>}</div><h3 className="sub-heading">Lịch sử xuất bán</h3><Table cols={[["id","ID"],["barn_name","Chuồng"],["animal_code","Vật nuôi"],["species","Loài"],["quantity","Số con"],["weight","Kg"],["total","Tổng tiền"],["customer","Khách hàng"],["exported_at","Ngày xuất"]]} rows={rows}/>{animal&&<div className="modal-backdrop" onClick={()=>setAnimal(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>Xuất bán {animal.code}</h3><p>{animal.species} • Chuồng {animal.barn_id}</p></div><button onClick={()=>setAnimal(null)}>✕</button></div><label>Khối lượng (kg)</label><input type="number" value={form.weight} onChange={e=>setForm({...form,weight:e.target.value})}/><label>Giá bán / tổng tiền</label><input type="number" value={form.total} onChange={e=>setForm({...form,total:e.target.value})}/><label>Khách hàng</label><input value={form.customer} onChange={e=>setForm({...form,customer:e.target.value})}/><button className="primary-btn full" onClick={sell}>Xác nhận xuất bán</button></div></div>}</div>
}

/* =========================
   AI
========================= */

function AI({rows,call,reload,page,onNavigate,onContext,user}){
  const [capabilities,setCapabilities]=useState(null);
  const [checkingConfig,setCheckingConfig]=useState(true);
  const [configVersion,setConfigVersion]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    setCheckingConfig(true);
    call('/ai/capabilities').then(result=>{
      if(!cancelled) {setCapabilities(result);setError('');}
    }).catch(e=>{if(!cancelled){setCapabilities(null);setError(e.message);}})
      .finally(()=>{if(!cancelled) setCheckingConfig(false);});
    return ()=>{cancelled=true;};
  },[configVersion]);

  const [input,setInput]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [messages,setMessages]=useState([
    {
      role:'assistant',
      text:'Xin chào! Tôi có thể giúp bạn phân tích dữ liệu trang trại.'
    }
  ]);

  const [historySearch,setHistorySearch]=useState('');
  const [conversationId,setConversationId]=useState(()=>crypto.randomUUID());
  const newChat=()=>{setConversationId(crypto.randomUUID());setMessages(messages.slice(0,1));setInput('');setError('')};
  const deleteChat=async()=>{try{await call('/ai/conversations/'+conversationId,{method:'DELETE'});newChat();if(reload)reload()}catch(e){setError(e.message)}};
  const conversations=Object.values(rows.reduce((groups,r)=>{const id=r.conversation_id||String(r.id);if(!groups[id])groups[id]=r;return groups},{}));
  const messageArea=useRef(null);
  useEffect(()=>{
    const area=messageArea.current;
    if(area) area.scrollTop=area.scrollHeight;
  },[messages,busy]);

  const contextPage=capabilities?.pages.find(p=>p.page===page);
  const suggestions=['Tóm tắt hôm nay','Vaccine quá hạn?','Con nào cần theo dõi?','Phân tích tăng trưởng','Chuồng nào gần đầy?','Thức ăn sắp hết?','Doanh thu tháng này?'];

  const send=async(text=input)=>{
    const question=(text||'').trim();
    if(!canSendMessage(question,busy,capabilities) || checkingConfig) return;

    setInput('');
    setError('');
    setBusy(true);
    setMessages(prev=>[...prev,{role:'user',text:question,pending:true}]);

    try{
      const r=await call('/ai/analyze',{
        method:'POST',
        body:JSON.stringify({prompt:question,page,conversation_id:conversationId,messages:conversationHistory(messages.slice(1))})
      });

      setMessages(prev=>[
        ...prev.map(m=>m.pending?{...m,pending:false}:m),
        {
          role:'assistant',
          text:r.answer || 'AI chưa trả về nội dung.',
          sources:r.sources||[],
          mode:r.mode,
          contextChars:r.context_chars || 0
        }
      ]);
      if(reload) reload();
    }catch(e){
      if(e.code==='ai_not_configured') setCapabilities(prev=>prev?{...prev,configured:false}:prev);
      const msg=e.message || 'Không thể xử lý yêu cầu AI';
      setError(msg);
      setInput(question);
      setMessages(prev=>[
        ...prev.map(m=>m.pending?{...m,pending:false,failed:true}:m),
        {role:'assistant',text:msg,failed:true}
      ]);
    }finally{
      setBusy(false);
    }
  };

  const onKeyDown=e=>{
    if(e.key==='Enter' && !e.shiftKey && !e.nativeEvent.isComposing){
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="ai-workspace"><aside className="ai-conversations">
      <h3>Smart Livestock AI</h3>
      <button disabled={busy} onClick={newChat}>＋ Chat mới</button>
      <input aria-label="Tìm lịch sử" placeholder="Tìm lịch sử…" value={historySearch} onChange={e=>setHistorySearch(e.target.value)}/>
      {['Hôm nay','Hôm qua','Trước đó'].map(group=><section key={group}><h4>{group}</h4>{conversations.filter(r=>{
        const age=Math.round((new Date().setHours(0,0,0,0)-new Date(r.created_at+'Z').setHours(0,0,0,0))/86400000);
        return (group==='Hôm nay'?age===0:group==='Hôm qua'?age===1:age>1) && (r.prompt||r.request||'').toLowerCase().includes(historySearch.toLowerCase());
      }).map(r=><button key={r.id} disabled={busy} onClick={()=>{setConversationId(r.conversation_id||String(r.id));setMessages([messages[0],...rows.filter(x=>(x.conversation_id||String(x.id))===(r.conversation_id||String(r.id))).slice().reverse().flatMap(x=>[{role:'user',text:x.prompt||x.request},{role:'assistant',text:x.response,mode:x.mode}])]);setError('')}}>{r.prompt||r.request}</button>)}</section>)}
    </aside><div className="ai-page ai-chat-page">
      {capabilities && !capabilities.configured && <div className="chat-error" role="status">Chế độ phân tích nội bộ đang hoạt động: trả lời từ dữ liệu hệ thống, không cần API key.</div>}
      <div className="ai-config-status" role="status">{checkingConfig?'Đang kiểm tra kết nối AI…':capabilities?.configured?'Backend đã nhận cấu hình khóa • kiểm tra này chưa gọi dịch vụ AI':!capabilities?'Chưa kiểm tra được cấu hình AI':''}<button disabled={checkingConfig||busy} onClick={()=>setConfigVersion(v=>v+1)}>Kiểm tra lại kết nối</button></div>
      {contextPage && <details className="ai-page-guide"><summary>Hướng dẫn: {contextPage.title}</summary><p>{contextPage.guide}</p><button onClick={()=>onNavigate(page)}>Mở trang {contextPage.title} →</button></details>}
      <label className="ai-context-select">Ngữ cảnh trang: <select value={page} onChange={e=>onContext(e.target.value)}>{capabilities?.pages.map(p=><option key={p.page} value={p.page}>{p.title}</option>)}</select></label>

      <div className="ai-chat-header"><button disabled={busy} onClick={deleteChat}>Xóa cuộc trò chuyện</button>
        <div className="ai-avatar large">✦</div>
        <div>
          <h2>Smart Livestock AI</h2>
          <p>● Đang hoạt động <span className="ai-badge">Dữ liệu hệ thống</span></p>
        </div>
        <button className="chat-new" disabled={busy} onClick={newChat}>＋ Cuộc trò chuyện mới</button>
      </div>

      <div className="ai-chat-shell">
        <div className="ai-chat-messages" ref={messageArea} role="log" aria-live="polite" aria-label="Hội thoại với FarmAI">
          {messages.map((m,i)=>(
            <div className={`chat-message ${m.role}`} key={i}>
              {m.role==='assistant' && <div className="chat-message-avatar">✦</div>}
              <div className="chat-bubble-wrap">
                <div className="chat-name">{m.role==='assistant'?'Smart Livestock AI':'Bạn'}</div>
                <div className="chat-bubble">
                  {m.text}
                  {m.role==='assistant' && <button className="ai-copy" onClick={()=>navigator.clipboard.writeText(m.text).catch(()=>setError('Không thể copy; hãy chọn văn bản để sao chép.'))}>Copy câu trả lời</button>}
                  {!!m.sources?.length && <div className="chat-source-links">{m.sources.map(source=><button key={source.page} onClick={()=>onNavigate(source.page)}>{source.title} →</button>)}</div>}
                </div>
                {m.role==='assistant' && m.mode && (
                  <small className="chat-meta">
                    {({fallback:'Phân tích nội bộ',ai:'AI',system_report:'Báo cáo từ hệ thống • không dùng mô hình AI',openai:'Dữ liệu hệ thống • tra cứu trực tiếp',guide:'Hướng dẫn sử dụng',clarify:'Cần làm rõ',out_of_scope:'Ngoài phạm vi hỗ trợ'})[m.mode]||m.mode}
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
                <div className="chat-bubble typing" role="status">AI đang phân tích...<span/><span/><span/></div>
              </div>
            </div>
          )}
        </div>

        {messages.length===1 && (
          <div className="chat-suggestions">
            <div className="chat-suggestion-title"><h3>Xin chào {user?.name||'Admin'}</h3><p>Tôi có thể giúp bạn phân tích dữ liệu trang trại.</p>Bạn có thể hỏi:</div>
            <div className="chat-suggestion-list">
              {suggestions.map((s,i)=>(
                <button key={i} disabled={checkingConfig || !canSendMessage(s,busy,capabilities)} onClick={()=>send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {error && <div className="chat-error" role="alert">⚠️ {error}</div>}

        <div className="chat-composer">
          <textarea
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Hỏi về dữ liệu trang trại..."
            aria-label="Câu hỏi cho trợ lý AI"
            maxLength={4000}
            disabled={busy}
            rows="1"
          />
          <button className="chat-send" aria-label="Gửi câu hỏi" onClick={()=>send()} disabled={checkingConfig || !canSendMessage(input,busy,capabilities)}>
            {busy?'…':'➤'}
          </button>
        </div>
        <div className="chat-hint">Phân tích dữ liệu FarmAI • Enter để gửi • Shift + Enter để xuống dòng</div>
      </div>

      <div className="ai-chat-note">
        <span>🔒</span>
        <div><b>AI hỗ trợ, không thay thế chuyên môn</b><br/>Kết quả AI được tạo từ dữ liệu được phép truy cập và cần được kiểm tra trước khi đưa ra quyết định nghiệp vụ.</div>
      </div>
      <details className="ai-history"><summary>Lịch sử sử dụng AI</summary><div className="panel-head"><div><h3>Lịch sử sử dụng AI</h3><p>Lưu vết yêu cầu để minh chứng và kiểm tra.</p></div><span>{rows.length} yêu cầu</span></div><Table cols={[["request","Yêu cầu"],["mode","Nguồn"],["created_at","Thời gian"]]} rows={rows.slice(0,10)}/></details>
    </div></div>

  );
}



/* =========================
   TÀI KHOẢN - ADMIN
========================= */
function Users({rows,currentUser,call,reload}){
  const [editing,setEditing]=useState(null); const [form,setForm]=useState({name:'',role:'NhanVienTrai',active:true}); const [resetUser,setResetUser]=useState(null); const [newPassword,setNewPassword]=useState('');
  const [createOpen,setCreateOpen]=useState(false); const [createForm,setCreateForm]=useState({name:'',username:'',password:'',role:'NhanVienTrai'});
  const edit=u=>{setEditing(u);setForm({name:u.name,role:u.role,active:u.active!==false})};
  const save=async()=>{try{await call(`/users/${editing.id}`,{method:'PUT',body:JSON.stringify(form)});setEditing(null);await reload()}catch(e){alert(e.message)}};
  const create=async()=>{if(createForm.password.length<6)return alert('Mật khẩu tối thiểu 6 ký tự');try{await call('/users',{method:'POST',body:JSON.stringify(createForm)});setCreateOpen(false);setCreateForm({name:'',username:'',password:'',role:'NhanVienTrai'});await reload()}catch(e){alert(e.message)}};
  const reset=async()=>{if(newPassword.length<6)return alert('Mật khẩu tối thiểu 6 ký tự');try{await call(`/users/${resetUser.id}/reset-password`,{method:'POST',body:JSON.stringify({new_password:newPassword})});alert('Đã đặt lại mật khẩu');setResetUser(null);setNewPassword('')}catch(e){alert(e.message)}};
  const roleName=r=>({Admin:'Admin',NhanVienTrai:'Nhân viên trại',KyThuatVien:'Kỹ thuật viên',NhanVienXuatBan:'Nhân viên xuất bán'})[r]||r;
  const roleOptions=<><option value="Admin">Admin</option><option value="NhanVienTrai">Nhân viên trại</option><option value="KyThuatVien">Kỹ thuật viên</option><option value="NhanVienXuatBan">Nhân viên xuất bán</option></>;
  return <div><div className="section-intro"><div><h2>👥 Quản lý tài khoản</h2><p>Admin tạo tài khoản, phân quyền, khóa/mở và đặt lại mật khẩu.</p></div><button className="primary-btn" onClick={()=>setCreateOpen(true)}>＋ Thêm tài khoản</button></div><div className="tablewrap"><table><thead><tr><th>ID</th><th>Họ tên</th><th>Tên đăng nhập</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{rows.map(u=><tr key={u.id}><td>{u.id}</td><td><b>{u.name}</b></td><td>{u.username}</td><td>{roleName(u.role)}</td><td><span className={`tag ${u.active?'ok':'bad'}`}>{u.active?'Đang hoạt động':'Đã khóa'}</span></td><td><button className="edit-button" onClick={()=>edit(u)}>Sửa</button><button className="cancel-button small" onClick={()=>{setResetUser(u);setNewPassword('')}}>Đặt mật khẩu</button>{u.id===currentUser?.id&&<small className="self-note">Tài khoản hiện tại</small>}</td></tr>)}</tbody></table></div>
  {createOpen&&<div className="modal-backdrop" onClick={()=>setCreateOpen(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><h3>Thêm tài khoản</h3><button onClick={()=>setCreateOpen(false)}>✕</button></div><label>Họ tên</label><input value={createForm.name} onChange={e=>setCreateForm({...createForm,name:e.target.value})}/><label>Tên đăng nhập</label><input value={createForm.username} onChange={e=>setCreateForm({...createForm,username:e.target.value})}/><label>Mật khẩu ban đầu</label><input type="password" value={createForm.password} onChange={e=>setCreateForm({...createForm,password:e.target.value})}/><label>Vai trò</label><select value={createForm.role} onChange={e=>setCreateForm({...createForm,role:e.target.value})}>{roleOptions}</select><button className="primary-btn full" onClick={create}>Tạo tài khoản</button></div></div>}
  {editing&&<div className="modal-backdrop" onClick={()=>setEditing(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><h3>Sửa tài khoản {editing.username}</h3><button onClick={()=>setEditing(null)}>✕</button></div><label>Họ tên</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><label>Vai trò</label><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>{roleOptions}</select><label className="toggle-row"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Tài khoản hoạt động</label><button className="primary-btn full" onClick={save}>Lưu thay đổi</button></div></div>}
  {resetUser&&<div className="modal-backdrop" onClick={()=>setResetUser(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><h3>Đặt lại mật khẩu</h3><button onClick={()=>setResetUser(null)}>✕</button></div><p>Tài khoản: <b>{resetUser.username}</b></p><label>Mật khẩu mới</label><input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự"/><button className="primary-btn full" onClick={reset}>Xác nhận</button></div></div>}</div>
}

/* =========================
   REPORTS
========================= */

function Reports({data,user}){
 const [reportDate]=useState(()=>new Date());
 const date=reportDate.toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
 const dateParts=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(reportDate);
 const part=type=>dateParts.find(p=>p.type===type)?.value;
 const signatureDate=`Ngày ${part('day')} tháng ${part('month')} năm ${part('year')}`;
 const [signer,setSigner]=useState(user?.name||user?.username||''); const d=data.dashboard||{}; const animals=data.animals||[]; const barns=data.barns||[]; const feeds=data.barnFeeds||[]; const exportsData=data.exports||[];
 const print=()=>window.print();
 return <div className="report-page"><div className="report-toolbar"><div><h2>📊 Báo cáo quản lý chăn nuôi</h2><p>Báo cáo trình bày theo dạng văn bản, phù hợp xem/in như Word.</p></div><div className="report-print-controls"><label>Người ký xác nhận<input value={signer} onChange={e=>setSigner(e.target.value)} placeholder="Nhập họ tên người ký" /></label><button className="primary-btn" onClick={print}>🖨️ In / Xuất PDF</button></div></div><article className="word-report"><header><div className="report-school">TRƯỜNG ĐẠI HỌC CNTT & TRUYỀN THÔNG – ICTU</div><h1>BÁO CÁO TỔNG HỢP QUẢN LÝ CHĂN NUÔI</h1><p>HỆ THỐNG QUẢN LÝ CHĂN NUÔI CÓ TÍCH HỢP AI</p><div className="report-date">Ngày lập báo cáo: {date}</div></header><section><h2>I. TỔNG QUAN</h2><div className="report-kpis"><div><b>{d.total_animals??animals.filter(a=>a.status==='dang_nuoi').length}</b><span>Vật nuôi đang nuôi</span></div><div><b>{d.total_barns||barns.length}</b><span>Tổng số chuồng</span></div><div><b>{d.sick_animals||0}</b><span>Trường hợp cần chú ý</span></div><div><b>{Number(d.revenue||0).toLocaleString('vi-VN')} đ</b><span>Doanh thu</span></div></div></section><section><h2>II. THỐNG KÊ THEO CHUỒNG</h2><table><thead><tr><th>STT</th><th>Chuồng</th><th>Số vật nuôi</th><th>Sức chứa</th><th>Thức ăn phân bổ</th></tr></thead><tbody>{barns.map((b,i)=><tr key={b.id}><td>{i+1}</td><td>{b.name}</td><td>{animals.filter(a=>a.barn_id===b.id&&a.status==='dang_nuoi').length}</td><td>{b.capacity}</td><td>{feeds.filter(f=>f.barn_id===b.id).reduce((x,f)=>x+Number(f.quantity||0),0)} kg</td></tr>)}</tbody></table></section><section><h2>III. DANH SÁCH VẬT NUÔI</h2><table><thead><tr><th>Mã</th><th>Loài</th><th>Chuồng</th><th>Cân nặng</th><th>Sức khỏe</th></tr></thead><tbody>{animals.filter(a=>a.status==='dang_nuoi').map(a=><tr key={a.id}><td>{a.code}</td><td>{a.species}</td><td>{barns.find(b=>b.id===a.barn_id)?.name||'-'}</td><td>{a.weight} kg</td><td>{a.health}</td></tr>)}</tbody></table></section><section><h2>IV. TÌNH HÌNH XUẤT BÁN</h2><table><thead><tr><th>ID</th><th>Chuồng</th><th>Vật nuôi</th><th>Khối lượng</th><th>Doanh thu</th><th>Khách hàng</th></tr></thead><tbody>{exportsData.map(e=><tr key={e.id}><td>{e.id}</td><td>{barns.find(b=>b.id===e.barn_id)?.name||'-'}</td><td>{e.animal_code||animals.find(a=>a.id===e.animal_id)?.code||e.animal_id}</td><td>{e.weight} kg</td><td>{Number(e.total||0).toLocaleString('vi-VN')} đ</td><td>{e.customer||'-'}</td></tr>)}</tbody></table></section><section><h2>V. NHẬN XÉT VÀ HỖ TRỢ AI</h2><p>AI hỗ trợ tổng hợp dữ liệu đàn, chuồng, thức ăn, vaccine, tăng trưởng và xuất bán trong phạm vi dữ liệu người dùng được phép truy cập. Kết quả AI cần được kiểm tra trước khi sử dụng cho quyết định nghiệp vụ.</p></section><footer className="report-signature"><div className="report-signature-block"><p className="report-signature-date">{signatureDate}</p><strong>NGƯỜI KÝ XÁC NHẬN</strong><p className="report-signature-hint">(Ký và ghi rõ họ tên)</p><div className="report-signature-space" aria-label="Khoảng trống để ký tên"/><b className="report-signer-name">{signer.trim()||'........................................'}</b></div></footer></article></div>
}


/* =========================
   RENDER APP
========================= */

const root = document.getElementById('root');
createRoot(root).render(<App />);
