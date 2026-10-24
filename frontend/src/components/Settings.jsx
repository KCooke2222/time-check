import { useState, useEffect } from 'react';
import { settingsAPI, calendarAPI } from '../services/api';
import CategoryTree from './CategoryTree';
import { MdSync } from 'react-icons/md';

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-5 w-[34px] flex-none items-center rounded-full transition-colors ${checked ? 'bg-good' : 'bg-line'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[16px]' : 'translate-x-[2px]'}`} />
    </button>
  );
}

function Settings() {
  const [calendars, setCalendars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [availableCalendars, setAvailableCalendars] = useState([]);
  const [syncStats, setSyncStats] = useState(null);
  const [lookbackDays, setLookbackDays] = useState(7);
  const [isSyncing, setIsSyncing] = useState(false);
  const [minHours, setMinHours] = useState(0);
  const [maxHours, setMaxHours] = useState(16);
  const [timezone, setTimezone] = useState('UTC');

  useEffect(() => {
    loadSettings();
    loadCalendars();
    loadSyncStats();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await settingsAPI.get();
      setMinHours(data.min_event_duration_hours);
      setMaxHours(data.max_event_duration_hours);

      // Auto-detect timezone if still default
      const tz = data.timezone && data.timezone !== 'UTC'
        ? data.timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(tz);

      // Auto-save detected timezone if it differs
      if ((!data.timezone || data.timezone === 'UTC') && tz !== 'UTC') {
        await settingsAPI.update({ timezone: tz });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCalendars = async () => {
    try {
      const [listData, discoverData] = await Promise.allSettled([
        calendarAPI.list(),
        calendarAPI.discover(),
      ]);
      if (listData.status === 'fulfilled') setCalendars(listData.value.calendars);
      if (discoverData.status === 'fulfilled') setAvailableCalendars(discoverData.value.calendars || []);
      else setAvailableCalendars(null);
    } catch (err) {
      console.error('Failed to load calendars:', err);
    }
  };

  const loadSyncStats = async () => {
    try {
      const data = await calendarAPI.syncStats();
      setSyncStats(data);
    } catch (err) {
      console.error('Failed to load sync stats:', err);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setMessage(null);
    try {
      const result = await calendarAPI.sync(lookbackDays);
      setMessage({ type: 'success', text: `+${result.stats.events_added} new, ~${result.stats.events_updated} updated, -${result.stats.events_deleted} deleted` });
      await loadSyncStats();
    } catch (err) {
      setMessage({ type: 'error', text: 'Sync failed' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      await settingsAPI.update({
        min_event_duration_hours: parseFloat(minHours),
        max_event_duration_hours: parseFloat(maxHours),
        timezone,
      });
      setMessage({ type: 'success', text: 'Saved' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleCalendar = async (calendarId) => {
    try {
      await calendarAPI.toggle(calendarId);
      await loadCalendars();
    } catch (err) {
      console.error('Failed to toggle calendar:', err);
    }
  };

  const handleDeleteCalendar = async (calendarId) => {
    if (!confirm('Remove this calendar? All its events will be deleted.')) return;
    try {
      await calendarAPI.delete(calendarId);
      await loadCalendars();
    } catch (err) {
      console.error('Failed to delete calendar:', err);
    }
  };

  const handleAddCalendar = async (calendarId, calendarName) => {
    try {
      await calendarAPI.add(calendarId, calendarName);
      await loadCalendars();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to add calendar' });
    }
  };

  if (isLoading) {
    return <div className="py-12 text-center text-muted">…</div>;
  }

  const row = 'flex items-center gap-3 py-2 border-t border-line first:border-t-0 text-sm';
  const TIMEZONES = ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Phoenix', 'America/Toronto', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo',
    'Asia/Shanghai', 'Australia/Sydney'];

  return (
    <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
      <div className="space-y-3">
        <form onSubmit={handleSaveSettings} className="panel px-3.5 py-1.5">
          <label className={row}>
            <span title="Shortest event counted">Min h</span>
            <input type="number" step="0.1" value={minHours} onChange={(e) => setMinHours(e.target.value)}
              className="field ml-auto !w-20 text-right num" />
          </label>
          <label className={row}>
            <span title="Longest event counted">Max h</span>
            <input type="number" step="0.1" value={maxHours} onChange={(e) => setMaxHours(e.target.value)}
              className="field ml-auto !w-20 text-right num" />
          </label>
          <label className={row}>
            <span>Timezone</span>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="field ml-auto !w-auto max-w-[180px]">
              {(TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]).map(tz => (
                <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
              ))}
            </select>
          </label>
          <div className={`${row} justify-end`}>
            {message && (
              <span className={`text-xs mr-auto ${message.type === 'success' ? 'text-good' : 'text-warn'}`}>{message.text}</span>
            )}
            <button type="submit" disabled={isSaving}
              className="bg-ink text-panel px-3.5 py-1.5 rounded-lg text-sm font-medium hover:bg-ink/90 disabled:opacity-50">
              {isSaving ? '…' : 'Save'}
            </button>
          </div>
        </form>

        <div className="panel px-3.5 py-1.5">
          <div className={`${row} text-muted`}>
            {syncStats && (
              <span className="num" title={syncStats.latest_sync_time ? `Last sync ${new Date(syncStats.latest_sync_time).toLocaleString()}` : ''}>
                {syncStats.total_events?.toLocaleString('en-US')} events
              </span>
            )}
            <span className="ml-auto flex items-center gap-1" title="Sync window in days">
              <input type="number" min="1" max="365" value={lookbackDays}
                onChange={(e) => setLookbackDays(parseInt(e.target.value))}
                className="field !w-14 !px-1.5 !py-1 text-center num" />
              d
            </span>
            <button onClick={handleSync} disabled={isSyncing} title="Sync now"
              className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-soft disabled:opacity-40 transition">
              <MdSync size={18} className={isSyncing ? 'animate-spin-reverse' : ''} />
            </button>
          </div>
          {availableCalendars === null ? (
            <div className={`${row} text-warn`}>Calendars failed to load</div>
          ) : availableCalendars.length === 0 ? (
            <div className={`${row} text-muted`}>…</div>
          ) : availableCalendars.map((avail) => {
            const connected = calendars.find(c => c.calendar_id === avail.calendar_id);
            return (
              <div key={avail.calendar_id} className={row}>
                <span className="truncate" title={avail.calendar_id}>{avail.name}</span>
                <span className="ml-auto">
                  <Toggle
                    checked={!!connected?.is_active}
                    onChange={() => connected
                      ? handleToggleCalendar(connected.id)
                      : handleAddCalendar(avail.calendar_id, avail.name)
                    }
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel p-3">
        <CategoryTree />
      </div>
    </div>
  );
}

export default Settings;
