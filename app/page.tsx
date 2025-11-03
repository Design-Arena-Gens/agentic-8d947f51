"use client";

import { useMemo, useState } from 'react';

type Contact = { name?: string; phone: string; [key: string]: string | undefined };

type SendResponse = {
  success: boolean;
  results: Array<{
    phone: string;
    name?: string;
    status: 'sent' | 'failed';
    error?: string;
  }>;
};

function parseCSV(text: string): Contact[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const first = lines[0];
  let headers: string[];
  let startIndex = 1;
  if (first.toLowerCase().includes('phone')) {
    headers = first.split(',').map(h => h.trim());
  } else {
    headers = ['phone'];
    startIndex = 0;
  }
  const idxPhone = headers.findIndex(h => h.toLowerCase() === 'phone');
  const idxName = headers.findIndex(h => h.toLowerCase() === 'name');
  return lines.slice(startIndex).map(line => {
    const cells = line.split(',').map(c => c.trim());
    const row: Contact = { phone: '' };
    headers.forEach((h, i) => {
      if (!h) return;
      row[h] = cells[i] ?? '';
    });
    if (idxPhone >= 0) row.phone = (cells[idxPhone] || '').replace(/[^\d+]/g, '');
    if (!row.phone && cells[0]) row.phone = (cells[0] || '').replace(/[^\d+]/g, '');
    if (idxName >= 0) row.name = cells[idxName];
    return row;
  }).filter(r => r.phone);
}

function applyTemplate(template: string, contact: Contact): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(contact[key] ?? ''));
}

export default function HomePage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [message, setMessage] = useState<string>('Hi {{name}}, just checking in via WhatsApp.');
  const [useAI, setUseAI] = useState<boolean>(false);
  const [aiStyle, setAiStyle] = useState<string>('Friendly, concise check-in');
  const [sending, setSending] = useState<boolean>(false);
  const [result, setResult] = useState<SendResponse | null>(null);
  const [tokenSet, setTokenSet] = useState<boolean>(false);

  const exampleCsv = useMemo(() => `name,phone\nAlex,+15551234567\nTaylor,+442071234567`, []);

  function loadFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setContacts(parseCSV(text));
    };
    reader.readAsText(file);
  }

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts, messageTemplate: message, useAI, aiStyle })
      });
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setResult({ success: false, results: contacts.map(c => ({ phone: c.phone, name: c.name, status: 'failed', error: e?.message || 'Unknown error' })) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="container">
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="h1">WhatsApp Broadcast Agent</h1>
          <span className="badge mono">Vercel-ready</span>
        </div>
        <p className="small">Upload contacts and send personalized WhatsApp messages. Variables like <span className="kbd">{{`{{name}}`}}</span> are supported.</p>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="grid" style={{ gap: 10 }}>
            <label>Contacts CSV</label>
            <input className="input" type="file" accept=".csv" onChange={e => e.target.files && loadFile(e.target.files[0])} />
            <div className="small">CSV with headers: <span className="mono">name,phone</span>. Example:</div>
            <pre className="mono" style={{ background: '#0c132b', border: '1px solid #25325f', padding: 10, borderRadius: 10 }}>{exampleCsv}</pre>
            <div className="row" style={{ alignItems: 'center' }}>
              <input className="input" placeholder="Add single number e.g. +15551234567" onKeyDown={e => {
                if (e.key === 'Enter') {
                  const value = (e.target as HTMLInputElement).value.trim();
                  if (value) setContacts(prev => [...prev, { phone: value }]);
                  (e.target as HTMLInputElement).value = '';
                }
              }} />
              <button onClick={() => setContacts([])} disabled={!contacts.length}>Clear</button>
            </div>
            <div className="small">Loaded: <strong>{contacts.length}</strong> contact(s)</div>
            {contacts.length > 0 && (
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Phone</th></tr>
                </thead>
                <tbody>
                  {contacts.slice(0, 5).map((c, i) => (
                    <tr key={i}><td>{c.name || '-'}</td><td className="mono">{c.phone}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="grid" style={{ gap: 10 }}>
            <label>Message</label>
            <textarea rows={7} value={message} onChange={e => setMessage(e.target.value)} placeholder="Hi {{name}}, ..." />

            <div className="row" style={{ alignItems: 'center' }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={useAI} onChange={e => setUseAI(e.target.checked)} />
                Use AI to personalize per contact
              </label>
            </div>

            {useAI && (
              <div className="grid" style={{ gap: 6 }}>
                <label>AI style instructions</label>
                <input className="input" value={aiStyle} onChange={e => setAiStyle(e.target.value)} placeholder="Tone and constraints" />
                <div className="small">Requires <span className="mono">OPENAI_API_KEY</span> set on server.</div>
              </div>
            )}

            <div>
              <div className="small" style={{ marginBottom: 8 }}>Preview for first contact:</div>
              <pre className="mono" style={{ background: '#0c132b', border: '1px solid #25325f', padding: 10, borderRadius: 10 }}>
                {contacts[0] ? applyTemplate(message, contacts[0]) : 'Load contacts to preview'}
              </pre>
            </div>

            <button onClick={handleSend} disabled={sending || contacts.length === 0}>
              {sending ? 'Sending?' : `Send to ${contacts.length} contact(s)`}
            </button>

            <div className="small" style={{ marginTop: 8 }}>
              Server requires <span className="mono">META_WA_ACCESS_TOKEN</span> and <span className="mono">META_WA_PHONE_NUMBER_ID</span> to be set.
            </div>
          </div>
        </div>
      </div>

      {result && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>Send results</strong>
            <span className="badge">{result.success ? 'Completed' : 'Finished with errors'}</span>
          </div>
          <table className="table" style={{ marginTop: 10 }}>
            <thead><tr><th>Name</th><th>Phone</th><th>Status</th><th>Error</th></tr></thead>
            <tbody>
              {result.results.map((r, i) => (
                <tr key={i}>
                  <td>{r.name || '-'}</td>
                  <td className="mono">{r.phone}</td>
                  <td className={r.status === 'sent' ? 'success' : 'error'}>{r.status}</td>
                  <td className="small">{r.error || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
