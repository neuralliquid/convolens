import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowUpDown } from "lucide-react"
import { SortOption } from "@utils/dashboard-utils"
import type { Platform, PlatformFilter } from "@/types/platform"

interface PlatformOption<T = string> {
  value: T
  label: string
  disabled?: boolean
}

interface DashboardControlsProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  filterType: string
  onFilterChange: (value: string) => void
  sortBy: SortOption
  sortOrder: 'asc' | 'desc'
  onSort: (field: SortOption) => void
  getSortIndicator: (field: SortOption) => string | null
  selectedPlatform: PlatformFilter
  onPlatformChange: (platform: PlatformFilter) => void
  platforms: Array<PlatformOption<PlatformFilter>>
}

export function DashboardControls({
  searchTerm,
  onSearchChange,
  filterType,
  onFilterChange,
  sortBy,
  sortOrder,
  onSort,
  getSortIndicator,
  selectedPlatform,
  onPlatformChange,
  platforms
}: DashboardControlsProps) {
  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'favorites', label: 'Favorites' },
    { value: 'recent', label: 'Recent' },
  ]

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'createdAt', label: 'Date Created' },
    { value: 'updatedAt', label: 'Last Updated' },
  ] as const

  return (
    <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 md:space-x-4">
      <div className="flex-1">
        <Input
          placeholder="Search..."
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
          className="w-full"
        />
      </div>

      <div className="flex items-center space-x-2">
        <div className="w-40">
          <Select value={filterType} onValueChange={onFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by..." />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-48">
          <Select 
            value={selectedPlatform} 
            onValueChange={(value: string) => onPlatformChange(value as PlatformFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select platform..." />
            </SelectTrigger>
            <SelectContent>
              {platforms.map((platform) => (
                <SelectItem 
                  key={platform.value} 
                  value={platform.value}
                  disabled={platform.disabled}
                >
                  {platform.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-40">
          <div className="flex items-center space-x-2">
            <Select 
              value={sortBy} 
              onValueChange={(value: string) => onSort(value as SortOption)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => onSort(sortBy)}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              <ArrowUpDown className={`h-4 w-4 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
