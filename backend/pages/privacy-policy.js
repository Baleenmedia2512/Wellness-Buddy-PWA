// pages/privacy-policy.js
import fs from 'fs';
import path from 'path';

export default function PrivacyPolicy() {
  return null; // This component won't render, we'll redirect
}

export async function getServerSideProps({ res }) {
  try {
    // Read the HTML file
    const filePath = path.join(process.cwd(), 'public', 'privacy-policy.html');
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    
    // Set content type and send HTML
    res.setHeader('Content-Type', 'text/html');
    res.write(htmlContent);
    res.end();
    
    return { props: {} };
  } catch (error) {
    // Fallback if file not found
    res.statusCode = 404;
    res.end('Privacy Policy not found');
    return { props: {} };
  }
}