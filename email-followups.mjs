#!/usr/bin/env node
/**
 * email-followups.mjs
 *
 * Sends an email summary of urgent/overdue follow-ups using followup-cadence.mjs.
 *
 * Usage:
 *   node email-followups.mjs            # sends email (if configured)
 *   node email-followups.mjs --dry-run  # prints email subject/body, does not send
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

import dotenv from 'dotenv';
import yaml from 'js-yaml';
import nodemailer from 'nodemailer';

const ROOT = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(ROOT, '.env') });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function readProfileEmail() {
  const profilePath = join(ROOT, 'config', 'profile.yml');
  if (!existsSync(profilePath)) return null;
  const doc = yaml.load(readFileSync(profilePath, 'utf-8'));
  return doc?.candidate?.email || null;
}

function runCadence() {
  const json = execFileSync('node', [join(ROOT, 'followup-cadence.mjs')], { encoding: 'utf-8' });
  return JSON.parse(json);
}

function buildEmail(result) {
  const date = result?.metadata?.analysisDate || new Date().toISOString().slice(0, 10);
  const entries = Array.isArray(result?.entries) ? result.entries : [];
  const actionable = entries.filter(e => e.urgency === 'urgent' || e.urgency === 'overdue');

  const urgentCount = actionable.filter(e => e.urgency === 'urgent').length;
  const overdueCount = actionable.filter(e => e.urgency === 'overdue').length;

  const subject = `[career-ops] Follow-ups: ${urgentCount} urgent, ${overdueCount} overdue (${date})`;

  const lines = [];
  lines.push(`Follow-up summary — ${date}`);
  lines.push('');

  if (actionable.length === 0) {
    lines.push('No urgent or overdue follow-ups today.');
  } else {
    for (const e of actionable) {
      const contact = (e.contacts && e.contacts[0] && e.contacts[0].email) ? e.contacts[0].email : '-';
      const next = e.nextFollowupDate || '-';
      lines.push(`- [${String(e.num).padStart(3, '0')}] ${e.company} — ${e.role}`);
      lines.push(`  urgency: ${e.urgency} | status: ${e.status} | days since apply: ${e.daysSinceApplication} | followups: ${e.followupCount} | next: ${next}`);
      lines.push(`  contact: ${contact}`);
      if (e.reportPath) lines.push(`  report: ${e.reportPath}`);
    }
  }

  lines.push('');
  lines.push('Tip: run `node followup-cadence.mjs --summary` for the dashboard.');

  return { subject, text: lines.join('\n') };
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function main() {
  const result = runCadence();
  if (result?.error) {
    console.error(result.error);
    process.exit(1);
  }

  const { subject, text } = buildEmail(result);

  const profileEmail = readProfileEmail();
  const to = process.env.MAIL_TO || profileEmail;
  const from = process.env.MAIL_FROM || to;

  if (dryRun) {
    console.log(subject);
    console.log('');
    console.log(text);
    return;
  }

  // If no SMTP config, fail with a clear message (instead of silently doing nothing).
  const host = requireEnv('SMTP_HOST');
  const port = Number(requireEnv('SMTP_PORT'));
  const user = requireEnv('SMTP_USER');
  const pass = requireEnv('SMTP_PASS');
  if (!to) throw new Error('Missing recipient. Set MAIL_TO in .env or candidate.email in config/profile.yml');
  if (!from) throw new Error('Missing sender. Set MAIL_FROM in .env (or set MAIL_TO / candidate.email)');

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
  });

  console.log(`Sent follow-up summary to ${to}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

