import express from 'express';
import { supabaseRest } from '../lib/supabase-rest';
import { logger } from '../lib/logger';

const router = express.Router();

router.post('/public/contact', async (req, res) => {
  const { email, agents, conversations, estimated_spend } = req.body as {
    email?: string;
    agents?: number;
    conversations?: number;
    estimated_spend?: string;
  };

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    await supabaseRest('contact_leads', '', {
      method: 'POST',
      body: { email, agents, conversations, estimated_spend },
    });
    return res.json({ ok: true });
  } catch (err: any) {
    logger.error('contact-lead insert failed', { error: err?.message });
    return res.status(500).json({ error: 'Failed to save contact' });
  }
});

export default router;
