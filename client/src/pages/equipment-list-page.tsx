import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Equipment } from "@shared/schema";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MainNav } from "@/components/main-nav";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useMemo } from "react";
import { EquipmentFilters } from "@/components/equipment-filters";


export default function EquipmentListPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<FilterParams>({
    search: "",
    category: "all",
    minPrice: 0,
    maxPrice: 100000,
    location: "",
  });

  const { data: equipment, isLoading, error, refetch } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
    staleTime: 0,
    refetchOnMount: true,
    retry: false
  });

  const filteredEquipment = useMemo(() => {
    if (!equipment) return [];

    return equipment.filter((item) => {
      // Search filter
      const matchesSearch =
        filters.search === "" ||
        item.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.description.toLowerCase().includes(filters.search.toLowerCase());

      // Category filter - check if 'all' or matches the category id
      const matchesCategory =
        filters.category === "all" ||
        item.category.toLowerCase() === filters.category.toLowerCase();

      // Price filter
      const matchesPrice =
        item.dailyRate >= filters.minPrice && item.dailyRate <= filters.maxPrice;

      // Location filter
      const matchesLocation =
        filters.location === "" ||
        item.location.toLowerCase().includes(filters.location.toLowerCase());

      return matchesSearch && matchesCategory && matchesPrice && matchesLocation;
    });
  }, [equipment, filters]);

  // Find the maximum price in the equipment list for the price range slider
  const maxPrice = useMemo(() => {
    if (!equipment || equipment.length === 0) return 100000;
    return Math.max(...equipment.map((item) => item.dailyRate));
  }, [equipment]);

  if (isLoading) {
    return (
      <div>
        <MainNav onFilterChange={setFilters} maxPrice={maxPrice} />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {t("common.loading", "Loading equipment...")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <MainNav onFilterChange={setFilters} maxPrice={maxPrice} />
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t("common.loadError", "Failed to load equipment. Please try again.")}
            </AlertDescription>
          </Alert>
          <Button onClick={() => refetch()} variant="outline" className="mt-4">
            {t("common.retry", "Retry Loading")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <MainNav onFilterChange={setFilters} maxPrice={maxPrice} />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">
          {t("equipment.availableEquipment", "Available Equipment")}
        </h1>

        <div className="grid grid-cols-12 gap-6">
          {/* Filters sidebar */}
          <div className="col-span-12 lg:col-span-3">
            <EquipmentFilters
              onFilterChange={setFilters}
              maxPrice={maxPrice}
              isLoading={isLoading}
            />
          </div>

          {/* Equipment grid */}
          <div className="col-span-12 lg:col-span-9">
            {filteredEquipment && filteredEquipment.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEquipment.map((item) => (
                  <Card
                    key={item.id}
                    className={`relative ${!item.availability ? "opacity-75" : ""}`}
                  >
                    <Badge
                      variant={item.availability ? "success" : "destructive"}
                      className="absolute top-2 right-2 z-10"
                    >
                      {item.availability ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1" />{" "}
                          {t("equipment.available", "Available")}
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-1" />{" "}
                          {t("equipment.unavailable", "Unavailable")}
                        </>
                      )}
                    </Badge>
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder-image.jpg";
                      }}
                    />
                    <CardContent className="p-4">
                      <div className="mb-2">
                        <h2 className="text-xl font-semibold">{item.name}</h2>
                      </div>
                      <p className="text-muted-foreground mb-4">
                        {item.description.slice(0, 100)}...
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-medium">
                          ₹{item.dailyRate} {t("equipment.perDay", "/day")}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {item.location}
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter className="p-4 pt-0">
                      <Button
                        asChild
                        className="w-full"
                        variant={item.availability ? "default" : "secondary"}
                        disabled={!item.availability}
                      >
                        <Link to={`/equipment/${item.id}`}>
                          {item.availability
                            ? t("equipment.viewDetails", "View Details")
                            : t("equipment.currentlyUnavailable", "Currently Unavailable")}
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {t("equipment.noEquipment", "No equipment found matching your criteria.")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}