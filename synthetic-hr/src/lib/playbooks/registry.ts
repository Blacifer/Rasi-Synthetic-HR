import {
  FileText,
  UserCheck,
  Users,
  LifeBuoy,
  Ticket,
  MessageSquareText,
  BookOpen,
  Bug,
  Mail,
  PhoneCall,
  Target,
  HandCoins,
  ShieldCheck,
  KeyRound,
  UserPlus,
  UserMinus,
  Siren,
  ClipboardList,
} from 'lucide-react';
import type { Playbook, PlaybookPack } from './types';

function textValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

export const PLAYBOOK_PACKS: PlaybookPack[] = [
  { id: 'hr', label: 'HR', description: 'Hiring, onboarding, people ops' },
  { id: 'support', label: 'Support', description: 'Tickets, escalation, knowledge base' },
  { id: 'sales', label: 'Sales', description: 'Qualification, outreach, deal support' },
  { id: 'it', label: 'IT', description: 'Access, incidents, change management' },
];

export const PLAYBOOKS: Playbook[] = [
  // =========================
  // HR
  // =========================
  {
    id: 'jd-generator',
    pack: 'hr',
    title: 'Job Description Generator',
    description: 'Create a structured JD with responsibilities, must-haves, nice-to-haves, and interview signals.',
    icon: FileText,
    recommendedAgentType: 'hr',
    fields: [
      { key: 'role_title', label: 'Role title', placeholder: 'e.g., Senior Backend Engineer', kind: 'text' },
      { key: 'level', label: 'Level', placeholder: 'e.g., L4 / Senior', kind: 'text' },
      { key: 'location', label: 'Location', placeholder: 'e.g., Chennai / Remote', kind: 'text' },
      { key: 'must_have', label: 'Must-have skills', placeholder: 'Comma-separated', kind: 'text' },
      { key: 'nice_to_have', label: 'Nice-to-have skills', placeholder: 'Comma-separated', kind: 'text' },
      { key: 'context', label: 'Team context', placeholder: 'Product, domain, stakeholders, constraints', kind: 'textarea' },
    ],
    buildJob: (input) => ({
      type: 'workflow_run',
      input: {
        workflow: {
          version: 1,
          steps: [
            {
              id: 'draft',
              kind: 'llm',
              temperature: 0.2,
              messages: [
                { role: 'system', content: 'You are an HR recruiter assistant. Produce structured, compliant, and role-appropriate job descriptions.' },
                {
                  role: 'user',
                  content:
                    `Create a job description.\n\n` +
                    `Role: ${textValue(input.role_title)}\n` +
                    `Level: ${textValue(input.level)}\n` +
                    `Location: ${textValue(input.location)}\n` +
                    `Must-have: ${textValue(input.must_have)}\n` +
                    `Nice-to-have: ${textValue(input.nice_to_have)}\n\n` +
                    `Context:\n${textValue(input.context)}\n\n` +
                    `Output in this exact structure:\n` +
                    `1) Summary\n2) Responsibilities\n3) Must-have\n4) Nice-to-have\n5) Interview signals\n6) Compensation note (generic)\n7) EEO line (generic)\n`,
                },
              ],
            },
            {
              id: 'quality_check',
              kind: 'llm',
              temperature: 0.1,
              messages: [
                { role: 'system', content: 'You are a compliance and clarity reviewer. Fix issues and keep the same structure.' },
                { role: 'user', content: 'Review and improve this JD for clarity and bias, without removing required sections:\n\n{{steps.draft.message}}' },
              ],
            },
          ],
          final_step: 'quality_check',
        },
      },
    }),
  },
  {
    id: 'resume-screening',
    pack: 'hr',
    title: 'Resume Screening Summary',
    description: 'Summarize a resume against a JD and produce a decision-ready shortlist note.',
    icon: UserCheck,
    recommendedAgentType: 'hr',
    fields: [
      { key: 'job_description', label: 'Job description', placeholder: 'Paste JD here', kind: 'textarea' },
      { key: 'resume_text', label: 'Resume text', placeholder: 'Paste resume text here', kind: 'textarea' },
    ],
    buildJob: (input) => ({
      type: 'chat_turn',
      input: {
        messages: [
          { role: 'system', content: 'You are a talent acquisition analyst. Be concise and decision-useful.' },
          {
            role: 'user',
            content:
              `Compare the resume to the job description.\n\n` +
              `JOB DESCRIPTION:\n${textValue(input.job_description)}\n\n` +
              `RESUME:\n${textValue(input.resume_text)}\n\n` +
              `Output format:\n` +
              `- Fit score (0-10)\n- Strengths (3 bullets)\n- Gaps/Risks (3 bullets)\n- Interview focus areas (5 bullets)\n- Recommendation (Shortlist / Hold / Reject) + 2-line rationale\n`,
          },
        ],
        temperature: 0.2,
      },
    }),
  },
  {
    id: 'interview-kit',
    pack: 'hr',
    title: 'Interview Kit Builder',
    description: 'Generate interview questions and a scorecard aligned to the role.',
    icon: Users,
    recommendedAgentType: 'hr',
    fields: [
      { key: 'role_title', label: 'Role title', placeholder: 'e.g., Sales Manager', kind: 'text' },
      { key: 'job_description', label: 'Job description', placeholder: 'Paste JD here', kind: 'textarea' },
    ],
    buildJob: (input) => ({
      type: 'workflow_run',
      input: {
        workflow: {
          version: 1,
          steps: [
            {
              id: 'questions',
              kind: 'llm',
              temperature: 0.2,
              messages: [
                { role: 'system', content: 'You are an interviewer. Create strong, non-leading, role-relevant questions.' },
                { role: 'user', content: `Role: ${textValue(input.role_title)}\n\nJD:\n${textValue(input.job_description)}\n\nCreate 12 questions grouped by competency with expected signals.` },
              ],
            },
            {
              id: 'scorecard',
              kind: 'llm',
              temperature: 0.1,
              messages: [
                { role: 'system', content: 'You create structured hiring scorecards.' },
                { role: 'user', content: 'Create a scorecard rubric (0-4 scale) aligned to these questions:\n\n{{steps.questions.message}}' },
              ],
            },
          ],
          final_step: 'scorecard',
        },
      },
    }),
  },

  // =========================
  // Support
  // =========================
  {
    id: 'support-ticket-triage',
    pack: 'support',
    title: 'Ticket Triage + Priority',
    description: 'Classify a ticket, assign priority, and suggest next action and routing.',
    icon: Ticket,
    recommendedAgentType: 'support',
    fields: [
      { key: 'ticket_text', label: 'Ticket text', placeholder: 'Paste ticket text (customer + context)', kind: 'textarea' },
      { key: 'product_context', label: 'Product context', placeholder: 'Modules, SLAs, constraints', kind: 'textarea' },
    ],
    buildJob: (input) => ({
      type: 'workflow_run',
      input: {
        workflow: {
          version: 1,
          steps: [
            {
              id: 'triage',
              kind: 'llm',
              temperature: 0.2,
              messages: [
                { role: 'system', content: 'You are a support operations triage assistant. Be concrete and action-oriented.' },
                {
                  role: 'user',
                  content:
                    `Triage this ticket.\n\nTICKET:\n${textValue(input.ticket_text)}\n\nCONTEXT:\n${textValue(input.product_context)}\n\n` +
                    `Return JSON with keys: category, severity, priority, customer_impact, routing_team, tags[], next_questions[], suggested_next_steps[]\n`,
                },
              ],
            },
          ],
          final_step: 'triage',
        },
      },
    }),
  },
  {
    id: 'support-first-response',
    pack: 'support',
    title: 'First Response Draft',
    description: 'Draft a helpful first reply plus clarifying questions and SLA-safe phrasing.',
    icon: MessageSquareText,
    recommendedAgentType: 'support',
    fields: [
      { key: 'ticket_text', label: 'Ticket text', placeholder: 'Paste customer message', kind: 'textarea' },
      { key: 'tone', label: 'Tone', placeholder: 'e.g., friendly, concise, formal', kind: 'text' },
    ],
    buildJob: (input) => ({
      type: 'chat_turn',
      input: {
        messages: [
          { role: 'system', content: 'You are a customer support agent. Never promise timelines; ask precise clarifying questions.' },
          {
            role: 'user',
            content:
              `Draft the first response.\n\nCustomer:\n${textValue(input.ticket_text)}\n\nTone: ${textValue(input.tone)}\n\n` +
              `Output:\n- Reply (email-ready)\n- Clarifying questions (bullets)\n- Internal notes (bullets)\n`,
          },
        ],
        temperature: 0.3,
      },
    }),
  },
  {
    id: 'support-escalation-summary',
    pack: 'support',
    title: 'Escalation Summary (L2/Engineering)',
    description: 'Summarize issue, reproduction, suspected component, and data needed for escalation.',
    icon: Bug,
    recommendedAgentType: 'support',
    fields: [
      { key: 'ticket_text', label: 'Ticket text', placeholder: 'Customer + support notes', kind: 'textarea' },
      { key: 'observations', label: 'Observations', placeholder: 'What you tried, logs, environment', kind: 'textarea' },
    ],
    buildJob: (input) => ({
      type: 'workflow_run',
      input: {
        workflow: {
          version: 1,
          steps: [
            {
              id: 'summary',
              kind: 'llm',
              temperature: 0.2,
              messages: [
                { role: 'system', content: 'You write crisp engineering escalation notes.' },
                {
                  role: 'user',
                  content:
                    `Create an escalation summary.\n\nTICKET:\n${textValue(input.ticket_text)}\n\nOBSERVATIONS:\n${textValue(input.observations)}\n\n` +
                    `Format:\n- Impact\n- Steps to reproduce\n- Expected vs actual\n- Environment\n- Logs/IDs needed\n- Suspected component\n- Suggested next debugging steps\n`,
                },
              ],
            },
          ],
          final_step: 'summary',
        },
      },
    }),
  },
  {
    id: 'support-kb-draft',
    pack: 'support',
    title: 'Knowledge Base Article Draft',
    description: 'Turn a resolved issue into a customer-ready KB article and internal runbook snippet.',
    icon: BookOpen,
    recommendedAgentType: 'support',
    fields: [
      { key: 'issue', label: 'Issue', placeholder: 'What was the issue?', kind: 'textarea' },
      { key: 'resolution', label: 'Resolution', placeholder: 'What fixed it?', kind: 'textarea' },
    ],
    buildJob: (input) => ({
      type: 'workflow_run',
      input: {
        workflow: {
          version: 1,
          steps: [
            {
              id: 'draft',
              kind: 'llm',
              temperature: 0.2,
              messages: [
                { role: 'system', content: 'You create clear, step-by-step help center articles.' },
                {
                  role: 'user',
                  content:
                    `Write a KB article.\n\nISSUE:\n${textValue(input.issue)}\n\nRESOLUTION:\n${textValue(input.resolution)}\n\n` +
                    `Include: Summary, Symptoms, Cause (if known), Resolution steps, Prevention, FAQ, Internal runbook notes.\n`,
                },
              ],
            },
          ],
          final_step: 'draft',
        },
      },
    }),
  },

  // =========================
  // Sales
  // =========================
  {
    id: 'sales-lead-qualification',
    pack: 'sales',
    title: 'Lead Qualification (ICP Fit)',
    description: 'Score a lead against ICP and suggest next step and discovery questions.',
    icon: Target,
    recommendedAgentType: 'sales',
    fields: [
      { key: 'lead_details', label: 'Lead details', placeholder: 'Company, role, use-case, signals', kind: 'textarea' },
      { key: 'icp', label: 'ICP definition', placeholder: 'Ideal customer profile', kind: 'textarea' },
    ],
    buildJob: (input) => ({
      type: 'workflow_run',
      input: {
        workflow: {
          version: 1,
          steps: [
            {
              id: 'qualify',
              kind: 'llm',
              temperature: 0.2,
              messages: [
                { role: 'system', content: 'You are a sales development analyst. Be decisive and structured.' },
                {
                  role: 'user',
                  content:
                    `Evaluate ICP fit.\n\nLEAD:\n${textValue(input.lead_details)}\n\nICP:\n${textValue(input.icp)}\n\n` +
                    `Output:\n- Fit score (0-10)\n- Why (bullets)\n- Risks (bullets)\n- Next step (one)\n- Discovery questions (8 bullets)\n`,
                },
              ],
            },
          ],
          final_step: 'qualify',
        },
      },
    }),
  },
  {
    id: 'sales-outreach-sequence',
    pack: 'sales',
    title: 'Outreach Sequence (3 emails)',
    description: 'Draft a 3-touch email sequence with personalization slots and subject lines.',
    icon: Mail,
    recommendedAgentType: 'sales',
    fields: [
      { key: 'lead_details', label: 'Lead details', placeholder: 'Company, person, role, context', kind: 'textarea' },
      { key: 'value_prop', label: 'Value proposition', placeholder: 'What you sell and why it matters', kind: 'textarea' },
      { key: 'tone', label: 'Tone', placeholder: 'e.g., consultative, direct', kind: 'text' },
    ],
    buildJob: (input) => ({
      type: 'workflow_run',
      input: {
        workflow: {
          version: 1,
          steps: [
            {
              id: 'sequence',
              kind: 'llm',
              temperature: 0.3,
              messages: [
                { role: 'system', content: 'You write concise B2B outbound emails. Avoid hype and keep to 100-140 words.' },
                {
                  role: 'user',
                  content:
                    `Create a 3-email sequence.\n\nLEAD:\n${textValue(input.lead_details)}\n\nVALUE PROP:\n${textValue(input.value_prop)}\n\nTone: ${textValue(input.tone)}\n\n` +
                    `For each email output: Subject, Body, Personalization slots.\n`,
                },
              ],
            },
          ],
          final_step: 'sequence',
        },
      },
    }),
  },
  {
    id: 'sales-call-notes',
    pack: 'sales',
    title: 'Call Notes → CRM Fields',
    description: 'Turn meeting notes into structured CRM fields and next steps.',
    icon: PhoneCall,
    recommendedAgentType: 'sales',
    fields: [
      { key: 'notes', label: 'Call/meeting notes', placeholder: 'Paste notes', kind: 'textarea' },
      { key: 'crm_fields', label: 'CRM fields (optional)', placeholder: 'e.g., budget, timeline, stakeholders', kind: 'text' },
    ],
    buildJob: (input) => ({
      type: 'workflow_run',
      input: {
        workflow: {
          version: 1,
          steps: [
            {
              id: 'normalize',
              kind: 'llm',
              temperature: 0.2,
              messages: [
                { role: 'system', content: 'You are a sales ops assistant. Output structured, copy-pasteable fields.' },
                {
                  role: 'user',
                  content:
                    `Convert notes into CRM-ready fields.\n\nNOTES:\n${textValue(input.notes)}\n\nPreferred fields: ${textValue(input.crm_fields)}\n\n` +
                    `Output:\n- Summary\n- Pain\n- Current solution\n- Stakeholders\n- Budget\n- Timeline\n- Next steps\n- Risks\n`,
                },
              ],
            },
          ],
          final_step: 'normalize',
        },
      },
    }),
  },
  {
    id: 'sales-discount-memo',
    pack: 'sales',
    title: 'Discount/Exception Memo (Approval)',
    description: 'Generate a discount justification memo for approval workflows.',
    icon: HandCoins,
    recommendedAgentType: 'sales',
    fields: [
      { key: 'deal_context', label: 'Deal context', placeholder: 'Deal size, stage, competition, risk', kind: 'textarea' },
      { key: 'request', label: 'Exception request', placeholder: 'Discount %, terms, special asks', kind: 'textarea' },
    ],
    buildJob: (input) => ({
      type: 'chat_turn',
      input: {
        messages: [
          { role: 'system', content: 'You are a sales finance assistant. Write concise approval memos with clear tradeoffs.' },
          {
            role: 'user',
            content:
              `Create an exception memo.\n\nDEAL:\n${textValue(input.deal_context)}\n\nREQUEST:\n${textValue(input.request)}\n\n` +
              `Format:\n- Ask\n- Business justification\n- Risks\n- Alternatives considered\n- Guardrails\n- Recommendation\n`,
          },
        ],
        temperature: 0.2,
      },
    }),
  },

  // =========================
  // IT
  // =========================
  {
    id: 'it-access-evaluator',
    pack: 'it',
    title: 'Access Request Evaluator',
    description: 'Recommend least-privilege access, approvals needed, and risks.',
    icon: KeyRound,
    recommendedAgentType: 'it',
    fields: [
      { key: 'request', label: 'Access request', placeholder: 'Who needs access, what system, why, duration', kind: 'textarea' },
      { key: 'policy', label: 'Policy constraints', placeholder: 'Access policy, compliance requirements', kind: 'textarea' },
    ],
    buildJob: (input) => ({
      type: 'workflow_run',
      input: {
        workflow: {
          version: 1,
          steps: [
            {
              id: 'review',
              kind: 'llm',
              temperature: 0.2,
              messages: [
                { role: 'system', content: 'You are an IT access governance reviewer. Default to least privilege and time-bound access.' },
                {
                  role: 'user',
                  content:
                    `Evaluate this access request.\n\nREQUEST:\n${textValue(input.request)}\n\nPOLICY:\n${textValue(input.policy)}\n\n` +
                    `Output:\n- Recommended access (roles/permissions)\n- Time bound (duration)\n- Approvals required\n- Risks\n- Audit notes\n`,
                },
              ],
            },
          ],
          final_step: 'review',
        },
      },
    }),
  },
  {
    id: 'it-onboarding-checklist',
    pack: 'it',
    title: 'Onboarding Checklist (IT)',
    description: 'Generate a role-based IT onboarding checklist with owners.',
    icon: UserPlus,
    recommendedAgentType: 'it',
    fields: [
      { key: 'role', label: 'Employee role', placeholder: 'e.g., Backend Engineer', kind: 'text' },
      { key: 'access_needs', label: 'Access needs', placeholder: 'Systems/tools required', kind: 'textarea' },
    ],
    buildJob: (input) => ({
      type: 'chat_turn',
      input: {
        messages: [
          { role: 'system', content: 'You are an IT onboarding coordinator. Output checklists with owners and dependencies.' },
          {
            role: 'user',
            content:
              `Create an IT onboarding checklist.\n\nRole: ${textValue(input.role)}\n\nAccess needs:\n${textValue(input.access_needs)}\n\n` +
              `Output as:\n- Day 0\n- Day 1\n- Week 1\nEach item: task, owner (IT/Manager/Security), dependency.\n`,
          },
        ],
        temperature: 0.2,
      },
    }),
  },
  {
    id: 'it-offboarding-checklist',
    pack: 'it',
    title: 'Offboarding Checklist (IT)',
    description: 'Generate a safe offboarding checklist including access removal and data handover.',
    icon: UserMinus,
    recommendedAgentType: 'it',
    fields: [
      { key: 'employee_context', label: 'Employee context', placeholder: 'Role, systems, repos, devices', kind: 'textarea' },
      { key: 'last_day', label: 'Last working day', placeholder: 'YYYY-MM-DD', kind: 'text' },
    ],
    buildJob: (input) => ({
      type: 'workflow_run',
      input: {
        workflow: {
          version: 1,
          steps: [
            {
              id: 'plan',
              kind: 'llm',
              temperature: 0.2,
              messages: [
                { role: 'system', content: 'You are an IT offboarding specialist. Be exhaustive and security-first.' },
                {
                  role: 'user',
                  content:
                    `Create an offboarding plan.\n\nEmployee:\n${textValue(input.employee_context)}\n\nLast day: ${textValue(input.last_day)}\n\n` +
                    `Include: Access removal, device collection, data transfer, shared accounts, monitoring, and confirmation checklist.\n`,
                },
              ],
            },
          ],
          final_step: 'plan',
        },
      },
    }),
  },
  {
    id: 'it-incident-summary',
    pack: 'it',
    title: 'Incident Timeline Summary',
    description: 'Summarize an incident into an executive-ready timeline + follow-ups.',
    icon: Siren,
    recommendedAgentType: 'it',
    fields: [
      { key: 'raw_notes', label: 'Raw incident notes', placeholder: 'Paste timeline notes, messages, logs', kind: 'textarea' },
      { key: 'impact', label: 'Impact (optional)', placeholder: 'Users affected, downtime, scope', kind: 'textarea' },
    ],
    buildJob: (input) => ({
      type: 'workflow_run',
      input: {
        workflow: {
          version: 1,
          steps: [
            {
              id: 'timeline',
              kind: 'llm',
              temperature: 0.2,
              messages: [
                { role: 'system', content: 'You produce incident summaries (postmortem-lite) with timelines and actions.' },
                {
                  role: 'user',
                  content:
                    `Summarize this incident.\n\nNOTES:\n${textValue(input.raw_notes)}\n\nIMPACT:\n${textValue(input.impact)}\n\n` +
                    `Output:\n- Summary\n- Impact\n- Timeline (with timestamps if present)\n- Root cause (if known)\n- Fix\n- Follow-ups (owners)\n`,
                },
              ],
            },
          ],
          final_step: 'timeline',
        },
      },
    }),
  },

  // Placeholder connector-action example (kept explicit so it stands out)
  {
    id: 'it-create-access-ticket',
    pack: 'it',
    title: 'Create Access Ticket (Connector Action)',
    description: 'Creates an access request ticket in your internal tools (requires connector implementation).',
    icon: ClipboardList,
    recommendedAgentType: 'it',
    fields: [
      { key: 'request', label: 'Request details', placeholder: 'Who, what, why, duration', kind: 'textarea' },
    ],
    buildJob: (input) => ({
      type: 'connector_action',
      input: {
        connector: {
          service: 'internal',
          action: 'it.access_request.create',
          payload: {
            subject: 'Access request',
            requested_access: { request: textValue(input.request) },
            justification: textValue(input.request),
          },
        },
      },
    }),
  },
  {
    id: 'support-create-ticket',
    pack: 'support',
    title: 'Create Support Ticket (Connector Action)',
    description: 'Creates a support ticket inside the app from a customer message (requires approval).',
    icon: LifeBuoy,
    recommendedAgentType: 'support',
    fields: [
      { key: 'title', label: 'Title', placeholder: 'Short ticket title', kind: 'text' },
      { key: 'ticket_text', label: 'Customer message', placeholder: 'Paste customer message', kind: 'textarea' },
      { key: 'priority', label: 'Priority', placeholder: 'low / medium / high / urgent', kind: 'text' },
      { key: 'customer_email', label: 'Customer email (optional)', placeholder: 'name@company.com', kind: 'text' },
    ],
    buildJob: (input) => ({
      type: 'connector_action',
      input: {
        connector: {
          service: 'internal',
          action: 'support.ticket.create',
          payload: {
            title: textValue(input.title) || 'Support ticket',
            description: textValue(input.ticket_text),
            priority: textValue(input.priority) || 'medium',
            customer_email: textValue(input.customer_email) || undefined,
            tags: ['created_by_agent'],
          },
        },
      },
    }),
  },
  {
    id: 'sales-create-lead',
    pack: 'sales',
    title: 'Create Sales Lead (Connector Action)',
    description: 'Creates a lead inside the app CRM-lite (requires approval).',
    icon: ShieldCheck,
    recommendedAgentType: 'sales',
    fields: [
      { key: 'company_name', label: 'Company', placeholder: 'Company name', kind: 'text' },
      { key: 'contact_name', label: 'Contact name (optional)', placeholder: 'Person name', kind: 'text' },
      { key: 'contact_email', label: 'Contact email (optional)', placeholder: 'name@company.com', kind: 'text' },
      { key: 'notes', label: 'Notes', placeholder: 'Context, source, needs', kind: 'textarea' },
    ],
    buildJob: (input) => ({
      type: 'connector_action',
      input: {
        connector: {
          service: 'internal',
          action: 'sales.lead.create',
          payload: {
            company_name: textValue(input.company_name) || 'Lead',
            contact_name: textValue(input.contact_name) || undefined,
            contact_email: textValue(input.contact_email) || undefined,
            notes: { notes: textValue(input.notes) },
            stage: 'new',
            score: 0,
            tags: ['created_by_agent'],
          },
        },
      },
    }),
  },
];
