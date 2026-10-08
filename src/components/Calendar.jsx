import React, { useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, X } from 'lucide-react';
import { CALENDAR_KEY, IMPORTANCE, dateKey, isValidDate, monthDays, readCalendarEvents, sortEvents } from '../lib/calendar.js';
import './calendar.css';

const dayFormatter = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const blankEvent = (date) => ({ title: '', date, time: '', importance: 'medium', notes: '' });

export default function Calendar() {
  const [events, setEvents] = useState(readCalendarEvents);
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12));
  const [draft, setDraft] = useState(() => blankEvent(dateKey(new Date())));
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState('');
  const titleRef = useRef(null);
  const today = dateKey(new Date());
  const selected = new Date(`${selectedDate}T12:00:00`);
  const dailyEvents = sortEvents(events.filter((event) => event.date === selectedDate));
  const eventsByDate = new Map();
  for (const event of events) {
    if (!eventsByDate.has(event.date)) eventsByDate.set(event.date, []);
    eventsByDate.get(event.date).push(event);
  }

  function selectDay(date) {
    const key = dateKey(date);
    setSelectedDate(key);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
    setDraft(blankEvent(key));
    setEditingId(null);
    setStatus('');
  }

  function persist(nextEvents, message) {
    try {
      localStorage.setItem(CALENDAR_KEY, JSON.stringify(nextEvents));
      setEvents(nextEvents);
      setStatus(message);
      return true;
    } catch {
      setStatus('No se pudieron guardar los cambios. Inténtalo de nuevo.');
      return false;
    }
  }

  function saveEvent(event) {
    event.preventDefault();
    if (!draft.title.trim() || !isValidDate(draft.date)) return;
    const saved = { ...draft, title: draft.title.trim(), notes: draft.notes.trim(), id: editingId || crypto.randomUUID() };
    const nextEvents = editingId ? events.map((item) => item.id === editingId ? saved : item) : [...events, saved];
    if (!persist(nextEvents, editingId ? 'Cambios guardados.' : 'Evento añadido.')) return;
    setSelectedDate(saved.date);
    const date = new Date(`${saved.date}T12:00:00`);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
    setDraft(blankEvent(saved.date));
    setEditingId(null);
  }

  function editEvent(event) {
    setDraft({ ...event });
    setEditingId(event.id);
    setStatus('');
    titleRef.current?.focus();
  }

  function deleteEvent(event) {
    if (!persist(events.filter((item) => item.id !== event.id), 'Evento eliminado.')) return;
    if (editingId === event.id) {
      setEditingId(null);
      setDraft(blankEvent(selectedDate));
    }
  }

  return (
    <section className="calendar-view" aria-labelledby="calendar-title">
      <div className="calendar-heading">
        <div><div className="eyebrow"><span className="eyebrow-line" />TU AGENDA</div><h1 id="calendar-title">Calendario</h1><p>Un espacio para tus planes, día a día.</p></div>
        <button className="calendar-button" onClick={() => selectDay(new Date())}>Hoy</button>
      </div>
      <div className="calendar-layout">
        <section className="calendar-month" aria-label="Calendario mensual">
          <div className="calendar-month-toolbar">
            <h2 aria-live="polite">{monthFormatter.format(month)}</h2>
            <div className="calendar-month-arrows">
              <button className="calendar-icon-button" aria-label="Mes anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))}><ChevronLeft size={18} /></button>
              <button className="calendar-icon-button" aria-label="Mes siguiente" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))}><ChevronRight size={18} /></button>
            </div>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-days">
            {monthDays(month).map((date) => {
              const key = dateKey(date);
              const dayEvents = sortEvents(eventsByDate.get(key) || []);
              return <button key={key} className={`calendar-day${date.getMonth() !== month.getMonth() ? ' outside-month' : ''}${key === selectedDate ? ' selected' : ''}${key === today ? ' today' : ''}`} onClick={() => selectDay(date)} aria-pressed={key === selectedDate} aria-current={key === today ? 'date' : undefined} aria-label={`${dayFormatter.format(date)}${key === today ? ', hoy' : ''}, ${dayEvents.length} eventos`}>
                <span className="calendar-day-number">{date.getDate()}</span>
                <span className="calendar-day-events">{dayEvents.slice(0, 2).map((item) => <span key={item.id} className={`calendar-event-preview importance-${item.importance}`}><span className="importance-dot" />{item.title}</span>)}{dayEvents.length > 2 && <span className="calendar-more">+{dayEvents.length - 2} más</span>}</span>
              </button>;
            })}
          </div>
          <div className="calendar-legend" aria-label="Importancia de los eventos">{Object.entries(IMPORTANCE).map(([key, value]) => <span key={key} className={`importance-${key}`}><span className="importance-dot" />{value.label}</span>)}</div>
        </section>
        <aside className="calendar-agenda" aria-label="Agenda del día">
          <div className="calendar-agenda-heading"><CalendarDays size={18} /><div><span>AGENDA DEL DÍA</span><h2>{dayFormatter.format(selected)}</h2></div></div>
          <div className="calendar-event-list">
            {dailyEvents.length === 0 ? <p className="calendar-empty">Todavía no hay eventos para este día.</p> : dailyEvents.map((event) => <article className="calendar-event" key={event.id}>
              <div className="calendar-event-meta"><span className={`calendar-importance importance-${event.importance}`}><span className="importance-dot" />Importancia {IMPORTANCE[event.importance].label.toLowerCase()}</span><span>{event.time || 'Todo el día'}</span></div>
              <h3>{event.title}</h3>{event.notes && <p>{event.notes}</p>}
              <div className="calendar-event-actions"><button className="calendar-text-button" onClick={() => editEvent(event)} aria-label={`Editar ${event.title}`}><Pencil size={13} />Editar</button><button className="calendar-text-button" onClick={() => deleteEvent(event)} aria-label={`Eliminar ${event.title}`}><X size={14} />Eliminar</button></div>
            </article>)}
          </div>
          <form className="calendar-form" onSubmit={saveEvent}>
            <h3>{editingId ? 'Editar evento' : 'Nuevo evento'}</h3>
            <label>Nombre<input ref={titleRef} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="¿Qué tienes planeado?" maxLength={100} required /></label>
            <div className="calendar-form-row"><label>Fecha<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} required /></label><label>Hora <span>(opcional)</span><input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} /></label></div>
            <label>Importancia<select value={draft.importance} onChange={(event) => setDraft({ ...draft, importance: event.target.value })}>{Object.entries(IMPORTANCE).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
            <label>Notas <span>(opcional)</span><textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Añade los detalles…" maxLength={2000} rows={2} /></label>
            <div className="calendar-form-actions"><button type="submit" className="calendar-button primary" disabled={!draft.title.trim() || !isValidDate(draft.date)}><Plus size={15} />{editingId ? 'Guardar cambios' : 'Añadir evento'}</button>{editingId && <button type="button" className="calendar-text-button" onClick={() => { setEditingId(null); setDraft(blankEvent(selectedDate)); setStatus(''); }}>Cancelar</button>}</div>
          </form>
          <p className="calendar-status" role="status">{status}</p>
        </aside>
      </div>
    </section>
  );
}
