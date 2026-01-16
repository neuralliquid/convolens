import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Gauge, Users, FileText, MessageSquare } from "lucide-react"
import { formatNumber } from "@utils/dashboard-utils"

interface DashboardStatsProps {
  stats: {
    total: number
    active: number
    archived: number
    activePercentage: number
    todayCount: number
  }
}

const StatCard = ({ 
  title, 
  value, 
  icon: Icon,
  description 
}: { 
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  description?: string
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className="h-4 w-4 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </CardContent>
  </Card>
)

export const DashboardStats = ({ stats }: DashboardStatsProps) => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <StatCard
      title="Total Summaries"
      value={formatNumber(stats.total)}
      icon={FileText}
    />
    <StatCard
      title="Active"
      value={formatNumber(stats.active)}
      description={`${stats.activePercentage}% of total`}
      icon={Gauge}
    />
    <StatCard
      title="Archived"
      value={formatNumber(stats.archived)}
      icon={Users}
    />
    <StatCard
      title="Today"
      value={formatNumber(stats.todayCount)}
      icon={MessageSquare}
    />
  </div>
)
