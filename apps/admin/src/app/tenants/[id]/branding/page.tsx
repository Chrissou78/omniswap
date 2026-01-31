// apps/admin/src/app/tenants/[id]/branding/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Switch } from '@/components/ui/Switch';
import {
  Upload,
  Eye,
  Save,
  Undo,
  Palette,
  Type,
  Image,
  Layout,
  Smartphone,
  Monitor,
} from 'lucide-react';
import { SwapWidgetPreview } from '@/components/tenants/SwapWidgetPreview';

interface BrandingConfig {
  // Identity
  name: string;
  tagline: string;
  description: string;
  
  // Logos
  logo: string | null;
  logoLight: string | null;
  logoDark: string | null;
  favicon: string | null;
  
  // Colors
  colors: {
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    accent: string;
    accentForeground: string;
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    border: string;
    muted: string;
    mutedForeground: string;
    success: string;
    warning: string;
    error: string;
  };
  
  // Typography
  fonts: {
    heading: string;
    body: string;
    mono: string;
  };
  
  // Border Radius
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  
  // Dark Mode
  darkMode: {
    enabled: boolean;
    default: 'light' | 'dark' | 'system';
    colors: typeof BrandingConfig.prototype.colors;
  };
  
  // Custom CSS
  customCss: string;
}

