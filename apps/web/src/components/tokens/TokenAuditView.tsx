// apps/web/src/components/tokens/TokenAuditView.tsx
'use client';

import React from 'react';
import { useTokenAudit } from '@/hooks/useTokenAudit';
import { useTokenStore } from '@/stores/tokenStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { 
  Shield, 
  ShieldAlert, 
  ShieldX, 
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  ExternalLink,
  Copy,
  RefreshCw,
  TrendingUp,
  Users,
  Lock,
  Unlock,
  DollarSign,
  Code,
  User,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface TokenAuditViewProps {
  chainId: string;
  address: string;
}

export const TokenAuditView: React.FC<TokenAuditViewProps> = ({ chainId, address }) => {
  const { audit, isLoading, error, refetch } = useTokenAudit(address, chainId, {
    enabled: true,
    refetchOnMount: true,
  });

  const { tokens } = useTokenStore();
  const token = tokens.find(
    (t) => t.address.toLowerCase() === address.toLowerCase() && String(t.chainId) === chainId
  );

  const [copied, setCopied] = React.useState(false);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getExplorerUrl = () => {
    const explorers: Record<string, string> = {
      '1': 'https://etherscan.io/token/',
      '56': 'https://bscscan.com/token/',
      '137': 'https://polygonscan.com/token/',
      '42161': 'https://arbiscan.io/token/',
      '10': 'https://optimistic.etherscan.io/token/',
      '8453': 'https://basescan.org/token/',
      '43114': 'https://snowtrace.io/token/',
    };
    return explorers[chainId] ? `${explorers[chainId]}${address}` : null;
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-orange-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getRiskBgColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-500/10 border-green-500/20';
      case 'medium': return 'bg-yellow-500/10 border-yellow-500/20';
      case 'high': return 'bg-orange-500/10 border-orange-500/20';
      case 'critical': return 'bg-red-500/10 border-red-500/20';
      default: return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'low': return <Shield className="w-6 h-6 text-green-500" />;
      case 'medium': return <ShieldAlert className="w-6 h-6 text-yellow-500" />;
      case 'high': return <ShieldAlert className="w-6 h-6 text-orange-500" />;
      case 'critical': return <ShieldX className="w-6 h-6 text-red-500" />;
      default: return <Shield className="w-6 h-6 text-gray-500" />;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'high': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'medium': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'low': return <Info className="w-5 h-5 text-blue-500" />;
      default: return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Analyzing token security...</p>
        </div>
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="text-center py-12">
        <ShieldX className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Unable to fetch audit data</h2>
        <p className="text-muted-foreground mb-4">
          {error?.message || 'Token security information is not available for this token.'}
        </p>
        <Button onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Swap
      </Link>

      {/* Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            {/* Token Logo */}
            <div className="relative">
              {token?.logoURI ? (
                <img 
                  src={token.logoURI} 
                  alt={audit.symbol} 
                  className="w-16 h-16 rounded-full"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold">
                  {audit.symbol.slice(0, 2)}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1">
                {getRiskIcon(audit.riskLevel)}
              </div>
            </div>

            {/* Token Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{audit.name}</h1>
                <Badge variant="outline">{audit.symbol}</Badge>
                {audit.isTrusted && (
                  <Badge className="bg-green-500/10 text-green-500">Trusted</Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <code className="bg-muted px-2 py-1 rounded">
                  {address.slice(0, 10)}...{address.slice(-8)}
                </code>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={copyAddress}>
                  {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
                {getExplorerUrl() && (
                  <a href={getExplorerUrl()!} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>
                )}
              </div>

              <div className="flex items-center gap-4 mt-3 text-sm">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {audit.holderCount.toLocaleString()} holders
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  ${audit.totalLiquidityUsd.toLocaleString()} liquidity
                </span>
              </div>
            </div>

            {/* Risk Score */}
            <div className={`text-center p-4 rounded-lg border ${getRiskBgColor(audit.riskLevel)}`}>
              <div className={`text-4xl font-bold ${getRiskColor(audit.riskLevel)}`}>
                {audit.riskScore}
              </div>
              <div className="text-sm text-muted-foreground">Risk Score</div>
              <Badge className={`mt-2 ${getRiskBgColor(audit.riskLevel)} ${getRiskColor(audit.riskLevel)}`}>
                {audit.riskLevel.toUpperCase()}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Honeypot Warning */}
      {audit.isHoneypot && (
        <Card className="border-red-500 bg-red-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <ShieldX className="w-12 h-12 text-red-500" />
              <div>
                <h3 className="text-xl font-bold text-red-500">HONEYPOT DETECTED</h3>
                <p className="text-red-400">
                  This token cannot be sold. Do not purchase this token under any circumstances.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{audit.buyTax.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Buy Tax</div>
            {audit.buyTax > 10 && (
              <AlertTriangle className="w-4 h-4 text-orange-500 mx-auto mt-1" />
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{audit.sellTax.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Sell Tax</div>
            {audit.sellTax > 10 && (
              <AlertTriangle className="w-4 h-4 text-orange-500 mx-auto mt-1" />
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-1">
              {audit.isOpenSource ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <XCircle className="w-6 h-6 text-red-500" />
              )}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Open Source</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-1">
              {audit.isMintable ? (
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
              ) : (
                <CheckCircle className="w-6 h-6 text-green-500" />
              )}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {audit.isMintable ? 'Mintable' : 'Fixed Supply'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="risks" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="risks">
            Risks ({audit.risks.length})
          </TabsTrigger>
          <TabsTrigger value="holders">Top Holders</TabsTrigger>
          <TabsTrigger value="liquidity">Liquidity</TabsTrigger>
          <TabsTrigger value="contract">Contract</TabsTrigger>
        </TabsList>

        {/* Risks Tab */}
        <TabsContent value="risks">
          <Card>
            <CardHeader>
              <CardTitle>Security Analysis</CardTitle>
              <CardDescription>
                Powered by GoPlus Security • Last updated {formatDistanceToNow(audit.timestamp)} ago
              </CardDescription>
            </CardHeader>
            <CardContent>
              {audit.risks.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-green-500 font-medium">No security risks detected</p>
                  <p className="text-muted-foreground text-sm">
                    This token passed all security checks
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Group by severity */}
                  {['critical', 'high', 'medium', 'low', 'info'].map((severity) => {
                    const risksInSeverity = audit.risks.filter((r) => r.severity === severity);
                    if (risksInSeverity.length === 0) return null;
                    
                    return (
                      <div key={severity}>
                        <h4 className="text-sm font-medium text-muted-foreground uppercase mb-2">
                          {severity} ({risksInSeverity.length})
                        </h4>
                        {risksInSeverity.map((risk, index) => (
                          <div
                            key={index}
                            className={`
                              flex items-start gap-3 p-4 rounded-lg mb-2
                              ${getRiskBgColor(risk.severity)}
                            `}
                          >
                            {getSeverityIcon(risk.severity)}
                            <div className="flex-1">
                              <div className="font-medium">{risk.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {risk.description}
                              </div>
                            </div>
                            <Badge variant="outline" className={getRiskColor(risk.severity)}>
                              {risk.category}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Refresh Button */}
              <div className="mt-6 text-center">
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Holders Tab */}
        <TabsContent value="holders">
          <Card>
            <CardHeader>
              <CardTitle>Top Token Holders</CardTitle>
              <CardDescription>
                {audit.holderCount.toLocaleString()} total holders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {audit.topHolders.map((holder, index) => (
                  <div
                    key={holder.address}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      #{index + 1}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm truncate">
                          {holder.address.slice(0, 10)}...{holder.address.slice(-8)}
                        </code>
                        {holder.tag && (
                          <Badge variant="outline" className="text-xs">
                            {holder.tag}
                          </Badge>
                        )}
                        {holder.isContract && (
                          <Badge variant="outline" className="text-xs">
                            <Code className="w-3 h-3 mr-1" />
                            Contract
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {holder.isLocked ? (
                        <Lock className="w-4 h-4 text-green-500" />
                      ) : (
                        <Unlock className="w-4 h-4 text-muted-foreground" />
                      )}
                      <div className="text-right">
                        <div className="font-medium">{holder.percent.toFixed(2)}%</div>
                        <Progress value={holder.percent} className="w-20 h-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Concentration Warning */}
              {audit.topHolders[0]?.percent > 50 && (
                <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <span className="font-medium text-yellow-500">
                      High Concentration Risk
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    The top holder owns {audit.topHolders[0].percent.toFixed(1)}% of supply.
                    This could lead to price manipulation.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Liquidity Tab */}
        <TabsContent value="liquidity">
          <Card>
            <CardHeader>
              <CardTitle>Liquidity Sources</CardTitle>
              <CardDescription>
                Total liquidity: ${audit.totalLiquidityUsd.toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {audit.liquidity.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No liquidity pools found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {audit.liquidity
                    .sort((a, b) => b.liquidityUsd - a.liquidityUsd)
                    .map((lp, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted"
                      >
                        <div>
                          <div className="font-medium">{lp.dex}</div>
                          <div className="text-sm text-muted-foreground">{lp.pair}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            ${lp.liquidityUsd.toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {((lp.liquidityUsd / audit.totalLiquidityUsd) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Low Liquidity Warning */}
              {audit.totalLiquidityUsd < 10000 && (
                <div className="mt-4 p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    <span className="font-medium text-orange-500">
                      Low Liquidity Warning
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    This token has very low liquidity. Large trades may experience
                    significant slippage or may not execute.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contract Tab */}
        <TabsContent value="contract">
          <Card>
            <CardHeader>
              <CardTitle>Contract Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Contract Address */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-muted-foreground">Contract Address</span>
                  <div className="flex items-center gap-2">
                    <code className="text-sm">{address}</code>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={copyAddress}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Owner */}
                {audit.ownerAddress && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                    <span className="text-muted-foreground">Owner</span>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <code className="text-sm">
                        {audit.ownerAddress.slice(0, 10)}...{audit.ownerAddress.slice(-8)}
                      </code>
                    </div>
                  </div>
                )}

                {/* Creator */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-muted-foreground">Creator</span>
                  <div className="flex items-center gap-2">
                    <code className="text-sm">
                      {audit.creatorAddress.slice(0, 10)}...{audit.creatorAddress.slice(-8)}
                    </code>
                    <span className="text-sm text-muted-foreground">
                      ({audit.creatorPercent.toFixed(2)}% of supply)
                    </span>
                  </div>
                </div>

                {/* Contract Features */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                    {audit.isOpenSource ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span>Open Source</span>
                  </div>
                  
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                    {audit.isProxy ? (
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    <span>{audit.isProxy ? 'Proxy Contract' : 'Direct Contract'}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                    {audit.isMintable ? (
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    <span>{audit.isMintable ? 'Mintable' : 'Not Mintable'}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                    {audit.isTrusted ? (
                      <Shield className="w-5 h-5 text-green-500" />
                    ) : (
                      <Info className="w-5 h-5 text-muted-foreground" />
                    )}
                    <span>{audit.isTrusted ? 'Trusted' : 'Not on Trust List'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* GoPlus Attribution */}
      <div className="text-center text-sm text-muted-foreground">
        Security data powered by{' '}
        <a 
          href="https://gopluslabs.io" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          GoPlus Security
        </a>
      </div>
    </div>
  );
};
