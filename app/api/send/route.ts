import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppText } from '../../../lib/whatsapp';
import { generatePersonalizedMessage } from '../../../lib/ai';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { contacts, messageTemplate, useAI, aiStyle } = await req.json();

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ success: false, error: 'No contacts provided', results: [] }, { status: 400 });
    }

    const results: Array<{ phone: string; name?: string; status: 'sent' | 'failed'; error?: string }> = [];

    for (const contact of contacts) {
      const phone = String(contact.phone || '').trim();
      const name = contact.name as string | undefined;
      if (!phone) {
        results.push({ phone: '', name, status: 'failed', error: 'Missing phone' });
        continue;
      }

      let body = messageTemplate;
      try {
        if (useAI) {
          body = await generatePersonalizedMessage({ baseTemplate: messageTemplate, contact, aiStyle: aiStyle || '' });
        } else {
          body = messageTemplate.replace(/\{\{(\w+)\}\}/g, (_, key) => String(contact[key] ?? ''));
        }
      } catch (e: any) {
        results.push({ phone, name, status: 'failed', error: e?.message || 'AI generation failed' });
        continue;
      }

      try {
        await sendWhatsAppText({ to: phone, body });
        results.push({ phone, name, status: 'sent' });
      } catch (e: any) {
        results.push({ phone, name, status: 'failed', error: e?.message || 'Send failed' });
      }

      // Small delay to avoid hitting rate limits aggressively
      await new Promise(r => setTimeout(r, 200));
    }

    const success = results.every(r => r.status === 'sent');
    return NextResponse.json({ success, results });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Unexpected error', results: [] }, { status: 500 });
  }
}
