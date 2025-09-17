// pages/delete-account.js
export default function DeleteAccount() {
  return (
    <div style={{
      maxWidth: '600px',
      margin: '50px auto',
      padding: '40px',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#f9fafb',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <h1 style={{ color: '#1f2937', marginBottom: '24px' }}>Delete Your Account</h1>
      
      <div style={{ backgroundColor: '#fef3f2', padding: '16px', borderRadius: '8px', border: '1px solid #fecaca', marginBottom: '24px' }}>
        <p style={{ color: '#dc2626', margin: 0, fontWeight: '500' }}>
          ⚠️ This action cannot be undone. All your data will be permanently deleted.
        </p>
      </div>

      <h2 style={{ color: '#374151', fontSize: '18px', marginBottom: '16px' }}>Account Deletion Process</h2>
      
      <p style={{ color: '#6b7280', marginBottom: '16px' }}>
        To delete your Wellness Buddy account and all associated data, please follow these steps:
      </p>

      <ol style={{ color: '#6b7280', paddingLeft: '20px', marginBottom: '24px' }}>
        <li style={{ marginBottom: '8px' }}>Send an email to <strong>easy2work.india@gmail.com</strong></li>
        <li style={{ marginBottom: '8px' }}>Include your registered email address in the request</li>
        <li style={{ marginBottom: '8px' }}>Use subject line: "Account Deletion Request - Wellness Buddy"</li>
        <li style={{ marginBottom: '8px' }}>We will process your request within 7 business days</li>
      </ol>

      <h3 style={{ color: '#374151', fontSize: '16px', marginBottom: '12px' }}>What will be deleted:</h3>
      <ul style={{ color: '#6b7280', paddingLeft: '20px', marginBottom: '24px' }}>
        <li>Your account information (name, email)</li>
        <li>All nutrition analysis data and history</li>
        <li>Food photos and analysis results</li>
        <li>App preferences and settings</li>
        <li>All associated data from our servers</li>
      </ul>

      <div style={{ backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '8px', border: '1px solid #bae6fd', marginBottom: '24px' }}>
        <p style={{ color: '#0369a1', margin: 0 }}>
          💡 <strong>Alternative:</strong> You can also delete your account directly from the app settings if available.
        </p>
      </div>

      <div style={{ textAlign: 'center', marginTop: '32px' }}>
        <a href="mailto:easy2work.india@gmail.com?subject=Account%20Deletion%20Request%20-%20Wellness%20Buddy"
           style={{
             backgroundColor: '#dc2626',
             color: 'white',
             padding: '12px 24px',
             textDecoration: 'none',
             borderRadius: '8px',
             fontWeight: '500',
             display: 'inline-block'
           }}>
          Send Deletion Request Email
        </a>
      </div>

    </div>
  );
}