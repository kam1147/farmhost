import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useTranslation } from "react-i18next";
import { X, RotateCcw, Search, MapPin, Tag, IndianRupee } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export interface FilterParams {
  search: string;
  category: string;
  minPrice: number;
  maxPrice: number;
  location: string;
}

interface EquipmentFiltersProps {
  onFilterChange: (filters: FilterParams) => void;
  maxPrice: number;
  isLoading?: boolean;
}

// Updated equipment categories with descriptive names and proper typing
const EQUIPMENT_CATEGORIES = [
  { id: "tractor", label: "Tractors & Harvesters" },
  { id: "harvester", label: "Combine Harvesters" },
  { id: "seeder", label: "Seeding Equipment" },
  { id: "irrigation", label: "Irrigation Systems" },
  { id: "plough", label: "Ploughs & Tillers" },
  { id: "sprayer", label: "Spraying Equipment" },
  { id: "cultivator", label: "Cultivators" },
  { id: "thresher", label: "Threshers" },
  { id: "combine", label: "Combine Equipment" },
  { id: "rotavator", label: "Rotavators" }
] as const;

export function EquipmentFilters({ onFilterChange, maxPrice, isLoading = false }: EquipmentFiltersProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<FilterParams>(() => {
    const savedFilters = localStorage.getItem('equipmentFilters');
    return savedFilters ? JSON.parse(savedFilters) : {
      search: "",
      category: "all",
      minPrice: 0,
      maxPrice: maxPrice,
      location: "",
    };
  });

  const [priceRange, setPriceRange] = useState([
    filters.minPrice || 0,
    filters.maxPrice || maxPrice
  ]);

  useEffect(() => {
    localStorage.setItem('equipmentFilters', JSON.stringify(filters));
  }, [filters]);

  const handleFilterChange = (newFilters: Partial<FilterParams>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilterChange(updatedFilters);
  };

  const resetFilters = () => {
    const defaultFilters = {
      search: "",
      category: "all",
      minPrice: 0,
      maxPrice: maxPrice,
      location: "",
    };
    setFilters(defaultFilters);
    setPriceRange([0, maxPrice]);
    onFilterChange(defaultFilters);
    localStorage.removeItem('equipmentFilters');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('filters.title', 'Search & Filters')}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          {t('filters.reset', 'Reset Filters')}
        </Button>
      </div>

      <div className="space-y-4">
        {/* Search input */}
        <Card>
          <CardContent className="p-4">
            <Label className="flex items-center gap-2 mb-2">
              <Search className="h-4 w-4" />
              {t('filters.search', 'Search Equipment')}
            </Label>
            <div className="relative">
              <Input
                placeholder={t('filters.searchPlaceholder', 'Search by name or description...')}
                value={filters.search}
                onChange={(e) => handleFilterChange({ search: e.target.value })}
                className="pr-8"
              />
              {filters.search && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => handleFilterChange({ search: "" })}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Category filter */}
        <Card>
          <CardContent className="p-4">
            <Label className="flex items-center gap-2 mb-2">
              <Tag className="h-4 w-4" />
              {t('filters.category', 'Equipment Category')}
            </Label>
            <Select
              value={filters.category}
              onValueChange={(value) => handleFilterChange({ category: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('filters.allCategories', 'All Categories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('filters.allCategories', 'All Categories')}
                </SelectItem>
                {EQUIPMENT_CATEGORIES.map(({ id, label }) => (
                  <SelectItem key={id} value={id}>
                    {t(`categories.${id}`, label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Price range filter */}
        <Card>
          <CardContent className="p-4">
            <Label className="flex items-center gap-2 mb-2">
              <IndianRupee className="h-4 w-4" />
              {t('filters.priceRange', 'Price Range (per day)')}
            </Label>
            <div className="pt-4">
              <Slider
                value={priceRange}
                min={0}
                max={maxPrice}
                step={Math.max(100, Math.floor(maxPrice / 100))}
                onValueChange={(value) => {
                  setPriceRange(value);
                  handleFilterChange({ minPrice: value[0], maxPrice: value[1] });
                }}
                className="mb-2"
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>₹{priceRange[0].toLocaleString('en-IN')}</span>
                <span>₹{priceRange[1].toLocaleString('en-IN')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location filter */}
        <Card>
          <CardContent className="p-4">
            <Label className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4" />
              {t('filters.location', 'Location')}
            </Label>
            <div className="relative">
              <Input
                placeholder={t('filters.locationPlaceholder', 'Enter location...')}
                value={filters.location}
                onChange={(e) => handleFilterChange({ location: e.target.value })}
                className="pr-8"
              />
              {filters.location && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => handleFilterChange({ location: "" })}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}