// apps/web/src/app/admin/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';

interface PlatformSettings {
  platformFeeDirect: number;
  platformFeeDelegated: number;
  platformFeeCex: number;
  delegatedMinUsd: number;
  delegatedMaxUsd: number;
  cexThresholdUsd: number;
  adPlatformFeePercent: number;
  minAdBookingDays: number;
  maxAdBookingDays: number;
  requireAdApproval: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>({
    platformFeeDirect: 0.4,
    platformFeeDelegated: 1.0,
    platformFeeCex: 1.0,
    delegatedMinUsd: 10,
    delegatedMaxUsd: 500000,
    cexThresholdUsd: 100,
    adPlatformFeePercent: 50,
    minAdBookingDays: 1,
    maxAdBookingDays: 365,
    requireAdApproval: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // In production: PUT /api/admin/settings
      await new Promise((r) => setTimeout(r, 1000));
      localStorage.setItem('platform_settings', JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Settings</h1>

      {/* Swap Fees */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Swap Fees</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Direct Route (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={settings.platformFeeDirect}
              onChange={(e) => setSettings({ ...settings, platformFeeDirect: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gasless Route (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={settings.platformFeeDelegated}
              onChange={(e) => setSettings({ ...settings, platformFeeDelegated: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              CEX Route (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={settings.platformFeeCex}
              onChange={(e) => setSettings({ ...settings, platformFeeCex: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Route Thresholds */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Route Thresholds</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gasless Min ($)
            </label>
            <input
              type="number"
              value={settings.delegatedMinUsd}
              onChange={(e) => setSettings({ ...settings, delegatedMinUsd: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gasless Max ($)
            </label>
            <input
              type="number"
              value={settings.delegatedMaxUsd}
              onChange={(e) => setSettings({ ...settings, delegatedMaxUsd: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              CEX Threshold ($)
            </label>
            <input
              type="number"
              value={settings.cexThresholdUsd}
              onChange={(e) => setSettings({ ...settings, cexThresholdUsd: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Ad Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Advertising</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Platform Fee (%)
            </label>
            <input
              type="number"
              value={settings.adPlatformFeePercent}
              onChange={(e) => setSettings({ ...settings, adPlatformFeePercent: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Min Booking (days)
            </label>
            <input
              type="number"
              value={settings.minAdBookingDays}
              onChange={(e) => setSettings({ ...settings, minAdBookingDays: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Max Booking (days)
            </label>
            <input
              type="number"
              value={settings.maxAdBookingDays}
              onChange={(e) => setSettings({ ...settings, maxAdBookingDays: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.requireAdApproval}
              onChange={(e) => setSettings({ ...settings, requireAdApproval: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Require manual approval for ads</span>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        {saved && (
          <span className="text-green-600 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved!
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2"
        >
          {isSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
