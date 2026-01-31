// apps/web/src/app/dca/page.tsx
'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWallet } from '@/hooks/useWallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { TokenSelector } from '@/components/swap/TokenSelector';
import { ChainSelector } from '@/components/wallet/ChainSelector';
import { useTokenStore } from '@/stores/tokenStore';
import {
  Calendar,
  Clock,
  TrendingUp,
  Play,
  Pause,
  X,
  ChevronRight,
  DollarSign,
  Repeat,
  AlertTriangle,
  CheckCircle,
  BarChart3,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';

export default function DCAPage() {
  const { isConnected, address } = useWallet();
  const queryClient = useQueryClient();
  const { tokens, chains } = useTokenStore();

  const [activeTab, setActiveTab] = useState('strategies');

  // Form state
  const [name, setName] = useState('');
  const [inputChainId, setInputChainId] = useState<number | string>(1);
  const [outputChainId, setOutputChainId] = useState<number | string>(1);
  const [inputToken, setInputToken] = useState<any>(null);
  const [outputToken, setOutputToken] = useState<any>(null);
  const [amountPerExecution, setAmountPerExecution] = useState('');
  const [frequency, setFrequency] = useState<string>('DAILY');
  const [totalExecutions, setTotalExecutions] = useState('');
  const [skipOnHighGas, setSkipOnHighGas] = useState(false);
  const [maxGasUsd, setMaxGasUsd] = useState('10');

  // Fetch strategies
  const { data: strategiesData, isLoading } = useQuery({
    queryKey: ['dca-strategies', address],
    queryFn: () => api.get('/api/v1/dca').then((r) => r.data),
    enabled: isConnected,
  });

  // Create strategy
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/v1/dca', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dca-strategies'] });
      resetForm();
      setActiveTab('strategies');
    },
  });

  // Pause/Resume strategy
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'pause' | 'resume' }) =>
      api.post(`/api/v1/dca/${id}/${action}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dca-strategies'] });
    },
  });

  // Cancel strategy
  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/dca/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dca-strategies'] });
    },
  });

  const resetForm = () => {
    setName('');
    setAmountPerExecution('');
    setTotalExecutions('');
  };

  const handleCreate = () => {
    if (!inputToken || !outputToken || !amountPerExecution) return;

    createMutation.mutate({
      name: name || `DCA ${inputToken.symbol} → ${outputToken.symbol}`,
      fromChainId: String(inputChainId),
      toChainId: String(outputChainId),
      fromTokenAddress: inputToken.address,
      toTokenAddress: outputToken.address,
      fromTokenSymbol: inputToken.symbol,
      toTokenSymbol: outputToken.symbol,
      amountPerExecution,
      frequency,
      totalExecutions: totalExecutions ? parseInt(totalExecutions) : undefined,
      skipOnHighGas,
      maxGasUsd: skipOnHighGas ? parseFloat(maxGasUsd) : undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      ACTIVE: 'bg-green-500/10 text-green-500',
      PAUSED: 'bg-yellow-500/10 text-yellow-500',
      COMPLETED: 'bg-blue-500/10 text-blue-500',
      CANCELLED: 'bg-gray-500/10 text-gray-500',
    };
    return <Badge className={variants[status] || ''}>{status}</Badge>;
  };

  const getFrequencyLabel = (freq: string) => {
    const labels: Record<string, string> = {
      HOURLY: 'Every hour',
      DAILY: 'Daily',
      WEEKLY: 'Weekly',
      BIWEEKLY: 'Every 2 weeks',
      MONTHLY: 'Monthly',
    };
    return labels[freq] || freq;
  };

  const calculateTotalInvested = (strategy: any) => {
    return parseFloat(strategy.totalInputAmount || '0');
  };

  const calculateAveragePrice = (strategy: any) => {
    const input = parseFloat(strategy.totalInputAmount || '0');
    const output = parseFloat(strategy.totalOutputAmount || '0');
    return output > 0 ? input / output : 0;
  };

  if (!isConnected) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold mb-2">Connect Wallet</h2>
            <p className="text-muted-foreground">
              Connect your wallet to create and manage DCA strategies
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Dollar Cost Averaging</h1>
          <p className="text-muted-foreground">
            Automatically invest at regular intervals to reduce volatility risk
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="strategies">
            My Strategies ({strategiesData?.strategies?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="create">Create New</TabsTrigger>
        </TabsList>

        {/* Strategies Tab */}
        <TabsContent value="strategies">
          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">Loading...</CardContent>
            </Card>
          ) : strategiesData?.strategies?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Repeat className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No DCA Strategies</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first DCA strategy to start investing automatically
                </p>
                <Button onClick={() => setActiveTab('create')}>
                  Create Strategy
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {strategiesData?.strategies?.map((strategy: any) => (
                <Card key={strategy.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{strategy.name}</h3>
                          {getStatusBadge(strategy.status)}
                        </div>

                        <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            {strategy.amountPerExecution} {strategy.fromTokenSymbol}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {getFrequencyLabel(strategy.frequency)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Next: {format(new Date(strategy.nextExecutionAt), 'MMM d, HH:mm')}
                          </span>
                        </div>

                        {/* Progress */}
                        {strategy.totalExecutions && (
                          <div className="mb-4">
                            <div className="flex justify-between text-sm mb-1">
                              <span>Progress</span>
                              <span>{strategy.executedCount} / {strategy.totalExecutions} executions</span>
                            </div>
                            <Progress 
                              value={(strategy.executedCount / strategy.totalExecutions) * 100} 
                              className="h-2"
                            />
                          </div>
                        )}

                        {/* Stats */}
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <div className="text-sm text-muted-foreground">Total Invested</div>
                            <div className="text-lg font-semibold">
                              {calculateTotalInvested(strategy).toFixed(4)} {strategy.fromTokenSymbol}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Total Acquired</div>
                            <div className="text-lg font-semibold">
                              {parseFloat(strategy.totalOutputAmount || '0').toFixed(4)} {strategy.toTokenSymbol}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Average Price</div>
                            <div className="text-lg font-semibold">
                              {calculateAveragePrice(strategy).toFixed(6)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Executions</div>
                            <div className="text-lg font-semibold">
                              {strategy.executedCount}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-6">
                        {strategy.status === 'ACTIVE' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleStatusMutation.mutate({ id: strategy.id, action: 'pause' })}
                          >
                            <Pause className="w-4 h-4 mr-1" />
                            Pause
                          </Button>
                        )}
                        {strategy.status === 'PAUSED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleStatusMutation.mutate({ id: strategy.id, action: 'resume' })}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Resume
                          </Button>
                        )}
                        {(strategy.status === 'ACTIVE' || strategy.status === 'PAUSED') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('Are you sure you want to cancel this strategy?')) {
                                cancelMutation.mutate(strategy.id);
                              }
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                        <Link href={`/dca/${strategy.id}`}>
                          <Button variant="ghost" size="sm">
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Create Tab */}
        <TabsContent value="create">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Create DCA Strategy</CardTitle>
                <CardDescription>
                  Set up automatic recurring purchases
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Strategy Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Strategy Name (optional)</label>
                  <Input
                    placeholder="My ETH DCA"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                {/* From Token */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Invest</label>
                  <div className="flex gap-2">
                    <ChainSelector
                      chains={chains}
                      selectedChainId={inputChainId}
                      onSelect={(chain) => setInputChainId(chain.chainId)}
                    />
                    <TokenSelector
                      tokens={tokens.filter((t) => t.chainId === inputChainId)}
                      selectedToken={inputToken}
                      onSelect={setInputToken}
                    />
                  </div>
                </div>

                {/* To Token */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">To Buy</label>
                  <div className="flex gap-2">
                    <ChainSelector
                      chains={chains}
                      selectedChainId={outputChainId}
                      onSelect={(chain) => setOutputChainId(chain.chainId)}
                    />
                    <TokenSelector
                      tokens={tokens.filter((t) => t.chainId === outputChainId)}
                      selectedToken={outputToken}
                      onSelect={setOutputToken}
                    />
                  </div>
                </div>

                {/* Amount per execution */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount per purchase</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="100"
                      value={amountPerExecution}
                      onChange={(e) => setAmountPerExecution(e.target.value)}
                    />
                    <span className="flex items-center px-3 bg-muted rounded-lg">
                      {inputToken?.symbol || 'Token'}
                    </span>
                  </div>
                </div>

                {/* Frequency */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 bg-background"
                  >
                    <option value="HOURLY">Hourly</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Every 2 weeks</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>

                {/* Total executions */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Number of purchases (optional)</label>
                  <Input
                    type="number"
                    placeholder="Unlimited"
                    value={totalExecutions}
                    onChange={(e) => setTotalExecutions(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty for unlimited purchases until you cancel
                  </p>
                </div>

                {/* Gas settings */}
                <div className="space-y-3 p-4 rounded-lg bg-muted">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Skip on high gas</label>
                    <input
                      type="checkbox"
                      checked={skipOnHighGas}
                      onChange={(e) => setSkipOnHighGas(e.target.checked)}
                      className="rounded"
                    />
                  </div>
                  {skipOnHighGas && (
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Max gas cost (USD)</label>
                      <Input
                        type="number"
                        value={maxGasUsd}
                        onChange={(e) => setMaxGasUsd(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* Summary */}
                {amountPerExecution && (
                  <div className="p-4 rounded-lg border space-y-2">
                    <h4 className="font-medium">Strategy Summary</h4>
                    <div className="text-sm text-muted-foreground">
                      <p>
                        Invest <strong>{amountPerExecution} {inputToken?.symbol}</strong> to buy{' '}
                        <strong>{outputToken?.symbol}</strong> {getFrequencyLabel(frequency).toLowerCase()}
                      </p>
                      {totalExecutions && (
                        <p className="mt-1">
                          Total investment: <strong>{(parseFloat(amountPerExecution) * parseInt(totalExecutions)).toFixed(2)} {inputToken?.symbol}</strong> over {totalExecutions} purchases
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCreate}
                  disabled={!inputToken || !outputToken || !amountPerExecution || createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creating...' : 'Create DCA Strategy'}
                </Button>
              </CardContent>
            </Card>

            {/* Info */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Why DCA?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <div>
                      <strong>Reduce volatility risk</strong>
                      <p className="text-muted-foreground">
                        By investing fixed amounts regularly, you average out the purchase price over time.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <div>
                      <strong>Remove emotional trading</strong>
                      <p className="text-muted-foreground">
                        Automated investing removes the temptation to time the market.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <div>
                      <strong>Build wealth consistently</strong>
                      <p className="text-muted-foreground">
                        Regular investments compound over time, building your portfolio steadily.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Important Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    • Ensure sufficient balance for each scheduled purchase
                  </p>
                  <p>
                    • A 0.4% platform fee applies to each execution
                  </p>
                  <p>
                    • Gas costs are separate and vary by network
                  </p>
                  <p>
                    • You can pause or cancel your strategy at any time
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
