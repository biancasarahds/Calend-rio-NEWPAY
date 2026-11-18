import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, format, parseISO, isToday,
  addDays, startOfDay, endOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Search, LogOut,
  Clock3, MapPin, Pencil, Trash2, X, Check, Sparkles, LockKeyhole,
  Users, ListTodo, Sun, Moon
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const categories = [
  { value: 'marketing', label: 'Marketing' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'interno', label: 'Interno' },
  { value: 'pessoal', label: 'Pessoal' },
  { value: 'outro', label: 'Outro' }
];

const quotes = [
  'Organização hoje é tranquilidade para amanhã.',
  'Pequenos avanços, feitos com constância, constroem grandes resultados.',
  'Planejar é transformar intenção em ação.',
  'Uma tarefa de cada vez. Um dia de cada vez.',
  'O que é acompanhado tem mais chance de acontecer.'
];

const emptyForm = {
  title: '', description: '', category: 'interno', start_at: '', end_at: '',
  all_day: false, location: ''
};

function toLocalInput(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(new Date().getDate() % quotes.length);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) { setProfile(null); setEvents([]); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) { setLoading(false); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      const [{ data: p, error: pe }, { data: e, error: ee }] = await Promise.all([
        supabase.from('profiles').select('id,email,role').eq('id', session.user.id).single(),
        supabase.from('calendar_events').select('*').order('start_at', { ascending: true })
      ]);
      if (!alive) return;
      if (pe) setNotice('Não foi possível carregar seu perfil. Confira a configuração do banco de dados.');
      else setProfile(p);
      if (ee) setNotice('Não foi possível carregar os eventos. Verifique as políticas do banco de dados.');
      else setEvents(e || []);
      setLoading(false);
    })();
    const channel = supabase.channel('calendar-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, payload => {
        setEvents(current => {
          if (payload.eventType === 'DELETE') return current.filter(item => item.id !== payload.old.id);
          const incoming = payload.new;
          return [...current.filter(item => item.id !== incoming.id), incoming]
            .sort((a,b) => new Date(a.start_at) - new Date(b.start_at));
        });
      }).subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [session]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const filteredEvents = useMemo(() => events.filter(event => {
    const text = `${event.title} ${event.description || ''} ${event.location || ''}`.toLowerCase();
    return text.includes(query.toLowerCase());
  }), [events, query]);

  const dayEvents = useMemo(() => filteredEvents
    .filter(event => isSameDay(parseISO(event.start_at), selectedDay))
    .sort((a,b) => new Date(a.start_at) - new Date(b.start_at)), [filteredEvents, selectedDay]);

  const upcoming = useMemo(() => filteredEvents
    .filter(event => new Date(event.end_at || event.start_at) >= startOfDay(new Date()))
    .sort((a,b) => new Date(a.start_at) - new Date(b.start_at)).slice(0, 5), [filteredEvents]);

  async function signIn(e) {
    e.preventDefault();
    if (!supabase) return;
    setAuthBusy(true); setNotice('');
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    setAuthBusy(false);
    if (error) setNotice('Não foi possível entrar. Confira e-mail e senha.');
  }

  async function signOut() { await supabase?.auth.signOut(); }

  function openNew(day = selectedDay) {
    if (!isAdmin) return;
    const start = new Date(day); start.setHours(9, 0, 0, 0);
    const end = new Date(day); end.setHours(10, 0, 0, 0);
    setEditing(null);
    setForm({ ...emptyForm, start_at: toLocalInput(start), end_at: toLocalInput(end) });
    setModal(true);
  }

  function openEdit(event) {
    if (!isAdmin) return;
    setEditing(event);
    setForm({
      title: event.title || '', description: event.description || '',
      category: event.category || 'interno',
      start_at: toLocalInput(event.start_at),
      end_at: toLocalInput(event.end_at || event.start_at),
      all_day: !!event.all_day, location: event.location || ''
    });
    setModal(true);
  }

  async function saveEvent(e) {
    e.preventDefault();
    if (!isAdmin || !form.title.trim()) return;
    setSaving(true); setNotice('');
    const payload = {
      title: form.title.trim(), description: form.description.trim() || null,
      category: form.category, start_at: new Date(form.start_at).toISOString(),
      end_at: new Date(form.end_at || form.start_at).toISOString(),
      all_day: form.all_day, location: form.location.trim() || null,
      created_by: session.user.id
    };
    const result = editing
      ? await supabase.from('calendar_events').update(payload).eq('id', editing.id)
      : await supabase.from('calendar_events').insert(payload);
    setSaving(false);
    if (result.error) { setNotice('Não foi possível salvar. Verifique sua permissão de administrador.'); return; }
    setModal(false);
    const { data } = await supabase.from('calendar_events').select('*').order('start_at');
    if (data) setEvents(data);
  }

  async function deleteEvent(event) {
    if (!isAdmin || !window.confirm(`Excluir "${event.title}"?`)) return;
    const { error } = await supabase.from('calendar_events').delete().eq('id', event.id);
    if (error) setNotice('Não foi possível excluir este compromisso.');
    else setEvents(current => current.filter(item => item.id !== event.id));
  }

  function categoryLabel(value) { return categories.find(c => c.value === value)?.label || 'Outro'; }
  function eventTime(event) {
    if (event.all_day) return 'Dia inteiro';
    return `${format(parseISO(event.start_at), 'HH:mm')} – ${format(parseISO(event.end_at || event.start_at), 'HH:mm')}`;
  }

  if (!supabase) return <SetupScreen />;
  if (!session) return (
    <div className="login-page">
      <div className="login-brand"><div className="brand-mark">N</div><span>NEWPAY<span className="brand-light">BANK</span></span></div>
      <div className="login-card">
        <div className="eyebrow">ORGANIZAÇÃO DA EQUIPE</div>
        <h1>Seu calendário,<br/><span>em um só lugar.</span></h1>
        <p>Entre para visualizar os compromissos e acompanhar a rotina da equipe.</p>
        <form onSubmit={signIn} className="login-form">
          <label>E-mail<input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="seuemail@empresa.com" required /></label>
          <label>Senha<input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="Sua senha" required /></label>
          <button className="primary-btn full" disabled={authBusy}>{authBusy ? 'Entrando...' : 'Entrar'} <ChevronRight size={18}/></button>
        </form>
        {notice && <div className="notice">{notice}</div>}
        <div className="secure-note"><LockKeyhole size={14}/> Acesso restrito à equipe autorizada</div>
      </div>
      <div className="login-foot">NEWPAYBANK · CALENDÁRIO INTERNO</div>
    </div>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">N</div><div>NEWPAY<span>BANK</span><small>CALENDÁRIO DA EQUIPE</small></div></div>
        <div className="side-label">VISÃO GERAL</div>
        <div className="side-item active"><CalendarDays size={18}/> Calendário</div>
        <div className="side-item"><ListTodo size={18}/> Compromissos</div>
        <div className="sidebar-bottom">
          <div className="newbie"><div className="newbie-face">☺</div><div><b>Oi! Eu sou o Newbie.</b><p>Vamos manter tudo em dia?</p></div></div>
          <div className="user-card"><div className="avatar">{(profile?.email || '?').slice(0,1).toUpperCase()}</div><div className="user-info"><b>{profile?.email || session.user.email}</b><span>{isAdmin ? 'Administrador' : 'Visualização'}</span></div><button className="icon-btn" title="Sair" onClick={signOut}><LogOut size={17}/></button></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div><div className="eyebrow">PLANEJAMENTO E ORGANIZAÇÃO</div><h1>Calendário <span>NewPayBank</span></h1></div>
          <div className="top-actions">
            <div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar compromisso..." /></div>
            {isAdmin && <button className="primary-btn" onClick={()=>openNew()}><Plus size={18}/> Novo compromisso</button>}
          </div>
        </header>

        {notice && <div className="notice notice-inline">{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
        {loading ? <div className="loading">Carregando calendário...</div> : !profile ? (
          <div className="empty-state"><LockKeyhole/><h3>Perfil ainda não configurado</h3><p>Peça ao administrador para concluir a configuração do seu acesso.</p></div>
        ) : (
          <div className="content-grid">
            <section className="calendar-panel">
              <div className="calendar-toolbar">
                <div><h2>{format(month, 'MMMM yyyy', { locale: ptBR })}</h2><p>Organize os compromissos da equipe</p></div>
                <div className="month-controls">
                  <button className="today-btn" onClick={()=>{setMonth(startOfMonth(new Date()));setSelectedDay(new Date());}}>Hoje</button>
                  <button className="round-btn" onClick={()=>setMonth(subMonths(month,1))}><ChevronLeft size={18}/></button>
                  <button className="round-btn" onClick={()=>setMonth(addMonths(month,1))}><ChevronRight size={18}/></button>
                </div>
              </div>
              <div className="calendar-grid">
                {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(day=><div className="weekday" key={day}>{day}</div>)}
                {calendarDays.map(day=>{
                  const dayItems = filteredEvents.filter(ev=>isSameDay(parseISO(ev.start_at),day));
                  return <button key={day.toISOString()} className={`day-cell ${!isSameMonth(day,month)?'muted':''} ${isSameDay(day,selectedDay)?'selected':''} ${isToday(day)?'today':''}`} onClick={()=>setSelectedDay(day)} onDoubleClick={()=>openNew(day)}>
                    <span className="day-number">{format(day,'d')}</span>
                    <div className="day-dots">{dayItems.slice(0,3).map(ev=><i key={ev.id} className={`dot ${ev.category || 'outro'}`} title={ev.title}/>)}</div>
                    {dayItems.length>0 && <span className="day-count">{dayItems.length}</span>}
                  </button>;
                })}
              </div>
              <div className="calendar-legend">{categories.slice(0,5).map(c=><span key={c.value}><i className={`dot ${c.value}`}/>{c.label}</span>)}</div>
              <div className="quote-card"><div className="quote-icon"><Sparkles size={19}/></div><div><small>LEMBRETE DO NEWBIE</small><p>“{quotes[quoteIndex]}”</p></div><button className="quote-refresh" onClick={()=>setQuoteIndex((quoteIndex+1)%quotes.length)}>Outra frase</button></div>
            </section>

            <aside className="right-column">
              <section className="agenda-card">
                <div className="agenda-head"><div><small>AGENDA DO DIA</small><h3>{format(selectedDay, "dd 'de' MMMM", {locale:ptBR})}</h3></div><span className="date-badge">{format(selectedDay,'EEE', {locale:ptBR})}</span></div>
                {dayEvents.length ? <div className="event-list">{dayEvents.map(event=><EventRow key={event.id} event={event} categoryLabel={categoryLabel} eventTime={eventTime} isAdmin={isAdmin} onEdit={openEdit} onDelete={deleteEvent}/>)}</div> : <div className="empty-agenda"><div className="empty-icon"><CalendarDays size={22}/></div><b>Nenhum compromisso</b><span>Este dia está livre na agenda.</span>{isAdmin&&<button onClick={()=>openNew(selectedDay)}>Adicionar compromisso</button>}</div>}
              </section>
              <section className="upcoming-card">
                <div className="section-head"><div><small>FIQUE DE OLHO</small><h3>Próximos compromissos</h3></div><Clock3 size={18}/></div>
                {upcoming.length ? upcoming.map(ev=><button className="upcoming-row" key={ev.id} onClick={()=>{setSelectedDay(parseISO(ev.start_at));setMonth(startOfMonth(parseISO(ev.start_at)));}}>
                  <div className="upcoming-date"><b>{format(parseISO(ev.start_at),'dd')}</b><span>{format(parseISO(ev.start_at),'MMM',{locale:ptBR})}</span></div>
                  <div className="upcoming-info"><b>{ev.title}</b><span>{eventTime(ev)} · {categoryLabel(ev.category)}</span></div><ChevronRight size={16}/>
                </button>) : <p className="muted-copy">Nenhum compromisso futuro cadastrado.</p>}
              </section>
              <div className="access-note"><Users size={17}/><span><b>{isAdmin ? 'Acesso administrativo' : 'Acesso de visualização'}</b>{isAdmin ? 'Você pode gerenciar os compromissos.' : 'Você pode acompanhar toda a agenda da equipe.'}</span></div>
            </aside>
          </div>
        )}
        <footer>NEWPAYBANK <span>·</span> ORGANIZAÇÃO QUE MOVE RESULTADOS</footer>
      </main>

      {modal && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false);}}>
        <form className="event-modal" onSubmit={saveEvent}>
          <div className="modal-head"><div><small>{editing?'EDITAR':'NOVO'}</small><h2>{editing?'Editar compromisso':'Adicionar compromisso'}</h2></div><button type="button" className="icon-btn" onClick={()=>setModal(false)}><X/></button></div>
          <label>Título do compromisso<input autoFocus value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ex.: Reunião de planejamento" required maxLength={120}/></label>
          <div className="form-row"><label>Categoria<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option value={c.value} key={c.value}>{c.label}</option>)}</select></label><label>Local<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Opcional"/></label></div>
          <div className="form-row"><label>Início<input type="datetime-local" value={form.start_at} onChange={e=>setForm({...form,start_at:e.target.value})} required/></label><label>Término<input type="datetime-local" value={form.end_at} onChange={e=>setForm({...form,end_at:e.target.value})} required/></label></div>
          <label>Descrição<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows="3" placeholder="Informações adicionais..."/></label>
          <label className="check-line"><input type="checkbox" checked={form.all_day} onChange={e=>setForm({...form,all_day:e.target.checked})}/> Compromisso de dia inteiro</label>
          <div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setModal(false)}>Cancelar</button><button className="primary-btn" disabled={saving}>{saving?'Salvando...':<><Check size={17}/> Salvar compromisso</>}</button></div>
        </form>
      </div>}
    </div>
  );
}

function EventRow({event, categoryLabel, eventTime, isAdmin, onEdit, onDelete}) {
  return <div className="event-row">
    <div className={`event-accent ${event.category || 'outro'}`}/>
    <div className="event-main"><b>{event.title}</b><span><Clock3 size={13}/>{eventTime(event)}</span>{event.location&&<span><MapPin size={13}/>{event.location}</span>}{event.description&&<p>{event.description}</p>}<em>{categoryLabel(event.category)}</em></div>
    {isAdmin&&<div className="event-actions"><button title="Editar" onClick={()=>onEdit(event)}><Pencil size={15}/></button><button title="Excluir" onClick={()=>onDelete(event)}><Trash2 size={15}/></button></div>}
  </div>;
}

function SetupScreen() {
  return <div className="setup-page"><div className="brand-mark">N</div><h1>Calendário NewPayBank</h1><h2>Falta conectar o banco de dados.</h2><p>Configure as variáveis <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no arquivo <code>.env</code>, seguindo o guia incluído no projeto.</p><p>Não coloque a chave <code>service_role</code> no site.</p></div>;
}