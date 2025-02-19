import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { addDays, format, isValid, parseISO, startOfToday, isBefore, isAfter } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DateRange } from "react-day-picker";
import { useTranslation } from "react-i18next";

interface CalendarHeatmapProps {
  equipmentId: number;
  startDate?: Date;
  endDate?: Date;
  onSelect: (startDate: Date | undefined, endDate: Date | undefined) => void;
  className?: string;
}

interface AvailabilityResponse {
  available: boolean;
  startDate: string;
  endDate: string;
  message?: string;
}

interface AvailabilityData {
  available: boolean;
  startDate: Date;
  endDate: Date;
  message?: string;
}

export function CalendarHeatmap({
  equipmentId,
  startDate,
  endDate,
  onSelect,
  className,
}: CalendarHeatmapProps) {
  const { t } = useTranslation();
  const [isChecking, setIsChecking] = React.useState(false);
  const today = startOfToday();
  const initialEndDate = addDays(today, 90);

  const selectedDateRange: DateRange | undefined = React.useMemo(
    () => startDate && endDate 
      ? { from: startDate, to: endDate }
      : startDate 
      ? { from: startDate, to: undefined }
      : undefined,
    [startDate, endDate]
  );

  const { data: availability, isLoading, error, refetch } = useQuery<AvailabilityData>({
    queryKey: [`/api/equipment/${equipmentId}/availability`],
    enabled: !isChecking && equipmentId > 0,
    queryFn: async () => {
      const formattedStartDate = format(today, "yyyy-MM-dd");
      const formattedEndDate = format(initialEndDate, "yyyy-MM-dd");
      setIsChecking(true);

      try {
        const response = await fetch(
          `/api/equipment/${equipmentId}/availability?startDate=${formattedStartDate}&endDate=${formattedEndDate}`,
          { 
            credentials: "include",
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch availability: ${response.statusText}`);
        }

        const data = await response.json() as AvailabilityResponse;

        if (!data.startDate || !data.endDate) {
          throw new Error('Invalid date range received from server');
        }

        const parsedStartDate = parseISO(data.startDate);
        const parsedEndDate = parseISO(data.endDate);

        if (!isValid(parsedStartDate) || !isValid(parsedEndDate)) {
          throw new Error('Invalid date format received from server');
        }

        const parsedData = {
          available: data.available,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          message: data.message
        };

        setIsChecking(false);
        return parsedData;
      } catch (error) {
        console.error('Error fetching availability:', error);
        setIsChecking(false);
        throw error;
      }
    },
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000
  });

  const isDateAvailable = React.useCallback((date: Date): boolean => {
    if (!isValid(date) || !availability) return false;

    const isWithinRange = !isBefore(date, availability.startDate) && 
                         !isAfter(date, availability.endDate);
    const isNotPastDate = !isBefore(date, today);

    return isWithinRange && isNotPastDate && availability.available;
  }, [availability, today]);

  const handleSelect = React.useCallback((range: DateRange | undefined) => {
    if (!range) {
      onSelect(undefined, undefined);
      return;
    }

    const { from, to } = range;

    if (!from || isBefore(from, today)) {
      onSelect(undefined, undefined);
      return;
    }

    if (to) {
      if (isBefore(to, from) || !isDateAvailable(from) || !isDateAvailable(to)) {
        onSelect(undefined, undefined);
        return;
      }

      let currentDate = from;
      while (isBefore(currentDate, to)) {
        if (!isDateAvailable(currentDate)) {
          onSelect(undefined, undefined);
          return;
        }
        currentDate = addDays(currentDate, 1);
      }
    }

    onSelect(from, to);
  }, [today, onSelect, isDateAvailable]);

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : t('common.loadError')}
          </AlertDescription>
        </Alert>
        <Button 
          onClick={() => {
            setIsChecking(false);
            refetch();
          }}
          variant="outline"
          className="w-full"
        >
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  if (isLoading || isChecking) {
    return (
      <div className="flex items-center justify-center h-[350px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const handleDateChange = (range: DateRange | undefined) => {
    if (!range) {
      onSelect(undefined, undefined);
      return;
    }

    const { from, to } = range;
    onSelect(from ?? undefined, to ?? undefined);
  };

  return (
    <div className="space-y-4">
      <Calendar
        mode="range"
        selected={selectedDateRange}
        onSelect={handleDateChange}
        className={cn("rounded-md border", className)}
        disabled={(date) => isBefore(date, today) || !isDateAvailable(date)}
        modifiersStyles={{
          selected: {
            backgroundColor: "rgb(34 197 94 / 0.2)",
            color: "rgb(34 197 94)",
            fontWeight: "bold",
            cursor: "pointer"
          },
          today: {
            backgroundColor: "rgb(34 197 94 / 0.1)",
            color: "rgb(34 197 94)",
          },
          disabled: {
            backgroundColor: "rgb(244 244 245)",
            color: "rgb(161 161 170)",
            cursor: "not-allowed"
          }
        }}
        fromDate={today}
        toDate={initialEndDate}
      />
      <div className="flex gap-2 text-sm text-muted-foreground justify-center">
        <div className="flex items-center">
          <div className="mr-1 h-3 w-3 rounded-sm bg-green-100" />
          <span>{t('calendar.available')}</span>
        </div>
        <div className="flex items-center">
          <div className="mr-1 h-3 w-3 rounded-sm bg-gray-100" />
          <span>{t('calendar.unavailable')}</span>
        </div>
        {selectedDateRange?.from && (
          <div className="flex items-center">
            <div className="mr-1 h-3 w-3 rounded-sm bg-green-200" />
            <span>{t('calendar.selected')}</span>
          </div>
        )}
      </div>
      {availability?.message && (
        <Alert>
          <AlertDescription>{availability.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}