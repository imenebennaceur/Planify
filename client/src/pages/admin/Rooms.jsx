import React, { useEffect, useState } from 'react';
import { listRooms, addRoom, listRoomSlots, addRoomSlot, deleteRoom, deleteRoomSlot } from '../../lib/adminApi.js';

export default function AdminRooms() {
  const [rooms, setRooms] = useState([]);
  const [slots, setSlots] = useState([]);
  const [roomForm, setRoomForm] = useState({ name: '', capacity: '', availability_status: 'available' });
  const [slotForm, setSlotForm] = useState({ room_name: '', day: '', start: '', end: '' });
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await listRooms();
    const s = await listRoomSlots();

    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to load rooms.');
      setRooms([]);
      setSlots([]);
      setLoading(false);
      return;
    }
    if (!s.ok) {
      setError((s.data && s.data.errors && s.data.errors[0]) || 'Unable to load time slots.');
      setRooms(Array.isArray(r.data) ? r.data : []);
      setSlots([]);
      setLoading(false);
      return;
    }

    setError('');
    setRooms(Array.isArray(r.data) ? r.data : []);
    setSlots(Array.isArray(s.data) ? s.data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function onRoomChange(k, v) {
    setRoomForm((s) => ({ ...s, [k]: v }));
  }

  function onAddRoom(ev) {
    ev.preventDefault();
    if (!roomForm.name) return;
    (async () => {
      const r = await addRoom({
        name: roomForm.name,
        capacity: roomForm.capacity,
        availability_status: roomForm.availability_status
      });
      if (r.ok) {
        await load();
        setRoomForm({ name: '', capacity: '', availability_status: 'available' });
      } else {
        setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to add room.');
      }
    })();
  }

  function onSlotChange(k, v) {
    setSlotForm((s) => ({ ...s, [k]: v }));
  }

  function onAddSlot(ev) {
    ev.preventDefault();
    const { room_name, day, start, end } = slotForm;
    if (!room_name || !day || !start || !end) return;
    (async () => {
      const r = await addRoomSlot({ room_name, day, start, end });
      if (r.ok) {
        await load();
        setSlotForm({ room_name: '', day: '', start: '', end: '' });
      } else {
        setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to add time slot.');
      }
    })();
  }

  async function onDeleteRoomRow(room) {
    if (!room || !room.id) return;
    const ok = confirm(`Delete room "${room.name}"?`);
    if (!ok) return;
    const r = await deleteRoom(room.id);
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to delete room.');
      return;
    }
    setError('');
    await load();
  }

  async function onDeleteSlotRow(slot) {
    if (!slot || !slot.id) return;
    const ok = confirm(`Delete time slot ${slot.room_name} (${slot.day} ${slot.start}-${slot.end})?`);
    if (!ok) return;
    const r = await deleteRoomSlot(slot.id);
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to delete time slot.');
      return;
    }
    setError('');
    await load();
  }

  return (
    <div>
      <h2 className="title">Rooms & availability</h2>
      <p className="subtitle">Manage rooms and available time slots</p>

      <div className="toolbar">
        <button className="btn" onClick={() => setShowRoomForm((s) => !s)}>
          {showRoomForm ? 'Hide form' : 'Add room'}
        </button>
        <button className="btn" onClick={() => setShowSlotForm((s) => !s)}>
          {showSlotForm ? 'Hide form' : 'Add time slot'}
        </button>
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="errors">{error}</div>}

      {showRoomForm && (
        <form onSubmit={onAddRoom} style={{ marginTop: 12 }}>
          <div className="field">
            <span className="icon" aria-hidden="true">
              🏫
            </span>
            <input placeholder="Room name" value={roomForm.name} onChange={(e) => onRoomChange('name', e.target.value)} />
          </div>
          <div className="field">
            <span className="icon" aria-hidden="true">
              #
            </span>
            <input placeholder="Capacity" type="number" min="0" value={roomForm.capacity} onChange={(e) => onRoomChange('capacity', e.target.value)} />
          </div>
          <div className="field select">
            <span className="icon" aria-hidden="true">
              S
            </span>
            <select value={roomForm.availability_status} onChange={(e) => onRoomChange('availability_status', e.target.value)}>
              <option value="available">Available</option>
              <option value="limited">Limited</option>
              <option value="unavailable">Unavailable</option>
            </select>
            <span className="chevron" aria-hidden="true">
              â–¾
            </span>
          </div>
          <button className="primary" type="submit">
            Add
          </button>
        </form>
      )}

      {showSlotForm && (
        <form onSubmit={onAddSlot} style={{ marginTop: 12 }}>
          {rooms.length ? (
            <div className="field select">
              <span className="icon" aria-hidden="true">
                🏫
              </span>
              <select value={slotForm.room_name} onChange={(e) => onSlotChange('room_name', e.target.value)} required>
                <option value="">Choose a room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
              <span className="chevron" aria-hidden="true">
                ▾
              </span>
            </div>
          ) : (
            <div className="field">
              <span className="icon" aria-hidden="true">
                🏫
              </span>
              <input placeholder="Room name" value={slotForm.room_name} onChange={(e) => onSlotChange('room_name', e.target.value)} />
            </div>
          )}
          <div className="field">
            <span className="icon" aria-hidden="true">
              📅
            </span>
            <input placeholder="Date (YYYY-MM-DD)" value={slotForm.day} onChange={(e) => onSlotChange('day', e.target.value)} />
          </div>
          <div className="field">
            <span className="icon" aria-hidden="true">
              ⏰
            </span>
            <input placeholder="Start (HH:MM)" value={slotForm.start} onChange={(e) => onSlotChange('start', e.target.value)} />
          </div>
          <div className="field">
            <span className="icon" aria-hidden="true">
              ⏱️
            </span>
            <input placeholder="End (HH:MM)" value={slotForm.end} onChange={(e) => onSlotChange('end', e.target.value)} />
          </div>
          <button className="primary" type="submit">
            Add time slot
          </button>
        </form>
      )}

      <div style={{ marginTop: 18, display: 'grid', gap: 18 }}>
        <div style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Rooms</th>
                <th>Capacity</th>
                <th>Status</th>
                <th style={{ width: 60 }}>X</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.capacity || 0}</td>
                  <td>{r.availability_status || 'available'}</td>
                  <td>
                    <button className="icon-btn" type="button" onClick={() => onDeleteRoomRow(r)} aria-label={`Delete ${r.name}`}>
                      x
                    </button>
                  </td>
                </tr>
              ))}
              {!rooms.length && !loading && (
                <tr>
                  <td colSpan={4} style={{ padding: 14, color: 'var(--muted)' }}>
                    No rooms.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Date</th>
                <th>Start</th>
                <th>End</th>
                <th>Room status</th>
                <th>Reserved by</th>
                <th style={{ width: 60 }}>X</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s) => (
                <tr key={s.id}>
                  <td>{s.room_name}</td>
                  <td>{s.day}</td>
                  <td>{s.start}</td>
                  <td>{s.end}</td>
                  <td>{s.availability_status || 'available'}</td>
                  <td>{s.reserved_by || ''}</td>
                  <td>
                    <button
                      className="icon-btn"
                      type="button"
                      onClick={() => onDeleteSlotRow(s)}
                      aria-label={`Delete time slot ${s.room_name} ${s.day} ${s.start}-${s.end}`}
                    >
                      x
                    </button>
                  </td>
                </tr>
              ))}
              {!slots.length && !loading && (
                <tr>
                  <td colSpan={7} style={{ padding: 14, color: 'var(--muted)' }}>
                    No available time slots.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
