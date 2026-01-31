// apps/admin/src/app/security/page.tsx
'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Lock,
  Unlock,
  Key,
  Fingerprint,
  Smartphone,
  Globe,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Activity,
  Clock,
  MapPin,
  Monitor,
  FileWarning,
  Ban,
  UserX,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

// Types
interface SecuritySettings {
  // Authentication
  mfaRequired: boolean;
  mfaMethods: ('totp' | 'sms' | 'email')[];
  sessionTimeout: number;
  maxSessions: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSymbols: boolean;
  passwordExpiryDays: number;

  // Rate Limiting
  globalRateLimit: number;
  globalRateLimitWindow: number;
  loginRateLimit: number;
  loginRateLimitWindow: number;

  // IP Security
  ipWhitelistEnabled: boolean;
  ipWhitelist: string[];
  ipBlacklistEnabled: boolean;
  ipBlacklist: string[];
  geoBlockingEnabled: boolean;
  blockedCountries: string[];

  // API Security
  apiKeyRotationDays: number;
  apiKeyMaxAge: number;
  webhookSecretRotationDays: number;
  
  // Audit
  auditLogRetentionDays: number;
  sensitiveDataMasking: boolean;
}

interface SecurityEvent {
  id: string;
  type: 'login' | 'logout' | 'failed_login' | 'mfa_enabled' | 'mfa_disabled' | 'password_change' | 'api_key_created' | 'api_key_deleted' | 'suspicious_activity' | 'ip_blocked';
  severity: 'info' | 'warning' | 'critical';
  userId?: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  details: string;
  createdAt: string;
}

interface BlockedIP {
  id: string;
  ip: string;
  reason: string;
  blockedAt: string;
  blockedBy: string;
  expiresAt?: string;
  isAutomatic: boolean;
}

interface ActiveSession {
  id: string;
  userId: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

const EVENT_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  login: { icon: CheckCircle2, color: 'text-green-500' },
  logout: { icon: XCircle, color: 'text-gray-500' },
  failed_login: { icon: ShieldAlert, color: 'text-yellow-500' },
  mfa_enabled: { icon: ShieldCheck, color: 'text-green-500' },
  mfa_disabled: { icon: ShieldX, color: 'text-red-500' },
  password_change: { icon: Key, color: 'text-blue-500' },
  api_key_created: { icon: Key, color: 'text-blue-500' },
  api_key_deleted: { icon: Trash2, color: 'text-red-500' },
  suspicious_activity: { icon: AlertTriangle, color: 'text-orange-500' },
  ip_blocked: { icon: Ban, color: 'text-red-500' },
};

const COUNTRIES = [
  { code: 'CN', name: 'China' },
  { code: 'RU', name: 'Russia' },
  { code: 'KP', name: 'North Korea' },
  { code: 'IR', name: 'Iran' },
  { code: 'SY', name: 'Syria' },
  { code: 'CU', name: 'Cuba' },
  // Add more as needed
];