export default function TenantBrandingPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('colors');
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [hasChanges, setHasChanges] = useState(false);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => adminApi.get(`/api/admin/tenants/${id}`).then((r) => r.data),
  });

  const [branding, setBranding] = useState<BrandingConfig | null>(null);

  useEffect(() => {
    if (tenant?.branding) {
      setBranding(tenant.branding);
    }
  }, [tenant]);

  const saveMutation = useMutation({
    mutationFn: (data: BrandingConfig) =>
      adminApi.patch(`/api/admin/tenants/${id}/branding`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      setHasChanges(false);
    },
  });

  const handleChange = (path: string, value: any) => {
    if (!branding) return;
    
    const keys = path.split('.');
    const updated = { ...branding };
    let current: any = updated;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = { ...current[keys[i]] };
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    
    setBranding(updated);
    setHasChanges(true);
  };

  const handleSave = () => {
    if (branding) {
      saveMutation.mutate(branding);
    }
  };

  const handleReset = () => {
    if (tenant?.branding) {
      setBranding(tenant.branding);
      setHasChanges(false);
    }
  };

  if (isLoading || !branding) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Branding</h1>
          <p className="text-muted-foreground">
            Customize the look and feel of {tenant.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button variant="outline" onClick={handleReset}>
              <Undo className="w-4 h-4 mr-2" />
              Reset
            </Button>
          )}
          <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Panel */}
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="identity">
                <Image className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="colors">
                <Palette className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="typography">
                <Type className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="layout">
                <Layout className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="advanced">
                Advanced
              </TabsTrigger>
            </TabsList>

            {/* Identity Tab */}
            <TabsContent value="identity" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Brand Identity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Brand Name</Label>
                    <Input
                      value={branding.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Tagline</Label>
                    <Input
                      value={branding.tagline}
                      onChange={(e) => handleChange('tagline', e.target.value)}
                      placeholder="The best multi-chain swap"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={branding.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      placeholder="SEO description..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Logos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Main Logo</Label>
                    <div className="flex items-center gap-4 mt-2">
                      {branding.logo ? (
                        <img
                          src={branding.logo}
                          alt="Logo"
                          className="w-16 h-16 object-contain rounded-lg border"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                          <Image className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <Button variant="outline">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Favicon</Label>
                    <div className="flex items-center gap-4 mt-2">
                      {branding.favicon ? (
                        <img
                          src={branding.favicon}
                          alt="Favicon"
                          className="w-8 h-8 object-contain"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                          <Image className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <Button variant="outline" size="sm">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Colors Tab */}
            <TabsContent value="colors" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Primary Colors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ColorPicker
                    label="Primary"
                    value={branding.colors.primary}
                    onChange={(v) => handleChange('colors.primary', v)}
                  />
                  <ColorPicker
                    label="Secondary"
                    value={branding.colors.secondary}
                    onChange={(v) => handleChange('colors.secondary', v)}
                  />
                  <ColorPicker
                    label="Accent"
                    value={branding.colors.accent}
                    onChange={(v) => handleChange('colors.accent', v)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Background Colors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ColorPicker
                    label="Background"
                    value={branding.colors.background}
                    onChange={(v) => handleChange('colors.background', v)}
                  />
                  <ColorPicker
                    label="Foreground"
                    value={branding.colors.foreground}
                    onChange={(v) => handleChange('colors.foreground', v)}
                  />
                  <ColorPicker
                    label="Card Background"
                    value={branding.colors.card}
                    onChange={(v) => handleChange('colors.card', v)}
                  />
                  <ColorPicker
                    label="Border"
                    value={branding.colors.border}
                    onChange={(v) => handleChange('colors.border', v)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Status Colors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ColorPicker
                    label="Success"
                    value={branding.colors.success}
                    onChange={(v) => handleChange('colors.success', v)}
                  />
                  <ColorPicker
                    label="Warning"
                    value={branding.colors.warning}
                    onChange={(v) => handleChange('colors.warning', v)}
                  />
                  <ColorPicker
                    label="Error"
                    value={branding.colors.error}
                    onChange={(v) => handleChange('colors.error', v)}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Typography Tab */}
            <TabsContent value="typography" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Fonts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Heading Font</Label>
                    <select
                      value={branding.fonts.heading}
                      onChange={(e) => handleChange('fonts.heading', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 bg-background"
                    >
                      <option value="Inter">Inter</option>
                      <option value="Poppins">Poppins</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Open Sans">Open Sans</option>
                      <option value="Montserrat">Montserrat</option>
                    </select>
                  </div>
                  <div>
                    <Label>Body Font</Label>
                    <select
                      value={branding.fonts.body}
                      onChange={(e) => handleChange('fonts.body', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 bg-background"
                    >
                      <option value="Inter">Inter</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Open Sans">Open Sans</option>
                      <option value="Lato">Lato</option>
                    </select>
                  </div>
                  <div>
                    <Label>Monospace Font</Label>
                    <select
                      value={branding.fonts.mono}
                      onChange={(e) => handleChange('fonts.mono', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 bg-background"
                    >
                      <option value="JetBrains Mono">JetBrains Mono</option>
                      <option value="Fira Code">Fira Code</option>
                      <option value="Source Code Pro">Source Code Pro</option>
                      <option value="Monaco">Monaco</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Layout Tab */}
            <TabsContent value="layout" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Border Radius</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-6 gap-2">
                    {['none', 'sm', 'md', 'lg', 'xl', 'full'].map((radius) => (
                      <button
                        key={radius}
                        onClick={() => handleChange('borderRadius', radius)}
                        className={`
                          p-4 border-2 transition-colors
                          ${branding.borderRadius === radius
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                          }
                        `}
                        style={{
                          borderRadius:
                            radius === 'none' ? '0' :
                            radius === 'sm' ? '4px' :
                            radius === 'md' ? '8px' :
                            radius === 'lg' ? '12px' :
                            radius === 'xl' ? '16px' :
                            '9999px',
                        }}
                      >
                        {radius}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Dark Mode</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Enable Dark Mode</Label>
                    <Switch
                      checked={branding.darkMode.enabled}
                      onCheckedChange={(v) => handleChange('darkMode.enabled', v)}
                    />
                  </div>
                  {branding.darkMode.enabled && (
                    <div>
                      <Label>Default Theme</Label>
                      <select
                        value={branding.darkMode.default}
                        onChange={(e) => handleChange('darkMode.default', e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 bg-background"
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="system">System</option>
                      </select>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Custom CSS</CardTitle>
                  <CardDescription>
                    Add custom CSS to override default styles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={branding.customCss}
                    onChange={(e) => handleChange('customCss', e.target.value)}
                    placeholder=".swap-widget { /* custom styles */ }"
                    rows={10}
                    className="font-mono text-sm"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Preview</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant={previewDevice === 'desktop' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewDevice('desktop')}
                >
                  <Monitor className="w-4 h-4" />
                </Button>
                <Button
                  variant={previewDevice === 'mobile' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewDevice('mobile')}
                >
                  <Smartphone className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-2" />
                <Button
                  variant={previewMode === 'light' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewMode('light')}
                >
                  Light
                </Button>
                <Button
                  variant={previewMode === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewMode('dark')}
                >
                  Dark
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={`
                  border rounded-lg overflow-hidden transition-all
                  ${previewDevice === 'mobile' ? 'max-w-[375px] mx-auto' : 'w-full'}
                `}
              >
                <SwapWidgetPreview
                  branding={branding}
                  mode={previewMode}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Color Picker Component
interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ label, value, onChange }) => {
  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 font-mono text-sm"
        />
      </div>
    </div>
  );
};
