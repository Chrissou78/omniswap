// apps/web/src/app/admin/ads/slots/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AdSlot {
  id: string;
  name: string;
  position: string;
  width: number;
  height: number;
  pricePerDayUsd: number;
  isActive: boolean;
  _count: { bookings: number };
}

export default function AdSlotsPage() {
  const [slots, setSlots] = useState<AdSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState<AdSlot | null>(null);

  useEffect(() => {
    fetchSlots();
  }, []);

  const fetchSlots = async () => {
    try {
      const res = await fetch('/api/admin/ads/slots');
      if (res.ok) {
        setSlots(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/admin/ads/slots/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      setSlots(slots.map(s => s.id === id ? { ...s, isActive: !isActive } : s));
    } catch (error) {
      console.error('Failed to update slot:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ad Slots</h1>
        <button
          onClick={() => { setEditingSlot(null); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Slot
        </button>
      </div>

      {/* Slots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))
        ) : slots.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
            No ad slots configured
          </div>
        ) : (
          slots.map((slot) => (
            <div
              key={slot.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{slot.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{slot.position}</p>
                </div>
                <button
                  onClick={() => toggleActive(slot.id, slot.isActive)}
                  className={`px-2 py-1 text-xs rounded-full ${
                    slot.isActive
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {slot.isActive ? 'Active' : 'Inactive'}
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Size</span>
                  <span className="text-gray-900 dark:text-white">{slot.width} x {slot.height}px</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Price/Day</span>
                  <span className="text-gray-900 dark:text-white font-medium">${slot.pricePerDayUsd}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Bookings</span>
                  <span className="text-gray-900 dark:text-white">{slot._count.bookings}</span>
                </div>
              </div>

              <button
                onClick={() => { setEditingSlot(slot); setShowForm(true); }}
                className="mt-4 w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                Edit Slot
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <AdSlotForm
          slot={editingSlot}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); fetchSlots(); }}
        />
      )}
    </div>
  );
}

function AdSlotForm({
  slot,
  onClose,
  onSave,
}: {
  slot: AdSlot | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    name: slot?.name || '',
    position: slot?.position || '',
    width: slot?.width || 300,
    height: slot?.height || 250,
    pricePerDayUsd: slot?.pricePerDayUsd || 10,
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = slot ? `/api/admin/ads/slots/${slot.id}` : '/api/admin/ads/slots';
      const method = slot ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        onSave();
      }
    } catch (error) {
      console.error('Failed to save slot:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {slot ? 'Edit Ad Slot' : 'Add Ad Slot'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Swap Top Banner"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Position ID</label>
            <input
              type="text"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder="e.g., swap-top, swap-bottom, sidebar"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Width (px)</label>
              <input
                type="number"
                value={form.width}
                onChange={(e) => setForm({ ...form, width: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Height (px)</label>
              <input
                type="number"
                value={form.height}
                onChange={(e) => setForm({ ...form, height: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price per Day (USD)</label>
            <input
              type="number"
              step="0.01"
              value={form.pricePerDayUsd}
              onChange={(e) => setForm({ ...form, pricePerDayUsd: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : slot ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