export default function SecurityPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [ipInput, setIpInput] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch security settings
  const { data: settingsData, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['admin', 'security', 'settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/security/settings');
      if (!res.ok) throw new Error('Failed to fetch security settings');
      return res.json() as Promise<{ settings: SecuritySettings }>;
    },
  });

  // Fetch security events
  const { data: eventsData, isLoading: isLoadingEvents } = useQuery({
    queryKey: ['admin', 'security', 'events'],
    queryFn: async () => {
      const res = await fetch('/api/admin/security/events?limit=50');
      if (!res.ok) throw new Error('Failed to fetch security events');
      return res.json() as Promise<{ events: SecurityEvent[] }>;
    },
    enabled: activeTab === 'audit',
  });

  // Fetch blocked IPs
  const { data: blockedIpsData, isLoading: isLoadingBlockedIps } = useQuery({
    queryKey: ['admin', 'security', 'blocked-ips'],
    queryFn: async () => {
      const res = await fetch('/api/admin/security/blocked-ips');
      if (!res.ok) throw new Error('Failed to fetch blocked IPs');
      return res.json() as Promise<{ blockedIps: BlockedIP[] }>;
    },
    enabled: activeTab === 'ip-security',
  });

  // Fetch active sessions
  const { data: sessionsData, isLoading: isLoadingSessions } = useQuery({
    queryKey: ['admin', 'security', 'sessions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/security/sessions');
      if (!res.ok) throw new Error('Failed to fetch sessions');
      return res.json() as Promise<{ sessions: ActiveSession[] }>;
    },
    enabled: activeTab === 'sessions',
  });

  const [settings, setSettings] = useState<SecuritySettings | null>(null);

  // Initialize settings when data loads
  React.useEffect(() => {
    if (settingsData?.settings && !settings) {
      setSettings(settingsData.settings);
    }
  }, [settingsData, settings]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: Partial<SecuritySettings>) => {
      const res = await fetch('/api/admin/security/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'security', 'settings'] });
      setHasChanges(false);
      toast.success('Security settings saved');
    },
    onError: () => {
      toast.error('Failed to save settings');
    },
  });

  // Block IP mutation
  const blockIpMutation = useMutation({
    mutationFn: async ({ ip, reason }: { ip: string; reason: string }) => {
      const res = await fetch('/api/admin/security/blocked-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, reason }),
      });
      if (!res.ok) throw new Error('Failed to block IP');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'security', 'blocked-ips'] });
      setShowBlockDialog(false);
      setIpInput('');
      setBlockReason('');
      toast.success('IP blocked successfully');
    },
    onError: () => {
      toast.error('Failed to block IP');
    },
  });

  // Unblock IP mutation
  const unblockIpMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/security/blocked-ips/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to unblock IP');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'security', 'blocked-ips'] });
      toast.success('IP unblocked');
    },
    onError: () => {
      toast.error('Failed to unblock IP');
    },
  });

  // Terminate session mutation
  const terminateSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/admin/security/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to terminate session');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'security', 'sessions'] });
      toast.success('Session terminated');
    },
    onError: () => {
      toast.error('Failed to terminate session');
    },
  });

  const updateSettings = (updates: Partial<SecuritySettings>) => {
    if (settings) {
      setSettings({ ...settings, ...updates });
      setHasChanges(true);
    }
  };

  const handleSaveSettings = () => {
    if (settings) {
      saveSettingsMutation.mutate(settings);
    }
  };

  if (isLoadingSettings || !settings) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security</h1>
          <p className="text-muted-foreground">
            Manage platform security settings and monitor activity
          </p>
        </div>
        {hasChanges && (
          <Button onClick={handleSaveSettings} disabled={saveSettingsMutation.isPending}>
            {saveSettingsMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        )}
      </div>

      {/* Security Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                settings.mfaRequired ? 'bg-green-500/10' : 'bg-yellow-500/10'
              )}>
                <Fingerprint className={cn(
                  'h-5 w-5',
                  settings.mfaRequired ? 'text-green-500' : 'text-yellow-500'
                )} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">MFA Status</p>
                <p className="font-semibold">
                  {settings.mfaRequired ? 'Required' : 'Optional'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Session Timeout</p>
                <p className="font-semibold">{settings.sessionTimeout} minutes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                settings.ipWhitelistEnabled ? 'bg-green-500/10' : 'bg-gray-500/10'
              )}>
                <Globe className={cn(
                  'h-5 w-5',
                  settings.ipWhitelistEnabled ? 'text-green-500' : 'text-gray-500'
                )} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">IP Whitelist</p>
                <p className="font-semibold">
                  {settings.ipWhitelistEnabled ? `${settings.ipWhitelist.length} IPs` : 'Disabled'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Ban className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Blocked IPs</p>
                <p className="font-semibold">{blockedIpsData?.blockedIps?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Shield className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="authentication">
            <Fingerprint className="h-4 w-4 mr-2" />
            Authentication
          </TabsTrigger>
          <TabsTrigger value="ip-security">
            <Globe className="h-4 w-4 mr-2" />
            IP Security
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Monitor className="h-4 w-4 mr-2" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="audit">
            <Activity className="h-4 w-4 mr-2" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Password Policy */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Password Policy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="minLength">Minimum Length</Label>
                  <Input
                    id="minLength"
                    type="number"
                    min={8}
                    max={32}
                    value={settings.passwordMinLength}
                    onChange={(e) => updateSettings({ passwordMinLength: parseInt(e.target.value) })}
                    className="w-20"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Require Uppercase</Label>
                  <Switch
                    checked={settings.passwordRequireUppercase}
                    onCheckedChange={(v) => updateSettings({ passwordRequireUppercase: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Require Lowercase</Label>
                  <Switch
                    checked={settings.passwordRequireLowercase}
                    onCheckedChange={(v) => updateSettings({ passwordRequireLowercase: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Require Numbers</Label>
                  <Switch
                    checked={settings.passwordRequireNumbers}
                    onCheckedChange={(v) => updateSettings({ passwordRequireNumbers: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Require Symbols</Label>
                  <Switch
                    checked={settings.passwordRequireSymbols}
                    onCheckedChange={(v) => updateSettings({ passwordRequireSymbols: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="expiryDays">Password Expiry (days)</Label>
                  <Input
                    id="expiryDays"
                    type="number"
                    min={0}
                    max={365}
                    value={settings.passwordExpiryDays}
                    onChange={(e) => updateSettings({ passwordExpiryDays: parseInt(e.target.value) })}
                    className="w-20"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Rate Limiting */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Rate Limiting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Global API Rate Limit</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={settings.globalRateLimit}
                      onChange={(e) => updateSettings({ globalRateLimit: parseInt(e.target.value) })}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">requests per</span>
                    <Input
                      type="number"
                      min={1}
                      value={settings.globalRateLimitWindow}
                      onChange={(e) => updateSettings({ globalRateLimitWindow: parseInt(e.target.value) })}
                      className="w-20"
                    />
                    <span className="text-muted-foreground">seconds</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Login Rate Limit</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={settings.loginRateLimit}
                      onChange={(e) => updateSettings({ loginRateLimit: parseInt(e.target.value) })}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">attempts per</span>
                    <Input
                      type="number"
                      min={1}
                      value={settings.loginRateLimitWindow}
                      onChange={(e) => updateSettings({ loginRateLimitWindow: parseInt(e.target.value) })}
                      className="w-20"
                    />
                    <span className="text-muted-foreground">seconds</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* API Security */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  API Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>API Key Rotation</Label>
                    <p className="text-xs text-muted-foreground">
                      Recommend key rotation after this period
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={settings.apiKeyRotationDays}
                      onChange={(e) => updateSettings({ apiKeyRotationDays: parseInt(e.target.value) })}
                      className="w-20"
                    />
                    <span className="text-muted-foreground">days</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Max API Key Age</Label>
                    <p className="text-xs text-muted-foreground">
                      Force expiry after this period (0 = never)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={settings.apiKeyMaxAge}
                      onChange={(e) => updateSettings({ apiKeyMaxAge: parseInt(e.target.value) })}
                      className="w-20"
                    />
                    <span className="text-muted-foreground">days</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Audit Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileWarning className="h-4 w-4" />
                  Audit & Logging
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Log Retention</Label>
                    <p className="text-xs text-muted-foreground">
                      How long to keep audit logs
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={30}
                      value={settings.auditLogRetentionDays}
                      onChange={(e) => updateSettings({ auditLogRetentionDays: parseInt(e.target.value) })}
                      className="w-20"
                    />
                    <span className="text-muted-foreground">days</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Sensitive Data Masking</Label>
                    <p className="text-xs text-muted-foreground">
                      Mask sensitive data in logs
                    </p>
                  </div>
                  <Switch
                    checked={settings.sensitiveDataMasking}
                    onCheckedChange={(v) => updateSettings({ sensitiveDataMasking: v })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Authentication Tab */}
        <TabsContent value="authentication" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Fingerprint className="h-4 w-4" />
                Multi-Factor Authentication
              </CardTitle>
              <CardDescription>
                Configure MFA requirements for all users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Require MFA</Label>
                  <p className="text-sm text-muted-foreground">
                    Force all users to enable MFA before accessing the platform
                  </p>
                </div>
                <Switch
                  checked={settings.mfaRequired}
                  onCheckedChange={(v) => updateSettings({ mfaRequired: v })}
                />
              </div>

              <div className="space-y-3">
                <Label>Allowed MFA Methods</Label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { value: 'totp', label: 'Authenticator App', icon: Smartphone },
                    { value: 'sms', label: 'SMS', icon: Smartphone },
                    { value: 'email', label: 'Email', icon: Globe },
                  ].map((method) => {
                    const isEnabled = settings.mfaMethods.includes(method.value as any);
                    const Icon = method.icon;
                    return (
                      <Button
                        key={method.value}
                        variant={isEnabled ? 'default' : 'outline'}
                        onClick={() => {
                          if (isEnabled) {
                            updateSettings({
                              mfaMethods: settings.mfaMethods.filter((m) => m !== method.value),
                            });
                          } else {
                            updateSettings({
                              mfaMethods: [...settings.mfaMethods, method.value as any],
                            });
                          }
                        }}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {method.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min={5}
                    max={1440}
                    value={settings.sessionTimeout}
                    onChange={(e) => updateSettings({ sessionTimeout: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto logout after inactivity
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxSessions">Max Concurrent Sessions</Label>
                  <Input
                    id="maxSessions"
                    type="number"
                    min={1}
                    max={10}
                    value={settings.maxSessions}
                    onChange={(e) => updateSettings({ maxSessions: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Per user session limit
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* IP Security Tab */}
        <TabsContent value="ip-security" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* IP Whitelist */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    IP Whitelist
                  </CardTitle>
                  <Switch
                    checked={settings.ipWhitelistEnabled}
                    onCheckedChange={(v) => updateSettings({ ipWhitelistEnabled: v })}
                  />
                </div>
                <CardDescription>
                  Only allow access from these IP addresses
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., 192.168.1.1 or 10.0.0.0/24"
                    value={ipInput}
                    onChange={(e) => setIpInput(e.target.value)}
                    disabled={!settings.ipWhitelistEnabled}
                  />
                  <Button
                    variant="outline"
                    disabled={!settings.ipWhitelistEnabled || !ipInput}
                    onClick={() => {
                      if (ipInput && !settings.ipWhitelist.includes(ipInput)) {
                        updateSettings({
                          ipWhitelist: [...settings.ipWhitelist, ipInput],
                        });
                        setIpInput('');
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {settings.ipWhitelist.map((ip) => (
                    <div
                      key={ip}
                      className="flex items-center justify-between p-2 bg-muted rounded-lg"
                    >
                      <code className="text-sm">{ip}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() =>
                          updateSettings({
                            ipWhitelist: settings.ipWhitelist.filter((i) => i !== ip),
                          })
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {settings.ipWhitelist.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No IPs whitelisted
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Geo Blocking */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Geo Blocking
                  </CardTitle>
                  <Switch
                    checked={settings.geoBlockingEnabled}
                    onCheckedChange={(v) => updateSettings({ geoBlockingEnabled: v })}
                  />
                </div>
                <CardDescription>
                  Block access from specific countries
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  disabled={!settings.geoBlockingEnabled}
                  onValueChange={(code) => {
                    if (!settings.blockedCountries.includes(code)) {
                      updateSettings({
                        blockedCountries: [...settings.blockedCountries, code],
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country to block" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.filter((c) => !settings.blockedCountries.includes(c.code)).map(
                      (country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2">
                  {settings.blockedCountries.map((code) => {
                    const country = COUNTRIES.find((c) => c.code === code);
                    return (
                      <Badge key={code} variant="secondary" className="gap-1">
                        {country?.name || code}
                        <button
                          onClick={() =>
                            updateSettings({
                              blockedCountries: settings.blockedCountries.filter((c) => c !== code),
                            })
                          }
                          className="ml-1 hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Blocked IPs Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Ban className="h-4 w-4" />
                    Blocked IPs
                  </CardTitle>
                  <CardDescription>
                    Manually or automatically blocked IP addresses
                  </CardDescription>
                </div>
                <Button onClick={() => setShowBlockDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Block IP
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingBlockedIps ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : !blockedIpsData?.blockedIps?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Ban className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No blocked IPs</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Blocked At</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blockedIpsData.blockedIps.map((blocked) => (
                      <TableRow key={blocked.id}>
                        <TableCell>
                          <code className="text-sm">{blocked.ip}</code>
                        </TableCell>
                        <TableCell>{blocked.reason}</TableCell>
                        <TableCell>{formatDate(blocked.blockedAt)}</TableCell>
                        <TableCell>
                          <Badge variant={blocked.isAutomatic ? 'secondary' : 'outline'}>
                            {blocked.isAutomatic ? 'Automatic' : 'Manual'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {blocked.expiresAt ? formatDate(blocked.expiresAt) : 'Never'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unblockIpMutation.mutate(blocked.id)}
                          >
                            Unblock
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Active Sessions
              </CardTitle>
              <CardDescription>
                View and manage active user sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSessions ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : !sessionsData?.sessions?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Monitor className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No active sessions</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionsData.sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{session.userEmail}</p>
                            {session.isCurrent && (
                              <Badge variant="secondary" className="text-xs">
                                Current
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm">{session.ipAddress}</code>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {session.userAgent}
                        </TableCell>
                        <TableCell>{session.location || 'Unknown'}</TableCell>
                        <TableCell>{formatDate(session.createdAt)}</TableCell>
                        <TableCell>{formatDate(session.lastActiveAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={session.isCurrent}
                            onClick={() => terminateSessionMutation.mutate(session.id)}
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            Terminate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Security Events
              </CardTitle>
              <CardDescription>
                Recent security-related events and activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEvents ? (
                <div className="space-y-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : !eventsData?.events?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No security events</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {eventsData.events.map((event) => {
                    const config = EVENT_TYPE_CONFIG[event.type] || {
                      icon: Activity,
                      color: 'text-gray-500',
                    };
                    const Icon = config.icon;
                    return (
                      <div
                        key={event.id}
                        className={cn(
                          'flex items-start gap-4 p-3 rounded-lg',
                          event.severity === 'critical' && 'bg-red-500/10',
                          event.severity === 'warning' && 'bg-yellow-500/10',
                          event.severity === 'info' && 'bg-muted/50'
                        )}
                      >
                        <div className={cn('mt-0.5', config.color)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">
                              {event.type.replace(/_/g, ' ')}
                            </span>
                            <Badge
                              variant={
                                event.severity === 'critical'
                                  ? 'destructive'
                                  : event.severity === 'warning'
                                  ? 'secondary'
                                  : 'outline'
                              }
                              className="text-xs"
                            >
                              {event.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{event.details}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            {event.userEmail && <span>User: {event.userEmail}</span>}
                            <span>IP: {event.ipAddress}</span>
                            {event.location && <span>{event.location}</span>}
                            <span>{formatDate(event.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Block IP Dialog */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block IP Address</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the IP address and reason for blocking
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="blockIp">IP Address</Label>
              <Input
                id="blockIp"
                placeholder="e.g., 192.168.1.1"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blockReason">Reason</Label>
              <Textarea
                id="blockReason"
                placeholder="Reason for blocking this IP..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!ipInput || !blockReason || blockIpMutation.isPending}
              onClick={() => blockIpMutation.mutate({ ip: ipInput, reason: blockReason })}
            >
              {blockIpMutation.isPending && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              Block IP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
