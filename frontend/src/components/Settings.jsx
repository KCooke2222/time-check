import { useState, useEffect } from 'react';
import { settingsAPI, calendarAPI } from '../services/api';
import CategoryTree from './CategoryTree';
import { MdSync } from 'react-icons/md';

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}

function Settings() {
  const [activeTab, setActiveTab] = useState('general');
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
    return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>;
  }

  const tabs = ['general', 'categories', 'calendars'];
  const tabLabels = { general: 'General', categories: 'Categories', calendars: 'Calendars' };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {message && (
            <div className={`mb-4 px-4 py-2.5 rounded text-sm ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {message.text}
            </div>
          )}

          {/* General Tab */}
          {activeTab === 'general' && (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Event Duration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Hours</label>
                    <input
                      type="number" step="0.1" value={minHours}
                      onChange={(e) => setMinHours(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Hours</label>
                    <input
                      type="number" step="0.1" value={maxHours}
                      onChange={(e) => setMaxHours(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Timezone</h3>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Chicago">America/Chicago</option>
                  <option value="America/Denver">America/Denver</option>
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
                  <option value="America/Phoenix">America/Phoenix</option>
                  <option value="America/Toronto">America/Toronto</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="Europe/Paris">Europe/Paris</option>
                  <option value="Europe/Berlin">Europe/Berlin</option>
                  <option value="Asia/Tokyo">Asia/Tokyo</option>
                  <option value="Asia/Shanghai">Asia/Shanghai</option>
                  <option value="Australia/Sydney">Australia/Sydney</option>
                </select>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit" disabled={isSaving}
                  className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && <CategoryTree />}

          {/* Calendars Tab */}
          {activeTab === 'calendars' && (
            <div className="space-y-6">
              {/* Sync row: stats + manual sync combined */}
              <div className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3">
                <div className="flex items-center gap-6 text-sm text-gray-600">
                  {syncStats && (
                    <>
                      <span><span className="font-medium text-gray-900">{syncStats.total_events}</span> events</span>
                      {syncStats.latest_sync_time && (
                        <span>Last sync: <span className="font-medium text-gray-900">{new Date(syncStats.latest_sync_time).toLocaleString()}</span></span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min="1" max="365" value={lookbackDays}
                    onChange={(e) => setLookbackDays(parseInt(e.target.value))}
                    className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">days</span>
                  <button
                    onClick={handleSync} disabled={isSyncing}
                    title="Sync now"
                    className="p-1.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-200 disabled:opacity-40 transition"
                  >
                    <MdSync size={18} className={isSyncing ? 'animate-spin-reverse' : ''} />
                  </button>
                </div>
              </div>

              {/* Calendars list */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Calendars</h3>
                {availableCalendars === null ? (
                  <p className="text-red-500 text-sm">Failed to load calendars.</p>
                ) : availableCalendars.length === 0 ? (
                  <p className="text-gray-400 text-sm">Loading calendars...</p>
                ) : (
                  <div className="space-y-1">
                    {availableCalendars.map((avail) => {
                      const connected = calendars.find(c => c.calendar_id === avail.calendar_id);
                      return (
                        <div key={avail.calendar_id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50">
                          <span className="text-sm font-medium text-gray-800">{avail.name}</span>
                          <Toggle
                            checked={!!connected?.is_active}
                            onChange={() => connected
                              ? handleToggleCalendar(connected.id)
                              : handleAddCalendar(avail.calendar_id, avail.name)
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
