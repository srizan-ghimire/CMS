export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <ul className="divide-y divide-border rounded-md border border-border">
        <li>
          <a href="/settings/connections" className="block p-4 hover:bg-muted/40">
            <p className="text-sm font-medium">Connections</p>
            <p className="text-sm text-muted-foreground">
              Facebook, Instagram, and TikTok accounts this workspace publishes to.
            </p>
          </a>
        </li>
        <li>
          <a href="/settings/security" className="block p-4 hover:bg-muted/40">
            <p className="text-sm font-medium">Security</p>
            <p className="text-sm text-muted-foreground">
              Two-factor authentication and active sessions.
            </p>
          </a>
        </li>
      </ul>
      <a href="/settings/members" className="block rounded-lg border border-border p-4 hover:bg-accent">
        <p className="font-medium">Members</p>
        <p className="text-sm text-muted-foreground">Invite teammates and manage roles.</p>
      </a>
    </div>
  );
}
