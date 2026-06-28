import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle, TrendingUp, Zap, BarChart3, Settings } from "lucide-react";
import AuditChecklist from "@/components/AuditChecklist";
import RankingStrategy from "@/components/RankingStrategy";
import GEOOptimization from "@/components/GEOOptimization";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663790100395/A8GKtwWLwp8j9VU3Y4LJ9U/hyper_geo_logo-JZGtvDt57bhsMmHhTmJSo4.webp"
                alt="Hyper GEO"
                className="w-10 h-10"
              />
              <div>
                <h1 className="text-2xl font-bold font-mono text-primary">Hyper GEO</h1>
                <p className="text-xs text-muted-foreground">AI-Driven SEO/GEO Ranking Dashboard</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-7xl mx-auto px-4 py-8">
        {/* Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 animate-slide-in-up" style={{ animationDelay: '0ms' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Overall Score</p>
                <p className="text-3xl font-bold font-mono text-primary mt-2">72/100</p>
              </div>
              <TrendingUp className="w-5 h-5 text-primary/60" />
            </div>
            <Progress value={72} className="mt-4 h-1.5" />
          </Card>

          <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 animate-slide-in-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Audit Checks</p>
                <p className="text-3xl font-bold font-mono text-primary mt-2">18/24</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-primary/60" />
            </div>
            <p className="text-xs text-muted-foreground mt-4">6 items need attention</p>
          </Card>

          <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 animate-slide-in-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">GEO Visibility</p>
                <p className="text-3xl font-bold font-mono text-primary mt-2">+37%</p>
              </div>
              <Zap className="w-5 h-5 text-primary/60" />
            </div>
            <p className="text-xs text-muted-foreground mt-4">vs. baseline</p>
          </Card>

          <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 animate-slide-in-up" style={{ animationDelay: '300ms' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ranking Potential</p>
                <p className="text-3xl font-bold font-mono text-primary mt-2">High</p>
              </div>
              <BarChart3 className="w-5 h-5 text-primary/60" />
            </div>
            <p className="text-xs text-muted-foreground mt-4">3 months to #1</p>
          </Card>
        </div>

        {/* Tabs Section */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-card/50 border border-border/50 p-1 rounded-lg">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              Audit Checks
            </TabsTrigger>
            <TabsTrigger value="geo" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              GEO Strategy
            </TabsTrigger>
            <TabsTrigger value="ranking" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              Ranking Roadmap
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-8">
            <AuditChecklist />
          </TabsContent>

          <TabsContent value="geo" className="mt-8">
            <GEOOptimization />
          </TabsContent>

          <TabsContent value="ranking" className="mt-8">
            <RankingStrategy />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
