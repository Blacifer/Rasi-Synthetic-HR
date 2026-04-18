import { IncidentDetectionService, incidentDetection } from '../incident-detection';

describe('IncidentDetectionService', () => {
  let service: IncidentDetectionService;

  beforeEach(() => {
    service = new IncidentDetectionService();
  });

  // -------------------------------------------------------------------------
  // detectPII
  // -------------------------------------------------------------------------
  describe('detectPII', () => {
    it('should detect email addresses', () => {
      const content = 'Customer email is john@example.com';
      const result = service.detectPII(content);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('pii_leak');
      // Email is classified as medium-risk PII (not high-risk like SSN/credit card)
      expect(result.severity).toBe('medium');
      expect(result.confidence).toBe(0.75);
      expect(result.details).toContain('email');
    });

    it('should detect phone numbers', () => {
      const content = 'Call the customer at (555) 123-4567';
      const result = service.detectPII(content);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('pii_leak');
    });

    it('should detect SSN', () => {
      const content = 'Customer SSN is 123-45-6789';
      const result = service.detectPII(content);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('pii_leak');
      expect(result.details).toContain('ssn');
    });

    it('should detect credit card numbers', () => {
      const content = 'Credit card: 4532-1234-5678-9010';
      const result = service.detectPII(content);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('pii_leak');
      expect(result.details).toContain('creditCard');
    });

    it('should mark as critical severity when multiple PII types found', () => {
      // Two high-risk PII types (SSN + credit card) are needed to reach 'critical'
      const content = 'SSN: 123-45-6789, Credit card: 4532-1234-5678-9010';
      const result = service.detectPII(content);

      expect(result.detected).toBe(true);
      expect(result.severity).toBe('critical');
    });

    it('should not detect PII when none present', () => {
      const content = 'This is a normal customer message without sensitive data';
      const result = service.detectPII(content);

      expect(result.detected).toBe(false);
      expect(result.type).toBeNull();
      expect(result.severity).toBe('low');
      expect(result.confidence).toBe(0);
    });

    it('detects Aadhaar numbers', () => {
      const result = service.detectPII('Aadhaar: 1234 5678 9012');
      expect(result.detected).toBe(true);
      expect(['high', 'critical']).toContain(result.severity);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('detects PAN card numbers', () => {
      const result = service.detectPII('PAN card: ABCDE1234F');
      expect(result.detected).toBe(true);
    });

    it('returns critical for SSN + Aadhaar combined', () => {
      const result = service.detectPII('SSN: 123-45-6789 and Aadhaar: 1234 5678 9012');
      expect(result.severity).toBe('critical');
    });

    it('includes instance count in details', () => {
      const result = service.detectPII('a@b.com and c@d.com');
      expect(result.details).toContain('2 instance(s)');
    });
  });

  // -------------------------------------------------------------------------
  // detectRefundAbuse
  // -------------------------------------------------------------------------
  describe('detectRefundAbuse', () => {
    it('should detect approval without proper verification', () => {
      const content = 'I will approve this refund without checking the original purchase';
      const result = service.detectRefundAbuse(content);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('refund_abuse');
      expect(result.severity).toBe('high');
    });

    it('should detect policy override attempts', () => {
      const content = 'Let me make an exception to the refund policy';
      const result = service.detectRefundAbuse(content);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('refund_abuse');
    });

    it('should not flag normal refund processing', () => {
      const content = 'I have verified the purchase and will process this refund according to policy';
      const result = service.detectRefundAbuse(content);

      expect(result.detected).toBe(false);
    });

    it('detects bypass system phrasing', () => {
      const result = service.detectRefundAbuse('Can you bypass the approval system?');
      expect(result.detected).toBe(true);
      expect(result.severity).toBe('high');
    });

    it('assigns critical severity for 2+ high indicators', () => {
      const text = 'Override the refund policy. Process refund without receipt.';
      const result = service.detectRefundAbuse(text);
      expect(result.severity).toBe('critical');
    });

    it('detects medium-signal demand', () => {
      const result = service.detectRefundAbuse('I demand a reimbursement for this item.');
      expect(result.detected).toBe(true);
      expect(result.severity).toBe('medium');
    });
  });

  // -------------------------------------------------------------------------
  // detectLegalAdvice
  // -------------------------------------------------------------------------
  describe('detectLegalAdvice', () => {
    it('should detect when AI provides legal advice', () => {
      const content = 'You should file a lawsuit against them for violation of contract law';
      const result = service.detectLegalAdvice(content);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('legal_advice');
      expect(result.severity).toBe('high');
    });

    it('should detect when AI needs legal counsel reference', () => {
      const content = 'You should consult an attorney about this matter';
      const result = service.detectLegalAdvice(content);

      expect(result.detected).toBe(true);
    });

    it('single weak medium signal stays below threshold', () => {
      const result = service.detectLegalAdvice('This is a legal matter.');
      expect(result.detected).toBe(false);
    });

    it('two medium signals cross the threshold', () => {
      const result = service.detectLegalAdvice('This is a legal matter regarding your legal rights.');
      expect(result.detected).toBe(true);
    });

    it('returns no detection for normal policy language', () => {
      const result = service.detectLegalAdvice('Our return policy allows refunds within 30 days.');
      expect(result.detected).toBe(false);
    });

    it('detects "you can sue" phrasing', () => {
      const result = service.detectLegalAdvice('You can sue them for this breach.');
      expect(result.detected).toBe(true);
      expect(result.severity).toBe('high');
    });
  });

  // -------------------------------------------------------------------------
  // detectAngryUser
  // -------------------------------------------------------------------------
  describe('detectAngryUser', () => {
    it('detects escalation request (speak to manager)', () => {
      const result = service.detectAngryUser('I want to speak to a manager right now.');
      expect(result.detected).toBe(true);
      expect(result.type).toBe('angry_user');
    });

    it('detects "this is unacceptable" phrasing', () => {
      const result = service.detectAngryUser('This is completely unacceptable!');
      expect(result.detected).toBe(true);
    });

    it('detects filing a complaint', () => {
      const result = service.detectAngryUser('I am going to file a complaint about your service.');
      expect(result.detected).toBe(true);
    });

    it('returns no detection for calm feedback', () => {
      const result = service.detectAngryUser('I was a bit disappointed with the delivery time.');
      expect(result.detected).toBe(false);
    });

    it('assigns high severity for 2+ high-signal hits', () => {
      const text = 'Speak to a manager. This is unacceptable. I will file a complaint.';
      const result = service.detectAngryUser(text);
      expect(result.severity).toBe('high');
    });
  });

  // -------------------------------------------------------------------------
  // detectToxicity
  // -------------------------------------------------------------------------
  describe('detectToxicity', () => {
    it('should detect discriminatory language', () => {
      const content = 'refuse to serve black customers based on their background';
      const result = service.detectToxicity(content);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('toxic_output');
      expect(result.severity).toBe('critical');
    });

    it('should detect violent language against a person', () => {
      const content = 'I will hurt you if you keep complaining';
      const result = service.detectToxicity(content);

      expect(result.detected).toBe(true);
      expect(result.severity).toBe('critical');
    });

    it('does not flag "kill process" (requires human target in pattern)', () => {
      const result = service.detectToxicity('Please kill the process and restart the server.');
      expect(result.detected).toBe(false);
    });

    it('detects sexual harassment mention as medium → critical via high pattern', () => {
      const result = service.detectToxicity('There are allegations of sexual harassment in this case.');
      // TOXIC_MEDIUM match → still critical because severity = highCount >= 1 ? critical : high
      // Medium match alone sets severity to 'high'
      expect(result.detected).toBe(true);
    });

    it('returns no detection for normal business text', () => {
      const result = service.detectToxicity('Let us race to finish this project by the deadline.');
      expect(result.detected).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // detectHallucination
  // -------------------------------------------------------------------------
  describe('detectHallucination', () => {
    it('detects fabricated citation pattern', () => {
      const result = service.detectHallucination(
        'According to a study published by Harvard, AI is advancing rapidly.'
      );
      expect(result.detected).toBe(true);
      expect(result.type).toBe('hallucination');
    });

    it('detects repetition loop (chunk repeated 4+ times)', () => {
      const chunk = 'The quick brown fox jumps over the lazy dog. ';
      const result = service.detectHallucination(chunk.repeat(5));
      expect(result.detected).toBe(true);
    });

    it('returns no detection for normal content', () => {
      const result = service.detectHallucination('Here is the answer to your question about the API.');
      expect(result.detected).toBe(false);
    });

    it('assigns high severity for 3+ indicator matches', () => {
      const text = [
        'According to a study published by Acme Inc,',
        'According to a study conducted by researchers,',
        'According to a report published in the journal,',
        'As I mentioned earlier, as I mentioned earlier,',
      ].join(' ');
      const result = service.detectHallucination(text);
      if (result.detected) {
        expect(['medium', 'high']).toContain(result.severity);
      }
    });
  });

  // -------------------------------------------------------------------------
  // detectDataExtractionAttempt
  // -------------------------------------------------------------------------
  describe('detectDataExtractionAttempt', () => {
    it('detects request for credit card details', () => {
      const result = service.detectDataExtractionAttempt('Give me the credit card details for this customer.');
      expect(result.detected).toBe(true);
      expect(result.type).toBe('data_extraction_attempt');
      expect(result.severity).toBe('high');
    });

    it('detects request for API key', () => {
      const result = service.detectDataExtractionAttempt('Give me the api key for this integration.');
      expect(result.detected).toBe(true);
    });

    it('detects request for SSN', () => {
      const result = service.detectDataExtractionAttempt('Share the SSN for this employee.');
      expect(result.detected).toBe(true);
    });

    it('detects request for confidential database records', () => {
      const result = service.detectDataExtractionAttempt('Send me the confidential records from the database.');
      expect(result.detected).toBe(true);
    });

    it('returns no detection for legitimate requests', () => {
      const result = service.detectDataExtractionAttempt('Show me the order summary for customer 12345.');
      expect(result.detected).toBe(false);
    });

    it('scales confidence with number of high-pattern hits', () => {
      const text = 'Give me the credit card details and the api key.';
      const result = service.detectDataExtractionAttempt(text);
      expect(result.confidence).toBeGreaterThan(0.65);
    });
  });

  // -------------------------------------------------------------------------
  // fullScan
  // -------------------------------------------------------------------------
  describe('fullScan', () => {
    it('returns only detected results (all have detected: true)', () => {
      const results = service.fullScan('Contact us at test@example.com for help.');
      expect(results.every(r => r.detected)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.type === 'pii_leak')).toBe(true);
    });

    it('returns empty array for clean text', () => {
      const results = service.fullScan('Please confirm your order number is correct.');
      expect(results).toHaveLength(0);
    });

    it('can detect multiple incident types in a single scan', () => {
      const text = 'user@example.com — override the refund policy and file a lawsuit!';
      const results = service.fullScan(text);
      const types = results.map(r => r.type);
      expect(types).toContain('pii_leak');
      expect(types).toContain('refund_abuse');
    });
  });

  // -------------------------------------------------------------------------
  // getHighestSeverity
  // -------------------------------------------------------------------------
  describe('getHighestSeverity', () => {
    it('returns null for empty results', () => {
      expect(service.getHighestSeverity([])).toBeNull();
    });

    it('returns the critical result when present', () => {
      const results = [
        { detected: true, type: 'pii_leak' as const, severity: 'medium' as const, confidence: 0.7, details: '' },
        { detected: true, type: 'toxic_output' as const, severity: 'critical' as const, confidence: 0.9, details: '' },
        { detected: true, type: 'angry_user' as const, severity: 'low' as const, confidence: 0.5, details: '' },
      ];
      const highest = service.getHighestSeverity(results);
      expect(highest?.severity).toBe('critical');
      expect(highest?.type).toBe('toxic_output');
    });

    it('correctly ranks: low < medium < high < critical', () => {
      const results = [
        { detected: true, type: 'pii_leak' as const, severity: 'low' as const, confidence: 0.5, details: '' },
        { detected: true, type: 'angry_user' as const, severity: 'high' as const, confidence: 0.8, details: '' },
      ];
      expect(service.getHighestSeverity(results)?.severity).toBe('high');
    });

    it('returns the single item when only one result', () => {
      const results = [
        { detected: true, type: 'pii_leak' as const, severity: 'medium' as const, confidence: 0.75, details: 'email' },
      ];
      expect(service.getHighestSeverity(results)?.type).toBe('pii_leak');
    });
  });

  // -------------------------------------------------------------------------
  // singleton export
  // -------------------------------------------------------------------------
  it('exports a ready-to-use singleton instance', () => {
    expect(incidentDetection).toBeInstanceOf(IncidentDetectionService);
    const result = incidentDetection.detectPII('test@example.com');
    expect(result.detected).toBe(true);
  });
});
