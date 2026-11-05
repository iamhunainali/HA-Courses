export const DEFAULT_CHECKOUT: any = {
  title: 'Secure checkout',
  intro: 'Complete your payment, then fill in the form below so our team can verify it.',
  instructions: 'Send the exact amount using one of the payment methods below, then submit the form with your transaction details.',
  securityNote: '🔒 Your details are encrypted in transit and visible only to our team.',
  methods: [
    { name: 'Bank transfer', details: 'Account title: Your Name\nAccount number: 0000 0000 0000\nBank: Your Bank' },
    { name: 'Easypaisa / JazzCash', details: 'Account title: Your Name\nNumber: 03XX XXXXXXX' },
  ],
  fields: [
    { key: 'name', label: 'Full name', type: 'text', required: true },
    { key: 'method', label: 'Payment method used', type: 'select', options: 'Bank transfer,Easypaisa,JazzCash', required: true },
    { key: 'txn', label: 'Transaction ID', type: 'text', required: true },
    { key: 'proof', label: 'Payment screenshot', type: 'file', required: true },
    { key: 'note', label: 'Note (optional)', type: 'textarea', required: false },
  ],
  terms: 'I confirm that the payment details above are correct.',
  buttonText: 'Submit payment request',
  reviewHours: 3,
  pendingTitle: 'Payment request received',
  pendingText: 'Our team is verifying your payment. You will get a notification as soon as your access is approved.',
  overdueText: 'This is taking longer than expected. Please contact support.',
};
