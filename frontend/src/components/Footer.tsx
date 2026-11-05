import { useSettings } from '../settings';

export default function Footer() {
  const { settings } = useSettings();
  return (
    <footer className="footer">
      © {new Date().getFullYear()} {settings.siteName}. {settings.footerText}
      {settings.contactEmail && <> · <a href={`mailto:${settings.contactEmail}`} style={{ color: '#fff' }}>{settings.contactEmail}</a></>}
    </footer>
  );
}
