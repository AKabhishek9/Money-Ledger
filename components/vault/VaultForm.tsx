'use client';

import { useState } from 'react';
import BottomSheet from '@/components/ui/BottomSheet';
import type { VaultType } from '@/lib/types';
import { VAULT_TEMPLATES } from '@/lib/types';

interface VaultFormProps {
  onSave: (type: VaultType, title: string, fields: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

export default function VaultForm({ onSave, onClose }: VaultFormProps) {
  const [step, setStep] = useState<'type' | 'form'>('type');
  const [selectedType, setSelectedType] = useState<VaultType | null>(null);
  const [title, setTitle] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleTypeSelect = (type: VaultType) => {
    setSelectedType(type);
    setTitle(VAULT_TEMPLATES[type].label);
    // Initialize fields
    const initial: Record<string, string> = {};
    VAULT_TEMPLATES[type].fields.forEach((f) => (initial[f] = ''));
    setFields(initial);
    setStep('form');
  };

  const handleSave = async () => {
    if (!selectedType || !title.trim()) return;
    setSaving(true);
    try {
      await onSave(selectedType, title.trim(), fields);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (step === 'type') {
    return (
      <BottomSheet title="Add to Vault" onClose={onClose}>
        <div className="p-4 grid grid-cols-2 gap-3">
          {(Object.entries(VAULT_TEMPLATES) as [VaultType, typeof VAULT_TEMPLATES[VaultType]][]).map(
            ([type, tmpl]) => (
              <button
                key={type}
                onClick={() => handleTypeSelect(type)}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all active:opacity-80"
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <span className="text-3xl">{tmpl.icon}</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {tmpl.label}
                </span>
              </button>
            )
          )}
        </div>
      </BottomSheet>
    );
  }

  const template = VAULT_TEMPLATES[selectedType!];

  return (
    <BottomSheet title={`Add ${template.label}`} onClose={onClose} height="full">
      <div className="p-4 flex flex-col gap-4">
        {/* Title */}
        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
            placeholder="e.g. HDFC Savings"
          />
        </div>

        {/* Dynamic fields */}
        {template.fields.map((fieldName) => (
          <div key={fieldName}>
            <label
              className="text-xs font-medium block mb-1.5"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {fieldName}
            </label>
            <input
              type={fieldName.toLowerCase().includes('number') ? 'text' : 'text'}
              value={fields[fieldName] || ''}
              onChange={(e) => setFields((prev) => ({ ...prev, [fieldName]: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none font-mono"
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
              placeholder={`Enter ${fieldName.toLowerCase()}`}
              autoComplete="off"
            />
          </div>
        ))}

        <p
          className="text-xs text-center"
          style={{ color: 'var(--color-text-dim)' }}
        >
          🔒 Stored securely in your account
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => setStep('type')}
            className="flex-1 py-3 rounded-xl text-sm font-medium"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
          >
            Back
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{
              background: saving || !title.trim() ? 'var(--color-text-dim)' : 'var(--color-accent)',
              color: 'var(--color-on-accent)',
            }}
          >
            {saving ? 'Saving…' : 'Save to Vault'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
