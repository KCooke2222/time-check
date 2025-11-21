import { useState, useEffect } from 'react';
import { settingsAPI, categoriesAPI, calendarAPI } from '../services/api';
import CategoryTreeManagerFinal from './CategoryTreeManagerFinal';

function Settings() {
  const [activeTab, setActiveTab] = useState('general'); // 'general', 'categories', 'calendars'
  const [settings, setSettings] = useState(null);
  const [calendars, setCalendars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [availableCalendars, setAvailableCalendars] = useState([]);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  const [syncStats, setSyncStats] = useState(null);
  const [lookbackDays, setLookbackDays] = useState(7);
  const [isSyncing, setIsSyncing] = useState(false);

  // General settings form
  const [minHours, setMinHours] = useState(0);
  const [maxHours, setMaxHours] = useState(16);
  const [blueMultiplier, setBlueMultiplier] = useState(0.75);
  const [greenMultiplier, setGreenMultiplier] = useState(1.0);
  const [redMultiplier, setRedMultiplier] = useState(1.25);
  const [timezone, setTimezone] = useState('UTC');

  useEffect(() => {
    loadSettings();
    loadCalendars();
    loadSyncStats();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await settingsAPI.get();
      setSettings(data);
      setMinHours(data.min_event_duration_hours);
      setMaxHours(data.max_event_duration_hours);
      setBlueMultiplier(data.intensity_multipliers.blue);
      setGreenMultiplier(data.intensity_multipliers.green);
      setRedMultiplier(data.intensity_multipliers.red);
      setTimezone(data.timezone || 'UTC');
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCalendars = async () => {
    try {
      const data = await calendarAPI.list();
      setCalendars(data.calendars);
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
      setMessage({
        type: 'success',
        text: `Synced ${result.stats.events_added} new, ${result.stats.events_updated} updated, ${result.stats.events_deleted} deleted`
      });
      await loadSyncStats();
    } catch (err) {
      console.error('Failed to sync:', err);
      setMessage({ type: 'error', text: 'Failed to sync calendars' });
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
        intensity_multipliers: {
          blue: parseFloat(blueMultiplier),
          green: parseFloat(greenMultiplier),
          red: parseFloat(redMultiplier),
        },
        timezone: timezone,
      });
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      await loadSettings();
    } catch (err) {
      console.error('Failed to save settings:', err);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetMultipliers = async () => {
    if (!confirm('Reset intensity multipliers to defaults?')) return;

    try {
      await settingsAPI.resetMultipliers();
      setMessage({ type: 'success', text: 'Multipliers reset to defaults' });
      await loadSettings();
    } catch (err) {
      console.error('Failed to reset multipliers:', err);
      setMessage({ type: 'error', text: 'Failed to reset multipliers' });
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
    if (!confirm('Delete this calendar? All its events will be removed.')) return;

    try {
      await calendarAPI.delete(calendarId);
      await loadCalendars();
    } catch (err) {
      console.error('Failed to delete calendar:', err);
    }
  };

  const handleDiscoverCalendars = async () => {
    try {
      const data = await calendarAPI.discover();
      setAvailableCalendars(data.calendars || []);
      setShowDiscoverModal(true);
    } catch (err) {
      console.error('Failed to discover calendars:', err);
      setMessage({ type: 'error', text: 'Failed to load available calendars' });
    }
  };

  const handleAddCalendar = async (calendarId, calendarName) => {
    try {
      await calendarAPI.add(calendarId, calendarName);
      await loadCalendars();
      setMessage({ type: 'success', text: 'Calendar added successfully!' });
      setShowDiscoverModal(false);
    } catch (err) {
      console.error('Failed to add calendar:', err);
      setMessage({ type: 'error', text: 'Failed to add calendar' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-xl text-gray-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('general')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'general'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              General Settings
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'categories'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Categories
            </button>
            <button
              onClick={() => setActiveTab('calendars')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'calendars'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Calendars
            </button>
          </nav>
        </div>

        <div className="p-6">
          {message && (
            <div
              className={`mb-4 px-4 py-3 rounded ${
                message.type === 'success'
                  ? 'bg-green-100 border border-green-400 text-green-700'
                  : 'bg-red-100 border border-red-400 text-red-700'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* General Settings Tab */}
          {activeTab === 'general' && (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Event Duration Filters
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Hours (exclude events shorter than)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={minHours}
                      onChange={(e) => setMinHours(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Hours (exclude events longer than)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={maxHours}
                      onChange={(e) => setMaxHours(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Timezone
                </h3>
                <div className="max-w-md">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Timezone (for week boundaries)
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                    <option value="America/Denver">America/Denver (MST/MDT)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                    <option value="America/Phoenix">America/Phoenix (MST - no DST)</option>
                    <option value="America/Toronto">America/Toronto (EST/EDT)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                    <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                    <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    This determines when weeks start/end in reports (Sunday 00:00:00 to Saturday 23:59:59 in your timezone).
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Intensity Multipliers
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Blue (Low Intensity)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={blueMultiplier}
                      onChange={(e) => setBlueMultiplier(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Green (Normal Intensity)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={greenMultiplier}
                      onChange={(e) => setGreenMultiplier(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Red (High Intensity)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={redMultiplier}
                      onChange={(e) => setRedMultiplier(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetMultipliers}
                  className="mt-4 text-sm text-blue-600 hover:text-blue-800"
                >
                  Reset to Defaults (0.75, 1.0, 1.25)
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && <CategoryTreeManagerFinal />}

          {/* Calendars Tab */}
          {activeTab === 'calendars' && (
            <div className="space-y-6">
              {/* Sync Stats */}
              {syncStats && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Sync Statistics</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Events:</span>
                      <span className="ml-2 font-semibold">{syncStats.total_events}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Oldest Event:</span>
                      <span className="ml-2 font-semibold">
                        {syncStats.oldest_event_date
                          ? new Date(syncStats.oldest_event_date).toLocaleDateString()
                          : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Last Sync:</span>
                      <span className="ml-2 font-semibold">
                        {syncStats.latest_sync_time
                          ? new Date(syncStats.latest_sync_time).toLocaleString()
                          : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Manual Sync */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Manual Sync</h3>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sync from how many days ago?
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={lookbackDays}
                      onChange={(e) => setLookbackDays(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 font-medium"
                  >
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Events from the past {lookbackDays} days will be synced from your connected calendars.
                </p>
              </div>

              {/* Connected Calendars */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Connected Calendars
                  </h3>
                  <button
                    onClick={handleDiscoverCalendars}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                  >
                    Add Calendar
                  </button>
                </div>
              </div>
              {calendars.length === 0 ? (
                <p className="text-gray-600">No calendars connected yet.</p>
              ) : (
                <div className="space-y-3">
                  {calendars.map((cal) => (
                    <div
                      key={cal.id}
                      className="flex justify-between items-center border border-gray-200 rounded p-4"
                    >
                      <div>
                        <h4 className="font-medium text-gray-800">{cal.name}</h4>
                        <p className="text-sm text-gray-600">{cal.calendar_id}</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleToggleCalendar(cal.id)}
                          className={`px-3 py-1 rounded text-sm font-medium ${
                            cal.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {cal.is_active ? 'Active' : 'Inactive'}
                        </button>
                        <button
                          onClick={() => handleDeleteCalendar(cal.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Discover Calendars Modal */}
              {showDiscoverModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-semibold text-gray-800">
                        Available Calendars
                      </h3>
                      <button
                        onClick={() => setShowDiscoverModal(false)}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                      >
                        &times;
                      </button>
                    </div>
                    {availableCalendars.length === 0 ? (
                      <p className="text-gray-600">No additional calendars found.</p>
                    ) : (
                      <div className="space-y-3">
                        {availableCalendars.map((cal) => (
                          <div
                            key={cal.calendar_id}
                            className="flex justify-between items-center border border-gray-200 rounded p-4"
                          >
                            <div>
                              <h4 className="font-medium text-gray-800">{cal.name}</h4>
                              <p className="text-sm text-gray-600">{cal.calendar_id}</p>
                              {cal.is_added && (
                                <span className="text-xs text-green-600 font-medium">Already added</span>
                              )}
                            </div>
                            <button
                              onClick={() => handleAddCalendar(cal.calendar_id, cal.name)}
                              disabled={cal.is_added}
                              className={`px-4 py-2 rounded font-medium ${
                                cal.is_added
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                            >
                              {cal.is_added ? 'Added' : 'Add'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
